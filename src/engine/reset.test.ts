import { db, deleteAllData, type Persona } from '@/db';

vi.mock('./onboarding', () => ({ runSetup: vi.fn(async () => {}) }));

beforeEach(() => deleteAllData());

describe('resetFriends', () => {
  it('turns the circle into former friends, cancels their planned events and re-runs setup', async () => {
    const { resetFriends } = await import('./reset');
    const { runSetup } = await import('./onboarding');
    const base: Omit<Persona, 'id' | 'kind' | 'name'> = {
      gender: 'male',
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
      avatar: { style: 'personas', seed: 's' },
      createdAt: 1,
    };
    await db.personas.bulkAdd([
      { ...base, id: 'f1', kind: 'friend', name: 'A' },
      { ...base, id: 'p1', kind: 'public', name: 'B' },
    ]);
    await db.events.bulkAdd([
      {
        id: 'e1',
        type: 'comment',
        status: 'planned',
        dueAt: Date.now() + 1000,
        personaId: 'f1',
        postId: 'x',
      },
      {
        id: 'e2',
        type: 'reaction',
        status: 'planned',
        dueAt: Date.now() + 1000,
        postId: 'x',
        payload: { count: 5 },
      },
    ]);
    await db.meta.put({ key: 'setupComplete', value: true });
    const story = {
      personaId: 'f1',
      kind: 'garden',
      title: 'Growing a tomato garden',
      slots: { plant: 'tomato' },
      stages: [{ title: 'Seeds', brief: 'Planted seeds.', postId: 'x', postedAt: 1 }],
      startedAt: 1,
      nextBeatAt: Date.now() + 1000,
      postIds: ['x'],
    };
    await db.stories.bulkAdd([
      { ...story, id: 's-active', status: 'active', currentStage: 1 },
      { ...story, id: 's-done', status: 'completed', currentStage: 1, endedAt: 5 },
    ]);
    await resetFriends(1234);
    // Unfinished stories end cleanly; finished ones and their posts stay as they were.
    expect(await db.stories.get('s-active')).toMatchObject({
      status: 'abandoned',
      endedAt: 1234,
      postIds: ['x'],
    });
    expect(await db.stories.get('s-done')).toMatchObject({ status: 'completed', endedAt: 5 });
    expect((await db.personas.toArray()).map((p) => p.kind)).toEqual(['former', 'former']);
    expect((await db.events.get('e1'))?.status).toBe('cancelled');
    expect((await db.events.get('e2'))?.status).toBe('planned');
    expect(await db.meta.get('setupComplete')).toBeUndefined();
    expect(runSetup).toHaveBeenCalled();
  });
});
