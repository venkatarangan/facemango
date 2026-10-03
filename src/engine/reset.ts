import { db } from '@/db';
import { runSetup } from './onboarding';
import { setSetup } from './store';

/**
 * Friends reset (SPEC §3.10): current friends and public profiles become read-only former
 * friends. Their existing likes and comments stay under their names; their planned future
 * events are cancelled. Then a new circle is generated from the current config.
 */
export async function resetFriends(now = Date.now()): Promise<void> {
  await db.transaction('rw', db.personas, db.events, db.meta, async () => {
    const current = await db.personas.where('kind').anyOf('friend', 'public').toArray();
    const ids = new Set(current.map((p) => p.id));
    await db.personas.bulkPut(
      current.map((p) => ({ ...p, kind: 'former' as const, formerSince: now })),
    );
    await db.events
      .where('[status+dueAt]')
      .between(['planned', -Infinity], ['planned', Infinity])
      .filter((e) => !!e.personaId && ids.has(e.personaId))
      .modify({ status: 'cancelled' });
    await db.meta.bulkDelete(['setupComplete', 'seedTarget', 'nextFriendPostAt']);
  });
  setSetup({ stage: 'waiting-for-ai', done: 0, total: 0, error: undefined });
  void runSetup();
}
