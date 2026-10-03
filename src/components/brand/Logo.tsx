import { useId } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import { brand, fonts } from '@/app/tokens';

type LogoMarkProps = { size?: number; title?: string } & Omit<BoxProps<'svg'>, 'component'>;

/** The FaceMango mark: a mango that doubles as a speech bubble. Source: public/logo.svg. */
export function LogoMark({ size = 40, title = 'FaceMango', ...rest }: LogoMarkProps) {
  const gradientId = useId();
  return (
    <Box
      component="svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      {...rest}
    >
      <defs>
        <linearGradient id={gradientId} x1="0.2" y1="0.05" x2="0.8" y2="1">
          <stop offset="0" stopColor={brand.mangoLight} />
          <stop offset="0.55" stopColor={brand.mango} />
          <stop offset="1" stopColor={brand.mangoDeep} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M318 132C404 124 456 196 446 282C436 368 366 428 282 438C226 444 176 436 136 418C116 428 92 440 70 446C82 426 94 406 100 388C78 340 90 272 136 216C182 160 246 138 318 132Z"
      />
      <path
        fill="none"
        stroke={brand.ink}
        strokeWidth="14"
        strokeLinecap="round"
        d="M318 136C320 120 326 104 336 92"
      />
      <path fill={brand.ink} d="M334 96C350 52 400 32 456 40C446 90 396 116 334 96Z" />
      <path
        fill="none"
        stroke={brand.mango}
        strokeWidth="6"
        strokeLinecap="round"
        d="M350 88C384 70 414 58 440 50"
      />
      <path
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.65"
        strokeWidth="20"
        strokeLinecap="round"
        d="M150 270C160 226 194 192 244 176"
      />
    </Box>
  );
}

type WordmarkProps = { size?: number } & BoxProps;

/** "FaceMango" wordmark: ink "Face" + mango "Mango", in the rounded display face. */
export function Wordmark({ size = 24, sx, ...rest }: WordmarkProps) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: fonts.display,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color: brand.ink,
        whiteSpace: 'nowrap',
        ...sx,
      }}
      {...rest}
    >
      Face
      <Box component="span" sx={{ color: brand.mangoText }}>
        Mango
      </Box>
    </Box>
  );
}

type LogoProps = { size?: number } & BoxProps;

/** Mark + wordmark lockup. */
export function Logo({ size = 32, sx, ...rest }: LogoProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(size * 0.12)}px`,
        ...sx,
      }}
      aria-label="FaceMango"
      role="img"
      {...rest}
    >
      <LogoMark size={size * 1.25} title="" aria-hidden />
      <Wordmark size={size * 0.8} aria-hidden />
    </Box>
  );
}
