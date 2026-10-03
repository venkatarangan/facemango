import { z } from 'zod';
import { MIN_AGE } from '@/engine/limits';

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(40, 'Keep it under 40 characters'),
  age: z
    .number({ error: 'Please enter your age' })
    .int('Please enter a whole number')
    .min(MIN_AGE, `You need to be ${MIN_AGE} or older to use FaceMango`)
    .max(120, 'Please enter a real age'),
  city: z.string().trim().min(2, 'Please enter your city').max(60, 'Keep it under 60 characters'),
  languages: z
    .array(z.string().trim().min(1).max(30))
    .min(1, 'Pick at least one language')
    .max(10, 'Pick up to 10 languages'),
  acknowledged: z.literal(true, { error: 'Please confirm you understand' }),
});

export type SignupInput = z.input<typeof signupSchema>;
export type SignupValues = z.output<typeof signupSchema>;

export const LANGUAGE_OPTIONS = [
  'English',
  'Tamil',
  'Hindi',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Urdu',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Arabic',
  'Mandarin',
  'Cantonese',
  'Japanese',
  'Korean',
  'Indonesian',
  'Malay',
  'Thai',
  'Vietnamese',
  'Filipino',
  'Russian',
  'Turkish',
  'Swahili',
  'Dutch',
  'Polish',
  'Sinhala',
];
