import type { AIPriority } from './provider';

interface Waiter {
  priority: AIPriority;
  resolve: (release: () => void) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/**
 * One-at-a-time priority lock for the model: interactive work (Mango AI, the composer) jumps
 * ahead of background generation (comments, friends, living feed). FIFO within a priority.
 */
export class AIQueue {
  private busy = false;
  private waiters: Waiter[] = [];

  get pending(): number {
    return this.waiters.length;
  }

  acquire(priority: AIPriority = 'background', signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve(this.makeRelease());
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { priority, resolve, reject, signal };
      if (signal) {
        waiter.onAbort = () => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(signal.reason);
        };
        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }
      if (priority === 'interactive') {
        const firstBackground = this.waiters.findIndex((w) => w.priority === 'background');
        if (firstBackground < 0) this.waiters.push(waiter);
        else this.waiters.splice(firstBackground, 0, waiter);
      } else {
        this.waiters.push(waiter);
      }
    });
  }

  async run<T>(task: () => Promise<T>, priority?: AIPriority, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(priority, signal);
    try {
      return await task();
    } finally {
      release();
    }
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (!next) {
        this.busy = false;
        return;
      }
      if (next.signal && next.onAbort) next.signal.removeEventListener('abort', next.onAbort);
      next.resolve(this.makeRelease());
    };
  }
}
