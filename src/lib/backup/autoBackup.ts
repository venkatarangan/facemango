/**
 * Automatic weekly backup to a folder the user picks (Settings → Advanced; off by default).
 * Uses the File System Access API, so only Chrome and Edge on computers. The zip is the normal
 * backup (export.ts) and is written straight to disk: nothing goes over the network.
 */
import { create } from 'zustand';
import { db } from '@/db';
import { errorSummary } from '@/ai/errorDetails';
import { AUTO_BACKUP_KEY, AUTO_BACKUP_STATUS_KEY } from './deviceOnly';
import { folderPermission, writeBackupToFolder, type FolderHandle } from './folder';
import { isBackupDue } from './reminders';

export interface AutoBackupConfig {
  handle: FolderHandle;
  folderName: string;
  /** When it was turned on. */
  since: number;
}

export interface AutoBackupStatus {
  lastAt?: number;
  lastFile?: string;
  error?: { at: number; message: string };
}

/** In-memory: whether the last check found the browser needs the user's OK again. */
export const useAutoBackupStore = create<{ needsPermission: boolean; running: boolean }>(() => ({
  needsPermission: false,
  running: false,
}));

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<FolderHandle>;
};

/** Chrome and Edge on computers; not Safari, Firefox or phones. */
export function folderBackupSupported(win: Window | undefined = globalThis.window): boolean {
  return !!win && typeof (win as PickerWindow).showDirectoryPicker === 'function';
}

export async function getAutoBackup(): Promise<AutoBackupConfig | null> {
  const value = (await db.settings.get(AUTO_BACKUP_KEY))?.value as AutoBackupConfig | undefined;
  return value?.handle ? value : null;
}

export async function getAutoBackupStatus(): Promise<AutoBackupStatus> {
  return ((await db.meta.get(AUTO_BACKUP_STATUS_KEY))?.value as AutoBackupStatus) ?? {};
}

async function setStatus(patch: AutoBackupStatus): Promise<void> {
  const current = await getAutoBackupStatus();
  await db.meta.put({ key: AUTO_BACKUP_STATUS_KEY, value: { ...current, ...patch } });
}

/** Saves the chosen folder. Exported for tests; the UI uses chooseBackupFolder(). */
export async function saveAutoBackup(handle: FolderHandle, now = Date.now()): Promise<void> {
  await db.settings.put({
    key: AUTO_BACKUP_KEY,
    value: { handle, folderName: handle.name, since: now } satisfies AutoBackupConfig,
  });
  await db.meta.delete(AUTO_BACKUP_STATUS_KEY);
}

/**
 * Asks the user for a folder (call from a click). Returns false if they cancelled. Picking a
 * folder also grants permission for this session.
 */
export async function chooseBackupFolder(): Promise<boolean> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return false;
  try {
    const handle = await picker({
      id: 'facemango-backups',
      mode: 'readwrite',
      startIn: 'documents',
    });
    await saveAutoBackup(handle);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}

/** "Turn off": forgets the folder. Backups already saved there stay. */
export async function turnOffAutoBackup(): Promise<void> {
  await db.settings.delete(AUTO_BACKUP_KEY);
  await db.meta.delete(AUTO_BACKUP_STATUS_KEY);
  useAutoBackupStore.setState({ needsPermission: false });
}

export type AutoBackupOutcome = 'saved' | 'not-due' | 'off' | 'needs-permission' | 'error' | 'busy';

/** Toast text after a "Back up now" or "Allow" click. */
export function outcomeMessage(outcome: AutoBackupOutcome, folder: string): string {
  switch (outcome) {
    case 'saved':
      return `Backup saved to “${folder}”.`;
    case 'needs-permission':
      return 'FaceMango needs your OK to save there. Try again and choose Allow.';
    case 'busy':
      return 'A backup is already being saved.';
    case 'error':
      return 'The backup could not be saved. See Settings → Advanced settings.';
    default:
      return 'Nothing to back up.';
  }
}

/** A friendly reason for a failed folder backup. */
export function describeFolderError(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotFoundError') return 'The folder was moved or deleted. Choose it again.';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'The browser didn’t allow FaceMango to save there.';
  if (name === 'QuotaExceededError') return 'The disk is full.';
  if (name === 'NoModificationAllowedError' || name === 'InvalidStateError')
    return 'The folder is busy or read-only. Try again later.';
  return errorSummary(error);
}

let inFlight = false;
const RETRY_AFTER_ERROR_MS = 6 * 3_600_000;

/**
 * Saves a backup to the folder if one is due (or `force`). `interactive` means we are inside a
 * click, so the browser may ask the user for permission; otherwise we never prompt.
 */
export async function runAutoBackup({
  interactive = false,
  force = false,
  now = Date.now(),
  config: given,
}: {
  interactive?: boolean;
  force?: boolean;
  now?: number;
  /** The UI passes the config it already has, so a permission prompt follows the click at once. */
  config?: AutoBackupConfig | null;
} = {}): Promise<AutoBackupOutcome> {
  const config = given ?? (await getAutoBackup());
  if (!config) return 'off';
  const status = await getAutoBackupStatus();
  if (!force) {
    // Due when never saved or over a week old; after a failure, wait a while before retrying.
    if (status.lastAt !== undefined && !isBackupDue(status.lastAt, now)) return 'not-due';
    if (!interactive && status.error && now - status.error.at < RETRY_AFTER_ERROR_MS)
      return 'not-due';
  }
  if (inFlight) return 'busy';
  inFlight = true;
  useAutoBackupStore.setState({ running: true });
  try {
    let permission;
    try {
      permission = await folderPermission(config.handle, { request: interactive });
    } catch (error) {
      await setStatus({ error: { at: now, message: describeFolderError(error) } });
      return 'error';
    }
    if (permission !== 'granted') {
      useAutoBackupStore.setState({ needsPermission: true });
      return 'needs-permission';
    }
    useAutoBackupStore.setState({ needsPermission: false });
    try {
      const { buildBackup } = await import('./export');
      const { blob } = await buildBackup(now, { record: false });
      const { file } = await writeBackupToFolder(config.handle, blob, now);
      // Counts as a backup: the weekly reminder is satisfied too.
      await db.meta.put({ key: 'lastBackupAt', value: now });
      await setStatus({ lastAt: now, lastFile: file, error: undefined });
      return 'saved';
    } catch (error) {
      console.warn('Automatic backup failed', error);
      await setStatus({ error: { at: now, message: describeFolderError(error) } });
      return 'error';
    }
  } finally {
    inFlight = false;
    useAutoBackupStore.setState({ running: false });
  }
}

let started = false;
const CHECK_EVERY_MS = 30 * 60_000;
const FIRST_CHECK_MS = 15_000;

/** Checks shortly after start-up, every 30 minutes, and when the tab comes back. Never prompts. */
export function startAutoBackup(): void {
  if (started || !folderBackupSupported()) return;
  started = true;
  const check = () => {
    // One tab at a time, when the browser supports Web Locks.
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    const run = () => runAutoBackup().catch((error) => console.warn('Auto-backup check', error));
    if (locks)
      void locks.request('facemango-auto-backup', { ifAvailable: true }, (lock) =>
        lock ? run() : undefined,
      );
    else void run();
  };
  setTimeout(check, FIRST_CHECK_MS);
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
