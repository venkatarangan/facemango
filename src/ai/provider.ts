/**
 * The single interface every AI backend implements (SPEC §5.1). Implementations arrive in M2:
 * Tier 1 Prompt API (promptApi.ts), Tier 2 WebLLM in a Web Worker (webllm.worker.ts).
 * All calls are scheduled through the priority queue (queue.ts); the UI never blocks on the model.
 */
import type { z } from 'zod';

export type AITier = 'prompt-api' | 'webgpu' | 'unsupported';

export type AIPriority = 'interactive' | 'background';

/** Diagnostics from a model call, used only by the developer test page (Settings → Advanced). */
export type AITraceEvent =
  /** One model call inside generateJSON; `error` is the parse/Zod error, absent when valid. */
  | { kind: 'attempt'; attempt: number; raw: string; ms: number; error?: string }
  /** Token counts reported by the backend (WebLLM). */
  | { kind: 'usage'; promptTokens: number; completionTokens: number; tokensPerSecond?: number }
  /** A whole queued call, timed from when the model was free (excludes queue wait). */
  | {
      kind: 'call';
      method: 'generate' | 'generateJSON' | 'stream' | 'describeImage';
      ms: number;
      output?: string;
      error?: unknown;
    }
  /** Streaming failed before any text and the wrapper retried without streaming. */
  | { kind: 'fallback'; error: unknown };

export interface GenerateOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  priority?: AIPriority;
  signal?: AbortSignal;
  /** Diagnostics hook (developer test page only). */
  trace?: (event: AITraceEvent) => void;
}

export interface AIProvider {
  readonly tier: Exclude<AITier, 'unsupported'>;
  readonly modelId: string;
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  /** Output is validated with the Zod schema and retried if malformed. */
  generateJSON<T>(prompt: string, schema: z.ZodType<T>, options?: GenerateOptions): Promise<T>;
  stream(prompt: string, options?: GenerateOptions): AsyncIterable<string>;
  /** Present only when the backend is multimodal. */
  describeImage?(image: Blob, prompt?: string, options?: GenerateOptions): Promise<string>;
}
