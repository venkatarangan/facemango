import { Howl } from 'howler';
import { db } from '@/db';

export type SoundName = 'pop' | 'ping' | 'chime';

const cache = new Map<SoundName, Howl>();
let enabled = true;

/** Loads the on/off preference (Settings → Sounds). Default on, at a low volume. */
export async function loadSoundPreference(): Promise<void> {
  const row = await db.settings.get('sounds');
  enabled = row?.value !== false;
}

export async function setSoundsEnabled(on: boolean): Promise<void> {
  enabled = on;
  await db.settings.put({ key: 'sounds', value: on });
}

export function soundsEnabled(): boolean {
  return enabled;
}

/** Short, subtle UI sounds (SPEC §6.1 Howler). Silent when off or when the tab is hidden. */
export function playSound(name: SoundName): void {
  if (!enabled || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  let howl = cache.get(name);
  if (!howl) {
    howl = new Howl({ src: [`/sounds/${name}.wav`], volume: name === 'chime' ? 0.35 : 0.25 });
    cache.set(name, howl);
  }
  howl.play();
}
