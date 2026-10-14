/** Download/load progress helpers for the first-run wait (pure; no WebLLM import). */

/** `download`: fetching model weights (once only). `load`: getting a stored model ready. */
export type LoadPhase = 'download' | 'load';

/** Classifies a WebLLM progress report by its text; unknown texts keep the previous phase. */
export function webllmPhase(text: string, previous: LoadPhase): LoadPhase {
  if (/^(Fetching param cache|Start to fetch)/i.test(text)) return 'download';
  if (/^(Loading model from cache|Loading GPU shader|Finish loading)/i.test(text)) return 'load';
  return previous;
}

/** Estimates the time left from recent (time, progress) samples, over a sliding window. */
export class EtaEstimator {
  private samples: { t: number; p: number }[] = [];
  private readonly windowMs: number;
  private readonly minSpanMs: number;

  constructor(windowMs = 60_000, minSpanMs = 5_000) {
    this.windowMs = windowMs;
    this.minSpanMs = minSpanMs;
  }

  reset(): void {
    this.samples = [];
  }

  add(t: number, p: number): void {
    const last = this.samples.at(-1);
    // A new file or model starts again from 0: forget the old rate.
    if (last && p < last.p - 0.01) this.samples = [];
    this.samples.push({ t, p });
    while (this.samples.length > 2 && t - this.samples[1]!.t >= this.windowMs) {
      this.samples.shift();
    }
  }

  /** Seconds left, or undefined when there isn't enough to go on yet. */
  secondsLeft(): number | undefined {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (!first || !last || last.p >= 1) return undefined;
    const span = last.t - first.t;
    const gained = last.p - first.p;
    if (span < this.minSpanMs || gained <= 0) return undefined;
    return Math.round(((1 - last.p) * span) / gained / 1000);
  }
}

/** "About 3 minutes left" style labels. */
export function formatTimeLeft(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return undefined;
  if (seconds < 45) return 'Less than a minute left';
  if (seconds < 90) return 'About a minute left';
  if (seconds < 3_300) return `About ${Math.round(seconds / 60)} minutes left`;
  const hours = Math.round(seconds / 3_600);
  return hours <= 1 ? 'About an hour left' : `About ${hours} hours left`;
}

/** WebLLM reports "…: 540MB fetched. 45% completed…"; this returns {loaded, total} in MB. */
export function downloadSizeMB(
  text: string | undefined,
  progress: number,
): { loaded: number; total: number } | undefined {
  const match = text?.match(/(\d+)MB fetched/);
  if (!match || progress < 0.02) return undefined;
  const loaded = Number(match[1]);
  return { loaded, total: Math.max(loaded, Math.round(loaded / progress)) };
}

export function formatMB(mb: number): string {
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
