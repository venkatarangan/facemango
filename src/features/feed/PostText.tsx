import { Fragment, useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { brand } from '@/app/tokens';

const LIMIT = 320;

/** Post text with highlighted @mentions and "See more" for long posts. */
export function PostText({ text, mentionNames }: { text: string; mentionNames: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const long = text.length > LIMIT;
  const shown = long && !expanded ? `${text.slice(0, LIMIT).trimEnd()}…` : text;
  const names = mentionNames.filter(Boolean).sort((a, b) => b.length - a.length);
  const pattern = names.length
    ? new RegExp(
        `(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`,
        'g',
      )
    : null;
  const parts = pattern ? shown.split(pattern) : [shown];
  return (
    <Typography
      sx={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        fontSize: text.length < 90 ? '1.125rem' : '1rem',
      }}
    >
      {parts.map((part, i) =>
        pattern && part.startsWith('@') && names.includes(part.slice(1)) ? (
          <Box key={i} component="span" sx={{ fontWeight: 700, color: brand.mangoTextStrong }}>
            {part.slice(1)}
          </Box>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
      {long && (
        <Link
          component="button"
          onClick={() => setExpanded((v) => !v)}
          sx={{ ml: 0.5, fontWeight: 700, color: 'text.secondary', verticalAlign: 'baseline' }}
        >
          {expanded ? 'See less' : 'See more'}
        </Link>
      )}
    </Typography>
  );
}
