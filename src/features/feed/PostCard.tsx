import { memo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import ReplyRounded from '@mui/icons-material/ReplyRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import { db, deletePost, ME, type Post } from '@/db';
import { useUiStore } from '@/app/uiStore';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { FEELINGS } from '@/features/compose/feelings';
import { profilePath } from '@/features/profile/profilePath';
import { CommentInput, CommentThread } from './Comments';
import { PostPhoto } from './PostPhoto';
import { PostText } from './PostText';
import { ReactionButton } from './ReactionButton';
import { ReactionSummary } from './ReactionSummary';
import { TimeAgo } from './TimeAgo';
import { unknownAuthor, type Author } from './useAuthors';

interface PostCardProps {
  post: Post;
  authors: Map<string, Author>;
  /** Detail view: all comments and an open comment box. */
  expanded?: boolean;
  onEdit?: (post: Post) => void;
}

function PostCardImpl({ post, authors, expanded = false, onEdit }: PostCardProps) {
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const author = authors.get(post.authorId) ?? unknownAuthor(post.authorId);
  const me = authors.get(ME);
  const [commenting, setCommenting] = useState(expanded);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const comments =
    useLiveQuery(
      () => db.comments.where('postId').equals(post.id).toArray(),
      [post.id, post.commentCount],
    ) ?? [];
  const mine = useLiveQuery(
    () => db.reactions.get(`${post.id}:${ME}`),
    [post.id, post.reactionCounts],
  );
  const feeling =
    FEELINGS.find((f) => f.value === post.feeling?.toLowerCase()) ??
    (post.feeling ? { value: post.feeling.toLowerCase(), emoji: '✨' } : undefined);
  const mentionNames = post.mentions.map((id) => authors.get(id)?.name ?? '');

  const share = async () => {
    const text = post.text || 'A post on FaceMango';
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        showToast('Post text copied to the clipboard.');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <Card component="article" aria-label={`Post by ${author.name}`} sx={{ overflow: 'visible' }}>
      <Stack direction="row" spacing={1.25} sx={{ p: 2, pb: 1, alignItems: 'center' }}>
        <Box
          component={RouterLink}
          to={profilePath(author.id)}
          aria-label={`${author.name}'s profile`}
          sx={{ display: 'flex' }}
        >
          <AuthorAvatar author={author} size={42} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>
            <Link
              component={RouterLink}
              to={profilePath(author.id)}
              color="inherit"
              underline="hover"
            >
              {author.name}
            </Link>
            {feeling && (
              <Typography component="span" color="text.secondary" sx={{ fontWeight: 400 }}>
                {' '}
                is {feeling.emoji} feeling {feeling.value}
              </Typography>
            )}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', color: 'text.secondary', typography: 'caption' }}
          >
            <Link component={RouterLink} to={`/post/${post.id}`} color="inherit" underline="hover">
              <TimeAgo timestamp={post.createdAt} />
            </Link>
            {post.editedAt && <span>· Edited</span>}
            <span aria-hidden>·</span>
            <PublicRounded sx={{ fontSize: 13 }} titleAccess="Visible to your simulated friends" />
          </Stack>
        </Box>
        {post.authorId === ME && (
          <IconButton aria-label="Post options" onClick={(e) => setMenu(e.currentTarget)}>
            <MoreHorizRounded />
          </IconButton>
        )}
      </Stack>

      <Box sx={{ px: 2, pb: post.photo ? 1.5 : 1 }}>
        <PostText text={post.text} mentionNames={mentionNames} />
      </Box>
      {post.photo && (
        <Box
          component={expanded ? 'div' : RouterLink}
          to={`/post/${post.id}`}
          sx={{ display: 'block' }}
          aria-label="Open post"
        >
          <PostPhoto photo={post.photo} alt={post.photoDescription} />
        </Box>
      )}

      <Stack direction="row" sx={{ px: 2, py: 1, alignItems: 'center', minHeight: 40, gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ReactionSummary post={post} authors={authors} />
        </Box>
        {post.commentCount > 0 && (
          <Link
            component={RouterLink}
            to={`/post/${post.id}`}
            variant="body2"
            color="text.secondary"
            underline="hover"
            sx={{ flexShrink: 0 }}
          >
            {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
          </Link>
        )}
      </Stack>
      <Divider sx={{ mx: 2 }} />
      <Stack direction="row" sx={{ px: 1, py: 0.5 }}>
        <ReactionButton postId={post.id} mine={mine?.type} />
        <Button
          fullWidth
          startIcon={<ChatBubbleOutlineRounded />}
          sx={{ color: 'text.secondary', borderRadius: 2 }}
          onClick={() => (expanded ? setCommenting(true) : setCommenting((v) => !v))}
        >
          Comment
        </Button>
        <Button
          fullWidth
          startIcon={<ReplyRounded sx={{ transform: 'scaleX(-1)' }} />}
          sx={{ color: 'text.secondary', borderRadius: 2 }}
          onClick={() => void share()}
        >
          Share
        </Button>
      </Stack>

      {(comments.length > 0 || commenting) && me && (
        <>
          <Divider sx={{ mx: 2 }} />
          <Stack spacing={1.5} sx={{ p: 2, pt: 1.5 }}>
            <CommentThread
              postId={post.id}
              comments={comments}
              authors={authors}
              limit={expanded ? undefined : 2}
              totalCount={post.commentCount}
            />
            {commenting && <CommentInput postId={post.id} me={me} autoFocus={!expanded} />}
          </Stack>
        </>
      )}

      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onEdit?.(post);
          }}
        >
          Edit post
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            setConfirmDelete(true);
          }}
          sx={{ color: 'error.main' }}
        >
          Delete post
        </MenuItem>
      </Menu>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this post?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmDelete(false);
              void deletePost(post.id).then(() => expanded && navigate('/'));
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export const PostCard = memo(PostCardImpl);
