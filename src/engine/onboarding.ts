import { whenAIReady } from '@/ai';
import { db, ME } from '@/db';
import { createPersonaPost } from './friendPosts';
import { buildFriendSkeletons, generateFriends, generatePublics } from './personas';
import { defaultRng, randInt, uniform, weightedSample } from './random';
import { getEngagementConfig, getMeta, setMeta } from './settings';
import { setSetup } from './store';

const HOUR = 3_600_000;
let running: Promise<void> | null = null;

/**
 * First run (SPEC §3.1 steps 4–5): friends → public profiles → 15–25 back-dated seed posts.
 * Resumable: each step tops up what is already stored, so an interrupted setup continues.
 */
export function runSetup(): Promise<void> {
  running ??= setup().finally(() => {
    running = null;
  });
  return running;
}

async function setup(): Promise<void> {
  if (await getMeta('setupComplete', false)) {
    setSetup({ stage: 'done', done: 0, total: 0 });
    return;
  }
  setSetup({ stage: 'waiting-for-ai', done: 0, total: 0, error: undefined });
  const ai = await whenAIReady();
  const profile = await db.profile.get(ME);
  if (!profile) return;
  const config = await getEngagementConfig();
  const rng = defaultRng;

  try {
    // 1. Friends
    const existingFriends = await db.personas.where('kind').equals('friend').toArray();
    const friendTarget = config.friendCount;
    setSetup({ stage: 'friends', done: existingFriends.length, total: friendTarget });
    if (existingFriends.length < friendTarget) {
      const skeletons = buildFriendSkeletons(
        { ...config, friendCount: friendTarget - existingFriends.length },
        profile,
        rng,
      );
      await generateFriends(
        ai,
        profile,
        skeletons,
        rng,
        async (done, personas) => {
          await db.personas.bulkAdd(personas);
          setSetup({ done: existingFriends.length + done });
        },
        existingFriends.map((f) => f.name),
      );
    }

    // 2. Public profiles
    const friendsNow = await db.personas.where('kind').equals('friend').toArray();
    const existingPublics = await db.personas.where('kind').equals('public').count();
    const publicTarget = Math.round(config.friendCount * config.publicProfileMultiplier);
    setSetup({ stage: 'public', done: existingPublics, total: publicTarget });
    if (existingPublics < publicTarget) {
      await generatePublics(
        ai,
        profile,
        publicTarget - existingPublics,
        rng,
        async (done, personas) => {
          await db.personas.bulkAdd(personas);
          setSetup({ done: existingPublics + done });
        },
        friendsNow.map((f) => f.name),
      );
    }

    // 3. Seed feed: back-dated posts over the last three days, newest first so the top fills fast.
    const seedTarget = await getMeta<number>('seedTarget', randInt(rng, 15, 25));
    await setMeta('seedTarget', seedTarget);
    // Count only posts by the current circle, so a friends reset seeds a fresh feed.
    const circle = new Set(
      (await db.personas.where('kind').anyOf('friend', 'public').primaryKeys()) as string[],
    );
    const seeded = await db.posts.filter((p) => circle.has(p.authorId)).count();
    setSetup({ stage: 'seed', done: seeded, total: seedTarget });
    const now = Date.now();
    for (let i = seeded; i < seedTarget; i++) {
      const [author] = weightedSample(rng, friendsNow, (p) => p.activity, 1);
      if (!author) break;
      const hoursAgo = (i / seedTarget) * 70 + uniform(rng, 0.2, 2);
      await createPersonaPost(ai, author, Math.round(now - hoursAgo * HOUR), rng);
      setSetup({ done: i + 1 });
    }

    await setMeta('setupComplete', true);
    await setMeta('nextFriendPostAt', Date.now() + uniform(rng, 20, 60) * 60_000);
    setSetup({ stage: 'done' });
  } catch (error) {
    console.error('Setup failed', error);
    setSetup({
      error:
        'Setup paused because of an AI error. It will resume the next time you open FaceMango.',
    });
  }
}
