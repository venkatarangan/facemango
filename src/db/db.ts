import Dexie, { type EntityTable } from 'dexie';
import type {
  AppNotification,
  ChatMessage,
  Comment,
  Media,
  MetaRow,
  MoodCheckIn,
  Persona,
  PlannedEvent,
  Post,
  Profile,
  Reaction,
  SettingRow,
  UsageSession,
} from './types';

export const DB_NAME = 'facemango';

export class FaceMangoDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  personas!: EntityTable<Persona, 'id'>;
  posts!: EntityTable<Post, 'id'>;
  comments!: EntityTable<Comment, 'id'>;
  reactions!: EntityTable<Reaction, 'id'>;
  events!: EntityTable<PlannedEvent, 'id'>;
  notifications!: EntityTable<AppNotification, 'id'>;
  media!: EntityTable<Media, 'id'>;
  usageSessions!: EntityTable<UsageSession, 'id'>;
  moods!: EntityTable<MoodCheckIn, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;
  chat!: EntityTable<ChatMessage, 'id'>;

  constructor(name = DB_NAME) {
    super(name);
    // Add new versions below; never edit a shipped version (SPEC §6.2 "Dexie schema + migrations").
    this.version(1).stores({
      profile: 'id',
      personas: 'id, kind, createdAt',
      posts: 'id, authorId, createdAt',
      comments: 'id, postId, authorId, parentId, createdAt',
      reactions: 'id, postId, [postId+personaId], createdAt',
      events: 'id, postId, personaId, [status+dueAt]',
      notifications: 'id, createdAt, read',
      media: 'id, kind, createdAt',
      usageSessions: 'id, startedAt',
      moods: 'id, at',
      settings: 'key',
      meta: 'key',
    });
    // v2 (M5): Mango AI chat history.
    this.version(2).stores({ chat: 'id, createdAt' });
  }
}

export const db = new FaceMangoDB();
