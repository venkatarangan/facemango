/**
 * On-device usage tracking for the Wellbeing tracker (SPEC §3.9). Stored only in IndexedDB.
 * Never sent anywhere, including analytics.
 */
import { db, type UsageSession } from '@/db';

const FLUSH_MS = 15_000;
/** Coming back after this long starts a new session. */
const SESSION_GAP_MS = 5 * 60_000;

let session: UsageSession | null = null;
let visibleSince: number | null = null;
let lastHiddenAt = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let started = false;

function now() {
  return Date.now();
}

function accumulate() {
  if (!session || visibleSince === null) return;
  const t = now();
  session.activeMs += t - visibleSince;
  session.endedAt = t;
  visibleSince = t;
}

async function flush() {
  accumulate();
  if (session) await db.usageSessions.put({ ...session });
}

function begin() {
  const t = now();
  session = { id: crypto.randomUUID(), startedAt: t, endedAt: t, activeMs: 0, feedDepth: 0 };
  visibleSince = t;
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    void flush();
    visibleSince = null;
    lastHiddenAt = now();
  } else {
    if (!session || now() - lastHiddenAt > SESSION_GAP_MS) begin();
    else visibleSince = now();
  }
}

export function startUsageTracking(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  if (document.visibilityState === 'visible') begin();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => void flush());
  timer = setInterval(() => void flush(), FLUSH_MS);
}

export function stopUsageTracking(): void {
  started = false;
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisibility);
}

/** Feed scroll depth for "what you do" stats. */
export function noteFeedDepth(index: number): void {
  if (session && index > (session.feedDepth ?? 0)) session.feedDepth = index;
}

/** Milliseconds active in the current session so far (for the mood prompt and goal nudge). */
export function currentSessionActiveMs(): number {
  accumulate();
  return session?.activeMs ?? 0;
}

export function currentSessionId(): string | undefined {
  return session?.id;
}
