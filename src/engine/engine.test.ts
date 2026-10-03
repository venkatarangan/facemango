import { db, deleteAllData, saveProfile, ME } from '@/db';
import { saveEngagementConfig } from './settings';
import { defaultEngagementConfig } from './config';
import { useEngineStore } from './store';

// Full pipeline with the test-only mock model: setup → seed feed → user post → engagement.
describe('engine with the mock AI', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_MOCK_AI', '1');
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ photos: [] })));
    await deleteAllData();
    await saveProfile({
      name: 'Asha Kumar',
      age: 28,
      city: 'Chennai',
      languages: ['Tamil', 'English'],
    });
    await saveEngagementConfig({
      ...defaultEngagementConfig,
      friendCount: 5,
      publicProfileMultiplier: 1,
      speed: 60,
    });
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds friends, public profiles and a seed feed, then engages with a user post', async () => {
    const { startAI } = await import('@/ai');
    const { runSetup } = await import('./onboarding');
    const { onUserPost } = await import('./index');
    const { step } = await import('./scheduler');
    const { createUserPost } = await import('@/db');

    await startAI({ userGesture: true });
    await runSetup();
    expect(useEngineStore.getState().setup.stage).toBe('done');
    expect(await db.personas.where('kind').equals('friend').count()).toBe(5);
    expect(await db.personas.where('kind').equals('public').count()).toBe(5);
    const seeds = await db.posts.where('authorId').notEqual(ME).count();
    expect(seeds).toBeGreaterThanOrEqual(15);
    expect(seeds).toBeLessThanOrEqual(25);

    const post = await createUserPost({ text: 'First post!', mentions: [] });
    await onUserPost(post);
    const planned = await db.posts.get(post.id);
    expect(planned!.plannedComments).toBeGreaterThanOrEqual(3); // warm first-post burst

    // Jump a day ahead and let the scheduler drain everything due.
    const later = Date.now() + 26 * 3_600_000;
    for (let i = 0; i < 40 && (await step(later)); i++);
    const after = await db.posts.get(post.id);
    const reactions = Object.values(after!.reactionCounts).reduce((a, b) => a + (b ?? 0), 0);
    expect(reactions).toBe(planned!.plannedLikes);
    expect(after!.commentCount).toBeGreaterThan(0);
    expect(after!.commentCount).toBeLessThanOrEqual(100);
    expect(await db.notifications.count()).toBeGreaterThan(0);
  }, 60_000);
});
