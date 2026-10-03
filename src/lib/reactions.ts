import type { ReactionType } from '@/db';

export interface ReactionMeta {
  type: ReactionType;
  label: string;
  emoji: string;
  /** Text colour for the selected button label (WCAG AA on white). */
  color: string;
}

/** Order matches Facebook's picker. Animations: Noto Animated Emoji (CC BY 4.0) in /emoji. */
export const REACTIONS: ReactionMeta[] = [
  { type: 'like', label: 'Like', emoji: '👍', color: '#8A6A00' },
  { type: 'love', label: 'Love', emoji: '❤️', color: '#C2185B' },
  { type: 'care', label: 'Care', emoji: '🤗', color: '#8A6A00' },
  { type: 'haha', label: 'Haha', emoji: '😆', color: '#8A6A00' },
  { type: 'wow', label: 'Wow', emoji: '😮', color: '#8A6A00' },
  { type: 'sad', label: 'Sad', emoji: '😢', color: '#8A6A00' },
  { type: 'angry', label: 'Angry', emoji: '😠', color: '#C62828' },
];

export const reactionMeta = (type: ReactionType) => REACTIONS.find((r) => r.type === type)!;

export function totalReactions(counts: Partial<Record<ReactionType, number>>): number {
  return Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
}

/** The most common reaction types, most frequent first. */
export function topReactions(counts: Partial<Record<ReactionType, number>>, n = 3): ReactionType[] {
  return (Object.entries(counts) as [ReactionType, number][])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
