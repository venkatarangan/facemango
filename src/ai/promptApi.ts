import type { z } from 'zod';
import {
  generateValidated,
  jsonEnd,
  OutputTooLongError,
  retryHint,
  schemaInstruction,
  toJsonSchema,
} from './json';
import type { AIProvider, GenerateOptions } from './provider';

const TEXT_EN: LanguageModelExpected[] = [{ type: 'text', languages: ['en'] }];
const IMAGE_IN: LanguageModelExpected[] = [{ type: 'text', languages: ['en'] }, { type: 'image' }];

/**
 * The Prompt API has no max-tokens option, and Gemini Nano sometimes runs on for minutes until
 * Chrome stops it with QuotaExceededError. So replies are streamed and cut at a length budget
 * (generous: about 6 characters per token).
 */
export const charBudget = (maxTokens: number) => maxTokens * 6;

const isQuotaError = (error: unknown) =>
  error instanceof DOMException && error.name === 'QuotaExceededError';

interface CappedReply {
  text: string;
  /** Stopped at the budget or by Chrome's output limit. */
  truncated: boolean;
}

/** Streams a reply, stopping at `maxChars` or, with `stopAtJsonEnd`, once the JSON is complete. */
export async function readCapped(
  session: LanguageModelSession,
  prompt: string,
  options: {
    signal?: AbortSignal;
    responseConstraint?: object;
    maxChars: number;
    stopAtJsonEnd?: boolean;
  },
): Promise<CappedReply> {
  let reader: ReadableStreamDefaultReader<string> | undefined;
  let text = '';
  try {
    reader = session
      .promptStreaming(prompt, {
        signal: options.signal,
        responseConstraint: options.responseConstraint,
      })
      .getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) return { text, truncated: false };
      if (!value) continue;
      text += value;
      if (options.stopAtJsonEnd) {
        const end = jsonEnd(text);
        if (end > 0) return { text: text.slice(0, end), truncated: false };
      }
      if (text.length > options.maxChars) return { text, truncated: true };
    }
  } catch (error) {
    // With no text yet, it was the input that was too long: not worth retrying.
    if (text && isQuotaError(error)) return { text, truncated: true };
    throw error;
  } finally {
    // Stops generation when we return early.
    void reader?.cancel().catch(() => {});
  }
}

export type PromptApiProgress = (progress: number) => void;

export function hasPromptApi(): boolean {
  return typeof LanguageModel !== 'undefined';
}

export async function promptApiAvailability(): Promise<LanguageModelAvailability> {
  if (!hasPromptApi()) return 'unavailable';
  try {
    return await LanguageModel!.availability({ expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN });
  } catch {
    return 'unavailable';
  }
}

/** Tier 1: the browser's built-in model (Chrome Gemini Nano, Edge Phi-4-mini). */
export class PromptApiProvider implements AIProvider {
  readonly tier = 'prompt-api' as const;
  readonly modelId: string;
  /** Set when the browser rejects our schema as a responseConstraint. */
  private constraintUnsupported = false;

  private constructor(multimodal: boolean) {
    this.modelId = /Edg\//.test(navigator.userAgent) ? 'Phi-4-mini (Edge)' : 'Gemini Nano (Chrome)';
    if (!multimodal) this.describeImage = undefined;
  }

  /**
   * Downloads (if needed) and warms up the model. A download must start inside a user gesture,
   * otherwise `create()` rejects with NotAllowedError.
   */
  static async load(onProgress: PromptApiProgress): Promise<PromptApiProvider> {
    const warm = await LanguageModel!.create({
      expectedInputs: TEXT_EN,
      expectedOutputs: TEXT_EN,
      monitor: (monitor) =>
        monitor.addEventListener('downloadprogress', (event) =>
          onProgress((event as DownloadProgressEvent).loaded),
        ),
    });
    warm.destroy();
    const multimodal = await LanguageModel!
      .availability({ expectedInputs: IMAGE_IN, expectedOutputs: TEXT_EN })
      .then((a) => a === 'available')
      .catch(() => false);
    return new PromptApiProvider(multimodal);
  }

  private async session(system?: string, image = false): Promise<LanguageModelSession> {
    return LanguageModel!.create({
      expectedInputs: image ? IMAGE_IN : TEXT_EN,
      expectedOutputs: TEXT_EN,
      initialPrompts: system ? [{ role: 'system', content: system }] : undefined,
    });
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const session = await this.session(options.system);
    try {
      const reply = await readCapped(session, prompt, {
        signal: options.signal,
        maxChars: charBudget(options.maxTokens ?? 512),
      });
      return reply.text.trim();
    } finally {
      session.destroy();
    }
  }

  async generateJSON<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: GenerateOptions = {},
  ): Promise<T> {
    const responseConstraint = toJsonSchema(schema);
    const maxChars = charBudget(options.maxTokens ?? 768);
    const finish = (reply: CappedReply) => {
      if (reply.truncated) throw new OutputTooLongError(reply.text);
      return reply.text;
    };
    return generateValidated(
      async (_attempt, previousError) => {
        const session = await this.session(options.system);
        try {
          if (!this.constraintUnsupported) {
            try {
              return finish(
                await readCapped(session, prompt + retryHint(previousError), {
                  responseConstraint,
                  signal: options.signal,
                  maxChars,
                  stopAtJsonEnd: true,
                }),
              );
            } catch (error) {
              if (options.signal?.aborted) throw error;
              const name = error instanceof DOMException ? error.name : '';
              if (name !== 'NotSupportedError' && !(error instanceof TypeError)) throw error;
              console.warn(
                'Prompt API rejected the response schema; using prompt-only JSON',
                error,
              );
              this.constraintUnsupported = true;
            }
          }
          return finish(
            await readCapped(
              session,
              prompt + schemaInstruction(responseConstraint) + retryHint(previousError),
              { signal: options.signal, maxChars },
            ),
          );
        } finally {
          session.destroy();
        }
      },
      schema,
      3,
      options.trace,
    );
  }

  async *stream(prompt: string, options: GenerateOptions = {}): AsyncIterable<string> {
    const session = await this.session(options.system);
    const maxChars = charBudget(options.maxTokens ?? 1024);
    let reader: ReadableStreamDefaultReader<string> | undefined;
    let length = 0;
    try {
      reader = session.promptStreaming(prompt, { signal: options.signal }).getReader();
      while (length <= maxChars) {
        const { done, value } = await reader.read();
        if (done) return;
        if (!value) continue;
        length += value.length;
        yield value;
      }
    } catch (error) {
      // Chrome's own output limit: keep what was already shown.
      if (!(length && isQuotaError(error))) throw error;
    } finally {
      void reader?.cancel().catch(() => {});
      session.destroy();
    }
  }

  describeImage? = async (
    image: Blob,
    prompt = 'Describe this photo in one or two plain sentences for someone who cannot see it.',
    options: GenerateOptions = {},
  ): Promise<string> => {
    const session = await this.session(options.system, true);
    try {
      const reply = await session.prompt(
        [
          {
            role: 'user',
            content: [
              { type: 'text', value: prompt },
              { type: 'image', value: image },
            ],
          },
        ],
        { signal: options.signal },
      );
      return reply.trim();
    } finally {
      session.destroy();
    }
  };
}
