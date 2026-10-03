import { isAndroid, isIOS } from '@/lib/platform';
import { chooseWebLLMModel, type WebLLMModelId } from './models';
import { promptApiAvailability } from './promptApi';

export type Detection =
  | { tier: 'prompt-api'; availability: Exclude<LanguageModelAvailability, 'unavailable'> }
  | { tier: 'webgpu'; models: WebLLMModelId[] }
  | { tier: 'unsupported'; reason: string };

export function isMobileDevice(nav: Navigator = navigator): boolean {
  return isIOS(nav) || isAndroid(nav) || /Mobi/i.test(nav.userAgent);
}

/** SPEC §5.1: Prompt API first (desktop Chrome/Edge), then WebGPU, else unsupported. */
export async function detectTier(options: { skipPromptApi?: boolean } = {}): Promise<Detection> {
  const mobile = isMobileDevice();
  if (!mobile && !options.skipPromptApi) {
    const availability = await promptApiAvailability();
    if (availability !== 'unavailable') return { tier: 'prompt-api', availability };
  }
  if (!navigator.gpu) {
    return { tier: 'unsupported', reason: 'This browser has no built-in AI and no WebGPU.' };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter)
      return { tier: 'unsupported', reason: 'WebGPU is present but no GPU adapter is available.' };
    return {
      tier: 'webgpu',
      models: chooseWebLLMModel(mobile, adapter.features.has('shader-f16')),
    };
  } catch {
    return { tier: 'unsupported', reason: 'WebGPU could not be initialised.' };
  }
}
