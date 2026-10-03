import { useMemo } from 'react';
import Avatar from '@mui/material/Avatar';
import type { SxProps, Theme } from '@mui/material/styles';
import { avatarDataUri } from '@/engine/avatar';
import type { Author } from '@/features/feed/useAuthors';
import { UserAvatar } from './UserAvatar';

/** The user's photo/initials, or a persona's locally rendered DiceBear avatar. */
export function AuthorAvatar({
  author,
  size = 40,
  sx,
}: {
  author: Author;
  size?: number;
  sx?: SxProps<Theme>;
}) {
  const src = useMemo(
    () => (author.kind === 'me' ? undefined : avatarDataUri(author.persona)),
    [author],
  );
  if (author.kind === 'me') return <UserAvatar profile={author.profile} size={size} sx={sx} />;
  return (
    <Avatar
      src={src}
      alt={author.name}
      sx={{ width: size, height: size, bgcolor: '#FFF3C4', ...sx }}
    />
  );
}
