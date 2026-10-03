import { db, type NotificationType } from '@/db';

export async function notify(
  type: NotificationType,
  text: string,
  extra: { postId?: string; personaId?: string; createdAt?: number } = {},
): Promise<void> {
  await db.notifications.add({
    id: crypto.randomUUID(),
    type,
    text,
    read: 0,
    createdAt: extra.createdAt ?? Date.now(),
    postId: extra.postId,
    personaId: extra.personaId,
  });
}

export async function markAllRead(): Promise<void> {
  await db.notifications.where('read').equals(0).modify({ read: 1 });
}

export function snippet(text: string, max = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
