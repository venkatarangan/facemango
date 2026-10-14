import { create } from 'zustand';
import type { z } from 'zod';
import { db } from '@/db';
import { detectTier } from './detect';
import { MODEL_LABELS, type WebLLMModelId } from './models';
import { EtaEstimator, webllmPhase, type LoadPhase } from './progress';
import { PromptApiProvider } from './promptApi';
import type { AIPriority, AIProvider, AITier, GenerateOptions } from './provider';
import { AIQueue } from './queue';

export type AIStatus =
  'idle' | 'detecting' | 'needs-gesture' | 'downloading' | 'ready' | 'unsupported' | 'error';

export interface AIState {
  status: AIStatus;
  tier?: AITier;
  modelId?: string;
  modelLabel?: string;
  /** 0..1 for the current download/load. */
  progress: number;
  progressText?: string;
  /** Whether the model is being downloaded (once only) or loaded from this device. */
  phase?: LoadPhase;
  /** Rough download time left, when the rate is known. */
  secondsLeft?: number;
  /** When progress last moved (to spot a stalled download). */
  progressAt?: number;
  error?: string;
  /** The most recent generation error, shown in Settings → On-device AI for troubleshooting. */
  lastError?: string;
}

export const useAIStore = create<AIState>(() => ({ status: 'idle', progress: 0 }));

const set = (patch: Partial<AIState>) => useAIStore.setState(patch);

const eta = new EtaEstimator();

/** Records progress, with a time-left estimate while downloading. */
export function reportProgress(progress: number, text: string | undefined, phase: LoadPhase) {
  const now = Date.now();
  if (phase === 'download') eta.add(now, progress);
  else eta.reset();
  set({
    progress,
    progressText: text,
    phase,
    secondsLeft: phase === 'download' ? eta.secondsLeft() : undefined,
    progressAt: now,
  });
}

/** The provider, wrapped so every call goes through the priority queue. */
export interface AI {
  readonly tier: Exclude<AITier, 'unsupported'>;
  readonly modelId: string;
  readonly multimodal: boolean;
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  generateJSON<T>(prompt: string, schema: z.ZodType<T>, options?: GenerateOptions): Promise<T>;
  stream(prompt: string, options?: GenerateOptions): AsyncIterable<string>;
  describeImage(image: Blob, prompt?: string, options?: GenerateOptions): Promise<string | null>;
}

export const queue = new AIQueue();

/** Wraps a provider so calls are queued, and streaming falls back to a single reply. */
export function wrapProvider(provider: AIProvider): AI {
  const prio = (o?: GenerateOptions): AIPriority => o?.priority ?? 'background';
  return {
    tier: provider.tier,
    modelId: provider.modelId,
    multimodal: !!provider.describeImage,
    generate: (prompt, o) => queue.run(() => provider.generate(prompt, o), prio(o), o?.signal),
    generateJSON: (prompt, schema, o) =>
      queue.run(() => provider.generateJSON(prompt, schema, o), prio(o), o?.signal),
    async *stream(prompt, o) {
      const release = await queue.acquire(prio(o), o?.signal);
      try {
        let yielded = false;
        try {
          for await (const delta of provider.stream(prompt, o)) {
            if (!delta) continue;
            yielded = true;
            yield delta;
          }
        } catch (error) {
          if (yielded || o?.signal?.aborted) throw error;
          reportAIError('Streaming failed; retrying without streaming', error);
        }
        // Streaming produced nothing (error or empty output): ask once for the whole reply.
        if (!yielded && !o?.signal?.aborted) {
          try {
            const text = await provider.generate(prompt, o);
            if (text) yield text;
          } catch (error) {
            reportAIError('Generation failed', error);
            throw error;
          }
        }
      } finally {
        release();
      }
    },
    describeImage: async (image, prompt, o) =>
      provider.describeImage
        ? queue.run(() => provider.describeImage!(image, prompt, o), prio(o), o?.signal)
        : null,
  };
}

let ai: AI | null = null;

/** Logs an AI error to the console and keeps a short copy for Settings. */
export function reportAIError(context: string, error: unknown): void {
  console.error(`[FaceMango AI] ${context}`, error);
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  set({ lastError: `${context}: ${message}`.slice(0, 300) });
}

/** A short, user-facing description of an AI error. */
export function describeAIError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
}
let starting: Promise<void> | null = null;
const readyWaiters: ((ai: AI) => void)[] = [];

export function getAI(): AI | null {
  return ai;
}

/** Resolves once a model is loaded. */
export function whenAIReady(): Promise<AI> {
  if (ai) return Promise.resolve(ai);
  return new Promise((resolve) => readyWaiters.push(resolve));
}

function becomeReady(provider: AIProvider, label: string) {
  ai = wrapProvider(provider);
  set({
    status: 'ready',
    tier: provider.tier,
    modelId: provider.modelId,
    modelLabel: label,
    progress: 1,
    secondsLeft: undefined,
  });
  void db.meta.put({
    key: 'ai',
    value: { tier: provider.tier, modelId: provider.modelId, readyAt: Date.now() },
  });
  readyWaiters.splice(0).forEach((resolve) => resolve(ai!));
}

/**
 * Detects the best tier and loads a model (SPEC §5.1). Idempotent. Call it from a user gesture
 * the first time ("Get started"), because Prompt API downloads require one.
 */
export function startAI({ userGesture }: { userGesture: boolean }): Promise<void> {
  const { status } = useAIStore.getState();
  if (status === 'ready') return Promise.resolve();
  if (starting) return starting;
  starting = run(userGesture).finally(() => {
    starting = null;
  });
  return starting;
}

async function run(userGesture: boolean): Promise<void> {
  set({
    status: 'detecting',
    progress: 0,
    error: undefined,
    progressText: undefined,
    phase: undefined,
    secondsLeft: undefined,
  });
  eta.reset();

  if (import.meta.env.VITE_MOCK_AI === '1') {
    const { MockProvider } = await import('./mockProvider');
    set({ status: 'downloading', tier: 'webgpu', modelLabel: 'Mock model', phase: 'download' });
    const provider = await MockProvider.load((progress, text) =>
      reportProgress(progress, text, 'download'),
    );
    becomeReady(provider, 'Mock model');
    return;
  }

  let detection = await detectTier();
  if (detection.tier === 'prompt-api') {
    if (detection.availability === 'downloadable' && !userGesture) {
      set({ status: 'needs-gesture', tier: 'prompt-api' });
      return;
    }
    try {
      const stored = detection.availability === 'available';
      set({
        status: 'downloading',
        tier: 'prompt-api',
        progressText: 'Preparing the built-in AI…',
        phase: stored ? 'load' : 'download',
        progressAt: Date.now(),
      });
      const provider = await PromptApiProvider.load((progress) =>
        // After the download, the browser still needs a moment to set the model up.
        reportProgress(
          progress,
          `Downloading the built-in AI… ${Math.round(progress * 100)}%`,
          stored || progress >= 1 ? 'load' : 'download',
        ),
      );
      becomeReady(provider, provider.modelId);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        set({ status: 'needs-gesture', tier: 'prompt-api' });
        return;
      }
      console.warn('Prompt API failed, trying WebGPU', error);
      detection = await detectTier({ skipPromptApi: true });
    }
  }

  if (detection.tier !== 'webgpu') {
    const reason = detection.tier === 'unsupported' ? detection.reason : 'No usable AI found.';
    set({ status: 'unsupported', tier: 'unsupported', error: reason });
    return;
  }

  const { WebLLMProvider } = await import('./webllm');
  let lastError: unknown;
  for (const modelId of detection.models) {
    const label = MODEL_LABELS[modelId as WebLLMModelId];
    try {
      const cached = await WebLLMProvider.isCached(modelId).catch(() => false);
      let phase: LoadPhase = cached ? 'load' : 'download';
      eta.reset();
      set({
        status: 'downloading',
        tier: 'webgpu',
        modelId,
        modelLabel: label,
        progress: 0,
        progressText: cached ? `Loading ${label}…` : `Downloading ${label}…`,
        phase,
        secondsLeft: undefined,
        progressAt: Date.now(),
      });
      const provider = await WebLLMProvider.load(modelId, (progress, text) => {
        phase = webllmPhase(text, phase);
        reportProgress(progress, text, phase);
      });
      becomeReady(provider, label);
      return;
    } catch (error) {
      console.warn(`WebLLM failed to load ${modelId}`, error);
      lastError = error;
    }
  }
  set({
    status: 'error',
    error: lastError instanceof Error ? lastError.message : 'The AI model could not be loaded.',
  });
}

/** Removes the downloaded WebLLM weights (Settings → "Delete model"). */
export async function deleteDownloadedModel(): Promise<boolean> {
  const { tier, modelId } = useAIStore.getState();
  if (tier !== 'webgpu' || !modelId || modelId === 'mock') return false;
  const { WebLLMProvider } = await import('./webllm');
  await WebLLMProvider.deleteFromCache(modelId as WebLLMModelId);
  return true;
}
