import { differenceInCalendarYears, isSameDay, subMonths, subWeeks, subYears } from 'date-fns';
import type { Persona, Post } from '@/db';
import { totalReactions } from '@/lib/reactions';

export type Memory =
  | { kind: 'onThisDay'; id: string; label: string; posts: Post[] }
  | { kind: 'firstPost'; id: string; post: Post }
  | { kind: 'friendversary'; id: string; label: string; friends: Persona[] }
  | { kind: 'milestone'; id: string; title: string; detail: string; emoji: string }
  | { kind: 'bestPost'; id: string; post: Post };

const REACTION_MILESTONES = [10, 50, 100, 500, 1_000, 10_000, 100_000, 1_000_000];
const POST_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500];

function lastReached(value: number, steps: number[]): number | undefined {
  return [...steps].reverse().find((s) => value >= s);
}

/** Memories (SPEC §3.6): on this day, friendversaries, first post and milestone recaps. */
export function computeMemories(myPosts: Post[], friends: Persona[], now: number): Memory[] {
  const out: Memory[] = [];
  const ago: [string, Date][] = [
    ['1 week ago', subWeeks(now, 1)],
    ['1 month ago', subMonths(now, 1)],
    ...[1, 2, 3, 4, 5].map(
      (y) => [`${y} year${y > 1 ? 's' : ''} ago`, subYears(now, y)] as [string, Date],
    ),
  ];
  for (const [label, day] of ago) {
    const posts = myPosts.filter((p) => isSameDay(p.createdAt, day));
    if (posts.length) out.push({ kind: 'onThisDay', id: `otd-${label}`, label, posts });
  }

  for (const [label, day] of ago) {
    const met = friends.filter((f) => f.kind === 'friend' && isSameDay(f.createdAt, day));
    if (met.length) {
      const years = differenceInCalendarYears(now, day);
      out.push({
        kind: 'friendversary',
        id: `fv-${label}`,
        label: years >= 1 ? `${years} year${years > 1 ? 's' : ''}` : label.replace(' ago', ''),
        friends: met,
      });
    }
  }

  const sorted = [...myPosts].sort((a, b) => a.createdAt - b.createdAt);
  if (sorted[0]) out.push({ kind: 'firstPost', id: 'first-post', post: sorted[0] });

  const totalReceived = myPosts.reduce((n, p) => n + totalReactions(p.reactionCounts), 0);
  const reactionStep = lastReached(totalReceived, REACTION_MILESTONES);
  if (reactionStep) {
    out.push({
      kind: 'milestone',
      id: `reactions-${reactionStep}`,
      emoji: '🎉',
      title: `${reactionStep.toLocaleString()} reactions!`,
      detail: `Your posts have received ${totalReceived.toLocaleString()} reactions in total.`,
    });
  }
  const postStep = lastReached(myPosts.length, POST_MILESTONES);
  if (postStep && postStep > 1) {
    out.push({
      kind: 'milestone',
      id: `posts-${postStep}`,
      emoji: '✍️',
      title: `${postStep} posts`,
      detail: `You've shared ${myPosts.length} posts on FaceMango.`,
    });
  }
  const best = [...myPosts].sort(
    (a, b) =>
      totalReactions(b.reactionCounts) +
      b.commentCount * 2 -
      (totalReactions(a.reactionCounts) + a.commentCount * 2),
  )[0];
  if (best && totalReactions(best.reactionCounts) > 0 && myPosts.length > 1)
    out.push({ kind: 'bestPost', id: 'best-post', post: best });
  return out;
}
