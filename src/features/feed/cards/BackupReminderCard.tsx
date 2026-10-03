import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { db, ME } from '@/db';
import { setMeta } from '@/engine/settings';
import { backupRemindersEnabled } from '@/lib/backup/reminders';
import { useNow } from '@/lib/useNow';

const WEEK = 7 * 86_400_000;

/** Backup reminder when the last export is more than 7 days old (SPEC §2; default on for iOS). */
export function BackupReminderCard() {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const due = useLiveQuery(async () => {
    if (!(await backupRemindersEnabled())) return false;
    const [last, snoozed, profile] = await Promise.all([
      db.meta.get('lastBackupAt'),
      db.meta.get('backupReminderSnoozedAt'),
      db.profile.get(ME),
    ]);
    const since = (last?.value as number | undefined) ?? profile?.createdAt ?? Date.now();
    return (
      Date.now() - since > WEEK && Date.now() - ((snoozed?.value as number | undefined) ?? 0) > WEEK
    );
  }, [now]);
  if (!due) return null;
  return (
    <Alert
      severity="info"
      sx={{ borderRadius: 3 }}
      action={
        <>
          <Button
            color="inherit"
            size="small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { buildBackup, downloadBlob } = await import('@/lib/backup/export');
              const { blob, filename } = await buildBackup();
              downloadBlob(blob, filename);
              setBusy(false);
            }}
          >
            Back up
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
      It&apos;s been over a week since your last backup.
    </Alert>
  );
}
