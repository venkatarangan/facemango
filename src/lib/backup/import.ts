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
  type Story,
  type UsageSession,
} from '@/db';
import { formatBytes } from '@/lib/storage';
import { DEVICE_ONLY_META, DEVICE_ONLY_SETTINGS } from './deviceOnly';
import { RESTORE_CHANNEL, TAB_ID } from './channel';
import { BACKUP_VERSION, BackupError, fromMarkdown, type BackupRecord } from './format';
import { Manifest, MediaInfo, validateRecord } from './schema';

export { BackupError };

export type RestoreMode = 'everything' | 'content-new-friends';

/** A photo still inside the zip: it is decoded in small batches during the restore, never all at once. */
export interface MediaFile {
  info: Omit<Media, 'blob'>;
  entry: JSZip.JSZipObject;
  /** Size from the backup's sidecar (0 for format 1 backups, which didn't record it). */
  bytes: number;
}

export interface ParsedBackup {
  version: number;
  records: BackupRecord[];
  media: MediaFile[];
  /** Things that were skipped but did not stop the restore. */
  warnings: string[];
  /** A cautious estimate of the space the restored data needs. */
  neededBytes: number;
  /** Size of the Markdown text (the database rows it becomes). */
  textBytes: number;
  summary: {
    posts: number;
    friends: number;
    photos: number;
    comments: number;
    profileName?: string;
  };
}

export interface RestoreProgress {
  phase: 'checking' | 'photos' | 'saving';
  done: number;
  total: number;
}

const FILES = ['me.md', 'friends.md', 'feed.md', 'wellbeing.md'];
const QUOTA_MESSAGE =
  'This device ran out of storage space. Free some space (or close other tabs) and try again.';
const UNCHANGED = ' Your current data was not changed.';

/**
 * Reads and fully checks a backup without writing anything: the zip's checksums, the format
 * version, every record (Zod) and the manifest counts. A bad file is refused here.
 */
export async function parseBackup(file: Blob): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file, { checkCRC32: true });
  } catch (e) {
    const damaged = e instanceof Error && /crc32|corrupt|end of data|truncat/i.test(e.message);
    throw new BackupError(
      damaged
        ? 'This backup is damaged or incomplete (it may not have finished downloading).'
        : 'This file is not a FaceMango backup (.zip).',
    );
  }
  const meFile = zip.file('me.md');
  if (!meFile) throw new BackupError('This zip has no me.md, so it is not a FaceMango backup.');

  // Version: backup.json (format 2+), else the "format N" line of me.md (format 1).
  const manifestFile = zip.file('backup.json');
  let manifest: Manifest | undefined;
  if (manifestFile) {
    try {
      manifest = Manifest.parse(JSON.parse(await manifestFile.async('string')));
    } catch {
      throw new BackupError('This backup is damaged (unreadable backup.json).');
    }
  }
  const meText = await meFile.async('string');
  const version = manifest?.version ?? Number(/format (\d+)/.exec(meText)?.[1] ?? 1);
  if (version > BACKUP_VERSION)
    throw new BackupError(
      'This backup was made by a newer version of FaceMango. Reload the app to update it, then try again.',
    );

  const records: BackupRecord[] = [];
  let textBytes = 0;
  for (const name of FILES) {
    const entry = zip.file(name);
    if (!entry) continue;
    const text = name === 'me.md' ? meText : await entry.async('string');
    textBytes += text.length;
    for (const record of fromMarkdown(text)) {
      validateRecord(record, name);
      records.push(record);
    }
  }
  const of = (type: string) => records.filter((r) => r.type === type);
  const profile = of('profile')[0]?.data as unknown as Profile | undefined;
  if (!profile?.name) throw new BackupError('The backup has no profile.');

  const warnings: string[] = [];
  const media: MediaFile[] = [];
  for (const path of Object.keys(zip.files).filter(
    (p) => p.startsWith('images/') && p.endsWith('.json'),
  )) {
    let info: ReturnType<typeof MediaInfo.parse>;
    try {
      info = MediaInfo.parse(JSON.parse(await zip.file(path)!.async('string')));
    } catch {
      throw new BackupError(`${path} is damaged.`);
    }
    const entry = zip.file(path.slice(0, -'.json'.length));
    if (!entry) {
      warnings.push(`A photo is missing from the backup (${info.id}).`);
      continue;
    }
    const { bytes = 0, ...rest } = info;
    media.push({ info: rest, entry, bytes });
  }

  // Counts in backup.json catch a backup that lost whole records (e.g. a cut-off copy).
  if (manifest) {
    for (const [type, expected] of Object.entries(manifest.counts)) {
      const actual = type === 'media' ? media.length : of(type).length;
      if (type === 'media' ? actual < expected - warnings.length : actual !== expected)
        throw new BackupError('This backup is incomplete: some records are missing from it.');
    }
  }

  const neededBytes = Math.ceil((media.reduce((sum, m) => sum + m.bytes, 0) + textBytes * 2) * 1.1);
  return {
    version,
    records,
    media,
    warnings,
    neededBytes,
    textBytes,
    summary: {
      posts: of('post').filter((r) => r.data.authorId === ME).length,
      friends: of('persona').filter((r) => r.data.kind === 'friend').length,
      photos: media.filter((m) => m.info.kind === 'postPhoto').length,
      comments: of('comment').length,
      profileName: profile.name,
    },
  };
}

/** Everything a restore writes, worked out up front (pure, so the modes can be tested alone). */
export interface RestorePlan {
  profile?: Profile;
  personas: Persona[];
  posts: Post[];
  comments: Comment[];
  reactions: Reaction[];
  events: PlannedEvent[];
  notifications: AppNotification[];
  usageSessions: UsageSession[];
  moods: MoodCheckIn[];
  settings: SettingRow[];
  meta: MetaRow[];
  chat: ChatMessage[];
  stories: Story[];
}

/**
 * - everything: profile, friends, feed, wellbeing and settings exactly as backed up;
 * - content-new-friends: the user's own content and stats; the old friends become former
 *   friends (their comments on your posts stay under their names) and new friends are generated.
 */
export function planRestore(
  records: BackupRecord[],
  mode: RestoreMode,
  now = Date.now(),
): RestorePlan {
  const of = <T>(type: string) =>
    records.filter((r) => r.type === type).map((r) => r.data as unknown as T);
  const posts = of<Post>('post');
  const comments = of<Comment>('comment');
  const reactions = of<Reaction>('reaction');
  let personas = of<Persona>('persona');
  let events = of<PlannedEvent>('event');
  let notifications = of<AppNotification>('notification');
  let meta = of<MetaRow>('meta').filter((m) => !DEVICE_ONLY_META.includes(m.key));
  // Backups made before life stories existed simply have none.
  let stories = of<Story>('story');

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
    // Old friends' stories end; their posts weren't restored, so drop the links to them.
    stories = stories.map((s) => ({
      ...s,
      status: s.status === 'active' ? ('abandoned' as const) : s.status,
      endedAt: s.endedAt ?? now,
      postIds: [],
      stages: s.stages.map((b) => ({ ...b, postId: undefined })),
    }));
  }
  return {
    profile: of<Profile>('profile')[0],
    personas,
    posts: keptPosts,
    comments: keptComments,
    reactions: keptReactions,
    events,
    notifications,
    usageSessions: of<UsageSession>('usageSession'),
    moods: of<MoodCheckIn>('mood'),
    settings: of<SettingRow>('setting').filter((s) => !DEVICE_ONLY_SETTINGS.includes(s.key)),
    meta,
    chat: of<ChatMessage>('chat'),
    stories,
  };
}

const isQuota = (e: unknown): boolean => {
  const err = e as { name?: string; inner?: unknown } | null;
  return err?.name === 'QuotaExceededError' || (!!err?.inner && isQuota(err.inner));
};

const BATCH_FILES = 16;
const BATCH_BYTES = 16 * 1024 * 1024;

/**
 * Restores a checked backup, replacing what is on this device (SPEC §3.11). Order matters:
 *  1. check there is room;
 *  2. add the photos in small batches (photo ids are unique, so extras are harmless);
 *  3. swap all the other rows in ONE transaction that only awaits database calls;
 * and if anything fails, the photos added in step 2 are removed again, so the existing data is
 * untouched.
 */
export async function restoreBackup(
  backup: ParsedBackup,
  mode: RestoreMode,
  { onProgress }: { onProgress?: (p: RestoreProgress) => void } = {},
): Promise<void> {
  const plan = planRestore(backup.records, mode);
  const total = backup.media.length;
  onProgress?.({ phase: 'checking', done: 0, total });

  const have = new Set(await db.media.toCollection().primaryKeys());
  const missing = backup.media.filter((m) => !have.has(m.info.id));
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  if (estimate?.quota) {
    const free = estimate.quota - (estimate.usage ?? 0);
    // Only photos not already on this device need new space.
    const needed = Math.ceil(
      (missing.reduce((sum, m) => sum + m.bytes, 0) + backup.textBytes * 2) * 1.1,
    );
    if (free < needed)
      throw new BackupError(
        `Not enough free space: this backup needs about ${formatBytes(needed)} and this device has ${formatBytes(Math.max(0, free))}.${UNCHANGED}`,
      );
  }

  const staged: string[] = [];
  try {
    let done = 0;
    for (let i = 0; i < missing.length;) {
      const batch: Media[] = [];
      let bytes = 0;
      while (i < missing.length && batch.length < BATCH_FILES && bytes < BATCH_BYTES) {
        const { info, entry } = missing[i++]!;
        const blob = await entry.async('blob');
        batch.push({ ...info, blob: new Blob([blob], { type: info.mimeType }) });
        bytes += blob.size;
      }
      await db.media.bulkPut(batch);
      staged.push(...batch.map((m) => m.id));
      done += batch.length;
      onProgress?.({ phase: 'photos', done, total: missing.length });
    }

    onProgress?.({ phase: 'saving', done: 0, total: 1 });
    const keepIds = new Set(backup.media.map((m) => m.info.id));
    await db.transaction('rw', db.tables, async () => {
      // This browser's own rows (e.g. the automatic-backup folder) survive a restore.
      const keepSettings = await db.settings.bulkGet([...DEVICE_ONLY_SETTINGS]);
      const keepMeta = await db.meta.bulkGet([...DEVICE_ONLY_META]);
      await Promise.all(db.tables.filter((t) => t.name !== 'media').map((t) => t.clear()));
      const stale = (await db.media.toCollection().primaryKeys()).filter(
        (id) => !keepIds.has(id as string),
      );
      await db.media.bulkDelete(stale);
      await db.settings.bulkPut(keepSettings.filter((r): r is SettingRow => !!r));
      await db.meta.bulkPut(keepMeta.filter((r): r is MetaRow => !!r));
      if (plan.profile) await db.profile.put(plan.profile);
      await db.personas.bulkPut(plan.personas);
      await db.posts.bulkPut(plan.posts);
      await db.comments.bulkPut(plan.comments);
      await db.reactions.bulkPut(plan.reactions);
      await db.events.bulkPut(plan.events);
      await db.notifications.bulkPut(plan.notifications);
      await db.usageSessions.bulkPut(plan.usageSessions);
      await db.moods.bulkPut(plan.moods);
      await db.settings.bulkPut(plan.settings);
      await db.meta.bulkPut(plan.meta);
      await db.chat.bulkPut(plan.chat);
      await db.stories.bulkPut(plan.stories);
    });
  } catch (error) {
    await db.media.bulkDelete(staged).catch(() => undefined);
    if (isQuota(error)) throw new BackupError(QUOTA_MESSAGE + UNCHANGED);
    if (error instanceof BackupError) throw error;
    throw new BackupError(`Restoring failed.${UNCHANGED}`);
  }
  try {
    const channel = new BroadcastChannel(RESTORE_CHANNEL);
    channel.postMessage(TAB_ID);
    channel.close();
  } catch {
    /* other tabs just keep their old view */
  }
}
