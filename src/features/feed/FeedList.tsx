import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Virtuoso } from 'react-virtuoso';
import Box from '@mui/material/Box';
import { db, type Post } from '@/db';
import { rankPosts } from './rankPosts';
import { PostCard } from './PostCard';
import type { Author } from './useAuthors';

/** Virtualised infinite feed (react-virtuoso, window scrolling). */
export function FeedList({
  authors,
  onEdit,
}: {
  authors: Map<string, Author>;
  onEdit: (post: Post) => void;
}) {
  const posts = useLiveQuery(
    () => db.posts.orderBy('createdAt').reverse().limit(500).toArray(),
    [],
  );
  // Rank only when posts are added or removed, so cards don't jump around while reactions arrive.
  const idsKey = posts?.map((p) => p.id).join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the id set
  const order = useMemo(() => rankPosts(posts ?? []).map((p) => p.id), [idsKey]);
  const ranked = useMemo(() => {
    const byId = new Map((posts ?? []).map((p) => [p.id, p]));
    return order.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }, [order, posts]);
  if (!posts?.length) return null;
  return (
    <Virtuoso
      useWindowScroll
      data={ranked}
      computeItemKey={(_, post) => post.id}
      increaseViewportBy={{ top: 600, bottom: 1200 }}
      itemContent={(_, post) => (
        <Box sx={{ pb: 2 }}>
          <PostCard post={post} authors={authors} onEdit={onEdit} />
        </Box>
      )}
    />
  );
}
