import { z } from 'zod';

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
): Promise<T> {
  let lastOutput = '';
  let lastError: string | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    lastOutput = await generate(attempt, lastError);
    try {
      const parsed = schema.safeParse(extractJson(lastOutput));
      if (parsed.success) return parsed.data;
      lastError = z.prettifyError(parsed.error).slice(0, 400);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
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
