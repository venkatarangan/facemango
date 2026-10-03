import Snackbar from '@mui/material/Snackbar';
import { useUiStore } from '@/app/uiStore';

export function Toaster() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <Snackbar
      key={toast?.id}
      open={toast !== null}
      onClose={(_, reason) => reason !== 'clickaway' && dismiss()}
      autoHideDuration={3500}
      message={toast?.message}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 24 } }}
    />
  );
}
