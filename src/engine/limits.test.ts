import { clampComments, clampLikes, MAX_COMMENTS_PER_POST, MAX_LIKES_PER_POST } from './limits';

describe('hard limits', () => {
  it('caps likes at 1,000,000', () => {
    expect(MAX_LIKES_PER_POST).toBe(1_000_000);
    expect(clampLikes(5_000_000)).toBe(1_000_000);
    expect(clampLikes(42.6)).toBe(43);
    expect(clampLikes(-3)).toBe(0);
    expect(clampLikes(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampLikes(Number.NaN)).toBe(0);
  });

  it('caps comments at 100', () => {
    expect(MAX_COMMENTS_PER_POST).toBe(100);
    expect(clampComments(250)).toBe(100);
    expect(clampComments(7)).toBe(7);
    expect(clampComments(-1)).toBe(0);
  });
});
