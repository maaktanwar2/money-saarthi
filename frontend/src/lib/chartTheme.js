// Centralized chart color theme for Recharts / SVG components
// These read CSS custom properties at runtime so they respect light/dark mode.

const getCSSVar = (name) => {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

/** Returns current theme-aware chart colors (call inside render / useEffect) */
export const getChartColors = () => ({
  bullish:   getCSSVar('--chart-bullish')   || '#10b981',
  bearish:   getCSSVar('--chart-bearish')   || '#ef4444',
  neutral:   getCSSVar('--chart-neutral')   || '#6366f1',
  warning:   getCSSVar('--chart-warning')   || '#f59e0b',
  axis:      getCSSVar('--chart-axis')      || '#6b7280',
  grid:      getCSSVar('--chart-grid')      || '#374151',
  bg:        getCSSVar('--chart-bg')        || '#1f2937',
  text:      getCSSVar('--chart-text')      || '#e5e7eb',
  primary:   getCSSVar('--chart-bullish')   || '#10b981',
  secondary: getCSSVar('--chart-secondary') || '#14b8a6',
  spot:      getCSSVar('--chart-spot')      || '#f97316',
});

// Static dark-mode defaults (for cases where CSS vars aren't available)
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
