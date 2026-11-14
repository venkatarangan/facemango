import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import type { ParsedBackup, RestoreMode, RestoreProgress } from '@/lib/backup/import';
import { formatBytes, requestPersistentStorage } from '@/lib/storage';

/** Restore (SPEC §3.11): "Restore everything" or "Restore my content + new friends". */
export function RestoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [mode, setMode] = useState<RestoreMode>('everything');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<RestoreProgress>();

  const pick = async (f?: File) => {
    if (!f) return;
    setError(undefined);
    setBusy(true);
    try {
      const { parseBackup } = await import('@/lib/backup/import');
      setBackup(await parseBackup(f));
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'BackupError' ? e.message : 'Could not read that file.',
      );
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!backup) return;
    setBusy(true);
    setError(undefined);
    try {
      // Big restores ask the browser not to clear FaceMango's data mid-way.
      if (backup.neededBytes > 50 * 1024 * 1024) void requestPersistentStorage();
      const { restoreBackup } = await import('@/lib/backup/import');
      await restoreBackup(backup, mode, { onProgress: setProgress });
      // Reload so the AI, engine and every view start from the restored data.
      window.location.assign('/');
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'BackupError'
          ? e.message
          : 'Restoring failed. Your current data was not changed.',
      );
      setProgress(undefined);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Restore from a backup</DialogTitle>
      <DialogContent>
        {!backup ? (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Choose a <b>facemango-backup-….zip</b> file. It is read on this device only.
            </Typography>
            <Button variant="contained" onClick={() => file.current?.click()} disabled={busy}>
              Choose backup file
            </Button>
            <input
              ref={file}
              type="file"
              accept=".zip,application/zip"
              hidden
              aria-label="Backup file"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>
              Backup of <b>{backup.summary.profileName}</b>: {backup.summary.posts} posts,{' '}
              {backup.summary.photos} photos, {backup.summary.friends} friends,{' '}
              {backup.summary.comments} comments (about {formatBytes(backup.neededBytes)}).
            </Typography>
            {backup.warnings.length > 0 && (
              <Alert severity="info" sx={{ mb: 1, borderRadius: 3 }}>
                {backup.warnings.length} item(s) could not be read and will be skipped.
              </Alert>
            )}
            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as RestoreMode)}>
              <FormControlLabel
                value="everything"
                control={<Radio />}
                label="Restore everything (same friends and feed)"
              />
              <FormControlLabel
                value="content-new-friends"
                control={<Radio />}
                label="Restore my content + new friends"
              />
            </RadioGroup>
            <Alert severity="warning" sx={{ mt: 1, borderRadius: 3 }}>
              This replaces everything currently on this device.
            </Alert>
          </>
        )}
        {busy && (
          <>
            <LinearProgress
              sx={{ mt: 2 }}
              {...(progress?.phase === 'photos' && progress.total
                ? { variant: 'determinate' as const, value: (progress.done / progress.total) * 100 }
                : {})}
            />
            {progress && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {progress.phase === 'checking' && 'Checking…'}
                {progress.phase === 'photos' && `Copying photos ${progress.done}/${progress.total}`}
                {progress.phase === 'saving' && 'Saving…'}
              </Typography>
            )}
          </>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {backup && (
          <Button variant="contained" onClick={() => void restore()} disabled={busy}>
            Restore
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
