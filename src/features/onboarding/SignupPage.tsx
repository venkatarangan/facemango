import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { LogoMark } from '@/components/brand/Logo';
import { brand } from '@/app/tokens';
import { useObjectUrl } from '@/app/useProfile';
import { useUiStore } from '@/app/uiStore';
import { saveProfile } from '@/db';
import { LOCAL_DATA_NOTICE } from '@/lib/copy';
import { AVATAR_MAX_PX, compressToWebP } from '@/lib/imaging';
import { isIOS } from '@/lib/platform';
import { firstName } from '@/lib/text';
import { IosDataNotice } from './IosDataNotice';
import {
  LANGUAGE_OPTIONS,
  signupSchema,
  type SignupInput,
  type SignupValues,
} from './signupSchema';

/** Quick signup (SPEC §3.1): Name, Age 13+, City, Languages, optional photo, data notice. */
export function SignupPage() {
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const [ios] = useState(() => isIOS());
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const photoUrl = useObjectUrl(photo);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput, unknown, SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', city: '', languages: ['English'], acknowledged: false as never },
    mode: 'onTouched',
  });

  const onPickPhoto = async (file: File | undefined) => {
    setPhotoError(undefined);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    try {
      setPhoto(await compressToWebP(file, AVATAR_MAX_PX, 0.3));
    } catch {
      setPhotoError("Couldn't read that photo. Try another one.");
    }
  };

  const onSubmit = async (values: SignupValues) => {
    setSubmitError(undefined);
    try {
      await saveProfile({
        name: values.name,
        age: values.age,
        city: values.city,
        languages: values.languages,
        photo: photo ?? undefined,
      });
      showToast(`Welcome to FaceMango, ${firstName(values.name)}! 🥭`);
      navigate('/', { replace: true });
    } catch {
      setSubmitError(
        "Couldn't save your profile. Is storage blocked in this browser (private mode)?",
      );
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: brand.surface,
        py: { xs: 2, sm: 6 },
        px: 2,
        pt: { xs: 'calc(16px + env(safe-area-inset-top))', sm: 6 },
      }}
    >
      <Card sx={{ maxWidth: 520, mx: 'auto' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
            <IconButton aria-label="Back" onClick={() => navigate('/welcome')} edge="start">
              <ArrowBackRounded />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            <LogoMark size={40} title="" aria-hidden />
          </Stack>
          <Typography variant="h4" component="h1">
            Create your profile
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            Just a few details so FaceMango can find friends who suit you. It all stays on this
            device.
          </Typography>

          <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    photo ? (
                      <IconButton
                        size="small"
                        aria-label="Remove photo"
                        onClick={() => setPhoto(null)}
                        sx={{
                          bgcolor: 'background.paper',
                          border: `1px solid ${brand.divider}`,
                          p: 0.25,
                        }}
                      >
                        <CloseRounded sx={{ fontSize: 16 }} />
                      </IconButton>
                    ) : null
                  }
                >
                  <Avatar
                    src={photoUrl}
                    alt=""
                    sx={{ width: 72, height: 72, bgcolor: brand.surface, color: brand.inkMuted }}
                  >
                    <PhotoCameraRounded />
                  </Avatar>
                </Badge>
                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => fileInput.current?.click()}
                  >
                    {photo ? 'Change photo' : 'Add a photo'}
                  </Button>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    Optional. Resized and kept on this device.
                  </Typography>
                  {photoError && <FormHelperText error>{photoError}</FormHelperText>}
                </Box>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label="Profile photo"
                  onChange={(e) => {
                    void onPickPhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </Stack>

              <TextField
                label="Name"
                autoComplete="given-name"
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                required
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
                <TextField
                  label="Age"
                  type="number"
                  slotProps={{ htmlInput: { inputMode: 'numeric', min: 13, max: 120 } }}
                  {...register('age', { valueAsNumber: true })}
                  error={!!errors.age}
                  helperText={errors.age?.message ?? '13 or older'}
                  required
                  sx={{ maxWidth: { sm: 140 } }}
                />
                <TextField
                  label="City"
                  autoComplete="address-level2"
                  {...register('city')}
                  error={!!errors.city}
                  helperText={errors.city?.message}
                  required
                />
              </Stack>
              <Controller
                control={control}
                name="languages"
                render={({ field, fieldState }) => (
                  <Autocomplete
                    multiple
                    freeSolo
                    options={LANGUAGE_OPTIONS}
                    value={field.value}
                    onChange={(_, value) =>
                      field.onChange(value.map((v) => v.trim()).filter(Boolean))
                    }
                    onBlur={field.onBlur}
                    renderValue={(value, getItemProps) =>
                      value.map((option, index) => {
                        const { key, ...itemProps } = getItemProps({ index });
                        return <Chip key={key} label={option} size="small" {...itemProps} />;
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Languages you know"
                        required
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message ?? 'Posts and comments are in English for now.'
                        }
                      />
                    )}
                  />
                )}
              />

              {ios ? (
                <IosDataNotice />
              ) : (
                <Alert severity="info" sx={{ borderRadius: 3 }} data-testid="local-data-notice">
                  {LOCAL_DATA_NOTICE}
                </Alert>
              )}
              <Controller
                control={control}
                name="acknowledged"
                render={({ field, fieldState }) => (
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value === true}
                          onChange={(e) => field.onChange(e.target.checked)}
                          onBlur={field.onBlur}
                          slotProps={{ input: { ref: field.ref } }}
                        />
                      }
                      label="I understand that my data lives only on this device"
                    />
                    {fieldState.error && (
                      <FormHelperText error>{fieldState.error.message}</FormHelperText>
                    )}
                  </Box>
                )}
              />

              {submitError && <Alert severity="error">{submitError}</Alert>}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                fullWidth
              >
                {isSubmitting ? 'Saving…' : 'Find my friends'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
