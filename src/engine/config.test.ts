import { defaultEngagementConfig, effectiveConfig, engagementConfigSchema } from './config';

describe('engagement config', () => {
  it('defaults match the spec and validate', () => {
    expect(engagementConfigSchema.parse(defaultEngagementConfig)).toEqual(defaultEngagementConfig);
    expect(defaultEngagementConfig.commentMix).toEqual({
      good: 60,
      appreciative: 25,
      nonsense: 10,
      critical: 5,
      superCritical: 0,
    });
    expect(defaultEngagementConfig.comments).toEqual({ min: 0, max: 9 });
    expect(defaultEngagementConfig.likesMultiplier).toEqual({ min: 3, max: 5 });
    expect(defaultEngagementConfig.publicProfileMultiplier).toBe(2);
  });

  it('rejects comment bands above the hard cap', () => {
    const result = engagementConfigSchema.safeParse({
      ...defaultEngagementConfig,
      comments: { min: 0, max: 101 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects mixes that do not add up to 100', () => {
    const result = engagementConfigSchema.safeParse({
      ...defaultEngagementConfig,
      commentMix: { ...defaultEngagementConfig.commentMix, good: 70 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects inverted ranges', () => {
    const result = engagementConfigSchema.safeParse({
      ...defaultEngagementConfig,
      likesMultiplier: { min: 6, max: 3 },
    });
    expect(result.success).toBe(false);
  });

  it('disables Super-critical comments for under-18s', () => {
    const config = {
      ...defaultEngagementConfig,
      commentMix: { good: 50, appreciative: 25, nonsense: 10, critical: 5, superCritical: 10 },
    };
    expect(effectiveConfig(config, 15).commentMix).toEqual({
      good: 50,
      appreciative: 25,
      nonsense: 10,
      critical: 15,
      superCritical: 0,
    });
    expect(effectiveConfig(config, 18)).toBe(config);
  });
});
