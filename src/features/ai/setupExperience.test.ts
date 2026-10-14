import { IOS_DATA_NOTICE, UNIQUENESS } from '@/lib/copy';
import {
  currentStep,
  friendsProgress,
  isSlowDownload,
  nextTipIndex,
  setupTips,
  stepState,
} from './setupExperience';

describe('currentStep', () => {
  it('maps the AI and engine state to the three plain-language stages', () => {
    expect(currentStep('detecting', undefined, 'waiting-for-ai')).toBe('download');
    expect(currentStep('downloading', 'download', 'waiting-for-ai')).toBe('download');
    expect(currentStep('needs-gesture', undefined, 'waiting-for-ai')).toBe('download');
    expect(currentStep('downloading', 'load', 'waiting-for-ai')).toBe('wake');
    expect(currentStep('error', 'load', 'waiting-for-ai')).toBe('wake');
    expect(currentStep('ready', 'load', 'waiting-for-ai')).toBe('friends');
    expect(currentStep('ready', 'load', 'seed')).toBe('friends');
    expect(currentStep('ready', undefined, 'done')).toBe('done');
  });

  it('marks earlier stages done and later ones to do', () => {
    expect(stepState('download', 'wake')).toBe('done');
    expect(stepState('wake', 'wake')).toBe('active');
    expect(stepState('friends', 'wake')).toBe('todo');
    expect(stepState('friends', 'done')).toBe('done');
  });
});

describe('friendsProgress', () => {
  it('runs one bar across friends, public profiles and seed posts', () => {
    expect(friendsProgress({ stage: 'waiting-for-ai', done: 0, total: 0 }).fraction).toBe(0);
    const friends = friendsProgress({ stage: 'friends', done: 10, total: 25 });
    expect(friends.label).toBe('Finding your friends');
    expect(friends.count).toBe('10 of 25');
    expect(friends.fraction).toBeCloseTo(0.16);
    expect(friendsProgress({ stage: 'public', done: 0, total: 50 }).fraction).toBeCloseTo(0.4);
    const seed = friendsProgress({ stage: 'seed', done: 20, total: 20 });
    expect(seed.label).toBe('Writing their first posts');
    expect(seed.fraction).toBe(1);
  });

  it('never runs past the total', () => {
    expect(friendsProgress({ stage: 'seed', done: 30, total: 20 }).count).toBe('20 of 20');
  });
});

describe('tips', () => {
  it('leads with the privacy message and adds the iOS notice on iOS only', () => {
    const ios = setupTips({ ios: true });
    const other = setupTips({ ios: false });
    expect(ios[0]).toBe(UNIQUENESS);
    expect(ios).toContain(IOS_DATA_NOTICE);
    expect(other).not.toContain(IOS_DATA_NOTICE);
    expect(other.some((t) => /Backup & restore/.test(t))).toBe(true);
  });

  it('rotates and wraps around', () => {
    expect(nextTipIndex(0, 3)).toBe(1);
    expect(nextTipIndex(2, 3)).toBe(0);
    expect(nextTipIndex(0, 0)).toBe(0);
  });
});

describe('isSlowDownload', () => {
  const base = { status: 'downloading' as const, phase: 'download' as const };

  it('is calm by default', () => {
    expect(isSlowDownload({ ...base, secondsLeft: 120, progressAt: 0 }, 30_000)).toBe(false);
  });

  it('flags a long wait or a stall', () => {
    expect(isSlowDownload({ ...base, secondsLeft: 45 * 60 }, 0)).toBe(true);
    expect(isSlowDownload({ ...base, progressAt: 0 }, 90_000)).toBe(true);
  });

  it('only applies while downloading', () => {
    expect(isSlowDownload({ status: 'downloading', phase: 'load', progressAt: 0 }, 90_000)).toBe(
      false,
    );
    expect(isSlowDownload({ status: 'ready', phase: 'download', progressAt: 0 }, 90_000)).toBe(
      false,
    );
  });
});
