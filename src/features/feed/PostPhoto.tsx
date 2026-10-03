import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useMediaUrl } from '@/app/useProfile';
import { isPackPhoto, packPhotoUrl } from '@/lib/photos';
import { usePackPhoto } from './usePackPhoto';

/** A post photo: the user's own (Blob in IndexedDB) or one from the CC0 pack. */
export function PostPhoto({ photo, alt }: { photo: string; alt?: string }) {
  const pack = usePackPhoto(photo);
  const userUrl = useMediaUrl(isPackPhoto(photo) ? undefined : photo);
  const src = pack ? packPhotoUrl(pack) : userUrl;
  const ratio = pack ? `${pack.width} / ${pack.height}` : undefined;
  if (!src) return <Skeleton variant="rectangular" height={280} />;
  return (
    <Box
      component="img"
      src={src}
      alt={pack?.alt ?? alt ?? 'Photo'}
      loading="lazy"
      decoding="async"
      sx={{
        display: 'block',
        width: '100%',
        maxHeight: 640,
        aspectRatio: ratio,
        objectFit: 'cover',
        bgcolor: '#F2F2F2',
      }}
    />
  );
}
