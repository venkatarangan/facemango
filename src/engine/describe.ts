import { whenAIReady } from '@/ai';
import { db } from '@/db';

/** Photo-aware comments (SPEC §8 #5): describe the user's photo once, if the model can see. */
export async function describeUserPhoto(postId: string, mediaId: string): Promise<void> {
  const ai = await whenAIReady();
  if (!ai.multimodal) return;
  const media = await db.media.get(mediaId);
  if (!media) return;
  try {
    const description = await ai.describeImage(media.blob, undefined, { priority: 'interactive' });
    if (description) await db.posts.update(postId, { photoDescription: description.slice(0, 400) });
  } catch (error) {
    console.warn('Could not describe photo', error);
  }
}
