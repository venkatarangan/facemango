import type { Persona } from '@/db';
import type { PackPhoto } from '@/lib/photos';
import type { Rng } from './random';

const THEME_KEYWORDS: Record<string, RegExp> = {
  food: /food|cook|bak|chef|restaurant|coffee|tea|eat|cuisine|street food|dessert/i,
  travel: /travel|trip|backpack|explor|wander|landmark|heritage/i,
  nature: /nature|hik|trek|garden|plant|bird|mountain|beach|outdoor|camp|photograph/i,
  festivals: /festival|celebrat|dance|tradition|culture/i,
  pets: /pet|dog|cat|animal|puppy/i,
  family: /family|parent|kids|mom|dad|grand/i,
  hobbies: /music|guitar|sing|art|paint|draw|craft|read|book|knit|garden|photograph|pottery/i,
  sports: /sport|cricket|football|soccer|run|yoga|gym|fitness|cycl|swim|tennis|badminton/i,
  city: /city|architect|urban|design|night/i,
  work: /tech|cod|work|study|startup|teach|engineer|office|research/i,
  weather: /rain|monsoon|snow|weather|season|sunset/i,
};

/** Themes that match a persona's interests and occupation. */
export function themesFor(persona: Pick<Persona, 'interests' | 'occupation' | 'likes'>): string[] {
  const text = [...persona.interests, ...persona.likes, persona.occupation].join(' ');
  return Object.entries(THEME_KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([theme]) => theme);
}

/**
 * Picks a pack photo that fits the persona's region and interests, avoiding ones already used
 * (SPEC §4.5: "matching tags to the persona's city/region, interests and the post topic").
 */
export function pickPhoto(
  photos: PackPhoto[],
  persona: Pick<Persona, 'interests' | 'occupation' | 'likes' | 'region' | 'country'>,
  used: Set<string>,
  rng: Rng,
): PackPhoto | undefined {
  let candidates = photos.filter((p) => !used.has(p.id));
  if (!candidates.length) candidates = photos;
  if (!candidates.length) return undefined;
  const themes = new Set(themesFor(persona));
  const scored = candidates.map((photo) => {
    let score = rng() * 2;
    if (photo.region === persona.region) score += 3;
    if (
      photo.country &&
      persona.country &&
      photo.country.toLowerCase() === persona.country.toLowerCase()
    )
      score += 2;
    if (photo.region === 'global') score += 1;
    score += photo.themes.filter((t) => themes.has(t)).length * 2;
    return { photo, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.photo;
}
