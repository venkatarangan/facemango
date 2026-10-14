import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useUiStore } from '@/app/uiStore';
import { db, ME } from '@/db';
import { setMeta } from '@/engine/settings';
import {
  getAutoBackup,
  getAutoBackupStatus,
  outcomeMessage,
  runAutoBackup,
  useAutoBackupStore,
} from '@/lib/backup/autoBackup';
import { backupRemindersEnabled, isBackupDue } from '@/lib/backup/reminders';
import { useNow } from '@/lib/useNow';

/**
 * Backup reminder when the last backup is more than 7 days old (SPEC §2; default on for iOS).
 * With automatic folder backup on, it appears only when the browser needs the user's OK again
 * or the last folder backup failed; a click is the gesture the permission prompt needs.
 */
export function BackupReminderCard() {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const showToast = useUiStore((s) => s.showToast);
  const needsPermission = useAutoBackupStore((s) => s.needsPermission);
  const state = useLiveQuery(async () => {
    const [auto, last, snoozed, profile] = await Promise.all([
      getAutoBackup(),
      db.meta.get('lastBackupAt'),
      db.meta.get('backupReminderSnoozedAt'),
      db.profile.get(ME),
    ]);
    const t = Date.now();
    if (!isBackupDue((snoozed?.value as number | undefined) ?? 0, t)) return null;
    if (auto) {
      const status = await getAutoBackupStatus();
      if (!isBackupDue(status.lastAt ?? 0, t)) return null;
      return { auto, error: status.error?.message };
    }
    if (!(await backupRemindersEnabled())) return null;
    const since = (last?.value as number | undefined) ?? profile?.createdAt;
    return isBackupDue(since, t) ? { auto: null, error: undefined } : null;
  }, [now]);
  if (!state) return null;
  const { auto, error } = state;
  // The background check handles the folder backup by itself while it has permission.
  if (auto && !needsPermission && !error) return null;

  const backUp = async () => {
    setBusy(true);
    try {
      if (auto) {
        const outcome = await runAutoBackup({ interactive: true, force: true, config: auto });
        showToast(outcomeMessage(outcome, auto.folderName));
      } else {
        const { buildBackup, downloadBlob } = await import('@/lib/backup/export');
        const { blob, filename } = await buildBackup();
        downloadBlob(blob, filename);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert
      severity={auto && error ? 'warning' : 'info'}
      sx={{ borderRadius: 3 }}
      action={
        <>
          <Button color="inherit" size="small" disabled={busy} onClick={() => void backUp()}>
            {auto && needsPermission ? 'Allow' : 'Back up'}
          </Button>
          <Button
            color="inherit"
            size="small"
            onClick={() => void setMeta('backupReminderSnoozedAt', Date.now())}
          >
            Later
          </Button>
        </>
      }
    >
      {!auto
        ? 'It’s been over a week since your last backup.'
        : needsPermission
          ? `Time for your weekly backup to “${auto.folderName}”. Your browser needs your OK first.`
          : `Your weekly backup to “${auto.folderName}” didn’t save: ${error}`}
    </Alert>
  );
}
