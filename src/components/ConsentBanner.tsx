import { useState } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { analyticsConfigured, getConsent, needsConsent, setConsent } from '@/lib/analytics';

/** EU/UK consent for page-view analytics (SPEC §7). Shown only when GA is configured. */
export function ConsentBanner() {
  const [open, setOpen] = useState(
    () => analyticsConfigured() && needsConsent() && getConsent() === null,
  );
  if (!open) return null;
  const choose = (value: 'granted' | 'denied') => {
    setConsent(value);
    setOpen(false);
  };
  return (
    <Paper
      elevation={8}
      role="dialog"
      aria-label="Analytics consent"
      sx={{
        position: 'fixed',
        zIndex: 1400,
        left: 16,
        right: 16,
        bottom: { xs: 'calc(84px + env(safe-area-inset-bottom))', md: 16 },
        maxWidth: 560,
        mx: 'auto',
        p: 2,
        borderRadius: 4,
      }}
    >
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        May FaceMango count page views with Google Analytics? It only sees which screens are opened,
        never your posts, profile, friends or wellbeing stats.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => choose('denied')}>No thanks</Button>
        <Button variant="contained" onClick={() => choose('granted')}>
          Allow
        </Button>
      </Stack>
    </Paper>
  );
}
