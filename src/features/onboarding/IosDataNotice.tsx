import { useState } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import PhoneIphoneRounded from '@mui/icons-material/PhoneIphoneRounded';
import { IOS_DATA_NOTICE } from '@/lib/copy';
import { AddToHomeScreenGuide } from './AddToHomeScreenGuide';

/** The required iOS 7-day eviction warning (SPEC §2) with the Add to Home Screen guide. */
export function IosDataNotice() {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <>
      <Alert
        severity="warning"
        icon={<PhoneIphoneRounded />}
        data-testid="ios-data-notice"
        sx={{ borderRadius: 3, alignItems: 'flex-start' }}
      >
        <AlertTitle sx={{ fontWeight: 700 }}>Using an iPhone or iPad?</AlertTitle>
        {IOS_DATA_NOTICE}
        <Button
          color="inherit"
          size="small"
          onClick={() => setGuideOpen(true)}
          sx={{ display: 'block', mt: 1, px: 0, textDecoration: 'underline' }}
        >
          Show me how to add it
        </Button>
      </Alert>
      <AddToHomeScreenGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
