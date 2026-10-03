import { useLiveQuery } from 'dexie-react-hooks';
import { db, ME, type Persona, type Profile } from '@/db';

export type Author =
  | { id: typeof ME; kind: 'me'; name: string; profile: Profile }
  | { id: string; kind: Persona['kind']; name: string; persona: Persona };

/** Every author the feed can show (the user + all personas), keyed by id. Live. */
export function useAuthors(): Map<string, Author> | undefined {
  return useLiveQuery(async () => {
    const [profile, personas] = await Promise.all([db.profile.get(ME), db.personas.toArray()]);
    const map = new Map<string, Author>();
    if (profile) map.set(ME, { id: ME, kind: 'me', name: profile.name, profile });
    for (const p of personas) map.set(p.id, { id: p.id, kind: p.kind, name: p.name, persona: p });
    return map;
  }, []);
}

export const unknownAuthor = (id: string): Author => ({
  id,
  kind: 'former',
  name: 'Someone',
  persona: {
    id,
    kind: 'former',
    name: 'Someone',
    gender: 'nonbinary',
    age: 30,
    city: '',
    country: '',
    languages: [],
    occupation: '',
    interests: [],
    likes: [],
    dislikes: [],
    writingStyle: '',
    agreeableness: 0.5,
    stance: 'neutral',
    activity: 0,
    closeness: 0,
    avatar: { style: 'personas', seed: id },
    createdAt: 0,
  },
});
