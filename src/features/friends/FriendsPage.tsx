import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db } from '@/db';

/** Friends list. Profile pages arrive in M5. */
export function FriendsPage() {
  const friends = useLiveQuery(() => db.personas.where('kind').equals('friend').sortBy('name'), []);
  const publics = useLiveQuery(() => db.personas.where('kind').equals('public').count(), []);
  if (!friends) return null;
  return (
    <Stack spacing={2}>
      <Box sx={{ px: { xs: 0.5, sm: 0 } }}>
        <Typography variant="h4" component="h1">
          Friends
        </Typography>
        <Typography color="text.secondary">
          {friends.length} friends{publics ? ` · ${publics} people follow you` : ''}. All simulated
          by the AI on your device.
        </Typography>
      </Box>
      {friends.length === 0 && (
        <Typography color="text.secondary">FaceMango is still finding your friends…</Typography>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        {friends.map((f) => (
          <Card key={f.id} sx={{ p: 2, textAlign: 'center' }}>
            <AuthorAvatar
              author={{ id: f.id, kind: f.kind, name: f.name, persona: f }}
              size={72}
              sx={{ mx: 'auto' }}
            />
            <Typography sx={{ fontWeight: 700, mt: 1, lineHeight: 1.2 }}>{f.name}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {f.occupation}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {f.city}, {f.country}
            </Typography>
            <Stack
              direction="row"
              sx={{ flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', mt: 1 }}
            >
              {f.interests.slice(0, 2).map((i) => (
                <Chip key={i} label={i} size="small" />
              ))}
            </Stack>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
