import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Offers a reload when a new version has been downloaded by the service worker. */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <Snackbar
      open={needRefresh}
      message="A new version of FaceMango is ready."
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 24 } }}
      action={
        <>
          <Button color="primary" onClick={() => setNeedRefresh(false)} sx={{ color: 'inherit' }}>
            Later
          </Button>
          <Button variant="contained" size="small" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
        </>
      }
    />
  );
}
