import { z } from 'zod';
import { ADULT_AGE, MAX_COMMENTS_PER_POST } from './limits';

const percent = z.number().min(0).max(100);

/** A set of percentages that must add up to 100. */
const mix = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .refine(
      (value) =>
        Math.abs(Object.values(value as Record<string, number>).reduce((a, b) => a + b, 0) - 100) <
        0.001,
      { message: 'Percentages must add up to 100' },
    );

/** Advanced configuration (SPEC §3.10, §4.2, §4.4). Edited in Settings from M6. */
export const engagementConfigSchema = z
  .object({
    friendCount: z.number().int().min(5).max(50),
    /** Public profiles = friendCount × this. */
    publicProfileMultiplier: z.number().min(0).max(5),
    genderMix: mix({ female: percent, male: percent, nonbinary: percent }),
    sameCityPercent: percent,
    sharedLanguagePercent: percent,
    stanceMix: mix({ fan: percent, neutral: percent, critic: percent }),
    comments: z.object({
      min: z.number().int().min(0).max(MAX_COMMENTS_PER_POST),
      max: z.number().int().min(0).max(MAX_COMMENTS_PER_POST),
    }),
    likesMultiplier: z.object({ min: z.number().min(1).max(100), max: z.number().min(1).max(100) }),
    minLikes: z.number().int().min(0).max(1000),
    commentMix: mix({
      good: percent,
      appreciative: percent,
      nonsense: percent,
      critical: percent,
      superCritical: percent,
    }),
    maxCriticalPerPost: z.number().int().min(0).max(MAX_COMMENTS_PER_POST),
    /** Time compression for engagement: 1 = normal, 10 = ten times faster. */
    speed: z.number().min(0.25).max(60),
  })
  .refine((c) => c.comments.min <= c.comments.max, {
    message: 'Minimum comments must not exceed maximum',
    path: ['comments'],
  })
  .refine((c) => c.likesMultiplier.min <= c.likesMultiplier.max, {
    message: 'Minimum multiplier must not exceed maximum',
    path: ['likesMultiplier'],
  });

export type EngagementConfig = z.infer<typeof engagementConfigSchema>;

export const defaultEngagementConfig: EngagementConfig = {
  friendCount: 25,
  publicProfileMultiplier: 2,
  genderMix: { female: 50, male: 50, nonbinary: 0 },
  sameCityPercent: 40,
  sharedLanguagePercent: 70,
  stanceMix: { fan: 50, neutral: 35, critic: 15 },
  comments: { min: 0, max: 9 },
  likesMultiplier: { min: 3, max: 5 },
  minLikes: 3,
  commentMix: { good: 60, appreciative: 25, nonsense: 10, critical: 5, superCritical: 0 },
  maxCriticalPerPost: 2,
  speed: 1,
};

/** Applies age rules: under-18s never get Super-critical comments (moved to Critical). */
export function effectiveConfig(config: EngagementConfig, userAge: number): EngagementConfig {
  if (userAge >= ADULT_AGE || config.commentMix.superCritical === 0) return config;
  const { superCritical, ...rest } = config.commentMix;
  return {
    ...config,
    commentMix: { ...rest, critical: rest.critical + superCritical, superCritical: 0 },
  };
}
