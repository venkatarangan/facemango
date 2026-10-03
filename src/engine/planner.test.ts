import type { Persona } from '@/db';
import { defaultEngagementConfig, type EngagementConfig } from './config';
import { MAX_COMMENTS_PER_POST, MAX_LIKES_PER_POST } from './limits';
import { planEngagement, sampleCommentCount } from './planner';
import { seededRng } from './random';

function persona(i: number, overrides: Partial<Persona> = {}): Persona {
  return {
    id: `p${i}`,
    kind: 'friend',
    name: `Person ${i}`,
    gender: 'female',
    age: 30,
    city: 'Chennai',
    country: 'India',
    languages: ['English'],
    occupation: 'Teacher',
    interests: [],
    likes: [],
    dislikes: [],
    writingStyle: '',
    agreeableness: 0.5,
    stance: 'neutral',
    activity: 0.6,
    closeness: 0.5,
    avatar: { style: 'personas', seed: `p${i}` },
    createdAt: 0,
    ...overrides,
  };
}

const friends = Array.from({ length: 25 }, (_, i) => persona(i));
const publics = Array.from({ length: 50 }, (_, i) =>
  persona(100 + i, { kind: 'public', closeness: 0.1 }),
);

const plan = (config: EngagementConfig = defaultEngagementConfig, seed = 1, extra = {}) =>
  planEngagement({
    postId: 'post1',
    authorId: 'me',
    createdAt: 1_000_000,
    mentions: [],
    isUserPost: true,
    friends,
    publics,
    config,
    userAge: 30,
    rng: seededRng(seed),
    ...extra,
  });

const likeTotal = (events: ReturnType<typeof plan>['events']) =>
  events
    .filter((e) => e.type === 'reaction')
    .reduce((sum, e) => sum + ((e.payload?.count as number | undefined) ?? 1), 0);

describe('planEngagement', () => {
  it('keeps comments in the default 0–9 band and likes = comments × 3–5 (≥ minLikes)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = plan(defaultEngagementConfig, seed);
      expect(p.plannedComments).toBeGreaterThanOrEqual(0);
      expect(p.plannedComments).toBeLessThanOrEqual(9);
      expect(p.plannedLikes).toBeGreaterThanOrEqual(Math.max(3, p.plannedComments * 3) - 1);
      expect(p.plannedLikes).toBeLessThanOrEqual(Math.max(3, p.plannedComments * 5) + 1);
      expect(p.events.filter((e) => e.type === 'comment')).toHaveLength(p.plannedComments);
      expect(likeTotal(p.events)).toBe(p.plannedLikes);
    }
  });

  it('never exceeds the hard caps, even with extreme settings', () => {
    const extreme: EngagementConfig = {
      ...defaultEngagementConfig,
      comments: { min: 100, max: 100 },
      likesMultiplier: { min: 100, max: 100 },
      minLikes: 1000,
    };
    const p = plan(extreme);
    expect(p.plannedComments).toBe(MAX_COMMENTS_PER_POST);
    expect(p.plannedLikes).toBeLessThanOrEqual(MAX_LIKES_PER_POST);
    expect(likeTotal(p.events)).toBe(p.plannedLikes);
    expect(
      p.events.filter((e) => e.type === 'reaction' && !e.personaId).length,
    ).toBeLessThanOrEqual(24);
  });

  it('allows at most maxCriticalPerPost critical comments', () => {
    const harsh: EngagementConfig = {
      ...defaultEngagementConfig,
      comments: { min: 30, max: 30 },
      commentMix: { good: 10, appreciative: 10, nonsense: 0, critical: 40, superCritical: 40 },
    };
    for (let seed = 1; seed <= 30; seed++) {
      const critical = plan(harsh, seed).events.filter((e) =>
        ['critical', 'superCritical'].includes(e.payload?.category as string),
      );
      expect(critical.length).toBeLessThanOrEqual(2);
    }
  });

  it('never plans Super-critical comments for under-18s', () => {
    const harsh: EngagementConfig = {
      ...defaultEngagementConfig,
      comments: { min: 20, max: 20 },
      maxCriticalPerPost: 20,
      commentMix: { good: 0, appreciative: 0, nonsense: 0, critical: 0, superCritical: 100 },
    };
    const p = plan(harsh, 3, { userAge: 15 });
    expect(p.events.some((e) => e.payload?.category === 'superCritical')).toBe(false);
  });

  it('guarantees a comment from every mentioned friend, early', () => {
    const p = plan({ ...defaultEngagementConfig, comments: { min: 0, max: 0 } }, 5, {
      mentions: ['p3', 'p7'],
    });
    const mentionComments = p.events.filter((e) => e.type === 'comment' && e.payload?.mention);
    expect(mentionComments.map((e) => e.personaId).sort()).toEqual(['p3', 'p7']);
    for (const e of mentionComments) expect(e.dueAt - 1_000_000).toBeLessThanOrEqual(10 * 60_000);
  });

  it('schedules events after the post and sorted by time', () => {
    const p = plan(defaultEngagementConfig, 9);
    const times = p.events.map((e) => e.dueAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(Math.min(...times)).toBeGreaterThanOrEqual(1_000_000);
  });

  it('compresses time with the speed setting', () => {
    const slow = plan(defaultEngagementConfig, 11);
    const fast = plan({ ...defaultEngagementConfig, speed: 10 }, 11);
    const last = (p: typeof slow) => Math.max(...p.events.map((e) => e.dueAt)) - 1_000_000;
    expect(last(fast)).toBeLessThan(last(slow));
  });

  it('never makes the author engage with their own post', () => {
    const p = plan(defaultEngagementConfig, 2, { authorId: 'p1', isUserPost: false });
    expect(p.events.some((e) => e.personaId === 'p1')).toBe(false);
  });
});

describe('sampleCommentCount', () => {
  it('stays within the band and skews low', () => {
    const rng = seededRng(42);
    const values = Array.from({ length: 2000 }, () => sampleCommentCount(rng, 0, 9));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(9);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(1.5);
    expect(mean).toBeLessThan(5.5);
  });
});
