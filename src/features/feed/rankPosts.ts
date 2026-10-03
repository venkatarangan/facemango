import type { Post } from '@/db';
import { totalReactions } from '@/lib/reactions';

const BOOST_PER_ENGAGEMENT = 90_000; // 1.5 min of "recency" per reaction/comment, capped

/** Recency with a light engagement boost (SPEC §3.2). */
export function rankPosts(posts: Post[]): Post[] {
  const score = (p: Post) =>
    p.createdAt +
    Math.min(totalReactions(p.reactionCounts) + p.commentCount * 3, 60) * BOOST_PER_ENGAGEMENT;
  return [...posts].sort((a, b) => score(b) - score(a));
}
