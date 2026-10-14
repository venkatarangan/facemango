import { db, deleteAllData } from '@/db';
import type { CaptionDevice } from './captionModel';
import {
  captionPhoto,
  configureCaptioner,
  setPhotoDescriptionsEnabled,
  useCaptionerStore,
  type CaptionBackend,
  type DeviceInfo,
} from './captioner';
import { queue } from './service';

const DESKTOP: DeviceInfo = { mobile: false, webgpu: true };
const PHONE: DeviceInfo = { mobile: true, webgpu: true, memoryGB: 8 };
const image = new Blob(['img'], { type: 'image/webp' });

function fakeBackends(failOn: CaptionDevice[] = []) {
  const created: (CaptionBackend & { [K in keyof CaptionBackend]: ReturnType<typeof vi.fn> })[] =
    [];
  const createBackend = async () => {
    const backend = {
      load: vi.fn(async (device: CaptionDevice, onProgress: (p: number) => void) => {
        onProgress(0.5);
        if (failOn.includes(device)) throw new Error(`${device} failed`);
      }),
      caption: vi.fn(async () => ' A cat asleep on a sofa. '),
      dispose: vi.fn(),
    };
    created.push(backend);
    return backend;
  };
  return { created, createBackend };
}

function setup(device: DeviceInfo, failOn: CaptionDevice[] = []) {
  const fakes = fakeBackends(failOn);
  configureCaptioner({ createBackend: fakes.createBackend, device: () => device });
  return fakes.created;
}

describe('photo captioner', () => {
  beforeEach(async () => {
    await deleteAllData();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => configureCaptioner({}));

  it('downloads once on first need, then reuses the model', async () => {
    const created = setup(DESKTOP);
    expect(created).toHaveLength(0);
    await expect(captionPhoto(image)).resolves.toBe('A cat asleep on a sofa.');
    await expect(captionPhoto(image)).resolves.toBe('A cat asleep on a sofa.');
    expect(created).toHaveLength(1);
    expect(created[0]!.load).toHaveBeenCalledWith('webgpu', expect.any(Function));
    expect(created[0]!.caption).toHaveBeenCalledTimes(2);
    expect(useCaptionerStore.getState()).toMatchObject({ status: 'ready', device: 'webgpu' });
  });

  it('waits for the text model to be idle before using the GPU', async () => {
    const created = setup(DESKTOP);
    const release = await queue.acquire('background');
    const result = captionPhoto(image);
    await vi.waitFor(() => expect(created[0]?.load).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(created[0]!.caption).not.toHaveBeenCalled();
    release();
    await expect(result).resolves.toBe('A cat asleep on a sofa.');
  });

  it('does nothing when turned off', async () => {
    const created = setup(DESKTOP);
    await setPhotoDescriptionsEnabled(false);
    await expect(captionPhoto(image)).resolves.toBeNull();
    expect(created).toHaveLength(0);
  });

  it('falls back to WASM on desktop when WebGPU fails', async () => {
    const created = setup(DESKTOP, ['webgpu']);
    await expect(captionPhoto(image)).resolves.toBe('A cat asleep on a sofa.');
    expect(created).toHaveLength(2);
    expect(created[0]!.dispose).toHaveBeenCalled();
    expect(created[1]!.load).toHaveBeenCalledWith('wasm', expect.any(Function));
  });

  it('reports a failure and returns null without throwing', async () => {
    setup(PHONE, ['webgpu']);
    await expect(captionPhoto(image)).resolves.toBeNull();
    expect(useCaptionerStore.getState()).toMatchObject({
      status: 'error',
      error: 'webgpu failed',
    });
  });

  it('skips phones that report too little memory', async () => {
    const created = setup({ ...PHONE, memoryGB: 2 });
    await expect(captionPhoto(image)).resolves.toBeNull();
    expect(created).toHaveLength(0);
    expect(useCaptionerStore.getState().status).toBe('unavailable');
  });

  it('frees the model straight after use on phones', async () => {
    const created = setup(PHONE);
    await captionPhoto(image);
    expect(created[0]!.dispose).toHaveBeenCalled();
    expect((await db.settings.get('photoDescriptions'))?.value).toMatchObject({
      pendingSince: undefined,
    });
  });

  it('skips a phone whose tab was killed twice while the model ran', async () => {
    const created = setup(PHONE);
    await db.settings.put({
      key: 'photoDescriptions',
      value: { enabled: true, pendingSince: 1, interrupted: 1 },
    });
    await expect(captionPhoto(image)).resolves.toBeNull();
    expect(created).toHaveLength(0);
    expect(useCaptionerStore.getState().status).toBe('unavailable');

    // Turning the setting on again gives it another try.
    await setPhotoDescriptionsEnabled(true);
    await expect(captionPhoto(image)).resolves.toBe('A cat asleep on a sofa.');
  });
});
