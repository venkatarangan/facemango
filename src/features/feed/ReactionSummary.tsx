import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { db, ME, type Post } from '@/db';
import { formatCount, reactionMeta, topReactions, totalReactions } from '@/lib/reactions';
import type { Author } from './useAuthors';

/** "👍❤️😆 You, Priya and 23 others" (SPEC §3.2, §8 #8 social proof). */
export function ReactionSummary({ post, authors }: { post: Post; authors: Map<string, Author> }) {
  const total = totalReactions(post.reactionCounts);
  const named = useLiveQuery(
    () => db.reactions.where('postId').equals(post.id).limit(4).toArray(),
    [post.id, total],
  );
  if (!total) return null;
  const mine = named?.some((r) => r.personaId === ME);
  const first = named?.find((r) => r.personaId !== ME && authors.has(r.personaId));
  const names = [mine ? 'You' : null, first ? authors.get(first.personaId)!.name : null].filter(
    Boolean,
  ) as string[];
  const others = total - names.length;
  const label = names.length
    ? others > 0
      ? `${names.join(', ')} and ${formatCount(others)} other${others === 1 ? '' : 's'}`
      : names.join(' and ')
    : formatCount(total);

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Stack direction="row" sx={{ flexShrink: 0 }} aria-hidden>
        {topReactions(post.reactionCounts).map((type, i) => (
          <Box
            key={type}
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: '#fff',
              border: '2px solid #fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 14,
              ml: i ? -0.6 : 0,
              zIndex: 3 - i,
            }}
          >
            {reactionMeta(type).emoji}
          </Box>
        ))}
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        noWrap
        aria-label={`${total} reactions: ${label}`}
      >
        {label}
      </Typography>
    </Stack>
  );
}
