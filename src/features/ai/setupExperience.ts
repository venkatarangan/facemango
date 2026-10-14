/** First-run "setup experience": plain-language stages, tips and slow-network hints (pure). */
import type { AIStatus, LoadPhase } from '@/ai';
import type { SetupStage } from '@/engine/store';
import { IOS_DATA_NOTICE, SIMULATED_FRIENDS_NOTE, UNIQUENESS } from '@/lib/copy';

export type SetupStep = 'download' | 'wake' | 'friends';
export type StepState = 'done' | 'active' | 'todo';

export const SETUP_STEPS: SetupStep[] = ['download', 'wake', 'friends'];

export const STEP_LABELS: Record<SetupStep, { active: string; done: string }> = {
  download: { active: 'Downloading your AI (once only)', done: 'Your AI is on this device' },
  wake: { active: 'Waking it up', done: 'Your AI is awake' },
  friends: { active: 'Meeting your friends', done: 'Your friends are here' },
};

/** Which plain-language stage the user is in. A model already on the device skips the download. */
export function currentStep(
  status: AIStatus,
  phase: LoadPhase | undefined,
  stage: SetupStage,
): SetupStep | 'done' {
  if (status !== 'ready') return phase === 'load' ? 'wake' : 'download';
  return stage === 'done' ? 'done' : 'friends';
}

export function stepState(step: SetupStep, current: SetupStep | 'done'): StepState {
  if (current === 'done') return 'done';
  const i = SETUP_STEPS.indexOf(step);
  const c = SETUP_STEPS.indexOf(current);
  return i < c ? 'done' : i === c ? 'active' : 'todo';
}

const FRIEND_PARTS = {
  friends: { label: 'Finding your friends', from: 0, to: 0.4 },
  public: { label: 'Meeting people around you', from: 0.4, to: 0.7 },
  seed: { label: 'Writing their first posts', from: 0.7, to: 1 },
} as const;

/** "Meeting your friends" as one bar over its three parts, with the current part's count. */
export function friendsProgress(setup: { stage: SetupStage; done: number; total: number }): {
  label: string;
  count?: string;
  fraction: number;
} {
  if (setup.stage === 'done') return { label: 'Done', fraction: 1 };
  if (setup.stage === 'waiting-for-ai') return { label: FRIEND_PARTS.friends.label, fraction: 0 };
  const part = FRIEND_PARTS[setup.stage];
  const inPart = setup.total ? Math.min(1, setup.done / setup.total) : 0;
  return {
    label: part.label,
    count: setup.total ? `${Math.min(setup.done, setup.total)} of ${setup.total}` : undefined,
    fraction: part.from + (part.to - part.from) * inPart,
  };
}

/** Short tips shown one at a time while waiting. */
export function setupTips({ ios }: { ios: boolean }): string[] {
  const backup = ios
    ? IOS_DATA_NOTICE
    : 'Your data lives only in this browser. Back it up any time from Settings → Backup & restore.';
  return [
    UNIQUENESS,
    'The download happens once. Next time, FaceMango opens in seconds.',
    backup,
    'Mention a friend with @ in a post and they will always reply.',
    'Stuck for words? ✨ Mango AI can write or polish a post for you.',
    'Wellbeing shows how long you spend here, and you can set a gentle daily goal.',
    'Memories brings back your posts from a week, a month and a year ago.',
    SIMULATED_FRIENDS_NOTE,
  ];
}

export const TIP_INTERVAL_MS = 9_000;

export function nextTipIndex(index: number, count: number): number {
  return count > 0 ? (index + 1) % count : 0;
}

/** No progress for a minute, or more than 20 minutes to go: show the calm slow-network note. */
export const STALL_MS = 60_000;
export const SLOW_SECONDS = 20 * 60;

export function isSlowDownload(
  ai: {
    status: AIStatus;
    phase?: LoadPhase;
    secondsLeft?: number;
    progressAt?: number;
  },
  now: number,
): boolean {
  if (ai.status !== 'downloading' || ai.phase !== 'download') return false;
  if ((ai.secondsLeft ?? 0) > SLOW_SECONDS) return true;
  return ai.progressAt !== undefined && now - ai.progressAt > STALL_MS;
}
