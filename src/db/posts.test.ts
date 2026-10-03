import { db } from './db';
import { addMyComment, createUserPost, deleteComment, deletePost, setMyReaction } from './posts';
import { deleteAllData } from './profile';

afterEach(() => deleteAllData());

describe('post actions', () => {
  it('stores a post with its photo and counts my reaction once', async () => {
    const post = await createUserPost({
      text: ' Hello ',
      mentions: [],
      photo: new Blob(['x'], { type: 'image/webp' }),
    });
    expect(post.text).toBe('Hello');
    expect(await db.media.get(post.photo!)).toBeTruthy();
    await setMyReaction(post.id, 'like');
    await setMyReaction(post.id, 'love');
    expect((await db.posts.get(post.id))!.reactionCounts).toEqual({ like: 0, love: 1 });
    await setMyReaction(post.id, null);
    expect((await db.posts.get(post.id))!.reactionCounts.love).toBe(0);
    expect(await db.reactions.count()).toBe(0);
  });

  it('keeps comment counts right when deleting a comment with replies', async () => {
    const post = await createUserPost({ text: 'Hi', mentions: [] });
    const top = await addMyComment(post.id, 'first');
    await addMyComment(post.id, 'reply', top.id);
    await addMyComment(post.id, 'second');
    expect((await db.posts.get(post.id))!.commentCount).toBe(3);
    await deleteComment(top.id);
    expect((await db.posts.get(post.id))!.commentCount).toBe(1);
  });

  it('deletes a post with everything attached to it', async () => {
    const post = await createUserPost({ text: 'Bye', mentions: [], photo: new Blob(['x']) });
    await addMyComment(post.id, 'c');
    await setMyReaction(post.id, 'like');
    await db.events.add({
      id: 'e1',
      type: 'reaction',
      status: 'planned',
      dueAt: 1,
      postId: post.id,
    });
    await deletePost(post.id);
    expect(await db.posts.count()).toBe(0);
    expect(await db.comments.count()).toBe(0);
    expect(await db.reactions.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
    expect(await db.media.count()).toBe(0);
  });
});
