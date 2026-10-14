/**
 * The developer real-model test suite (Settings → Advanced → Developer). Each test runs a fixed
 * prompt through the real code path in src/engine and src/ai, and stores nothing: no posts,
 * comments, friends or chat are written.
 */
import { z } from 'zod';
import { errorDetails, type AI, type AIProvider, type AITraceEvent } from '@/ai';
import type { CommentCategory, Persona, Profile } from '@/db';
import { buildAssistantRequest, MANGO_CHAT_OPTIONS } from '@/engine/assistant';
import { defaultEngagementConfig } from '@/engine/config';
import { generateFriendPost } from '@/engine/friendPosts';
import { MAX_COMMENTS_PER_POST, MAX_LIKES_PER_POST } from '@/engine/limits';
import { buildFriendSkeletons, generateFriends, generatePublics } from '@/engine/personas';
import { planEngagement } from '@/engine/planner';
import type { CommentRequest } from '@/engine/prompts';
import { seededRng, shuffle } from '@/engine/random';
import { cleanCommentText, generateCommentBatch } from '@/engine/scheduler';
import { rewritePost } from '@/features/compose/mangoRewrite';
import { loadPhotoManifest, packPhotoUrl } from '@/lib/photos';
import {
  allocateMix,
  classifyTone,
  distribution,
  duplicateCount,
  estimateTokens,
  mixDistance,
  repetitionScore,
  type Tone,
} from './scoring';

// ---------- Fixed inputs ----------

export const TEST_USER: Profile = {
  id: 'me',
  name: 'Asha Kumar',
  age: 34,
  city: 'Chennai',
  languages: ['English', 'Tamil'],
  createdAt: 0,
  dataNoticeAcknowledgedAt: 0,
};

const persona = (
  id: string,
  name: string,
  stance: Persona['stance'],
  extra: Partial<Persona>,
): Persona => ({
  id,
  kind: 'friend',
  name,
  gender: 'female',
  age: 31,
  city: 'Chennai',
  country: 'India',
  languages: ['English', 'Tamil'],
  occupation: 'Teacher',
  interests: ['music', 'cooking'],
  likes: ['filter coffee'],
  dislikes: ['traffic'],
  writingStyle: 'warm, a little chatty',
  agreeableness: 0.6,
  stance,
  activity: 0.7,
  closeness: 0.6,
  avatar: { style: 'personas', seed: id },
  createdAt: 0,
  ...extra,
});

export const TEST_PERSONAS: Persona[] = [
  persona('t1', 'Priya Raman', 'fan', {}),
  persona('t2', 'Lena Weber', 'neutral', {
    gender: 'female',
    age: 42,
    city: 'Berlin',
    country: 'Germany',
    languages: ['English', 'German'],
    occupation: 'Architect',
    interests: ['cycling', 'photography'],
    writingStyle: 'short, dry humour',
  }),
  persona('t3', 'Kofi Mensah', 'critic', {
    gender: 'male',
    age: 28,
    city: 'Accra',
    country: 'Ghana',
    languages: ['English', 'Twi'],
    occupation: 'Software developer',
    interests: ['football', 'jazz'],
    writingStyle: 'candid, lots of questions',
  }),
];

export const TEST_POST = {
  text: 'Finally finished my first half marathon this morning! Legs are jelly but heart is full 🏃‍♀️',
  feeling: 'proud',
};
const TEST_PHOTO = { alt: 'A steaming bowl of ramen on a wooden table', tags: ['food', 'noodles'] };
const CHAT_MESSAGE = 'Any ideas for a fun post this weekend?';
const COMMENT_COUNT = 20;
const COMMENT_BATCH = 4;

// ---------- Results ----------

export type TestStatus = 'pass' | 'fail' | 'skipped' | 'cancelled';

export interface Attempt {
  attempt: number;
  ms: number;
  raw: string;
  error?: string;
}

export interface ToneReport {
  target: Record<Tone, number>;
  requested: Record<Tone, number>;
  detected: Record<Tone, number>;
  /** Detected vs target, in percentage points. */
  distance: number;
}

export interface TestResult {
  id: string;
  title: string;
  status: TestStatus;
  ms: number;
  note?: string;
  /** Model calls, including retries. */
  calls: number;
  attempts: Attempt[];
  /** Zod: attempts that parsed and validated / all JSON attempts. */
  valid: number;
  retries: number;
  tokensPerSecond?: { value: number; estimated: boolean };
  repetition?: number;
  duplicates?: number;
  tone?: ToneReport;
  checks: { label: string; ok: boolean }[];
  outputs: string[];
  raw: string;
  errors: string[];
}

export interface TestContext {
  ai: AI;
  /** The unwrapped provider (to test streaming without the fallback). */
  provider: AIProvider | null;
  /** The model lock, so raw provider calls wait their turn. */
  acquire: (signal?: AbortSignal) => Promise<() => void>;
  user: Profile;
  signal: AbortSignal;
  /** Fetches a photo-pack image (tests inject a fake). */
  loadPhoto?: () => Promise<Blob | null>;
}

/** What a test body returns; the runner adds timings, attempts and retries from the trace. */
interface TestOutput {
  outputs: string[];
  raw?: string;
  checks?: { label: string; ok: boolean }[];
  tone?: ToneReport;
  note?: string;
  skipped?: string;
  /** Measured by the test itself when it calls the raw provider (no trace). */
  stream?: { text: string; ms: number };
  /** Errors that did not stop the test but explain a failure (e.g. a stream that fell back). */
  errors?: string[];
}

export interface ModelTest {
  id: string;
  title: string;
  description: string;
  run: (ctx: TestContext) => Promise<TestOutput>;
}

const checkAbort = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
};

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

const personaText = (p: Persona) =>
  `${p.name}, ${p.age}, ${p.occupation} in ${p.city}, ${p.country}. Interests: ${p.interests.join(', ')}. ${p.bio ?? ''}`;

/** Quotes or a preamble ("Sure! Here's…") mean the model ignored "post text only". */
const looksClean = (text: string) =>
  !!text.trim() && !/^\s*["“]|^(sure|here('s| is)|certainly)\b/i.test(text.trim());

// ---------- The tests ----------

export const MODEL_TESTS: ModelTest[] = [
  {
    id: 'personas',
    title: 'Friend personas',
    description: 'generateFriends: 4 friends in one batch (JSON, Zod-validated).',
    async run({ ai, user }) {
      const rng = seededRng(7);
      const skeletons = buildFriendSkeletons(
        { ...defaultEngagementConfig, friendCount: 4 },
        user,
        rng,
      );
      const people = await generateFriends(ai, user, skeletons, rng, () => {});
      const names = people.map((p) => p.name);
      return {
        outputs: people.map(personaText),
        checks: [
          { label: `${people.length} of 4 friends`, ok: people.length === 4 },
          { label: 'Names are unique', ok: new Set(names).size === names.length },
        ],
      };
    },
  },
  {
    id: 'publics',
    title: 'Public profiles',
    description: 'generatePublics: 4 public profiles (JSON, Zod-validated).',
    async run({ ai, user }) {
      const people = await generatePublics(ai, user, 4, seededRng(11), () => {});
      return {
        outputs: people.map(personaText),
        checks: [{ label: `${people.length} of 4 profiles`, ok: people.length === 4 }],
      };
    },
  },
  {
    id: 'friend-post',
    title: 'Friend posts',
    description: 'generateFriendPost: 3 posts by different friends, one with a photo.',
    async run({ ai, signal }) {
      const outputs: string[] = [];
      for (const [i, p] of TEST_PERSONAS.entries()) {
        checkAbort(signal);
        const post = await generateFriendPost(ai, p, i === 0 ? TEST_PHOTO : undefined, []);
        outputs.push(`${post.text}${post.feeling ? ` (feeling ${post.feeling})` : ''}`);
      }
      return {
        outputs,
        checks: [{ label: '3 of 3 posts', ok: outputs.length === 3 }],
      };
    },
  },
  {
    id: 'comments',
    title: 'Comments with the tone mix',
    description: `generateCommentBatch: ${COMMENT_COUNT} comments in batches of ${COMMENT_BATCH}, tones split by the default mix.`,
    async run({ ai, user, signal }) {
      const mix = defaultEngagementConfig.commentMix;
      const counts = allocateMix(mix, COMMENT_COUNT);
      const categories = shuffle(
        seededRng(3),
        (Object.keys(counts) as CommentCategory[]).flatMap((c) =>
          Array.from({ length: counts[c] }, () => c),
        ),
      );
      const requested: Tone[] = [];
      const detected: Tone[] = [];
      const outputs: string[] = [];
      let missing = 0;
      let index = 0;
      for (const batch of chunk(categories, COMMENT_BATCH)) {
        checkAbort(signal);
        const requests: CommentRequest[] = batch.map((category, i) => ({
          id: `c${i + 1}`,
          persona: TEST_PERSONAS[(index + i) % TEST_PERSONAS.length]!,
          category,
        }));
        index += batch.length;
        const result = await generateCommentBatch(ai, TEST_POST, user.name, requests, {
          recent: outputs.slice(-6),
        });
        for (const [i, r] of requests.entries()) {
          const raw = result.comments.find((c) => c.id === r.id)?.text ?? result.comments[i]?.text;
          const text = raw ? cleanCommentText(raw, r.persona.name) : '';
          if (!text) {
            missing++;
            continue;
          }
          const tone = r.category === 'superCritical' ? 'critical' : r.category;
          requested.push(tone);
          detected.push(classifyTone(text));
          outputs.push(`[${tone}] ${text}`);
        }
      }
      const target = {
        good: mix.good,
        appreciative: mix.appreciative,
        nonsense: mix.nonsense,
        critical: mix.critical + mix.superCritical,
      };
      const detectedMix = distribution(detected);
      return {
        outputs,
        checks: [
          {
            label: `${COMMENT_COUNT - missing} of ${COMMENT_COUNT} comments`,
            ok: missing === 0,
          },
        ],
        tone: {
          target,
          requested: distribution(requested),
          detected: detectedMix,
          distance: mixDistance(detectedMix, target),
        },
      };
    },
  },
  {
    id: 'engagement',
    title: 'Likes and engagement plan',
    description:
      'planEngagement (no AI; pure code): 50 plans for a post, checked against the caps and the 3–5× likes rule.',
    async run({ user }) {
      const rng = seededRng(5);
      const summary = z.object({
        comments: z.number().int().min(0).max(MAX_COMMENTS_PER_POST),
        likes: z.number().int().min(0).max(MAX_LIKES_PER_POST),
        critical: z.number().int().max(defaultEngagementConfig.maxCriticalPerPost),
        ratioOk: z.literal(true),
      });
      const plans = Array.from({ length: 50 }, (_, i) => {
        const plan = planEngagement({
          postId: `p${i}`,
          authorId: 'me',
          createdAt: 0,
          mentions: [],
          isUserPost: true,
          friends: TEST_PERSONAS,
          publics: [],
          config: defaultEngagementConfig,
          userAge: user.age,
          rng,
        });
        const { min, max } = defaultEngagementConfig.likesMultiplier;
        const c = plan.plannedComments;
        const l = plan.plannedLikes;
        return {
          comments: c,
          likes: l,
          critical: plan.events.filter(
            (e) => e.payload?.category === 'critical' || e.payload?.category === 'superCritical',
          ).length,
          ratioOk:
            l === defaultEngagementConfig.minLikes ||
            (l >= Math.floor(c * min) && l <= Math.ceil(c * max)),
        };
      });
      const failures = plans.filter((p) => !summary.safeParse(p).success);
      return {
        outputs: plans.slice(0, 5).map((p) => JSON.stringify(p)),
        raw: JSON.stringify(plans, null, 1),
        checks: [{ label: `${50 - failures.length} of 50 plans valid`, ok: !failures.length }],
        note: 'Likes are planned by code, not the model; this checks the JSON the planner makes.',
      };
    },
  },
  {
    id: 'chat-stream',
    title: 'Mango AI chat: streaming',
    description:
      'The raw provider stream, without the app’s fallback, so a streaming error shows in full.',
    async run({ provider, acquire, signal }) {
      if (!provider) return { outputs: [], skipped: 'No model loaded.' };
      const request = await buildAssistantRequest(CHAT_MESSAGE, null, []);
      const release = await acquire(signal);
      const started = performance.now();
      let text = '';
      try {
        for await (const delta of provider.stream(request.prompt, {
          ...MANGO_CHAT_OPTIONS,
          signal,
        }))
          text += delta;
      } finally {
        release();
      }
      return {
        outputs: [text],
        stream: { text, ms: performance.now() - started },
        checks: [{ label: 'Streamed some text', ok: !!text.trim() }],
      };
    },
  },
  {
    id: 'chat-generate',
    title: 'Mango AI chat: single reply',
    description: 'The non-streaming fallback (ai.generate) with the same prompt and options.',
    async run({ ai }) {
      const request = await buildAssistantRequest(CHAT_MESSAGE, null, []);
      const text = await ai.generate(request.prompt, MANGO_CHAT_OPTIONS);
      return { outputs: [text], checks: [{ label: 'Replied', ok: !!text.trim() }] };
    },
  },
  {
    id: 'chat-app',
    title: 'Mango AI chat: as the app runs it',
    description: 'ai.stream exactly as the Mango AI page calls it (falls back if streaming fails).',
    async run({ ai, signal }) {
      const request = await buildAssistantRequest(CHAT_MESSAGE, null, []);
      let text = '';
      for await (const delta of ai.stream(request.prompt, { ...MANGO_CHAT_OPTIONS, signal }))
        text += delta;
      return { outputs: [text], checks: [{ label: 'Replied', ok: !!text.trim() }] };
    },
  },
  {
    id: 'composer',
    title: 'Composer: Mango AI rewrite',
    description: 'rewritePost: "Make it funnier" and "Write for me", streamed.',
    async run({ ai, user, signal }) {
      const outputs: string[] = [];
      for (const mode of ['funnier', 'write'] as const) {
        checkAbort(signal);
        let text = '';
        for await (const delta of rewritePost(ai, mode, TEST_POST.text, user.name, signal))
          text += delta;
        outputs.push(text.trim());
      }
      return {
        outputs,
        checks: [
          { label: 'Both replies have text', ok: outputs.every(Boolean) },
          { label: 'No quotes or preamble', ok: outputs.every(looksClean) },
        ],
      };
    },
  },
  {
    id: 'photo',
    title: 'Photo description',
    description: 'ai.describeImage on a photo-pack image (only for multimodal models).',
    async run({ ai, loadPhoto }) {
      if (!ai.multimodal) return { outputs: [], skipped: 'This model can’t see images.' };
      const blob = await (loadPhoto ?? loadFirstPackPhoto)();
      if (!blob) return { outputs: [], skipped: 'No photo-pack image found.' };
      const text = (await ai.describeImage(blob, undefined, { priority: 'interactive' })) ?? '';
      return { outputs: [text], checks: [{ label: 'Described the photo', ok: !!text.trim() }] };
    },
  },
];

async function loadFirstPackPhoto(): Promise<Blob | null> {
  const [photo] = await loadPhotoManifest();
  if (!photo) return null;
  const response = await fetch(packPhotoUrl(photo));
  return response.ok ? response.blob() : null;
}

// ---------- Runner ----------

/** Runs one test with tracing on, and turns the trace into metrics. */
export async function runModelTest(
  test: ModelTest,
  ctx: TestContext,
  setTrace: (hook: ((event: AITraceEvent) => void) | null) => void,
): Promise<TestResult> {
  const events: AITraceEvent[] = [];
  setTrace((event) => events.push(event));
  const started = performance.now();
  let output: TestOutput | undefined;
  let thrown: unknown;
  try {
    checkAbort(ctx.signal);
    output = await test.run(ctx);
  } catch (error) {
    thrown = error;
  } finally {
    setTrace(null);
  }
  const ms = performance.now() - started;

  const attempts = events.flatMap((e) =>
    e.kind === 'attempt'
      ? [{ attempt: e.attempt, ms: e.ms, raw: e.raw, error: e.error } satisfies Attempt]
      : [],
  );
  const calls = events.filter((e) => e.kind === 'call');
  const usage = events.flatMap((e) => (e.kind === 'usage' ? [e] : []));
  const errors: string[] = [...(output?.errors ?? [])];
  for (const e of events) {
    if (e.kind === 'fallback')
      errors.push(`Streaming failed, fell back:\n${errorDetails(e.error)}`);
    if (e.kind === 'call' && e.error !== undefined)
      errors.push(`${e.method} failed:\n${errorDetails(e.error)}`);
  }
  const fellBack = events.some((e) => e.kind === 'fallback');

  const measured = usage.filter((u) => u.tokensPerSecond);
  let tokensPerSecond: TestResult['tokensPerSecond'];
  if (measured.length) {
    tokensPerSecond = {
      value: measured.reduce((s, u) => s + u.tokensPerSecond!, 0) / measured.length,
      estimated: false,
    };
  } else {
    const texts = [
      ...attempts.map((a) => ({ text: a.raw, ms: a.ms })),
      ...calls.flatMap((c) =>
        c.kind === 'call' && c.method !== 'generateJSON' && c.output
          ? [{ text: c.output, ms: c.ms }]
          : [],
      ),
      ...(output?.stream ? [output.stream] : []),
    ];
    const tokens = texts.reduce((s, t) => s + estimateTokens(t.text), 0);
    const seconds = texts.reduce((s, t) => s + t.ms, 0) / 1000;
    if (tokens && seconds > 0) tokensPerSecond = { value: tokens / seconds, estimated: true };
  }

  const outputs = output?.outputs ?? [];
  const checks = output?.checks ?? [];
  const cancelled = thrown instanceof DOMException && thrown.name === 'AbortError';
  if (thrown && !cancelled) errors.unshift(errorDetails(thrown));
  const status: TestStatus = cancelled
    ? 'cancelled'
    : output?.skipped
      ? 'skipped'
      : thrown || !checks.every((c) => c.ok)
        ? 'fail'
        : 'pass';

  const raw =
    output?.raw ??
    (attempts.length
      ? attempts
          .map(
            (a, i) =>
              `--- call ${i + 1}, attempt ${a.attempt + 1} (${Math.round(a.ms)} ms)${a.error ? ` INVALID: ${a.error}` : ' valid'}\n${a.raw}`,
          )
          .join('\n\n')
      : outputs.join('\n\n---\n\n'));

  return {
    id: test.id,
    title: test.title,
    status,
    ms,
    note:
      output?.skipped ??
      (fellBack ? 'Streaming failed; the app fell back to a single reply.' : output?.note),
    calls: calls.length,
    attempts,
    valid: attempts.filter((a) => !a.error).length,
    retries: attempts.filter((a) => a.attempt > 0).length,
    tokensPerSecond,
    repetition: outputs.length > 1 ? repetitionScore(outputs) : undefined,
    duplicates: outputs.length > 1 ? duplicateCount(outputs) : undefined,
    tone: output?.tone,
    checks,
    outputs,
    raw,
    errors,
  };
}

// ---------- Report ----------

export interface RunInfo {
  model: string;
  tier: string;
  device: string[];
  app: string;
  at: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** A Markdown report for "Copy results" (stays on the device; the user pastes it themselves). */
export function resultsToMarkdown(info: RunInfo, results: TestResult[]): string {
  const lines = [
    `# FaceMango real-model test`,
    '',
    `- Model: ${info.model} (${info.tier})`,
    `- App: ${info.app} · ${info.at}`,
    ...info.device.map((d) => `- ${d}`),
    '',
    '| Test | Result | Time | Zod valid | Retries | Tokens/s | Repetition |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| ${r.title} | ${r.status.toUpperCase()} | ${(r.ms / 1000).toFixed(1)} s | ${
          r.attempts.length ? `${r.valid}/${r.attempts.length}` : '–'
        } | ${r.retries} | ${
          r.tokensPerSecond
            ? `${r.tokensPerSecond.estimated ? '≈' : ''}${r.tokensPerSecond.value.toFixed(1)}`
            : '–'
        } | ${r.repetition !== undefined ? pct(r.repetition) : '–'} |`,
    ),
  ];
  for (const r of results) {
    lines.push('', `## ${r.title}: ${r.status.toUpperCase()}`);
    if (r.note) lines.push('', r.note);
    if (r.checks.length)
      lines.push('', ...r.checks.map((c) => `- ${c.ok ? '✅' : '❌'} ${c.label}`));
    if (r.tone) {
      lines.push(
        '',
        '| Tone | Target | Requested | Detected (heuristic) |',
        '| --- | --- | --- | --- |',
        ...(Object.keys(r.tone.target) as Tone[]).map(
          (t) =>
            `| ${t} | ${r.tone!.target[t]}% | ${r.tone!.requested[t]}% | ${r.tone!.detected[t]}% |`,
        ),
        '',
        `Detected vs target: ${r.tone.distance} points apart.`,
      );
    }
    if (r.errors.length) lines.push('', '```text', ...r.errors, '```');
    if (r.outputs.length) lines.push('', ...r.outputs.map((o) => `> ${o.replace(/\n/g, ' ')}`));
  }
  return lines.join('\n');
}
