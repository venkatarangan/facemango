import type { AI } from '@/ai';
import type { Gender, Persona, Profile } from '@/db';
import { avatarTraits } from './avatar';
import type { EngagementConfig } from './config';
import { ADULT_AGE } from './limits';
import {
  friendBatchSchema,
  friendsPrompt,
  PERSONA_SYSTEM,
  publicBatchSchema,
  publicsPrompt,
  type PersonaSkeleton,
} from './prompts';
import { chance, pick, pickFromMix, randInt, uniform, type Rng } from './random';

/** Friend attributes decided by the config mixes, before the AI fills in the details (SPEC §4.1). */
export function buildFriendSkeletons(
  config: EngagementConfig,
  user: Profile,
  rng: Rng,
): PersonaSkeleton[] {
  const minor = user.age < ADULT_AGE;
  const nonEnglish = user.languages.filter((l) => l.toLowerCase() !== 'english');
  return Array.from({ length: config.friendCount }, (_, i) => {
    const sameCity = chance(rng, config.sameCityPercent / 100);
    const shares = chance(rng, config.sharedLanguagePercent / 100);
    // Adults only get adult friends; under-18s get friends of a similar age.
    const age = minor
      ? randInt(rng, 13, Math.min(19, user.age + 3))
      : randInt(rng, Math.max(ADULT_AGE, user.age - 10), Math.min(80, user.age + 12));
    return {
      id: `f${i + 1}`,
      gender: pickFromMix<Gender>(rng, config.genderMix),
      age,
      place: sameCity ? 'same-city' : chance(rng, 0.6) ? 'same-country' : 'abroad',
      sharedLanguage: shares ? (nonEnglish.length ? pick(rng, nonEnglish) : 'English') : undefined,
      stance: pickFromMix(rng, config.stanceMix),
    };
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Generates friends in small batches; a failing batch is retried one person at a time. */
export async function generateFriends(
  ai: AI,
  user: Profile,
  skeletons: PersonaSkeleton[],
  rng: Rng,
  onProgress: (done: number, personas: Persona[]) => void | Promise<void>,
  existingNames: string[] = [],
): Promise<Persona[]> {
  const out: Persona[] = [];
  const dedupe = nameDeduper(existingNames);
  const batchSize = 4;
  for (const batch of chunk(skeletons, batchSize)) {
    const groups = await generateWithFallback(batch, async (group) => {
      const result = await ai.generateJSON(friendsPrompt(user, group), friendBatchSchema, {
        system: PERSONA_SYSTEM,
        maxTokens: 260 * group.length,
        temperature: 0.9,
      });
      return group.map((skeleton, index) => {
        const g = result.people.find((p) => p.id === skeleton.id) ?? result.people[index];
        if (!g) throw new Error(`Missing persona ${skeleton.id}`);
        const languages = [
          ...new Set(
            ['English', skeleton.sharedLanguage, g.extraLanguage].filter(
              (l): l is string => !!l && l.length > 1,
            ),
          ),
        ];
        const now = Date.now();
        const persona: Persona = {
          id: crypto.randomUUID(),
          kind: 'friend',
          name: g.name.trim(),
          gender: skeleton.gender,
          age: skeleton.age,
          city: skeleton.place === 'same-city' ? user.city : g.city,
          country: g.country,
          region: g.region,
          languages,
          occupation: g.occupation,
          interests: g.interests,
          likes: g.likes,
          dislikes: g.dislikes,
          writingStyle: g.writingStyle,
          bio: g.bio,
          agreeableness:
            skeleton.stance === 'fan'
              ? uniform(rng, 0.7, 1)
              : skeleton.stance === 'critic'
                ? uniform(rng, 0.1, 0.4)
                : uniform(rng, 0.4, 0.7),
          stance: skeleton.stance,
          activity: uniform(rng, 0.3, 1),
          closeness: uniform(rng, 0.2, 1),
          avatar: avatarTraits(crypto.randomUUID(), g.appearance),
          birthday: g.birthday,
          createdAt: now,
        };
        return persona;
      });
    });
    for (const group of groups) {
      const personas = group.map(dedupe);
      out.push(...personas);
      await onProgress(out.length, personas);
    }
  }
  return out;
}

export async function generatePublics(
  ai: AI,
  user: Profile,
  count: number,
  rng: Rng,
  onProgress: (done: number, personas: Persona[]) => void | Promise<void>,
  existingNames: string[] = [],
): Promise<Persona[]> {
  const dedupe = nameDeduper(existingNames);
  const items = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    gender: pick(rng, ['female', 'male', 'female', 'male', 'nonbinary'] as Gender[]),
  }));
  const out: Persona[] = [];
  for (const batch of chunk(items, 8)) {
    const groups = await generateWithFallback(batch, async (group) => {
      const result = await ai.generateJSON(publicsPrompt(user, group), publicBatchSchema, {
        system: PERSONA_SYSTEM,
        maxTokens: 130 * group.length,
        temperature: 0.95,
      });
      return group.map((item, index) => {
        const g = result.people.find((p) => p.id === item.id) ?? result.people[index];
        if (!g) throw new Error(`Missing public profile ${item.id}`);
        const persona: Persona = {
          id: crypto.randomUUID(),
          kind: 'public',
          name: g.name.trim(),
          gender: item.gender,
          age: user.age < ADULT_AGE ? randInt(rng, 13, 19) : randInt(rng, 18, 65),
          city: g.city,
          country: g.country,
          region: g.region,
          languages: ['English'],
          occupation: g.occupation,
          interests: g.interests,
          likes: [],
          dislikes: [],
          writingStyle: 'short and casual',
          agreeableness: uniform(rng, 0.3, 0.9),
          stance: pickFromMix(rng, { fan: 40, neutral: 50, critic: 10 }),
          activity: uniform(rng, 0.1, 0.6),
          closeness: uniform(rng, 0.05, 0.2),
          avatar: avatarTraits(crypto.randomUUID(), g.appearance),
          createdAt: Date.now(),
        };
        return persona;
      });
    });
    for (const group of groups) {
      const personas = group.map(dedupe);
      out.push(...personas);
      await onProgress(out.length, personas);
    }
  }
  return out;
}

/** Tries the whole group; on failure, tries each item alone and skips the ones that still fail. */
async function generateWithFallback<I, O>(
  group: I[],
  run: (items: I[]) => Promise<O[]>,
): Promise<O[][]> {
  try {
    return [await run(group)];
  } catch (error) {
    if (group.length === 1) {
      console.warn('Persona generation failed', error);
      return [];
    }
    const results: O[][] = [];
    for (const item of group) {
      try {
        results.push(await run([item]));
      } catch (inner) {
        console.warn('Persona generation failed for one item', inner);
      }
    }
    return results;
  }
}

/** Small models repeat names; add a distinguishing initial to duplicates. */
export function nameDeduper(existing: string[] = []): (p: Persona) => Persona {
  const seen = new Map<string, number>();
  existing.forEach((name) => seen.set(name, (seen.get(name) ?? 0) + 1));
  return (p) => {
    const n = (seen.get(p.name) ?? 0) + 1;
    seen.set(p.name, n);
    return n === 1 ? p : { ...p, name: `${p.name} ${String.fromCharCode(64 + n)}.` };
  };
}
