import JSZip from 'jszip';
import { format } from 'date-fns';
import { db, ME, type Persona } from '@/db';
import { avatarSvg } from '@/engine/avatar';
import { BACKUP_VERSION, toMarkdown, type BackupRecord } from './format';

const iso = (t?: number) => (t ? new Date(t).toISOString() : undefined);
const ext = (mime: string) =>
  mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';

/** Builds the full backup zip (SPEC §3.11): me.md, friends.md, feed.md, wellbeing.md, images/, avatars/. */
export async function buildBackup(now = Date.now()): Promise<{ blob: Blob; filename: string }> {
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
  ] = await Promise.all([
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
    db.settings.toArray(),
    db.meta.toArray(),
    db.chat.toArray(),
  ]);
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

  // friends.md — friends, public profiles and former friends.
  const describe = (p: Persona) =>
    `${p.name} (${p.kind}) · ${p.age} · ${p.occupation} · ${p.city}, ${p.country}\n\n${p.bio ?? ''}`;
  zip.file(
    'friends.md',
    toMarkdown(
      'Friends',
      personas.map((p) => ({
        record: rec('persona', p.id, p, {
          author: p.name,
          timestamp: iso(p.createdAt),
          image: `avatars/${p.id}.svg`,
        }),
        body: describe(p),
      })),
    ),
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

  for (const m of media) {
    zip.file(mediaPath.get(m.id)!, m.blob);
    zip.file(
      `${mediaPath.get(m.id)!}.json`,
      JSON.stringify({ id: m.id, kind: m.kind, mimeType: m.mimeType, createdAt: m.createdAt }),
    );
  }
  zip.file(
    'README.md',
    `# FaceMango backup\n\nCreated ${new Date(now).toISOString()} · format ${BACKUP_VERSION}\n\nRestore it in FaceMango: Settings → Backup & restore, or "Restore from a backup" on the welcome screen.\nPhoto-pack images are referenced by id (pack:…), not copied.\n`,
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  await db.meta.put({ key: 'lastBackupAt', value: now });
  return { blob, filename: `facemango-backup-${format(now, 'yyyy-MM-dd')}.zip` };
}

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
