import { cleanCommentText } from './scheduler';

describe('cleanCommentText', () => {
  it('strips quotes and a leading self-name', () => {
    const name = 'Priya Raman';
    expect(cleanCommentText('"So proud of you!"', name)).toBe('So proud of you!');
    expect(cleanCommentText('Priya: Lovely!', name)).toBe('Lovely!');
    expect(cleanCommentText("Priya Raman here! That's amazing, Asha!", name)).toBe(
      "That's amazing, Asha!",
    );
    expect(cleanCommentText('Priya Raman again! So thrilled', name)).toBe('So thrilled');
    expect(cleanCommentText("Priya, that's incredible", name)).toBe("That's incredible");
    expect(cleanCommentText('Lena Weber. Half marathon? Impressive.', 'Lena Weber')).toBe(
      'Half marathon? Impressive.',
    );
  });

  it('keeps other names and a name used mid-sentence', () => {
    expect(cleanCommentText('Asha, well done!', 'Priya Raman')).toBe('Asha, well done!');
    expect(cleanCommentText('Priyanka would love this', 'Priya Raman')).toBe(
      'Priyanka would love this',
    );
  });
});
