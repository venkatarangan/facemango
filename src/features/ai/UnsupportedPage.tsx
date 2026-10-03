import { Link as RouterLink } from 'react-router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LogoMark } from '@/components/brand/Logo';
import { brand } from '@/app/tokens';
import { useAIStore } from '@/ai';

const browsers = [
  { name: 'Chrome or Edge on a desktop', detail: 'Uses the AI built into the browser.' },
  {
    name: 'Safari on iPhone/iPad (iOS 26+) or Mac',
    detail: 'Runs a small open model with WebGPU.',
  },
  { name: 'Chrome on Android', detail: 'Runs a small open model with WebGPU.' },
];

/** Tier 3 (SPEC §5.1): there is no non-AI mode, so the app stops here. */
export function UnsupportedPage() {
  const reason = useAIStore((s) => s.error);
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: brand.surface,
        display: 'grid',
        placeItems: 'center',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 520, width: '100%' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2}>
            <LogoMark size={56} title="" aria-hidden />
            <Typography variant="h4" component="h1">
              This browser can&apos;t run FaceMango&apos;s AI
            </Typography>
            <Typography color="text.secondary">
              Every friend, like and comment on FaceMango comes from an AI that runs on your device.
              This browser has neither a built-in AI model nor WebGPU, so FaceMango can&apos;t work
              here.
            </Typography>
            {reason && (
              <Typography variant="body2" color="text.secondary">
                Details: {reason}
              </Typography>
            )}
            <Typography sx={{ fontWeight: 700 }}>Try one of these instead:</Typography>
            <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
              {browsers.map((b) => (
                <li key={b.name}>
                  <Typography sx={{ fontWeight: 600 }}>{b.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {b.detail}
                  </Typography>
                </li>
              ))}
            </Stack>
            <Button
              component={RouterLink}
              to="/about"
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            >
              About FaceMango
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
