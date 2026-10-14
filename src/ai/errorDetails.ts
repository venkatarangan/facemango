/** Errors from WebLLM's worker or the Prompt API are not always `Error`s; describe any value. */
export function errorSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  return safeJson(error) ?? String(error);
}

/** Everything known about an error: name, message, own fields, cause and stack. */
export function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return errorSummary(error);
  const lines = [errorSummary(error)];
  const extra: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(error)) {
    if (!['name', 'message', 'stack', 'cause'].includes(key))
      extra[key] = (error as unknown as Record<string, unknown>)[key];
  }
  if (Object.keys(extra).length) lines.push(`Fields: ${safeJson(extra) ?? '(unreadable)'}`);
  if (error.cause !== undefined) lines.push(`Cause: ${errorDetails(error.cause)}`);
  if (error.stack) lines.push(`Stack:\n${error.stack}`);
  return lines.join('\n');
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
