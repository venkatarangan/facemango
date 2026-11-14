/**
 * Writing backups to a folder with the File System Access API (Chrome and Edge on computers).
 * Pure helpers over a minimal handle interface, so they can be tested with a fake folder.
 */
import { format } from 'date-fns';

export const AUTO_BACKUP_KEEP = 5;

const FILE_PATTERN = /^facemango-auto-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/;

export type FolderPermission = 'granted' | 'prompt' | 'denied';

interface Writable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

/** The parts of FileSystemDirectoryHandle FaceMango uses. */
export interface FolderHandle {
  readonly name: string;
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<FolderPermission>;
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<FolderPermission>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{ createWritable(): Promise<Writable> }>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
}

/** e.g. facemango-auto-backup-2026-10-14-0930.zip (local time; sorts by date). */
export function autoBackupFileName(now: number): string {
  return `facemango-auto-backup-${format(now, 'yyyy-MM-dd-HHmm')}.zip`;
}

/** Only files FaceMango created itself match; anything else in the folder is never touched. */
export function isAutoBackupFile(name: string): boolean {
  return FILE_PATTERN.test(name);
}

/** FaceMango's own backups beyond the newest `keep`, oldest last. */
export function filesToDelete(names: string[], keep = AUTO_BACKUP_KEEP): string[] {
  return names.filter(isAutoBackupFile).sort().reverse().slice(Math.max(0, keep));
}

/**
 * The folder permission. Browsers forget it between sessions, so it is often "prompt" after a
 * restart. Asking (`request: true`) only works inside a click or tap.
 */
export async function folderPermission(
  handle: FolderHandle,
  { request }: { request: boolean },
): Promise<FolderPermission> {
  if (!handle.queryPermission) return 'granted';
  let state = await handle.queryPermission({ mode: 'readwrite' });
  if (state !== 'granted' && request && handle.requestPermission)
    state = await handle.requestPermission({ mode: 'readwrite' });
  return state;
}

/** Saves the zip, then deletes FaceMango's older backups beyond `keep`. */
export async function writeBackupToFolder(
  handle: FolderHandle,
  blob: Blob,
  now: number,
  keep = AUTO_BACKUP_KEEP,
): Promise<{ file: string; deleted: string[] }> {
  const file = autoBackupFileName(now);
  const writable = await (await handle.getFileHandle(file, { create: true })).createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => {});
    throw error;
  }
  const names: string[] = [];
  for await (const entry of handle.values()) if (entry.kind === 'file') names.push(entry.name);
  const deleted: string[] = [];
  for (const name of filesToDelete(names, keep)) {
    try {
      await handle.removeEntry(name);
      deleted.push(name);
    } catch (error) {
      console.warn(`Could not delete old backup ${name}`, error);
    }
  }
  return { file, deleted };
}
