import { create } from 'zustand';
import { db } from '@/db';
import { notify } from './notifications';
import { getMeta, setMeta } from './settings';

/** Per-post reaction milestones that earn a micro-celebration (SPEC §8 #6). */
export const POST_MILESTONES = [10, 25, 50, 100, 250, 500, 1_000, 10_000, 100_000, 1_000_000];

export interface Celebration {
  id: string;
  title: string;
  postId?: string;
}

export const useCelebrations = create<{ queue: Celebration[] }>(() => ({ queue: [] }));

export function celebrate(c: Omit<Celebration, 'id'>): void {
  useCelebrations.setState((s) => ({ queue: [...s.queue, { ...c, id: crypto.randomUUID() }] }));
}

export function shiftCelebration(): void {
  useCelebrations.setState((s) => ({ queue: s.queue.slice(1) }));
}

/** Highest milestone reached that has not been celebrated yet, if any. */
export function newMilestone(total: number, celebrated: number[]): number | undefined {
  const reached = POST_MILESTONES.filter((m) => total >= m && !celebrated.includes(m));
  return reached.at(-1);
}

/** Called after reactions land on one of the user's posts. */
export async function checkPostMilestones(postId: string, total: number): Promise<void> {
  const key = `celebrated:${postId}`;
  const celebrated = await getMeta<number[]>(key, []);
  const milestone = newMilestone(total, celebrated);
  if (!milestone) return;
  await setMeta(
    key,
    POST_MILESTONES.filter((m) => m <= milestone),
  );
  const title = `Your post reached ${milestone.toLocaleString()} reactions! 🎉`;
  await notify('milestone', title, { postId });
  celebrate({ title, postId });
}

/** First-ever reaction on the user's very first post: a small welcome celebration. */
export async function checkFirstReaction(postId: string): Promise<void> {
  if (await getMeta('celebratedFirstReaction', false)) return;
  const mine = await db.posts.where('authorId').equals('me').count();
  if (mine !== 1) return;
  await setMeta('celebratedFirstReaction', true);
  celebrate({ title: 'Your first reaction on FaceMango! 🥭', postId });
}
