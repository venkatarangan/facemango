import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfDay, startOfWeek, subDays } from 'date-fns';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { brand } from '@/app/tokens';
import { useUiStore } from '@/app/uiStore';
import { db, ME, type Mood } from '@/db';
import { totalReactions } from '@/lib/reactions';
import { useNow } from '@/lib/useNow';
import { recordMood } from '@/lib/mood';
import {
  compareWeeks,
  dailyMinutes,
  formatDuration,
  lateNightShare,
  MOOD_EMOJI,
  moodByDay,
  sumActive,
  usageHeatmap,
} from '@/lib/wellbeing';
import { saveWellbeingSettings, useWellbeingSettings } from '@/lib/wellbeingSettings';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOALS = [15, 30, 45, 60, 90, 120];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box
      sx={{ p: 1.5, borderRadius: 3, bgcolor: brand.surface, border: `1px solid ${brand.divider}` }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

/** Wellbeing (SPEC §3.9): a private usage tracker. Nothing here ever leaves the device. */
export function WellbeingPage() {
  const now = useNow();
  const settings = useWellbeingSettings();
  const showToast = useUiStore((s) => s.showToast);
  const since = subDays(startOfDay(now), 35).getTime();
  const sessionRows = useLiveQuery(
    () => db.usageSessions.where('startedAt').above(since).toArray(),
    [since, now],
  );
  const moodRows = useLiveQuery(() => db.moods.where('at').above(since).toArray(), [since]);
  const sessions = useMemo(() => sessionRows ?? [], [sessionRows]);
  const moods = useMemo(() => moodRows ?? [], [moodRows]);
  const activity = useLiveQuery(async () => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const [posts, comments, given] = await Promise.all([
      db.posts.where('authorId').equals(ME).toArray(),
      db.comments
        .where('authorId')
        .equals(ME)
        .filter((c) => c.createdAt > weekAgo)
        .count(),
      db.reactions.filter((r) => r.personaId === ME && r.createdAt > weekAgo).count(),
    ]);
    const recent = posts.filter((p) => p.createdAt > weekAgo);
    return {
      posts: recent.length,
      comments,
      given,
      received: recent.reduce((n, p) => n + totalReactions(p.reactionCounts), 0),
    };
  }, []);

  const todayMs = sumActive(sessions, startOfDay(now).getTime());
  const weekMs = sumActive(sessions, startOfWeek(now, { weekStartsOn: 1 }).getTime());
  const trend = useMemo(() => dailyMinutes(sessions, now), [sessions, now]);
  const heat = useMemo(() => usageHeatmap(sessions), [sessions]);
  const maxHeat = Math.max(1, ...heat.flat());
  const late = lateNightShare(sessions);
  const weeks = compareWeeks(sessions, now);
  const moodDays = useMemo(() => moodByDay(moods, sessions, now), [moods, sessions, now]);
  const sessionCount = sessions.filter((s) => s.startedAt > subDays(now, 7).getTime()).length;
  const avgSession = sessionCount
    ? sumActive(sessions, subDays(now, 7).getTime()) / sessionCount
    : 0;
  const depth = sessions.length
    ? Math.round(sessions.reduce((n, s) => n + (s.feedDepth ?? 0), 0) / sessions.length)
    : 0;
  const goal = settings.dailyGoalMinutes;
  const todayMin = Math.round(todayMs / 60_000);

  return (
    <Stack spacing={2}>
      <Box sx={{ px: { xs: 0.5, sm: 0 } }}>
        <Typography variant="h4" component="h1">
          Wellbeing
        </Typography>
        <Typography color="text.secondary">
          How you use FaceMango. Private: these stats never leave this device.
        </Typography>
      </Box>

      <Card component="section" aria-label="Time spent">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <Box
              sx={{ width: 150, height: 150, flexShrink: 0 }}
              aria-label={
                goal ? `${todayMin} of ${goal} minutes today` : `${todayMin} minutes today`
              }
            >
              <Gauge
                value={goal ? Math.min(todayMin, goal) : todayMin}
                valueMax={goal ?? Math.max(30, todayMin)}
                startAngle={0}
                endAngle={360}
                innerRadius="78%"
                outerRadius="100%"
                text={() => (goal ? `${todayMin}/${goal}m` : `${todayMin}m`)}
                sx={{
                  [`& .${gaugeClasses.valueArc}`]: {
                    fill: goal && todayMin >= goal ? '#E57373' : brand.mango,
                  },
                  [`& .${gaugeClasses.referenceArc}`]: { fill: '#F1F1F1' },
                  [`& .${gaugeClasses.valueText} text`]: { fontWeight: 800, fontSize: 20 },
                }}
              />
            </Box>
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                width: '100%',
              }}
            >
              <Stat label="Today" value={formatDuration(todayMs)} />
              <Stat label="This week" value={formatDuration(weekMs)} />
              <Stat label="Sessions (7 days)" value={String(sessionCount)} />
              <Stat label="Average session" value={formatDuration(avgSession)} />
            </Box>
          </Stack>
          {weeks.changePercent !== null && (
            <Typography sx={{ mt: 2 }}>
              Last week you spent <b>{formatDuration(weeks.lastWeekMs)}</b>,{' '}
              {Math.abs(weeks.changePercent)}% {weeks.changePercent <= 0 ? 'less' : 'more'} than the
              week before.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card component="section" aria-label="30-day trend">
        <CardContent>
          <Typography variant="h6" component="h2">
            Last 30 days
          </Typography>
          <BarChart
            height={220}
            xAxis={[
              {
                scaleType: 'band',
                data: trend.map((d) => format(d.day, 'd MMM')),
                tickInterval: (_v, i) => i % 5 === 0,
              },
            ]}
            yAxis={[{ label: 'minutes', min: 0, tickMinStep: 1 }]}
            series={[{ data: trend.map((d) => d.minutes), color: brand.mango, label: 'Minutes' }]}
            hideLegend
            margin={{ left: 8, right: 8 }}
          />
        </CardContent>
      </Card>

      <Card component="section" aria-label="When you use it">
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            When you use it
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '36px repeat(24, minmax(12px, 1fr))',
                gap: '3px',
                minWidth: 380,
              }}
              role="table"
              aria-label="Minutes by weekday and hour"
            >
              {heat.map((row, d) => (
                <Box key={d} sx={{ display: 'contents' }} role="row">
                  <Typography variant="caption" color="text.secondary" role="rowheader">
                    {DAYS[d]}
                  </Typography>
                  {row.map((m, h) => (
                    <Tooltip key={h} title={`${DAYS[d]} ${h}:00 · ${m} min`}>
                      <Box
                        role="cell"
                        aria-label={`${DAYS[d]} ${h}:00, ${m} minutes`}
                        sx={{
                          aspectRatio: '1',
                          borderRadius: '3px',
                          bgcolor: m
                            ? alpha(
                                h >= 22 || h < 5 ? '#7E57C2' : brand.mangoDeep,
                                0.2 + 0.8 * (m / maxHeat),
                              )
                            : '#F3F3F3',
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {late > 0.2
              ? `${Math.round(late * 100)}% of your time is late at night (10 pm–5 am, in purple). A screen-free hour before bed can help sleep.`
              : 'Purple squares show late-night use (10 pm–5 am).'}
          </Typography>
        </CardContent>
      </Card>

      <Card component="section" aria-label="What you do">
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            What you do · last 7 days
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
              gap: 1,
            }}
          >
            <Stat label="Posts" value={String(activity?.posts ?? 0)} />
            <Stat label="Comments written" value={String(activity?.comments ?? 0)} />
            <Stat label="Reactions received" value={String(activity?.received ?? 0)} />
            <Stat label="Reactions given" value={String(activity?.given ?? 0)} />
            <Stat label="Feed depth" value={String(depth)} hint="posts scrolled per session" />
          </Box>
        </CardContent>
      </Card>

      <Card component="section" aria-label="Mood">
        <CardContent>
          <Typography variant="h6" component="h2">
            Mood
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', my: 1 }}>
            <Typography>How do you feel right now?</Typography>
            {(Object.keys(MOOD_EMOJI) as Mood[]).map((m) => (
              <Box
                key={m}
                component="button"
                aria-label={`Feeling ${m}`}
                onClick={() =>
                  void recordMood(m).then(() => showToast('Mood saved. Thanks for checking in. 💛'))
                }
                sx={{
                  fontSize: 28,
                  border: 0,
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 2,
                  '&:hover': { bgcolor: brand.surface },
                }}
              >
                {MOOD_EMOJI[m]}
              </Box>
            ))}
          </Stack>
          {moods.length > 0 ? (
            <LineChart
              height={220}
              xAxis={[{ scaleType: 'point', data: moodDays.map((d) => format(d.day, 'd MMM')) }]}
              yAxis={[
                { id: 'mood', min: 1, max: 3, label: 'mood (1–3)' },
                { id: 'minutes', position: 'right', label: 'minutes', min: 0, tickMinStep: 1 },
              ]}
              series={[
                {
                  data: moodDays.map((d) => d.mood),
                  yAxisId: 'mood',
                  label: 'Mood',
                  color: '#7E57C2',
                  connectNulls: true,
                },
                {
                  data: moodDays.map((d) => d.minutes),
                  yAxisId: 'minutes',
                  label: 'Minutes',
                  color: brand.mango,
                },
              ]}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Check in a few times to see how your mood relates to time spent here.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card component="section" aria-label="Wellbeing settings">
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            Settings
          </Typography>
          <Stack spacing={2}>
            <TextField
              select
              label="Daily goal"
              value={goal ?? 0}
              onChange={(e) =>
                void saveWellbeingSettings({ dailyGoalMinutes: Number(e.target.value) || null })
              }
              helperText="A gentle, non-blocking reminder when you pass it."
              sx={{ maxWidth: 280 }}
            >
              <MenuItem value={0}>No goal</MenuItem>
              {GOALS.map((g) => (
                <MenuItem key={g} value={g}>
                  {formatDuration(g * 60_000)} a day
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.moodCheckIns}
                  onChange={(e) => void saveWellbeingSettings({ moodCheckIns: e.target.checked })}
                />
              }
              label="Ask how I feel after a while"
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
