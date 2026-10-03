import { useEffect, useState } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { ActivityLog } from './ActivityLog';
import { Link as RouterLink } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import { brand } from '@/app/tokens';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db } from '@/db';
import { markAllRead } from '@/engine/notifications';
import { TimeAgo } from '@/features/feed/TimeAgo';
import { useAuthors } from '@/features/feed/useAuthors';

const BADGE: Record<string, string> = {
  reaction: '👍',
  comment: '💬',
  reply: '↩️',
  mention: '@',
  birthday: '🎂',
  friendRequest: '🤝',
  milestone: '🏆',
};

/** Activity (SPEC §3.7): notifications and a log of your own actions. */
export function ActivityPage() {
  const authors = useAuthors();
  const [tab, setTab] = useState<'notifications' | 'log'>('notifications');
  const items = useLiveQuery(
    () => db.notifications.orderBy('createdAt').reverse().limit(100).toArray(),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => void markAllRead(), 1500);
    return () => clearTimeout(timer);
  }, [items?.length]);
  if (!items || !authors) return null;
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ px: { xs: 0.5, sm: 0 } }}>
        Activity
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Activity sections">
        <Tab
          value="notifications"
          label="Notifications"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: 'text.primary' } }}
        />
        <Tab
          value="log"
          label="Your activity"
          sx={{ fontWeight: 700, '&.Mui-selected': { color: 'text.primary' } }}
        />
      </Tabs>
      {tab === 'log' ? (
        <ActivityLog />
      ) : (
        <Card>
          {items.length === 0 ? (
            <Stack spacing={1} sx={{ alignItems: 'center', py: 6, px: 2, textAlign: 'center' }}>
              <NotificationsNoneRounded sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography color="text.secondary">
                Reactions and comments on your posts will show up here.
              </Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {items.map((n) => {
                const author = n.personaId ? authors.get(n.personaId) : undefined;
                return (
                  <ListItemButton
                    key={n.id}
                    component={RouterLink}
                    to={
                      n.postId
                        ? `/post/${n.postId}`
                        : n.type === 'friendRequest'
                          ? '/friends'
                          : '/notifications'
                    }
                    sx={{
                      alignItems: 'flex-start',
                      borderRadius: 0,
                      bgcolor: n.read ? undefined : alpha(brand.mango, 0.12),
                      py: 1.25,
                    }}
                  >
                    <ListItemAvatar sx={{ position: 'relative', minWidth: 60 }}>
                      {author ? (
                        <AuthorAvatar author={author} size={46} />
                      ) : (
                        <Box
                          sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: brand.mango }}
                        />
                      )}
                      <Box
                        component="span"
                        aria-hidden
                        sx={{
                          position: 'absolute',
                          left: 30,
                          top: 28,
                          fontSize: 16,
                          bgcolor: '#fff',
                          borderRadius: '50%',
                          width: 24,
                          height: 24,
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: 1,
                        }}
                      >
                        {BADGE[n.type]}
                      </Box>
                    </ListItemAvatar>
                    <ListItemText
                      primary={n.text}
                      secondary={<TimeAgo timestamp={n.createdAt} />}
                      slotProps={{ primary: { sx: { fontWeight: n.read ? 400 : 600 } } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Card>
      )}
    </Stack>
  );
}
