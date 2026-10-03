import { db } from './db';
import { ME, type Profile } from './types';

export interface NewProfile {
  name: string;
  age: number;
  city: string;
  languages: string[];
  photo?: Blob;
}

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get(ME);
}

/** Creates (or replaces) the user's profile, storing the optional photo as a Blob. */
export async function saveProfile(input: NewProfile, now = Date.now()): Promise<Profile> {
  return db.transaction('rw', db.profile, db.media, async () => {
    let photoId: string | undefined;
    if (input.photo) {
      photoId = crypto.randomUUID();
      await db.media.add({
        id: photoId,
        kind: 'profilePhoto',
        blob: input.photo,
        mimeType: input.photo.type || 'image/webp',
        createdAt: now,
      });
    }
    const profile: Profile = {
      id: ME,
      name: input.name,
      age: input.age,
      city: input.city,
      languages: input.languages,
      photoId,
      createdAt: now,
      dataNoticeAcknowledgedAt: now,
    };
    await db.profile.put(profile);
    return profile;
  });
}

/** Wipes every table. Used by Settings → "Delete all data". */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
