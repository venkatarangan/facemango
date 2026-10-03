import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded';
import EmojiEmotionsRounded from '@mui/icons-material/EmojiEmotionsRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { brand } from '@/app/tokens';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db, ME, type Post } from '@/db';
import { useEngineStore } from '@/engine/store';
import { ComposerDialog } from '@/features/compose/ComposerDialog';
import { SetupCard } from '@/features/ai/SetupCard';
import { WeeklySummaryCard } from '@/features/wellbeing/WeeklySummaryCard';
import { postingStreak } from '@/lib/streak';
import { firstName } from '@/lib/text';
import { useNow } from '@/lib/useNow';
import { BackupReminderCard } from './cards/BackupReminderCard';
import { BestPostCard } from './cards/BestPostCard';
import { DailyIdeaCard } from './cards/DailyIdeaCard';
import { IosBanner } from './cards/IosBanner';
import { FeedList } from './FeedList';
import { useAuthors } from './useAuthors';

function AwayBanner() {
  const summary = useEngineStore((s) => s.awaySummary);
  if (!summary) return null;
  const parts = [
    summary.reactions && `${summary.reactions} reaction${summary.reactions === 1 ? '' : 's'}`,
    summary.comments && `${summary.comments} comment${summary.comments === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return (
    <Alert
      icon={<span aria-hidden>🥭</span>}
      severity="info"
      onClose={() => useEngineStore.setState({ awaySummary: null })}
      sx={{ borderRadius: 3, bgcolor: alpha(brand.mango, 0.18), color: brand.ink, fontWeight: 600 }}
    >
      While you were away: {parts.join(', ')}
    </Alert>
  );
}

export function HomePage() {
  const authors = useAuthors();
  const now = useNow();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [prefill, setPrefill] = useState<string | undefined>();
  const setupDone = useEngineStore((s) => s.setup.stage === 'done');
  const myPostTimes = useLiveQuery(
    async () => (await db.posts.where('authorId').equals(ME).toArray()).map((p) => p.createdAt),
    [],
  );
  const me = authors?.get(ME);
  if (!authors || !me) return null;

  // Low-key posting streak (SPEC §8 #12).
  const streak = postingStreak(myPostTimes ?? [], now);
  const openComposer = (text?: string) => {
    setEditing(null);
    setPrefill(text);
    setComposerOpen(true);
  };

  return (
    <Stack spacing={2}>
      <Card component="section" aria-label="Create a post">
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <AuthorAvatar author={me} />
            <ButtonBase
              onClick={() => openComposer()}
              sx={{
                flex: 1,
                justifyContent: 'flex-start',
                px: 2,
                py: 1.25,
                borderRadius: 999,
                bgcolor: brand.surface,
                border: `1px solid ${brand.divider}`,
                color: 'text.secondary',
                font: 'inherit',
                fontSize: '1rem',
                textAlign: 'left',
                '&:hover': { bgcolor: '#F2F2F2' },
              }}
            >
              What&apos;s on your mind, {firstName(me.name)}?
            </ButtonBase>
            {streak >= 2 && (
              <Tooltip title={`You've posted ${streak} days in a row`}>
                <Chip
                  label={`🔥 ${streak}`}
                  size="small"
                  aria-label={`${streak}-day posting streak`}
                />
              </Tooltip>
            )}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-around',
              '& .MuiButton-root': { whiteSpace: 'nowrap', px: { xs: 1, sm: 2.5 } },
            }}
          >
            <Button
              startIcon={<AddPhotoAlternateRounded sx={{ color: '#43A047' }} />}
              onClick={() => openComposer()}
            >
              Photo
            </Button>
            <Button
              startIcon={<EmojiEmotionsRounded sx={{ color: brand.mangoText }} />}
              onClick={() => openComposer()}
            >
              Feeling
            </Button>
            <Button
              startIcon={<AutoAwesomeRounded sx={{ color: brand.mangoText }} />}
              onClick={() => openComposer()}
            >
              Mango AI
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <AwayBanner />
      <SetupCard />
      <IosBanner />
      <BackupReminderCard />
      <WeeklySummaryCard />
      {setupDone && <DailyIdeaCard onUse={(idea) => openComposer(`${idea}\n\n`)} />}
      <BestPostCard />

      {setupDone && myPostTimes?.length === 0 && (
        <Card
          sx={{
            borderColor: alpha(brand.mango, 0.6),
            background: `linear-gradient(135deg, ${alpha(brand.mango, 0.22)}, #fff 75%)`,
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" component="h2">
              Your friends are here, {firstName(me.name)} 👋
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
              Share your first post and see who reacts first.
            </Typography>
            <Button variant="contained" onClick={() => openComposer()}>
              Write your first post
            </Button>
          </CardContent>
        </Card>
      )}

      <FeedList
        authors={authors}
        onEdit={(post) => {
          setEditing(post);
          setComposerOpen(true);
        }}
      />

      <ComposerDialog
        key={editing?.id ?? `new-${prefill ?? ''}`}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        me={me}
        editing={editing}
        initialText={prefill}
      />
    </Stack>
  );
}
