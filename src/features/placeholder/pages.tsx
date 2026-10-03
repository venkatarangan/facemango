import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import AutoStoriesRounded from '@mui/icons-material/AutoStoriesRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import SpaRounded from '@mui/icons-material/SpaRounded';
import { ComingSoon } from '@/components/ComingSoon';

export const FriendsPage = () => (
  <ComingSoon
    icon={<PeopleAltRounded />}
    title="Friends"
    description="20–30 AI friends and their profile pages, plus friend requests from public profiles."
    milestone="M4–M5"
  />
);

export const AssistantPage = () => (
  <ComingSoon
    icon={<AutoAwesomeRounded />}
    title="Mango AI"
    description="Write and polish posts, get daily ideas, and see what's trending among your friends."
    milestone="M5"
  />
);

export const MemoriesPage = () => (
  <ComingSoon
    icon={<AutoStoriesRounded />}
    title="Memories"
    description="On this day, friendversaries and milestone recaps."
    milestone="M5"
  />
);

export const ActivityPage = () => (
  <ComingSoon
    icon={<NotificationsRounded />}
    title="Activity"
    description="Reactions, comments, replies, mentions, birthdays and friend requests, plus your activity log."
    milestone="M4–M5"
  />
);

export const PhotosPage = () => (
  <ComingSoon
    icon={<PhotoLibraryRounded />}
    title="Photos"
    description="All your photos and your friends' photos in one grid, with a swipeable lightbox."
    milestone="M5"
  />
);

export const WellbeingPage = () => (
  <ComingSoon
    icon={<SpaRounded />}
    title="Wellbeing"
    description="A private tracker for time spent, when you use FaceMango, and how you feel. It never leaves this device."
    milestone="M5"
  />
);
