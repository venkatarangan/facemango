import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import WorkRounded from '@mui/icons-material/WorkRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import TranslateRounded from '@mui/icons-material/TranslateRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import ThumbDownRounded from '@mui/icons-material/ThumbDownRounded';
import CakeRounded from '@mui/icons-material/CakeRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import { format } from 'date-fns';
import { brand } from '@/app/tokens';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { db, ME, type Post } from '@/db';
import { ensureProfileDetails } from '@/engine/profiles';
import { ComposerDialog } from '@/features/compose/ComposerDialog';
import { PostCard } from '@/features/feed/PostCard';
import { usePackPhoto } from '@/features/feed/usePackPhoto';
import { useAuthors } from '@/features/feed/useAuthors';
import { packPhotoUrl, PACK_PREFIX } from '@/lib/photos';
import { EditProfileDialog } from './EditProfileDialog';

function Fact({ icon, children }: { icon: ReactElement; children: ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: 'center', color: 'text.secondary', '& svg': { fontSize: 20 } }}
    >
      {icon}
      <Typography color="text.primary">{children}</Typography>
    </Stack>
  );
}

/** Profile pages (SPEC §3.4): generated lazily on first visit for personas, then cached. */
export function ProfilePage() {
  const { id = ME } = useParams();
  const navigate = useNavigate();
  const authors = useAuthors();
  const author = authors?.get(id);
  const persona = author && author.kind !== 'me' ? author.persona : undefined;
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [error, setError] = useState(false);
  const cover = usePackPhoto(
    persona?.profileDetails?.coverPhotoId
      ? `${PACK_PREFIX}${persona.profileDetails.coverPhotoId}`
      : undefined,
  );
  const posts = useLiveQuery(
    () => db.posts.where('authorId').equals(id).reverse().sortBy('createdAt'),
    [id],
  );
  const needsDetails = !!persona && !persona.profileDetails;

  useEffect(() => {
    if (!needsDetails) return;
    let alive = true;
    ensureProfileDetails(id).catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id, needsDetails]);

  if (!authors) return null;
  if (!author) {
    return (
      <Card>
        <CardContent>
          <Typography>This person isn&apos;t on FaceMango any more.</Typography>
        </CardContent>
      </Card>
    );
  }
  const me = authors.get(ME)!;
  const isMe = author.kind === 'me';
  const details = persona?.profileDetails;
  const city = isMe ? author.profile.city : `${persona!.city}, ${persona!.country}`;
  const languages = isMe ? author.profile.languages : persona!.languages;

  return (
    <Stack spacing={2}>
      <Card sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            height: { xs: 150, sm: 220 },
            position: 'relative',
            background: cover
              ? `url(${packPhotoUrl(cover)}) center/cover`
              : `linear-gradient(135deg, ${brand.mangoLight}, ${brand.mango} 55%, ${brand.mangoDeep})`,
          }}
          role={cover ? 'img' : undefined}
          aria-label={cover ? `Cover photo: ${cover.alt}` : undefined}
        >
          <IconButton
            aria-label="Back"
            onClick={() => navigate(-1)}
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              bgcolor: 'rgba(255,255,255,0.85)',
              '&:hover': { bgcolor: '#fff' },
            }}
          >
            <ArrowBackRounded />
          </IconButton>
        </Box>
        <CardContent sx={{ pt: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { xs: 'center', sm: 'flex-end' }, mt: { xs: -6, sm: -5 } }}
          >
            <AuthorAvatar
              author={author}
              size={120}
              sx={{ border: '4px solid #fff', boxShadow: 2, fontSize: 40 }}
            />
            <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' }, pb: 1 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}
              >
                {author.name}
              </Typography>
              <Typography color="text.secondary">
                {isMe
                  ? 'You'
                  : persona!.kind === 'friend'
                    ? `Friend since ${format(persona!.createdAt, 'MMMM yyyy')}`
                    : persona!.kind === 'public'
                      ? 'Follows you'
                      : 'Former friend'}
              </Typography>
              {persona?.kind === 'former' && (
                <Chip label="Former friend" size="small" sx={{ mt: 0.5 }} />
              )}
            </Box>
            {isMe && (
              <Button
                variant="contained"
                startIcon={<EditRounded />}
                onClick={() => setEditingProfile(true)}
                sx={{ mb: 1 }}
              >
                Edit profile
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card component="section" aria-label="About">
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            About
          </Typography>
          <Stack spacing={1.25}>
            {isMe ? (
              author.profile.bio && <Typography>{author.profile.bio}</Typography>
            ) : details ? (
              <Typography>{details.about}</Typography>
            ) : error ? (
              <Typography color="text.secondary">
                Couldn&apos;t write this profile right now. Try again later.
              </Typography>
            ) : (
              <Box aria-label="Writing profile">
                <Skeleton width="95%" />
                <Skeleton width="80%" />
              </Box>
            )}
            {details && <Fact icon={<WorkRounded />}>{details.work}</Fact>}
            {details && <Fact icon={<SchoolRounded />}>{details.education}</Fact>}
            {!details && persona && <Fact icon={<WorkRounded />}>{persona.occupation}</Fact>}
            <Fact icon={<PlaceRounded />}>Lives in {city}</Fact>
            <Fact icon={<TranslateRounded />}>Speaks {languages.join(', ')}</Fact>
            {persona?.birthday && (
              <Fact icon={<CakeRounded />}>
                Birthday{' '}
                {format(
                  new Date(
                    2000,
                    Number(persona.birthday.slice(0, 2)) - 1,
                    Number(persona.birthday.slice(3)),
                  ),
                  'd MMMM',
                )}
              </Fact>
            )}
            {details && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontStyle: 'italic', pt: 0.5 }}
              >
                {details.personality}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {persona && (persona.interests.length > 0 || persona.likes.length > 0) && (
        <Card component="section" aria-label="Interests">
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
              Interests
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {persona.interests.map((i) => (
                <Chip key={i} label={i} sx={{ bgcolor: alpha(brand.mango, 0.2) }} />
              ))}
            </Stack>
            {persona.likes.length > 0 && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Fact icon={<FavoriteRounded />}>Likes {persona.likes.join(', ')}</Fact>
                {persona.dislikes.length > 0 && (
                  <Fact icon={<ThumbDownRounded />}>
                    Not a fan of {persona.dislikes.join(', ')}
                  </Fact>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" component="h2" sx={{ px: { xs: 0.5, sm: 0 } }}>
        Posts
      </Typography>
      {posts?.length === 0 && <Typography color="text.secondary">No posts yet.</Typography>}
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} authors={authors} onEdit={setEditingPost} />
      ))}

      {isMe && editingProfile && (
        <EditProfileDialog open onClose={() => setEditingProfile(false)} profile={author.profile} />
      )}
      {editingPost && (
        <ComposerDialog
          key={editingPost.id}
          open
          onClose={() => setEditingPost(null)}
          me={me}
          editing={editingPost}
        />
      )}
    </Stack>
  );
}
