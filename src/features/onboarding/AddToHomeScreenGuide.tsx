import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IosShareRounded from '@mui/icons-material/IosShareRounded';
import AddBoxOutlined from '@mui/icons-material/AddBoxOutlined';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import { brand } from '@/app/tokens';

const steps = [
  {
    icon: <IosShareRounded />,
    title: 'Tap the Share button',
    body: 'In Safari, tap the Share icon in the toolbar (bottom of the screen on iPhone, top on iPad).',
  },
  {
    icon: <AddBoxOutlined />,
    title: 'Choose "Add to Home Screen"',
    body: "Scroll down the share sheet if you don't see it straight away.",
  },
  {
    icon: <CheckCircleRounded />,
    title: 'Tap "Add"',
    body: 'FaceMango appears on your Home Screen.',
  },
  {
    icon: <HomeRounded />,
    title: 'Open FaceMango from the Home Screen',
    body: 'Data kept by the Home Screen app is not erased after 7 days. Still export a backup now and then.',
  },
];

export function AddToHomeScreenGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="a2hs-title">
      <DialogTitle id="a2hs-title">Add FaceMango to your Home Screen</DialogTitle>
      <DialogContent>
        <Stack component="ol" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {steps.map((step, index) => (
            <Stack component="li" key={step.title} direction="row" spacing={1.5}>
              <Box
                sx={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: brand.surface,
                  border: `1px solid ${brand.divider}`,
                }}
                aria-hidden
              >
                {step.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>
                  {index + 1}. {step.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.body}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
