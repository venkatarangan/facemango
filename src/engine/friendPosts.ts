import type { AI } from '@/ai';
import { db, type Persona, type Post, type Story } from '@/db';
import { loadPhotoManifest, PACK_PREFIX } from '@/lib/photos';
import { getEngagementConfig, getMeta, setMeta } from './settings';
import { pickPhoto } from './photoPicker';
import { planEngagement } from './planner';
import {
  friendPostPrompt,
  friendPostSchema,
  POST_SYSTEM,
  storySlotsPrompt,
  storySlotsSchema,
} from './prompts';
import { chance, type Rng } from './random';
import {
  advanceStory,
  chooseStoryAction,
  cleanSlots,
  newStory,
  storyPromptContext,
  storyTag,
} from './stories';
import { templateById } from './storyTemplates';

/**
 * Writes and stores one post by a friend or public profile, with its engagement plan (SPEC §4.3).
 * With `story`, the post tells that story's current beat, and the story moves on (§4.3.1).
 */
export async function createPersonaPost(
  ai: AI,
  author: Persona,
  createdAt: number,
  rng: Rng,
  story?: Story,
): Promise<Post | null> {
  const template = story ? templateById(story.kind) : undefined;
  const photos = await loadPhotoManifest();
  const used = new Set(await getMeta<string[]>('usedPhotos', []));
  // Story posts steer the photo towards the story's themes (travel, food, pets…).
  const photoFor = template
    ? { ...author, interests: [...author.interests, ...template.photoHints] }
    : author;
  const photo =
    photos.length && chance(rng, template ? template.photo : 0.55)
      ? pickPhoto(photos, photoFor, used, rng)
      : undefined;
  const recent = (await db.posts.where('authorId').equals(author.id).reverse().sortBy('createdAt'))
    .slice(0, 4)
    .map((p) => p.text);
  let context;
  if (story) {
    const earlier = new Map(
      (await db.posts.bulkGet(story.postIds))
        .filter((p): p is Post => !!p)
        .map((p) => [p.id, p.text]),
    );
    context = storyPromptContext(story, createdAt, (id) => earlier.get(id));
  }

  let generated;
  try {
    generated = await ai.generateJSON(
      friendPostPrompt(
        author,
        photo ? { alt: photo.alt, tags: photo.tags } : undefined,
        recent,
        context,
      ),
      friendPostSchema,
      { system: POST_SYSTEM, maxTokens: 220, temperature: 0.95 },
    );
  } catch (error) {
    console.warn('Friend post generation failed', error);
    return null;
  }

  const [friends, publics, profile, config] = await Promise.all([
    db.personas.where('kind').equals('friend').toArray(),
    db.personas.where('kind').equals('public').toArray(),
    db.profile.get('me'),
    getEngagementConfig(),
  ]);
  const post: Post = {
    id: crypto.randomUUID(),
    authorId: author.id,
    text: generated.text.trim(),
    photo: photo ? `${PACK_PREFIX}${photo.id}` : undefined,
    feeling: generated.feeling.trim() || undefined,
    mentions: [],
    createdAt,
    plannedComments: 0,
    plannedLikes: 0,
    reactionCounts: {},
    commentCount: 0,
    story: story ? storyTag(story) : undefined,
  };
  const plan = planEngagement({
    postId: post.id,
    authorId: author.id,
    createdAt,
    mentions: [],
    isUserPost: false,
    friends,
    publics,
    config,
    userAge: profile?.age ?? 18,
    rng,
  });
  post.plannedComments = plan.plannedComments;
  post.plannedLikes = plan.plannedLikes;
  await db.transaction('rw', db.posts, db.events, db.stories, async () => {
    await db.posts.add(post);
    await db.events.bulkAdd(plan.events);
    if (story) await db.stories.put(advanceStory(story, post.id, createdAt, rng, config.speed));
  });
  if (photo) {
    used.add(photo.id);
    await setMeta('usedPhotos', used.size >= photos.length ? [] : [...used]);
  }
  return post;
}

/**
 * A life-story post (SPEC §4.3.1): the most overdue beat of an active story, or the first beat of
 * a new one. Returns null when no story is due or can start, or the AI failed; the caller then
 * writes an ordinary post instead.
 */
export async function createStoryPost(ai: AI, createdAt: number, rng: Rng): Promise<Post | null> {
  const [friends, stories, config] = await Promise.all([
    db.personas.where('kind').equals('friend').toArray(),
    db.stories.toArray(),
    getEngagementConfig(),
  ]);
  const action = chooseStoryAction({ stories, friends, at: createdAt, speed: config.speed, rng });
  if (!action) return null;
  if (action.kind === 'beat') {
    const author = friends.find((f) => f.id === action.story.personaId);
    return author ? createPersonaPost(ai, author, createdAt, rng, action.story) : null;
  }
  const { persona, template } = action;
  let filled;
  try {
    filled = await ai.generateJSON(
      storySlotsPrompt(persona, template),
      storySlotsSchema(template),
      {
        system: POST_SYSTEM,
        maxTokens: 120,
        temperature: 0.9,
      },
    );
  } catch (error) {
    console.warn('Story generation failed', error);
    return null;
  }
  const slots = cleanSlots(filled.slots);
  if (template.slots.some((s) => (slots[s.key]?.length ?? 0) < 2)) return null;
  const story = newStory(persona, template, slots, createdAt);
  return createPersonaPost(ai, persona, createdAt, rng, story);
}
