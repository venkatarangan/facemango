import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { aiQueue, getAI, getAIProvider, setAITrace, startAI, useAIStore } from '@/ai';
import { useUiStore } from '@/app/uiStore';
import { setSchedulerPaused } from '@/engine/scheduler';
import {
  MODEL_TESTS,
  resultsToMarkdown,
  runModelTest,
  TEST_USER,
  type ModelTest,
  type RunInfo,
  type TestResult,
  type TestStatus,
} from './modelTests';
import type { Tone } from './scoring';

const STATUS_COLOR: Record<TestStatus, 'success' | 'error' | 'default' | 'warning'> = {
  pass: 'success',
  fail: 'error',
  skipped: 'default',
  cancelled: 'warning',
};

const mono = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 } as const;

async function deviceInfo(): Promise<string[]> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lines = [
    `Browser: ${nav.userAgent}`,
    `CPU threads: ${nav.hardwareConcurrency ?? '?'}${nav.deviceMemory ? ` · Memory: ≥${nav.deviceMemory} GB` : ''}`,
  ];
  if (!nav.gpu) return [...lines, 'WebGPU: not available'];
  try {
    const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    const info = adapter?.info;
    lines.push(
      adapter
        ? `GPU: ${[info?.vendor, info?.architecture, info?.description].filter(Boolean).join(' · ') || 'unknown'}${adapter.features.has('shader-f16') ? ' · shader-f16' : ''}`
        : 'WebGPU: no adapter',
    );
  } catch {
    lines.push('WebGPU: adapter request failed');
  }
  return lines;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

function ResultView({ result }: { result: TestResult }) {
  const [showRaw, setShowRaw] = useState(false);
  const tps = result.tokensPerSecond;
  return (
    <Stack spacing={1.25} sx={{ mt: 1.5 }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 3, rowGap: 1 }}>
        <Metric label="Time" value={`${(result.ms / 1000).toFixed(1)} s`} />
        <Metric
          label="Zod valid"
          value={result.attempts.length ? `${result.valid} of ${result.attempts.length}` : '–'}
        />
        <Metric label="Retries" value={String(result.retries)} />
        <Metric label="Model calls" value={String(result.calls)} />
        <Metric
          label="Tokens/s"
          value={tps ? `${tps.estimated ? '≈' : ''}${tps.value.toFixed(1)}` : '–'}
        />
        <Metric
          label="Repetition"
          value={
            result.repetition !== undefined
              ? `${Math.round(result.repetition * 100)}%${result.duplicates ? ` · ${result.duplicates} duplicate${result.duplicates > 1 ? 's' : ''}` : ''}`
              : '–'
          }
        />
      </Stack>
      {result.note && (
        <Typography variant="body2" color="text.secondary">
          {result.note}
        </Typography>
      )}
      {result.checks.map((c) => (
        <Typography key={c.label} variant="body2">
          {c.ok ? '✅' : '❌'} {c.label}
        </Typography>
      ))}
      {result.tone && (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Tone distribution">
            <TableHead>
              <TableRow>
                <TableCell>Tone</TableCell>
                <TableCell align="right">Target</TableCell>
                <TableCell align="right">Requested</TableCell>
                <TableCell align="right">Detected*</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(Object.keys(result.tone.target) as Tone[]).map((t) => (
                <TableRow key={t}>
                  <TableCell>{t}</TableCell>
                  <TableCell align="right">{result.tone!.target[t]}%</TableCell>
                  <TableCell align="right">{result.tone!.requested[t]}%</TableCell>
                  <TableCell align="right">{result.tone!.detected[t]}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary">
            *A rough keyword guess. Detected is {result.tone.distance} points from the target.
          </Typography>
        </Box>
      )}
      {result.errors.map((e, i) => (
        <Box
          key={i}
          component="pre"
          sx={{
            ...mono,
            m: 0,
            p: 1.25,
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.error.main, 0.06),
            border: 1,
            borderColor: 'error.light',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {e}
        </Box>
      ))}
      {result.outputs.length > 0 && (
        <Stack spacing={0.5}>
          {result.outputs.map((o, i) => (
            <Typography
              key={i}
              variant="body2"
              sx={{ pl: 1.25, borderLeft: 3, borderColor: 'divider', overflowWrap: 'anywhere' }}
            >
              {o || '(empty)'}
            </Typography>
          ))}
        </Stack>
      )}
      <Box>
        <Button size="small" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide raw output' : 'Show raw output'}
        </Button>
        <Collapse in={showRaw} unmountOnExit>
          <Box
            component="pre"
            sx={{
              ...mono,
              m: 0,
              mt: 1,
              p: 1.25,
              maxHeight: 360,
              overflow: 'auto',
              borderRadius: 2,
              bgcolor: 'grey.100',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {result.raw || '(nothing)'}
          </Box>
        </Collapse>
      </Box>
    </Stack>
  );
}

/** Developer feature: runs fixed prompts through the real model and code paths; stores nothing. */
export function ModelTestPage() {
  const navigate = useNavigate();
  const ai = useAIStore();
  const showToast = useUiStore((s) => s.showToast);
  const [device, setDevice] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void deviceInfo().then(setDevice);
  }, []);

  // Leaving the page cancels a run and resumes the background engine.
  useEffect(
    () => () => {
      abort.current?.abort();
      setAITrace(null);
      void setSchedulerPaused(false);
    },
    [],
  );

  const ready = ai.status === 'ready';
  const busy = running !== null;

  const run = async (tests: ModelTest[]) => {
    const model = getAI();
    if (!model || abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(tests[0]!.id);
    try {
      // Let a background step that is already running finish, so it doesn't land in the results.
      await setSchedulerPaused(true);
      for (const test of tests) {
        if (controller.signal.aborted) break;
        setRunning(test.id);
        const result = await runModelTest(
          test,
          {
            ai: model,
            provider: getAIProvider(),
            acquire: (signal) => aiQueue.acquire('interactive', signal),
            user: TEST_USER,
            signal: controller.signal,
          },
          setAITrace,
        );
        setResults((r) => ({ ...r, [test.id]: result }));
      }
    } finally {
      void setSchedulerPaused(false);
      setRunning(null);
      abort.current = null;
    }
  };

  const copy = async () => {
    const info: RunInfo = {
      model: ai.modelLabel ?? ai.modelId ?? 'unknown',
      tier: ai.tier ?? 'unknown',
      device,
      app: `FaceMango v${__APP_VERSION__}`,
      at: new Date().toISOString(),
    };
    const list = MODEL_TESTS.flatMap((t) => (results[t.id] ? [results[t.id]!] : []));
    try {
      await navigator.clipboard.writeText(resultsToMarkdown(info, list));
      showToast('Results copied as Markdown.');
    } catch {
      showToast('Could not copy. Your browser blocked the clipboard.');
    }
  };

  const done = Object.values(results);
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <IconButton aria-label="Back" onClick={() => navigate('/settings/advanced')}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
          Real-model test
        </Typography>
        <Chip label="For developers" size="small" color="warning" variant="outlined" />
      </Stack>

      <Alert severity="warning" sx={{ borderRadius: 3 }}>
        This runs about 20 AI requests on this device and keeps the GPU busy for a minute or two.
        Nothing is added to your feed, friends or chat, and background activity pauses while it
        runs.
      </Alert>

      <Card>
        <CardContent>
          <Stack spacing={0.5}>
            <Typography sx={{ fontWeight: 700 }}>
              {ai.modelLabel ?? 'No model yet'}
              {ai.tier && ai.tier !== 'unsupported'
                ? ` · ${ai.tier === 'prompt-api' ? 'Prompt API' : 'WebLLM on WebGPU'}`
                : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Status: {ai.status}
              {ready ? ` · ${getAI()?.multimodal ? 'sees images' : 'text only'}` : ''}
              {ai.modelId ? ` · ${ai.modelId}` : ''}
            </Typography>
            {device.map((d) => (
              <Typography
                key={d}
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {d}
              </Typography>
            ))}
            {ai.lastError && (
              <Typography variant="caption" color="error" sx={{ overflowWrap: 'anywhere' }}>
                Last AI error: {ai.lastError}
              </Typography>
            )}
          </Stack>
          {!ready && (ai.status === 'needs-gesture' || ai.status === 'error') && (
            <Button
              variant="contained"
              sx={{ mt: 1.5 }}
              onClick={() => void startAI({ userGesture: true })}
            >
              Start AI
            </Button>
          )}
          <Stack direction="row" sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="contained"
              disabled={!ready || busy}
              onClick={() => void run(MODEL_TESTS)}
            >
              Run all
            </Button>
            <Button variant="outlined" disabled={!busy} onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
            <Button variant="outlined" disabled={!done.length} onClick={() => void copy()}>
              Copy results
            </Button>
          </Stack>
          {done.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {done.filter((r) => r.status === 'pass').length} passed ·{' '}
              {done.filter((r) => r.status === 'fail').length} failed ·{' '}
              {done.filter((r) => r.status === 'skipped').length} skipped
            </Typography>
          )}
        </CardContent>
      </Card>

      {MODEL_TESTS.map((test) => {
        const result = results[test.id];
        return (
          <Card key={test.id} component="section" aria-label={test.title}>
            {running === test.id && <LinearProgress />}
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
                  {test.title}
                </Typography>
                {result && (
                  <Chip
                    size="small"
                    label={result.status.toUpperCase()}
                    color={STATUS_COLOR[result.status]}
                  />
                )}
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!ready || busy}
                  onClick={() => void run([test])}
                >
                  Run
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {test.description}
              </Typography>
              {result && <ResultView result={result} />}
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
