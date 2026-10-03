import { Outlet, ScrollRestoration } from 'react-router';
import { Toaster } from '@/components/Toaster';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
      <Toaster />
      {import.meta.env.PROD && <PwaUpdatePrompt />}
    </>
  );
}
