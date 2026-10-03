import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CakeRounded from '@mui/icons-material/CakeRounded';

/** Desktop right column: birthdays and contacts. Filled by the engine in M4. */
export function RightRail() {
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
          <Typography variant="body2" color="text.secondary">
            Your friends' birthdays will show up here.
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
            Contacts
          </Typography>
          <Stack spacing={1.5} aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Skeleton variant="circular" width={32} height={32} animation={false} />
                <Skeleton variant="text" width={`${50 + ((i * 17) % 35)}%`} animation={false} />
              </Stack>
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            FaceMango will find your friends once on-device AI is set up.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
