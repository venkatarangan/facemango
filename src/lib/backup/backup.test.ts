import JSZip from 'jszip';
import { db, deleteAllData, ME, saveProfile, createUserPost, addMyComment } from '@/db';
import { buildBackup } from './export';
import { fromMarkdown, toMarkdown } from './format';
import { parseBackup, restoreBackup } from './import';

const persona = (id: string, kind: 'friend' | 'public' = 'friend') => ({
  id,
  kind,
  name: `Friend ${id}`,
  gender: 'female' as const,
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
  stance: 'fan' as const,
  activity: 0.5,
  closeness: 0.5,
  avatar: { style: 'personas', seed: id },
  createdAt: 1,
});

beforeEach(() => deleteAllData());

describe('backup format', () => {
  it('round-trips records, even when a body contains a fence line', () => {
    const md = toMarkdown('Test', [
      { record: { type: 'post', id: '1', data: { text: 'a\n---\nb' } }, body: 'a\n---\nb' },
      { record: { type: 'post', id: '2', data: { n: 2 } } },
    ]);
    expect(fromMarkdown(md).map((r) => r.data)).toEqual([{ text: 'a\n---\nb' }, { n: 2 }]);
  });
});

describe('backup export and restore', () => {
  async function seed() {
    await saveProfile({
      name: 'Asha',
      age: 30,
      city: 'Madurai',
      languages: ['Tamil'],
      photo: new Blob(['img'], { type: 'image/webp' }),
    });
    await db.personas.bulkAdd([persona('f1'), persona('p1', 'public')]);
    const post = await createUserPost({
      text: 'My post',
      mentions: [],
      photo: new Blob(['photo'], { type: 'image/webp' }),
    });
    await addMyComment(post.id, 'my comment');
    await db.comments.add({
      id: 'c-friend',
      postId: post.id,
      authorId: 'f1',
      text: 'Lovely!',
      createdAt: 5,
    });
    await db.posts.add({
      ...post,
      id: 'friend-post',
      authorId: 'f1',
      text: 'Friend post',
      photo: 'pack:x',
    });
    await db.usageSessions.add({ id: 's1', startedAt: 1, endedAt: 2, activeMs: 60_000 });
    return post;
  }

  it('restores everything exactly', async () => {
    await seed();
    const { blob, filename } = await buildBackup(Date.UTC(2026, 9, 3));
    expect(filename).toBe('facemango-backup-2026-10-03.zip');
    const parsed = await parseBackup(blob);
    expect(parsed.summary).toMatchObject({ posts: 1, friends: 1, photos: 1, profileName: 'Asha' });
    await deleteAllData();
    await restoreBackup(parsed, 'everything');
    expect((await db.profile.get(ME))?.name).toBe('Asha');
    expect(await db.posts.count()).toBe(2);
    expect(await db.personas.count()).toBe(2);
    expect(await db.media.count()).toBe(2);
    expect(await db.usageSessions.count()).toBe(1);
  });

  it('restores my content with old friends as former friends', async () => {
    const post = await seed();
    const parsed = await parseBackup((await buildBackup()).blob);
    await restoreBackup(parsed, 'content-new-friends');
    expect(await db.posts.count()).toBe(1);
    expect((await db.personas.toArray()).every((p) => p.kind === 'former')).toBe(true);
    expect(
      (await db.comments.where('postId').equals(post.id).toArray()).map((c) => c.text).sort(),
    ).toEqual(['Lovely!', 'my comment']);
    expect(await db.meta.get('setupComplete')).toBeUndefined();
  });

  const lifeStory = (status: 'active' | 'completed') => ({
    id: `story-${status}`,
    personaId: 'f1',
    kind: 'garden',
    title: 'Growing a tomato garden',
    slots: { plant: 'tomato' },
    stages: [
      { title: 'Seeds', brief: 'Planted seeds.', postId: 'friend-post', postedAt: 10 },
      { title: 'Sprouts', brief: 'Sprouts are up.' },
    ],
    currentStage: 1,
    status,
    startedAt: 10,
    nextBeatAt: 20,
    postIds: ['friend-post'],
  });

  it('round-trips life stories in friends.md', async () => {
    await seed();
    await db.stories.bulkAdd([lifeStory('active'), lifeStory('completed')]);
    const { blob } = await buildBackup();
    const friendsMd = await (await JSZip.loadAsync(blob)).file('friends.md')!.async('string');
    expect(friendsMd).toContain('type: story');
    expect(friendsMd).toContain('Growing a tomato garden (active)');
    const parsed = await parseBackup(blob);
    await deleteAllData();
    await restoreBackup(parsed, 'everything');
    expect(await db.stories.get('story-active')).toEqual(lifeStory('active'));
    expect(await db.stories.get('story-completed')).toEqual(lifeStory('completed'));
  });

  it('ends old friends’ stories when restoring my content with new friends', async () => {
    await seed();
    await db.stories.add(lifeStory('active'));
    await restoreBackup(await parseBackup((await buildBackup()).blob), 'content-new-friends');
    const s = await db.stories.get('story-active');
    expect(s).toMatchObject({ status: 'abandoned', postIds: [] });
    expect(s!.stages[0]!.postId).toBeUndefined();
    expect(s!.stages[0]!.postedAt).toBe(10);
  });

  it('restores an older backup that has no stories', async () => {
    await seed();
    const { blob } = await buildBackup();
    // Simulate a backup from before life stories: no story records at all.
    const zip = await JSZip.loadAsync(blob);
    const friendsMd = await zip.file('friends.md')!.async('string');
    expect(friendsMd).not.toContain('type: story');
    await db.stories.add(lifeStory('active'));
    await restoreBackup(await parseBackup(blob), 'everything');
    expect(await db.stories.count()).toBe(0);
    expect(await db.personas.count()).toBe(2);
  });

  it('rejects files that are not backups', async () => {
    await expect(parseBackup(new Blob(['nope']))).rejects.toThrow(/not a FaceMango backup/);
  });
});
