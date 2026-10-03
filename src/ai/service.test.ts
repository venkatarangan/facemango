import type { AIProvider } from './provider';
import { useAIStore, wrapProvider } from './service';

function fakeProvider(stream: () => AsyncIterable<string>): AIProvider {
  return {
    tier: 'webgpu',
    modelId: 'fake',
    generate: vi.fn(async () => 'whole reply'),
    generateJSON: vi.fn(),
    stream: vi.fn(stream),
  } as unknown as AIProvider;
}

async function collect(iter: AsyncIterable<string>) {
  let out = '';
  for await (const d of iter) out += d;
  return out;
}

describe('wrapProvider streaming', () => {
  it('streams normally when the backend streams', async () => {
    const ai = wrapProvider(
      fakeProvider(async function* () {
        yield 'Hello ';
        yield 'there';
      }),
    );
    await expect(collect(ai.stream('hi'))).resolves.toBe('Hello there');
  });

  it('falls back to a single reply when streaming fails before any text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = fakeProvider(async function* () {
      yield* [];
      throw new Error('stream broke');
    });
    const ai = wrapProvider(provider);
    await expect(collect(ai.stream('hi'))).resolves.toBe('whole reply');
    expect(provider.generate).toHaveBeenCalled();
    expect(useAIStore.getState().lastError).toMatch(/stream broke/);
  });

  it('falls back when streaming yields nothing', async () => {
    const provider = fakeProvider(async function* () {
      yield '';
    });
    await expect(collect(wrapProvider(provider).stream('hi'))).resolves.toBe('whole reply');
  });
});
