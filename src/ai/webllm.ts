import {
  CreateWebWorkerMLCEngine,
  prebuiltAppConfig,
  type AppConfig,
  type ModelRecord,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type WebWorkerMLCEngine,
} from '@mlc-ai/web-llm';
import type { z } from 'zod';
import { generateValidated, retryHint, schemaInstruction, toJsonSchema } from './json';
import modelLibs from './model-libs.json';
import {
  DESKTOP_MODELS,
  isQwen3,
  MOBILE_MODELS,
  supportsSystemRole,
  type WebLLMModelId,
} from './models';
import type { AIProvider, GenerateOptions } from './provider';

/**
 * WebLLM app config with the model libraries served from our own origin (/models/*.wasm,
 * downloaded by scripts/fetch-model-libs.mjs). Weights still come from Hugging Face.
 */
export function appConfig(origin = self.location.origin): AppConfig {
  const wanted = new Set<string>([...DESKTOP_MODELS, ...MOBILE_MODELS]);
  const model_list: ModelRecord[] = prebuiltAppConfig.model_list
    .filter((record) => wanted.has(record.model_id))
    .map((record) => {
      const file = record.model_lib.split('/').pop()!;
      if (!modelLibs.files.includes(file)) throw new Error(`Model library not bundled: ${file}`);
      return { ...record, model_lib: `${origin}/models/${file}` };
    });
  return { ...prebuiltAppConfig, model_list };
}

export type ProgressHandler = (progress: number, text: string) => void;

/** Tier 2: WebLLM on WebGPU, running in a dedicated Web Worker. */
export class WebLLMProvider implements AIProvider {
  readonly tier = 'webgpu' as const;

  private readonly engine: WebWorkerMLCEngine;
  readonly modelId: WebLLMModelId;
  /** Set when the grammar engine can't compile our schema. */
  private schemaUnsupported = false;

  private constructor(engine: WebWorkerMLCEngine, modelId: WebLLMModelId) {
    this.engine = engine;
    this.modelId = modelId;
  }

  static async load(modelId: WebLLMModelId, onProgress: ProgressHandler): Promise<WebLLMProvider> {
    const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
    try {
      const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
        appConfig: appConfig(),
        initProgressCallback: (report: InitProgressReport) =>
          onProgress(report.progress, report.text),
      });
      return new WebLLMProvider(engine, modelId);
    } catch (error) {
      worker.terminate();
      throw error;
    }
  }

  static isCached(modelId: WebLLMModelId): Promise<boolean> {
    return hasModelInCache(modelId, appConfig());
  }

  static deleteFromCache(modelId: WebLLMModelId): Promise<void> {
    return deleteModelAllInfoInCache(modelId, appConfig());
  }

  private messages(prompt: string, system?: string): ChatCompletionMessageParam[] {
    if (!system) return [{ role: 'user', content: prompt }];
    if (supportsSystemRole(this.modelId)) {
      return [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ];
    }
    return [{ role: 'user', content: `${system}\n\n${prompt}` }];
  }

  private extraBody() {
    return isQwen3(this.modelId) ? { enable_thinking: false } : undefined;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const reply = await this.engine.chat.completions.create({
      messages: this.messages(prompt, options.system),
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 512,
      extra_body: this.extraBody(),
    });
    return stripThink(reply.choices[0]?.message.content ?? '');
  }

  async generateJSON<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: GenerateOptions = {},
  ): Promise<T> {
    const json = toJsonSchema(schema);
    const jsonSchema = JSON.stringify(json);
    return generateValidated(async (_attempt, previousError) => {
      const request = (constrained: boolean) =>
        this.engine.chat.completions.create({
          messages: this.messages(
            prompt + (constrained ? '' : schemaInstruction(json)) + retryHint(previousError),
            options.system,
          ),
          temperature: options.temperature ?? 0.8,
          max_tokens: options.maxTokens ?? 1024,
          response_format: constrained
            ? { type: 'json_object', schema: jsonSchema }
            : { type: 'json_object' },
          extra_body: this.extraBody(),
        });
      let reply;
      if (this.schemaUnsupported) {
        reply = await request(false);
      } else {
        try {
          reply = await request(true);
        } catch (error) {
          console.warn('WebLLM could not apply the JSON schema; using prompt-only JSON', error);
          this.schemaUnsupported = true;
          reply = await request(false);
        }
      }
      return reply.choices[0]?.message.content ?? '';
    }, schema);
  }

  async *stream(prompt: string, options: GenerateOptions = {}): AsyncIterable<string> {
    const chunks = await this.engine.chat.completions.create({
      messages: this.messages(prompt, options.system),
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 768,
      stream: true,
      extra_body: this.extraBody(),
    });
    let inThink = false;
    for await (const chunk of chunks) {
      if (options.signal?.aborted) {
        await this.engine.interruptGenerate();
        return;
      }
      let delta = chunk.choices[0]?.delta?.content ?? '';
      // Qwen3 may still emit an empty think block; hide it from the stream.
      if (delta.includes('<think>')) inThink = true;
      if (inThink) {
        const end = delta.indexOf('</think>');
        if (end < 0) continue;
        inThink = false;
        delta = delta.slice(end + '</think>'.length);
      }
      if (delta) yield delta;
    }
  }
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}
