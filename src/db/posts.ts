import { db } from './db';
import { ME, type Comment, type Post, type ReactionType } from './types';

export interface NewUserPost {
  text: string;
  photo?: Blob;
  feeling?: string;
  mentions: string[];
}

export async function createUserPost(input: NewUserPost, now = Date.now()): Promise<Post> {
  return db.transaction('rw', db.posts, db.media, async () => {
    let photo: string | undefined;
    if (input.photo) {
      photo = crypto.randomUUID();
      await db.media.add({
        id: photo,
        kind: 'postPhoto',
        blob: input.photo,
        mimeType: input.photo.type || 'image/webp',
        createdAt: now,
      });
    }
    const post: Post = {
      id: crypto.randomUUID(),
      authorId: ME,
      text: input.text.trim(),
      photo,
      feeling: input.feeling || undefined,
      mentions: input.mentions,
      createdAt: now,
      plannedComments: 0,
      plannedLikes: 0,
      reactionCounts: {},
      commentCount: 0,
    };
    await db.posts.add(post);
    return post;
  });
}

export async function updatePost(
  id: string,
  patch: Pick<Post, 'text'> & Partial<Pick<Post, 'feeling'>>,
) {
  await db.posts.update(id, {
    text: patch.text.trim(),
    feeling: patch.feeling || undefined,
    editedAt: Date.now(),
  });
}

/** Deletes a post with its comments, reactions, planned events, notifications and photo. */
export async function deletePost(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.posts, db.comments, db.reactions, db.events, db.notifications, db.media],
    async () => {
      const post = await db.posts.get(id);
      if (!post) return;
      await db.comments.where('postId').equals(id).delete();
      await db.reactions.where('postId').equals(id).delete();
      await db.events.where('postId').equals(id).delete();
      await db.notifications.filter((n) => n.postId === id).delete();
      if (post.photo && post.authorId === ME && !post.photo.startsWith('pack:'))
        await db.media.delete(post.photo);
      await db.posts.delete(id);
    },
  );
}

/** Sets (or clears, with null) the user's reaction on a post. */
export async function setMyReaction(postId: string, type: ReactionType | null): Promise<void> {
  await db.transaction('rw', db.posts, db.reactions, async () => {
    const post = await db.posts.get(postId);
    if (!post) return;
    const id = `${postId}:${ME}`;
    const existing = await db.reactions.get(id);
    const counts = { ...post.reactionCounts };
    if (existing) counts[existing.type] = Math.max(0, (counts[existing.type] ?? 0) - 1);
    if (type) {
      counts[type] = (counts[type] ?? 0) + 1;
      await db.reactions.put({ id, postId, personaId: ME, type, createdAt: Date.now() });
    } else if (existing) {
      await db.reactions.delete(id);
    }
    await db.posts.update(postId, { reactionCounts: counts });
  });
}

export async function addMyComment(
  postId: string,
  text: string,
  parentId?: string,
): Promise<Comment> {
  return db.transaction('rw', db.posts, db.comments, async () => {
    const comment: Comment = {
      id: crypto.randomUUID(),
      postId,
      authorId: ME,
      parentId,
      text: text.trim(),
      createdAt: Date.now(),
    };
    await db.comments.add(comment);
    const post = await db.posts.get(postId);
    if (post) await db.posts.update(postId, { commentCount: post.commentCount + 1 });
    return comment;
  });
}

export async function updateComment(id: string, text: string) {
  await db.comments.update(id, { text: text.trim(), editedAt: Date.now() });
}

/** Deletes a comment and its replies. */
export async function deleteComment(id: string): Promise<void> {
  await db.transaction('rw', db.posts, db.comments, async () => {
    const comment = await db.comments.get(id);
    if (!comment) return;
    const replies = await db.comments.where('parentId').equals(id).primaryKeys();
    await db.comments.bulkDelete([id, ...replies]);
    const post = await db.posts.get(comment.postId);
    if (post)
      await db.posts.update(post.id, {
        commentCount: Math.max(0, post.commentCount - 1 - replies.length),
      });
  });
}
