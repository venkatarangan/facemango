import { whenAIReady } from '@/ai';
import { captionPhoto, getPhotoDescriptionSettings } from '@/ai/captioner';
import { db, ME } from '@/db';

const inFlight = new Map<string, Promise<void>>();

/**
 * Photo-aware comments (SPEC §8 #5): describe the user's photo once and store it on the post.
 * A model that can see images (Prompt API) does it itself; otherwise the on-device captioner
 * does. Each photo is described at most once.
 */
export function describeUserPhoto(postId: string, mediaId: string): Promise<void> {
  const key = `${postId}:${mediaId}`;
  const running = inFlight.get(key);
  if (running) return running;
  const run = describe(postId, mediaId).finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

async function describe(postId: string, mediaId: string): Promise<void> {
  const ai = await whenAIReady();
  if (!(await getPhotoDescriptionSettings()).enabled) return;
  const post = await db.posts.get(postId);
  if (!post || post.photo !== mediaId || post.photoDescription) return;

  // Cached: the same photo was already described for another post.
  const earlier = await db.posts
    .where('authorId')
    .equals(ME)
    .filter((p) => p.photo === mediaId && !!p.photoDescription)
    .first();
  if (earlier?.photoDescription) {
    await db.posts.update(postId, { photoDescription: earlier.photoDescription });
    return;
  }

  const media = await db.media.get(mediaId);
  if (!media) return;
  try {
    const description = ai.multimodal
      ? await ai.describeImage(media.blob, undefined, { priority: 'interactive' })
      : await captionPhoto(media.blob);
    if (description?.trim())
      await db.posts.update(postId, { photoDescription: description.trim().slice(0, 400) });
  } catch (error) {
    console.warn('Could not describe photo', error);
  }
}
