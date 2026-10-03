import Card from '@mui/material/Card';
import { NavList } from '@/app/shell/NavList';
import { useProfile } from '@/app/useProfile';

/** Phone "more" menu: every section, including the ones not in the bottom nav. */
export function MenuPage() {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <Card sx={{ p: 1 }}>
      <NavList profile={profile} />
    </Card>
  );
}
