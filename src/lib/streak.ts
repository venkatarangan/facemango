import { differenceInCalendarDays } from 'date-fns';

/**
 * Posting streak (SPEC §8 #12): consecutive days with at least one post, ending today or
 * yesterday (so the streak survives until the day is over).
 */
export function postingStreak(postTimes: number[], now: number): number {
  const days = new Set(postTimes.map((t) => differenceInCalendarDays(now, t)));
  let start = days.has(0) ? 0 : days.has(1) ? 1 : -1;
  if (start < 0) return 0;
  let streak = 0;
  while (days.has(start)) {
    streak++;
    start++;
  }
  return streak;
}
