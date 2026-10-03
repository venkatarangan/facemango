import { whenAIReady } from '@/ai';
import { db, type Persona } from '@/db';
import { loadPhotoManifest } from '@/lib/photos';
import { pickPhoto } from './photoPicker';
import { PERSONA_SYSTEM, profileDetailsPrompt, profileDetailsSchema } from './prompts';
import { defaultRng } from './random';

const inFlight = new Map<string, Promise<void>>();

/** Generates a persona's profile page on first visit, then caches it (SPEC §3.4). */
export function ensureProfileDetails(personaId: string): Promise<void> {
  const existing = inFlight.get(personaId);
  if (existing) return existing;
  const job = (async () => {
    const persona = await db.personas.get(personaId);
    if (!persona || persona.profileDetails) return;
    const ai = await whenAIReady();
    const details = await ai.generateJSON(profileDetailsPrompt(persona), profileDetailsSchema, {
      system: PERSONA_SYSTEM,
      priority: 'interactive',
      maxTokens: 320,
    });
    const photos = (await loadPhotoManifest()).filter((p) => p.width > p.height);
    const cover = pickPhoto(
      photos.filter((p) =>
        p.themes.some((t) => ['nature', 'travel', 'city', 'weather'].includes(t)),
      ),
      persona,
      new Set(),
      defaultRng,
    );
    await db.personas.update(personaId, {
      profileDetails: { ...details, coverPhotoId: cover?.id },
    } satisfies Partial<Persona>);
  })().finally(() => inFlight.delete(personaId));
  inFlight.set(personaId, job);
  return job;
}
