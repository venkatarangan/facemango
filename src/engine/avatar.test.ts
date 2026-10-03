import { avatarDataUri, avatarTraits } from './avatar';

describe('avatars', () => {
  it('maps AI traits to DiceBear options and renders an SVG data URI', () => {
    const avatar = avatarTraits('seed-1', {
      skinTone: 'dark',
      hair: 'curly',
      facialHair: 'beard',
      glasses: true,
    });
    expect(avatar.options).toMatchObject({
      skinColor: '623d36',
      eyes: 'glasses',
      facialHairProbability: 100,
    });
    const uri = avatarDataUri({ id: 'x', avatar });
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
    expect(avatarDataUri({ id: 'x', avatar })).toBe(uri);
  });
});
