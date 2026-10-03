import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Captures the browser's install prompt (Android/desktop Chrome & Edge) for an "Install" button. */
export const useInstallStore = create<{ prompt: BeforeInstallPromptEvent | null }>(() => ({
  prompt: null,
}));

export function listenForInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.setState({ prompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstallStore.setState({ prompt: null }));
}

export async function promptInstall(): Promise<boolean> {
  const event = useInstallStore.getState().prompt;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  useInstallStore.setState({ prompt: null });
  return outcome === 'accepted';
}
