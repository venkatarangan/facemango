import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';

export interface WellbeingSettings {
  /** Optional daily goal in minutes (SPEC §3.9). */
  dailyGoalMinutes: number | null;
  /** Optional end-of-session mood check-in. */
  moodCheckIns: boolean;
}

export const DEFAULT_WELLBEING: WellbeingSettings = { dailyGoalMinutes: null, moodCheckIns: true };
const KEY = 'wellbeing';

export async function getWellbeingSettings(): Promise<WellbeingSettings> {
  return {
    ...DEFAULT_WELLBEING,
    ...((await db.settings.get(KEY))?.value as Partial<WellbeingSettings> | undefined),
  };
}

export async function saveWellbeingSettings(patch: Partial<WellbeingSettings>): Promise<void> {
  await db.settings.put({ key: KEY, value: { ...(await getWellbeingSettings()), ...patch } });
}

export function useWellbeingSettings(): WellbeingSettings {
  return useLiveQuery(getWellbeingSettings, []) ?? DEFAULT_WELLBEING;
}
