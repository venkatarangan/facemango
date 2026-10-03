import { detectTier } from './detect';

const desktopUA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const androidUA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';

function stubNavigator(userAgent: string, gpu?: unknown) {
  vi.stubGlobal('navigator', {
    userAgent,
    maxTouchPoints: userAgent.includes('Android') ? 5 : 0,
    gpu,
  });
}

const adapter = (f16: boolean) => ({
  requestAdapter: async () => ({
    features: { has: (f: string) => f16 && f === 'shader-f16' },
    limits: { maxBufferSize: 2 ** 31, maxStorageBufferBindingSize: 2 ** 30 },
  }),
});

afterEach(() => vi.unstubAllGlobals());

describe('detectTier (SPEC §5.1)', () => {
  it('prefers the Prompt API on desktop when available', async () => {
    stubNavigator(desktopUA, adapter(true));
    vi.stubGlobal('LanguageModel', { availability: async () => 'downloadable' });
    await expect(detectTier()).resolves.toEqual({
      tier: 'prompt-api',
      availability: 'downloadable',
    });
  });

  it('falls back to WebGPU with the desktop model', async () => {
    stubNavigator(desktopUA, adapter(true));
    vi.stubGlobal('LanguageModel', { availability: async () => 'unavailable' });
    const result = await detectTier();
    expect(result).toMatchObject({
      tier: 'webgpu',
      models: ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-1.7B-q4f32_1-MLC'],
    });
  });

  it('uses the small model on phones and skips f16 builds without shader-f16', async () => {
    stubNavigator(androidUA, adapter(false));
    const result = await detectTier();
    expect(result).toMatchObject({ tier: 'webgpu', models: ['Qwen3-0.6B-q4f32_1-MLC'] });
  });

  it('reports unsupported without built-in AI or WebGPU', async () => {
    stubNavigator(desktopUA, undefined);
    expect((await detectTier()).tier).toBe('unsupported');
  });
});
