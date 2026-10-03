import { isIOS } from './platform';

const nav = (userAgent: string, maxTouchPoints = 0, platform = '') => ({
  userAgent,
  maxTouchPoints,
  platform,
});

describe('isIOS', () => {
  it('detects iPhone', () => {
    expect(
      isIOS(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 5)),
    ).toBe(true);
  });

  it('detects iPadOS that reports as a Mac with touch', () => {
    expect(
      isIOS(
        nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, 'MacIntel'),
      ),
    ).toBe(true);
  });

  it('does not flag a desktop Mac', () => {
    expect(
      isIOS(
        nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0, 'MacIntel'),
      ),
    ).toBe(false);
  });

  it('does not flag Android or Windows', () => {
    expect(isIOS(nav('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140', 5))).toBe(false);
    expect(isIOS(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'))).toBe(false);
  });
});
