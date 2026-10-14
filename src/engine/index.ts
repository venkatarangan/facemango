import { db, ME, type Comment } from '@/db';
import { runSetup } from './onboarding';
import { chance, defaultRng, uniform } from './random';
import { startScheduler } from './scheduler';
import { getEngagementConfig } from './settings';

export { onUserPost } from './userPosts';

let started = false;

/** Starts first-run setup (if needed) and the engagement loop. Safe to call repeatedly. */
export function startEngine(): void {
  if (started) return;
  started = true;
  void runSetup();
  startScheduler();
}

/** Friends reply to the user (SPEC §3.2 replies, §8 #4). */
export async function onUserComment(comment: Comment): Promise<void> {
  const post = await db.posts.get(comment.postId);
  if (!post) return;
  const config = await getEngagementConfig();
  const minute = 60_000 / config.speed;
  const parent = comment.parentId ? await db.comments.get(comment.parentId) : undefined;

  let responderId: string | undefined;
  if (parent && parent.authorId !== ME && chance(defaultRng, 0.65)) responderId = parent.authorId;
  else if (!parent && post.authorId !== ME && chance(defaultRng, 0.75)) responderId = post.authorId;
  if (!responderId) return;
  const responder = await db.personas.get(responderId);
  if (!responder || responder.kind === 'former') return;

  await db.events.add({
    id: crypto.randomUUID(),
    type: 'reply',
    status: 'planned',
    dueAt: Date.now() + uniform(defaultRng, 1, 8) * minute,
    postId: post.id,
    personaId: responderId,
    payload: {
      replyTo: comment.id,
      category: responder.stance === 'critic' && chance(defaultRng, 0.4) ? 'critical' : 'good',
      userPost: true,
    },
  });
}
