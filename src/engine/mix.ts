/**
 * Sets one percentage in a mix and rescales the others proportionally so the total stays 100
 * (used by the advanced settings sliders).
 */
export function setMixValue<K extends string>(
  mix: Record<K, number>,
  key: NoInfer<K>,
  value: number,
): Record<K, number> {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const others = (Object.keys(mix) as K[]).filter((k) => k !== key);
  const restTotal = others.reduce((n, k) => n + mix[k], 0);
  const remaining = 100 - v;
  const next = { ...mix, [key]: v } as Record<K, number>;
  if (!others.length) return { ...next, [key]: 100 };
  others.forEach((k) => {
    next[k] = restTotal > 0 ? (mix[k] / restTotal) * remaining : remaining / others.length;
  });
  // Round, then put any rounding drift on the largest of the others.
  others.forEach((k) => (next[k] = Math.round(next[k])));
  const drift = 100 - (Object.values(next) as number[]).reduce((a, b) => a + b, 0);
  if (drift) {
    const largest = others.reduce((a, b) => (next[a] >= next[b] ? a : b));
    next[largest] += drift;
  }
  return next;
}
