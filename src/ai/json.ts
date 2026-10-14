import { z } from 'zod';
import type { AITraceEvent } from './provider';

/** JSON Schema for a Zod schema, in the subset the Prompt API and WebLLM (XGrammar) accept. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}

/** Strips Qwen3 think blocks and Markdown code fences, then returns the first JSON value found. */
export function extractJson(raw: string): unknown {
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[[{]/);
    if (start < 0) throw new SyntaxError('No JSON found in model output');
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    const end = text.lastIndexOf(close);
    if (end <= start) throw new SyntaxError('Unterminated JSON in model output');
    return JSON.parse(text.slice(start, end + 1));
  }
}

/** Where the first complete top-level JSON object or array in `text` ends, or -1 if not yet. */
export function jsonEnd(text: string): number {
  const start = text.search(/[[{]/);
  if (start < 0) return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) return i + 1;
  }
  return -1;
}

/** A reply cut off for running past its length budget; generateValidated retries it. */
export class OutputTooLongError extends Error {
  readonly partial: string;

  constructor(partial: string) {
    super('The reply was too long and was cut off');
    this.name = 'OutputTooLongError';
    this.partial = partial;
  }
}

export class AIOutputError extends Error {
  readonly lastOutput: string;

  constructor(message: string, lastOutput: string) {
    super(message);
    this.name = 'AIOutputError';
    this.lastOutput = lastOutput;
  }
}

/**
 * Calls `generate` until its output parses and validates against `schema` (CLAUDE.md:
 * "Validate all AI JSON output with Zod and retry if malformed").
 */
export async function generateValidated<T>(
  generate: (attempt: number, previousError?: string) => Promise<string>,
  schema: z.ZodType<T>,
  attempts = 3,
  trace?: (event: AITraceEvent) => void,
): Promise<T> {
  let lastOutput = '';
  let lastError: string | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const started = performance.now();
    try {
      lastOutput = await generate(attempt, lastError);
    } catch (error) {
      if (!(error instanceof OutputTooLongError)) throw error;
      lastOutput = error.partial;
      lastError = `${error.message}; keep it short`;
      trace?.({
        kind: 'attempt',
        attempt,
        raw: lastOutput,
        ms: performance.now() - started,
        error: lastError,
      });
      continue;
    }
    const ms = performance.now() - started;
    try {
      const parsed = schema.safeParse(extractJson(lastOutput));
      if (parsed.success) {
        trace?.({ kind: 'attempt', attempt, raw: lastOutput, ms });
        return parsed.data;
      }
      lastError = z.prettifyError(parsed.error).slice(0, 400);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    trace?.({ kind: 'attempt', attempt, raw: lastOutput, ms, error: lastError });
  }
  throw new AIOutputError(`Model output failed validation: ${lastError}`, lastOutput);
}

/** Prompt suffix used when the backend can't enforce the schema itself. */
export function schemaInstruction(jsonSchema: object): string {
  return `\n\nReply with JSON only, matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`;
}

/** Text appended to a retry so the model can correct itself. */
export function retryHint(error?: string): string {
  return error
    ? `\n\nYour previous answer was invalid (${error}). Reply with valid JSON only, exactly matching the schema.`
    : '';
}
