import { useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { resetFriends } from '@/engine/reset';
import { RestoreDialog } from '@/features/backup/RestoreDialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { backupRemindersEnabled } from '@/lib/backup/reminders';
import { promptInstall, useInstallStore } from '@/lib/install';
import { setSoundsEnabled, soundsEnabled } from '@/lib/sound';
import {
  disableSystemNotifications,
  enableSystemNotifications,
  systemNotificationsEnabled,
} from '@/lib/systemNotify';
import { isStandalone } from '@/lib/platform';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useProfile } from '@/app/useProfile';
import { UserAvatar } from '@/components/UserAvatar';
import { deleteAllData } from '@/db';
import { deleteDownloadedModel, startAI, useAIStore } from '@/ai';
import { useUiStore } from '@/app/uiStore';
import {
  formatBytes,
  getPersistenceStatus,
  getStorageEstimate,
  requestPersistentStorage,
  type PersistenceStatus,
} from '@/lib/storage';

const persistenceLabel: Record<PersistenceStatus, string> = {
  persisted: 'Protected',
  'not-persisted': 'Not protected',
  unsupported: 'Not supported',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" aria-label={title}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [persistence, setPersistence] = useState<PersistenceStatus>();
  const [usage, setUsage] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sounds, setSounds] = useState(soundsEnabled());
  const prefs = useLiveQuery(
    async () => ({
      notify: await systemNotificationsEnabled(),
      backups: await backupRemindersEnabled(),
    }),
    [],
  );
  const installPrompt = useInstallStore((s) => s.prompt);
  const lastBackupAt = useLiveQuery(
    async () => (await db.meta.get('lastBackupAt'))?.value as number | undefined,
    [],
  );
  const ai = useAIStore();
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    void getPersistenceStatus().then(setPersistence);
    void getStorageEstimate().then(
      (e) => e && setUsage(`${formatBytes(e.usage)} of ${formatBytes(e.quota)}`),
    );
  }, []);

  if (!profile) return null;

  const onDelete = async () => {
    await deleteAllData();
    setConfirmOpen(false);
    navigate('/welcome', { replace: true });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ px: { xs: 0.5, sm: 0 } }}>
        Settings
      </Typography>

      <Section title="Your profile">
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <UserAvatar profile={profile} size={64} />
          <div>
            <Typography sx={{ fontWeight: 700 }}>{profile.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {profile.age} · {profile.city}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {profile.languages.map((l) => (
                <Chip key={l} label={l} size="small" />
              ))}
            </Stack>
          </div>
        </Stack>
      </Section>

      <Section title="On-device AI">
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography>Engine</Typography>
            <Typography color="text.secondary">
              {ai.tier === 'prompt-api'
                ? 'Built-in browser AI (Prompt API)'
                : ai.tier === 'webgpu'
                  ? 'WebLLM on WebGPU'
                  : '—'}
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography>Model</Typography>
            <Typography color="text.secondary">{ai.modelLabel ?? '—'}</Typography>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography>Status</Typography>
            <Chip
              size="small"
              label={
                ai.status === 'ready'
                  ? 'Ready'
                  : ai.status === 'downloading'
                    ? `Downloading ${Math.round(ai.progress * 100)}%`
                    : ai.status
              }
              color={ai.status === 'ready' ? 'success' : 'default'}
            />
          </Stack>
          {ai.lastError && (
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              Last AI error: {ai.lastError}
            </Typography>
          )}
          {ai.tier === 'webgpu' && (
            <Button
              variant="outlined"
              sx={{ alignSelf: 'flex-start', mt: 1 }}
              onClick={() =>
                void deleteDownloadedModel().then((ok) =>
                  showToast(
                    ok
                      ? 'Model deleted. It will download again next time you open FaceMango.'
                      : 'Nothing to delete.',
                  ),
                )
              }
            >
              Delete downloaded model
            </Button>
          )}
          {ai.tier === 'prompt-api' && (
            <Typography variant="body2" color="text.secondary">
              The built-in model is managed by your browser (see chrome://on-device-internals).
            </Typography>
          )}
          {(ai.status === 'error' || ai.status === 'needs-gesture') && (
            <Button
              variant="contained"
              sx={{ alignSelf: 'flex-start' }}
              onClick={() => void startAI({ userGesture: true })}
            >
              Start AI setup
            </Button>
          )}
        </Stack>
      </Section>

      <Section title="Preferences">
        <Stack>
          <FormControlLabel
            control={
              <Switch
                checked={sounds}
                onChange={(e) => {
                  setSounds(e.target.checked);
                  void setSoundsEnabled(e.target.checked);
                }}
              />
            }
            label="Sounds"
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!prefs?.notify}
                onChange={async (e) => {
                  if (e.target.checked) {
                    const ok = await enableSystemNotifications();
                    if (!ok) showToast('Notifications are blocked in your browser settings.');
                  } else {
                    await disableSystemNotifications();
                  }
                }}
              />
            }
            label="Notify me about reactions and comments while FaceMango is in the background"
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!prefs?.backups}
                onChange={(e) =>
                  void db.settings.put({ key: 'backupReminders', value: e.target.checked })
                }
              />
            }
            label="Remind me to back up every week"
          />
        </Stack>
        {installPrompt && !isStandalone() && (
          <Button variant="contained" sx={{ mt: 1.5 }} onClick={() => void promptInstall()}>
            Install FaceMango as an app
          </Button>
        )}
      </Section>

      <Section title="Engagement">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Friend count, mixes, how many likes and comments you get, and how fast they arrive.
        </Typography>
        <Button variant="outlined" component={RouterLink} to="/settings/advanced">
          Advanced settings
        </Button>
      </Section>

      <Section title="Backup & restore">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Download everything (posts, photos, friends, feed and wellbeing) as Markdown and images in
          a zip file.
          {lastBackupAt
            ? ` Last backup: ${format(lastBackupAt, 'd MMMM yyyy, h:mm a')}.`
            : ' No backup yet.'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const { buildBackup, downloadBlob } = await import('@/lib/backup/export');
                const { blob, filename } = await buildBackup();
                downloadBlob(blob, filename);
                showToast('Backup downloaded. Keep it somewhere safe.');
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? 'Preparing…' : 'Download backup'}
          </Button>
          <Button variant="outlined" onClick={() => setRestoreOpen(true)}>
            Restore from a backup
          </Button>
        </Stack>
      </Section>

      <Section title="Friends">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Start over with a new circle of friends. Your posts stay; old friends&apos; likes and
          comments stay under their names.
        </Typography>
        <Button variant="outlined" onClick={() => setResetOpen(true)}>
          Reset friends
        </Button>
      </Section>

      <Section title="Storage">
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
          >
            <div>
              <Typography>Persistent storage</Typography>
              <Typography variant="body2" color="text.secondary">
                Asks the browser not to clear FaceMango's data when space runs low.
              </Typography>
            </div>
            <Chip
              label={persistence ? persistenceLabel[persistence] : '…'}
              color={persistence === 'persisted' ? 'success' : 'default'}
              variant={persistence === 'persisted' ? 'filled' : 'outlined'}
            />
          </Stack>
          {persistence === 'not-persisted' && (
            <Button
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
              onClick={() => void requestPersistentStorage().then(setPersistence)}
            >
              Ask again
            </Button>
          )}
          {usage && (
            <Typography variant="body2" color="text.secondary">
              Using {usage}
            </Typography>
          )}
        </Stack>
      </Section>

      <Section title="Danger zone">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Permanently deletes your profile, posts, friends and stats from this browser. Backup and
          restore arrive in M6.
        </Typography>
        <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
          Delete all FaceMango data
        </Button>
      </Section>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
        FaceMango v{__APP_VERSION__} · AGPL-3.0
      </Typography>

      <RestoreDialog open={restoreOpen} onClose={() => setRestoreOpen(false)} />
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reset friends?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current friends become former friends: their existing likes and comments stay, but
            they won&apos;t engage any more. FaceMango then finds a new circle using your advanced
            settings.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setResetOpen(false);
              void resetFriends().then(() => navigate('/'));
            }}
          >
            Reset friends
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete everything?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes all FaceMango data from this browser. It can&apos;t be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void onDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
