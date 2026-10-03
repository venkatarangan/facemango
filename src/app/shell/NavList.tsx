import { Link as RouterLink, useLocation } from 'react-router';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { isActive, navItems } from '@/app/nav';
import { UserAvatar } from '@/components/UserAvatar';
import type { Profile } from '@/db';

/** Vertical navigation used by the desktop left column and the phone menu page. */
export function NavList({ profile, dense = false }: { profile: Profile; dense?: boolean }) {
  const { pathname } = useLocation();
  return (
    <List component="nav" aria-label="Main" dense={dense} sx={{ display: 'grid', gap: 0.25 }}>
      <ListItemButton component={RouterLink} to="/settings">
        <ListItemIcon sx={{ minWidth: 44 }}>
          <UserAvatar profile={profile} size={30} />
        </ListItemIcon>
        <ListItemText primary={profile.name} slotProps={{ primary: { sx: { fontWeight: 700 } } }} />
      </ListItemButton>
      {navItems.map((item) => {
        const selected = isActive(item.path, pathname);
        return (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={selected}
            aria-current={selected ? 'page' : undefined}
          >
            <ListItemIcon sx={{ minWidth: 44, color: 'text.primary' }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 500 } } }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
