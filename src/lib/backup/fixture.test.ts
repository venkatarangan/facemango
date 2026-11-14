// Regenerates __fixtures__/backup-v1.zip (a format-1 backup: no backup.json, no photo sizes).
// Run once with: MAKE_FIXTURE=1 npx vitest run src/lib/backup/fixture.test.ts
import { writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { addMyComment, createUserPost, db, deleteAllData, saveProfile } from '@/db';
import { buildBackup } from './export';
import { seedPersona } from './testing';

it.skipIf(!process.env.MAKE_FIXTURE)('writes the v1 fixture', async () => {
  await deleteAllData();
  await saveProfile({
    name: 'Asha Test',
    age: 30,
    city: 'Madurai',
    languages: ['Tamil'],
    photo: new Blob(['img'], { type: 'image/webp' }),
  });
  await db.personas.bulkAdd([
    seedPersona('f1'),
    seedPersona('f2'),
    seedPersona('p1', 'public'),
    { ...seedPersona('x1'), kind: 'former' },
  ]);
  const post = await createUserPost({
    text: 'A post\n---\nwith a fence line',
    mentions: [],
    photo: new Blob(['photo'], { type: 'image/webp' }),
  });
  await addMyComment(post.id, 'my comment');
  await db.posts.add({
    ...post,
    id: 'friend-post',
    authorId: 'f1',
    text: 'Hello',
    photo: 'pack:x',
  });
  await db.comments.add({
    id: 'c1',
    postId: post.id,
    authorId: 'f1',
    text: 'Lovely!',
    createdAt: 5,
  });
  await db.usageSessions.add({ id: 's1', startedAt: 1, endedAt: 2, activeMs: 60_000 });
  const zip = await JSZip.loadAsync((await buildBackup()).blob);
  zip.remove('backup.json');
  for (const name of ['me.md', 'friends.md', 'feed.md', 'wellbeing.md', 'README.md'])
    zip.file(name, (await zip.file(name)!.async('string')).replaceAll('format 2', 'format 1'));
  for (const path of Object.keys(zip.files).filter((p) => p.endsWith('.json'))) {
    const info = JSON.parse(await zip.file(path)!.async('string'));
    delete info.bytes;
    zip.file(path, JSON.stringify(info));
  }
  await writeFile(
    new URL('./__fixtures__/backup-v1.zip', import.meta.url),
    await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
  );
});
