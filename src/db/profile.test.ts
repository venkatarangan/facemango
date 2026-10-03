import { db } from './db';
import { deleteAllData, getProfile, saveProfile } from './profile';

afterEach(async () => {
  await deleteAllData();
});

describe('profile persistence', () => {
  it('saves the profile with its photo as a Blob', async () => {
    const photo = new Blob(['fake'], { type: 'image/webp' });
    const saved = await saveProfile(
      { name: 'Ravi', age: 40, city: 'Pune', languages: ['Marathi'], photo },
      1234,
    );
    expect(saved.photoId).toBeDefined();
    const media = await db.media.get(saved.photoId!);
    expect(media?.kind).toBe('profilePhoto');
    expect(media?.mimeType).toBe('image/webp');
    expect((await getProfile())?.dataNoticeAcknowledgedAt).toBe(1234);
  });

  it('deleteAllData clears everything', async () => {
    await saveProfile({ name: 'Ravi', age: 40, city: 'Pune', languages: ['Marathi'] });
    await deleteAllData();
    expect(await getProfile()).toBeUndefined();
  });
});
