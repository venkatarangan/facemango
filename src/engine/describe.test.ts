import type { AI } from '@/ai';

const ai = vi.hoisted(() => ({
  current: null as Partial<AI> | null,
  settings: { enabled: true },
}));

vi.mock('@/ai', () => ({ whenAIReady: async () => ai.current }));
vi.mock('@/ai/captioner', () => ({
  captionPhoto: vi.fn(async () => 'A dog looking out of a window.'),
  getPhotoDescriptionSettings: async () => ai.settings,
}));

// Test files share modules (isolate: false), so another file may already have loaded describe.ts
// with the real '@/ai'. Start from a fresh module graph so the mocks above apply.
vi.resetModules();
const { createUserPost, db, deleteAllData } = await import('@/db');
const { describeUserPhoto } = await import('./describe');
const { captionPhoto } = await import('@/ai/captioner');

function tier(multimodal: boolean) {
  const describeImage = vi.fn(async () => 'A bowl of noodles on a table.');
  ai.current = { tier: multimodal ? 'prompt-api' : 'webgpu', multimodal, describeImage };
  return describeImage;
}

const photoPost = () =>
  createUserPost({
    text: 'Lunch!',
    photo: new Blob(['img'], { type: 'image/webp' }),
    mentions: [],
  });

describe('describeUserPhoto (SPEC §8 #5)', () => {
  beforeEach(async () => {
    await deleteAllData();
    ai.settings = { enabled: true };
    vi.mocked(captionPhoto).mockClear();
    vi.mocked(captionPhoto).mockImplementation(async () => 'A dog looking out of a window.');
  });

  it('uses the built-in multimodal model on the Prompt API tier', async () => {
    const describeImage = tier(true);
    const post = await photoPost();
    await describeUserPhoto(post.id, post.photo!);
    expect(describeImage).toHaveBeenCalledOnce();
    expect(captionPhoto).not.toHaveBeenCalled();
    expect((await db.posts.get(post.id))?.photoDescription).toBe('A bowl of noodles on a table.');
  });

  it('uses the on-device captioner when the model cannot see images (WebGPU tier)', async () => {
    const describeImage = tier(false);
    const post = await photoPost();
    await describeUserPhoto(post.id, post.photo!);
    expect(describeImage).not.toHaveBeenCalled();
    expect(captionPhoto).toHaveBeenCalledOnce();
    expect((await db.posts.get(post.id))?.photoDescription).toBe('A dog looking out of a window.');
  });

  it('does nothing when the setting is off', async () => {
    const describeImage = tier(false);
    ai.settings = { enabled: false };
    const post = await photoPost();
    await describeUserPhoto(post.id, post.photo!);
    tier(true);
    await describeUserPhoto(post.id, post.photo!);
    expect(describeImage).not.toHaveBeenCalled();
    expect(captionPhoto).not.toHaveBeenCalled();
    expect((await db.posts.get(post.id))?.photoDescription).toBeUndefined();
  });

  it('leaves the post alone when describing fails', async () => {
    tier(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(captionPhoto).mockRejectedValueOnce(new Error('GPU lost'));
    const post = await photoPost();
    await expect(describeUserPhoto(post.id, post.photo!)).resolves.toBeUndefined();
    vi.mocked(captionPhoto).mockResolvedValueOnce(null);
    await describeUserPhoto(post.id, post.photo!);
    expect((await db.posts.get(post.id))?.photoDescription).toBeUndefined();
  });

  it('never describes the same photo twice', async () => {
    tier(false);
    const post = await photoPost();
    await Promise.all([
      describeUserPhoto(post.id, post.photo!),
      describeUserPhoto(post.id, post.photo!),
    ]);
    await describeUserPhoto(post.id, post.photo!);
    expect(captionPhoto).toHaveBeenCalledOnce();

    // Another post with the same photo reuses the stored description.
    const copy = { ...(await db.posts.get(post.id))!, id: 'copy', photoDescription: undefined };
    await db.posts.add(copy);
    await describeUserPhoto(copy.id, copy.photo!);
    expect(captionPhoto).toHaveBeenCalledOnce();
    expect((await db.posts.get('copy'))?.photoDescription).toBe('A dog looking out of a window.');
  });
});
