import Box from '@mui/material/Box';
import { LogoMark } from './brand/Logo';

export function SplashScreen() {
  return (
    <Box
      sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}
      role="status"
      aria-label="Loading FaceMango"
    >
      <LogoMark
        size={72}
        title=""
        sx={{
          '@keyframes fm-pulse': {
            '0%,100%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.06)' },
          },
          animation: 'fm-pulse 1.4s ease-in-out infinite',
        }}
      />
    </Box>
  );
}
