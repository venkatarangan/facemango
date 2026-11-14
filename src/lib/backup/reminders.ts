import { db } from '@/db';
import { isIOS } from '@/lib/platform';

/** Backups are due weekly, for reminders and automatic folder backups alike (SPEC §2, §3.11). */
export const BACKUP_INTERVAL_MS = 7 * 86_400_000;

/** Weekly backup reminders: on by default on iOS (7-day eviction), optional elsewhere (SPEC §2). */
export async function backupRemindersEnabled(): Promise<boolean> {
  const row = await db.settings.get('backupReminders');
  return typeof row?.value === 'boolean' ? row.value : isIOS();
}

/** True when more than a week has passed since `since` (the last backup, or sign-up). */
export function isBackupDue(since: number | undefined, now: number): boolean {
  return now - (since ?? now) > BACKUP_INTERVAL_MS;
}
