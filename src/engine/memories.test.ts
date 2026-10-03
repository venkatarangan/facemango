import type { Persona, Post } from '@/db';
import { computeMemories } from './memories';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).getTime();
const now = day(2026, 10, 3);
const post = (id: string, createdAt: number, likes = 0): Post => ({
  id,
  authorId: 'me',
  text: id,
  mentions: [],
  createdAt,
  plannedComments: 0,
  plannedLikes: 0,
  reactionCounts: { like: likes },
  commentCount: 0,
});
const friend = (id: string, createdAt: number) =>
  ({ id, kind: 'friend', name: id, createdAt }) as Persona;

describe('computeMemories', () => {
  it('finds on-this-day posts, friendversaries, the first post and milestones', () => {
    const posts = [
      post('week', day(2026, 9, 26), 40),
      post('month', day(2026, 9, 3), 30),
      post('year', day(2025, 10, 3), 2),
      post('today', now, 5),
    ];
    const memories = computeMemories(posts, [friend('Priya', day(2026, 9, 3))], now);
    const labels = memories
      .filter((m) => m.kind === 'onThisDay')
      .map((m) => (m as { label: string }).label);
    expect(labels).toEqual(['1 week ago', '1 month ago', '1 year ago']);
    expect(memories.find((m) => m.kind === 'friendversary')).toMatchObject({ label: '1 month' });
    expect(memories.find((m) => m.kind === 'firstPost')).toMatchObject({ post: { id: 'year' } });
    expect(
      memories.find((m) => m.kind === 'milestone' && m.id.startsWith('reactions')),
    ).toMatchObject({ title: '50 reactions!' });
    expect(memories.find((m) => m.kind === 'bestPost')).toMatchObject({ post: { id: 'week' } });
  });

  it('is empty for a brand-new user', () => {
    expect(computeMemories([], [], now)).toEqual([]);
  });
});
