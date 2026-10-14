import {
  allocateMix,
  classifyTone,
  distribution,
  duplicateCount,
  estimateTokens,
  mixDistance,
  ngrams,
  repetitionScore,
} from './scoring';

describe('repetition', () => {
  it('splits words without punctuation or emoji', () => {
    expect(ngrams('So proud of you!! 🙌 Well done', 2)).toEqual([
      'so proud',
      'proud of',
      'of you',
      'you well',
      'well done',
    ]);
  });

  it('is 0 for different outputs and 1 for identical ones', () => {
    expect(repetitionScore(['the cat sat down', 'a dog ran off fast'])).toBe(0);
    expect(repetitionScore(['so happy for you', 'So happy for you!'])).toBe(1);
    expect(repetitionScore([])).toBe(0);
  });

  it('scores partial overlap between 0 and 1', () => {
    const score = repetitionScore(['so happy for you today', 'so happy for the win']);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('counts exact duplicates, ignoring case and punctuation', () => {
    expect(duplicateCount(['Nice!', 'nice', 'Great shot', 'NICE.'])).toBe(2);
  });
});

describe('tone mix', () => {
  it('splits 20 comments 60/25/10/5 exactly', () => {
    expect(
      allocateMix({ good: 60, appreciative: 25, nonsense: 10, critical: 5, superCritical: 0 }, 20),
    ).toEqual({ good: 12, appreciative: 5, nonsense: 2, critical: 1, superCritical: 0 });
  });

  it('always allocates every item', () => {
    const mix = allocateMix({ a: 33, b: 33, c: 34 }, 10);
    expect(mix.a + mix.b + mix.c).toBe(10);
  });

  it('guesses tones from keywords', () => {
    expect(classifyTone('Nice shot, but the lighting is a bit off honestly.')).toBe('critical');
    expect(classifyTone('lol my cat just sat on my keyboard 🐱 ok bye')).toBe('nonsense');
    expect(classifyTone('So proud of you, this is wonderful 🙌')).toBe('appreciative');
    expect(classifyTone('Looks great! Where is this?')).toBe('good');
  });

  it('turns tones into percentages and measures the distance to a target', () => {
    const d = distribution(['good', 'good', 'good', 'critical']);
    expect(d).toEqual({ good: 75, appreciative: 0, nonsense: 0, critical: 25 });
    const target = { good: 60, appreciative: 25, nonsense: 10, critical: 5 };
    expect(mixDistance(target, target)).toBe(0);
    expect(mixDistance(d, target)).toBe(35);
  });
});

describe('estimateTokens', () => {
  it('uses about 4 characters per token', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
    expect(estimateTokens('')).toBe(1);
  });
});
