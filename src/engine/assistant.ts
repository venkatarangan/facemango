import { db, ME, type ChatMessage } from '@/db';
import { totalReactions } from '@/lib/reactions';
import { SAFETY } from './prompts';

export type QuickAction = 'write' | 'funnier' | 'summarise' | 'trending' | 'idea';

export const QUICK_ACTIONS: { action: QuickAction; label: string; message: string }[] = [
  { action: 'write', label: '✍️ Write a post for me', message: 'Write a post for me.' },
  {
    action: 'funnier',
    label: '😂 Make my last post funnier',
    message: 'Make my last post funnier.',
  },
  {
    action: 'summarise',
    label: '💬 Summarise reactions',
    message: "Summarise my friends' reactions to my last post.",
  },
  {
    action: 'trending',
    label: '🔥 What’s trending?',
    message: "What's trending among my friends?",
  },
  { action: 'idea', label: '💡 Post idea', message: 'Give me an idea for my next post.' },
];

export const MANGO_SYSTEM =
  'You are Mango AI, the friendly assistant inside FaceMango, a private social app where all of the ' +
  "user's friends are simulated by AI on their device. Be warm, playful and concise (under 120 words). " +
  `English only. ${SAFETY}`;

const DRAFT_RULE = 'Reply with only the post text: no quotes, no preamble, at most 2 emoji.';

export interface AssistantRequest {
  prompt: string;
  draft: boolean;
}

/** Builds the prompt for a chat turn or quick action, with just enough context for a small model. */
export async function buildAssistantRequest(
  text: string,
  action: QuickAction | null,
  history: ChatMessage[],
): Promise<AssistantRequest> {
  const profile = await db.profile.get(ME);
  const who = profile ? `The user is ${profile.name}, ${profile.age}, from ${profile.city}.` : '';
  const myPosts = await db.posts.where('authorId').equals(ME).reverse().sortBy('createdAt');
  const last = myPosts[0];

  switch (action) {
    case 'write':
      return {
        prompt: `${who} Write a short, upbeat Facebook-style post they could share today about an everyday moment. ${DRAFT_RULE}`,
        draft: true,
      };
    case 'funnier':
      if (!last?.text)
        return {
          prompt: `${who} They haven't posted yet. Write a funny first post for them. ${DRAFT_RULE}`,
          draft: true,
        };
      return {
        prompt: `Make this post funnier and more playful, keeping its meaning. ${DRAFT_RULE}\n\nPost: ${last.text}`,
        draft: true,
      };
    case 'summarise': {
      if (!last)
        return {
          prompt: `${who} They haven't posted yet. Encourage them, in one or two sentences, to share their first post.`,
          draft: false,
        };
      const comments = (
        await db.comments.where('postId').equals(last.id).sortBy('createdAt')
      ).slice(-10);
      const names = new Map(
        (await db.personas.bulkGet(comments.map((c) => c.authorId)))
          .filter(Boolean)
          .map((p) => [p!.id, p!.name]),
      );
      const lines = comments
        .map(
          (c) => `- ${names.get(c.authorId) ?? (c.authorId === ME ? 'You' : 'Someone')}: ${c.text}`,
        )
        .join('\n');
      return {
        prompt: `Summarise how friends reacted to the user's post in 2–4 friendly sentences. Mention who said what.\n\nPost: "${last.text}"\nReactions: ${totalReactions(last.reactionCounts)}\nComments:\n${lines || '(no comments yet)'}`,
        draft: false,
      };
    }
    case 'trending': {
      const since = Date.now() - 3 * 86_400_000;
      const posts = (await db.posts.where('createdAt').above(since).toArray())
        .filter((p) => p.authorId !== ME)
        .sort(
          (a, b) =>
            totalReactions(b.reactionCounts) +
            b.commentCount * 3 -
            (totalReactions(a.reactionCounts) + a.commentCount * 3),
        )
        .slice(0, 10);
      const names = new Map(
        (await db.personas.bulkGet(posts.map((p) => p.authorId)))
          .filter(Boolean)
          .map((p) => [p!.id, p!.name]),
      );
      const lines = posts
        .map((p) => `- ${names.get(p.authorId) ?? 'A friend'}: ${p.text.slice(0, 140)}`)
        .join('\n');
      return {
        prompt: `Here are the most popular recent posts from the user's friends:\n${lines || '(none yet)'}\n\nWhat's trending among their friends? Give the top 2–3 themes as short bullet points, naming who posted.`,
        draft: false,
      };
    }
    case 'idea':
      return {
        prompt: `${who} Their recent posts: ${
          myPosts
            .slice(0, 3)
            .map((p) => `"${p.text.slice(0, 80)}"`)
            .join('; ') || 'none yet'
        }. Suggest one fresh idea for their next post and then write it. ${DRAFT_RULE}`,
        draft: true,
      };
    default: {
      const recent = history
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'User' : 'Mango AI'}: ${m.text}`)
        .join('\n');
      return {
        prompt: `${who}\n${recent ? `Conversation so far:\n${recent}\n` : ''}User: ${text}\nMango AI:`,
        draft: false,
      };
    }
  }
}

export async function addChatMessage(
  role: ChatMessage['role'],
  text: string,
  draft = false,
): Promise<void> {
  await db.chat.add({
    id: crypto.randomUUID(),
    role,
    text,
    draft: draft || undefined,
    createdAt: Date.now(),
  });
}
