import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useUiStore } from '@/app/uiStore';
import {
  chooseBackupFolder,
  folderBackupSupported,
  getAutoBackup,
  getAutoBackupStatus,
  outcomeMessage,
  runAutoBackup,
  turnOffAutoBackup,
  useAutoBackupStore,
  type AutoBackupConfig,
} from '@/lib/backup/autoBackup';
import { AUTO_BACKUP_KEEP, folderPermission } from '@/lib/backup/folder';

const when = (t: number) => format(t, 'd MMMM yyyy, h:mm a');

/** Settings → Advanced: weekly backup zip to a folder (File System Access API, opt-in). */
export function AutoBackupSection() {
  const [supported] = useState(() => folderBackupSupported());
  const showToast = useUiStore((s) => s.showToast);
  const config = useLiveQuery(getAutoBackup, []);
  const status = useLiveQuery(getAutoBackupStatus, []);
  const needsPermission = useAutoBackupStore((s) => s.needsPermission);
  const running = useAutoBackupStore((s) => s.running);
  const [permission, setPermission] = useState<string>();

  useEffect(() => {
    if (!config) return;
    void folderPermission(config.handle, { request: false })
      .then(setPermission)
      .catch(() => setPermission('prompt'));
  }, [config, status?.lastAt]);

  if (!supported) {
    return (
      <Typography variant="body2" color="text.secondary">
        Saves a backup to a folder on your computer every week. It needs Chrome or Edge on a
        computer, so it isn&apos;t available in this browser. You can still download a backup in
        Settings.
      </Typography>
    );
  }

  const backUp = async (current: AutoBackupConfig) => {
    const outcome = await runAutoBackup({ interactive: true, force: true, config: current });
    showToast(outcomeMessage(outcome, current.folderName));
    if (outcome === 'saved') setPermission('granted');
  };

  const choose = async () => {
    try {
      if (!(await chooseBackupFolder())) return;
      const fresh = await getAutoBackup();
      if (fresh) await backUp(fresh);
    } catch (error) {
      showToast(`Could not use that folder: ${error instanceof Error ? error.message : error}`);
    }
  };

  if (config === undefined) return null;
  if (!config) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Every week, FaceMango saves a backup zip to a folder you choose on this computer and keeps
          the latest {AUTO_BACKUP_KEEP}. The file stays on your computer; FaceMango uploads nothing.
          (If the folder syncs to a cloud drive, that app copies it to the cloud.)
        </Typography>
        <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => void choose()}>
          Choose a folder and turn on
        </Button>
      </Stack>
    );
  }

  const askAgain = needsPermission || (permission !== undefined && permission !== 'granted');
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label="On" color="success" size="small" />
        <Typography variant="body2">
          Saving to “{config.folderName}” every week. Keeps the latest {AUTO_BACKUP_KEEP}.
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {status?.lastAt
          ? `Last saved: ${when(status.lastAt)}${status.lastFile ? ` (${status.lastFile})` : ''}.`
          : 'Not saved yet.'}
      </Typography>
      {askAgain && (
        <Alert
          severity="warning"
          sx={{ borderRadius: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => void backUp(config)}>
              Allow
            </Button>
          }
        >
          Your browser needs your OK to save to “{config.folderName}” again. This is normal after a
          restart.
        </Alert>
      )}
      {status?.error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          Last try ({when(status.error.at)}) failed: {status.error.message}
        </Alert>
      )}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" disabled={running} onClick={() => void backUp(config)}>
          {running ? 'Saving…' : 'Back up now'}
        </Button>
        <Button variant="outlined" onClick={() => void choose()}>
          Change folder
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() =>
            void turnOffAutoBackup().then(() =>
              showToast('Automatic backup is off. Backups already saved stay in the folder.'),
            )
          }
        >
          Turn off
        </Button>
      </Stack>
    </Stack>
  );
}
