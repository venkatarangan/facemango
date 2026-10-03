import { postingStreak } from './streak';

const day = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const now = day(10, 18);

describe('postingStreak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(postingStreak([day(10), day(9), day(8), day(6)], now)).toBe(3);
    expect(postingStreak([day(9, 9), day(8)], now)).toBe(2);
    expect(postingStreak([day(10), day(10, 8)], now)).toBe(1);
    expect(postingStreak([day(7)], now)).toBe(0);
    expect(postingStreak([], now)).toBe(0);
  });
});
