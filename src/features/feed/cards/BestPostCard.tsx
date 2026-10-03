import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek } from 'date-fns';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { Link as RouterLink } from 'react-router';
import { brand } from '@/app/tokens';
import { db, ME } from '@/db';
import { setMeta } from '@/engine/settings';
import { formatCount, totalReactions } from '@/lib/reactions';
import { useNow } from '@/lib/useNow';

/** "🏆 Your best post this week" (SPEC §8 #6). */
export function BestPostCard() {
  const now = useNow();
  const week = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const best = useLiveQuery(async () => {
    if ((await db.meta.get('bestPostDismissed'))?.value === week) return null;
    const since = Date.now() - 7 * 86_400_000;
    const mine = (await db.posts.where('authorId').equals(ME).toArray()).filter(
      (p) => p.createdAt > since,
    );
    if (mine.length < 2) return null;
    const top = mine.sort(
      (a, b) => totalReactions(b.reactionCounts) - totalReactions(a.reactionCounts),
    )[0]!;
    return totalReactions(top.reactionCounts) >= 5 ? top : null;
  }, [week]);
  if (!best) return null;
  return (
    <Card
      component="section"
      aria-label="Your best post this week"
      sx={{ background: `linear-gradient(135deg, ${alpha(brand.mango, 0.25)}, #fff 70%)` }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
          <Typography variant="subtitle1" component="h2" sx={{ flex: 1, fontWeight: 800 }}>
            🏆 Your best post this week
          </Typography>
          <IconButton
            size="small"
            aria-label="Dismiss"
            onClick={() => void setMeta('bestPostDismissed', week)}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
        <Typography sx={{ my: 0.5 }}>“{best.text.slice(0, 120) || 'Your photo'}”</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatCount(totalReactions(best.reactionCounts))} reactions · {best.commentCount}{' '}
          comments ·{' '}
          <Link component={RouterLink} to={`/post/${best.id}`} color="inherit">
            See it
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
