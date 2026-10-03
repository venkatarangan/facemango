export const profilePath = (id: string) => (id === 'me' ? '/profile/me' : `/profile/${id}`);
