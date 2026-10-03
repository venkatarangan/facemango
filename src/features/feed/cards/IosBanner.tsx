import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { db } from '@/db';
import { setMeta } from '@/engine/settings';
import { IosDataNotice } from '@/features/onboarding/IosDataNotice';
import { isIOS, isStandalone } from '@/lib/platform';

/** The iOS data-loss banner, shown in a non-installed Safari tab at most every 7 days (SPEC §2). */
export function IosBanner() {
  const [eligible] = useState(() => isIOS() && !isStandalone());
  const show = useLiveQuery(async () => {
    if (!eligible) return false;
    const dismissed = (await db.meta.get('iosBannerDismissedAt'))?.value as number | undefined;
    return !dismissed || Date.now() - dismissed > 7 * 86_400_000;
  }, [eligible]);
  if (!show) return null;
  return (
    <Box sx={{ position: 'relative' }}>
      <IosDataNotice />
      <IconButton
        size="small"
        aria-label="Dismiss for a week"
        onClick={() => void setMeta('iosBannerDismissedAt', Date.now())}
        sx={{ position: 'absolute', top: 6, right: 6 }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}
