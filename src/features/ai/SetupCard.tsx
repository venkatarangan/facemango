import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import { alpha } from '@mui/material/styles';
import { startAI, useAIStore } from '@/ai';
import { brand } from '@/app/tokens';
import { useEngineStore, type SetupStage } from '@/engine/store';

type StepState = 'done' | 'active' | 'todo';

function Step({
  state,
  label,
  detail,
  progress,
}: {
  state: StepState;
  label: string;
  detail?: string;
  progress?: number;
}) {
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        {state === 'done' ? (
          <CheckCircleRounded sx={{ color: 'success.main' }} fontSize="small" />
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
        {detail && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto !important' }}>
            {detail}
          </Typography>
        )}
      </Stack>
      {state === 'active' && progress !== undefined && (
        <LinearProgress
          variant={progress < 0 ? 'indeterminate' : 'determinate'}
          value={Math.max(0, progress) * 100}
          sx={{ height: 6, borderRadius: 3, ml: '32px !important' }}
        />
      )}
    </Stack>
  );
}

const ORDER: SetupStage[] = ['waiting-for-ai', 'friends', 'public', 'seed', 'done'];

/**
 * First-run progress on the home feed. A richer "setup experience" is planned
 * (see the parked design in the project notes); this is the M2–M4 baseline.
 */
export function SetupCard() {
  const ai = useAIStore();
  const setup = useEngineStore((s) => s.setup);
  if (setup.stage === 'done' && ai.status === 'ready') return null;

  const stageIndex = ORDER.indexOf(setup.stage);
  const stateOf = (stage: SetupStage): StepState => {
    const i = ORDER.indexOf(stage);
    return i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'todo';
  };
  const aiState: StepState = ai.status === 'ready' ? 'done' : 'active';
  const count = (stage: SetupStage) =>
    stateOf(stage) === 'active' && setup.total ? `${setup.done} of ${setup.total}` : undefined;
  const fraction = setup.total ? setup.done / setup.total : -1;

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
          Everything is generated on this device, so the first setup takes a few minutes. You can
          look around meanwhile.
        </Typography>
        <Stack spacing={1.5} role="status" aria-live="polite">
          <Step
            state={aiState}
            label={
              ai.status === 'ready'
                ? `On-device AI ready · ${ai.modelLabel ?? ''}`
                : 'Setting up on-device AI'
            }
            detail={ai.status === 'downloading' ? `${Math.round(ai.progress * 100)}%` : undefined}
            progress={
              ai.status === 'downloading' ? ai.progress : ai.status === 'detecting' ? -1 : undefined
            }
          />
          {ai.status === 'downloading' && ai.progressText && (
            <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }} noWrap>
              {ai.progressText}
            </Typography>
          )}
          {ai.status === 'needs-gesture' && (
            <Button
              variant="contained"
              onClick={() => void startAI({ userGesture: true })}
              sx={{ alignSelf: 'flex-start', ml: 4 }}
            >
              Continue setup
            </Button>
          )}
          {ai.status === 'error' && (
            <Stack spacing={1} sx={{ pl: 4 }}>
              <Typography variant="body2" color="error">
                {ai.error}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => void startAI({ userGesture: true })}
                sx={{ alignSelf: 'flex-start' }}
              >
                Try again
              </Button>
            </Stack>
          )}
          <Step
            state={aiState === 'done' ? stateOf('friends') : 'todo'}
            label="Finding your friends"
            detail={count('friends')}
            progress={fraction}
          />
          <Step
            state={aiState === 'done' ? stateOf('public') : 'todo'}
            label="Meeting people around you"
            detail={count('public')}
            progress={fraction}
          />
          <Step
            state={aiState === 'done' ? stateOf('seed') : 'todo'}
            label="Writing their first posts"
            detail={count('seed')}
            progress={fraction}
          />
          {setup.error && (
            <Typography variant="body2" color="error">
              {setup.error}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
