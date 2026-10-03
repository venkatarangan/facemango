import { Link as RouterLink, useLocation } from 'react-router';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import { isActive, navItems } from '@/app/nav';
import { brand } from '@/app/tokens';

const items = navItems.filter((item) => item.bottomNav);

export function BottomNav() {
  const { pathname } = useLocation();
  const current = items.find((item) => isActive(item.path, pathname))?.path ?? false;
  return (
    <Paper
      component="nav"
      aria-label="Main"
      elevation={0}
      sx={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar,
        display: { xs: 'block', md: 'none' },
        borderTop: `1px solid ${brand.divider}`,
        bgcolor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'saturate(180%) blur(12px)',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation showLabels value={current} sx={{ bgcolor: 'transparent', height: 64 }}>
        {items.map((item) => (
          <BottomNavigationAction
            key={item.path}
            component={RouterLink}
            to={item.path}
            value={item.path}
            label={item.label}
            icon={item.icon}
            aria-current={current === item.path ? 'page' : undefined}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
