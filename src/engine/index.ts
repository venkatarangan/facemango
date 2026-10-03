import { db, ME, type Comment, type Post } from '@/db';
import { describeUserPhoto } from './describe';
import { runSetup } from './onboarding';
import { planEngagement } from './planner';
import { chance, defaultRng, uniform } from './random';
import { startScheduler } from './scheduler';
import { getEngagementConfig } from './settings';

let started = false;

/** Starts first-run setup (if needed) and the engagement loop. Safe to call repeatedly. */
export function startEngine(): void {
  if (started) return;
  started = true;
  void runSetup();
  startScheduler();
}

/** Plans engagement for a new post by the user (SPEC §4.2), with a warm burst for the first one. */
export async function onUserPost(post: Post): Promise<void> {
  const [friends, publics, profile, config, previous] = await Promise.all([
    db.personas.where('kind').equals('friend').toArray(),
    db.personas.where('kind').equals('public').toArray(),
    db.profile.get(ME),
    getEngagementConfig(),
    db.posts.where('authorId').equals(ME).count(),
  ]);
  const first = previous <= 1;
  const tuned = first
    ? {
        ...config,
        comments: {
          ...config.comments,
          min: Math.max(config.comments.min, Math.min(3, config.comments.max)),
        },
        speed: config.speed * 2,
      }
    : config;
  const plan = planEngagement({
    postId: post.id,
    authorId: ME,
    createdAt: post.createdAt,
    mentions: post.mentions,
    isUserPost: true,
    friends,
    publics,
    config: tuned,
    userAge: profile?.age ?? 18,
    rng: defaultRng,
  });
  await db.transaction('rw', db.posts, db.events, async () => {
    await db.posts.update(post.id, {
      plannedComments: plan.plannedComments,
      plannedLikes: plan.plannedLikes,
    });
    await db.events.bulkAdd(plan.events);
  });
  if (post.photo) void describeUserPhoto(post.id, post.photo);
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
