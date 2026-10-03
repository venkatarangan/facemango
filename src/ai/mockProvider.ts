/**
 * Test-only provider, compiled in only when VITE_MOCK_AI=1 (the e2e build). It is NOT a
 * "Lite mode": production builds never include it (SPEC: the app works only with local AI).
 * It fabricates schema-valid JSON so the whole app can be exercised without a model.
 */
import type { z } from 'zod';
import { toJsonSchema } from './json';
import type { AIProvider, GenerateOptions } from './provider';

const NAMES = [
  'Priya Raman',
  'Arjun Mehta',
  'Lena Weber',
  'Kofi Mensah',
  'Aiko Tanaka',
  'Diego Ruiz',
  'Meera Iyer',
  'Sam Carter',
];
const CITIES = ['Chennai', 'Bengaluru', 'Berlin', 'Accra', 'Osaka', 'Lima', 'Madurai', 'Austin'];
const SENTENCES = [
  'This made my day, thank you for sharing!',
  'Looks wonderful. Where was this taken?',
  'So happy for you 🙌',
  'Honestly the colours could be a bit brighter, but nice shot.',
  'lol my cat just walked across my keyboard',
  'Sunday filter coffee hits different ☕',
  'Finally tried that new place downtown. Worth the wait!',
];

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

let counter = 0;
const pick = <T>(list: T[]) => list[counter++ % list.length]!;

function fake(schema: JsonSchema, key = ''): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return pick(schema.enum);
  if (schema.anyOf?.length) return fake(schema.anyOf[0]!, key);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  switch (type) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = fake(v, k);
      return out;
    }
    case 'array': {
      const min = schema.minItems ?? 1;
      const max = Math.max(min, Math.min(schema.maxItems ?? min + 2, min + 2));
      return Array.from({ length: max }, () => fake(schema.items ?? { type: 'string' }, key));
    }
    case 'integer':
    case 'number': {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? min + 10;
      const value = min + ((counter++ * 7) % (Math.floor(max - min) + 1));
      return type === 'integer' ? Math.round(value) : value;
    }
    case 'boolean':
      return counter++ % 2 === 0;
    default: {
      const k = key.toLowerCase();
      let value = /name/.test(k)
        ? pick(NAMES)
        : /city/.test(k)
          ? pick(CITIES)
          : /country/.test(k)
            ? 'India'
            : pick(SENTENCES);
      if (/birthday/.test(k)) value = `0${(counter % 9) + 1}-1${counter % 9}`;
      if (schema.maxLength && value.length > schema.maxLength)
        value = value.slice(0, schema.maxLength);
      if (schema.minLength && value.length < schema.minLength)
        value = value.padEnd(schema.minLength, '!');
      return value;
    }
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockProvider implements AIProvider {
  readonly tier = 'webgpu' as const;
  readonly modelId = 'mock';

  static async load(onProgress: (p: number, text: string) => void): Promise<MockProvider> {
    for (let i = 1; i <= 10; i++) {
      await delay(60);
      onProgress(i / 10, `Mock model ${i * 10}%`);
    }
    return new MockProvider();
  }

  async generate(_prompt: string, _options?: GenerateOptions): Promise<string> {
    await delay(40);
    return pick(SENTENCES);
  }

  async generateJSON<T>(_prompt: string, schema: z.ZodType<T>): Promise<T> {
    await delay(40);
    return schema.parse(fake(toJsonSchema(schema) as JsonSchema));
  }

  async *stream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    for (const word of (await this.generate(prompt, options)).split(' ')) {
      await delay(20);
      yield `${word} `;
    }
  }
}
