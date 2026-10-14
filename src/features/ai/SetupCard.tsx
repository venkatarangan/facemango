import { useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import LightbulbRounded from '@mui/icons-material/LightbulbRounded';
import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import { alpha } from '@mui/material/styles';
import { downloadSizeMB, formatMB, formatTimeLeft, startAI, useAIStore } from '@/ai';
import { brand } from '@/app/tokens';
import { runSetup } from '@/engine/onboarding';
import { useEngineStore } from '@/engine/store';
import { isIOS } from '@/lib/platform';
import { useNow } from '@/lib/useNow';
import {
  currentStep,
  friendsProgress,
  isSlowDownload,
  nextTipIndex,
  SETUP_STEPS,
  setupTips,
  STEP_LABELS,
  stepState,
  TIP_INTERVAL_MS,
  type StepState,
} from './setupExperience';

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

function Step({
  state,
  label,
  detail,
  progress,
  children,
}: {
  state: StepState;
  label: string;
  detail?: string;
  /** 0..1, or -1 for an indeterminate bar. Shown only while active. */
  progress?: number;
  children?: ReactNode;
}) {
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        {state === 'done' ? (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            style={{ display: 'inline-flex' }}
          >
            <CheckCircleRounded sx={{ color: 'success.main' }} fontSize="small" />
          </motion.span>
        ) : (
          <RadioButtonUncheckedRounded
            fontSize="small"
            sx={{ color: state === 'active' ? brand.mangoText : 'text.disabled' }}
          />
        )}
        <Typography
          sx={{
            fontWeight: state === 'active' ? 700 : 500,
            color: state === 'todo' ? 'text.secondary' : 'text.primary',
          }}
        >
          {label}
        </Typography>
        {state === 'active' && detail && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important' }}>
            {detail}
          </Typography>
        )}
      </Stack>
      {state === 'active' && progress !== undefined && (
        <LinearProgress
          variant={progress < 0 ? 'indeterminate' : 'determinate'}
          value={Math.max(0, progress) * 100}
          aria-label={label}
          sx={{ height: 6, borderRadius: 3, ml: '32px !important' }}
        />
      )}
      {state === 'active' && children && <Box sx={{ pl: 4 }}>{children}</Box>}
    </Stack>
  );
}

/** One short tip at a time. Rotates on its own unless the user prefers reduced motion. */
function Tips() {
  const reduceMotion = useReducedMotion();
  const [tips] = useState(() => setupTips({ ios: isIOS() }));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduceMotion || paused) return;
    const timer = setInterval(() => setIndex((i) => nextTipIndex(i, tips.length)), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, paused, tips.length]);

  return (
    <Stack
      direction="row"
      spacing={1.25}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      sx={{
        alignItems: 'flex-start',
        p: 1.5,
        borderRadius: 2,
        bgcolor: alpha('#FFFFFF', 0.8),
        border: `1px solid ${brand.divider}`,
      }}
    >
      <LightbulbRounded sx={{ color: brand.mangoText, mt: 0.25 }} fontSize="small" />
      <Box sx={{ flex: 1, minHeight: { xs: '4.3em', sm: '2.9em' } }} data-testid="setup-tip">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <Typography variant="body2">{tips[index]}</Typography>
          </motion.div>
        </AnimatePresence>
      </Box>
      <IconButton
        size="small"
        aria-label="Next tip"
        onClick={() => setIndex((i) => nextTipIndex(i, tips.length))}
        sx={{ mt: -0.5 }}
      >
        <NavigateNextRounded fontSize="small" />
      </IconButton>
    </Stack>
  );
}

/**
 * The first-run wait on the home feed (SPEC §3.1): plain-language stages with real progress and
 * a rough time left, rotating tips, and a couple of things to do meanwhile.
 */
export function SetupCard({ onWritePost }: { onWritePost?: () => void }) {
  const ai = useAIStore();
  const setup = useEngineStore((s) => s.setup);
  const now = useNow();
  if (setup.stage === 'done' && ai.status === 'ready') return null;

  const current = currentStep(ai.status, ai.phase, setup.stage);
  const downloading = ai.status === 'downloading';
  const size = ai.tier === 'webgpu' ? downloadSizeMB(ai.progressText, ai.progress) : undefined;
  const timeLeft = ai.progress < 0.98 ? formatTimeLeft(ai.secondsLeft) : undefined;
  const friends = friendsProgress(setup);
  // Only the active step shows these, so the download and wake steps can share them.
  const aiBar =
    ai.status === 'detecting' || (downloading && ai.progress <= 0)
      ? -1
      : downloading
        ? ai.progress
        : undefined;
  const aiPercent =
    downloading && ai.progress > 0 ? `${Math.round(ai.progress * 100)}%` : undefined;

  const intro =
    ai.status === 'ready'
      ? 'Your AI is now creating your friends and their first posts, right here on this device.'
      : ai.tier === 'prompt-api'
        ? 'Your browser is getting its built-in AI ready. It downloads once and stays on this device.'
        : 'FaceMango is fetching a small AI model (about 1–2 GB) so everything runs on this device. It downloads once and stays here.';

  const aiTrouble =
    ai.status === 'needs-gesture' ? (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2" color="text.secondary">
          Your browser needs one tap to start the download.
        </Typography>
        <Button variant="contained" onClick={() => void startAI({ userGesture: true })}>
          Continue setup
        </Button>
      </Stack>
    ) : ai.status === 'error' ? (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2" color="error">
          {current === 'download' ? 'The download stopped' : "Your AI couldn't start"}: {ai.error}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {current === 'download'
            ? 'Check your connection, then try again. Anything already downloaded is kept.'
            : 'Closing other tabs can free up memory. Then try again.'}
        </Typography>
        <Button variant="outlined" onClick={() => void startAI({ userGesture: true })}>
          Try again
        </Button>
      </Stack>
    ) : null;

  return (
    <Card
      component="section"
      aria-label="Setting up FaceMango"
      sx={{
        borderColor: alpha(brand.mango, 0.6),
        background: `linear-gradient(135deg, ${alpha(brand.mango, 0.14)}, #fff 70%)`,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="h6" component="h2">
          Building your world
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {intro}
        </Typography>
        <Box role="status" aria-live="polite" sx={visuallyHidden}>
          {current === 'done'
            ? STEP_LABELS.friends.done
            : `Step ${SETUP_STEPS.indexOf(current) + 1} of 3: ${STEP_LABELS[current].active}`}
        </Box>
        <Stack spacing={1.5}>
          <Step
            state={stepState('download', current)}
            label={
              STEP_LABELS.download[stepState('download', current) === 'done' ? 'done' : 'active']
            }
            detail={aiPercent}
            progress={aiBar}
          >
            <Stack spacing={1}>
              {(size || timeLeft) && (
                <Typography variant="caption" color="text.secondary">
                  {[size && `${formatMB(size.loaded)} of ${formatMB(size.total)}`, timeLeft]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              )}
              {isSlowDownload(ai, now) && (
                <Typography variant="body2" color="text.secondary" data-testid="slow-download">
                  Slow connection? That&apos;s fine. Leave this tab open or come back later;
                  anything already downloaded is kept.
                </Typography>
              )}
              {aiTrouble}
            </Stack>
          </Step>
          <Step
            state={stepState('wake', current)}
            label={STEP_LABELS.wake[stepState('wake', current) === 'done' ? 'done' : 'active']}
            detail={aiPercent}
            progress={aiBar}
          >
            {aiTrouble}
          </Step>
          <Step
            state={stepState('friends', current)}
            label={STEP_LABELS.friends.active}
            detail={friends.count}
            progress={setup.total ? friends.fraction : -1}
          >
            <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="caption" color="text.secondary">
                {friends.label}
              </Typography>
              {setup.error && (
                <>
                  <Typography variant="body2" color="error">
                    {setup.error}
                  </Typography>
                  <Button variant="outlined" onClick={() => void runSetup()}>
                    Try again
                  </Button>
                </>
              )}
            </Stack>
          </Step>
        </Stack>

        <Box sx={{ mt: 2.5 }}>
          <Tips />
        </Box>

        <Typography variant="overline" component="p" color="text.secondary" sx={{ mt: 2 }}>
          While you wait
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {onWritePost && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditRounded />}
              onClick={onWritePost}
            >
              Write a post
            </Button>
          )}
          <Button size="small" component={RouterLink} to="/wellbeing">
            Set a daily goal
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Anything you post now waits for your friends to arrive.
        </Typography>
      </CardContent>
    </Card>
  );
}
