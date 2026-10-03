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
      ].sort(),
    );
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
