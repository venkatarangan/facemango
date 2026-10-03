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
    await resetFriends();
    expect((await db.personas.toArray()).map((p) => p.kind)).toEqual(['former', 'former']);
    expect((await db.events.get('e1'))?.status).toBe('cancelled');
    expect((await db.events.get('e2'))?.status).toBe('planned');
    expect(await db.meta.get('setupComplete')).toBeUndefined();
    expect(runSetup).toHaveBeenCalled();
  });
});
