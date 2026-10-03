import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoStoriesRounded from '@mui/icons-material/AutoStoriesRounded';
import { brand } from '@/app/tokens';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db, ME } from '@/db';
import { computeMemories, type Memory } from '@/engine/memories';
import { ComposerDialog } from '@/features/compose/ComposerDialog';
import { PostCard } from '@/features/feed/PostCard';
import { useAuthors } from '@/features/feed/useAuthors';
import { useNow } from '@/lib/useNow';

function Header({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 3,
          bgcolor: alpha(brand.mango, 0.25),
          display: 'grid',
          placeItems: 'center',
          fontSize: 22,
        }}
        aria-hidden
      >
        {emoji}
      </Box>
      <Box>
        <Typography variant="h6" component="h2" sx={{ lineHeight: 1.2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

/** Memories (SPEC §3.6). */
export function MemoriesPage() {
  const authors = useAuthors();
  const now = useNow();
  const myPosts = useLiveQuery(() => db.posts.where('authorId').equals(ME).toArray(), []);
  const friends = useLiveQuery(() => db.personas.where('kind').equals('friend').toArray(), []);
  const memories = useMemo(
    () => (myPosts && friends ? computeMemories(myPosts, friends, now) : []),
    [myPosts, friends, now],
  );
  const [share, setShare] = useState<string | null>(null);
  if (!authors || !myPosts) return null;
  const me = authors.get(ME)!;

  const render = (m: Memory) => {
    switch (m.kind) {
      case 'onThisDay':
        return (
          <Box key={m.id}>
            <Header
              emoji="📅"
              title={`On this day · ${m.label}`}
              subtitle={format(m.posts[0]!.createdAt, 'd MMMM yyyy')}
            />
            <Stack spacing={2}>
              {m.posts.map((p) => (
                <PostCard key={p.id} post={p} authors={authors} />
              ))}
            </Stack>
            <Button
              sx={{ mt: 1 }}
              onClick={() =>
                setShare(`Memories from ${m.label}: ${m.posts[0]!.text.slice(0, 120)}`)
              }
            >
              Share this memory
            </Button>
          </Box>
        );
      case 'firstPost':
        return (
          <Box key={m.id}>
            <Header
              emoji="🌱"
              title="Your first post on FaceMango"
              subtitle={format(m.post.createdAt, 'd MMMM yyyy')}
            />
            <PostCard post={m.post} authors={authors} />
          </Box>
        );
      case 'bestPost':
        return (
          <Box key={m.id}>
            <Header emoji="🏆" title="Your most loved post" />
            <PostCard post={m.post} authors={authors} />
          </Box>
        );
      case 'friendversary':
        return (
          <Card key={m.id}>
            <CardContent>
              <Header
                emoji="🤝"
                title={`Friendversary · ${m.label}`}
                subtitle={`You and ${m.friends.length === 1 ? m.friends[0]!.name : `${m.friends.length} friends`} became friends ${m.label === '1 week' ? 'a week' : m.label} ago.`}
              />
              <AvatarGroup max={8} sx={{ justifyContent: 'flex-start' }}>
                {m.friends.map((f) => (
                  <Box
                    key={f.id}
                    component={RouterLink}
                    to={`/profile/${f.id}`}
                    sx={{ display: 'inline-flex', ml: -1 }}
                  >
                    <AuthorAvatar
                      author={{ id: f.id, kind: f.kind, name: f.name, persona: f }}
                      size={40}
                      sx={{ border: '2px solid #fff' }}
                    />
                  </Box>
                ))}
              </AvatarGroup>
            </CardContent>
          </Card>
        );
      case 'milestone':
        return (
          <Card
            key={m.id}
            sx={{ background: `linear-gradient(135deg, ${alpha(brand.mango, 0.25)}, #fff 70%)` }}
          >
            <CardContent>
              <Header emoji={m.emoji} title={m.title} subtitle={m.detail} />
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ px: { xs: 0.5, sm: 0 } }}>
        <Typography variant="h4" component="h1">
          Memories
        </Typography>
        <Typography color="text.secondary">Moments from your time on FaceMango.</Typography>
      </Box>
      {memories.length === 0 ? (
        <Card>
          <Stack spacing={1} sx={{ alignItems: 'center', py: 6, px: 2, textAlign: 'center' }}>
            <AutoStoriesRounded sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary">
              No memories yet. Post something today, and it will show up here next week.
            </Typography>
          </Stack>
        </Card>
      ) : (
        memories.map(render)
      )}
      {share !== null && (
        <ComposerDialog
          key={share}
          open
          onClose={() => setShare(null)}
          me={me}
          initialText={share}
        />
      )}
    </Stack>
  );
}
