import { Link as RouterLink } from 'react-router';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import { Logo } from '@/components/brand/Logo';
import { UserAvatar } from '@/components/UserAvatar';
import type { Profile } from '@/db';
import Badge from '@mui/material/Badge';
import { brand } from '@/app/tokens';
import { useUnreadCount } from '@/features/activity/useUnreadCount';

export function TopBar({ profile }: { profile: Profile }) {
  const unread = useUnreadCount();
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        bgcolor: 'rgba(255,255,255,0.86)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: `1px solid ${brand.divider}`,
        pt: 'env(safe-area-inset-top)',
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56, md: 64 } }}>
        <Box component={RouterLink} to="/" sx={{ display: 'flex', textDecoration: 'none' }}>
          <Logo size={30} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Photos">
          <IconButton component={RouterLink} to="/photos" aria-label="Photos">
            <PhotoLibraryRounded />
          </IconButton>
        </Tooltip>
        <Tooltip title="Activity">
          <IconButton
            component={RouterLink}
            to="/notifications"
            aria-label="Activity"
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            <Badge badgeContent={unread} color="error" max={99}>
              <NotificationsRounded />
            </Badge>
          </IconButton>
        </Tooltip>
        <Tooltip title="Menu">
          <IconButton component={RouterLink} to="/menu" aria-label="Menu" sx={{ p: 0.5 }}>
            <UserAvatar profile={profile} size={34} />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
