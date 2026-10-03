import { db, deleteAllData, type Persona } from '@/db';
import { acceptFriendRequest, declineFriendRequest } from './friendRequests';

const base: Omit<Persona, 'id' | 'name'> = {
  kind: 'public',
  gender: 'female',
  age: 25,
  city: 'Pune',
  country: 'India',
  languages: ['English'],
  occupation: 'Designer',
  interests: [],
  likes: [],
  dislikes: [],
  writingStyle: '',
  agreeableness: 0.5,
  stance: 'neutral',
  activity: 0.2,
  closeness: 0.1,
  avatar: { style: 'personas', seed: 's' },
  createdAt: 1,
  friendRequest: { at: 1, status: 'pending' },
};

beforeEach(() => deleteAllData());

describe('friend requests', () => {
  it('accepting makes the public profile a friend with a fresh friendversary', async () => {
    await db.personas.add({ ...base, id: 'p1', name: 'Neha' });
    await acceptFriendRequest('p1');
    const p = (await db.personas.get('p1'))!;
    expect(p.kind).toBe('friend');
    expect(p.friendRequest?.status).toBe('accepted');
    expect(p.closeness).toBeGreaterThanOrEqual(0.4);
    expect(p.createdAt).toBeGreaterThan(1);
  });

  it('declining keeps them public', async () => {
    await db.personas.add({ ...base, id: 'p2', name: 'Omar' });
    await declineFriendRequest('p2');
    const p = (await db.personas.get('p2'))!;
    expect(p.kind).toBe('public');
    expect(p.friendRequest?.status).toBe('declined');
  });
});
