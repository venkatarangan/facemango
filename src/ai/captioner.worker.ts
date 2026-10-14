/**
 * Photo captioner worker: Florence-2 via Transformers.js on WebGPU (or WASM). Loaded only when
 * the user posts a photo and their AI can't see images. The photo never leaves this worker; only
 * the model weights are fetched (Hugging Face) and the ONNX Runtime .wasm (our own origin).
 */
import {
  env,
  Florence2ForConditionalGeneration,
  Florence2Processor,
  RawImage,
  type PreTrainedModel,
  type ProgressInfo,
} from '@huggingface/transformers';
// Self-hosted ONNX Runtime: Vite emits this file as a hashed asset on our own origin.
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import {
  CAPTION_CACHE,
  CAPTION_DTYPE,
  CAPTION_MODEL_ID,
  CAPTION_TASK,
  CAPTION_WEIGHTS_BYTES,
  type CaptionDevice,
  type CaptionerRequest,
  type CaptionerResponse,
} from './captionModel';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.cacheKey = CAPTION_CACHE;
// Transformers.js points ONNX Runtime at jsDelivr by default; use our copy instead. The service
// worker caches it, so Transformers.js doesn't need its own copy.
env.useWasmCache = false;
if (env.backends.onnx.wasm)
  env.backends.onnx.wasm.wasmPaths = { wasm: new URL(ortWasmUrl, self.location.href).href };

const post = (message: CaptionerResponse) => self.postMessage(message);

let model: PreTrainedModel | null = null;
let processor: Florence2Processor | null = null;

async function load(device: CaptionDevice): Promise<void> {
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (info: ProgressInfo) => {
    if (info.status !== 'progress') return;
    files.set(info.file, { loaded: info.loaded, total: info.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    post({
      type: 'progress',
      progress: Math.min(0.99, loaded / Math.max(total, CAPTION_WEIGHTS_BYTES)),
    });
  };

  const [m, p] = await Promise.all([
    Florence2ForConditionalGeneration.from_pretrained(CAPTION_MODEL_ID, {
      dtype: { ...CAPTION_DTYPE },
      device,
      progress_callback,
    }),
    Florence2Processor.from_pretrained(CAPTION_MODEL_ID, { progress_callback }),
  ]);
  model = m;
  processor = p as Florence2Processor;
}

async function caption(image: Blob): Promise<string> {
  if (!model || !processor) throw new Error('The photo model is not loaded.');
  const raw = await RawImage.fromBlob(image);
  const inputs = await processor(raw, processor.construct_prompts(CAPTION_TASK));
  const ids = await model.generate({
    ...inputs,
    max_new_tokens: 60,
    num_beams: 1,
    do_sample: false,
  });
  const decoded = processor.batch_decode(ids as Parameters<typeof processor.batch_decode>[0], {
    skip_special_tokens: false,
  })[0]!;
  const result = processor.post_process_generation(decoded, CAPTION_TASK, raw.size);
  const text = result[CAPTION_TASK];
  return typeof text === 'string' ? text.trim() : '';
}

self.onmessage = async (event: MessageEvent<CaptionerRequest>) => {
  const message = event.data;
  try {
    if (message.type === 'load') {
      await load(message.device);
      post({ type: 'loaded' });
    } else {
      post({ type: 'caption', id: message.id, text: await caption(message.image) });
    }
  } catch (error) {
    post({
      type: 'error',
      id: message.type === 'caption' ? message.id : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
