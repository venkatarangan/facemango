import type { FolderHandle, FolderPermission } from '@/lib/backup/folder';

/** Test helper: an in-memory folder that behaves like a FileSystemDirectoryHandle. */
export function fakeFolder(
  initial: string[] = [],
  {
    query = 'granted',
    onRequest = 'granted',
  }: { query?: FolderPermission; onRequest?: FolderPermission } = {},
) {
  const files = new Map<string, Blob>(initial.map((n) => [n, new Blob(['old'])]));
  let state = query;
  const handle = {
    name: 'Backups',
    queryPermission: vi.fn(async () => state),
    requestPermission: vi.fn(async () => (state = onRequest)),
    getFileHandle: vi.fn(async (name: string) => ({
      createWritable: async () => ({
        write: async (blob: Blob) => void files.set(name, blob),
        close: async () => {},
      }),
    })),
    removeEntry: vi.fn(async (name: string) => void files.delete(name)),
    async *values() {
      for (const name of files.keys()) yield { kind: 'file' as const, name };
      // A sub-folder with a matching name is never touched.
      yield { kind: 'directory' as const, name: 'facemango-auto-backup-2020-01-01-0000.zip' };
    },
  } satisfies FolderHandle;
  return { handle, files };
}
