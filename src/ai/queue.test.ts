import { AIQueue } from './queue';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('AIQueue', () => {
  it('runs one task at a time, interactive before background, FIFO within a priority', async () => {
    const queue = new AIQueue();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const first = queue.run(() =>
      new Promise<void>((r) => (releaseFirst = r)).then(() => void order.push('first')),
    );
    const b1 = queue.run(async () => void order.push('bg1'), 'background');
    const b2 = queue.run(async () => void order.push('bg2'), 'background');
    const i1 = queue.run(async () => void order.push('int1'), 'interactive');
    const i2 = queue.run(async () => void order.push('int2'), 'interactive');
    await tick();
    expect(queue.pending).toBe(4);
    releaseFirst();
    await Promise.all([first, b1, b2, i1, i2]);
    expect(order).toEqual(['first', 'int1', 'int2', 'bg1', 'bg2']);
  });

  it('drops aborted waiters and releases after errors', async () => {
    const queue = new AIQueue();
    let release!: () => void;
    const blocker = queue.run(() => new Promise<void>((r) => (release = r)));
    const controller = new AbortController();
    const aborted = queue.run(async () => 'never', 'background', controller.signal);
    controller.abort(new Error('stop'));
    await expect(aborted).rejects.toThrow('stop');
    release();
    await blocker;
    await expect(queue.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(queue.run(async () => 'ok')).resolves.toBe('ok');
  });
});
