import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useAIStore } from '@/ai';
import { CAPTION_DOWNLOAD_MB } from '@/ai/captionModel';
import {
  deletePhotoModel,
  getPhotoDescriptionSettings,
  isPhotoModelDownloaded,
  setPhotoDescriptionsEnabled,
  useCaptionerStore,
} from '@/ai/captioner';
import { useUiStore } from '@/app/uiStore';

/** Settings → On-device AI: photo-aware comments (SPEC §8 #5). */
export function PhotoDescriptionsSetting() {
  const multimodal = useAIStore((s) => s.multimodal);
  const captioner = useCaptionerStore();
  const showToast = useUiStore((s) => s.showToast);
  const settings = useLiveQuery(getPhotoDescriptionSettings, []);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (multimodal) return;
    void isPhotoModelDownloaded().then(setDownloaded);
  }, [multimodal, captioner.status]);

  const enabled = settings?.enabled ?? true;
  return (
    <Stack spacing={0.5} sx={{ pt: 1 }}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => void setPhotoDescriptionsEnabled(e.target.checked)}
          />
        }
        label="Describe my photos so friends can comment on them"
      />
      <Typography variant="body2" color="text.secondary">
        {multimodal
          ? 'Your browser’s built-in AI looks at each photo you post. Photos never leave this device.'
          : `The first photo you post downloads a small photo model (about ${CAPTION_DOWNLOAD_MB} MB). Photos never leave this device.`}
      </Typography>
      {!multimodal && enabled && <CaptionerStatus state={captioner} downloaded={downloaded} />}
      {!multimodal && downloaded && (
        <Button
          variant="text"
          size="small"
          sx={{ alignSelf: 'flex-start' }}
          onClick={() =>
            void deletePhotoModel().then((ok) => {
              setDownloaded(false);
              showToast(ok ? 'Photo model deleted.' : 'Nothing to delete.');
            })
          }
        >
          Delete photo model
        </Button>
      )}
    </Stack>
  );
}

function CaptionerStatus({
  state,
  downloaded,
}: {
  state: ReturnType<typeof useCaptionerStore.getState>;
  downloaded: boolean;
}) {
  switch (state.status) {
    case 'downloading':
      return (
        <Stack spacing={0.5} aria-label="Photo model progress">
          <Typography variant="body2">
            {downloaded ? 'Loading the photo model…' : 'Downloading the photo model…'}{' '}
            {Math.round(state.progress * 100)}%
          </Typography>
          <LinearProgress variant="determinate" value={state.progress * 100} />
        </Stack>
      );
    case 'working':
      return <Typography variant="body2">Looking at your photo…</Typography>;
    case 'ready':
      return <Typography variant="body2">Photo model ready.</Typography>;
    case 'error':
      return (
        <Typography variant="body2" color="error" sx={{ wordBreak: 'break-word' }}>
          The photo model failed: {state.error}. Friends will comment without seeing the photo. It
          will try again with your next photo.
        </Typography>
      );
    case 'unavailable':
      return (
        <Typography variant="body2" color="text.secondary">
          {state.error} Friends will comment without seeing your photos.
        </Typography>
      );
    default:
      return downloaded ? (
        <Typography variant="body2" color="text.secondary">
          Photo model downloaded.
        </Typography>
      ) : null;
  }
}
