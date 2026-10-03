import { db } from '@/db';
import { isIOS } from '@/lib/platform';

/** Weekly backup reminders: on by default on iOS (7-day eviction), optional elsewhere (SPEC §2). */
export async function backupRemindersEnabled(): Promise<boolean> {
  const row = await db.settings.get('backupReminders');
  return typeof row?.value === 'boolean' ? row.value : isIOS();
}
