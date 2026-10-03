/**
 * Prompts and output schemas for every generation task. Small on-device models do best with
 * short, concrete prompts, few items per call and a strict JSON schema.
 */
import { z } from 'zod';
import type { CommentCategory, Persona, Post, Profile } from '@/db';

export const SAFETY =
  'Content rules: family-friendly; never abusive, hateful, sexual, violent or about protected traits ' +
  '(race, religion, gender, sexuality, disability, nationality); no real public figures; no URLs.';

// ---------- Personas ----------

export const REGIONS = [
  'south-asia',
  'east-asia',
  'southeast-asia',
  'middle-east',
  'africa',
  'europe',
  'americas',
  'oceania',
] as const;

export const SKIN_TONES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;
export const HAIR_STYLES = [
  'short',
  'long',
  'curly',
  'bun',
  'bob',
  'buzzcut',
  'bald',
  'covered',
] as const;
export const FACIAL_HAIR = ['none', 'beard', 'moustache', 'stubble'] as const;

const appearanceSchema = z.object({
  skinTone: z.enum(SKIN_TONES),
  hair: z.enum(HAIR_STYLES),
  facialHair: z.enum(FACIAL_HAIR),
  glasses: z.boolean(),
});

export const friendSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(40),
  city: z.string().min(2).max(40),
  country: z.string().min(2).max(40),
  region: z.enum(REGIONS),
  extraLanguage: z.string().max(30),
  occupation: z.string().min(2).max(50),
  interests: z.array(z.string().min(2).max(30)).min(2).max(5),
  likes: z.array(z.string().min(2).max(40)).min(1).max(4),
  dislikes: z.array(z.string().min(2).max(40)).min(1).max(3),
  writingStyle: z.string().min(3).max(120),
  bio: z.string().min(3).max(160),
  birthday: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
  appearance: appearanceSchema,
});
export const friendBatchSchema = z.object({ people: z.array(friendSchema).min(1).max(8) });
export type GeneratedFriend = z.infer<typeof friendSchema>;

export const publicSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(40),
  city: z.string().min(2).max(40),
  country: z.string().min(2).max(40),
  region: z.enum(REGIONS),
  occupation: z.string().min(2).max(50),
  interests: z.array(z.string().min(2).max(30)).min(1).max(3),
  appearance: appearanceSchema,
});
export const publicBatchSchema = z.object({ people: z.array(publicSchema).min(1).max(12) });
export type GeneratedPublic = z.infer<typeof publicSchema>;

export interface PersonaSkeleton {
  id: string;
  gender: Persona['gender'];
  age: number;
  place: 'same-city' | 'same-country' | 'abroad';
  sharedLanguage?: string;
  stance: Persona['stance'];
}

const STANCE_TEXT: Record<Persona['stance'], string> = {
  fan: 'a big fan of the user; warm and supportive',
  neutral: 'friendly but balanced',
  critic: 'often disagrees with the user; candid and opinionated but fair',
};

const PLACE_TEXT = (user: Profile, place: PersonaSkeleton['place']) =>
  place === 'same-city'
    ? `lives in ${user.city}`
    : place === 'same-country'
      ? `lives in another city in the same country as ${user.city}`
      : 'lives in a city abroad (any continent)';

export function userLine(user: Profile): string {
  return `The user is ${user.name}, ${user.age}, from ${user.city}, who speaks ${user.languages.join(', ')}.`;
}

export function friendsPrompt(user: Profile, skeletons: PersonaSkeleton[]): string {
  const lines = skeletons.map(
    (s) =>
      `- id "${s.id}": ${s.gender}, age ${s.age}, ${PLACE_TEXT(user, s.place)}, ` +
      (s.sharedLanguage
        ? `speaks ${s.sharedLanguage}`
        : 'shares no language with the user except English') +
      `; ${STANCE_TEXT[s.stance]}.`,
  );
  return [
    `Invent realistic social-media friends for a user. ${userLine(user)}`,
    "Create one fictional person for each line, keeping the given id. Names must fit the person's city and culture. Vary occupations and interests; avoid clichés.",
    'extraLanguage: one language they speak besides English (their local language). writingStyle: how they write online, e.g. "short, lots of emoji". birthday: MM-DD.',
    ...lines,
  ].join('\n');
}

export function publicsPrompt(
  user: Profile,
  items: { id: string; gender: Persona['gender'] }[],
): string {
  return [
    `Invent fictional public social-media users who might follow ${user.name} from ${user.city}. Mix nearby and far-away people from many countries.`,
    "Names must fit each person's city and culture. Keep the given ids.",
    ...items.map((i) => `- id "${i.id}": ${i.gender}`),
  ].join('\n');
}

// ---------- Posts ----------

export const POST_FEELINGS = [
  '',
  'happy',
  'grateful',
  'excited',
  'loved',
  'relaxed',
  'proud',
  'blessed',
  'thoughtful',
  'nostalgic',
  'tired',
  'sad',
  'hungry',
] as const;

export const friendPostSchema = z.object({
  text: z.string().min(3).max(400),
  feeling: z.enum(POST_FEELINGS),
});

export function personaLine(p: Persona): string {
  return `${p.name}, ${p.age}, ${p.occupation} in ${p.city}, ${p.country}. Interests: ${p.interests.join(', ')}. Writes: ${p.writingStyle}`;
}

export function friendPostPrompt(
  p: Persona,
  photo?: { alt: string; tags: string[] },
  avoid: string[] = [],
): string {
  return [
    `Write one Facebook-style post by ${personaLine(p)}.`,
    photo
      ? `The post shares this photo: ${photo.alt} (tags: ${photo.tags.join(', ')}). Write a caption in their voice; refer to what is in the photo.`
      : 'A life update, opinion, question or small moment from their day, related to their interests or city.',
    'Keep it natural and personal, 1–3 sentences, at most 2 emoji. feeling: one of the allowed values, or "" for none (most posts have none).',
    avoid.length
      ? `Do not repeat these recent posts: ${avoid.map((a) => `"${a.slice(0, 60)}"`).join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------- Comments ----------

export const CATEGORY_TEXT: Record<CommentCategory, string> = {
  good: 'positive and specific, maybe a short question',
  appreciative: 'warm praise; proud or happy for them',
  nonsense: 'a playful, off-topic or silly one-liner',
  critical: 'polite, constructive criticism or disagreement',
  superCritical: 'blunt and sharply critical, but never insulting or abusive',
};

export const commentBatchSchema = z.object({
  comments: z
    .array(z.object({ id: z.string(), text: z.string().min(1).max(300) }))
    .min(1)
    .max(8),
});

export interface CommentRequest {
  id: string;
  persona: Persona;
  category: CommentCategory;
  /** If set, this is a reply to that comment text by that author. */
  replyTo?: { author: string; text: string };
}

export function commentsPrompt(
  post: Pick<Post, 'text' | 'feeling' | 'photoDescription'>,
  postAuthor: string,
  requests: CommentRequest[],
  context: { photoAlt?: string; recent: string[] },
): string {
  const photo = post.photoDescription ?? context.photoAlt;
  return [
    `A Facebook post by ${postAuthor}: "${post.text || '(photo only)'}"${post.feeling ? ` (feeling ${post.feeling})` : ''}`,
    photo ? `The post has a photo: ${photo}` : '',
    'Write one comment from each person below, in their own voice. 3–25 words each, at most 1–2 emoji, no hashtags.',
    ...requests.map(
      (r) =>
        `- id "${r.id}": ${personaLine(r.persona)} Tone: ${CATEGORY_TEXT[r.category]}.` +
        (r.replyTo
          ? ` This is a reply to ${r.replyTo.author}, who wrote: "${r.replyTo.text.slice(0, 160)}".`
          : ''),
    ),
    context.recent.length
      ? `Don't repeat these existing comments: ${context.recent.map((c) => `"${c.slice(0, 60)}"`).join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const COMMENT_SYSTEM = `You write short, realistic social media comments for a private, simulated Facebook-like app. English only. ${SAFETY}`;
export const PERSONA_SYSTEM = `You create fictional characters for a private, simulated social network. Reply with JSON only. ${SAFETY}`;
export const POST_SYSTEM = `You write realistic, everyday social media posts for fictional people. English only. ${SAFETY}`;
