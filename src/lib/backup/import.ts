import JSZip from 'jszip';
import {
  db,
  ME,
  type AppNotification,
  type ChatMessage,
  type Comment,
  type Media,
  type MetaRow,
  type MoodCheckIn,
  type Persona,
  type PlannedEvent,
  type Post,
  type Profile,
  type Reaction,
  type SettingRow,
  type UsageSession,
} from '@/db';
import { fromMarkdown, type BackupRecord } from './format';

export type RestoreMode = 'everything' | 'content-new-friends';

export interface ParsedBackup {
  records: BackupRecord[];
  media: Media[];
  summary: {
    posts: number;
    friends: number;
    photos: number;
    comments: number;
    profileName?: string;
  };
}

export class BackupError extends Error {
  override name = 'BackupError';
}

const FILES = ['me.md', 'friends.md', 'feed.md', 'wellbeing.md'];

export async function parseBackup(file: Blob): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new BackupError('This file is not a FaceMango backup (.zip).');
  }
  if (!zip.file('me.md'))
    throw new BackupError('This zip has no me.md, so it is not a FaceMango backup.');
  const records: BackupRecord[] = [];
  for (const name of FILES) {
    const entry = zip.file(name);
    if (entry) records.push(...fromMarkdown(await entry.async('string')));
  }
  const media: Media[] = [];
  for (const path of Object.keys(zip.files).filter(
    (p) => p.startsWith('images/') && p.endsWith('.json'),
  )) {
    const info = JSON.parse(await zip.file(path)!.async('string')) as Omit<Media, 'blob'>;
    const blobEntry = zip.file(path.slice(0, -'.json'.length));
    if (!blobEntry) continue;
    const bytes = await blobEntry.async('uint8array');
    media.push({ ...info, blob: new Blob([bytes as BlobPart], { type: info.mimeType }) });
  }
  const of = (type: string) => records.filter((r) => r.type === type);
  const profile = of('profile')[0]?.data as Profile | undefined;
  if (!profile?.name) throw new BackupError('The backup has no profile.');
  return {
    records,
    media,
    summary: {
      posts: of('post').filter((r) => r.data.authorId === ME).length,
      friends: of('persona').filter((r) => r.data.kind === 'friend').length,
      photos: media.filter((m) => m.kind === 'postPhoto').length,
      comments: of('comment').length,
      profileName: profile.name,
    },
  };
}

/**
 * Restores a parsed backup, replacing what is on this device (SPEC §3.11):
 * - everything: profile, friends, feed, wellbeing and settings exactly as backed up;
 * - content-new-friends: the user's own content and stats; the old friends become former
 *   friends (their comments on your posts stay under their names) and new friends are generated.
 */
export async function restoreBackup(backup: ParsedBackup, mode: RestoreMode): Promise<void> {
  const of = <T>(type: string) =>
    backup.records.filter((r) => r.type === type).map((r) => r.data as unknown as T);
  const posts = of<Post>('post');
  const comments = of<Comment>('comment');
  const reactions = of<Reaction>('reaction');
  let personas = of<Persona>('persona');
  let events = of<PlannedEvent>('event');
  let notifications = of<AppNotification>('notification');
  let meta = of<MetaRow>('meta');
  const now = Date.now();

  let keptPosts = posts;
  let keptComments = comments;
  let keptReactions = reactions;
  if (mode === 'content-new-friends') {
    const myPostIds = new Set(posts.filter((p) => p.authorId === ME).map((p) => p.id));
    keptPosts = posts.filter((p) => p.authorId === ME);
    keptComments = comments.filter((c) => myPostIds.has(c.postId));
    keptReactions = reactions.filter((r) => myPostIds.has(r.postId));
    personas = personas.map((p) => ({
      ...p,
      kind: 'former' as const,
      formerSince: p.formerSince ?? now,
    }));
    events = [];
    notifications = notifications.filter((n) => !n.postId || myPostIds.has(n.postId));
    meta = meta.filter(
      (m) => !['setupComplete', 'seedTarget', 'nextFriendPostAt', 'usedPhotos'].includes(m.key),
    );
  }

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    const profile = of<Profile>('profile')[0];
    if (profile) await db.profile.put(profile);
    await db.personas.bulkPut(personas);
    await db.posts.bulkPut(keptPosts);
    await db.comments.bulkPut(keptComments);
    await db.reactions.bulkPut(keptReactions);
    await db.events.bulkPut(events);
    await db.notifications.bulkPut(notifications);
    await db.media.bulkPut(backup.media);
    await db.usageSessions.bulkPut(of<UsageSession>('usageSession'));
    await db.moods.bulkPut(of<MoodCheckIn>('mood'));
    await db.settings.bulkPut(of<SettingRow>('setting'));
    await db.meta.bulkPut(meta);
    await db.chat.bulkPut(of<ChatMessage>('chat'));
  });
}
