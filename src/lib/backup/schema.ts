/**
 * Validation for backup records (SPEC §3.11). A backup is checked in full before anything is
 * written, so a damaged or hand-edited file can never put bad rows into the database. Schemas are
 * loose (unknown keys are kept) so fields added in later versions survive a round trip.
 */
import { z } from 'zod';
import { MAX_COMMENTS_PER_POST, MAX_LIKES_PER_POST } from '@/engine/limits';
import { BackupError, type BackupRecord } from './format';

const id = z.string().min(1);
const time = z.number().finite();
const strings = z.array(z.string());
const loose = z.looseObject;

const Profile = loose({
  id: z.literal('me'),
  name: z.string().min(1),
  age: z.number(),
  city: z.string(),
  languages: strings,
  createdAt: time,
});
const Persona = loose({
  id,
  kind: z.enum(['friend', 'public', 'former']),
  name: z.string(),
  gender: z.enum(['female', 'male', 'nonbinary']),
  age: z.number(),
  city: z.string(),
  country: z.string(),
  languages: strings,
  occupation: z.string(),
  interests: strings,
  likes: strings,
  dislikes: strings,
  writingStyle: z.string(),
  agreeableness: z.number(),
  stance: z.enum(['fan', 'neutral', 'critic']),
  activity: z.number(),
  closeness: z.number(),
  avatar: loose({ style: z.string(), seed: z.string() }),
  createdAt: time,
});
const Post = loose({
  id,
  authorId: id,
  text: z.string(),
  mentions: strings,
  createdAt: time,
  plannedComments: z.number().min(0).max(MAX_COMMENTS_PER_POST),
  plannedLikes: z.number().min(0).max(MAX_LIKES_PER_POST),
  reactionCounts: z.record(z.string(), z.number()),
  // Counts every comment and reply, which are not capped (only the planned total is).
  commentCount: z.number().min(0),
});
const Comment = loose({ id, postId: id, authorId: id, text: z.string(), createdAt: time });
const Reaction = loose({
  id,
  postId: id,
  personaId: id,
  type: z.enum(['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry']),
  createdAt: time,
});
const Event = loose({
  id,
  type: z.enum(['reaction', 'comment', 'reply', 'friendRequest', 'post']),
  status: z.enum(['planned', 'applied', 'cancelled']),
  dueAt: time,
});
const Notification = loose({
  id,
  type: z.enum([
    'reaction',
    'comment',
    'reply',
    'mention',
    'birthday',
    'friendRequest',
    'milestone',
  ]),
  createdAt: time,
  read: z.union([z.literal(0), z.literal(1)]),
  text: z.string(),
});
const UsageSession = loose({ id, startedAt: time, endedAt: time, activeMs: z.number() });
const Mood = loose({ id, at: time, mood: z.enum(['good', 'okay', 'low']) });
const Chat = loose({ id, role: z.enum(['user', 'assistant']), text: z.string(), createdAt: time });
const Row = loose({ key: z.string().min(1), value: z.unknown().optional() });
const Story = loose({
  id,
  personaId: id,
  kind: z.string(),
  title: z.string(),
  slots: z.record(z.string(), z.string()),
  stages: z.array(loose({ title: z.string(), brief: z.string() })),
  currentStage: z.number(),
  status: z.enum(['active', 'completed', 'abandoned']),
  startedAt: time,
  nextBeatAt: time,
  postIds: strings,
});

export const RECORD_SCHEMAS = {
  profile: Profile,
  persona: Persona,
  post: Post,
  comment: Comment,
  reaction: Reaction,
  event: Event,
  notification: Notification,
  usageSession: UsageSession,
  mood: Mood,
  chat: Chat,
  setting: Row,
  meta: Row,
  story: Story,
} as const;

export type RecordType = keyof typeof RECORD_SCHEMAS;

/** Photo sidecar (images/<id>.<ext>.json). */
export const MediaInfo = loose({
  id,
  kind: z.enum(['profilePhoto', 'postPhoto', 'avatar']),
  mimeType: z.string().min(1),
  createdAt: time,
  bytes: z.number().optional(),
});

/** backup.json (format 2). */
export const Manifest = loose({
  app: z.literal('facemango'),
  version: z.number().int().min(1),
  createdAt: z.string(),
  counts: z.record(z.string(), z.number()),
});
export type Manifest = z.infer<typeof Manifest>;

/** Checks one record; the error names the file and record so a bad backup is easy to explain. */
export function validateRecord(record: BackupRecord, file: string): void {
  const schema = RECORD_SCHEMAS[record.type as RecordType];
  if (!schema) return; // a type from a newer minor version: ignored, never written
  const result = schema.safeParse(record.data);
  const key =
    (record.data as { id?: string; key?: string }).id ?? (record.data as { key?: string }).key;
  if (!result.success || (key !== undefined && key !== record.id)) {
    throw new BackupError(`${file} has a damaged ${record.type} record (${record.id}).`);
  }
}
