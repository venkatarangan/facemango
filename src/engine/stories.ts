/**
 * Friends' life stories (SPEC §4.3.1): multi-week arcs that unfold one post at a time. The story
 * state lives in the `stories` table, not in the model, so even small models stay consistent.
 * Everything here is pure; friendPosts.ts does the AI calls and storage.
 */
import type { Persona, Post, Story } from '@/db';
import { storyConfig } from './config';
import { fillSlots, STORY_TEMPLATES, templateById, type StoryTemplate } from './storyTemplates';
import { uniform, weightedSample, type Rng } from './random';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** At most a third of friends (by default) have an active story; always at least one. */
export const maxActiveStories = (friendCount: number) =>
  Math.max(1, Math.floor(friendCount * storyConfig.maxActiveShare));

export type StoryAction =
  { kind: 'beat'; story: Story } | { kind: 'start'; persona: Persona; template: StoryTemplate };

/** Templates that suit this persona's age and that they haven't lived through already. */
export function templatesFor(persona: Persona, done: string[] = []): StoryTemplate[] {
  return STORY_TEMPLATES.filter(
    (t) =>
      !done.includes(t.id) &&
      (t.minAge === undefined || persona.age >= t.minAge) &&
      (t.maxAge === undefined || persona.age <= t.maxAge),
  );
}

/** Picks a template, favouring ones that match the persona's interests and occupation. */
export function pickTemplate(
  persona: Persona,
  done: string[],
  rng: Rng,
): StoryTemplate | undefined {
  const about = [...persona.interests, ...persona.likes, persona.occupation].join(' ');
  return weightedSample(
    rng,
    templatesFor(persona, done),
    (t) => (t.fits.test(about) ? 4 : 1),
    1,
  )[0];
}

/**
 * What a story-share friend post at time `at` should do: post the most overdue beat; otherwise
 * start a new story if there is room (cap, start gap, per-friend cooldown); otherwise nothing.
 */
export function chooseStoryAction(input: {
  stories: Story[];
  friends: Persona[];
  at: number;
  speed: number;
  rng: Rng;
}): StoryAction | null {
  const { stories, friends, at, speed, rng } = input;
  const friendIds = new Set(friends.map((f) => f.id));
  const active = stories.filter((s) => s.status === 'active' && friendIds.has(s.personaId));
  const due = active.filter((s) => s.nextBeatAt <= at).sort((a, b) => a.nextBeatAt - b.nextBeatAt);
  if (due[0]) return { kind: 'beat', story: due[0] };

  if (active.length >= maxActiveStories(friends.length)) return null;
  const startGap = (storyConfig.startGapHours * HOUR) / speed;
  // Absolute distance: the seed feed is written newest first, back-dated.
  if (stories.some((s) => friendIds.has(s.personaId) && Math.abs(s.startedAt - at) < startGap))
    return null;
  const cooldown = (storyConfig.cooldownDays * DAY) / speed;
  const busy = new Set(
    stories
      .filter(
        (s) =>
          s.status === 'active' || (s.endedAt !== undefined && Math.abs(at - s.endedAt) < cooldown),
      )
      .map((s) => s.personaId),
  );
  const candidates = friends.filter((f) => !busy.has(f.id));
  const [persona] = weightedSample(rng, candidates, (p) => 0.2 + p.activity, 1);
  if (!persona) return null;
  const done = stories.filter((s) => s.personaId === persona.id).map((s) => s.kind);
  const template = pickTemplate(persona, done, rng);
  return template ? { kind: 'start', persona, template } : null;
}

/** Days between beats, from the template, compressed by the engagement speed. */
export function beatGap(template: StoryTemplate | undefined, rng: Rng, speed: number): number {
  const [min, max] = template?.gapDays ?? [3, 7];
  return (uniform(rng, min, max) * DAY) / speed;
}

/** Keeps model-filled specifics short and placeholder-safe. */
export function cleanSlots(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      v
        .replace(/[{}"“”\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40),
    ]),
  );
}

/** A new story, not yet stored: it is saved together with its first post. */
export function newStory(
  persona: Persona,
  template: StoryTemplate,
  slots: Record<string, string>,
  at: number,
): Story {
  return {
    id: crypto.randomUUID(),
    personaId: persona.id,
    kind: template.id,
    title: fillSlots(template.title, slots),
    slots,
    stages: template.beats.map((b) => ({
      title: fillSlots(b.title, slots),
      brief: fillSlots(b.brief, slots),
    })),
    currentStage: 0,
    status: 'active',
    startedAt: at,
    nextBeatAt: at,
    postIds: [],
  };
}

/** Records that the current beat was posted, and schedules the next one (or completes). */
export function advanceStory(
  story: Story,
  postId: string,
  at: number,
  rng: Rng,
  speed: number,
): Story {
  const stages = story.stages.map((s, i) =>
    i === story.currentStage ? { ...s, postId, postedAt: at } : s,
  );
  const currentStage = story.currentStage + 1;
  const done = currentStage >= stages.length;
  return {
    ...story,
    stages,
    currentStage,
    postIds: [...story.postIds, postId],
    status: done ? 'completed' : 'active',
    endedAt: done ? at : undefined,
    nextBeatAt: done ? story.nextBeatAt : at + beatGap(templateById(story.kind), rng, speed),
  };
}

/** The label stored on a beat's post (shown on the post card). */
export const storyTag = (story: Story): NonNullable<Post['story']> => ({
  id: story.id,
  title: story.title,
  beat: story.currentStage + 1,
  total: story.stages.length,
});

export interface StoryPromptContext {
  title: string;
  beat: number;
  total: number;
  brief: string;
  daysIn: number;
  /** Earlier beats in order, with the post text where we still have it. */
  earlier: { title: string; text?: string }[];
}

/** Context for writing the current beat's post. */
export function storyPromptContext(
  story: Story,
  at: number,
  postText: (postId: string) => string | undefined,
): StoryPromptContext {
  const stage = story.stages[story.currentStage]!;
  return {
    title: story.title,
    beat: story.currentStage + 1,
    total: story.stages.length,
    brief: stage.brief,
    daysIn: Math.max(0, Math.round((at - story.startedAt) / DAY)),
    earlier: story.stages
      .slice(0, story.currentStage)
      .map((s) => ({ title: s.title, text: s.postId ? postText(s.postId) : undefined })),
  };
}
