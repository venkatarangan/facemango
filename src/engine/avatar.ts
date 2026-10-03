import { createAvatar } from '@dicebear/core';
import * as personas from '@dicebear/personas';
import type { AvatarTraits, Persona } from '@/db';
import { FACIAL_HAIR, HAIR_STYLES, SKIN_TONES } from './prompts';

type SkinTone = (typeof SKIN_TONES)[number];
type Hair = (typeof HAIR_STYLES)[number];
type FacialHair = (typeof FACIAL_HAIR)[number];

const SKIN: Record<SkinTone, string> = {
  light: 'eeb4a4',
  'medium-light': 'e5a07e',
  medium: 'd78774',
  'medium-dark': '92594b',
  dark: '623d36',
};

const HAIR: Record<Hair, string[]> = {
  short: ['shortCombover', 'fade', 'shortComboverChops'],
  long: ['long', 'extraLong'],
  curly: ['curly', 'curlyHighTop', 'curlyBun'],
  bun: ['straightBun', 'bunUndercut', 'curlyBun'],
  bob: ['bobCut', 'bobBangs'],
  buzzcut: ['buzzcut'],
  bald: ['bald', 'balding'],
  covered: ['beanie', 'cap'],
};

const FACIAL: Record<FacialHair, string[]> = {
  none: [],
  beard: ['beardMustache', 'pyramid'],
  moustache: ['walrus', 'goatee'],
  stubble: ['shadow'],
};

const BACKGROUNDS = [
  'ffe082',
  'ffd54f',
  'fff3c4',
  'c8e6c9',
  'b3e5fc',
  'f8bbd0',
  'd1c4e9',
  'ffccbc',
];

/** AI-directed avatar traits → DiceBear "Personas" options (SPEC §5.3 level A). */
export function avatarTraits(
  seed: string,
  appearance: { skinTone: SkinTone; hair: Hair; facialHair: FacialHair; glasses: boolean },
): AvatarTraits {
  const hairOptions = HAIR[appearance.hair];
  const facial = FACIAL[appearance.facialHair];
  const hash = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    style: 'personas',
    seed,
    options: {
      skinColor: SKIN[appearance.skinTone],
      hair: hairOptions[hash % hairOptions.length]!,
      facialHair: facial[hash % Math.max(1, facial.length)] ?? '',
      facialHairProbability: facial.length ? 100 : 0,
      eyes: appearance.glasses ? 'glasses' : (['open', 'happy', 'wink'] as const)[hash % 3]!,
      backgroundColor: BACKGROUNDS[hash % BACKGROUNDS.length]!,
    },
  };
}

const cache = new Map<string, string>();

/** Renders a persona's avatar locally as an SVG data URI (memoised). */
export function avatarDataUri(persona: Pick<Persona, 'id' | 'avatar'>): string {
  const key = `${persona.id}:${persona.avatar.seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const o = persona.avatar.options ?? {};
  const svg = createAvatar(personas, {
    seed: persona.avatar.seed,
    radius: 50,
    skinColor: o.skinColor ? [String(o.skinColor)] : undefined,
    hair: o.hair ? [String(o.hair) as never] : undefined,
    facialHair: o.facialHair ? [String(o.facialHair) as never] : undefined,
    facialHairProbability:
      typeof o.facialHairProbability === 'number' ? o.facialHairProbability : undefined,
    eyes: o.eyes ? [String(o.eyes) as never] : undefined,
    backgroundColor: o.backgroundColor ? [String(o.backgroundColor)] : undefined,
  }).toDataUri();
  cache.set(key, svg);
  return svg;
}

/** The raw SVG markup, used by the backup export (avatars/*.svg). */
export function avatarSvg(persona: Pick<Persona, 'avatar'>): string {
  const uri = avatarDataUri({ id: 'export', ...persona });
  return decodeURIComponent(uri.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
}
