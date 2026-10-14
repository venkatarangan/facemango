import { downloadSizeMB, EtaEstimator, formatMB, formatTimeLeft, webllmPhase } from './progress';

describe('webllmPhase', () => {
  it('tells downloading from loading by the WebLLM report text', () => {
    expect(webllmPhase('Start to fetch params', 'load')).toBe('download');
    expect(
      webllmPhase('Fetching param cache[3/27]: 540MB fetched. 45% completed, 30 secs', 'load'),
    ).toBe('download');
    expect(webllmPhase('Loading model from cache[3/27]: 200MB loaded.', 'download')).toBe('load');
    expect(webllmPhase('Loading GPU shader modules[10/80]: 12% completed', 'download')).toBe(
      'load',
    );
    expect(webllmPhase('Finish loading on WebGPU - nvidia', 'download')).toBe('load');
  });

  it('keeps the previous phase for unknown text', () => {
    expect(webllmPhase('Something new', 'download')).toBe('download');
    expect(webllmPhase('Something new', 'load')).toBe('load');
  });
});

describe('EtaEstimator', () => {
  it('needs a few seconds of progress before it guesses', () => {
    const eta = new EtaEstimator();
    eta.add(0, 0.1);
    expect(eta.secondsLeft()).toBeUndefined();
    eta.add(2_000, 0.11);
    expect(eta.secondsLeft()).toBeUndefined();
  });

  it('estimates from the recent rate', () => {
    const eta = new EtaEstimator();
    // 1% per second → 50% left is about 50 s.
    for (let s = 0; s <= 10; s++) eta.add(s * 1000, 0.4 + s * 0.01);
    expect(eta.secondsLeft()).toBe(50);
  });

  it('uses only the sliding window, so a speed change shows up', () => {
    const eta = new EtaEstimator(10_000);
    for (let s = 0; s <= 30; s++) eta.add(s * 1000, s * 0.001); // slow start
    for (let s = 31; s <= 60; s++) eta.add(s * 1000, 0.03 + (s - 30) * 0.01); // then fast
    // At 0.33 with 1%/s, about 67 s left.
    expect(eta.secondsLeft()).toBeGreaterThan(60);
    expect(eta.secondsLeft()).toBeLessThan(75);
  });

  it('starts over when progress goes back to 0 (a fallback model)', () => {
    const eta = new EtaEstimator();
    for (let s = 0; s <= 10; s++) eta.add(s * 1000, 0.5 + s * 0.01);
    eta.add(11_000, 0);
    expect(eta.secondsLeft()).toBeUndefined();
  });

  it('gives nothing when stalled or finished', () => {
    const eta = new EtaEstimator();
    eta.add(0, 0.5);
    eta.add(10_000, 0.5);
    expect(eta.secondsLeft()).toBeUndefined();
    eta.add(20_000, 1);
    expect(eta.secondsLeft()).toBeUndefined();
  });
});

describe('formatTimeLeft', () => {
  it('rounds to friendly labels', () => {
    expect(formatTimeLeft(undefined)).toBeUndefined();
    expect(formatTimeLeft(20)).toBe('Less than a minute left');
    expect(formatTimeLeft(70)).toBe('About a minute left');
    expect(formatTimeLeft(185)).toBe('About 3 minutes left');
    expect(formatTimeLeft(3_500)).toBe('About an hour left');
    expect(formatTimeLeft(9_000)).toBe('About 3 hours left');
  });
});

describe('downloadSizeMB', () => {
  it('reads fetched MB from WebLLM text and infers the total', () => {
    expect(
      downloadSizeMB('Fetching param cache[3/27]: 540MB fetched. 45% completed', 0.45),
    ).toEqual({ loaded: 540, total: 1200 });
  });

  it('gives nothing too early or without a size', () => {
    expect(downloadSizeMB('Fetching param cache[0/27]: 1MB fetched.', 0.001)).toBeUndefined();
    expect(downloadSizeMB('Downloading the built-in AI… 40%', 0.4)).toBeUndefined();
    expect(downloadSizeMB(undefined, 0.4)).toBeUndefined();
  });

  it('formats sizes', () => {
    expect(formatMB(540)).toBe('540 MB');
    expect(formatMB(1229)).toBe('1.2 GB');
  });
});
