import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ME, type Profile } from '@/db';

/** The user's profile: `undefined` while loading, `null` before signup. */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await db.profile.get(ME)) ?? null, []);
}

/** Object URL for a stored media Blob. */
export function useMediaUrl(mediaId: string | undefined): string | undefined {
  const blob = useLiveQuery(
    async () => (mediaId ? (await db.media.get(mediaId))?.blob : undefined),
    [mediaId],
  );
  return useObjectUrl(blob);
}

/** Object URL for a Blob, revoked when the Blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | undefined | null): string | undefined {
  const [entry, setEntry] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // Object URLs are an external resource: create and revoke them in the same effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return blob && entry?.blob === blob ? entry.url : undefined;
}
