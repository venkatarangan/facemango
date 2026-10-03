import type { RouteObject } from 'react-router';
import { RootLayout } from './RootLayout';
import { PublicOnly, RequireProfile } from './guards';
import { AppShell } from './shell/AppShell';
import { LandingPage } from '@/features/onboarding/LandingPage';
import { HomePage } from '@/features/feed/HomePage';
import { SplashScreen } from '@/components/SplashScreen';

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
        path: 'credits',
        lazy: async () => ({
          Component: (await import('@/features/credits/CreditsPage')).CreditsPage,
        }),
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
            lazy: async () => ({
              Component: (await import('@/features/friends/FriendsPage')).FriendsPage,
            }),
          },
          {
            path: 'profile/:id',
            lazy: async () => ({
              Component: (await import('@/features/profile/ProfilePage')).ProfilePage,
            }),
          },
          {
            path: 'post/:id',
            lazy: async () => ({ Component: (await import('@/features/feed/PostPage')).PostPage }),
          },
          {
            path: 'assistant',
            lazy: async () => ({
              Component: (await import('@/features/assistant/AssistantPage')).AssistantPage,
            }),
          },
          {
            path: 'memories',
            lazy: async () => ({
              Component: (await import('@/features/memories/MemoriesPage')).MemoriesPage,
            }),
          },
          {
            path: 'notifications',
            lazy: async () => ({
              Component: (await import('@/features/activity/ActivityPage')).ActivityPage,
            }),
          },
          {
            path: 'photos',
            lazy: async () => ({
              Component: (await import('@/features/photos/PhotosPage')).PhotosPage,
            }),
          },
          {
            path: 'wellbeing',
            lazy: async () => ({
              Component: (await import('@/features/wellbeing/WellbeingPage')).WellbeingPage,
            }),
          },
          {
            path: 'settings',
            lazy: async () => ({
              Component: (await import('@/features/settings/SettingsPage')).SettingsPage,
            }),
          },
          {
            path: 'settings/advanced',
            lazy: async () => ({
              Component: (await import('@/features/settings/AdvancedSettingsPage'))
                .AdvancedSettingsPage,
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
