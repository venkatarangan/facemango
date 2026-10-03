import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useGesture } from '@use-gesture/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';

export interface LightboxItem {
  key: string;
  src: string;
  alt: string;
  caption: string;
  postId?: string;
}

/** Full-screen photo viewer: swipe between photos, pinch or double-tap to zoom (SPEC §3.8). */
export function Lightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const item = items[index];

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    onIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useGesture(
    {
      onDrag: ({ last, movement: [mx, my], swipe: [sx], tap, offset: [ox, oy] }) => {
        if (tap) return;
        if (scale > 1) {
          setOffset({ x: ox, y: oy });
          return;
        }
        if (last && (sx !== 0 || Math.abs(mx) > 80)) go(sx !== 0 ? -sx : mx < 0 ? 1 : -1);
        else if (last && my > 120) onClose();
      },
      onPinch: ({ offset: [s] }) => setScale(Math.min(4, Math.max(1, s))),
      onDoubleClick: () => {
        setScale((s) => (s > 1 ? 1 : 2.5));
        setOffset({ x: 0, y: 0 });
      },
    },
    {
      target: stage,
      eventOptions: { passive: false },
      drag: { from: () => [offset.x, offset.y], filterTaps: true },
      pinch: { scaleBounds: { min: 1, max: 4 }, from: () => [scale, 0] },
    },
  );

  if (!item) return null;
  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      slotProps={{ paper: { sx: { bgcolor: '#000', color: '#fff' } } }}
      aria-label="Photo viewer"
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', p: 1, pt: 'calc(8px + env(safe-area-inset-top))' }}
      >
        <IconButton aria-label="Close" onClick={onClose} sx={{ color: '#fff' }}>
          <CloseRounded />
        </IconButton>
        <Typography sx={{ flex: 1, textAlign: 'center' }} variant="body2">
          {index + 1} / {items.length}
        </Typography>
        <Box sx={{ width: 40 }} />
      </Stack>
      <Box
        ref={stage}
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          display: 'grid',
          placeItems: 'center',
          userSelect: 'none',
        }}
      >
        <Box
          component="img"
          src={item.src}
          alt={item.alt}
          draggable={false}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: 'transform 120ms ease-out',
          }}
        />
        {index > 0 && (
          <IconButton
            aria-label="Previous photo"
            onClick={() => go(-1)}
            sx={{
              position: 'absolute',
              left: 8,
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.12)',
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            <ChevronLeftRounded />
          </IconButton>
        )}
        {index < items.length - 1 && (
          <IconButton
            aria-label="Next photo"
            onClick={() => go(1)}
            sx={{
              position: 'absolute',
              right: 8,
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.12)',
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          >
            <ChevronRightRounded />
          </IconButton>
        )}
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ p: 2, pb: 'calc(16px + env(safe-area-inset-bottom))', alignItems: 'center' }}
      >
        <Typography variant="body2" sx={{ flex: 1, opacity: 0.9 }}>
          {item.caption}
        </Typography>
        {item.postId && (
          <Button
            component={RouterLink}
            to={`/post/${item.postId}`}
            variant="contained"
            size="small"
            onClick={onClose}
          >
            View post
          </Button>
        )}
      </Stack>
    </Dialog>
  );
}
