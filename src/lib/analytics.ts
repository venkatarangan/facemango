/**
 * Google Analytics, page views only (SPEC §7). Loaded only when VITE_GA_ID is set at build time,
 * and in the EU/UK only after consent. Sends route patterns (e.g. "/post/:id"), never ids,
 * text, profile data or usage stats.
 */
const GA_ID = import.meta.env.VITE_GA_ID;
const CONSENT_KEY = 'facemango.analyticsConsent';

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let loaded = false;

export const analyticsConfigured = (): boolean => !!GA_ID;

/** Rough EU/UK/EEA check from the time zone; no network lookup. */
export function needsConsent(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): boolean {
  return /^(Europe|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe))\//.test(timeZone);
}

export function getConsent(): 'granted' | 'denied' | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage unavailable */
  }
  if (value === 'granted') load();
}

export function analyticsAllowed(): boolean {
  if (!GA_ID) return false;
  return needsConsent() ? getConsent() === 'granted' : getConsent() !== 'denied';
}

function load(): void {
  if (loaded || !GA_ID || typeof document === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  // gtag expects the Arguments object, not an array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
}

/** Replaces ids in paths so nothing user-specific leaves the device. */
export function routePattern(pathname: string): string {
  return pathname
    .replace(/^\/post\/[^/]+/, '/post/:id')
    .replace(/^\/profile\/(?!me$)[^/]+/, '/profile/:id');
}

export function trackPageView(pathname: string): void {
  if (!analyticsAllowed()) return;
  load();
  const page = routePattern(pathname);
  window.gtag?.('event', 'page_view', {
    page_path: page,
    page_location: `${location.origin}${page}`,
    page_title: 'FaceMango',
  });
}
