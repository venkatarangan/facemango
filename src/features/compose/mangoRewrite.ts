import type { AI } from '@/ai';
import { SAFETY } from '@/engine/prompts';

export type RewriteMode = 'write' | 'polish' | 'funnier' | 'shorter' | 'warmer';

const INSTRUCTIONS: Record<Exclude<RewriteMode, 'write'>, string> = {
  polish: 'Fix grammar and make it read smoothly, keeping the meaning and voice.',
  funnier: 'Make it funnier and more playful, keeping the meaning.',
  shorter: 'Make it shorter and punchier, keeping the key point.',
  warmer: 'Make it warmer and more heartfelt, keeping the meaning.',
};

/** ✨ Mango AI in the composer (SPEC §3.2). Streams the new text. Interactive priority. */
export function rewritePost(
  ai: AI,
  mode: RewriteMode,
  text: string,
  author: string,
  signal: AbortSignal,
): AsyncIterable<string> {
  const system = `You are Mango AI, a friendly writing helper inside FaceMango, a private social app. Reply with the post text only: no quotes, no preamble, no hashtags unless asked. ${SAFETY}`;
  const prompt =
    mode === 'write'
      ? `Write a short, cheerful Facebook-style status update that ${author} could post today about an everyday moment. 1–2 sentences, at most 2 emoji.`
      : `${INSTRUCTIONS[mode]}\n\nPost:\n${text}`;
  return ai.stream(prompt, {
    system,
    priority: 'interactive',
    signal,
    maxTokens: 220,
    temperature: 0.85,
  });
}
