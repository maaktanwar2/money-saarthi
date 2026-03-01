// UI Component Library - MUI-based components for Money Saarthi
// These are thin wrappers that maintain the same API while using MUI internally
import { forwardRef } from 'react';
import MuiButton from '@mui/material/Button';
import MuiIconButton from '@mui/material/IconButton';
import MuiCard from '@mui/material/Card';
import MuiCardContent from '@mui/material/CardContent';
import MuiChip from '@mui/material/Chip';
import MuiTextField from '@mui/material/TextField';
import MuiSelect from '@mui/material/Select';
import MuiMenuItem from '@mui/material/MenuItem';
import MuiFormControl from '@mui/material/FormControl';
import MuiTabs from '@mui/material/Tabs';
import MuiTab from '@mui/material/Tab';
import MuiCircularProgress from '@mui/material/CircularProgress';
import MuiSkeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const variantMap = {
  default: 'contained',
  secondary: 'contained',
  outline: 'outlined',
  ghost: 'text',
  destructive: 'contained',
  gradient: 'contained',
};

const sizeMap = {
  default: 'medium',
  sm: 'small',
  lg: 'large',
  icon: 'medium',
};

export const Button = forwardRef(({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}, ref) => {
  if (size === 'icon') {
    return (
      <MuiIconButton
        ref={ref}
        className={className}
        color={variant === 'destructive' ? 'error' : 'default'}
        size="medium"
        {...props}
      >
        {children}
      </MuiIconButton>
    );
  }

  const muiVariant = variantMap[variant] || 'contained';
  const muiSize = sizeMap[size] || 'medium';

  let colorProp = 'primary';
  let sxOverrides = {};

  if (variant === 'secondary') {
    colorProp = 'secondary';
  } else if (variant === 'destructive') {
    colorProp = 'error';
  } else if (variant === 'gradient') {
    sxOverrides = {
      background: 'linear-gradient(135deg, #10b981, #059669)',
      color: '#fff',
      '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)', boxShadow: '0 4px 20px rgba(16,185,129,0.3)' },
    };
  }

  return (
    <MuiButton
      ref={ref}
      variant={muiVariant}
      size={muiSize}
      color={colorProp}
      className={className}
      sx={sxOverrides}
      {...props}
    >
      {children}
    </MuiButton>
  );
});
Button.displayName = 'Button';

// ═══════════════════════════════════════════════════════════════════════════════
// CARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const Card = forwardRef(({ className, variant = 'default', children, ...props }, ref) => {
  let sxOverrides = {};

  if (variant === 'gradient') {
    sxOverrides = {
      background: (theme) =>
        theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(17,24,39,0.9), rgba(17,24,39,0.5))'
          : 'linear-gradient(135deg, #ffffff, #f8fafc)',
    };
  } else if (variant === 'solid') {
    sxOverrides = { backdropFilter: 'none' };
  }

  return (
    <MuiCard ref={ref} className={className} sx={sxOverrides} {...props}>
      {children}
    </MuiCard>
  );
});
Card.displayName = 'Card';

export const CardHeader = forwardRef(({ className, children, ...props }, ref) => (
  <Box ref={ref} className={className} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 2.5 }} {...props}>
    {children}
  </Box>
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ className, children, ...props }, ref) => (
  <Typography ref={ref} variant="subtitle1" fontWeight={600} className={className} {...props}>
    {children}
  </Typography>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(({ className, children, ...props }, ref) => (
  <Typography ref={ref} variant="caption" color="text.secondary" className={className} {...props}>
    {children}
  </Typography>
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(({ className, children, ...props }, ref) => (
  <MuiCardContent ref={ref} className={className} sx={{ pt: 0 }} {...props}>
    {children}
  </MuiCardContent>
));
CardContent.displayName = 'CardContent';

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE COMPONENT (uses MUI Chip)
// ═══════════════════════════════════════════════════════════════════════════════
const badgeColorMap = {
  default: 'primary',
  secondary: 'secondary',
  success: 'success',
  destructive: 'error',
  warning: 'warning',
  outline: 'default',
};

export const Badge = ({ className, variant = 'default', children, ...props }) => {
  const chipColor = badgeColorMap[variant] || 'primary';
  const chipVariant = variant === 'outline' ? 'outlined' : 'filled';

  return (
    <MuiChip
      label={children}
      size="small"
      color={chipColor}
      variant={chipVariant}
      className={className}
      {...props}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Input = forwardRef(({ className, type = 'text', onChange, value, placeholder, ...props }, ref) => (
  <MuiTextField
    inputRef={ref}
    type={type}
    variant="outlined"
    size="small"
    fullWidth
    className={className}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    {...props}
  />
));
Input.displayName = 'Input';

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Select = forwardRef(({ className, children, value, onChange, ...props }, ref) => (
  <MuiFormControl size="small" fullWidth className={className}>
    <MuiSelect ref={ref} value={value || ''} onChange={onChange} {...props}>
      {children}
    </MuiSelect>
  </MuiFormControl>
));
Select.displayName = 'Select';

// Re-export MenuItem for use with Select
export { MuiMenuItem as MenuItem };

// ═══════════════════════════════════════════════════════════════════════════════
// TABS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Tabs = ({ tabs, activeTab, onChange, className }) => {
  const currentIndex = tabs.findIndex((t) => t.id === activeTab);

  return (
    <MuiTabs
      value={currentIndex >= 0 ? currentIndex : 0}
      onChange={(_, newIndex) => onChange(tabs[newIndex].id)}
      className={className}
      variant="scrollable"
      scrollButtons="auto"
    >
      {tabs.map((tab) => (
        <MuiTab
          key={tab.id}
          label={tab.label}
          icon={tab.icon ? <tab.icon style={{ width: 16, height: 16 }} /> : undefined}
          iconPosition="start"
        />
      ))}
    </MuiTabs>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STAT DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const StatDisplay = ({ label, value, change, changePercent, icon: Icon, className }) => {
  const theme = useMuiTheme();
  const isPositive = change >= 0;
  const changeColor = isPositive ? theme.palette.success.main : theme.palette.error.main;

  return (
    <MuiCard className={className} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="overline" color="text.secondary">{label}</Typography>
        {Icon && <Icon style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>{value}</Typography>
        {change !== undefined && (
          <Typography variant="body2" fontWeight={500} sx={{ color: changeColor }}>
            {isPositive ? '+' : ''}{change} ({changePercent}%)
          </Typography>
        )}
      </Box>
    </MuiCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════════════
const spinnerSizeMap = { sm: 16, default: 32, lg: 48 };

export const Spinner = ({ size = 'default', className }) => (
  <Box className={className} sx={{ display: 'inline-flex' }}>
    <MuiCircularProgress size={spinnerSizeMap[size] || 32} color="primary" />
  </Box>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════════
export const Skeleton = ({ className, width, height, variant = 'rectangular', ...props }) => (
  <MuiSkeleton
    variant={variant}
    width={width}
    height={height}
    className={className}
    animation="wave"
    {...props}
  />
);

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════
export const EmptyState = ({ icon: Icon, title, description, action }) => {
  const theme = useMuiTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, textAlign: 'center' }}>
      {Icon && (
        <Box sx={{
          width: 64, height: 64, borderRadius: 3,
          bgcolor: 'rgba(16,185,129,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
        }}>
          <Icon style={{ width: 32, height: 32, color: theme.palette.primary.main }} />
        </Box>
      )}
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 2 }}>{description}</Typography>
      {action}
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE CHANGE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
export const PriceChange = ({ value, percentage, showIcon = true, size = 'default' }) => {
  const theme = useMuiTheme();
  const isPositive = value >= 0;
  const color = isPositive ? theme.palette.success.main : theme.palette.error.main;
  const fontSizes = { sm: '0.75rem', default: '0.8125rem', lg: '0.9375rem' };

  return (
    <Typography
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 500, fontSize: fontSizes[size], color }}
    >
      {showIcon && <span style={{ fontSize: '0.625rem' }}>{isPositive ? '▲' : '▼'}</span>}
      {isPositive ? '+' : ''}{value?.toFixed(2)} ({percentage?.toFixed(2)}%)
    </Typography>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACCURACY BADGE
// ═══════════════════════════════════════════════════════════════════════════════
export const AccuracyBadge = ({ accuracy, trades, className }) => {
  const getColor = (acc) => {
    if (acc >= 70) return 'success';
    if (acc >= 50) return 'warning';
    return 'destructive';
  };

  return (
    <Box className={className} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Badge variant={getColor(accuracy)}>{accuracy}% Accuracy</Badge>
      <Typography variant="caption" color="text.secondary">({trades} trades)</Typography>
    </Box>
  );
};

export default {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Input, Select, Tabs, StatDisplay, Spinner, Skeleton,
  EmptyState, PriceChange, AccuracyBadge
};
