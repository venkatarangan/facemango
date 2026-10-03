import { startOfDay, startOfWeek, subDays, subWeeks } from 'date-fns';
import type { Mood, MoodCheckIn, UsageSession } from '@/db';

export const MOOD_SCORE: Record<Mood, number> = { good: 3, okay: 2, low: 1 };
export const MOOD_EMOJI: Record<Mood, string> = { good: '😊', okay: '😐', low: '😟' };

export function sumActive(sessions: UsageSession[], from: number, to = Infinity): number {
  return sessions
    .filter((s) => s.startedAt >= from && s.startedAt < to)
    .reduce((n, s) => n + s.activeMs, 0);
}

/** Minutes per day for the last `days` days, oldest first (SPEC §3.9 30-day trend). */
export function dailyMinutes(
  sessions: UsageSession[],
  now: number,
  days = 30,
): { day: Date; minutes: number }[] {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const day = subDays(today, days - 1 - i);
    const next = subDays(day, -1).getTime();
    return { day, minutes: Math.round(sumActive(sessions, day.getTime(), next) / 60_000) };
  });
}

/** 7 × 24 grid of minutes, [weekday 0=Mon][hour], for the "when you use it" heatmap. */
export function usageHeatmap(sessions: UsageSession[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const weekday = (d.getDay() + 6) % 7;
    grid[weekday]![d.getHours()]! += s.activeMs / 60_000;
  }
  return grid.map((row) => row.map((m) => Math.round(m)));
}

/** Share of time spent between 22:00 and 05:00. */
export function lateNightShare(sessions: UsageSession[]): number {
  const total = sessions.reduce((n, s) => n + s.activeMs, 0);
  if (!total) return 0;
  const late = sessions.filter((s) => {
    const h = new Date(s.startedAt).getHours();
    return h >= 22 || h < 5;
  });
  return late.reduce((n, s) => n + s.activeMs, 0) / total;
}

export interface WeekComparison {
  lastWeekMs: number;
  weekBeforeMs: number;
  /** Negative = less than the week before. null when there is no previous week. */
  changePercent: number | null;
}

/** "You spent 2h 10m on FaceMango last week, 15% less than the week before." */
export function compareWeeks(sessions: UsageSession[], now: number): WeekComparison {
  const thisWeek = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const lastWeek = subWeeks(thisWeek, 1).getTime();
  const weekBefore = subWeeks(thisWeek, 2).getTime();
  const lastWeekMs = sumActive(sessions, lastWeek, thisWeek);
  const weekBeforeMs = sumActive(sessions, weekBefore, lastWeek);
  return {
    lastWeekMs,
    weekBeforeMs,
    changePercent: weekBeforeMs
      ? Math.round(((lastWeekMs - weekBeforeMs) / weekBeforeMs) * 100)
      : null,
  };
}

/** Average mood and minutes per day, for the "mood vs time spent" chart. */
export function moodByDay(
  moods: MoodCheckIn[],
  sessions: UsageSession[],
  now: number,
  days = 14,
): { day: Date; mood: number | null; minutes: number }[] {
  return dailyMinutes(sessions, now, days).map(({ day, minutes }) => {
    const next = subDays(day, -1).getTime();
    const inDay = moods.filter((m) => m.at >= day.getTime() && m.at < next);
    const mood = inDay.length
      ? inDay.reduce((n, m) => n + MOOD_SCORE[m.mood], 0) / inDay.length
      : null;
    return { day, mood, minutes };
  });
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
