import type { CommentCategory, Persona, PlannedEvent, ReactionType } from '@/db';
import { effectiveConfig, type EngagementConfig } from './config';
import { clampComments, clampLikes } from './limits';
import { chance, normal, pickFromMix, uniform, weightedSample, type Rng } from './random';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** At most this many anonymous "others" reaction events per post; each carries a count. */
const MAX_ANON_EVENTS = 24;

export interface PlanInput {
  postId: string;
  authorId: string;
  createdAt: number;
  mentions: string[];
  /** The user's own post (full engagement) vs a friend's post (lighter). */
  isUserPost: boolean;
  friends: Persona[];
  publics: Persona[];
  config: EngagementConfig;
  userAge: number;
  rng: Rng;
}

export interface Plan {
  plannedComments: number;
  plannedLikes: number;
  events: PlannedEvent[];
}

const REACTION_MIX: Record<ReactionType, number> = {
  like: 58,
  love: 26,
  haha: 5,
  care: 4,
  wow: 4,
  sad: 2,
  angry: 1,
};

/** Comment count from the band, log-normal and skewed low (SPEC §4.2 step 1). */
export function sampleCommentCount(rng: Rng, min: number, max: number): number {
  if (max <= min) return clampComments(min);
  const median = Math.max(1, min + (max - min) / 3);
  const value = Math.exp(Math.log(median) + 0.65 * normal(rng));
  return clampComments(Math.min(max, Math.max(min, Math.round(value))));
}

/** L = max(minLikes, C × m), m ∈ [min, max] (SPEC §4.2 step 2), capped at 1,000,000. */
export function sampleLikeCount(rng: Rng, comments: number, config: EngagementConfig): number {
  const m = uniform(rng, config.likesMultiplier.min, config.likesMultiplier.max);
  return clampLikes(Math.max(config.minLikes, Math.round(comments * m)));
}

/**
 * Front-loaded delay within `window` (truncated exponential), with occasional bursts around a
 * few hotspots (SPEC §4.2 step 5, §8 #1 variable rewards).
 */
function delay(rng: Rng, window: number, hotspots: number[]): number {
  if (hotspots.length && chance(rng, 0.4)) {
    const centre = hotspots[Math.floor(rng() * hotspots.length)]!;
    return Math.max(0, centre + uniform(rng, -0.01, 0.01) * window);
  }
  const k = 4;
  const u = rng();
  return (window * -Math.log(1 - u * (1 - Math.exp(-k)))) / k;
}

/** Nudges the comment mix by the commenter's stance (SPEC §4.2 step 4). */
function mixFor(base: EngagementConfig['commentMix'], stance: Persona['stance']) {
  if (stance === 'fan') {
    return {
      ...base,
      appreciative: base.appreciative * 1.5,
      critical: base.critical * 0.3,
      superCritical: base.superCritical * 0.2,
    };
  }
  if (stance === 'critic') {
    return {
      ...base,
      appreciative: base.appreciative * 0.5,
      critical: base.critical * 3,
      superCritical: base.superCritical * 2,
    };
  }
  return base;
}

/** Pre-plans a post's whole engagement timeline (SPEC §4.2). Pure; persisted by the caller. */
export function planEngagement(input: PlanInput): Plan {
  const { rng, isUserPost } = input;
  const config = effectiveConfig(input.config, input.userAge);
  const speed = config.speed;
  const others = (list: Persona[]) => list.filter((p) => p.id !== input.authorId);
  const friends = others(input.friends);
  const publics = others(input.publics);

  // Friends' posts get lighter engagement than the user's own.
  const scale = isUserPost ? 1 : 0.45;
  const band = {
    min: Math.round(config.comments.min * scale),
    max: Math.max(0, Math.round(config.comments.max * scale)),
  };
  let comments = sampleCommentCount(rng, band.min, band.max);
  const mentioned = friends.filter((f) => input.mentions.includes(f.id));
  comments = clampComments(Math.max(comments, mentioned.length));
  const likes = Math.max(sampleLikeCount(rng, comments, config), isUserPost ? 0 : 1);

  const events: PlannedEvent[] = [];
  const at = (offset: number) => input.createdAt + offset;
  const id = () => crypto.randomUUID();

  // Who comments: mentioned friends first (they always respond, SPEC §8 #14), then weighted.
  const commentWindow = (isUserPost ? 12 * HOUR : 8 * HOUR) / speed;
  const commentHotspots = [uniform(rng, 0.02, 0.1), uniform(rng, 0.15, 0.4)].map(
    (f) => f * commentWindow,
  );
  const weightOf = (p: Persona) => 0.2 + p.closeness * 0.5 + p.activity * 0.5;
  const pool = [...friends, ...publics.map((p) => ({ ...p, closeness: p.closeness * 0.3 }))];
  const rest = weightedSample(
    rng,
    pool.filter((p) => !mentioned.includes(p)),
    weightOf,
    Math.max(0, comments - mentioned.length),
  );
  let commenters = [...mentioned, ...rest];
  // More comments than people: some people comment twice.
  while (commenters.length < comments && pool.length) {
    commenters = [
      ...commenters,
      ...weightedSample(rng, pool, weightOf, comments - commenters.length),
    ];
  }

  let critical = 0;
  commenters.forEach((persona, index) => {
    let category = pickFromMix<CommentCategory>(rng, mixFor(config.commentMix, persona.stance));
    if (category === 'critical' || category === 'superCritical') {
      if (critical >= config.maxCriticalPerPost) category = 'good';
      else critical++;
    }
    const isMention = index < mentioned.length;
    const offset = isMention
      ? uniform(rng, 2, 10) * (MINUTE / speed)
      : index === 0 && isUserPost
        ? uniform(rng, 1, 5) * (MINUTE / speed)
        : delay(rng, commentWindow, commentHotspots) + 20_000 / speed;
    events.push({
      id: id(),
      type: 'comment',
      status: 'planned',
      dueAt: at(offset),
      postId: input.postId,
      personaId: persona.id,
      payload: { category, mention: isMention, userPost: isUserPost },
    });
  });

  // Who likes: named friends and public profiles, then anonymous "others" (SPEC §4.2 step 3).
  const reactionWindow = (isUserPost ? 24 * HOUR : 16 * HOUR) / speed;
  const reactionHotspots = [
    uniform(rng, 0.005, 0.03),
    uniform(rng, 0.05, 0.15),
    uniform(rng, 0.2, 0.5),
  ].map((f) => f * reactionWindow);
  const likeWeight = (p: Persona) => 0.15 + p.activity * 0.6 + p.closeness * 0.4;
  const named = weightedSample(
    rng,
    [...friends, ...publics],
    likeWeight,
    Math.min(likes, friends.length + publics.length),
  );
  named.forEach((persona, index) => {
    const type =
      persona.stance === 'critic' ? 'like' : pickFromMix<ReactionType>(rng, REACTION_MIX);
    const offset =
      index === 0 && isUserPost
        ? uniform(rng, 10, 90) * (1000 / speed)
        : delay(rng, reactionWindow, reactionHotspots);
    events.push({
      id: id(),
      type: 'reaction',
      status: 'planned',
      dueAt: at(offset),
      postId: input.postId,
      personaId: persona.id,
      payload: { reaction: type, userPost: isUserPost },
    });
  });

  let anonymous = likes - named.length;
  const anonEvents = Math.min(MAX_ANON_EVENTS, anonymous);
  for (let i = 0; i < anonEvents; i++) {
    const count =
      i === anonEvents - 1
        ? anonymous
        : Math.max(1, Math.round((anonymous / (anonEvents - i)) * uniform(rng, 0.5, 1.5)));
    anonymous -= count;
    events.push({
      id: id(),
      type: 'reaction',
      status: 'planned',
      dueAt: at(delay(rng, reactionWindow, reactionHotspots)),
      postId: input.postId,
      payload: { reaction: 'like', count, userPost: isUserPost },
    });
    if (anonymous <= 0) break;
  }

  events.sort((a, b) => a.dueAt - b.dueAt);
  return { plannedComments: comments, plannedLikes: likes, events };
}
