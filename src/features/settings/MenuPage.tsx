import Card from '@mui/material/Card';
import { NavList } from '@/app/shell/NavList';
import { useProfile } from '@/app/useProfile';
import { SiteFooter } from '@/components/SiteFooter';

/** Phone "more" menu: every section, including the ones not in the bottom nav. */
export function MenuPage() {
  const profile = useProfile();
  if (!profile) return null;
  return (
    <>
      <Card sx={{ p: 1 }}>
        <NavList profile={profile} />
      </Card>
      <SiteFooter sx={{ display: 'block', textAlign: 'center', px: 2, pt: 2 }} />
    </>
  );
}
