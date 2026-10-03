import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ThumbUpRounded from '@mui/icons-material/ThumbUpRounded';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import { brand } from '@/app/tokens';

const comments = [
  { name: 'Meera K.', text: 'This is the cosiest thing I have seen all week ☕', color: '#F8BBD0' },
  { name: 'Arjun S.', text: 'Save me a cup next time!', color: '#B3E5FC' },
  { name: 'Lena W.', text: 'Where is this café? Need to go 😍', color: '#C8E6C9' },
];

/** Decorative landing-page preview: a fake post whose likes tick up in little bursts. */
export function PreviewPost() {
  const reduceMotion = useReducedMotion();
  const [likes, setLikes] = useState(reduceMotion ? 27 : 3);
  const [shown, setShown] = useState(reduceMotion ? comments.length : 1);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setLikes((n) => (n >= 48 ? 3 : n + 1 + Math.floor(Math.random() * 3)));
      setShown((n) => (Math.random() < 0.25 ? (n % comments.length) + 1 : n));
    }, 900);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <Card aria-hidden sx={{ width: '100%', maxWidth: 400, mx: 'auto', textAlign: 'left' }}>
      <Stack direction="row" spacing={1.5} sx={{ p: 2, pb: 1, alignItems: 'center' }}>
        <Avatar sx={{ bgcolor: '#FFE082', color: brand.ink, fontWeight: 700 }}>P</Avatar>
        <Box>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>Priya Raman</Typography>
          <Typography variant="caption" color="text.secondary">
            Just now · Chennai
          </Typography>
        </Box>
      </Stack>
      <Typography sx={{ px: 2, pb: 1.5 }}>Sunday filter coffee hits different ☕✨</Typography>
      <Box
        sx={{
          height: 150,
          mx: 2,
          borderRadius: 3,
          background: `radial-gradient(circle at 30% 30%, ${brand.mangoLight}, ${brand.mango} 45%, ${brand.mangoDeep})`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 64,
        }}
      >
        ☕
      </Box>
      <Stack direction="row" sx={{ px: 2, py: 1.25, alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            bgcolor: brand.mango,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <ThumbUpRounded sx={{ fontSize: 13, color: brand.ink }} />
        </Box>
        <motion.span
          key={likes}
          initial={reduceMotion ? false : { scale: 1.25, color: brand.mangoTextStrong }}
          animate={{ scale: 1, color: brand.inkSecondary }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          style={{ fontSize: 14, display: 'inline-block' }}
        >
          Arun and {likes} others
        </motion.span>
        <Box sx={{ flex: 1 }} />
        <ChatBubbleOutlineRounded sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          {shown}
        </Typography>
      </Stack>
      <Divider />
      <Stack spacing={1} sx={{ p: 2 }}>
        <AnimatePresence initial={false}>
          {comments.slice(0, shown).map((c) => (
            <motion.div
              key={c.name}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Stack direction="row" spacing={1}>
                <Avatar
                  sx={{ width: 28, height: 28, bgcolor: c.color, color: brand.ink, fontSize: 13 }}
                >
                  {c.name[0]}
                </Avatar>
                <Box sx={{ bgcolor: brand.surface, borderRadius: 3, px: 1.5, py: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    {c.name}
                  </Typography>
                  <Typography variant="body2">{c.text}</Typography>
                </Box>
              </Stack>
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>
    </Card>
  );
}
