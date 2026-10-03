import { db } from './db';
import { ME, type Profile } from './types';

export interface ProfileEdit {
  name: string;
  city: string;
  languages: string[];
  bio?: string;
  /** New photo, or null to remove the current one. undefined = unchanged. */
  photo?: Blob | null;
}

export async function updateProfile(edit: ProfileEdit): Promise<void> {
  await db.transaction('rw', db.profile, db.media, async () => {
    const profile = await db.profile.get(ME);
    if (!profile) return;
    const patch: Partial<Profile> = {
      name: edit.name.trim(),
      city: edit.city.trim(),
      languages: edit.languages,
      bio: edit.bio?.trim() || undefined,
    };
    if (edit.photo !== undefined) {
      if (profile.photoId) await db.media.delete(profile.photoId);
      patch.photoId = undefined;
      if (edit.photo) {
        const id = crypto.randomUUID();
        await db.media.add({
          id,
          kind: 'profilePhoto',
          blob: edit.photo,
          mimeType: edit.photo.type || 'image/webp',
          createdAt: Date.now(),
        });
        patch.photoId = id;
      }
    }
    await db.profile.update(ME, patch);
  });
}
