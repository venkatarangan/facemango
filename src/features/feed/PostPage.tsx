import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { db, ME, type Post } from '@/db';
import { ComposerDialog } from '@/features/compose/ComposerDialog';
import { PostCard } from './PostCard';
import { useAuthors } from './useAuthors';

export function PostPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const authors = useAuthors();
  const post = useLiveQuery(async () => (await db.posts.get(id)) ?? null, [id]);
  const [editing, setEditing] = useState<Post | null>(null);
  if (post === undefined || !authors) return null;
  const me = authors.get(ME);
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <IconButton aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="h6" component="h1">
          {post ? `${authors.get(post.authorId)?.name ?? 'Someone'}'s post` : 'Post not found'}
        </Typography>
      </Stack>
      {post ? (
        <PostCard post={post} authors={authors} expanded onEdit={setEditing} />
      ) : (
        <Typography color="text.secondary">This post was deleted.</Typography>
      )}
      {me && editing && (
        <ComposerDialog
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          me={me}
          editing={editing}
        />
      )}
    </Stack>
  );
}
