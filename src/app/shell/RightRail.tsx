import { Link as RouterLink } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CakeRounded from '@mui/icons-material/CakeRounded';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db, type Persona } from '@/db';

function daysUntilBirthday(mmdd: string, now = new Date()): number {
  const [m, d] = mmdd.split('-').map(Number);
  if (!m || !d) return 999;
  const next = new Date(now.getFullYear(), m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < today) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

const asAuthor = (p: Persona) => ({ id: p.id, kind: p.kind, name: p.name, persona: p });

/** Desktop right column: birthdays and contacts. */
export function RightRail() {
  const friends = useLiveQuery(() => db.personas.where('kind').equals('friend').toArray(), []);
  const birthdays = (friends ?? [])
    .filter((f) => f.birthday)
    .map((f) => ({ f, days: daysUntilBirthday(f.birthday!) }))
    .filter((b) => b.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);
  const contacts = [...(friends ?? [])].sort((a, b) => b.closeness - a.closeness).slice(0, 14);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <CakeRounded fontSize="small" />
            <Typography variant="subtitle2" component="h2">
              Birthdays
            </Typography>
          </Stack>
          {birthdays.length ? (
            birthdays.map(({ f, days }) => (
              <Typography key={f.id} variant="body2">
                <b>{f.name}</b>{' '}
                {days === 0
                  ? 'has a birthday today 🎉'
                  : days === 1
                    ? 'turns a year older tomorrow'
                    : `has a birthday in ${days} days`}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              {friends?.length
                ? 'No birthdays this week.'
                : "Your friends' birthdays will show up here."}
            </Typography>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
            Contacts
          </Typography>
          {contacts.length ? (
            <Stack spacing={1.25}>
              {contacts.map((f) => (
                <Stack
                  key={f.id}
                  direction="row"
                  spacing={1.5}
                  component={RouterLink}
                  to={`/profile/${f.id}`}
                  sx={{
                    alignItems: 'center',
                    textDecoration: 'none',
                    color: 'inherit',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#F5F5F5' },
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <AuthorAvatar author={asAuthor(f)} size={32} />
                    {f.activity > 0.6 && (
                      <Box
                        aria-label="Active now"
                        sx={{
                          position: 'absolute',
                          right: -1,
                          bottom: -1,
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          bgcolor: '#31A24C',
                          border: '2px solid #fff',
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {f.name}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <>
              <Stack spacing={1.5} aria-hidden>
                {Array.from({ length: 6 }, (_, i) => (
                  <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="text" width={`${50 + ((i * 17) % 35)}%`} />
                  </Stack>
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                FaceMango is finding your friends…
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
