/**
 * IndexedDB record types (SPEC §6.3). Booleans that need an index are stored as 0 | 1,
 * because IndexedDB cannot index booleans.
 */

export type Id = string;
/** Epoch milliseconds. */
export type Timestamp = number;

export const ME = 'me' as const;

export interface Profile {
  id: typeof ME;
  name: string;
  age: number;
  city: string;
  languages: string[];
  /** media.id of the profile photo, if any. */
  photoId?: Id;
  createdAt: Timestamp;
  /** When the user acknowledged the local-data (and, on iOS, 7-day eviction) notice. */
  dataNoticeAcknowledgedAt: Timestamp;
}

export type PersonaKind = 'friend' | 'public' | 'former';
export type Gender = 'female' | 'male' | 'nonbinary';
export type Stance = 'fan' | 'neutral' | 'critic';

export interface AvatarTraits {
  style: string;
  seed: string;
  options?: Record<string, string | number | boolean>;
}

export interface Persona {
  id: Id;
  kind: PersonaKind;
  name: string;
  gender: Gender;
  age: number;
  city: string;
  country: string;
  languages: string[];
  occupation: string;
  interests: string[];
  likes: string[];
  dislikes: string[];
  writingStyle: string;
  /** 0..1 */
  agreeableness: number;
  stance: Stance;
  /** 0..1, how often this persona engages. */
  activity: number;
  /** 0..1, used to weight who engages with the user. */
  closeness: number;
  avatar: AvatarTraits;
  birthday?: string; // MM-DD
  /** Lazily generated profile page content (SPEC §3.4). */
  profileDetails?: {
    about: string;
    work: string;
    education: string;
    personality: string;
    coverPhotoId?: string;
  };
  createdAt: Timestamp;
  /** Set when a friends reset turns this persona into a former friend. */
  formerSince?: Timestamp;
}

export interface Post {
  id: Id;
  /** ME or a persona id. */
  authorId: Id;
  text: string;
  /** media.id (user photo) or a photo-pack id prefixed with "pack:". */
  photo?: string;
  feeling?: string;
  mentions: Id[];
  createdAt: Timestamp;
  editedAt?: Timestamp;
  /** Planned totals, already clamped to the hard caps. */
  plannedComments: number;
  plannedLikes: number;
  /** Aggregates applied so far (named reactions + anonymous "others"). */
  reactionCounts: Partial<Record<ReactionType, number>>;
  commentCount: number;
}

export type ReactionType = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry';

export interface Reaction {
  id: Id;
  postId: Id;
  /** ME or a persona id. */
  personaId: Id;
  type: ReactionType;
  createdAt: Timestamp;
}

export type CommentCategory = 'good' | 'appreciative' | 'nonsense' | 'critical' | 'superCritical';

export interface Comment {
  id: Id;
  postId: Id;
  authorId: Id;
  /** One level of replies only. */
  parentId?: Id;
  text: string;
  category?: CommentCategory;
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

export type EventType = 'reaction' | 'comment' | 'reply' | 'friendRequest' | 'post';
export type EventStatus = 'planned' | 'applied' | 'cancelled';

export interface PlannedEvent {
  id: Id;
  type: EventType;
  status: EventStatus;
  dueAt: Timestamp;
  postId?: Id;
  personaId?: Id;
  payload?: Record<string, unknown>;
}

export type NotificationType =
  'reaction' | 'comment' | 'reply' | 'mention' | 'birthday' | 'friendRequest' | 'milestone';

export interface AppNotification {
  id: Id;
  type: NotificationType;
  createdAt: Timestamp;
  read: 0 | 1;
  postId?: Id;
  personaId?: Id;
  text: string;
}

export type MediaKind = 'profilePhoto' | 'postPhoto' | 'avatar';

export interface Media {
  id: Id;
  kind: MediaKind;
  blob: Blob;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: Timestamp;
}

export interface UsageSession {
  id: Id;
  startedAt: Timestamp;
  endedAt: Timestamp;
  /** Foreground milliseconds. */
  activeMs: number;
}

export type Mood = 'good' | 'okay' | 'low';

export interface MoodCheckIn {
  id: Id;
  at: Timestamp;
  mood: Mood;
  sessionId?: Id;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
