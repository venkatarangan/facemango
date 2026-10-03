import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { useProfile } from '@/app/useProfile';
import { useUiStore } from '@/app/uiStore';
import {
  defaultEngagementConfig,
  engagementConfigSchema,
  type EngagementConfig,
} from '@/engine/config';
import { ADULT_AGE, MAX_COMMENTS_PER_POST, MAX_LIKES_PER_POST } from '@/engine/limits';
import { setMixValue } from '@/engine/mix';
import { getEngagementConfig, saveEngagementConfig } from '@/engine/settings';

const SPEEDS = [
  { value: 0.5, label: 'Relaxed (half speed)' },
  { value: 1, label: 'Normal' },
  { value: 3, label: 'Lively (3× faster)' },
  { value: 10, label: 'Fast (10× faster)' },
  { value: 30, label: 'Very fast (30× faster)' },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card component="section" aria-label={title}>
      <CardContent>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {hint}
          </Typography>
        )}
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function LabeledSlider({
  label,
  value,
  display,
  ...props
}: { label: string; display: string; value: number | number[] } & Omit<
  ComponentProps<typeof Slider>,
  'value'
>) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {display}
        </Typography>
      </Stack>
      <Slider value={value} aria-label={label} valueLabelDisplay="auto" {...props} />
    </Box>
  );
}

function MixSliders<K extends string>({
  mix,
  labels,
  onChange,
  disabled = [],
}: {
  mix: Record<K, number>;
  labels: Record<NoInfer<K>, string>;
  onChange: (mix: Record<K, number>) => void;
  disabled?: NoInfer<K>[];
}) {
  return (
    <>
      {(Object.keys(labels) as K[]).map((key) => (
        <LabeledSlider
          key={key}
          label={labels[key]}
          display={`${mix[key]}%`}
          value={mix[key]}
          min={0}
          max={100}
          disabled={disabled.includes(key)}
          onChange={(_, v) => onChange(setMixValue(mix, key, v as number))}
        />
      ))}
    </>
  );
}

/** Advanced configuration (SPEC brief + §4): mixes, engagement amount and speed, within hard caps. */
export function AdvancedSettingsPage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const showToast = useUiStore((s) => s.showToast);
  const [config, setConfig] = useState<EngagementConfig | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void getEngagementConfig().then(setConfig);
  }, []);
  if (!config || !profile) return null;
  const minor = profile.age < ADULT_AGE;
  const set = (patch: Partial<EngagementConfig>) => setConfig({ ...config, ...patch });

  const save = async () => {
    const parsed = engagementConfigSchema.safeParse(config);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Some values are invalid.');
      return;
    }
    setError(undefined);
    await saveEngagementConfig(parsed.data);
    showToast('Saved. New posts and engagement use these settings.');
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <IconButton aria-label="Back" onClick={() => navigate('/settings')}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="h4" component="h1">
          Advanced settings
        </Typography>
      </Stack>
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        Hard limits always apply: at most {MAX_LIKES_PER_POST.toLocaleString()} likes and{' '}
        {MAX_COMMENTS_PER_POST} comments per post. Comments are never abusive.
      </Alert>

      <Section
        title="Your circle"
        hint="Applies the next time friends are generated (Settings → Reset friends)."
      >
        <LabeledSlider
          label="Friends"
          display={String(config.friendCount)}
          value={config.friendCount}
          min={5}
          max={50}
          onChange={(_, v) => set({ friendCount: v as number })}
        />
        <LabeledSlider
          label="Public profiles"
          display={`${config.publicProfileMultiplier}× friends (${Math.round(config.friendCount * config.publicProfileMultiplier)})`}
          value={config.publicProfileMultiplier}
          min={0}
          max={5}
          step={0.5}
          onChange={(_, v) => set({ publicProfileMultiplier: v as number })}
        />
        <Typography variant="subtitle2">Gender mix</Typography>
        <MixSliders
          mix={config.genderMix}
          labels={{ female: 'Women', male: 'Men', nonbinary: 'Non-binary' }}
          onChange={(genderMix) => set({ genderMix })}
        />
        <LabeledSlider
          label="Live in your city"
          display={`${config.sameCityPercent}%`}
          value={config.sameCityPercent}
          min={0}
          max={100}
          onChange={(_, v) => set({ sameCityPercent: v as number })}
        />
        <LabeledSlider
          label="Share a language with you"
          display={`${config.sharedLanguagePercent}%`}
          value={config.sharedLanguagePercent}
          min={0}
          max={100}
          onChange={(_, v) => set({ sharedLanguagePercent: v as number })}
        />
        <Typography variant="subtitle2">How they see you</Typography>
        <MixSliders
          mix={config.stanceMix}
          labels={{
            fan: 'Fans (agree with you)',
            neutral: 'Neutral',
            critic: 'Critics (often disagree)',
          }}
          onChange={(stanceMix) => set({ stanceMix })}
        />
      </Section>

      <Section title="Engagement" hint="How much attention each of your posts gets.">
        <LabeledSlider
          label="Comments per post"
          display={`${config.comments.min}–${config.comments.max}`}
          value={[config.comments.min, config.comments.max]}
          min={0}
          max={MAX_COMMENTS_PER_POST}
          disableSwap
          onChange={(_, v) => {
            const [min, max] = v as number[];
            set({ comments: { min: min!, max: max! } });
          }}
        />
        <LabeledSlider
          label="Likes per comment"
          display={`${config.likesMultiplier.min}×–${config.likesMultiplier.max}×`}
          value={[config.likesMultiplier.min, config.likesMultiplier.max]}
          min={1}
          max={20}
          step={0.5}
          disableSwap
          onChange={(_, v) => {
            const [min, max] = v as number[];
            set({ likesMultiplier: { min: min!, max: max! } });
          }}
        />
        <LabeledSlider
          label="Minimum likes"
          display={String(config.minLikes)}
          value={config.minLikes}
          min={0}
          max={100}
          onChange={(_, v) => set({ minLikes: v as number })}
        />
        <TextField
          select
          label="Speed"
          value={config.speed}
          onChange={(e) => set({ speed: Number(e.target.value) })}
          sx={{ maxWidth: 320 }}
        >
          {SPEEDS.some((s) => s.value === config.speed) ? null : (
            <MenuItem value={config.speed}>{config.speed}×</MenuItem>
          )}
          {SPEEDS.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      </Section>

      <Section
        title="Comment variety"
        hint={minor ? 'Super-critical comments are off for under-18s.' : undefined}
      >
        <MixSliders
          mix={config.commentMix}
          labels={{
            good: 'Good',
            appreciative: 'Appreciative',
            nonsense: 'Nonsense',
            critical: 'Critical',
            superCritical: 'Super-critical (blunt, never abusive)',
          }}
          disabled={minor ? ['superCritical'] : []}
          onChange={(commentMix) => set({ commentMix })}
        />
        <LabeledSlider
          label="Most critical comments per post"
          display={String(config.maxCriticalPerPost)}
          value={config.maxCriticalPerPost}
          min={0}
          max={10}
          onChange={(_, v) => set({ maxCriticalPerPost: v as number })}
        />
      </Section>

      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" size="large" onClick={() => void save()}>
          Save
        </Button>
        <Button size="large" onClick={() => setConfig(defaultEngagementConfig)}>
          Reset to defaults
        </Button>
      </Stack>
    </Stack>
  );
}
