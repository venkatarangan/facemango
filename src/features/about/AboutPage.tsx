import { useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { Logo } from '@/components/brand/Logo';
import { brand } from '@/app/tokens';
import { IOS_DATA_NOTICE, PRIVACY_STATEMENT, SIMULATED_FRIENDS_NOTE } from '@/lib/copy';

const howItWorks = [
  'You sign up with a name, age, city and languages. That profile stays in this browser.',
  'FaceMango runs an AI model on your device: Chrome and Edge provide one built in; other browsers download a small open model from Hugging Face once.',
  'The AI invents 20–30 friends and a wider circle of public profiles who post, react and comment.',
  'Everything is stored in IndexedDB on this device. Export a backup to Markdown and images at any time.',
];

export function AboutPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: brand.surface, pt: 'env(safe-area-inset-top)' }}>
      <Container maxWidth="sm" sx={{ py: { xs: 2, sm: 5 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <IconButton aria-label="Back" onClick={() => navigate(-1)} edge="start">
            <ArrowBackRounded />
          </IconButton>
          <Logo size={26} />
        </Stack>
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="h1" gutterBottom>
                About FaceMango
              </Typography>
              <Typography color="text.secondary">{SIMULATED_FRIENDS_NOTE}</Typography>
            </CardContent>
          </Card>
          <Card component="section">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                How it works
              </Typography>
              <Box component="ol" sx={{ pl: 2.5, m: 0, display: 'grid', gap: 1 }}>
                {howItWorks.map((step) => (
                  <Typography component="li" key={step}>
                    {step}
                  </Typography>
                ))}
              </Box>
            </CardContent>
          </Card>
          <Card component="section">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Privacy
              </Typography>
              <Typography>{PRIVACY_STATEMENT}</Typography>
              <Typography sx={{ mt: 1.5 }} color="text.secondary">
                {IOS_DATA_NOTICE}
              </Typography>
            </CardContent>
          </Card>
          <Card component="section">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Open source
              </Typography>
              <Typography color="text.secondary">
                FaceMango is free software under the GNU Affero General Public License v3.0. You
                must be 13 or older to use it.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
