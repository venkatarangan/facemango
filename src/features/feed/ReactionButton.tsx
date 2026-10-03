import { lazy, Suspense, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Tooltip from '@mui/material/Tooltip';
import ThumbUpOffAltRounded from '@mui/icons-material/ThumbUpOutlined';
import { setMyReaction, type ReactionType } from '@/db';
import { REACTIONS, reactionMeta } from '@/lib/reactions';
import { playSound } from '@/lib/sound';
// The Lottie player (~150 kB) loads only when the picker first opens.
const AnimatedEmoji = lazy(() =>
  import('./AnimatedEmoji').then((m) => ({ default: m.AnimatedEmoji })),
);

const LONG_PRESS_MS = 420;
const HOVER_MS = 500;

/** Like button with the 7-reaction picker: hover on desktop, long-press on touch (SPEC §3.2). */
export function ReactionButton({ postId, mine }: { postId: string; mine?: ReactionType }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  const choose = (type: ReactionType | null) => {
    setOpen(false);
    if (type) {
      setBump((n) => n + 1);
      playSound('pop');
      navigator.vibrate?.(12);
    }
    void setMyReaction(postId, type);
  };
  const clear = () => clearTimeout(timer.current);
  const meta = mine ? reactionMeta(mine) : undefined;

  return (
    <>
      <Button
        ref={setAnchor}
        fullWidth
        aria-label={meta ? `${meta.label} (tap to remove)` : 'Like'}
        aria-haspopup="true"
        aria-pressed={!!mine}
        onPointerDown={(e) => {
          longPressed.current = false;
          if (e.pointerType !== 'mouse') {
            timer.current = setTimeout(() => {
              longPressed.current = true;
              setOpen(true);
              navigator.vibrate?.(8);
            }, LONG_PRESS_MS);
          }
        }}
        onPointerUp={clear}
        onPointerLeave={(e) => {
          clear();
          if (e.pointerType === 'mouse') timer.current = setTimeout(() => setOpen(false), 400);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') {
            clear();
            timer.current = setTimeout(() => setOpen(true), HOVER_MS);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          clear();
          if (longPressed.current) return;
          choose(mine ? null : 'like');
        }}
        sx={{
          color: meta ? meta.color : 'text.secondary',
          fontWeight: meta ? 700 : 600,
          borderRadius: 2,
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        startIcon={
          <motion.span
            key={bump}
            initial={bump ? { scale: 0.4, rotate: -20 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 12 }}
            style={{ display: 'inline-flex', fontSize: 20 }}
          >
            {meta ? <span aria-hidden>{meta.emoji}</span> : <ThumbUpOffAltRounded />}
          </motion.span>
        }
      >
        {meta?.label ?? 'Like'}
      </Button>
      <Popper open={open} anchorEl={anchor} placement="top-start" sx={{ zIndex: 1400 }}>
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Paper
            elevation={8}
            onPointerEnter={clear}
            onPointerLeave={(e) =>
              e.pointerType === 'mouse' && (timer.current = setTimeout(() => setOpen(false), 300))
            }
            sx={{ borderRadius: 999, px: 0.75, py: 0.5, mb: 1, display: 'flex', gap: 0.25 }}
            role="menu"
            aria-label="Reactions"
          >
            <AnimatePresence>
              {REACTIONS.map((r, i) => (
                <Tooltip key={r.type} title={r.label} placement="top">
                  <Box
                    component={motion.button}
                    role="menuitem"
                    aria-label={r.label}
                    initial={{ y: 12, opacity: 0, scale: 0.6 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 500, damping: 22 }}
                    whileHover={{ scale: 1.35, y: -6 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => choose(r.type)}
                    sx={{
                      border: 0,
                      bgcolor: 'transparent',
                      p: 0.25,
                      cursor: 'pointer',
                      borderRadius: '50%',
                      lineHeight: 0,
                    }}
                  >
                    <Suspense
                      fallback={
                        <span
                          style={{
                            fontSize: 32,
                            lineHeight: '40px',
                            width: 40,
                            display: 'inline-block',
                          }}
                        >
                          {r.emoji}
                        </span>
                      }
                    >
                      <AnimatedEmoji type={r.type} size={40} />
                    </Suspense>
                  </Box>
                </Tooltip>
              ))}
            </AnimatePresence>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
