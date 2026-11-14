/** Shared test helpers for the backup tests. */
import type { Persona } from '@/db';

export const seedPersona = (id: string, kind: 'friend' | 'public' = 'friend'): Persona => ({
  id,
  kind,
  name: `Friend ${id}`,
  gender: 'female',
  age: 30,
  city: 'Chennai',
  country: 'India',
  languages: ['English'],
  occupation: 'Teacher',
  interests: ['music'],
  likes: [],
  dislikes: [],
  writingStyle: 'warm',
  agreeableness: 0.5,
  stance: 'fan',
  activity: 0.5,
  closeness: 0.5,
  avatar: { style: 'personas', seed: id },
  createdAt: 1,
});
