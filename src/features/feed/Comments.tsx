import { useState, type KeyboardEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SendRounded from '@mui/icons-material/SendRounded';
import { addMyComment, deleteComment, ME, updateComment, type Comment } from '@/db';
import { brand } from '@/app/tokens';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { onUserComment } from '@/engine';
import { useEngineStore } from '@/engine/store';
import { TimeAgo } from './TimeAgo';
import { unknownAuthor, type Author } from './useAuthors';

export function CommentInput({
  postId,
  me,
  parentId,
  autoFocus,
  placeholder = 'Write a comment…',
  onDone,
}: {
  postId: string;
  me: Author;
  parentId?: string;
  autoFocus?: boolean;
  placeholder?: string;
  onDone?: () => void;
}) {
  const [text, setText] = useState('');
  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    const comment = await addMyComment(postId, value, parentId);
    onDone?.();
    void onUserComment(comment);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <AuthorAvatar author={me} size={32} />
      <Stack
        direction="row"
        sx={{
          flex: 1,
          alignItems: 'flex-end',
          bgcolor: brand.surface,
          border: `1px solid ${brand.divider}`,
          borderRadius: 4,
          pl: 1.5,
          pr: 0.5,
        }}
      >
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          multiline
          maxRows={6}
          autoFocus={autoFocus}
          inputProps={{ 'aria-label': placeholder, maxLength: 2000 }}
          sx={{ flex: 1, py: 0.75, fontSize: '0.95rem' }}
        />
        <IconButton
          size="small"
          aria-label="Send comment"
          disabled={!text.trim()}
          onClick={() => void send()}
          sx={{ mb: 0.25 }}
        >
          <SendRounded fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function CommentItem({
  comment,
  author,
  onReply,
}: {
  comment: Comment;
  author: Author;
  onReply: (comment: Comment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const own = comment.authorId === ME;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <AuthorAvatar author={author} size={comment.parentId ? 26 : 32} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            display: 'inline-block',
            maxWidth: '100%',
            bgcolor: brand.surface,
            borderRadius: 4,
            px: 1.5,
            py: 0.75,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {author.name}
            {author.kind === 'former' && (
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ml: 0.5 }}
              >
                · former friend
              </Typography>
            )}
          </Typography>
          {editing ? (
            <InputBase
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              multiline
              autoFocus
              fullWidth
              inputProps={{ 'aria-label': 'Edit comment' }}
              sx={{ fontSize: '0.875rem' }}
            />
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {comment.text}
            </Typography>
          )}
        </Box>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            pl: 1.5,
            mt: 0.25,
            color: 'text.secondary',
            typography: 'caption',
            alignItems: 'center',
          }}
        >
          <TimeAgo timestamp={comment.createdAt} />
          {comment.editedAt && <span>Edited</span>}
          {editing ? (
            <>
              <Link
                component="button"
                variant="caption"
                color="inherit"
                sx={{ fontWeight: 700 }}
                onClick={() => void updateComment(comment.id, draft).then(() => setEditing(false))}
              >
                Save
              </Link>
              <Link
                component="button"
                variant="caption"
                color="inherit"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Link>
            </>
          ) : (
            <>
              <Link
                component="button"
                variant="caption"
                color="inherit"
                sx={{ fontWeight: 700 }}
                onClick={() => onReply(comment)}
              >
                Reply
              </Link>
              {own && (
                <>
                  <Link
                    component="button"
                    variant="caption"
                    color="inherit"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Link>
                  <Link
                    component="button"
                    variant="caption"
                    color="inherit"
                    onClick={() => void deleteComment(comment.id)}
                  >
                    Delete
                  </Link>
                </>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

export function TypingIndicator({ postId }: { postId: string }) {
  const names = useEngineStore((s) => s.typing[postId]);
  if (!names?.length) return null;
  const who =
    names.length === 1
      ? `${names[0]} is`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are`
        : `${names[0]} and ${names.length - 1} others are`;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', color: 'text.secondary' }}
      role="status"
      aria-live="polite"
    >
      <Box sx={{ display: 'flex', gap: '3px' }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: brand.mangoText,
              '@keyframes fm-dot': {
                '0%,80%,100%': { opacity: 0.25, transform: 'translateY(0)' },
                '40%': { opacity: 1, transform: 'translateY(-3px)' },
              },
              animation: `fm-dot 1.2s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption">{who} writing a comment…</Typography>
    </Stack>
  );
}

/** Threads with one level of replies (SPEC §3.2). */
export function CommentThread({
  postId,
  comments,
  authors,
  limit,
  totalCount,
}: {
  postId: string;
  comments: Comment[];
  authors: Map<string, Author>;
  /** Show only the latest N top-level comments with a "View all" link. */
  limit?: number;
  totalCount: number;
}) {
  const me = authors.get(ME);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  if (!me) return null;
  const top = comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt - b.createdAt);
  const shown = limit ? top.slice(-limit) : top;
  const repliesOf = (id: string) =>
    comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt - b.createdAt);
  const authorOf = (id: string) => authors.get(id) ?? unknownAuthor(id);
  const hidden = totalCount - shown.length - shown.reduce((n, c) => n + repliesOf(c.id).length, 0);

  return (
    <Stack spacing={1.25}>
      {limit && hidden > 0 && (
        <Link
          component={RouterLink}
          to={`/post/${postId}`}
          variant="body2"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
          underline="hover"
        >
          View {hidden === 1 ? '1 more comment' : `all ${totalCount} comments`}
        </Link>
      )}
      <AnimatePresence initial={false}>
        {shown.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Stack spacing={1}>
              <CommentItem comment={c} author={authorOf(c.authorId)} onReply={setReplyTo} />
              <Stack spacing={1} sx={{ pl: 5 }}>
                {repliesOf(c.id).map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <CommentItem
                      comment={r}
                      author={authorOf(r.authorId)}
                      onReply={() => setReplyTo(c)}
                    />
                  </motion.div>
                ))}
                {replyTo?.id === c.id && (
                  <CommentInput
                    postId={postId}
                    me={me}
                    parentId={c.id}
                    autoFocus
                    placeholder={`Reply to ${authorOf(c.authorId).name.split(' ')[0]}…`}
                    onDone={() => setReplyTo(null)}
                  />
                )}
              </Stack>
            </Stack>
          </motion.div>
        ))}
      </AnimatePresence>
      <TypingIndicator postId={postId} />
    </Stack>
  );
}
