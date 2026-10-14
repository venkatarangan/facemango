import { create } from 'zustand';
import type { z } from 'zod';
import { db } from '@/db';
import { detectTier } from './detect';
import { errorSummary } from './errorDetails';
import { MODEL_LABELS, type WebLLMModelId } from './models';
import { PromptApiProvider } from './promptApi';
import type { AIPriority, AIProvider, AITier, AITraceEvent, GenerateOptions } from './provider';
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
  error?: string;
  /** The most recent generation error, shown in Settings → On-device AI for troubleshooting. */
  lastError?: string;
}

export const useAIStore = create<AIState>(() => ({ status: 'idle', progress: 0 }));

const set = (patch: Partial<AIState>) => useAIStore.setState(patch);

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

type TraceMethod = Extract<AITraceEvent, { kind: 'call' }>['method'];
let traceHook: ((event: AITraceEvent) => void) | null = null;

/**
 * Developer test page only: while set, every AI call reports attempts, timings and errors here.
 * The page pauses the background engine first, so the events are its own.
 */
export function setAITrace(hook: ((event: AITraceEvent) => void) | null): void {
  traceHook = hook;
}

/** Wraps a provider so calls are queued, and streaming falls back to a single reply. */
export function wrapProvider(provider: AIProvider): AI {
  const prio = (o?: GenerateOptions): AIPriority => o?.priority ?? 'background';
  const traced = (o?: GenerateOptions): GenerateOptions | undefined =>
    traceHook && !o?.trace ? { ...o, trace: traceHook } : o;
  /** Runs one provider call, reporting its time and outcome when tracing. */
  const timed = async <T>(
    method: TraceMethod,
    o: GenerateOptions | undefined,
    task: (o?: GenerateOptions) => Promise<T>,
  ): Promise<T> => {
    const options = traced(o);
    const trace = options?.trace;
    if (!trace) return task(options);
    const started = performance.now();
    try {
      const out = await task(options);
      trace({
        kind: 'call',
        method,
        ms: performance.now() - started,
        output: typeof out === 'string' ? out : undefined,
      });
      return out;
    } catch (error) {
      trace({ kind: 'call', method, ms: performance.now() - started, error });
      throw error;
    }
  };
  return {
    tier: provider.tier,
    modelId: provider.modelId,
    multimodal: !!provider.describeImage,
    generate: (prompt, o) =>
      queue.run(
        () => timed('generate', o, (opts) => provider.generate(prompt, opts)),
        prio(o),
        o?.signal,
      ),
    generateJSON: (prompt, schema, o) =>
      queue.run(
        () => timed('generateJSON', o, (opts) => provider.generateJSON(prompt, schema, opts)),
        prio(o),
        o?.signal,
      ),
    async *stream(prompt, o) {
      const release = await queue.acquire(prio(o), o?.signal);
      const options = traced(o);
      const started = performance.now();
      let output = '';
      try {
        let yielded = false;
        try {
          for await (const delta of provider.stream(prompt, options)) {
            if (!delta) continue;
            yielded = true;
            output += delta;
            yield delta;
          }
        } catch (error) {
          if (yielded || o?.signal?.aborted) throw error;
          reportAIError('Streaming failed; retrying without streaming', error);
          options?.trace?.({ kind: 'fallback', error });
        }
        // Streaming produced nothing (error or empty output): ask once for the whole reply.
        if (!yielded && !o?.signal?.aborted) {
          try {
            const text = await provider.generate(prompt, options);
            output = text;
            if (text) yield text;
          } catch (error) {
            reportAIError('Generation failed', error);
            throw error;
          }
        }
        options?.trace?.({
          kind: 'call',
          method: 'stream',
          ms: performance.now() - started,
          output,
        });
      } catch (error) {
        options?.trace?.({
          kind: 'call',
          method: 'stream',
          ms: performance.now() - started,
          output,
          error,
        });
        throw error;
      } finally {
        release();
      }
    },
    describeImage: async (image, prompt, o) =>
      provider.describeImage
        ? queue.run(
            () => timed('describeImage', o, (opts) => provider.describeImage!(image, prompt, opts)),
            prio(o),
            o?.signal,
          )
        : null,
  };
}

let ai: AI | null = null;
let rawProvider: AIProvider | null = null;

/**
 * The unwrapped provider, for the developer test page: it bypasses the streaming fallback so a
 * streaming failure shows its real error. Use it inside `queue.acquire()`.
 */
export function getAIProvider(): AIProvider | null {
  return rawProvider;
}

/** Logs an AI error to the console and keeps a short copy for Settings. */
export function reportAIError(context: string, error: unknown): void {
  console.error(`[FaceMango AI] ${context}`, error);
  set({ lastError: `${context}: ${errorSummary(error)}`.slice(0, 300) });
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
  rawProvider = provider;
  ai = wrapProvider(provider);
  set({
    status: 'ready',
    tier: provider.tier,
    modelId: provider.modelId,
    modelLabel: label,
    progress: 1,
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
  set({ status: 'detecting', progress: 0, error: undefined, progressText: undefined });

  if (import.meta.env.VITE_MOCK_AI === '1') {
    const { MockProvider } = await import('./mockProvider');
    set({ status: 'downloading', tier: 'webgpu', modelLabel: 'Mock model' });
    const provider = await MockProvider.load((progress, text) =>
      set({ progress, progressText: text }),
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
      set({
        status: 'downloading',
        tier: 'prompt-api',
        progressText: 'Preparing the built-in AI…',
      });
      const provider = await PromptApiProvider.load((progress) =>
        set({
          progress,
          progressText: `Downloading the built-in AI… ${Math.round(progress * 100)}%`,
        }),
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
      set({
        status: 'downloading',
        tier: 'webgpu',
        modelId,
        modelLabel: label,
        progress: 0,
        progressText: cached ? `Loading ${label}…` : `Downloading ${label}…`,
      });
      const provider = await WebLLMProvider.load(modelId, (progress, text) =>
        set({ progress, progressText: text }),
      );
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
