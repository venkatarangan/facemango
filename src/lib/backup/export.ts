import JSZip from 'jszip';
import { format } from 'date-fns';
import { db, ME, type Persona, type Story } from '@/db';
import { avatarSvg } from '@/engine/avatar';
import { DEVICE_ONLY_META, DEVICE_ONLY_SETTINGS } from './deviceOnly';
import { BACKUP_VERSION, toMarkdown, type BackupRecord } from './format';
import type { RecordType } from './schema';

const iso = (t?: number) => (t ? new Date(t).toISOString() : undefined);
const ext = (mime: string) =>
  mime.includes('png')
    ? 'png'
    : mime.includes('jpeg') || mime.includes('jpg')
      ? 'jpg'
      : mime.includes('webp')
        ? 'webp'
        : mime.includes('gif')
          ? 'gif'
          : mime.includes('avif')
            ? 'avif'
            : 'bin';

export interface ExportProgress {
  phase: 'reading' | 'zipping' | 'saving';
  /** 0–100 */
  percent: number;
}
export type ProgressFn = (progress: ExportProgress) => void;

/**
 * Builds the full backup zip (SPEC §3.11): me.md, friends.md, feed.md, wellbeing.md, images/,
 * avatars/. `record: false` leaves "last backup" for the caller to set once the zip is saved.
 */
/** One consistent read of every table (a single read transaction, so nothing changes mid-export). */
export function readSnapshot() {
  return db.transaction('r', db.tables, () =>
    Promise.all([
      db.profile.get(ME),
      db.personas.toArray(),
      db.posts.toArray(),
      db.comments.toArray(),
      db.reactions.toArray(),
      db.events.toArray(),
      db.notifications.toArray(),
      db.media.toArray(),
      db.usageSessions.toArray(),
      db.moods.toArray(),
      db.settings.filter((s) => !DEVICE_ONLY_SETTINGS.includes(s.key)).toArray(),
      db.meta.filter((m) => !DEVICE_ONLY_META.includes(m.key)).toArray(),
      db.chat.toArray(),
      db.stories.toArray(),
    ]),
  );
}
export type Snapshot = Awaited<ReturnType<typeof readSnapshot>>;

/**
 * Builds the backup zip (SPEC §3.11): me.md, friends.md, feed.md, wellbeing.md, images/,
 * avatars/, backup.json. Pure: nothing is read from or written to the database here.
 */
export function buildZip(snapshot: Snapshot, now: number): JSZip {
  const [
    profile,
    personas,
    posts,
    comments,
    reactions,
    events,
    notifications,
    media,
    sessions,
    moods,
    settings,
    meta,
    chat,
    stories,
  ] = snapshot;
  const zip = new JSZip();
  const names = new Map<string, string>(personas.map((p) => [p.id, p.name]));
  if (profile) names.set(ME, profile.name);
  const mediaPath = new Map(media.map((m) => [m.id, `images/${m.id}.${ext(m.mimeType)}`]));
  const rec = (
    type: string,
    id: string,
    data: object,
    extra: Partial<BackupRecord> = {},
  ): BackupRecord => ({ type, id, ...extra, data: data as Record<string, unknown> });
  const imageOf = (ref?: string) =>
    (ref && mediaPath.get(ref)) || (ref?.startsWith('pack:') ? ref : undefined);

  // me.md — the user's profile, settings, posts, comments and reactions.
  const mine = posts.filter((p) => p.authorId === ME);
  zip.file(
    'me.md',
    toMarkdown('Me', [
      ...(profile
        ? [
            {
              record: rec('profile', ME, profile, {
                timestamp: iso(profile.createdAt),
                image: imageOf(profile.photoId),
              }),
              body: `${profile.name}, ${profile.age}, ${profile.city}. Speaks ${profile.languages.join(', ')}.${profile.bio ? `\n\n${profile.bio}` : ''}`,
            },
          ]
        : []),
      ...settings.map((s) => ({ record: rec('setting', s.key, s) })),
      ...meta.map((m) => ({ record: rec('meta', m.key, m) })),
      ...mine.map((p) => ({
        record: rec('post', p.id, p, {
          author: 'me',
          timestamp: iso(p.createdAt),
          image: imageOf(p.photo),
        }),
        body: p.text,
      })),
      ...comments
        .filter((c) => c.authorId === ME)
        .map((c) => ({
          record: rec('comment', c.id, c, { author: 'me', timestamp: iso(c.createdAt) }),
          body: c.text,
        })),
      ...reactions
        .filter((r) => r.personaId === ME)
        .map((r) => ({
          record: rec('reaction', r.id, r, { author: 'me', timestamp: iso(r.createdAt) }),
          body: `Reacted ${r.type}`,
        })),
      ...chat.map((m) => ({
        record: rec('chat', m.id, m, {
          author: m.role === 'user' ? 'me' : 'mango-ai',
          timestamp: iso(m.createdAt),
        }),
        body: m.text,
      })),
    ]),
  );

  // friends.md — friends, public profiles, former friends and their life stories.
  const describe = (p: Persona) =>
    `${p.name} (${p.kind}) · ${p.age} · ${p.occupation} · ${p.city}, ${p.country}\n\n${p.bio ?? ''}`;
  const describeStory = (s: Story) =>
    `${s.title} (${s.status})\n\n${s.stages.map((b, i) => `${i + 1}. ${b.title}${b.postedAt ? ' ✓' : ''}`).join('\n')}`;
  zip.file(
    'friends.md',
    toMarkdown('Friends', [
      ...personas.map((p) => ({
        record: rec('persona', p.id, p, {
          author: p.name,
          timestamp: iso(p.createdAt),
          image: `avatars/${p.id}.svg`,
        }),
        body: describe(p),
      })),
      ...stories.map((s) => ({
        record: rec('story', s.id, s, {
          author: names.get(s.personaId) ?? s.personaId,
          timestamp: iso(s.startedAt),
        }),
        body: describeStory(s),
      })),
    ]),
  );
  for (const p of personas) zip.file(`avatars/${p.id}.svg`, avatarSvg(p));

  // feed.md — friends' posts, all other comments, reactions, planned events and notifications.
  zip.file(
    'feed.md',
    toMarkdown('Feed', [
      ...posts
        .filter((p) => p.authorId !== ME)
        .map((p) => ({
          record: rec('post', p.id, p, {
            author: names.get(p.authorId) ?? p.authorId,
            timestamp: iso(p.createdAt),
            image: imageOf(p.photo),
          }),
          body: p.text,
        })),
      ...comments
        .filter((c) => c.authorId !== ME)
        .map((c) => ({
          record: rec('comment', c.id, c, {
            author: names.get(c.authorId) ?? c.authorId,
            timestamp: iso(c.createdAt),
          }),
          body: c.text,
        })),
      ...reactions
        .filter((r) => r.personaId !== ME)
        .map((r) => ({
          record: rec('reaction', r.id, r, {
            author: names.get(r.personaId),
            timestamp: iso(r.createdAt),
          }),
        })),
      ...events.map((e) => ({ record: rec('event', e.id, e, { timestamp: iso(e.dueAt) }) })),
      ...notifications.map((n) => ({
        record: rec('notification', n.id, n, { timestamp: iso(n.createdAt) }),
        body: n.text,
      })),
    ]),
  );

  // wellbeing.md — usage sessions and mood check-ins.
  zip.file(
    'wellbeing.md',
    toMarkdown('Wellbeing', [
      ...sessions.map((s) => ({
        record: rec('usageSession', s.id, s, { timestamp: iso(s.startedAt) }),
        body: `${Math.round(s.activeMs / 60_000)} min`,
      })),
      ...moods.map((m) => ({
        record: rec('mood', m.id, m, { timestamp: iso(m.at) }),
        body: m.mood,
      })),
    ]),
  );

  // Photos are already compressed (WebP/JPEG/PNG): store them as they are, never recompress.
  const files: { path: string; bytes: number }[] = [];
  for (const m of media) {
    const path = mediaPath.get(m.id)!;
    zip.file(path, m.blob, { compression: 'STORE' });
    zip.file(
      `${path}.json`,
      JSON.stringify({
        id: m.id,
        kind: m.kind,
        mimeType: m.mimeType,
        createdAt: m.createdAt,
        bytes: m.blob.size,
      }),
    );
    files.push({ path, bytes: m.blob.size });
  }
  const counts: Partial<Record<RecordType | 'media', number>> = {
    profile: profile ? 1 : 0,
    persona: personas.length,
    post: posts.length,
    comment: comments.length,
    reaction: reactions.length,
    event: events.length,
    notification: notifications.length,
    usageSession: sessions.length,
    mood: moods.length,
    chat: chat.length,
    setting: settings.length,
    meta: meta.length,
    story: stories.length,
    media: media.length,
  };
  zip.file(
    'backup.json',
    JSON.stringify({
      app: 'facemango',
      version: BACKUP_VERSION,
      createdAt: new Date(now).toISOString(),
      counts,
      files,
    }),
  );
  zip.file(
    'README.md',
    `# FaceMango backup\n\nCreated ${new Date(now).toISOString()} · format ${BACKUP_VERSION}\n\nRestore it in FaceMango: Settings → Backup & restore, or "Restore from a backup" on the welcome screen.\nPhoto-pack images are referenced by id (pack:…), not copied.\n`,
  );
  return zip;
}

const GENERATE = { compression: 'DEFLATE', compressionOptions: { level: 6 } } as const;

export const backupFilename = (now: number) => `facemango-backup-${format(now, 'yyyy-MM-dd')}.zip`;

/** Builds the zip in memory as a Blob, reporting progress. */
export function zipToBlob(zip: JSZip, onProgress?: ProgressFn): Promise<Blob> {
  return zip.generateAsync({ type: 'blob', ...GENERATE }, (meta) =>
    onProgress?.({ phase: 'zipping', percent: meta.percent }),
  );
}

/** The part of a writable file stream we use (FileSystemWritableFileStream). */
export interface WritableLike {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

/** Streams the zip into a file chunk by chunk, so a big backup never sits in memory whole. */
export function zipToWritable(
  zip: JSZip,
  out: WritableLike,
  onProgress?: ProgressFn,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = zip.generateInternalStream({
      type: 'uint8array',
      streamFiles: true,
      ...GENERATE,
    });
    stream
      .on('data', (chunk: Uint8Array, meta: { percent: number }) => {
        stream.pause();
        out.write(chunk).then(
          () => {
            onProgress?.({ phase: 'saving', percent: meta.percent });
            stream.resume();
          },
          (error: unknown) => {
            void out.abort?.().catch(() => undefined);
            reject(error);
          },
        );
      })
      .on('error', (error: unknown) => {
        void out.abort?.().catch(() => undefined);
        reject(error);
      })
      .on('end', () => {
        out.close().then(() => resolve(), reject);
      })
      .resume();
  });
}

/**
 * Builds the zip as a Blob. `record` stays off by default: "last backup" is set by the caller
 * only once the file has really been saved (a cancelled or failed save must not count).
 */
export async function buildBackup(
  now = Date.now(),
  { record = false, onProgress }: { record?: boolean; onProgress?: ProgressFn } = {},
): Promise<{ blob: Blob; filename: string }> {
  onProgress?.({ phase: 'reading', percent: 0 });
  const zip = buildZip(await readSnapshot(), now);
  const blob = await zipToBlob(zip, onProgress);
  if (record) await markBackedUp(now);
  return { blob, filename: backupFilename(now) };
}

export const markBackedUp = (now = Date.now()) => db.meta.put({ key: 'lastBackupAt', value: now });

/** Saves the zip with the browser's download (stays on the device). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
