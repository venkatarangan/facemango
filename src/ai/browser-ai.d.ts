/**
 * Minimal typings for the built-in Prompt API (Chrome: Gemini Nano, Edge: Phi-4-mini) and the
 * parts of WebGPU that tier detection uses. Feature-detected at runtime; never assume presence.
 */

type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelExpected {
  type: 'text' | 'image' | 'audio';
  languages?: string[];
}

interface LanguageModelMessageContent {
  type: 'text' | 'image';
  value: string | Blob | ImageBitmap;
}

interface LanguageModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LanguageModelMessageContent[];
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelMessage[];
  expectedInputs?: LanguageModelExpected[];
  expectedOutputs?: LanguageModelExpected[];
  signal?: AbortSignal;
  monitor?: (monitor: EventTarget) => void;
}

interface LanguageModelPromptOptions {
  responseConstraint?: object;
  omitResponseConstraintInput?: boolean;
  signal?: AbortSignal;
}

interface LanguageModelSession {
  prompt(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): Promise<string>;
  promptStreaming(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): ReadableStream<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  availability(options?: LanguageModelCreateOptions): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

interface DownloadProgressEvent extends Event {
  loaded: number;
  total?: number;
}

// eslint-disable-next-line no-var -- a global declaration must use var
declare var LanguageModel: LanguageModelStatic | undefined;

interface GPUAdapterLike {
  features: { has(feature: string): boolean };
  limits: { maxBufferSize: number; maxStorageBufferBindingSize: number };
}

interface Navigator {
  gpu?: {
    requestAdapter(options?: {
      powerPreference?: 'low-power' | 'high-performance';
    }): Promise<GPUAdapterLike | null>;
  };
}
