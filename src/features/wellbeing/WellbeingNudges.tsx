import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { startOfDay } from 'date-fns';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Slide from '@mui/material/Slide';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { db, type Mood } from '@/db';
import { getMeta, setMeta } from '@/engine/settings';
import { useUiStore } from '@/app/uiStore';
import { recordMood } from '@/lib/mood';
import { currentSessionActiveMs, currentSessionId } from '@/lib/usage';
import { MOOD_EMOJI, sumActive } from '@/lib/wellbeing';
import { getWellbeingSettings } from '@/lib/wellbeingSettings';

const MOOD_AFTER_MS = 10 * 60_000;
const CHECK_EVERY_MS = 30_000;

/**
 * Gentle, non-blocking wellbeing prompts (SPEC §3.9): a one-tap mood check-in after a while in
 * a session, and a single reminder per day when the optional daily goal is passed.
 */
export function WellbeingNudges() {
  const [askMood, setAskMood] = useState(false);
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    const timer = setInterval(async () => {
      const settings = await getWellbeingSettings();
      const session = currentSessionId();
      if (settings.moodCheckIns && session && currentSessionActiveMs() > MOOD_AFTER_MS) {
        const asked = await getMeta<string | null>('moodAskedSession', null);
        if (asked !== session) {
          await setMeta('moodAskedSession', session);
          setAskMood(true);
        }
      }
      if (settings.dailyGoalMinutes) {
        const today = format(Date.now(), 'yyyy-MM-dd');
        const sessions = await db.usageSessions
          .where('startedAt')
          .above(startOfDay(Date.now()).getTime())
          .toArray();
        const minutes = (sumActive(sessions, 0) + currentSessionActiveMs()) / 60_000;
        if (
          minutes >= settings.dailyGoalMinutes &&
          (await getMeta<string | null>('goalNudgedOn', null)) !== today
        ) {
          await setMeta('goalNudgedOn', today);
          showToast(
            `You've reached your ${settings.dailyGoalMinutes}-minute goal for today. Maybe time for a break? 🌿`,
          );
        }
      }
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [showToast]);

  const pick = (mood: Mood) => {
    void recordMood(mood);
    setAskMood(false);
    showToast('Thanks for checking in. 💛');
  };

  return (
    <Slide direction="up" in={askMood} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        role="dialog"
        aria-label="Mood check-in"
        sx={{
          position: 'fixed',
          zIndex: 1300,
          left: '50%',
          transform: 'translateX(-50%) !important',
          bottom: { xs: 'calc(84px + env(safe-area-inset-bottom))', md: 24 },
          borderRadius: 4,
          px: 2,
          py: 1.25,
          width: 'min(92vw, 380px)',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 600, flex: 1 }}>How do you feel?</Typography>
          {(Object.keys(MOOD_EMOJI) as Mood[]).map((m) => (
            <Box
              key={m}
              component="button"
              aria-label={`Feeling ${m}`}
              onClick={() => pick(m)}
              sx={{ fontSize: 26, border: 0, bgcolor: 'transparent', cursor: 'pointer', p: 0.5 }}
            >
              {MOOD_EMOJI[m]}
            </Box>
          ))}
          <IconButton size="small" aria-label="Dismiss" onClick={() => setAskMood(false)}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>
    </Slide>
  );
}
