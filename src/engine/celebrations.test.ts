import { newMilestone } from './celebrations';

describe('newMilestone', () => {
  it('returns the highest uncelebrated milestone reached', () => {
    expect(newMilestone(9, [])).toBeUndefined();
    expect(newMilestone(12, [])).toBe(10);
    expect(newMilestone(60, [10, 25])).toBe(50);
    expect(newMilestone(60, [10, 25, 50])).toBeUndefined();
    expect(newMilestone(2_000_000, [])).toBe(1_000_000);
  });
});
