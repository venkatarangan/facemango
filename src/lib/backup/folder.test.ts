import { fakeFolder } from '@/test/fakeFolder';
import {
  autoBackupFileName,
  filesToDelete,
  folderPermission,
  isAutoBackupFile,
  writeBackupToFolder,
} from './folder';

const at = (iso: string) => new Date(iso).getTime();

describe('backup file naming', () => {
  it('names files by local date and time, and recognises only its own', () => {
    expect(autoBackupFileName(new Date(2026, 9, 14, 9, 5).getTime())).toBe(
      'facemango-auto-backup-2026-10-14-0905.zip',
    );
    expect(isAutoBackupFile('facemango-auto-backup-2026-10-14-0905.zip')).toBe(true);
    expect(isAutoBackupFile('facemango-backup-2026-10-14.zip')).toBe(false); // manual download
    expect(isAutoBackupFile('facemango-auto-backup-2026-10-14-0905.zip.crswap')).toBe(false);
    expect(isAutoBackupFile('notes.txt')).toBe(false);
  });

  it('deletes only its own files beyond the newest 5', () => {
    const own = [1, 2, 3, 4, 5, 6, 7].map((d) => `facemango-auto-backup-2026-10-0${d}-1200.zip`);
    const names = [...own, 'facemango-backup-2026-10-01.zip', 'holiday.jpg'];
    expect(filesToDelete(names)).toEqual([own[1], own[0]]);
    expect(filesToDelete(own.slice(0, 3))).toEqual([]);
    expect(filesToDelete(own, 0)).toHaveLength(7);
  });
});

describe('folder permission', () => {
  it('uses the remembered permission without asking', async () => {
    const { handle } = fakeFolder([], { query: 'granted' });
    await expect(folderPermission(handle, { request: false })).resolves.toBe('granted');
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('never prompts outside a click', async () => {
    const { handle } = fakeFolder([], { query: 'prompt' });
    await expect(folderPermission(handle, { request: false })).resolves.toBe('prompt');
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('asks inside a click and reports the answer', async () => {
    const yes = fakeFolder([], { query: 'prompt', onRequest: 'granted' }).handle;
    await expect(folderPermission(yes, { request: true })).resolves.toBe('granted');
    expect(yes.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    const no = fakeFolder([], { query: 'prompt', onRequest: 'denied' }).handle;
    await expect(folderPermission(no, { request: true })).resolves.toBe('denied');
  });
});

describe('writeBackupToFolder', () => {
  it('writes the zip and keeps the newest 5 of its own files', async () => {
    const old = [1, 2, 3, 4, 5].map((d) => `facemango-auto-backup-2026-10-0${d}-1200.zip`);
    const { handle, files } = fakeFolder([...old, 'my-notes.txt']);
    const now = new Date(2026, 9, 14, 9, 30).getTime();
    const { file, deleted } = await writeBackupToFolder(handle, new Blob(['zip']), now);
    expect(file).toBe('facemango-auto-backup-2026-10-14-0930.zip');
    expect(deleted).toEqual([old[0]]);
    expect([...files.keys()].sort()).toEqual([...old.slice(1), file, 'my-notes.txt'].sort());
    expect(await files.get(file)!.text()).toBe('zip');
  });

  it('keeps going when an old file cannot be deleted', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = [1, 2, 3, 4, 5, 6].map((d) => `facemango-auto-backup-2026-10-0${d}-1200.zip`);
    const { handle } = fakeFolder(old);
    handle.removeEntry.mockRejectedValueOnce(new Error('locked'));
    const { deleted } = await writeBackupToFolder(handle, new Blob(['zip']), at('2026-10-14'));
    expect(deleted).toHaveLength(1);
  });
});
