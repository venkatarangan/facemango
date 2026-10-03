import type { ReactElement } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { brand } from '@/app/tokens';

interface ComingSoonProps {
  icon: ReactElement;
  title: string;
  description: string;
  milestone: string;
}

/** Placeholder for sections that land in later milestones (SPEC §10). */
export function ComingSoon({ icon, title, description, milestone }: ComingSoonProps) {
  return (
    <Card>
      <CardContent sx={{ py: 6, px: 3 }}>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(brand.mango, 0.18),
              color: brand.ink,
              '& svg': { fontSize: 36 },
            }}
            aria-hidden
          >
            {icon}
          </Box>
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            {description}
          </Typography>
          <Chip label={`Coming in ${milestone}`} size="small" variant="outlined" />
        </Stack>
      </CardContent>
    </Card>
  );
}
