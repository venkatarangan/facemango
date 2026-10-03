/** Hard invariants (CLAUDE.md "Engineering rules"). No configuration can exceed these. */
export const MAX_LIKES_PER_POST = 1_000_000;
export const MAX_COMMENTS_PER_POST = 100;
export const MIN_AGE = 13;
export const ADULT_AGE = 18;

const clampInt = (value: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;

export const clampLikes = (likes: number) => clampInt(likes, MAX_LIKES_PER_POST);
export const clampComments = (comments: number) => clampInt(comments, MAX_COMMENTS_PER_POST);
