import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';

export function useUnreadCount(): number {
  return useLiveQuery(() => db.notifications.where('read').equals(0).count(), []) ?? 0;
}
