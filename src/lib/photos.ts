/** The bundled CC0 photo pack (SPEC §4.5): public/photos/manifest.json. */
export interface PackPhoto {
  id: string;
  file: string;
  width: number;
  height: number;
  region: string;
  country: string | null;
  themes: string[];
  tags: string[];
  season: string | null;
  alt: string;
  source: string;
  author: string;
  license: string;
  licenseUrl: string;
}

let manifest: Promise<PackPhoto[]> | null = null;

export function loadPhotoManifest(): Promise<PackPhoto[]> {
  manifest ??= fetch('/photos/manifest.json')
    .then((r) => (r.ok ? r.json() : { photos: [] }))
    .then((m: { photos?: PackPhoto[] }) => m.photos ?? [])
    .catch(() => []);
  return manifest;
}

export const PACK_PREFIX = 'pack:';
export const isPackPhoto = (ref?: string) => !!ref?.startsWith(PACK_PREFIX);
export const packPhotoId = (ref: string) => ref.slice(PACK_PREFIX.length);
export const packPhotoUrl = (photo: Pick<PackPhoto, 'file'>) => `/photos/${photo.file}`;
