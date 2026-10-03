/** FaceMango brand tokens (SPEC §6.4). */
export const brand = {
  background: '#FFFFFF',
  surface: '#FAFAFA',
  divider: '#ECECEC',
  mango: '#FFC400',
  mangoLight: '#FFD84D',
  mangoDeep: '#FFA600',
  /** Yellow on white for large text (≥ 24px, or ≥ 18.66px bold), icons and UI parts: 3.3:1. */
  mangoText: '#B28900',
  /** Yellow on white for body-size text: 5:1 (WCAG AA). */
  mangoTextStrong: '#8A6A00',
  ink: '#111111',
  inkSecondary: '#555555',
  inkMuted: '#6B6B6B',
} as const;

export const fonts = {
  ui: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  display: '"Nunito Variable", Nunito, "Inter Variable", system-ui, sans-serif',
} as const;
