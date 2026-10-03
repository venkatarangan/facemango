import type { z } from 'zod';
import { generateValidated, retryHint, schemaInstruction, toJsonSchema } from './json';
import type { AIProvider, GenerateOptions } from './provider';

const TEXT_EN: LanguageModelExpected[] = [{ type: 'text', languages: ['en'] }];
const IMAGE_IN: LanguageModelExpected[] = [{ type: 'text', languages: ['en'] }, { type: 'image' }];

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
      return (await session.prompt(prompt, { signal: options.signal })).trim();
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
    return generateValidated(async (_attempt, previousError) => {
      const session = await this.session(options.system);
      try {
        if (!this.constraintUnsupported) {
          try {
            return await session.prompt(prompt + retryHint(previousError), {
              responseConstraint,
              signal: options.signal,
            });
          } catch (error) {
            if (options.signal?.aborted) throw error;
            const name = error instanceof DOMException ? error.name : '';
            if (name !== 'NotSupportedError' && !(error instanceof TypeError)) throw error;
            console.warn('Prompt API rejected the response schema; using prompt-only JSON', error);
            this.constraintUnsupported = true;
          }
        }
        return await session.prompt(
          prompt + schemaInstruction(responseConstraint) + retryHint(previousError),
          { signal: options.signal },
        );
      } finally {
        session.destroy();
      }
    }, schema);
  }

  async *stream(prompt: string, options: GenerateOptions = {}): AsyncIterable<string> {
    const session = await this.session(options.system);
    try {
      const reader = session.promptStreaming(prompt, { signal: options.signal }).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    } finally {
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
