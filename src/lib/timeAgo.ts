import { format, isSameDay, isSameYear, subDays } from 'date-fns';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Facebook-style relative time (SPEC §3.2):
 * Just now · 5m · 3h · Yesterday at 4:12 PM · 2 October · 2 October 2025
 */
export function formatTimeAgo(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  const date = new Date(timestamp);
  if (isSameDay(date, subDays(now, 1))) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  return isSameYear(date, now) ? format(date, 'd MMMM') : format(date, 'd MMMM yyyy');
}

/** Full timestamp for tooltips: "Friday, 3 October 2026 at 4:12 PM". */
export function formatFullDate(timestamp: number): string {
  return format(timestamp, "EEEE, d MMMM yyyy 'at' h:mm a");
}
