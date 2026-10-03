import { useEffect, useState } from 'react';
import { isPackPhoto, loadPhotoManifest, packPhotoId, type PackPhoto } from '@/lib/photos';

export function usePackPhoto(ref?: string): PackPhoto | undefined {
  const [photo, setPhoto] = useState<PackPhoto>();
  useEffect(() => {
    if (!isPackPhoto(ref)) return;
    let alive = true;
    void loadPhotoManifest().then(
      (photos) => alive && setPhoto(photos.find((p) => p.id === packPhotoId(ref!))),
    );
    return () => {
      alive = false;
    };
  }, [ref]);
  return isPackPhoto(ref) ? photo : undefined;
}
