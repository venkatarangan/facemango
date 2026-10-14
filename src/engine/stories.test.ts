import { db, deleteAllData, type Persona, type Story } from '@/db';
import { MockProvider } from '@/ai/mockProvider';
import { wrapProvider } from '@/ai/service';
import { storyConfig } from './config';
import { createStoryPost } from './friendPosts';
import { seededRng } from './random';
import {
  advanceStory,
  beatGap,
  chooseStoryAction,
  maxActiveStories,
  newStory,
  pickTemplate,
  storyPromptContext,
  templatesFor,
} from './stories';
import { fillSlots, STORY_TEMPLATES, templateById } from './storyTemplates';
import { commentsPrompt, friendPostPrompt } from './prompts';

const DAY = 86_400_000;

const friend = (id: string, extra: Partial<Persona> = {}): Persona => ({
  id,
  kind: 'friend',
  name: `Friend ${id}`,
  gender: 'female',
  age: 30,
  city: 'Chennai',
  country: 'India',
  languages: ['English'],
  occupation: 'Teacher',
  interests: ['music'],
  likes: [],
  dislikes: [],
  writingStyle: 'warm',
  agreeableness: 0.5,
  stance: 'fan',
  activity: 0.5,
  closeness: 0.5,
  avatar: { style: 'personas', seed: id },
  createdAt: 1,
  ...extra,
});

const story = (personaId: string, extra: Partial<Story> = {}): Story => ({
  ...newStory(friend(personaId), templateById('garden')!, { plant: 'tomato' }, 0),
  ...extra,
});

describe('story templates', () => {
  it('are well formed, and every placeholder has a slot', () => {
    expect(STORY_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(STORY_TEMPLATES.map((t) => t.id)).size).toBe(STORY_TEMPLATES.length);
    for (const t of STORY_TEMPLATES) {
      const keys = new Set(t.slots.map((s) => s.key));
      const used = [t.title, ...t.beats.flatMap((b) => [b.title, b.brief])]
        .join(' ')
        .match(/\{(\w+)\}/g);
      for (const p of used ?? []) expect(keys.has(p.slice(1, -1))).toBe(true);
      expect(t.beats.length).toBeGreaterThanOrEqual(4);
      expect(t.gapDays[0]).toBeGreaterThanOrEqual(1);
      expect(t.gapDays[0]).toBeLessThanOrEqual(t.gapDays[1]);
    }
  });

  it('fills slots', () => {
    expect(fillSlots('Trip to {destination} with {companion}', { destination: 'Kyoto' })).toBe(
      'Trip to Kyoto with',
    );
  });

  it('respects age limits and skips arcs the friend already lived', () => {
    const teen = friend('t', { age: 15 });
    expect(templatesFor(teen).map((t) => t.id)).not.toContain('new-job');
    expect(templatesFor(friend('a'), ['garden']).map((t) => t.id)).not.toContain('garden');
  });

  it('favours arcs that match interests', () => {
    const runner = friend('r', { interests: ['running', 'marathons'] });
    const rng = seededRng(3);
    const picks = Array.from({ length: 200 }, () => pickTemplate(runner, [], rng)!.id);
    const share = picks.filter((id) => id === 'race-training').length / picks.length;
    expect(share).toBeGreaterThan(1 / STORY_TEMPLATES.length);
  });
});

describe('chooseStoryAction', () => {
  const friends = Array.from({ length: 9 }, (_, i) => friend(`f${i}`));
  const base = { friends, speed: 1, rng: seededRng(1) };

  it('caps active stories at a third of friends', () => {
    expect(maxActiveStories(25)).toBe(8);
    expect(maxActiveStories(2)).toBe(1);
    const active = ['f0', 'f1', 'f2'].map((id) => story(id, { nextBeatAt: 10 * DAY }));
    expect(chooseStoryAction({ ...base, stories: active, at: 5 * DAY })).toBeNull();
  });

  it('posts the most overdue beat first', () => {
    const a = story('f0', { nextBeatAt: 3 * DAY });
    const b = story('f1', { nextBeatAt: 2 * DAY });
    const action = chooseStoryAction({ ...base, stories: [a, b], at: 4 * DAY });
    expect(action).toEqual({ kind: 'beat', story: b });
  });

  it('starts a new story for a friend without one, respecting the start gap', () => {
    const a = story('f0', { startedAt: 0, nextBeatAt: 10 * DAY });
    const tooSoon = chooseStoryAction({ ...base, stories: [a], at: 3_600_000 });
    expect(tooSoon).toBeNull();
    const later = chooseStoryAction({ ...base, stories: [a], at: 2 * DAY });
    expect(later?.kind).toBe('start');
    if (later?.kind === 'start') expect(later.persona.id).not.toBe('f0');
  });

  it('lets a friend rest after finishing a story, and ignores former friends', () => {
    const only = [friend('solo')];
    const done = story('solo', { status: 'completed', startedAt: 0, endedAt: 20 * DAY });
    const at = (d: number) => chooseStoryAction({ ...base, friends: only, stories: [done], at: d });
    expect(at(22 * DAY)).toBeNull();
    expect(at(20 * DAY + (storyConfig.cooldownDays + 1) * DAY)?.kind).toBe('start');
    const formerStory = story('gone', { nextBeatAt: 0 });
    expect(chooseStoryAction({ ...base, friends: only, stories: [formerStory], at: DAY })).toEqual(
      expect.objectContaining({ kind: 'start' }),
    );
  });
});

describe('advancing a story', () => {
  it('schedules beats days apart (compressed by speed) and completes after the last one', () => {
    const template = templateById('garden')!;
    const rng = seededRng(7);
    let s = newStory(friend('f'), template, { plant: 'tomato' }, 0);
    expect(s.title).toBe('Growing a tomato garden');
    let at = 0;
    for (let i = 0; i < template.beats.length; i++) {
      s = advanceStory(s, `post${i}`, at, rng, 1);
      if (s.status === 'active') {
        const gap = s.nextBeatAt - at;
        expect(gap).toBeGreaterThanOrEqual(template.gapDays[0] * DAY);
        expect(gap).toBeLessThanOrEqual(template.gapDays[1] * DAY);
        at = s.nextBeatAt;
      }
    }
    expect(s.status).toBe('completed');
    expect(s.postIds).toEqual(template.beats.map((_, i) => `post${i}`));
    expect(s.endedAt).toBe(at);
    expect(beatGap(template, seededRng(1), 10)).toBeLessThanOrEqual(
      (template.gapDays[1] * DAY) / 10,
    );
  });

  it('gives the post prompt the earlier beats, and comments the arc', () => {
    let s = newStory(friend('f'), templateById('race-training')!, { race: 'Lakeside 10K' }, 0);
    s = advanceStory(s, 'p1', 0, seededRng(1), 1);
    s = advanceStory(s, 'p2', 7 * DAY, seededRng(1), 1);
    const ctx = storyPromptContext(s, 14 * DAY, (id) =>
      id === 'p2' ? 'Legs are sore!' : undefined,
    );
    expect(ctx).toMatchObject({
      beat: 3,
      total: 6,
      daysIn: 14,
      title: 'Training for the Lakeside 10K',
    });
    const prompt = friendPostPrompt(friend('f'), undefined, [], ctx);
    expect(prompt).toContain('update 3 of 6');
    expect(prompt).toContain('"Legs are sore!"');
    expect(prompt).toContain('1. Signed up');
    const comments = commentsPrompt({ text: 'Rainy run today' }, 'Friend f', [], {
      recent: [],
      story: { title: s.title, beat: 3, total: 6, earlier: ['Signed up', 'Week 2'] },
    });
    expect(comments).toContain('ongoing story "Training for the Lakeside 10K"');
  });
});

describe('createStoryPost with the mock model', () => {
  const ai = wrapProvider(new MockProvider());

  beforeEach(async () => {
    await deleteAllData();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ photos: [] })));
    await db.profile.put({
      id: 'me',
      name: 'Asha',
      age: 30,
      city: 'Chennai',
      languages: ['English'],
      createdAt: 0,
      dataNoticeAcknowledgedAt: 0,
    });
    await db.personas.bulkAdd(Array.from({ length: 6 }, (_, i) => friend(`f${i}`)));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts stories, then posts each beat in order with realistic spacing', async () => {
    const rng = seededRng(11);
    const start = Date.UTC(2026, 0, 1);
    // A friend post every 6 hours for 60 days, all trying to tell a story.
    for (let t = start; t < start + 60 * DAY; t += 6 * 3_600_000) {
      await createStoryPost(ai, t, rng);
      const active = await db.stories.where('status').equals('active').toArray();
      expect(active.length).toBeLessThanOrEqual(maxActiveStories(6));
      expect(new Set(active.map((s) => s.personaId)).size).toBe(active.length);
    }
    const stories = await db.stories.toArray();
    expect(stories.some((s) => s.status === 'completed')).toBe(true);
    for (const s of stories) {
      const posts = await db.posts.bulkGet(s.postIds);
      expect(posts.every((p) => p?.authorId === s.personaId)).toBe(true);
      expect(posts.map((p) => p!.story!.beat)).toEqual(s.postIds.map((_, i) => i + 1));
      const template = templateById(s.kind)!;
      for (let i = 1; i < posts.length; i++) {
        expect(posts[i]!.createdAt - posts[i - 1]!.createdAt).toBeGreaterThanOrEqual(
          template.gapDays[0] * DAY,
        );
      }
      expect(Object.values(s.slots).every((v) => v.length >= 2)).toBe(true);
    }
  }, 60_000);
});
