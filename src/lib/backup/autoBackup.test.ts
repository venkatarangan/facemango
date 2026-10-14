import { db, deleteAllData, saveProfile } from '@/db';
import { fakeFolder } from '@/test/fakeFolder';
import {
  getAutoBackupStatus,
  runAutoBackup,
  useAutoBackupStore,
  type AutoBackupConfig,
} from './autoBackup';
import { AUTO_BACKUP_KEY, AUTO_BACKUP_STATUS_KEY } from './deviceOnly';
import { buildBackup } from './export';
import { parseBackup, restoreBackup } from './import';

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 14, 9, 30).getTime();

const configFor = (handle: AutoBackupConfig['handle']): AutoBackupConfig => ({
  handle,
  folderName: handle.name,
  since: T0 - DAY,
});

beforeEach(async () => {
  await deleteAllData();
  useAutoBackupStore.setState({ needsPermission: false, running: false });
});

describe('runAutoBackup', () => {
  it('does nothing when it is off', async () => {
    await expect(runAutoBackup({ now: T0 })).resolves.toBe('off');
  });

  it('saves the normal backup zip and counts it as a backup', async () => {
    await saveProfile({ name: 'Asha', age: 30, city: 'Madurai', languages: ['Tamil'] });
    const { handle, files } = fakeFolder();
    await expect(runAutoBackup({ now: T0, config: configFor(handle) })).resolves.toBe('saved');
    const name = 'facemango-auto-backup-2026-10-14-0930.zip';
    expect(files.has(name)).toBe(true);
    const parsed = await parseBackup(files.get(name)!);
    expect(parsed.summary.profileName).toBe('Asha');
    expect((await db.meta.get('lastBackupAt'))?.value).toBe(T0);
    expect(await getAutoBackupStatus()).toMatchObject({ lastAt: T0, lastFile: name });
  });

  it('runs weekly', async () => {
    const config = configFor(fakeFolder().handle);
    await runAutoBackup({ now: T0, config });
    await expect(runAutoBackup({ now: T0 + 6 * DAY, config })).resolves.toBe('not-due');
    await expect(runAutoBackup({ now: T0 + 8 * DAY, config })).resolves.toBe('saved');
    await expect(runAutoBackup({ now: T0 + 8 * DAY + 1, config, force: true })).resolves.toBe(
      'saved',
    );
  });

  it('never prompts in the background; flags that it needs the user’s OK', async () => {
    const { handle, files } = fakeFolder([], { query: 'prompt' });
    await expect(runAutoBackup({ now: T0, config: configFor(handle) })).resolves.toBe(
      'needs-permission',
    );
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
    expect(useAutoBackupStore.getState().needsPermission).toBe(true);
    expect(await db.meta.get('lastBackupAt')).toBeUndefined();
  });

  it('asks for permission after a click, then saves', async () => {
    const { handle, files } = fakeFolder([], { query: 'prompt', onRequest: 'granted' });
    useAutoBackupStore.setState({ needsPermission: true });
    await expect(
      runAutoBackup({ now: T0, config: configFor(handle), interactive: true }),
    ).resolves.toBe('saved');
    expect(handle.requestPermission).toHaveBeenCalled();
    expect(files.size).toBe(1);
    expect(useAutoBackupStore.getState().needsPermission).toBe(false);
  });

  it('records a friendly error, does not count it as a backup, and waits before retrying', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handle } = fakeFolder();
    handle.getFileHandle.mockRejectedValue(new DOMException('gone', 'NotFoundError'));
    const config = configFor(handle);
    await expect(runAutoBackup({ now: T0, config })).resolves.toBe('error');
    expect((await getAutoBackupStatus()).error?.message).toMatch(/moved or deleted/);
    expect(await db.meta.get('lastBackupAt')).toBeUndefined();
    await expect(runAutoBackup({ now: T0 + 60_000, config })).resolves.toBe('not-due');
    await expect(runAutoBackup({ now: T0 + 60_000, config, interactive: true })).resolves.toBe(
      'error',
    );
  });
});

describe('device-only rows', () => {
  it('stay out of backups and survive a restore', async () => {
    await saveProfile({ name: 'Asha', age: 30, city: 'Madurai', languages: ['Tamil'] });
    const folder = { folderName: 'Backups', handle: { name: 'Backups' }, since: 1 };
    await db.settings.put({ key: AUTO_BACKUP_KEY, value: folder });
    await db.meta.put({ key: AUTO_BACKUP_STATUS_KEY, value: { lastAt: 5 } });
    await db.settings.put({ key: 'backupReminders', value: true });

    const parsed = await parseBackup((await buildBackup(T0)).blob);
    const keys = parsed.records.filter((r) => r.type === 'setting' || r.type === 'meta');
    expect(keys.map((r) => r.id)).toContain('backupReminders');
    expect(keys.map((r) => r.id)).not.toContain(AUTO_BACKUP_KEY);
    expect(keys.map((r) => r.id)).not.toContain(AUTO_BACKUP_STATUS_KEY);

    await restoreBackup(parsed, 'everything');
    expect((await db.settings.get(AUTO_BACKUP_KEY))?.value).toEqual(folder);
    expect((await db.meta.get(AUTO_BACKUP_STATUS_KEY))?.value).toEqual({ lastAt: 5 });
    expect((await db.settings.get('backupReminders'))?.value).toBe(true);
  });
});
