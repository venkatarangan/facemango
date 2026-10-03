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

  it('rejects files that are not backups', async () => {
    await expect(parseBackup(new Blob(['nope']))).rejects.toThrow(/not a FaceMango backup/);
  });
});
