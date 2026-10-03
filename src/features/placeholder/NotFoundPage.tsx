import { Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LogoMark } from '@/components/brand/Logo';

export function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <LogoMark size={80} title="" aria-hidden sx={{ transform: 'rotate(160deg)' }} />
        <Typography variant="h4" component="h1">
          This page fell off the tree
        </Typography>
        <Typography color="text.secondary">
          We couldn&apos;t find what you were looking for.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/">
          Back to FaceMango
        </Button>
      </Stack>
    </Box>
  );
}
