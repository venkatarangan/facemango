import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { addMyComment, createUserPost, db, deleteAllData, ME, saveProfile } from '@/db';
import { buildBackup, buildZip, readSnapshot, zipToWritable } from './export';
import { fromMarkdown } from './format';
import { parseBackup, planRestore, restoreBackup } from './import';
import { seedPersona } from './testing';

beforeEach(async () => {
  await deleteAllData();
  vi.restoreAllMocks();
});

async function seed() {
  await saveProfile({
    name: 'Asha',
    age: 30,
    city: 'Madurai',
    languages: ['Tamil'],
    photo: new Blob(['img'], { type: 'image/webp' }),
  });
  await db.personas.bulkAdd([seedPersona('f1')]);
  const post = await createUserPost({
    text: 'My post',
    mentions: [],
    photo: new Blob(['photo-bytes'], { type: 'image/webp' }),
  });
  await addMyComment(post.id, 'my comment');
  return post;
}

/** Rewrites one text file of a backup (the zip is rebuilt, so its checksums stay valid). */
async function tweak(blob: Blob, name: string, fn: (text: string) => string): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob);
  zip.file(name, fn(await zip.file(name)!.async('string')));
  return zip.generateAsync({ type: 'blob' });
}

describe('refusing bad files (nothing is written)', () => {
  it('refuses a backup from a newer version', async () => {
    await seed();
    const { blob } = await buildBackup();
    const newer = await tweak(blob, 'backup.json', (t) => t.replace('"version":2', '"version":99'));
    await expect(parseBackup(newer)).rejects.toThrow(/newer version of FaceMango/);
  });

  it('refuses a truncated zip', async () => {
    await seed();
    const { blob } = await buildBackup();
    await expect(parseBackup(blob.slice(0, Math.floor(blob.size / 2)))).rejects.toMatchObject({
      name: 'BackupError',
    });
  });

  it('refuses a zip with a flipped byte (checksum)', async () => {
    await seed();
    const { blob } = await buildBackup();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const needle = new TextEncoder().encode('photo-bytes');
    const at = bytes.findIndex((_, i) => needle.every((b, j) => bytes[i + j] === b));
    expect(at).toBeGreaterThan(0); // photos are stored uncompressed
    bytes[at] = bytes[at]! ^ 0xff;
    await expect(parseBackup(new Blob([bytes]))).rejects.toThrow(/damaged or incomplete/);
  });

  it('refuses a cut-off Markdown record', async () => {
    await seed();
    const { blob } = await buildBackup();
    const cut = await tweak(blob, 'feed.md', (t) => t + '\n---\ntype: post\nid: x');
    await expect(parseBackup(cut)).rejects.toThrow(/cut off or damaged/);
  });

  it('refuses invalid YAML', async () => {
    await seed();
    const { blob } = await buildBackup();
    const bad = await tweak(blob, 'feed.md', (t) => t + '\n---\ntype: [oops\n---\nbody\n');
    await expect(parseBackup(bad)).rejects.toThrow(/damaged/);
  });

  it('refuses a record that breaks the rules (likes over the hard cap)', async () => {
    await seed();
    const { blob } = await buildBackup();
    const bad = await tweak(blob, 'me.md', (t) =>
      t.replace(/plannedLikes: \d+/, 'plannedLikes: 5000000'),
    );
    await expect(parseBackup(bad)).rejects.toThrow(/damaged post record/);
  });

  it('refuses a backup that lost records (manifest counts)', async () => {
    await seed();
    const { blob } = await buildBackup();
    const lost = await tweak(blob, 'backup.json', (t) => t.replace('"post":1', '"post":9'));
    await expect(parseBackup(lost)).rejects.toThrow(/incomplete/);
  });

  it('refuses a zip without me.md', async () => {
    const zip = new JSZip().file('hello.txt', 'hi');
    await expect(parseBackup(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(
      /no me\.md/,
    );
  });
});

describe('older backups', () => {
  it('restores the checked-in format 1 fixture (no manifest, no photo sizes)', async () => {
    const bytes = await readFile(new URL('./__fixtures__/backup-v1.zip', import.meta.url));
    const parsed = await parseBackup(new Blob([bytes]));
    expect(parsed.version).toBe(1);
    expect(parsed.summary).toMatchObject({ profileName: 'Asha Test', posts: 1, friends: 2 });
    await restoreBackup(parsed, 'everything');
    expect((await db.profile.get(ME))?.name).toBe('Asha Test');
    expect(await db.personas.count()).toBe(4);
    expect(await db.posts.count()).toBe(2);
    expect(await db.media.count()).toBe(2);
    expect((await db.posts.toArray()).find((p) => p.text.includes('fence'))).toBeTruthy();
  });
});

describe('photos and storage', () => {
  it('stores photos uncompressed and restores them in small batches', async () => {
    await seed();
    const photos = Array.from({ length: 100 }, (_, i) => {
      const data = crypto.getRandomValues(new Uint8Array(8 * 1024));
      return {
        id: `m${i}`,
        kind: 'postPhoto' as const,
        mimeType: 'image/jpeg',
        createdAt: 1,
        blob: new Blob([data]),
      };
    });
    await db.media.bulkAdd(photos);
    const { blob } = await buildBackup();
    expect(blob.size).toBeLessThan(100 * 8 * 1024 * 1.1 + 30_000); // random data does not shrink
    const parsed = await parseBackup(blob);
    expect(parsed.neededBytes).toBeGreaterThan(100 * 8 * 1024);
    await db.media.clear();
    const spy = vi.spyOn(db.media, 'bulkPut');
    await restoreBackup(parsed, 'everything');
    expect(await db.media.count()).toBe(102);
    const batches = spy.mock.calls.map(([rows]) => (rows as unknown[]).length);
    expect(Math.max(...batches)).toBeLessThanOrEqual(16);
    expect(batches.length).toBeGreaterThanOrEqual(7);
  });

  it('names photo files by their real type', async () => {
    await seed();
    await db.media.add({
      id: 'odd',
      kind: 'postPhoto',
      mimeType: 'image/gif',
      createdAt: 1,
      blob: new Blob(['g']),
    });
    const zip = buildZip(await readSnapshot(), 1);
    expect(zip.file('images/odd.gif')).toBeTruthy();
  });

  it('refuses a restore when the device has too little space', async () => {
    await seed();
    const parsed = await parseBackup((await buildBackup()).blob);
    await deleteAllData();
    await db.meta.put({ key: 'keep', value: 1 });
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { estimate: async () => ({ quota: 100, usage: 99 }) },
    });
    await expect(restoreBackup(parsed, 'everything')).rejects.toThrow(/Not enough free space/);
    vi.unstubAllGlobals();
    expect(await db.meta.get('keep')).toBeTruthy();
    expect(await db.media.count()).toBe(0);
  });

  it('leaves existing data untouched when the device runs out of space mid-restore', async () => {
    await seed();
    const parsed = await parseBackup((await buildBackup()).blob);
    await deleteAllData();
    await db.meta.put({ key: 'keep', value: 1 });
    vi.spyOn(db.posts, 'bulkPut').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    await expect(restoreBackup(parsed, 'everything')).rejects.toThrow(/ran out of storage space/);
    expect(await db.meta.get('keep')).toBeTruthy(); // not cleared
    expect(await db.profile.count()).toBe(0); // nothing half-restored
    expect(await db.media.count()).toBe(0); // staged photos removed again
  });

  it('keeps existing photos that are not in the backup out of the way only after success', async () => {
    await seed();
    const parsed = await parseBackup((await buildBackup()).blob);
    await db.media.add({
      id: 'stale',
      kind: 'postPhoto',
      mimeType: 'image/png',
      createdAt: 1,
      blob: new Blob(['s']),
    });
    await restoreBackup(parsed, 'everything');
    expect(await db.media.get('stale')).toBeUndefined();
    expect(await db.media.count()).toBe(2);
  });
});

describe('streaming and planning', () => {
  it('streams a valid zip into a writable, with rising progress', async () => {
    await seed();
    const chunks: Uint8Array[] = [];
    const percents: number[] = [];
    let closed = false;
    await zipToWritable(
      buildZip(await readSnapshot(), 1),
      {
        write: async (c) => void chunks.push(c),
        close: async () => void (closed = true),
      },
      (p) => percents.push(p.percent),
    );
    expect(closed).toBe(true);
    expect(percents.length).toBeGreaterThan(0);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
    const parsed = await parseBackup(new Blob(chunks as BlobPart[]));
    expect(parsed.summary.profileName).toBe('Asha');
  });

  it('aborts the file when writing fails', async () => {
    await seed();
    const abort = vi.fn(async () => undefined);
    await expect(
      zipToWritable(buildZip(await readSnapshot(), 1), {
        write: async () => {
          throw new Error('disk full');
        },
        close: async () => undefined,
        abort,
      }),
    ).rejects.toThrow('disk full');
    expect(abort).toHaveBeenCalled();
  });

  it('plans "my content + new friends" without touching the database', async () => {
    await seed();
    await db.posts.add({ ...(await db.posts.toCollection().first())!, id: 'fp', authorId: 'f1' });
    const { blob } = await buildBackup();
    const records = (
      await Promise.all(
        ['me.md', 'feed.md', 'friends.md', 'wellbeing.md'].map(async (n) =>
          fromMarkdown(await (await JSZip.loadAsync(blob)).file(n)!.async('string')),
        ),
      )
    ).flat();
    const plan = planRestore(records, 'content-new-friends', 123);
    expect(plan.posts.map((p) => p.authorId)).toEqual([ME]);
    expect(plan.personas.every((p) => p.kind === 'former' && p.formerSince)).toBe(true);
    expect(plan.events).toEqual([]);
  });
});

describe('real-world data the schema must accept', () => {
  it('restores a post with more than 100 comments and replies', async () => {
    const post = await seed();
    await db.posts.update(post.id, { commentCount: 140 });
    const parsed = await parseBackup((await buildBackup()).blob);
    await restoreBackup(parsed, 'everything');
    expect((await db.posts.get(post.id))?.commentCount).toBe(140);
  });

  it('restores a settings row whose value is undefined', async () => {
    await seed();
    await db.settings.put({ key: 'odd', value: undefined });
    const parsed = await parseBackup((await buildBackup()).blob);
    await restoreBackup(parsed, 'everything');
    expect(await db.settings.get('odd')).toBeTruthy();
  });

  it('only counts photos missing from this device when checking free space', async () => {
    await seed();
    const parsed = await parseBackup((await buildBackup()).blob); // photos stay on the device
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { estimate: async () => ({ quota: 1_100_000, usage: 1_000_000 }) },
    });
    parsed.media.forEach((m) => (m.bytes = 500_000_000)); // huge, but already on the device
    await expect(restoreBackup(parsed, 'everything')).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});
