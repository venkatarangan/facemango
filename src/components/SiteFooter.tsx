import { Fragment, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { SIMULATED_SHORT, SITE_LABEL, SITE_URL, SOURCE_URL } from '@/lib/copy';

/** Site footer: the simulated-friends note, links and the running version (grows each publish). */
export function SiteFooter({ sx }: { sx?: SxProps<Theme> }) {
  const parts: ReactNode[] = [
    SIMULATED_SHORT,
    <Link key="site" href={SITE_URL} color="inherit">
      {SITE_LABEL}
    </Link>,
    <Link key="about" component={RouterLink} to="/about" color="inherit">
      Privacy & about
    </Link>,
    <Link key="source" href={SOURCE_URL} target="_blank" rel="noreferrer" color="inherit">
      Open source
    </Link>,
    <span key="version" aria-label={`Version ${__APP_VERSION__}`}>
      v{__APP_VERSION__}
    </span>,
  ];
  return (
    <Typography component="footer" variant="caption" color="text.secondary" sx={sx}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {part}
        </Fragment>
      ))}
    </Typography>
  );
}
