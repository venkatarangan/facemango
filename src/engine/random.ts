/** Injectable randomness so the engine is testable. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Mulberry32: small seeded PRNG for tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const uniform = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const randInt = (rng: Rng, min: number, max: number) =>
  Math.floor(uniform(rng, min, max + 1));
export const chance = (rng: Rng, p: number) => rng() < p;

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (!items.length) throw new Error('pick() from empty list');
  return items[Math.floor(rng() * items.length)]!;
}

export function normal(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Picks a key from a percentage mix such as { good: 60, critical: 5 }. */
export function pickFromMix<K extends string>(rng: Rng, mix: Record<K, number>): K {
  const entries = (Object.entries(mix) as [K, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

/** Weighted sampling without replacement. */
export function weightedSample<T>(
  rng: Rng,
  items: readonly T[],
  weight: (item: T) => number,
  n: number,
): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(weight(item), 1e-6) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let roll = rng() * total;
    let index = pool.findIndex((p) => (roll -= p.w) <= 0);
    if (index < 0) index = pool.length - 1;
    out.push(pool.splice(index, 1)[0]!.item);
  }
  return out;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
