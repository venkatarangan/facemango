/**
 * The on-device photo captioner for browsers whose AI can't see images (SPEC §5.1, §8 #5).
 * Constants only, shared by the main thread (captioner.ts) and the worker (captioner.worker.ts).
 *
 * Florence-2-base-ft (MIT, 0.23B) via Transformers.js. 4-bit weights, 8-bit embeddings:
 * ~218 MB from Hugging Face, plus the ~27 MB ONNX Runtime .wasm, which Vite emits as a hashed
 * asset on our own origin (Transformers.js would otherwise load it from jsDelivr).
 */
export const CAPTION_MODEL_ID = 'onnx-community/Florence-2-base-ft';

/** Per-module weights: works on WebGPU without shader-f16 and on WASM (CPU). */
export const CAPTION_DTYPE = {
  vision_encoder: 'q4',
  embed_tokens: 'int8',
  encoder_model: 'q4',
  // Transformers.js sizes the encoder under its session key when computing download progress.
  model: 'q4',
  decoder_model_merged: 'q4',
} as const;

/** Florence-2 task: one short sentence ("A dog looking out of a window."). */
export const CAPTION_TASK = '<CAPTION>';

/** Cache Storage bucket for the weights (Settings → "Delete photo model"). */
export const CAPTION_CACHE = 'facemango-photo-model';

/** Weights (~218 MB) + ONNX Runtime (~27 MB), shown in Settings. */
export const CAPTION_DOWNLOAD_MB = 245;
/** Weights only, for progress before every file size is known. */
export const CAPTION_WEIGHTS_BYTES = 218_000_000;

export type CaptionDevice = 'webgpu' | 'wasm';

export type CaptionerRequest =
  { type: 'load'; device: CaptionDevice } | { type: 'caption'; id: number; image: Blob };

export type CaptionerResponse =
  | { type: 'progress'; progress: number }
  | { type: 'loaded' }
  | { type: 'caption'; id: number; text: string }
  | { type: 'error'; id?: number; message: string };
