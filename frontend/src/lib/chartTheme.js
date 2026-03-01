// Centralized chart color theme for Recharts / SVG components
// Supports MUI theme integration for automatic light/dark mode

// Static dark-mode defaults
export const CHART_COLORS = {
  bullish:   '#10b981',
  bearish:   '#ef4444',
  neutral:   '#6366f1',
  warning:   '#f59e0b',
  axis:      '#6b7280',
  grid:      '#374151',
  bg:        '#1f2937',
  text:      '#e5e7eb',
  primary:   '#10b981',
  secondary: '#14b8a6',
  spot:      '#f97316',
};

/** Returns theme-aware chart colors from an MUI theme object */
export const getChartColorsFromTheme = (theme) => {
  if (!theme?.palette) return CHART_COLORS;

  const isDark = theme.palette.mode === 'dark';

  return {
    bullish:   theme.palette.success?.main   || CHART_COLORS.bullish,
    bearish:   theme.palette.error?.main     || CHART_COLORS.bearish,
    neutral:   theme.palette.info?.main      || CHART_COLORS.neutral,
    warning:   theme.palette.warning?.main   || CHART_COLORS.warning,
    axis:      theme.palette.text?.secondary  || CHART_COLORS.axis,
    grid:      theme.palette.divider          || CHART_COLORS.grid,
    bg:        theme.palette.background?.paper || CHART_COLORS.bg,
    text:      theme.palette.text?.primary    || CHART_COLORS.text,
    primary:   theme.palette.primary?.main    || CHART_COLORS.primary,
    secondary: isDark ? '#14b8a6' : '#0d9488',
    spot:      '#f97316',
  };
};
