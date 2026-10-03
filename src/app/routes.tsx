import type { RouteObject } from 'react-router';
import { RootLayout } from './RootLayout';
import { PublicOnly, RequireProfile } from './guards';
import { AppShell } from './shell/AppShell';
import { LandingPage } from '@/features/onboarding/LandingPage';
import { HomePage } from '@/features/feed/HomePage';
import { SplashScreen } from '@/components/SplashScreen';

const placeholders = () => import('@/features/placeholder/pages');

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    hydrateFallbackElement: <SplashScreen />,
    children: [
      {
        path: 'welcome',
        element: (
          <PublicOnly>
            <LandingPage />
          </PublicOnly>
        ),
      },
      {
        path: 'signup',
        lazy: async () => {
          const { SignupPage } = await import('@/features/onboarding/SignupPage');
          return {
            element: (
              <PublicOnly>
                <SignupPage />
              </PublicOnly>
            ),
          };
        },
      },
      {
        path: 'about',
        lazy: async () => ({ Component: (await import('@/features/about/AboutPage')).AboutPage }),
      },
      {
        element: (
          <RequireProfile>
            <AppShell />
          </RequireProfile>
        ),
        children: [
          { index: true, element: <HomePage /> },
          {
            path: 'friends',
            lazy: async () => ({ Component: (await placeholders()).FriendsPage }),
          },
          {
            path: 'assistant',
            lazy: async () => ({ Component: (await placeholders()).AssistantPage }),
          },
          {
            path: 'memories',
            lazy: async () => ({ Component: (await placeholders()).MemoriesPage }),
          },
          {
            path: 'notifications',
            lazy: async () => ({ Component: (await placeholders()).ActivityPage }),
          },
          { path: 'photos', lazy: async () => ({ Component: (await placeholders()).PhotosPage }) },
          {
            path: 'wellbeing',
            lazy: async () => ({ Component: (await placeholders()).WellbeingPage }),
          },
          {
            path: 'settings',
            lazy: async () => ({
              Component: (await import('@/features/settings/SettingsPage')).SettingsPage,
            }),
          },
          {
            path: 'menu',
            lazy: async () => ({
              Component: (await import('@/features/settings/MenuPage')).MenuPage,
            }),
          },
        ],
      },
      {
        path: '*',
        lazy: async () => ({
          Component: (await import('@/features/placeholder/NotFoundPage')).NotFoundPage,
        }),
      },
    ],
  },
];
