import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { db, ME } from '@/db';
import { snippet } from '@/engine/notifications';
import { TimeAgo } from '@/features/feed/TimeAgo';
import { reactionMeta } from '@/lib/reactions';

type Kind = 'all' | 'posts' | 'comments' | 'reactions';
interface Entry {
  id: string;
  kind: Exclude<Kind, 'all'>;
  at: number;
  icon: string;
  text: string;
  postId: string;
}

/** Activity log of the user's own actions, filterable (SPEC §3.7). */
export function ActivityLog() {
  const [filter, setFilter] = useState<Kind>('all');
  const entries = useLiveQuery(async (): Promise<Entry[]> => {
    const [posts, comments, reactions] = await Promise.all([
      db.posts.where('authorId').equals(ME).toArray(),
      db.comments.where('authorId').equals(ME).toArray(),
      db.reactions.filter((r) => r.personaId === ME).toArray(),
    ]);
    const postAuthors = new Map(
      (
        await db.posts.bulkGet([
          ...comments.map((c) => c.postId),
          ...reactions.map((r) => r.postId),
        ])
      )
        .filter(Boolean)
        .map((p) => [p!.id, p!.authorId]),
    );
    const names = new Map((await db.personas.toArray()).map((p) => [p.id, p.name]));
    const whose = (postId: string) => {
      const author = postAuthors.get(postId);
      return author === ME ? 'your post' : `${names.get(author ?? '') ?? 'a friend'}'s post`;
    };
    return [
      ...posts.map((p) => ({
        id: p.id,
        kind: 'posts' as const,
        at: p.createdAt,
        icon: '📝',
        text: `You posted: “${snippet(p.text || 'a photo')}”`,
        postId: p.id,
      })),
      ...comments.map((c) => ({
        id: c.id,
        kind: 'comments' as const,
        at: c.createdAt,
        icon: '💬',
        text: `You ${c.parentId ? 'replied' : 'commented'} on ${whose(c.postId)}: “${snippet(c.text)}”`,
        postId: c.postId,
      })),
      ...reactions.map((r) => ({
        id: r.id,
        kind: 'reactions' as const,
        at: r.createdAt,
        icon: reactionMeta(r.type).emoji,
        text: `You reacted ${reactionMeta(r.type).label} to ${whose(r.postId)}`,
        postId: r.postId,
      })),
    ].sort((a, b) => b.at - a.at);
  }, []);
  const shown = (entries ?? []).filter((e) => filter === 'all' || e.kind === filter);

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        sx={{ gap: 1, flexWrap: 'wrap' }}
        role="group"
        aria-label="Filter activity"
      >
        {(['all', 'posts', 'comments', 'reactions'] as Kind[]).map((k) => (
          <Chip
            key={k}
            label={k[0]!.toUpperCase() + k.slice(1)}
            onClick={() => setFilter(k)}
            color={filter === k ? 'primary' : 'default'}
            aria-pressed={filter === k}
          />
        ))}
      </Stack>
      <Card>
        {shown.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
            Nothing here yet.
          </Typography>
        ) : (
          <List disablePadding>
            {shown.slice(0, 200).map((e) => (
              <ListItemButton
                key={`${e.kind}-${e.id}`}
                component={RouterLink}
                to={`/post/${e.postId}`}
                sx={{ borderRadius: 0 }}
              >
                <ListItemIcon sx={{ minWidth: 40, fontSize: 22 }} aria-hidden>
                  {e.icon}
                </ListItemIcon>
                <ListItemText primary={e.text} secondary={<TimeAgo timestamp={e.at} />} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Card>
    </Stack>
  );
}
