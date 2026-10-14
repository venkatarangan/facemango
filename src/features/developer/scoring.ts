/** Pure scoring helpers for the developer real-model test page. */
import type { CommentCategory } from '@/db';

/** Lower-case words without punctuation or emoji. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function ngrams(text: string, n: number): string[] {
  const w = words(text);
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' '));
  return out;
}

/**
 * How much the outputs repeat each other, 0 (all different) to 1 (all the same): the share of
 * word n-grams (default trigrams) that also appear in another output.
 */
export function repetitionScore(texts: string[], n = 3): number {
  const perText = texts.map((t) => new Set(ngrams(t, n)));
  const seenIn = new Map<string, number>();
  for (const set of perText) for (const g of set) seenIn.set(g, (seenIn.get(g) ?? 0) + 1);
  let total = 0;
  let repeated = 0;
  for (const set of perText) {
    for (const g of set) {
      total++;
      if (seenIn.get(g)! > 1) repeated++;
    }
  }
  return total ? repeated / total : 0;
}

/** Outputs that are exact duplicates of an earlier one (ignoring case and punctuation). */
export function duplicateCount(texts: string[]): number {
  const seen = new Set<string>();
  let dupes = 0;
  for (const t of texts) {
    const key = words(t).join(' ');
    if (seen.has(key)) dupes++;
    else seen.add(key);
  }
  return dupes;
}

/** Splits `n` items across a percentage mix (largest remainder), e.g. 60/25/10/5 of 20. */
export function allocateMix<K extends string>(
  mix: Record<K, number>,
  n: number,
): Record<K, number> {
  const keys = Object.keys(mix) as K[];
  const total = keys.reduce((s, k) => s + mix[k], 0) || 1;
  const exact = keys.map((k) => ({ k, v: (mix[k] / total) * n }));
  const out = Object.fromEntries(exact.map(({ k, v }) => [k, Math.floor(v)])) as Record<K, number>;
  let left = n - keys.reduce((s, k) => s + out[k], 0);
  for (const { k } of [...exact].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  return out;
}

export type Tone = Exclude<CommentCategory, 'superCritical'>;
export const TONES: Tone[] = ['good', 'appreciative', 'nonsense', 'critical'];

const CRITICAL =
  /\b(but|however|though|honestly|not sure|disagree|could (be|use|have)|should have|too (much|many|long|short|dark|bright)|a bit (off|much)|overrated|meh|not (great|convinced|a fan)|i'd (rather|prefer)|wish)\b/;
const NONSENSE =
  /\b(lol|lmao|random|my cat|my dog|keyboard|brb|ok bye|anyway|unrelated|pizza|aliens?|banana|potato|sandwich|bored|wrong (chat|post)|oops)\b/;
const APPRECIATIVE =
  /\b(proud|so happy for you|congrat\w*|well done|inspir\w*|wonderful|beautiful|amazing|love (this|it|you)|you deserve|blessed|grateful|so sweet|heart ?warming)\b|🙌|👏|❤️|😍|🥰|💖/u;

/**
 * A rough keyword guess at a comment's tone, used only to compare the model's output with the
 * requested mix. It is a heuristic, not a judge.
 */
export function classifyTone(text: string): Tone {
  const t = text.toLowerCase();
  if (CRITICAL.test(t)) return 'critical';
  if (NONSENSE.test(t)) return 'nonsense';
  if (APPRECIATIVE.test(t)) return 'appreciative';
  return 'good';
}

/** Percentages per tone. */
export function distribution(tones: Tone[]): Record<Tone, number> {
  const out = Object.fromEntries(TONES.map((t) => [t, 0])) as Record<Tone, number>;
  for (const t of tones) out[t]++;
  for (const t of TONES) out[t] = tones.length ? Math.round((out[t] / tones.length) * 100) : 0;
  return out;
}

/** Total variation distance between two percentage mixes, in percentage points (0–100). */
export function mixDistance(a: Record<Tone, number>, b: Record<Tone, number>): number {
  return Math.round(TONES.reduce((s, t) => s + Math.abs((a[t] ?? 0) - (b[t] ?? 0)), 0) / 2);
}

/** About 4 characters per token for English; used when the backend reports no token counts. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
