import Avatar, { type AvatarProps } from '@mui/material/Avatar';
import type { Profile } from '@/db';
import { brand } from '@/app/tokens';
import { useMediaUrl } from '@/app/useProfile';
import { initials } from '@/lib/text';

export function UserAvatar({
  profile,
  size = 40,
  sx,
  ...rest
}: { profile: Profile; size?: number } & AvatarProps) {
  const url = useMediaUrl(profile.photoId);
  return (
    <Avatar
      src={url}
      alt={profile.name}
      sx={{
        width: size,
        height: size,
        bgcolor: brand.mango,
        color: brand.ink,
        fontWeight: 700,
        fontSize: size * 0.4,
        ...sx,
      }}
      {...rest}
    >
      {initials(profile.name)}
    </Avatar>
  );
}
