import { db } from '@/db';

/**
 * Local system notifications (SPEC §8 #9). Shown by this device only, when FaceMango is in the
 * background and the user has opted in. Nothing is sent over the network (no push server).
 */
export async function systemNotificationsEnabled(): Promise<boolean> {
  return (
    (await db.settings.get('systemNotifications'))?.value === true &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  );
}

export async function enableSystemNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  const on = permission === 'granted';
  await db.settings.put({ key: 'systemNotifications', value: on });
  return on;
}

export async function disableSystemNotifications(): Promise<void> {
  await db.settings.put({ key: 'systemNotifications', value: false });
}

export async function showSystemNotification(text: string, tag?: string): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') return;
  if (!(await systemNotificationsEnabled())) return;
  const options = { body: text, icon: '/pwa-192x192.png', badge: '/pwa-64x64.png', tag };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification('FaceMango', options);
    else new Notification('FaceMango', options);
  } catch {
    /* not available here */
  }
}
