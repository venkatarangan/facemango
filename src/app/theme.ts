import { alpha, createTheme } from '@mui/material/styles';
import { brand, fonts } from './tokens';

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: brand.mango,
      light: brand.mangoLight,
      dark: brand.mangoText,
      contrastText: brand.ink,
    },
    secondary: { main: brand.ink, contrastText: '#FFFFFF' },
    text: { primary: brand.ink, secondary: brand.inkSecondary },
    background: { default: brand.background, paper: brand.background },
    divider: brand.divider,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: fonts.ui,
    h1: { fontFamily: fonts.display, fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontFamily: fonts.display, fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontFamily: fonts.display, fontWeight: 800, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitTapHighlightColor: 'transparent',
          overscrollBehaviorY: 'none',
        },
        '::selection': { backgroundColor: alpha(brand.mango, 0.4) },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 20 },
        sizeLarge: { paddingBlock: 12, paddingInline: 28, fontSize: '1rem' },
      },
      variants: [
        // Yellow text on white is too faint; text/outlined primary buttons use ink instead.
        {
          props: { variant: 'text', color: 'primary' },
          style: { color: brand.ink },
        },
        {
          props: { variant: 'outlined', color: 'primary' },
          style: { color: brand.ink, borderColor: brand.mango, borderWidth: 2 },
        },
      ],
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${brand.divider}`,
          boxShadow: '0 1px 2px rgba(17,17,17,0.04), 0 4px 16px rgba(17,17,17,0.04)',
        },
      },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: brand.surface,
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: brand.mangoText },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { '&.Mui-focused': { color: brand.mangoTextStrong } } },
    },
    MuiCheckbox: {
      styleOverrides: { root: { '&.Mui-checked': { color: brand.mangoText } } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          color: brand.inkMuted,
          '&.Mui-selected': { color: brand.ink },
        },
        label: { fontSize: '0.7rem', '&.Mui-selected': { fontSize: '0.7rem', fontWeight: 700 } },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&.Mui-selected': {
            backgroundColor: alpha(brand.mango, 0.18),
            '&:hover': { backgroundColor: alpha(brand.mango, 0.26) },
          },
        },
      },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
