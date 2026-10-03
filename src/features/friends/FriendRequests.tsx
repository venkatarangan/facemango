import { useLiveQuery } from 'dexie-react-hooks';
import { Link as RouterLink } from 'react-router';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db } from '@/db';
import { acceptFriendRequest, declineFriendRequest } from '@/engine/friendRequests';
import { TimeAgo } from '@/features/feed/TimeAgo';

/** Friend requests from public profiles (SPEC §8 #10). */
export function FriendRequests() {
  const pending = useLiveQuery(
    () =>
      db.personas
        .where('kind')
        .equals('public')
        .filter((p) => p.friendRequest?.status === 'pending')
        .toArray(),
    [],
  );
  if (!pending?.length) return null;
  return (
    <Card component="section" aria-label="Friend requests">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Friend requests · {pending.length}
        </Typography>
        <Stack spacing={1.5}>
          {pending.map((p) => (
            <Stack key={p.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <AuthorAvatar
                author={{ id: p.id, kind: p.kind, name: p.name, persona: p }}
                size={52}
              />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`/profile/${p.id}`}
                  color="inherit"
                  underline="hover"
                  sx={{ fontWeight: 700 }}
                  noWrap
                >
                  {p.name}
                </Link>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {p.occupation} · {p.city} · <TimeAgo timestamp={p.friendRequest!.at} />
                </Typography>
              </Stack>
              <Button
                size="small"
                variant="contained"
                onClick={() => void acceptFriendRequest(p.id)}
              >
                Confirm
              </Button>
              <Button size="small" onClick={() => void declineFriendRequest(p.id)}>
                Delete
              </Button>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
