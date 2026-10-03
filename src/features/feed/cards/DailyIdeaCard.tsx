import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { brand } from '@/app/tokens';
import { db } from '@/db';
import { ensureDailyIdea, type DailyIdea } from '@/engine/dailyIdea';
import { setMeta } from '@/engine/settings';
import { useNow } from '@/lib/useNow';

/** "💡 Today's idea from Mango AI" (SPEC §8 #11). */
export function DailyIdeaCard({ onUse }: { onUse: (text: string) => void }) {
  const now = useNow();
  const today = format(now, 'yyyy-MM-dd');
  const state = useLiveQuery(async () => {
    const [idea, dismissed] = await Promise.all([
      db.meta.get('dailyIdea'),
      db.meta.get('dailyIdeaDismissed'),
    ]);
    return {
      idea: idea?.value as DailyIdea | undefined,
      dismissed: dismissed?.value as string | undefined,
    };
  }, []);
  useEffect(() => {
    void ensureDailyIdea();
  }, [today]);
  if (!state?.idea || state.idea.date !== today || state.dismissed === today) return null;
  return (
    <Card
      component="section"
      aria-label="Today's idea"
      sx={{ borderColor: alpha(brand.mango, 0.5) }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
          <Typography
            variant="subtitle2"
            sx={{ flex: 1, color: brand.mangoTextStrong, fontWeight: 800 }}
          >
            💡 Today&apos;s idea from Mango AI
          </Typography>
          <IconButton
            size="small"
            aria-label="Dismiss idea"
            onClick={() => void setMeta('dailyIdeaDismissed', today)}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
        <Typography sx={{ my: 1 }}>{state.idea.text}</Typography>
        <Button size="small" variant="contained" onClick={() => onUse(state.idea!.text)}>
          Write about this
        </Button>
      </CardContent>
    </Card>
  );
}
