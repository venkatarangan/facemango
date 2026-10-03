import type { UsageSession } from '@/db';
import {
  compareWeeks,
  dailyMinutes,
  formatDuration,
  lateNightShare,
  usageHeatmap,
} from './wellbeing';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const s = (startedAt: number, minutes: number): UsageSession => ({
  id: String(startedAt),
  startedAt,
  endedAt: startedAt + minutes * 60_000,
  activeMs: minutes * 60_000,
});

// Monday 12 Oct 2026
const now = at(2026, 10, 12, 18);

describe('wellbeing stats', () => {
  it('compares last week with the week before', () => {
    const sessions = [s(at(2026, 10, 6), 60), s(at(2026, 10, 7), 50), s(at(2026, 9, 29), 100)];
    expect(compareWeeks(sessions, now)).toEqual({
      lastWeekMs: 110 * 60_000,
      weekBeforeMs: 100 * 60_000,
      changePercent: 10,
    });
  });

  it('builds a 30-day trend ending today', () => {
    const days = dailyMinutes([s(at(2026, 10, 12, 9), 25), s(at(2026, 10, 11, 9), 5)], now);
    expect(days).toHaveLength(30);
    expect(days.at(-1)!.minutes).toBe(25);
    expect(days.at(-2)!.minutes).toBe(5);
  });

  it('fills the weekday × hour heatmap and measures late-night use', () => {
    const sessions = [s(at(2026, 10, 12, 23), 30), s(at(2026, 10, 13, 9), 90)];
    const grid = usageHeatmap(sessions);
    expect(grid[0]![23]).toBe(30); // Monday 23:00
    expect(grid[1]![9]).toBe(90); // Tuesday 09:00
    expect(lateNightShare(sessions)).toBeCloseTo(0.25);
  });

  it('formats durations', () => {
    expect(formatDuration(5 * 60_000)).toBe('5m');
    expect(formatDuration(130 * 60_000)).toBe('2h 10m');
    expect(formatDuration(120 * 60_000)).toBe('2h');
  });
});
