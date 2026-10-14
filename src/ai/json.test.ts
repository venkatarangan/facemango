import { z } from 'zod';
import {
  AIOutputError,
  extractJson,
  generateValidated,
  jsonEnd,
  OutputTooLongError,
  toJsonSchema,
} from './json';

describe('extractJson', () => {
  it('handles think blocks, code fences and surrounding prose', () => {
    expect(extractJson('<think>\n\n</think>\n{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] });
    expect(extractJson('Sure! Here it is: {"ok":true} Hope that helps.')).toEqual({ ok: true });
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('generateValidated', () => {
  const schema = z.object({ name: z.string().min(2) });

  it('retries with the validation error until the output is valid', async () => {
    const outputs = ['not json', '{"name":"A"}', '{"name":"Asha"}'];
    const hints: (string | undefined)[] = [];
    const result = await generateValidated(async (attempt, error) => {
      hints.push(error);
      return outputs[attempt]!;
    }, schema);
    expect(result).toEqual({ name: 'Asha' });
    expect(hints[0]).toBeUndefined();
    expect(hints[2]).toBeTruthy();
  });

  it('traces every attempt with its raw output and validation error', async () => {
    const outputs = ['oops', '{"name":"Asha"}'];
    const trace = vi.fn();
    await generateValidated(async (attempt) => outputs[attempt]!, schema, 3, trace);
    expect(trace).toHaveBeenCalledTimes(2);
    expect(trace.mock.calls[0]![0]).toMatchObject({ kind: 'attempt', attempt: 0, raw: 'oops' });
    expect(trace.mock.calls[0]![0].error).toBeTruthy();
    expect(trace.mock.calls[1]![0].error).toBeUndefined();
  });

  it('gives up after the attempts with AIOutputError', async () => {
    await expect(generateValidated(async () => '{}', schema, 2)).rejects.toBeInstanceOf(
      AIOutputError,
    );
  });
});

describe('jsonEnd', () => {
  it('finds the end of the first complete object or array, ignoring brackets in strings', () => {
    expect(jsonEnd('{"a":[1,{"b":"}"}]}\n\n\n')).toBe(19);
    expect(jsonEnd(' [1,2] tail')).toBe(6);
    expect(jsonEnd('{"a":"x\\"}"')).toBe(-1);
    expect(jsonEnd('{"a":[1,2')).toBe(-1);
    expect(jsonEnd('no json')).toBe(-1);
  });
});

describe('generateValidated with a cut-off reply', () => {
  it('retries an OutputTooLongError with a "keep it short" hint', async () => {
    const hints: (string | undefined)[] = [];
    const result = await generateValidated(
      async (attempt, error) => {
        hints.push(error);
        if (attempt === 0) throw new OutputTooLongError('{"name":"Ash');
        return '{"name":"Asha"}';
      },
      z.object({ name: z.string() }),
    );
    expect(result).toEqual({ name: 'Asha' });
    expect(hints[1]).toMatch(/too long/);
  });
});

describe('toJsonSchema', () => {
  it('produces a schema without $schema', () => {
    const json = toJsonSchema(schema());
    expect(json.$schema).toBeUndefined();
    expect(json.type).toBe('object');
  });
  function schema() {
    return z.object({ a: z.string() });
  }
});
