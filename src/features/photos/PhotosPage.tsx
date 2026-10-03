import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import { db, ME, type Post } from '@/db';
import { useAuthors } from '@/features/feed/useAuthors';
import {
  isPackPhoto,
  loadPhotoManifest,
  packPhotoId,
  packPhotoUrl,
  type PackPhoto,
} from '@/lib/photos';
import { Lightbox, type LightboxItem } from './Lightbox';

/** Object URLs for the user's own photos (Blobs in IndexedDB), revoked on change. */
function useUserPhotoUrls(posts: Post[]): Map<string, string> {
  const ids = posts.filter((p) => p.photo && !isPackPhoto(p.photo)).map((p) => p.photo!);
  const key = ids.join(',');
  const blobs = useLiveQuery(() => db.media.bulkGet(ids), [key]);
  const [urls, setUrls] = useState(new Map<string, string>());
  useEffect(() => {
    const next = new Map<string, string>();
    blobs?.forEach((m) => m && next.set(m.id, URL.createObjectURL(m.blob)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs must be created and revoked together
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [blobs]);
  return urls;
}

/** Photos (SPEC §3.8): masonry grid of your photos and friends' photos with a lightbox. */
export function PhotosPage() {
  const authors = useAuthors();
  const [tab, setTab] = useState<'mine' | 'friends'>('mine');
  const [open, setOpen] = useState<number | null>(null);
  const [pack, setPack] = useState<PackPhoto[]>([]);
  const posts = useLiveQuery(
    () =>
      db.posts
        .orderBy('createdAt')
        .reverse()
        .filter((p) => !!p.photo)
        .toArray(),
    [],
  );
  useEffect(() => {
    void loadPhotoManifest().then(setPack);
  }, []);
  const urls = useUserPhotoUrls(posts ?? []);

  const items: LightboxItem[] = useMemo(() => {
    const list = (posts ?? []).filter((p) =>
      tab === 'mine' ? p.authorId === ME : p.authorId !== ME,
    );
    return list.flatMap((p) => {
      const name = authors?.get(p.authorId)?.name ?? 'Someone';
      if (isPackPhoto(p.photo)) {
        const photo = pack.find((x) => x.id === packPhotoId(p.photo!));
        return photo
          ? [
              {
                key: p.id,
                src: packPhotoUrl(photo),
                alt: photo.alt,
                caption: `${name}: ${p.text}`.slice(0, 160),
                postId: p.id,
              },
            ]
          : [];
      }
      const src = urls.get(p.photo!);
      return src
        ? [
            {
              key: p.id,
              src,
              alt: p.photoDescription ?? 'Your photo',
              caption: p.text.slice(0, 160) || 'Your photo',
              postId: p.id,
            },
          ]
        : [];
    });
  }, [posts, tab, pack, urls, authors]);

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ px: { xs: 0.5, sm: 0 } }}>
        Photos
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        aria-label="Whose photos"
        sx={{ '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 3 } }}
      >
        <Tab
          value="mine"
          label="Your photos"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: 'text.primary' } }}
        />
        <Tab
          value="friends"
          label="Friends' photos"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: 'text.primary' } }}
        />
      </Tabs>
      {items.length === 0 ? (
        <Card>
          <Stack spacing={1} sx={{ alignItems: 'center', py: 6, px: 2, textAlign: 'center' }}>
            <PhotoLibraryRounded sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary">
              {tab === 'mine'
                ? 'Photos you post will appear here.'
                : 'Photos your friends share will appear here.'}
            </Typography>
          </Stack>
        </Card>
      ) : (
        <Box sx={{ columnCount: { xs: 2, sm: 3 }, columnGap: 1 }}>
          {items.map((item, i) => (
            <ButtonBase
              key={item.key}
              onClick={() => setOpen(i)}
              aria-label={`Open photo: ${item.alt}`}
              sx={{
                display: 'block',
                width: '100%',
                mb: 1,
                breakInside: 'avoid',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={item.src}
                alt={item.alt}
                loading="lazy"
                sx={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  transition: 'transform 200ms',
                  '&:hover': { transform: 'scale(1.03)' },
                }}
              />
            </ButtonBase>
          ))}
        </Box>
      )}
      {open !== null && (
        <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </Stack>
  );
}
