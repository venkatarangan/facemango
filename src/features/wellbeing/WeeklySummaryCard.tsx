import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { Link as RouterLink } from 'react-router';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { db } from '@/db';
import { getMeta, setMeta } from '@/engine/settings';
import { compareWeeks, formatDuration } from '@/lib/wellbeing';
import { useNow } from '@/lib/useNow';

/** Monday's weekly summary card in the feed (SPEC §3.9). */
export function WeeklySummaryCard() {
  const now = useNow();
  const weekKey = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const data = useLiveQuery(async () => {
    if (new Date().getDay() !== 1) return null;
    if ((await getMeta<string | null>('weeklySummaryDismissed', null)) === weekKey) return null;
    const since = subWeeks(startOfWeek(Date.now(), { weekStartsOn: 1 }), 2).getTime();
    const sessions = await db.usageSessions.where('startedAt').above(since).toArray();
    const weeks = compareWeeks(sessions, Date.now());
    return weeks.lastWeekMs > 60_000 ? weeks : null;
  }, [weekKey]);
  if (!data) return null;
  return (
    <Card component="section" aria-label="Your week">
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
          <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
            🌿 Your week on FaceMango
          </Typography>
          <IconButton
            size="small"
            aria-label="Dismiss"
            onClick={() => void setMeta('weeklySummaryDismissed', weekKey)}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
        <Typography sx={{ my: 1 }}>
          You spent <b>{formatDuration(data.lastWeekMs)}</b> on FaceMango last week
          {data.changePercent !== null
            ? `, ${Math.abs(data.changePercent)}% ${data.changePercent <= 0 ? 'less' : 'more'} than the week before`
            : ''}
          .
        </Typography>
        <Button component={RouterLink} to="/wellbeing">
          See your wellbeing
        </Button>
      </CardContent>
    </Card>
  );
}
