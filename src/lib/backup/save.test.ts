// @vitest-environment jsdom
import { db, deleteAllData } from '@/db';

const platform = vi.hoisted(() => ({ ios: false }));
vi.mock('@/lib/platform', async (orig) => ({
  ...(await orig<typeof import('@/lib/platform')>()),
  isIOS: () => platform.ios,
}));

import { runBackup, shareOrDownload } from './save';

const lastBackup = async () => (await db.meta.get('lastBackupAt'))?.value;

beforeEach(async () => {
  await deleteAllData();
  platform.ios = false;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

const file = () =>
  new File(['zip'], 'facemango-backup-2026-11-14.zip', { type: 'application/zip' });

describe('saving a backup', () => {
  it('streams to the chosen file and then records the backup', async () => {
    const written: Uint8Array[] = [];
    vi.stubGlobal('showSaveFilePicker', async () => ({
      createWritable: async () => ({
        write: async (c: Uint8Array) => void written.push(c),
        close: async () => undefined,
      }),
    }));
    await db.profile.put({
      id: 'me',
      name: 'A',
      age: 30,
      city: 'c',
      languages: ['English'],
      createdAt: 1,
      dataNoticeAcknowledgedAt: 1,
    });
    expect(await runBackup()).toEqual({ status: 'saved' });
    expect(written.length).toBeGreaterThan(0);
    expect(await lastBackup()).toBeTypeOf('number');
  });

  it('does not count a cancelled Save dialog as a backup', async () => {
    vi.stubGlobal('showSaveFilePicker', async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    expect(await runBackup()).toEqual({ status: 'cancelled' });
    expect(await lastBackup()).toBeUndefined();
  });

  it('downloads when there is no Save dialog or share sheet', async () => {
    expect(await shareOrDownload(file())).toEqual({ status: 'downloaded' });
    expect(await lastBackup()).toBeTypeOf('number');
  });

  it('uses the share sheet on iPhone and iPad', async () => {
    platform.ios = true;
    const share = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
    expect(await shareOrDownload(file())).toEqual({ status: 'shared' });
    expect(share).toHaveBeenCalled();
    expect(await lastBackup()).toBeTypeOf('number');
  });

  it('asks for another tap when Safari refuses the share, then falls back to a download', async () => {
    platform.ios = true;
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: () => true,
      share: async () => {
        throw new DOMException('no gesture', 'NotAllowedError');
      },
    });
    const f = file();
    expect(await shareOrDownload(f)).toEqual({ status: 'needs-tap', file: f });
    expect(await lastBackup()).toBeUndefined();
    expect(await shareOrDownload(f, { retryOnNeedsTap: false })).toEqual({ status: 'downloaded' });
  });

  it('treats closing the share sheet as cancelled', async () => {
    platform.ios = true;
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: () => true,
      share: async () => {
        throw new DOMException('closed', 'AbortError');
      },
    });
    expect(await shareOrDownload(file())).toEqual({ status: 'cancelled' });
    expect(await lastBackup()).toBeUndefined();
  });
});

describe('a failed export', () => {
  it('aborts the chosen file instead of leaving it empty', async () => {
    const abort = vi.fn(async () => undefined);
    vi.stubGlobal('showSaveFilePicker', async () => ({
      createWritable: async () => ({
        write: async () => undefined,
        close: async () => undefined,
        abort,
      }),
    }));
    const { db: database } = await import('@/db');
    vi.spyOn(database.posts, 'toArray').mockRejectedValue(new Error('read failed'));
    await expect(runBackup()).rejects.toThrow('read failed');
    expect(abort).toHaveBeenCalled();
    expect(await lastBackup()).toBeUndefined();
  });
});
