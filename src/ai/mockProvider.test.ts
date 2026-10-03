import type { z } from 'zod';
import {
  commentBatchSchema,
  friendBatchSchema,
  friendPostSchema,
  publicBatchSchema,
} from '@/engine/prompts';
import { MockProvider } from './mockProvider';

describe('MockProvider (test-only)', () => {
  it('fabricates output that validates against every engine schema', async () => {
    const mock = await MockProvider.load(() => {});
    const schemas: z.ZodType[] = [
      friendBatchSchema,
      publicBatchSchema,
      friendPostSchema,
      commentBatchSchema,
    ];
    for (const schema of schemas) {
      await expect(mock.generateJSON('prompt', schema)).resolves.toBeTruthy();
    }
  });
});
