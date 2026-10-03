import { db } from '@/db';
import { defaultEngagementConfig, engagementConfigSchema, type EngagementConfig } from './config';

const KEY = 'engagement';

/** The saved advanced configuration (edited in Settings from M6), or the defaults. */
export async function getEngagementConfig(): Promise<EngagementConfig> {
  const row = await db.settings.get(KEY);
  const parsed = engagementConfigSchema.safeParse(row?.value);
  if (parsed.success) return parsed.data;
  // The e2e build (mock model) runs engagement 60× faster so tests see reactions in seconds.
  return import.meta.env.VITE_MOCK_AI === '1'
    ? { ...defaultEngagementConfig, speed: 60 }
    : defaultEngagementConfig;
}

export async function saveEngagementConfig(config: EngagementConfig): Promise<void> {
  await db.settings.put({ key: KEY, value: engagementConfigSchema.parse(config) });
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  return ((await db.meta.get(key))?.value as T | undefined) ?? fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
