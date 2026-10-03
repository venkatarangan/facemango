import type { ReactElement } from 'react';
import HomeRounded from '@mui/icons-material/HomeRounded';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import AutoStoriesRounded from '@mui/icons-material/AutoStoriesRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import SpaRounded from '@mui/icons-material/SpaRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import InfoRounded from '@mui/icons-material/InfoRounded';

export interface NavItem {
  path: string;
  label: string;
  icon: ReactElement;
  /** Shown in the phone bottom navigation (SPEC §6.4: Home · Friends · Mango AI · Memories · 🔔). */
  bottomNav?: boolean;
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <HomeRounded />, bottomNav: true },
  { path: '/friends', label: 'Friends', icon: <PeopleAltRounded />, bottomNav: true },
  { path: '/assistant', label: 'Mango AI', icon: <AutoAwesomeRounded />, bottomNav: true },
  { path: '/memories', label: 'Memories', icon: <AutoStoriesRounded />, bottomNav: true },
  { path: '/notifications', label: 'Activity', icon: <NotificationsRounded />, bottomNav: true },
  { path: '/photos', label: 'Photos', icon: <PhotoLibraryRounded /> },
  { path: '/wellbeing', label: 'Wellbeing', icon: <SpaRounded /> },
  { path: '/settings', label: 'Settings', icon: <SettingsRounded /> },
  { path: '/about', label: 'About & privacy', icon: <InfoRounded /> },
];

export function isActive(itemPath: string, pathname: string): boolean {
  return itemPath === '/' ? pathname === '/' : pathname.startsWith(itemPath);
}
