/**
 * Photo-aware comments for browsers whose AI can't see images (SPEC §8 #5): a small captioning
 * model (captionModel.ts) runs once per uploaded photo in its own Web Worker. The worker and its
 * library load lazily on the first photo, the GPU step waits for the text model to be idle (the
 * shared queue), and the worker is shut down after use so its memory is freed.
 */
import { create } from 'zustand';
import { db } from '@/db';
import {
  CAPTION_CACHE,
  type CaptionDevice,
  type CaptionerRequest,
  type CaptionerResponse,
} from './captionModel';
import { isMobileDevice } from './detect';
import { queue } from './service';

export type CaptionerStatus =
  'idle' | 'downloading' | 'ready' | 'working' | 'error' | 'unavailable';

export interface CaptionerState {
  status: CaptionerStatus;
  /** 0..1 while downloading/loading. */
  progress: number;
  device?: CaptionDevice;
  /** Why the last attempt failed, or why this device is skipped. */
  error?: string;
}

export const useCaptionerStore = create<CaptionerState>(() => ({ status: 'idle', progress: 0 }));
const setState = (patch: Partial<CaptionerState>) => useCaptionerStore.setState(patch);

// ---------- Setting (Settings → On-device AI) ----------

const KEY = 'photoDescriptions';

export interface PhotoDescriptionSettings {
  /** "Describe my photos so friends can comment on them" (on by default). */
  enabled: boolean;
  /** Set while the model loads or runs; still set on the next run means the tab was killed. */
  pendingSince?: number;
  /** Loads/runs that never finished (phones only). Two of them skip the feature on this device. */
  interrupted?: number;
}

export async function getPhotoDescriptionSettings(): Promise<PhotoDescriptionSettings> {
  const stored = (await db.settings.get(KEY))?.value as
    Partial<PhotoDescriptionSettings> | undefined;
  return { enabled: true, ...stored };
}

async function savePhotoDescriptionSettings(patch: Partial<PhotoDescriptionSettings>) {
  await db.settings.put({
    key: KEY,
    value: { ...(await getPhotoDescriptionSettings()), ...patch },
  });
}

/** Turning it on again also clears an earlier "skipped on this device". */
export async function setPhotoDescriptionsEnabled(enabled: boolean): Promise<void> {
  await savePhotoDescriptionSettings({ enabled, interrupted: 0, pendingSince: undefined });
  if (enabled && useCaptionerStore.getState().status === 'unavailable')
    setState({ status: 'idle', error: undefined });
  if (!enabled) dispose();
}

// ---------- Backend (the worker; replaceable in tests and the e2e mock build) ----------

export interface CaptionBackend {
  load(device: CaptionDevice, onProgress: (progress: number) => void): Promise<void>;
  caption(image: Blob): Promise<string>;
  dispose(): void;
}

class WorkerBackend implements CaptionBackend {
  private worker = new Worker(new URL('./captioner.worker.ts', import.meta.url), {
    type: 'module',
  });
  private nextId = 1;
  private pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>();
  private loading?: { resolve: () => void; reject: (e: Error) => void };
  private onProgress?: (progress: number) => void;

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<CaptionerResponse>) => {
      if (data.type === 'progress') this.onProgress?.(data.progress);
      else if (data.type === 'loaded') this.loading?.resolve();
      else if (data.type === 'caption') this.settle(data.id)?.resolve(data.text);
      else {
        const error = new Error(data.message);
        if (data.id === undefined) this.loading?.reject(error);
        else this.settle(data.id)?.reject(error);
      }
    };
    this.worker.onerror = (event) =>
      this.fail(new Error(event.message || 'The photo model crashed.'));
  }

  private settle(id: number) {
    const entry = this.pending.get(id);
    this.pending.delete(id);
    return entry;
  }

  private fail(error: Error) {
    this.loading?.reject(error);
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
  }

  private send(message: CaptionerRequest) {
    this.worker.postMessage(message);
  }

  load(device: CaptionDevice, onProgress: (progress: number) => void): Promise<void> {
    this.onProgress = onProgress;
    return new Promise((resolve, reject) => {
      this.loading = { resolve, reject };
      this.send({ type: 'load', device });
    });
  }

  caption(image: Blob): Promise<string> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: 'caption', id, image });
    });
  }

  dispose() {
    this.fail(new Error('The photo model was closed.'));
    this.worker.terminate();
  }
}

export interface DeviceInfo {
  mobile: boolean;
  webgpu: boolean;
  /** GB, where the browser reports it (Chromium only). */
  memoryGB?: number;
}

function deviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { mobile: isMobileDevice(nav), webgpu: !!nav.gpu, memoryGB: nav.deviceMemory };
}

async function defaultBackend(): Promise<CaptionBackend> {
  if (import.meta.env.VITE_MOCK_AI === '1') {
    const { MockCaptionBackend } = await import('./mockProvider');
    return new MockCaptionBackend();
  }
  return new WorkerBackend();
}

// The e2e mock build behaves like a desktop with WebGPU on every emulated device.
const defaultDevice = (): DeviceInfo =>
  import.meta.env.VITE_MOCK_AI === '1' ? { mobile: false, webgpu: true } : deviceInfo();

let createBackend: () => Promise<CaptionBackend> = defaultBackend;
let getDevice: () => DeviceInfo = defaultDevice;

/** Tests only: swap the worker and the device facts. */
export function configureCaptioner(options: {
  createBackend?: () => Promise<CaptionBackend>;
  device?: () => DeviceInfo;
}): void {
  dispose();
  createBackend = options.createBackend ?? defaultBackend;
  getDevice = options.device ?? defaultDevice;
  setState({ status: 'idle', progress: 0, device: undefined, error: undefined });
}

// ---------- Captioning ----------

/** Phones below this report too little memory to hold a second model. */
const MIN_MOBILE_MEMORY_GB = 4;
/** Desktop keeps the model for a minute in case more photos follow; phones free it at once. */
const DESKTOP_IDLE_MS = 60_000;

let backend: { instance: CaptionBackend; device: CaptionDevice } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<unknown> = Promise.resolve();
let pendingThisSession = false;

function dispose() {
  clearTimeout(idleTimer);
  backend?.instance.dispose();
  backend = null;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function loadBackend(
  info: DeviceInfo,
): Promise<{ instance: CaptionBackend; device: CaptionDevice }> {
  // WebGPU first. Desktop falls back to WASM (CPU); phones don't, as it needs a lot of memory.
  const devices: CaptionDevice[] = info.webgpu ? ['webgpu'] : [];
  if (!info.mobile) devices.push('wasm');
  if (!devices.length) throw new Error('This device has no WebGPU for the photo model.');
  let lastError: unknown;
  for (const device of devices) {
    const instance = await createBackend();
    try {
      setState({ status: 'downloading', progress: 0, device, error: undefined });
      await instance.load(device, (progress) => setState({ progress }));
      return { instance, device };
    } catch (error) {
      console.warn(`Photo model failed on ${device}`, error);
      instance.dispose();
      lastError = error;
    }
  }
  throw lastError;
}

async function describe(image: Blob): Promise<string | null> {
  const settings = await getPhotoDescriptionSettings();
  if (!settings.enabled) return null;
  const info = getDevice();

  if (info.mobile && info.memoryGB !== undefined && info.memoryGB < MIN_MOBILE_MEMORY_GB) {
    setState({
      status: 'unavailable',
      error: 'This phone has too little memory for the photo model.',
    });
    return null;
  }
  if (info.mobile) {
    // A phone that killed the tab twice while the model ran gets skipped from now on.
    let interrupted = settings.interrupted ?? 0;
    if (settings.pendingSince && !pendingThisSession) {
      interrupted += 1;
      await savePhotoDescriptionSettings({ interrupted, pendingSince: undefined });
    }
    if (interrupted >= 2) {
      setState({
        status: 'unavailable',
        error: 'The photo model stopped twice on this device, so it is skipped.',
      });
      return null;
    }
    pendingThisSession = true;
    await savePhotoDescriptionSettings({ pendingSince: Date.now() });
  }

  clearTimeout(idleTimer);
  try {
    backend ??= await loadBackend(info);
    const { instance, device } = backend;
    setState({ status: 'working', progress: 1, device });
    // The GPU step waits until the text model is idle, then jumps ahead of background comments.
    const text =
      device === 'webgpu'
        ? await queue.run(() => instance.caption(image), 'interactive')
        : await instance.caption(image);
    setState({ status: 'ready', error: undefined });
    return text.trim() || null;
  } catch (error) {
    console.warn('Could not describe photo', error);
    dispose();
    setState({ status: 'error', error: message(error).slice(0, 200) });
    return null;
  } finally {
    if (info.mobile) {
      pendingThisSession = false;
      await savePhotoDescriptionSettings({ pendingSince: undefined });
    }
    if (backend) {
      if (info.mobile) dispose();
      else idleTimer = setTimeout(dispose, DESKTOP_IDLE_MS);
    }
  }
}

/**
 * Describes one photo in a sentence, or returns null (turned off, unsupported, or failed).
 * Calls run one at a time so the model is downloaded and loaded only once.
 */
export function captionPhoto(image: Blob): Promise<string | null> {
  const run = chain.then(() => describe(image));
  chain = run.catch(() => null);
  return run;
}

/** Whether the photo model's weights are in this browser's cache. */
export async function isPhotoModelDownloaded(): Promise<boolean> {
  try {
    return typeof caches !== 'undefined' && (await caches.has(CAPTION_CACHE));
  } catch {
    return false;
  }
}

/** Settings → "Delete photo model". It downloads again the next time a photo needs it. */
export async function deletePhotoModel(): Promise<boolean> {
  dispose();
  setState({ status: 'idle', progress: 0, error: undefined });
  try {
    return typeof caches !== 'undefined' && (await caches.delete(CAPTION_CACHE));
  } catch {
    return false;
  }
}
