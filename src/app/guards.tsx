import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useProfile } from './useProfile';
import { SplashScreen } from '@/components/SplashScreen';

/** Routes that need a signed-up user. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const profile = useProfile();
  if (profile === undefined) return <SplashScreen />;
  if (profile === null) return <Navigate to="/welcome" replace />;
  return children;
}

/** Landing and signup: skip straight to the app once a profile exists. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const profile = useProfile();
  if (profile === undefined) return <SplashScreen />;
  if (profile) return <Navigate to="/" replace />;
  return children;
}
