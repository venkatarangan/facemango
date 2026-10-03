import { getContrastRatio } from '@mui/material/styles';
import { brand } from './tokens';

describe('brand colours meet WCAG AA on white', () => {
  it('ink text ≥ 4.5:1', () => {
    expect(getContrastRatio(brand.ink, brand.background)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(brand.inkSecondary, brand.background)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(brand.inkMuted, brand.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('mangoTextStrong is safe for body text (≥ 4.5:1)', () => {
    expect(getContrastRatio(brand.mangoTextStrong, brand.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('mangoText is safe for large text and UI parts only (≥ 3:1)', () => {
    const ratio = getContrastRatio(brand.mangoText, brand.background);
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
  });

  it('ink on the mango accent (buttons) ≥ 4.5:1', () => {
    expect(getContrastRatio(brand.ink, brand.mango)).toBeGreaterThanOrEqual(4.5);
  });
});
