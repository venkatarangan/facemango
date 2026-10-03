import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { brand } from '@/app/tokens';
import { loadPhotoManifest, packPhotoUrl, type PackPhoto } from '@/lib/photos';

/** Credits for bundled media (SPEC §4.5: listed even though CC0 doesn't require it). */
export function CreditsPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PackPhoto[]>([]);
  useEffect(() => {
    void loadPhotoManifest().then(setPhotos);
  }, []);
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: brand.surface, pt: 'env(safe-area-inset-top)' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 5 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <IconButton aria-label="Back" onClick={() => navigate(-1)} edge="start">
            <ArrowBackRounded />
          </IconButton>
          <Typography variant="h5" component="h1">
            Credits
          </Typography>
        </Stack>
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Artwork
              </Typography>
              <Typography variant="body2">
                Avatars: “Personas” by{' '}
                <Link href="https://draftbit.com/" target="_blank" rel="noreferrer">
                  Draftbit
                </Link>
                , via{' '}
                <Link href="https://www.dicebear.com/" target="_blank" rel="noreferrer">
                  DiceBear
                </Link>
                , licensed{' '}
                <Link
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </Link>
                . Remixed.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Reaction animations:{' '}
                <Link
                  href="https://googlefonts.github.io/noto-emoji-animation/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Noto Animated Emoji
                </Link>{' '}
                by Google, licensed{' '}
                <Link
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </Link>
                .
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Photos ({photos.length})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Friends&apos; photos come from a bundled pack of public-domain and CC0 images,
                mostly from Wikimedia Commons.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                {photos.map((p) => (
                  <Stack
                    key={p.id}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: 'center', minWidth: 0 }}
                  >
                    <Box
                      component="img"
                      src={packPhotoUrl(p)}
                      alt={p.alt}
                      loading="lazy"
                      sx={{
                        width: 64,
                        height: 48,
                        objectFit: 'cover',
                        borderRadius: 1.5,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap title={p.alt}>
                        {p.alt}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        <Link href={p.source} target="_blank" rel="noreferrer" color="inherit">
                          {p.author || 'Unknown author'}
                        </Link>{' '}
                        ·{' '}
                        <Link href={p.licenseUrl} target="_blank" rel="noreferrer" color="inherit">
                          {p.license}
                        </Link>
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
