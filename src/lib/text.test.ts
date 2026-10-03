import { firstName, initials } from './text';

describe('text helpers', () => {
  it('initials', () => {
    expect(initials('Priya Raman')).toBe('PR');
    expect(initials('  madonna ')).toBe('M');
    expect(initials('Anna Maria Lopez')).toBe('AL');
  });
  it('firstName', () => {
    expect(firstName(' Venkat Rangan ')).toBe('Venkat');
  });
});
