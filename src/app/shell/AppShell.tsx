import { useEffect } from 'react';
import { Outlet } from 'react-router';
import Box from '@mui/material/Box';
import { TopBar } from './TopBar';
import { NavList } from './NavList';
import { RightRail } from './RightRail';
import { BottomNav } from './BottomNav';
import { useProfile } from '@/app/useProfile';
import { startAI } from '@/ai';
import { startEngine } from '@/engine';
import { startUsageTracking } from '@/lib/usage';
import { WellbeingNudges } from '@/features/wellbeing/WellbeingNudges';
import { Celebrations } from '@/features/celebrations/Celebrations';
import { loadSoundPreference } from '@/lib/sound';

const RAIL_TOP = { xs: 56, md: 64 };

/** Responsive shell (SPEC §6.4): 3 columns on desktop, 2 on tablet, 1 + bottom nav on phones. */
export function AppShell() {
  const profile = useProfile();
  const signedUp = !!profile;
  useEffect(() => {
    if (!signedUp) return;
    void startAI({ userGesture: false });
    startEngine();
    startUsageTracking();
    void loadSoundPreference();
  }, [signedUp]);
  if (!profile) return null; // RequireProfile guarantees this after loading.

  return (
    <Box sx={{ minHeight: '100dvh' }}>
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: 2000,
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: 'primary.main',
          color: 'text.primary',
          fontWeight: 700,
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Box>
      <TopBar profile={profile} />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: { md: 3, lg: 4 },
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 0, sm: 2, md: 3 },
        }}
      >
        <Box
          component="aside"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: { md: 240, lg: 280 },
            flexShrink: 0,
            position: 'sticky',
            top: RAIL_TOP,
            alignSelf: 'flex-start',
            maxHeight: { md: 'calc(100dvh - 64px)' },
            overflowY: 'auto',
            py: 2,
          }}
        >
          <NavList profile={profile} />
        </Box>
        <Box
          component="main"
          id="main"
          sx={{
            flex: 1,
            minWidth: 0,
            maxWidth: 680,
            py: { xs: 1.5, sm: 2 },
            px: { xs: 1.5, sm: 0 },
            pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', md: 4 },
          }}
        >
          <Outlet />
        </Box>
        <Box
          component="aside"
          aria-label="Birthdays and contacts"
          sx={{
            display: { xs: 'none', lg: 'block' },
            width: 300,
            flexShrink: 0,
            position: 'sticky',
            top: RAIL_TOP,
            alignSelf: 'flex-start',
            py: 2,
          }}
        >
          <RightRail />
        </Box>
      </Box>
      <BottomNav />
      <WellbeingNudges />
      <Celebrations />
    </Box>
  );
}
