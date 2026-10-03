import type { PackPhoto } from '@/lib/photos';
import { pickPhoto, themesFor } from './photoPicker';
import { seededRng } from './random';

const photo = (
  id: string,
  region: string,
  themes: string[],
  country: string | null = null,
): PackPhoto => ({
  id,
  file: `${id}.webp`,
  width: 1200,
  height: 800,
  region,
  country,
  themes,
  tags: [],
  season: null,
  alt: id,
  source: '',
  author: '',
  license: 'CC0 1.0',
  licenseUrl: '',
});

const photos = [
  photo('food-sa', 'south-asia', ['food'], 'India'),
  photo('sport-eu', 'europe', ['sports']),
  photo('food-eu', 'europe', ['food']),
  photo('nature-global', 'global', ['nature']),
];

describe('photo picker', () => {
  const persona = {
    interests: ['cooking', 'street food'],
    likes: [],
    occupation: 'Chef',
    region: 'south-asia',
    country: 'India',
  };

  it('maps interests to themes', () => {
    expect(themesFor(persona)).toContain('food');
  });

  it('prefers the persona region and interests, and avoids used photos', () => {
    expect(pickPhoto(photos, persona, new Set(), seededRng(1))!.id).toBe('food-sa');
    expect(pickPhoto(photos, persona, new Set(['food-sa']), seededRng(1))!.id).not.toBe('food-sa');
  });

  it('reuses photos once all are used, and handles an empty pack', () => {
    expect(pickPhoto(photos, persona, new Set(photos.map((p) => p.id)), seededRng(2))).toBeTruthy();
    expect(pickPhoto([], persona, new Set(), seededRng(2))).toBeUndefined();
  });
});
