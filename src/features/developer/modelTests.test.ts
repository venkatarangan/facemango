import { MockProvider } from '@/ai/mockProvider';
import { queue, setAITrace, wrapProvider } from '@/ai/service';
import { createUserPost, db, deleteAllData, saveProfile } from '@/db';
import {
  MODEL_TESTS,
  resultsToMarkdown,
  runModelTest,
  TEST_USER,
  type TestResult,
} from './modelTests';

beforeEach(() => deleteAllData());

/** Every row of every table, for before/after comparison. */
async function snapshot() {
  const tables = await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()]));
  return JSON.stringify(tables);
}

describe('developer real-model tests (mock model)', () => {
  it('run every test without writing anything to the database', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await saveProfile({ name: 'Asha', age: 30, city: 'Madurai', languages: ['Tamil'] });
    await createUserPost({ text: 'My first post', mentions: [] });
    const before = await snapshot();

    const provider = new MockProvider();
    const ai = wrapProvider(provider);
    const results: TestResult[] = [];
    for (const test of MODEL_TESTS) {
      results.push(
        await runModelTest(
          test,
          {
            ai,
            provider,
            acquire: (signal) => queue.acquire('interactive', signal),
            user: TEST_USER,
            signal: new AbortController().signal,
          },
          setAITrace,
        ),
      );
    }

    expect(await snapshot()).toBe(before);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId.engagement!.status).toBe('pass');
    expect(byId['chat-stream']!.status).toBe('pass');
    expect(byId['chat-generate']!.status).toBe('pass');
    expect(byId['chat-app']!.status).toBe('pass');
    expect(byId.photo!.status).toBe('skipped'); // the mock can't see images
    // JSON tests are traced: attempts, Zod results and timings come through.
    expect(byId['friend-post']!.attempts).toHaveLength(3);
    expect(byId['friend-post']!.valid).toBe(3);
    expect(byId['friend-post']!.retries).toBe(0);
    expect(byId['friend-post']!.repetition).toBeGreaterThanOrEqual(0);
    expect(byId.comments!.tone?.target).toEqual({
      good: 60,
      appreciative: 25,
      nonsense: 10,
      critical: 5,
    });
    expect(byId.comments!.tone?.requested.good).toBeGreaterThan(0);

    const markdown = resultsToMarkdown(
      { model: 'Mock', tier: 'webgpu', device: ['Browser: test'], app: 'FaceMango', at: 'now' },
      results,
    );
    expect(markdown).toMatch(/^# FaceMango real-model test/);
    expect(markdown).toContain('| Friend posts | PASS |');
  });

  it('marks a cancelled run as cancelled', async () => {
    const provider = new MockProvider();
    const controller = new AbortController();
    controller.abort();
    const result = await runModelTest(
      MODEL_TESTS[0]!,
      {
        ai: wrapProvider(provider),
        provider,
        acquire: (signal) => queue.acquire('interactive', signal),
        user: TEST_USER,
        signal: controller.signal,
      },
      setAITrace,
    );
    expect(result.status).toBe('cancelled');
  });

  it('shows the full error when streaming fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = new MockProvider();
    // eslint-disable-next-line require-yield
    provider.stream = async function* () {
      throw new TypeError('Cannot read properties of undefined (reading "delta")');
    };
    await saveProfile({ name: 'Asha', age: 30, city: 'Madurai', languages: ['Tamil'] });
    const ctx = {
      ai: wrapProvider(provider),
      provider,
      acquire: (signal?: AbortSignal) => queue.acquire('interactive', signal),
      user: TEST_USER,
      signal: new AbortController().signal,
    };
    const raw = await runModelTest(
      MODEL_TESTS.find((t) => t.id === 'chat-stream')!,
      ctx,
      setAITrace,
    );
    expect(raw.status).toBe('fail');
    expect(raw.errors[0]).toMatch(/TypeError: Cannot read properties[\s\S]*Stack:/);

    const app = await runModelTest(
      MODEL_TESTS.find((t) => t.id === 'chat-app')!,
      ctx,
      setAITrace,
    );
    expect(app.status).toBe('pass');
    expect(app.note).toMatch(/fell back/);
    expect(app.errors.join('\n')).toMatch(/Streaming failed, fell back:\nTypeError/);
  });
});
