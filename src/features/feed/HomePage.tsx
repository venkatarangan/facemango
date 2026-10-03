import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded';
import EmojiEmotionsRounded from '@mui/icons-material/EmojiEmotionsRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { useProfile } from '@/app/useProfile';
import { useUiStore } from '@/app/uiStore';
import { brand } from '@/app/tokens';
import { UserAvatar } from '@/components/UserAvatar';
import { IosDataNotice } from '@/features/onboarding/IosDataNotice';
import { isIOS, isStandalone } from '@/lib/platform';
import { firstName } from '@/lib/text';

function PostSkeleton() {
  return (
    <Card aria-hidden>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="40%" />
            <Skeleton width="20%" />
          </Box>
        </Stack>
        <Skeleton width="90%" />
        <Skeleton width="70%" />
        <Skeleton variant="rounded" height={180} sx={{ mt: 1.5 }} />
      </CardContent>
    </Card>
  );
}

export function HomePage() {
  const profile = useProfile();
  const showToast = useUiStore((s) => s.showToast);
  const [showIosNotice] = useState(() => isIOS() && !isStandalone());
  if (!profile) return null;

  const comingSoon = () => showToast('Posting arrives in milestone M3.');

  return (
    <Stack spacing={2}>
      <Card component="section" aria-label="Create a post">
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <UserAvatar profile={profile} />
            <ButtonBase
              onClick={comingSoon}
              sx={{
                flex: 1,
                justifyContent: 'flex-start',
                px: 2,
                py: 1.25,
                borderRadius: 999,
                bgcolor: brand.surface,
                border: `1px solid ${brand.divider}`,
                color: 'text.secondary',
                font: 'inherit',
                fontSize: '1rem',
                textAlign: 'left',
                '&:hover': { bgcolor: '#F2F2F2' },
              }}
            >
              What&apos;s on your mind, {firstName(profile.name)}?
            </ButtonBase>
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-around',
              '& .MuiButton-root': { whiteSpace: 'nowrap', px: { xs: 1, sm: 2.5 } },
            }}
          >
            <Button
              startIcon={<AddPhotoAlternateRounded sx={{ color: '#43A047' }} />}
              onClick={comingSoon}
            >
              Photo
            </Button>
            <Button
              startIcon={<EmojiEmotionsRounded sx={{ color: brand.mangoText }} />}
              onClick={comingSoon}
            >
              Feeling
            </Button>
            <Button
              startIcon={<AutoAwesomeRounded sx={{ color: brand.mangoText }} />}
              onClick={comingSoon}
            >
              Mango AI
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {showIosNotice && <IosDataNotice />}

      <Card
        component="section"
        sx={{
          background: `linear-gradient(135deg, ${alpha(brand.mango, 0.28)}, ${alpha(brand.mangoLight, 0.08)})`,
          borderColor: alpha(brand.mango, 0.5),
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
          >
            Welcome to FaceMango, {firstName(profile.name)} 🥭
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Your profile is saved on this device. Next, FaceMango will set up AI in your browser and
            find friends from {profile.city} and around the world. They&apos;ll start posting,
            liking and commenting right here.
          </Typography>
        </CardContent>
      </Card>

      <PostSkeleton />
      <PostSkeleton />
    </Stack>
  );
}
