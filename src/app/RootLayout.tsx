import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { useAIStore } from '@/ai';
import { UnsupportedPage } from '@/features/ai/UnsupportedPage';
import { Toaster } from '@/components/Toaster';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';

export function RootLayout() {
  const unsupported = useAIStore((s) => s.status === 'unsupported');
  const { pathname } = useLocation();
  // Tier 3: no local AI means no FaceMango (SPEC §5.1). About stays reachable.
  const blocked = unsupported && pathname !== '/about';
  return (
    <>
      {blocked ? <UnsupportedPage /> : <Outlet />}
      <ScrollRestoration />
      <Toaster />
      {import.meta.env.PROD && <PwaUpdatePrompt />}
    </>
  );
}
