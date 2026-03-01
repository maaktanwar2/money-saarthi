import { createTheme, alpha } from '@mui/material/styles';

const sharedTypography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.025em' },
  h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.02em' },
  h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em' },
  h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35 },
  h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
  subtitle1: { fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.5 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.8125rem', lineHeight: 1.6 },
  caption: { fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 400 },
  overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' },
  button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
};

const sharedShape = {
  borderRadius: 12,
};

// Custom trading colors shared across themes
const tradingColors = {
  bullish: { main: '#10b981', light: '#34d399', dark: '#059669' },
  bearish: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
  neutral: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
};

const getComponentOverrides = (mode) => ({
  MuiCssBaseline: {
    styleOverrides: {
      '*, *::before, *::after': { borderColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
      html: { scrollBehavior: 'smooth', WebkitTapHighlightColor: 'transparent' },
      body: {
        textRendering: 'optimizeLegibility',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      '::-webkit-scrollbar': { width: '6px', height: '6px' },
      '::-webkit-scrollbar-track': { background: 'transparent' },
      '::-webkit-scrollbar-thumb': {
        background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        borderRadius: '3px',
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
      },
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 12,
        fontWeight: 600,
        textTransform: 'none',
        padding: '8px 20px',
        transition: 'all 0.2s ease',
      },
      sizeSmall: { padding: '6px 14px', fontSize: '0.8125rem', borderRadius: 10 },
      sizeLarge: { padding: '12px 28px', fontSize: '1rem', borderRadius: 14 },
      containedPrimary: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' },
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: { borderRadius: 12, transition: 'all 0.2s ease' },
    },
  },
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        borderRadius: 16,
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        backgroundImage: 'none',
        ...(mode === 'dark'
          ? { backgroundColor: 'rgba(17,24,39,0.7)', backdropFilter: 'blur(20px) saturate(180%)' }
          : { backgroundColor: '#ffffff' }),
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        },
      },
    },
  },
  MuiCardContent: {
    styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
  },
  MuiCardHeader: {
    styleOverrides: { root: { padding: 20 } },
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        borderRadius: 16,
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { fontWeight: 600, borderRadius: 20, height: 26 },
      sizeSmall: { height: 22, fontSize: '0.6875rem' },
      colorSuccess: {
        backgroundColor: alpha('#10b981', 0.15),
        color: mode === 'dark' ? '#34d399' : '#059669',
        borderColor: alpha('#10b981', 0.2),
      },
      colorError: {
        backgroundColor: alpha('#ef4444', 0.15),
        color: mode === 'dark' ? '#f87171' : '#dc2626',
        borderColor: alpha('#ef4444', 0.2),
      },
      colorWarning: {
        backgroundColor: alpha('#f59e0b', 0.15),
        color: mode === 'dark' ? '#fbbf24' : '#d97706',
        borderColor: alpha('#f59e0b', 0.2),
      },
      colorInfo: {
        backgroundColor: alpha('#3b82f6', 0.15),
        color: mode === 'dark' ? '#60a5fa' : '#2563eb',
        borderColor: alpha('#3b82f6', 0.2),
      },
    },
  },
  MuiTextField: {
    defaultProps: { variant: 'outlined', size: 'small' },
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
          transition: 'all 0.2s ease',
          backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#10b981',
            borderWidth: 2,
          },
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: 12 },
      notchedOutline: {
        borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      },
    },
  },
  MuiSelect: {
    styleOverrides: {
      root: { borderRadius: 12 },
    },
  },
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 42 },
      indicator: {
        borderRadius: 10,
        height: '100%',
        backgroundColor: '#10b981',
        zIndex: 0,
      },
      flexContainer: {
        gap: 4,
        padding: 4,
        borderRadius: 14,
        backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        minHeight: 36,
        borderRadius: 10,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.8125rem',
        zIndex: 1,
        padding: '6px 16px',
        transition: 'all 0.2s ease',
        '&.Mui-selected': { color: '#fff', fontWeight: 600 },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 20,
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        ...(mode === 'dark'
          ? { backgroundColor: '#111827', backdropFilter: 'blur(20px)' }
          : { backgroundColor: '#ffffff' }),
      },
      backdrop: {
        backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: { root: { fontWeight: 600, fontSize: '1.125rem', padding: '20px 24px 12px' } },
  },
  MuiDialogContent: {
    styleOverrides: { root: { padding: '12px 24px 20px' } },
  },
  MuiDialogActions: {
    styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        border: 'none',
        ...(mode === 'dark'
          ? { backgroundColor: '#0d1117', borderRight: '1px solid rgba(255,255,255,0.06)' }
          : { backgroundColor: '#ffffff', borderRight: '1px solid rgba(0,0,0,0.06)' }),
      },
    },
  },
  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'transparent' },
    styleOverrides: {
      root: {
        backdropFilter: 'blur(20px) saturate(180%)',
        ...(mode === 'dark'
          ? { backgroundColor: 'rgba(10,14,23,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
          : { backgroundColor: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(0,0,0,0.06)' }),
      },
    },
  },
  MuiTable: {
    styleOverrides: {
      root: { borderCollapse: 'separate', borderSpacing: 0 },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        '& .MuiTableCell-head': {
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: `2px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          color: mode === 'dark' ? '#9ca3af' : '#6b7280',
          padding: '12px 16px',
        },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        padding: '10px 16px',
        fontSize: '0.8125rem',
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        transition: 'background-color 0.15s ease',
        '&:hover': {
          backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        },
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 8,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '6px 12px',
        ...(mode === 'dark'
          ? { backgroundColor: '#1f2937', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)' }
          : { backgroundColor: '#111827', color: '#f9fafb' }),
      },
      arrow: {
        color: mode === 'dark' ? '#1f2937' : '#111827',
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: { borderRadius: 4, height: 6 },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: { width: 44, height: 24, padding: 0 },
      switchBase: {
        padding: 2,
        '&.Mui-checked': {
          transform: 'translateX(20px)',
          '& + .MuiSwitch-track': { backgroundColor: '#10b981', opacity: 1 },
        },
      },
      thumb: { width: 20, height: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
      track: {
        borderRadius: 12,
        backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        opacity: 1,
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 12 },
      standardSuccess: {
        backgroundColor: alpha('#10b981', mode === 'dark' ? 0.15 : 0.1),
        color: mode === 'dark' ? '#34d399' : '#059669',
      },
      standardError: {
        backgroundColor: alpha('#ef4444', mode === 'dark' ? 0.15 : 0.1),
        color: mode === 'dark' ? '#f87171' : '#dc2626',
      },
      standardWarning: {
        backgroundColor: alpha('#f59e0b', mode === 'dark' ? 0.15 : 0.1),
        color: mode === 'dark' ? '#fbbf24' : '#d97706',
      },
      standardInfo: {
        backgroundColor: alpha('#3b82f6', mode === 'dark' ? 0.15 : 0.1),
        color: mode === 'dark' ? '#60a5fa' : '#2563eb',
      },
    },
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: {
        ...(mode === 'dark'
          ? { backgroundColor: 'rgba(10,14,23,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)' }
          : { backgroundColor: 'rgba(255,255,255,0.95)', borderTop: '1px solid rgba(0,0,0,0.06)' }),
        backdropFilter: 'blur(20px)',
        height: 72,
      },
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: {
        '&.Mui-selected': { color: '#10b981' },
        minWidth: 60,
      },
    },
  },
  MuiAccordion: {
    defaultProps: { elevation: 0, disableGutters: true },
    styleOverrides: {
      root: {
        borderRadius: '12px !important',
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        '&:before': { display: 'none' },
        marginBottom: 8,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 10,
        margin: '2px 8px',
        padding: '8px 12px',
        transition: 'all 0.2s ease',
        '&.Mui-selected': {
          backgroundColor: alpha('#10b981', 0.12),
          '&:hover': { backgroundColor: alpha('#10b981', 0.18) },
          '& .MuiListItemIcon-root': { color: '#10b981' },
          '& .MuiListItemText-primary': { fontWeight: 600, color: '#10b981' },
        },
      },
    },
  },
  MuiListSubheader: {
    styleOverrides: {
      root: {
        fontSize: '0.6875rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        lineHeight: '36px',
        backgroundColor: 'transparent',
        color: mode === 'dark' ? '#6b7280' : '#9ca3af',
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: 14,
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: mode === 'dark'
          ? '0 20px 60px rgba(0,0,0,0.5)'
          : '0 20px 60px rgba(0,0,0,0.1)',
        ...(mode === 'dark'
          ? { backgroundColor: '#111827', backdropFilter: 'blur(20px)' }
          : { backgroundColor: '#ffffff' }),
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: { borderRadius: 8, margin: '2px 6px', padding: '8px 12px', fontSize: '0.875rem' },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      },
    },
  },
  MuiSkeleton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        ...(mode === 'dark'
          ? { backgroundColor: 'rgba(255,255,255,0.06)' }
          : { backgroundColor: 'rgba(0,0,0,0.06)' }),
      },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: {
        backgroundColor: alpha('#10b981', 0.15),
        color: '#10b981',
        fontWeight: 600,
      },
    },
  },
  MuiBadge: {
    styleOverrides: {
      colorError: { backgroundColor: '#ef4444' },
      colorPrimary: { backgroundColor: '#10b981' },
    },
  },
  MuiSnackbar: {
    styleOverrides: {
      root: { '& .MuiPaper-root': { borderRadius: 12 } },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#10b981', light: '#34d399', dark: '#059669', contrastText: '#ffffff' },
    secondary: { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', contrastText: '#ffffff' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
    info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
    background: { default: '#0a0e17', paper: '#111827' },
    text: { primary: '#f9fafb', secondary: '#9ca3af', disabled: '#4b5563' },
    divider: 'rgba(255,255,255,0.06)',
    action: {
      active: '#f9fafb',
      hover: 'rgba(255,255,255,0.05)',
      selected: 'rgba(16,185,129,0.12)',
      disabled: 'rgba(255,255,255,0.2)',
      disabledBackground: 'rgba(255,255,255,0.08)',
    },
    ...tradingColors,
  },
  typography: sharedTypography,
  shape: sharedShape,
  components: getComponentOverrides('dark'),
});

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#059669', light: '#10b981', dark: '#047857', contrastText: '#ffffff' },
    secondary: { main: '#7c3aed', light: '#8b5cf6', dark: '#6d28d9', contrastText: '#ffffff' },
    error: { main: '#dc2626', light: '#ef4444', dark: '#b91c1c' },
    warning: { main: '#d97706', light: '#f59e0b', dark: '#b45309' },
    success: { main: '#059669', light: '#10b981', dark: '#047857' },
    info: { main: '#2563eb', light: '#3b82f6', dark: '#1d4ed8' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#6b7280', disabled: '#9ca3af' },
    divider: 'rgba(0,0,0,0.06)',
    action: {
      active: '#111827',
      hover: 'rgba(0,0,0,0.04)',
      selected: 'rgba(5,150,105,0.1)',
      disabled: 'rgba(0,0,0,0.2)',
      disabledBackground: 'rgba(0,0,0,0.06)',
    },
    ...tradingColors,
  },
  typography: sharedTypography,
  shape: sharedShape,
  components: getComponentOverrides('light'),
});

export { tradingColors };
export default { darkTheme, lightTheme };
