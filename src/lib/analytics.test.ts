import { needsConsent, routePattern } from './analytics';

describe('analytics privacy helpers', () => {
  it('never sends ids in page paths', () => {
    expect(routePattern('/post/5f2c-uuid')).toBe('/post/:id');
    expect(routePattern('/profile/abc-123')).toBe('/profile/:id');
    expect(routePattern('/profile/me')).toBe('/profile/me');
    expect(routePattern('/settings/advanced')).toBe('/settings/advanced');
  });

  it('asks for consent in EU/UK time zones', () => {
    expect(needsConsent('Europe/London')).toBe(true);
    expect(needsConsent('Europe/Berlin')).toBe(true);
    expect(needsConsent('Asia/Kolkata')).toBe(false);
    expect(needsConsent('America/New_York')).toBe(false);
  });
});
