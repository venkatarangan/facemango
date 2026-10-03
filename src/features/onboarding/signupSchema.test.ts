import { signupSchema } from './signupSchema';

const valid = {
  name: '  Venkat ',
  age: 30,
  city: 'Chennai',
  languages: ['English', 'Tamil'],
  acknowledged: true,
};

describe('signup schema', () => {
  it('accepts a valid profile and trims text', () => {
    const parsed = signupSchema.parse(valid);
    expect(parsed.name).toBe('Venkat');
  });

  it.each([12, 0, -1, 12.5, Number.NaN])('rejects age %s', (age) => {
    expect(signupSchema.safeParse({ ...valid, age }).success).toBe(false);
  });

  it('accepts age 13', () => {
    expect(signupSchema.safeParse({ ...valid, age: 13 }).success).toBe(true);
  });

  it('requires the data notice acknowledgement', () => {
    expect(signupSchema.safeParse({ ...valid, acknowledged: false }).success).toBe(false);
  });

  it('requires at least one language', () => {
    expect(signupSchema.safeParse({ ...valid, languages: [] }).success).toBe(false);
  });

  it('requires name and city', () => {
    expect(signupSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, city: '' }).success).toBe(false);
  });
});
