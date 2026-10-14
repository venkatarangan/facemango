import { readCapped } from './promptApi';

/** A fake session whose stream yields `chunks`, then optionally fails with `error`. */
function fakeSession(chunks: string[], error?: unknown) {
  const queue = [...chunks];
  const cancel = vi.fn();
  const session = {
    promptStreaming: () =>
      new ReadableStream<string>({
        // One chunk per read, so an error arrives after the chunks (error() drops queued ones).
        pull(controller) {
          const next = queue.shift();
          if (next !== undefined) controller.enqueue(next);
          else if (error) controller.error(error);
          else controller.close();
        },
        cancel,
      }),
    prompt: vi.fn(),
    destroy: vi.fn(),
  } as unknown as LanguageModelSession;
  return { session, cancel };
}

describe('readCapped', () => {
  it('stops once the JSON is complete, dropping trailing output', async () => {
    const { session, cancel } = fakeSession(['{"a":', '[1]}', '\n\n\n', '\n\n']);
    const reply = await readCapped(session, 'p', { maxChars: 100, stopAtJsonEnd: true });
    expect(reply).toEqual({ text: '{"a":[1]}', truncated: false });
    expect(cancel).toHaveBeenCalled();
  });

  it('cuts a runaway reply at the budget', async () => {
    const { session } = fakeSession(['aaaa', 'bbbb', 'cccc', 'dddd']);
    const reply = await readCapped(session, 'p', { maxChars: 6 });
    expect(reply).toEqual({ text: 'aaaabbbb', truncated: true });
  });

  it("treats Chrome's output limit as a cut-off reply", async () => {
    const quota = new DOMException('The response exceeded output limits', 'QuotaExceededError');
    const { session } = fakeSession(['{"a":'], quota);
    const reply = await readCapped(session, 'p', { maxChars: 100, stopAtJsonEnd: true });
    expect(reply).toEqual({ text: '{"a":', truncated: true });
  });

  it('rethrows a quota error before any output (input too long)', async () => {
    const quota = new DOMException('The input is too large', 'QuotaExceededError');
    const { session } = fakeSession([], quota);
    await expect(readCapped(session, 'p', { maxChars: 100 })).rejects.toBe(quota);
  });
});
