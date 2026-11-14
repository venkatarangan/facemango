/**
 * Getting the backup out of the browser (SPEC §3.11):
 *  - Chrome/Edge on computers: a Save dialog, streamed to the file (no big blob in memory);
 *  - iPhone/iPad: the share sheet ("Save to Files"), since plain downloads are unreliable in Safari;
 *  - everything else: a normal download.
 * "Last backup" is recorded only after the file is really saved.
 */
import { isIOS } from '@/lib/platform';
import {
  backupFilename,
  buildZip,
  downloadBlob,
  markBackedUp,
  readSnapshot,
  zipToBlob,
  zipToWritable,
  type ProgressFn,
  type WritableLike,
} from './export';

export type BackupOutcome =
  | { status: 'saved' | 'shared' | 'downloaded' | 'cancelled' }
  /** The share sheet needs a fresh tap (Safari spends the first one while the zip is built). */
  | { status: 'needs-tap'; file: File };

interface SavePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable(): Promise<WritableLike> }>;
}

const isAbort = (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError';

export const canPickFile = () =>
  typeof window !== 'undefined' &&
  !isIOS() &&
  typeof (window as SavePickerWindow).showSaveFilePicker === 'function';

/** Shares the file with the system share sheet, or downloads it when sharing isn't possible. */
export async function shareOrDownload(
  file: File,
  { retryOnNeedsTap = true }: { retryOnNeedsTap?: boolean } = {},
): Promise<BackupOutcome> {
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'FaceMango backup' });
      await markBackedUp();
      return { status: 'shared' };
    } catch (e) {
      if (isAbort(e)) return { status: 'cancelled' };
      if ((e as { name?: string } | null)?.name === 'NotAllowedError' && retryOnNeedsTap)
        return { status: 'needs-tap', file };
    }
  }
  downloadBlob(file, file.name);
  await markBackedUp();
  return { status: 'downloaded' };
}

/**
 * Makes a backup and saves it. Call straight from a click: the Save dialog must be the first
 * thing awaited.
 */
export async function runBackup(onProgress?: ProgressFn): Promise<BackupOutcome> {
  const now = Date.now();
  const filename = backupFilename(now);

  if (canPickFile()) {
    let writable: WritableLike;
    try {
      const handle = await (window as SavePickerWindow).showSaveFilePicker!({
        suggestedName: filename,
        types: [{ description: 'FaceMango backup', accept: { 'application/zip': ['.zip'] } }],
      });
      writable = await handle.createWritable();
    } catch (e) {
      if (isAbort(e)) return { status: 'cancelled' };
      throw e;
    }
    onProgress?.({ phase: 'reading', percent: 0 });
    let zip: ReturnType<typeof buildZip>;
    try {
      zip = buildZip(await readSnapshot(), now);
    } catch (e) {
      await writable.abort?.().catch(() => undefined); // no empty file left behind
      throw e;
    }
    await zipToWritable(zip, writable, onProgress);
    await markBackedUp(now);
    return { status: 'saved' };
  }

  onProgress?.({ phase: 'reading', percent: 0 });
  const blob = await zipToBlob(buildZip(await readSnapshot(), now), onProgress);
  return shareOrDownload(new File([blob], filename, { type: 'application/zip' }));
}
