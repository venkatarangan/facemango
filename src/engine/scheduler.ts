import { getAI, type AI } from '@/ai';
import {
  db,
  ME,
  type Comment,
  type CommentCategory,
  type Persona,
  type PlannedEvent,
  type Post,
} from '@/db';
import { loadPhotoManifest, isPackPhoto, packPhotoId } from '@/lib/photos';
import { createPersonaPost } from './friendPosts';
import { notify, snippet } from './notifications';
import { COMMENT_SYSTEM, commentBatchSchema, commentsPrompt, type CommentRequest } from './prompts';
import { chance, defaultRng, pick, uniform, weightedSample } from './random';
import { getEngagementConfig, getMeta, setMeta } from './settings';
import { setTyping, useEngineStore } from './store';
import { checkFirstReaction, checkPostMilestones } from './celebrations';
import { playSound } from '@/lib/sound';

const TICK_IDLE_MS = 2500;
const TYPING_LOOKAHEAD_MS = 20_000;
const MAX_TEXT_ATTEMPTS = 3;
const COMMENT_BATCH = 4;

let running = false;

/** Starts the engagement loop (SPEC §4.2): applies due events, writes comments just in time. */
export function startScheduler(): void {
  if (running) return;
  running = true;
  void (async () => {
    await summariseAbsence(Date.now());
    while (running) {
      let worked = false;
      try {
        worked = await step(Date.now());
      } catch (error) {
        console.warn('Scheduler step failed', error);
      }
      await new Promise((r) => setTimeout(r, worked ? 200 : TICK_IDLE_MS));
    }
  })();
}

export function stopScheduler(): void {
  running = false;
}

const dueEvents = (now: number) =>
  db.events.where('[status+dueAt]').between(['planned', 0], ['planned', now], true, true).toArray();

/** "While you were away: 14 reactions, 3 comments" (SPEC §4.2 step 7, §8 #2). */
async function summariseAbsence(now: number): Promise<void> {
  const due = (await dueEvents(now)).filter((e) => e.payload?.userPost);
  if (!due.length || Math.min(...due.map((e) => e.dueAt)) > now - 2 * 60_000) return;
  const reactions = due
    .filter((e) => e.type === 'reaction')
    .reduce((n, e) => n + ((e.payload?.count as number | undefined) ?? 1), 0);
  const comments = due.filter((e) => e.type === 'comment' || e.type === 'reply').length;
  if (reactions || comments) useEngineStore.setState({ awaySummary: { reactions, comments } });
}

/** One unit of work. Returns true if it did something worth looping again quickly for. */
export async function step(now: number): Promise<boolean> {
  const due = await dueEvents(now);
  const reactions = due.filter((e) => e.type === 'reaction');
  if (reactions.length) await applyReactions(reactions);

  await updateTypingLookahead(now);

  const ai = getAI();
  if (!ai) return reactions.length > 0;
  const setupDone = useEngineStore.getState().setup.stage === 'done';

  // Text work, most important first: the user's posts, then friends' posts (only after setup).
  const textEvents = due.filter((e) => e.type === 'comment' || e.type === 'reply');
  const userFirst = [...textEvents].sort(
    (a, b) => Number(!!b.payload?.userPost) - Number(!!a.payload?.userPost) || a.dueAt - b.dueAt,
  );
  const next = userFirst.find((e) => e.payload?.userPost || setupDone);
  if (next) {
    const batch = userFirst
      .filter((e) => e.postId === next.postId && e.type === next.type)
      .slice(0, COMMENT_BATCH);
    await writeComments(ai, batch);
    return true;
  }

  if (setupDone && (await maybePostFromFriend(ai, now))) return true;
  if (setupDone) await maybeFriendRequest(now);
  return reactions.length > 0;
}

async function applyReactions(events: PlannedEvent[]): Promise<void> {
  const byPost = new Map<string, PlannedEvent[]>();
  for (const e of events) {
    if (!e.postId) continue;
    byPost.set(e.postId, [...(byPost.get(e.postId) ?? []), e]);
  }
  for (const [postId, list] of byPost) {
    const named: string[] = [];
    let total = 0;
    await db.transaction('rw', db.posts, db.reactions, db.events, async () => {
      const post = await db.posts.get(postId);
      if (!post) {
        await db.events.bulkUpdate(
          list.map((e) => ({ key: e.id, changes: { status: 'cancelled' as const } })),
        );
        return;
      }
      const counts = { ...post.reactionCounts };
      for (const e of list) {
        const type = (e.payload?.reaction as keyof typeof counts | undefined) ?? 'like';
        const count = (e.payload?.count as number | undefined) ?? 1;
        if (e.personaId) {
          const id = `${postId}:${e.personaId}`;
          if (await db.reactions.get(id)) continue;
          await db.reactions.add({ id, postId, personaId: e.personaId, type, createdAt: e.dueAt });
          named.push(e.personaId);
        }
        counts[type] = (counts[type] ?? 0) + count;
        total += count;
      }
      await db.posts.update(postId, { reactionCounts: counts });
      await db.events.bulkUpdate(
        list.map((e) => ({ key: e.id, changes: { status: 'applied' as const } })),
      );
    });
    const fresh = await db.posts.get(postId);
    if (total && fresh?.authorId === ME) {
      const sum = Object.values(fresh.reactionCounts).reduce((n, c) => n + (c ?? 0), 0);
      await checkFirstReaction(postId);
      await checkPostMilestones(postId, sum);
    }
    if (total && list[0]?.payload?.userPost) {
      const first = named.length ? (await db.personas.get(named[0]!))?.name : undefined;
      const others = total - (first ? 1 : 0);
      const who = first
        ? others
          ? `${first} and ${others} other${others === 1 ? '' : 's'}`
          : first
        : `${total} people`;
      await notify('reaction', `${who} reacted to your post`, {
        postId,
        personaId: named[0],
        createdAt: Math.max(...list.map((e) => e.dueAt)),
      });
    }
  }
}

/** "Priya is writing a comment…" shortly before a planned comment on one of the user's posts. */
async function updateTypingLookahead(now: number): Promise<void> {
  const soon = await db.events
    .where('[status+dueAt]')
    .between(['planned', now], ['planned', now + TYPING_LOOKAHEAD_MS])
    .filter((e) => (e.type === 'comment' || e.type === 'reply') && !!e.payload?.userPost)
    .toArray();
  const byPost = new Map<string, string[]>();
  for (const e of soon) {
    const persona = e.personaId ? await db.personas.get(e.personaId) : undefined;
    if (!persona || !e.postId) continue;
    byPost.set(e.postId, [...(byPost.get(e.postId) ?? []), persona.name.split(' ')[0]!]);
  }
  const current = useEngineStore.getState().typing;
  for (const postId of Object.keys(current)) if (!byPost.has(postId)) setTyping(postId, []);
  for (const [postId, names] of byPost) setTyping(postId, [...new Set(names)]);
}

function cleanText(text: string, name: string): string {
  return text
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .replace(new RegExp(`^${name.split(' ')[0]}\\s*:\\s*`, 'i'), '')
    .trim();
}

async function writeComments(ai: AI, events: PlannedEvent[]): Promise<void> {
  const postId = events[0]!.postId!;
  const post = await db.posts.get(postId);
  const cancel = (list: PlannedEvent[]) =>
    db.events.bulkUpdate(
      list.map((e) => ({ key: e.id, changes: { status: 'cancelled' as const } })),
    );
  if (!post) return void (await cancel(events));

  const personas = new Map(
    (await db.personas.bulkGet(events.map((e) => e.personaId!)))
      .filter((p): p is Persona => !!p)
      .map((p) => [p.id, p]),
  );
  const valid = events.filter((e) => {
    const p = personas.get(e.personaId!);
    return p && p.kind !== 'former';
  });
  await cancel(events.filter((e) => !valid.includes(e)));
  if (!valid.length) return;

  const profile = await db.profile.get(ME);
  const authorName =
    post.authorId === ME
      ? (profile?.name ?? 'the user')
      : ((await db.personas.get(post.authorId))?.name ?? 'a friend');
  const existing = await db.comments.where('postId').equals(postId).toArray();
  const byId = new Map(existing.map((c) => [c.id, c]));
  const nameOf = async (id: string) =>
    id === ME ? (profile?.name ?? 'You') : ((await db.personas.get(id))?.name ?? 'someone');

  const requests: (CommentRequest & { event: PlannedEvent })[] = [];
  for (const [i, e] of valid.entries()) {
    const replyToId = e.payload?.replyTo as string | undefined;
    const target = replyToId ? byId.get(replyToId) : undefined;
    requests.push({
      id: `c${i + 1}`,
      persona: personas.get(e.personaId!)!,
      category: (e.payload?.category as CommentCategory | undefined) ?? 'good',
      replyTo: target ? { author: await nameOf(target.authorId), text: target.text } : undefined,
      defend: !!e.payload?.defend,
      event: e,
    });
  }

  let photoAlt: string | undefined;
  if (isPackPhoto(post.photo)) {
    photoAlt = (await loadPhotoManifest()).find((p) => p.id === packPhotoId(post.photo!))?.alt;
  }

  const isUserPost = post.authorId === ME;
  if (isUserPost)
    setTyping(
      postId,
      requests.map((r) => r.persona.name.split(' ')[0]!),
    );
  let result;
  try {
    result = await ai.generateJSON(
      commentsPrompt(post, authorName, requests, {
        photoAlt,
        recent: existing.slice(-6).map((c) => c.text),
        earlierPosts:
          isUserPost && chance(defaultRng, 0.35) ? await earlierUserPosts(post) : undefined,
      }),
      commentBatchSchema,
      { system: COMMENT_SYSTEM, maxTokens: 70 * requests.length + 40, temperature: 0.9 },
    );
  } catch (error) {
    console.warn('Comment generation failed', error);
    await db.events.bulkUpdate(
      valid.map((e) => {
        const attempts = ((e.payload?.attempts as number | undefined) ?? 0) + 1;
        return {
          key: e.id,
          changes:
            attempts >= MAX_TEXT_ATTEMPTS
              ? { status: 'cancelled' as const }
              : { payload: { ...e.payload, attempts }, dueAt: e.dueAt + 30_000 },
        };
      }),
    );
    if (isUserPost) setTyping(postId, []);
    return;
  }

  const seen = new Set(existing.map((c) => c.text.toLowerCase()));
  const created: { comment: Comment; persona: Persona; isReply: boolean }[] = [];
  await db.transaction('rw', db.posts, db.comments, db.events, async () => {
    let added = 0;
    for (const [i, r] of requests.entries()) {
      const raw = result.comments.find((c) => c.id === r.id)?.text ?? result.comments[i]?.text;
      const text = raw ? cleanText(raw, r.persona.name) : '';
      if (!text || seen.has(text.toLowerCase())) {
        await db.events.update(r.event.id, { status: 'cancelled' });
        continue;
      }
      seen.add(text.toLowerCase());
      const replyTo = r.event.payload?.replyTo as string | undefined;
      const target = replyTo ? byId.get(replyTo) : undefined;
      const comment: Comment = {
        id: crypto.randomUUID(),
        postId,
        authorId: r.persona.id,
        parentId: target ? (target.parentId ?? target.id) : undefined,
        text,
        category: r.category,
        createdAt: Math.max(r.event.dueAt, post.createdAt + 1000),
      };
      await db.comments.add(comment);
      await db.events.update(r.event.id, { status: 'applied' });
      created.push({ comment, persona: r.persona, isReply: !!target });
      added++;
    }
    const fresh = await db.posts.get(postId);
    if (fresh && added) await db.posts.update(postId, { commentCount: fresh.commentCount + added });
  });
  if (isUserPost) setTyping(postId, []);

  if (created.length && (isUserPost || created.some((c) => c.isReply))) playSound('ping');
  if (isUserPost)
    await planPushback(
      post,
      created.map((c) => c.comment),
    );
  for (const { comment, persona, isReply } of created) {
    const replyToMe = isReply && byId.get(comment.parentId!)?.authorId === ME;
    if (isUserPost || replyToMe) {
      await notify(
        replyToMe ? 'reply' : 'comment',
        `${persona.name} ${replyToMe ? 'replied to your comment' : 'commented on your post'}: “${snippet(comment.text)}”`,
        { postId, personaId: persona.id, createdAt: comment.createdAt },
      );
    }
  }
}

/** Living feed (SPEC §4.3): friends post every so often, including while the user was away. */
async function maybePostFromFriend(ai: AI, now: number): Promise<boolean> {
  const config = await getEngagementConfig();
  const nextAt = await getMeta<number>('nextFriendPostAt', 0);
  if (now < nextAt) return false;
  const interval = () => (uniform(defaultRng, 40, 150) * 60_000) / config.speed;
  if (!nextAt) {
    await setMeta('nextFriendPostAt', now + interval());
    return false;
  }
  const [friends, publics] = await Promise.all([
    db.personas.where('kind').equals('friend').toArray(),
    db.personas.where('kind').equals('public').toArray(),
  ]);
  const pool = Math.random() < 0.9 || !publics.length ? friends : publics;
  const [author] = weightedSample(defaultRng, pool, (p) => p.activity, 1);
  if (!author) return false;
  // When catching up after an absence, back-date the post into the gap (at most ~3 posts).
  const createdAt =
    now - nextAt > interval()
      ? uniform(defaultRng, Math.max(nextAt, now - 12 * 3_600_000), now)
      : now;
  const post: Post | null = await createPersonaPost(ai, author, Math.round(createdAt), defaultRng);
  const backlogCap = now - 3 * interval();
  await setMeta('nextFriendPostAt', Math.max(createdAt + interval(), backlogCap));
  return !!post;
}

async function earlierUserPosts(post: Post): Promise<string[]> {
  const mine = await db.posts.where('authorId').equals(ME).reverse().sortBy('createdAt');
  return mine
    .filter((p) => p.id !== post.id && p.createdAt < post.createdAt && p.text)
    .slice(0, 2)
    .map((p) => p.text);
}

/** Critics get pushback: a fan friend defends the user (SPEC §8 #4). */
async function planPushback(post: Post, comments: Comment[]): Promise<void> {
  const critical = comments.filter(
    (c) => !c.parentId && (c.category === 'critical' || c.category === 'superCritical'),
  );
  if (!critical.length) return;
  const config = await getEngagementConfig();
  const fans = (await db.personas.where('kind').equals('friend').toArray()).filter(
    (p) => p.stance === 'fan',
  );
  for (const c of critical) {
    const defenders = fans.filter((f) => f.id !== c.authorId);
    if (!defenders.length || !chance(defaultRng, 0.6)) continue;
    await db.events.add({
      id: crypto.randomUUID(),
      type: 'reply',
      status: 'planned',
      dueAt: Date.now() + (uniform(defaultRng, 1, 6) * 60_000) / config.speed,
      postId: post.id,
      personaId: pick(defaultRng, defenders).id,
      payload: { replyTo: c.id, category: 'appreciative', defend: true, userPost: true },
    });
  }
}

/** Friend requests trickle in from public profiles (SPEC §8 #10), at most 3 pending. */
async function maybeFriendRequest(now: number): Promise<void> {
  const nextAt = await getMeta<number>('nextFriendRequestAt', 0);
  if (now < nextAt) return;
  const config = await getEngagementConfig();
  await setMeta(
    'nextFriendRequestAt',
    now + (uniform(defaultRng, 3, 9) * 3_600_000) / config.speed,
  );
  if (!nextAt) return;
  const publics = await db.personas.where('kind').equals('public').toArray();
  if (publics.filter((p) => p.friendRequest?.status === 'pending').length >= 3) return;
  const candidates = publics.filter((p) => !p.friendRequest);
  const [persona] = weightedSample(defaultRng, candidates, (p) => p.activity + 0.1, 1);
  if (!persona) return;
  await db.personas.update(persona.id, { friendRequest: { at: now, status: 'pending' } });
  await notify('friendRequest', `${persona.name} sent you a friend request`, {
    personaId: persona.id,
    createdAt: now,
  });
}
