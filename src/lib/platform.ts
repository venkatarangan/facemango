/** Platform detection used for the iOS data-loss notice and install guides (SPEC §2). */

type NavigatorLike = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { platform?: string };

/** iPhone, iPod or iPad, including iPadOS which reports itself as a Mac with touch. */
export function isIOS(nav: NavigatorLike = navigator): boolean {
  if (/iPhone|iPad|iPod/i.test(nav.userAgent)) return true;
  const looksLikeMac = /Macintosh/i.test(nav.userAgent) || nav.platform === 'MacIntel';
  return looksLikeMac && nav.maxTouchPoints > 1;
}

/** True when running as an installed PWA (Home Screen on iOS, installed app elsewhere). */
export function isStandalone(win: Window = window): boolean {
  const iosStandalone = (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || win.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function isAndroid(nav: NavigatorLike = navigator): boolean {
  return /Android/i.test(nav.userAgent);
}
