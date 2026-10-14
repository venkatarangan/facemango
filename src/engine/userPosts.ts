import { db, ME, type Post } from '@/db';
import { describeUserPhoto } from './describe';
import { planEngagement } from './planner';
import { defaultRng } from './random';
import { getEngagementConfig, getMeta, setMeta } from './settings';

/** Meta key: ids of the user's posts written before first-run setup finished. */
export const WAITING_KEY = 'postsWaitingForFriends';

/**
 * Plans engagement for a new post by the user (SPEC §4.2), with a warm burst for the first one.
 * A post written while setup is still running waits for the friends (see `planWaitingPosts`).
 */
export async function onUserPost(post: Post): Promise<void> {
  if (post.photo) void describeUserPhoto(post.id, post.photo);
  const waiting = await db.transaction('rw', db.meta, async () => {
    if (await getMeta('setupComplete', false)) return false;
    await setMeta(WAITING_KEY, [...(await getMeta<string[]>(WAITING_KEY, [])), post.id]);
    return true;
  });
  if (!waiting) await planUserPost(post, post.createdAt);
}

/** Runs once setup completes: friends react to posts written while they were on their way. */
export async function planWaitingPosts(now = Date.now()): Promise<void> {
  const ids = await db.transaction('rw', db.meta, async () => {
    const list = await getMeta<string[]>(WAITING_KEY, []);
    if (list.length) await setMeta(WAITING_KEY, []);
    return list;
  });
  const posts = (await db.posts.bulkGet(ids)).filter((p): p is Post => !!p);
  posts.sort((a, b) => a.createdAt - b.createdAt);
  for (const post of posts) await planUserPost(post, now);
}

/** Pre-plans a user post's engagement, starting at `startAt`. */
async function planUserPost(post: Post, startAt: number): Promise<void> {
  const [friends, publics, profile, config, earlier] = await Promise.all([
    db.personas.where('kind').equals('friend').toArray(),
    db.personas.where('kind').equals('public').toArray(),
    db.profile.get(ME),
    getEngagementConfig(),
    db.posts
      .where('authorId')
      .equals(ME)
      .filter((p) => p.id !== post.id && p.createdAt <= post.createdAt)
      .count(),
  ]);
  const tuned =
    earlier === 0
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
    createdAt: startAt,
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
}
