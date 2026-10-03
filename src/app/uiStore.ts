import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
}

interface UiState {
  toast: Toast | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message) => set({ toast: { id: Date.now(), message } }),
  dismissToast: () => set({ toast: null }),
}));
