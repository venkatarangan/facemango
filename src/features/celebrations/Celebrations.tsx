import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { shiftCelebration, useCelebrations } from '@/engine/celebrations';
import { useUiStore } from '@/app/uiStore';
import { brand } from '@/app/tokens';
import { playSound } from '@/lib/sound';

/** Plays queued micro-celebrations: confetti, a chime and a toast (SPEC §8 #6). */
export function Celebrations() {
  const next = useCelebrations((s) => s.queue[0]);
  const showToast = useUiStore((s) => s.showToast);
  useEffect(() => {
    if (!next) return;
    if (document.visibilityState === 'visible') {
      void confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.7 },
        colors: [brand.mango, brand.mangoLight, brand.mangoDeep, '#111111', '#FFFFFF'],
        disableForReducedMotion: true,
      });
      playSound('chime');
      showToast(next.title);
      navigator.vibrate?.([20, 40, 20]);
    }
    const timer = setTimeout(shiftCelebration, 2500);
    return () => clearTimeout(timer);
  }, [next, showToast]);
  return null;
}
