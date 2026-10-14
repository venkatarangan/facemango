import { createUserPost, db, deleteAllData, deletePost, saveProfile, type Persona } from '@/db';
import { getMeta, setMeta } from './settings';
import { onUserPost, planWaitingPosts, WAITING_KEY } from './userPosts';

const friend = (id: string): Persona => ({
  id,
  kind: 'friend',
  name: `Friend ${id}`,
  gender: 'female',
  age: 30,
  city: '',
  country: '',
  languages: [],
  occupation: '',
  interests: [],
  likes: [],
  dislikes: [],
  writingStyle: '',
  agreeableness: 0.5,
  stance: 'neutral',
  activity: 0.5,
  closeness: 0.5,
  avatar: { style: 'personas', seed: id },
  createdAt: 1,
});

beforeEach(async () => {
  await deleteAllData();
  await saveProfile({ name: 'Asha', age: 28, city: 'Chennai', languages: ['English'] });
});

describe('posts written during first-run setup', () => {
  it('wait for the friends, then get planned from the moment setup finishes', async () => {
    const post = await createUserPost({ text: 'Hello while I wait', mentions: [] }, 1_000);
    await onUserPost(post);
    expect(await getMeta<string[]>(WAITING_KEY, [])).toEqual([post.id]);
    expect(await db.events.count()).toBe(0);

    // Setup finishes: the friends exist now.
    await db.personas.bulkAdd(['a', 'b', 'c', 'd', 'e'].map(friend));
    await setMeta('setupComplete', true);
    const now = 5_000_000;
    await planWaitingPosts(now);

    expect(await getMeta<string[]>(WAITING_KEY, [])).toEqual([]);
    const planned = await db.posts.get(post.id);
    expect(planned!.plannedComments).toBeGreaterThanOrEqual(3); // still the warm first-post burst
    const events = await db.events.where('postId').equals(post.id).toArray();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.dueAt >= now)).toBe(true);
    expect(events.some((e) => e.type === 'comment' && e.personaId)).toBe(true);
  });

  it('skips posts deleted in the meantime', async () => {
    const post = await createUserPost({ text: 'Never mind', mentions: [] });
    await onUserPost(post);
    await deletePost(post.id);
    await setMeta('setupComplete', true);
    await planWaitingPosts();
    expect(await db.events.count()).toBe(0);
  });

  it('plans straight away once setup is complete', async () => {
    await db.personas.bulkAdd(['a', 'b'].map(friend));
    await setMeta('setupComplete', true);
    const post = await createUserPost({ text: 'Normal day', mentions: [] });
    await onUserPost(post);
    expect(await getMeta<string[]>(WAITING_KEY, [])).toEqual([]);
    expect(await db.events.where('postId').equals(post.id).count()).toBeGreaterThan(0);
  });
});
