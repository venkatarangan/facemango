import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import LockRounded from '@mui/icons-material/LockRounded';
import MemoryRounded from '@mui/icons-material/MemoryRounded';
import SaveAltRounded from '@mui/icons-material/SaveAltRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { brand } from '@/app/tokens';
import { isIOS } from '@/lib/platform';
import { requestPersistentStorage } from '@/lib/storage';
import { IosDataNotice } from './IosDataNotice';
import { PreviewPost } from './PreviewPost';

const highlights = [
  {
    icon: <LockRounded />,
    title: 'Private by design',
    body: 'No servers, no accounts. Your posts and photos never leave this device.',
  },
  {
    icon: <MemoryRounded />,
    title: 'AI friends, on your device',
    body: 'Friends, likes and comments are simulated by AI that runs right in your browser.',
  },
  {
    icon: <SaveAltRounded />,
    title: 'Yours to keep',
    body: 'Export everything to Markdown and images whenever you like, and restore it anywhere.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [ios] = useState(() => isIOS());

  const getStarted = () => {
    // persist() must run inside the user gesture on some browsers; don't wait for it.
    void requestPersistentStorage();
    navigate('/signup');
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: `radial-gradient(1200px 600px at 85% -10%, ${alpha(brand.mango, 0.22)}, transparent 60%), ${brand.background}`,
        pt: 'env(safe-area-inset-top)',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
            gap: { xs: 5, md: 8 },
            alignItems: 'center',
          }}
        >
          <Stack spacing={3} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' } }}
            >
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <LogoMark size={64} title="" aria-hidden />
              </motion.div>
              <Wordmark size={36} />
            </Stack>
            <Typography
              variant="h2"
              component="h1"
              sx={{ fontSize: { xs: '2.25rem', sm: '3rem', md: '3.5rem' }, lineHeight: 1.08 }}
            >
              A social network that is{' '}
              <Box component="span" sx={{ position: 'relative', whiteSpace: 'nowrap' }}>
                <Box
                  component="span"
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    insetInline: -4,
                    bottom: '0.08em',
                    height: '0.38em',
                    bgcolor: alpha(brand.mango, 0.55),
                    borderRadius: 1,
                    zIndex: 0,
                  }}
                />
                <Box component="span" sx={{ position: 'relative' }}>
                  entirely yours.
                </Box>
              </Box>
            </Typography>
            <Typography
              variant="h6"
              component="p"
              color="text.secondary"
              sx={{ fontWeight: 400, maxWidth: 560, mx: { xs: 'auto', md: 0 } }}
            >
              Your posts, photos and friends live only on your device. Every friend, like and
              comment is simulated by AI running right here in your browser.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ justifyContent: { xs: 'center', md: 'flex-start' } }}
            >
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRounded />}
                onClick={getStarted}
              >
                Get started
              </Button>
              <Button variant="outlined" size="large" component={RouterLink} to="/about">
                How it works
              </Button>
            </Stack>
            {ios && (
              <Box sx={{ maxWidth: 560, mx: { xs: 'auto', md: 0 }, textAlign: 'left' }}>
                <IosDataNotice />
              </Box>
            )}
          </Stack>
          <PreviewPost />
        </Box>

        <Box
          component="section"
          aria-label="Highlights"
          sx={{
            mt: { xs: 6, md: 10 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {highlights.map((h) => (
            <Stack
              key={h.title}
              spacing={1}
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: brand.surface,
                border: `1px solid ${brand.divider}`,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 3,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: brand.mango,
                  color: brand.ink,
                }}
                aria-hidden
              >
                {h.icon}
              </Box>
              <Typography variant="h6" component="h2">
                {h.title}
              </Typography>
              <Typography color="text.secondary">{h.body}</Typography>
            </Stack>
          ))}
        </Box>

        <Typography
          component="footer"
          variant="body2"
          color="text.secondary"
          sx={{ mt: 6, textAlign: 'center' }}
        >
          Friends on FaceMango are simulated, not real people. ·{' '}
          <Link component={RouterLink} to="/about" color="inherit">
            Privacy & about
          </Link>{' '}
          · Open source (AGPL-3.0)
        </Typography>
      </Container>
    </Box>
  );
}
