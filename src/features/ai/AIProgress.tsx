import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { useAIStore } from '@/ai';
import { brand } from '@/app/tokens';

/** Compact AI download status, shown while the user fills in signup (SPEC §3.1 step 3). */
export function AIProgressStrip() {
  const { status, progress, modelLabel } = useAIStore();
  if (status === 'idle' || status === 'unsupported') return null;
  const ready = status === 'ready';
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ p: 1.5, borderRadius: 3, bgcolor: brand.surface, border: `1px solid ${brand.divider}` }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: ready ? 0 : 1 }}>
        {ready ? (
          <CheckCircleRounded sx={{ color: 'success.main', fontSize: 20 }} />
        ) : (
          <AutoAwesomeRounded sx={{ color: brand.mangoText, fontSize: 20 }} />
        )}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {ready
            ? `On-device AI ready${modelLabel ? ` · ${modelLabel}` : ''}`
            : status === 'needs-gesture'
              ? 'On-device AI is waiting to start'
              : status === 'error'
                ? 'AI setup hit a problem. You can retry after signup.'
                : `Setting up on-device AI while you sign up… ${Math.round(progress * 100)}%`}
        </Typography>
      </Stack>
      {!ready && status !== 'error' && status !== 'needs-gesture' && (
        <LinearProgress
          variant={status === 'detecting' ? 'indeterminate' : 'determinate'}
          value={progress * 100}
          aria-label="AI setup progress"
          sx={{ height: 6, borderRadius: 3 }}
        />
      )}
    </Box>
  );
}
