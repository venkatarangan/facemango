/** Model choices only. No WebLLM import here: the 6 MB library loads lazily with the provider. */
/** WebLLM models FaceMango uses (SPEC §5.1), best first per device class. */
export const DESKTOP_MODELS = ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3-1.7B-q4f32_1-MLC'] as const;
export const MOBILE_MODELS = ['gemma3-1b-it-q4f16_1-MLC', 'Qwen3-0.6B-q4f32_1-MLC'] as const;

export type WebLLMModelId = (typeof DESKTOP_MODELS)[number] | (typeof MOBILE_MODELS)[number];

export const MODEL_LABELS: Record<WebLLMModelId, string> = {
  'Qwen3-1.7B-q4f16_1-MLC': 'Qwen3 1.7B',
  'Qwen3-1.7B-q4f32_1-MLC': 'Qwen3 1.7B (f32)',
  'gemma3-1b-it-q4f16_1-MLC': 'Gemma 3 1B',
  'Qwen3-0.6B-q4f32_1-MLC': 'Qwen3 0.6B (f32)',
};

/** Picks a model for the adapter: f16 builds need the shader-f16 feature. */
export function chooseWebLLMModel(isMobile: boolean, supportsF16: boolean): WebLLMModelId[] {
  const list = isMobile ? MOBILE_MODELS : DESKTOP_MODELS;
  const usable = list.filter((id) => supportsF16 || !id.includes('f16'));
  // Phones without f16 fall back to the desktop f32 list only as a last resort.
  return usable.length ? [...usable] : ['Qwen3-0.6B-q4f32_1-MLC'];
}

export const isQwen3 = (modelId: string) => modelId.startsWith('Qwen3-');
export const supportsSystemRole = (modelId: string) => !modelId.startsWith('gemma');
