import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react';
import { useReducedMotion } from 'motion/react';
import type { ReactionType } from '@/db';
import { reactionMeta } from '@/lib/reactions';

// Serve the player's WebAssembly ourselves instead of from a CDN (copied by scripts/copy-assets.mjs).
setWasmUrl('/emoji/dotlottie-player.wasm');

/** Noto Animated Emoji (CC BY 4.0), served from /emoji. Static emoji when motion is reduced. */
export function AnimatedEmoji({
  type,
  size = 40,
  play = true,
}: {
  type: ReactionType;
  size?: number;
  play?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce || !play) {
    return (
      <span
        role="img"
        aria-hidden
        style={{
          fontSize: size * 0.8,
          lineHeight: `${size}px`,
          width: size,
          display: 'inline-block',
          textAlign: 'center',
        }}
      >
        {reactionMeta(type).emoji}
      </span>
    );
  }
  return (
    <DotLottieReact
      src={`/emoji/${type}.json`}
      autoplay
      loop
      style={{ width: size, height: size }}
    />
  );
}
