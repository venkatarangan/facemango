import { useRef, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useMediaUrl, useObjectUrl } from '@/app/useProfile';
import { updateProfile, type Profile } from '@/db';
import { LANGUAGE_OPTIONS } from '@/features/onboarding/signupSchema';
import { AVATAR_MAX_PX, compressToWebP } from '@/lib/imaging';

export function EditProfileDialog({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const [name, setName] = useState(profile.name);
  const [city, setCity] = useState(profile.city);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [languages, setLanguages] = useState(profile.languages);
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined);
  const file = useRef<HTMLInputElement>(null);
  const currentUrl = useMediaUrl(profile.photoId);
  const newUrl = useObjectUrl(photo ?? undefined);
  const shown = photo === null ? undefined : (newUrl ?? currentUrl);
  const valid = name.trim().length > 0 && city.trim().length > 1 && languages.length > 0;

  const save = async () => {
    await updateProfile({ name, city, languages, bio, photo });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar src={shown} sx={{ width: 72, height: 72 }} />
            <Button variant="outlined" size="small" onClick={() => file.current?.click()}>
              Change photo
            </Button>
            {shown && (
              <Button size="small" onClick={() => setPhoto(null)}>
                Remove
              </Button>
            )}
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              aria-label="Profile photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void compressToWebP(f, AVATAR_MAX_PX, 0.3).then(setPhoto);
                e.target.value = '';
              }}
            />
          </Stack>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />
          <TextField
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <TextField
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <Autocomplete
            multiple
            freeSolo
            options={LANGUAGE_OPTIONS}
            value={languages}
            onChange={(_, v) => setLanguages(v.map((x) => x.trim()).filter(Boolean))}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => {
                const { key, ...rest } = getItemProps({ index });
                return <Chip key={key} label={option} size="small" {...rest} />;
              })
            }
            renderInput={(params) => <TextField {...params} label="Languages" />}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!valid} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
