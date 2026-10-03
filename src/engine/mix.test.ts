import { setMixValue } from './mix';

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

describe('setMixValue', () => {
  it('rescales the other values proportionally and keeps the total at 100', () => {
    const next = setMixValue(
      { good: 60, appreciative: 25, nonsense: 10, critical: 5, superCritical: 0 },
      'good',
      40,
    );
    expect(next.good).toBe(40);
    expect(sum(next)).toBe(100);
    expect(next.appreciative).toBeGreaterThan(next.nonsense);
    expect(next.superCritical).toBe(0);
  });

  it('splits evenly when the others are all zero, and clamps', () => {
    expect(setMixValue({ a: 100, b: 0, c: 0 }, 'a', 40)).toEqual({ a: 40, b: 30, c: 30 });
    expect(setMixValue({ a: 50, b: 50 }, 'a', 150)).toEqual({ a: 100, b: 0 });
  });
});
