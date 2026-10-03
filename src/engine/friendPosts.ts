import type { AI } from '@/ai';
import { db, type Persona, type Post } from '@/db';
import { loadPhotoManifest, PACK_PREFIX } from '@/lib/photos';
import { getEngagementConfig, getMeta, setMeta } from './settings';
import { pickPhoto } from './photoPicker';
import { planEngagement } from './planner';
import { friendPostPrompt, friendPostSchema, POST_SYSTEM } from './prompts';
import { chance, type Rng } from './random';

/** Writes and stores one post by a friend or public profile, with its engagement plan (SPEC §4.3). */
export async function createPersonaPost(
  ai: AI,
  author: Persona,
  createdAt: number,
  rng: Rng,
): Promise<Post | null> {
  const photos = await loadPhotoManifest();
  const used = new Set(await getMeta<string[]>('usedPhotos', []));
  const photo =
    photos.length && chance(rng, 0.55) ? pickPhoto(photos, author, used, rng) : undefined;
  const recent = (await db.posts.where('authorId').equals(author.id).reverse().sortBy('createdAt'))
    .slice(0, 4)
    .map((p) => p.text);

  let generated;
  try {
    generated = await ai.generateJSON(
      friendPostPrompt(author, photo ? { alt: photo.alt, tags: photo.tags } : undefined, recent),
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
  await db.transaction('rw', db.posts, db.events, async () => {
    await db.posts.add(post);
    await db.events.bulkAdd(plan.events);
  });
  if (photo) {
    used.add(photo.id);
    await setMeta('usedPhotos', used.size >= photos.length ? [] : [...used]);
  }
  return post;
}
