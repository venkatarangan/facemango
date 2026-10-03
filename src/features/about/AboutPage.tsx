import type { ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { Logo } from '@/components/brand/Logo';
import { brand } from '@/app/tokens';
import { BYLINE, IOS_DATA_NOTICE, SOURCE_URL, UNIQUENESS } from '@/lib/copy';

const steps = [
  'Tell FaceMango a little about yourself: your name, age, city and languages.',
  'Your browser gets a small AI model. Chrome and Edge have one built in; other browsers download one once.',
  'The AI imagines 20–30 friends and a wider circle of people around you. They post, react and comment on what you share.',
  'Everything stays in this browser. Back it up whenever you like.',
];

const privacy = [
  'No account and no servers: your posts, photos, friends and stats are stored only on this device.',
  'The AI runs on your device. Nothing you write is sent to it over the internet.',
  'The only downloads are the AI model (from your browser or Hugging Face) and the app itself.',
  'Google Analytics counts page views, and nothing else. It never sees your posts, profile or stats.',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" aria-label={title}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

const List = ({ items, ordered }: { items: string[]; ordered?: boolean }) => (
  <Box component={ordered ? 'ol' : 'ul'} sx={{ pl: 2.5, m: 0, display: 'grid', gap: 0.75 }}>
    {items.map((item) => (
      <Typography component="li" key={item}>
        {item}
      </Typography>
    ))}
  </Box>
);

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
              <Typography sx={{ fontWeight: 600 }}>{BYLINE}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                A cosy, Facebook-style feed where friends cheer you on. The twist: every friend is
                imagined by AI, and they are not real people.
              </Typography>
            </CardContent>
          </Card>
          <Section title="What makes it different">
            <Typography>{UNIQUENESS}</Typography>
          </Section>
          <Section title="How it works">
            <List items={steps} ordered />
          </Section>
          <Section title="Your privacy">
            <List items={privacy} />
          </Section>
          <Section title="Keep your data safe">
            <Typography>
              Clearing your browser data removes FaceMango. Download a backup now and then from
              Settings → Backup &amp; restore.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {IOS_DATA_NOTICE}
            </Typography>
          </Section>
          <Section title="The fine print">
            <Typography color="text.secondary">
              For ages 13 and up. Free and open source (AGPL-3.0).
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
              <Link
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                sx={{ fontWeight: 600, color: 'text.primary' }}
              >
                Source code
              </Link>
              <Link
                component={RouterLink}
                to="/credits"
                sx={{ fontWeight: 600, color: 'text.primary' }}
              >
                Credits
              </Link>
            </Stack>
          </Section>
        </Stack>
      </Container>
    </Box>
  );
}
