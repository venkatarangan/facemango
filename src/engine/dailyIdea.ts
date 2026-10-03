import { format } from 'date-fns';
import { whenAIReady } from '@/ai';
import { db, ME } from '@/db';
import { MANGO_SYSTEM } from './assistant';
import { getMeta, setMeta } from './settings';

export interface DailyIdea {
  date: string;
  text: string;
}

let running: Promise<void> | null = null;

/** Mango AI's daily post idea (SPEC §8 #11), generated once per day in the background. */
export function ensureDailyIdea(now = Date.now()): Promise<void> {
  running ??= (async () => {
    const date = format(now, 'yyyy-MM-dd');
    const current = await getMeta<DailyIdea | null>('dailyIdea', null);
    if (current?.date === date) return;
    const ai = await whenAIReady();
    const profile = await db.profile.get(ME);
    const recent = (await db.posts.where('authorId').equals(ME).reverse().sortBy('createdAt'))
      .slice(0, 3)
      .map((p) => p.text.slice(0, 60));
    const text = await ai.generate(
      `Suggest one fun, specific idea for a Facebook post that ${profile?.name ?? 'the user'} from ${profile?.city ?? 'their city'} could share today (${format(now, 'EEEE d MMMM')}). ` +
        `Avoid repeating: ${recent.join('; ') || 'nothing yet'}. One sentence, starting with a verb, at most one emoji.`,
      { system: MANGO_SYSTEM, maxTokens: 80, temperature: 0.95 },
    );
    const clean = text.trim().replace(/^["“]|["”]$/g, '');
    if (clean) await setMeta('dailyIdea', { date, text: clean } satisfies DailyIdea);
  })()
    .catch((error) => console.warn('Daily idea failed', error))
    .finally(() => {
      running = null;
    });
  return running;
}
