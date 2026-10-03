import { db, type Mood } from '@/db';
import { currentSessionId } from './usage';

export async function recordMood(mood: Mood): Promise<void> {
  await db.moods.add({
    id: crypto.randomUUID(),
    at: Date.now(),
    mood,
    sessionId: currentSessionId(),
  });
}
