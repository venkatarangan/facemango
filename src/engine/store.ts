import { create } from 'zustand';

export type SetupStage = 'waiting-for-ai' | 'friends' | 'public' | 'seed' | 'done';

interface EngineState {
  /** First-run world building (SPEC §3.1 steps 4–5). */
  setup: { stage: SetupStage; done: number; total: number; error?: string };
  /** postId → names of personas currently "writing a comment…" (SPEC §8 #3). */
  typing: Record<string, string[]>;
  /** "While you were away" summary shown after catch-up. */
  awaySummary: { reactions: number; comments: number } | null;
}

export const useEngineStore = create<EngineState>(() => ({
  setup: { stage: 'waiting-for-ai', done: 0, total: 0 },
  typing: {},
  awaySummary: null,
}));

export function setSetup(patch: Partial<EngineState['setup']>) {
  useEngineStore.setState((s) => ({ setup: { ...s.setup, ...patch } }));
}

export function setTyping(postId: string, names: string[]) {
  useEngineStore.setState((s) => {
    const typing = { ...s.typing };
    if (names.length) typing[postId] = names;
    else delete typing[postId];
    return { typing };
  });
}
