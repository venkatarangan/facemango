import { formatTimeAgo } from './timeAgo';

const now = new Date(2026, 9, 3, 15, 0).getTime(); // 3 Oct 2026, 3:00 PM local

describe('formatTimeAgo', () => {
  it.each([
    [now - 20_000, 'Just now'],
    [now + 60_000, 'Just now'],
    [now - 5 * 60_000, '5m'],
    [now - 3 * 3_600_000, '3h'],
    [now - 23 * 3_600_000, '23h'],
    [new Date(2026, 9, 1, 16, 12).getTime(), '1 October'],
    [new Date(2025, 9, 2, 9, 0).getTime(), '2 October 2025'],
  ])('%s → %s', (ts, label) => {
    expect(formatTimeAgo(ts, now)).toBe(label);
  });

  it('uses "Yesterday at" for the previous calendar day beyond 24h', () => {
    const ts = new Date(2026, 9, 2, 9, 5).getTime(); // 29h55m earlier
    expect(formatTimeAgo(ts, now)).toBe('Yesterday at 9:05 AM');
  });
});
