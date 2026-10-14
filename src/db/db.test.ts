import Dexie from 'dexie';
import { FaceMangoDB } from './db';
import { ME } from './types';

let testDb: FaceMangoDB;

beforeEach(async () => {
  testDb = new FaceMangoDB(`facemango-test-${crypto.randomUUID()}`);
  await testDb.open();
});

afterEach(async () => {
  await testDb.delete();
});

describe('FaceMangoDB schema', () => {
  it('has every table from SPEC §6.3', () => {
    expect(testDb.tables.map((t) => t.name).sort()).toEqual(
      [
        'comments',
        'events',
        'media',
        'meta',
        'moods',
        'notifications',
        'personas',
        'posts',
        'profile',
        'reactions',
        'settings',
        'usageSessions',
        'chat',
        'stories',
      ].sort(),
    );
  });

  it('upgrades a v2 database to v3, keeping existing data', async () => {
    const name = `facemango-migrate-${crypto.randomUUID()}`;
    // The shipped v1 + v2 schema, as an older app version created it.
    const old = new Dexie(name);
    old.version(1).stores({
      profile: 'id',
      personas: 'id, kind, createdAt',
      posts: 'id, authorId, createdAt',
      comments: 'id, postId, authorId, parentId, createdAt',
      reactions: 'id, postId, [postId+personaId], createdAt',
      events: 'id, postId, personaId, [status+dueAt]',
      notifications: 'id, createdAt, read',
      media: 'id, kind, createdAt',
      usageSessions: 'id, startedAt',
      moods: 'id, at',
      settings: 'key',
      meta: 'key',
    });
    old.version(2).stores({ chat: 'id, createdAt' });
    await old.open();
    await old.table('posts').add({ id: 'p1', authorId: 'f1', text: 'Hello', createdAt: 5 });
    await old.table('chat').add({ id: 'c1', role: 'user', text: 'Hi', createdAt: 6 });
    await old.table('meta').put({ key: 'setupComplete', value: true });
    old.close();

    const upgraded = new FaceMangoDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect((await upgraded.posts.get('p1'))?.text).toBe('Hello');
    expect((await upgraded.chat.get('c1'))?.text).toBe('Hi');
    expect((await upgraded.meta.get('setupComplete'))?.value).toBe(true);
    expect(await upgraded.stories.count()).toBe(0);
    await upgraded.stories.add({
      id: 's1',
      personaId: 'f1',
      kind: 'garden',
      title: 'Growing a tomato garden',
      slots: { plant: 'tomato' },
      stages: [{ title: 'Seeds', brief: 'Planted seeds.' }],
      currentStage: 0,
      status: 'active',
      startedAt: 1,
      nextBeatAt: 2,
      postIds: [],
    });
    expect(
      await upgraded.stories
        .where('[status+nextBeatAt]')
        .between(['active', 0], ['active', 3])
        .count(),
    ).toBe(1);
    await upgraded.delete();
  });

  it('queries planned events by status and due time', async () => {
    await testDb.events.bulkAdd([
      { id: 'a', type: 'reaction', status: 'planned', dueAt: 100 },
      { id: 'b', type: 'comment', status: 'planned', dueAt: 300 },
      { id: 'c', type: 'comment', status: 'applied', dueAt: 50 },
    ]);
    const due = await testDb.events
      .where('[status+dueAt]')
      .between(['planned', 0], ['planned', 200])
      .toArray();
    expect(due.map((e) => e.id)).toEqual(['a']);
  });

  it('stores a single profile row', async () => {
    await testDb.profile.put({
      id: ME,
      name: 'Asha',
      age: 21,
      city: 'Madurai',
      languages: ['Tamil', 'English'],
      createdAt: 1,
      dataNoticeAcknowledgedAt: 1,
    });
    expect((await testDb.profile.get(ME))?.city).toBe('Madurai');
    expect(await testDb.profile.count()).toBe(1);
  });
});
