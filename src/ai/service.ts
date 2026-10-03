import { create } from 'zustand';
import type { z } from 'zod';
import { db } from '@/db';
import { detectTier } from './detect';
import { MODEL_LABELS, type WebLLMModelId } from './models';
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
  error?: string;
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

function wrap(provider: AIProvider): AI {
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
        yield* provider.stream(prompt, o);
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
  ai = wrap(provider);
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
