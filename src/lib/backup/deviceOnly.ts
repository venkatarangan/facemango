/**
 * Rows that belong to this browser, not to the user's content: they are left out of backups and
 * kept when a backup is restored. The folder handle can't be serialised anyway.
 */
export const AUTO_BACKUP_KEY = 'autoBackup'; // settings: { handle, folderName, since }
export const AUTO_BACKUP_STATUS_KEY = 'autoBackupStatus'; // meta: { lastAt, lastFile, error }

export const DEVICE_ONLY_SETTINGS: readonly string[] = [AUTO_BACKUP_KEY];
export const DEVICE_ONLY_META: readonly string[] = [AUTO_BACKUP_STATUS_KEY];
