import { db } from '@/db';

/** Accepting turns a public profile into a friend (a new friendversary starts today). */
export async function acceptFriendRequest(personaId: string): Promise<void> {
  const persona = await db.personas.get(personaId);
  if (!persona?.friendRequest) return;
  await db.personas.update(personaId, {
    kind: 'friend',
    closeness: Math.max(persona.closeness, 0.4),
    activity: Math.max(persona.activity, 0.35),
    createdAt: Date.now(),
    friendRequest: { ...persona.friendRequest, status: 'accepted' },
  });
}

export async function declineFriendRequest(personaId: string): Promise<void> {
  const persona = await db.personas.get(personaId);
  if (!persona?.friendRequest) return;
  await db.personas.update(personaId, {
    friendRequest: { ...persona.friendRequest, status: 'declined' },
  });
}
