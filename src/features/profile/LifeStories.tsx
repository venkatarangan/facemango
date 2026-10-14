import { Link as RouterLink } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { format } from 'date-fns';
import { brand } from '@/app/tokens';
import { db, type StoryStatus } from '@/db';

const STATUS: Record<StoryStatus, { label: string; order: number }> = {
  active: { label: 'Ongoing', order: 0 },
  completed: { label: 'Completed', order: 1 },
  abandoned: { label: 'Ended', order: 2 },
};

/** A friend's life stories (SPEC §4.3.1): ongoing first, each update links to its post. */
export function LifeStories({ personaId }: { personaId: string }) {
  const stories = useLiveQuery(
    () => db.stories.where('personaId').equals(personaId).toArray(),
    [personaId],
  );
  if (!stories?.length) return null;
  const sorted = [...stories].sort(
    (a, b) => STATUS[a.status].order - STATUS[b.status].order || b.startedAt - a.startedAt,
  );

  return (
    <Card component="section" aria-label="Life stories">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Life stories
        </Typography>
        <Stack spacing={2}>
          {sorted.map((story) => {
            const told = story.stages
              .map((stage, i) => ({ ...stage, n: i + 1 }))
              .filter((s) => s.postedAt);
            return (
              <Box key={story.id}>
                <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{story.title}</Typography>
                  <Chip
                    label={STATUS[story.status].label}
                    size="small"
                    sx={
                      story.status === 'active'
                        ? { bgcolor: alpha(brand.mango, 0.3), fontWeight: 600 }
                        : undefined
                    }
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {told.length} of {story.stages.length} updates · started{' '}
                  {format(story.startedAt, 'd MMMM')}
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                  {told.map((s) =>
                    s.postId ? (
                      <Chip
                        key={s.n}
                        component={RouterLink}
                        to={`/post/${s.postId}`}
                        clickable
                        size="small"
                        variant="outlined"
                        label={`${s.n}. ${s.title}`}
                      />
                    ) : (
                      <Chip
                        key={s.n}
                        size="small"
                        variant="outlined"
                        label={`${s.n}. ${s.title}`}
                      />
                    ),
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
