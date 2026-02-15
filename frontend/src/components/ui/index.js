// UI Component Library v3.0 — Premium Trading Platform Components
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Button = forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default',
  children,
  ...props 
}, ref) => {
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-surface-2',
    outline: 'border border-border bg-transparent hover:bg-surface-1 hover:border-border-hover',
    ghost: 'hover:bg-surface-1 text-foreground-secondary hover:text-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    gradient: 'gradient-primary text-white hover:opacity-90 shadow-sm',
    bullish: 'bg-bullish/10 text-bullish border border-bullish/20 hover:bg-bullish/15',
    bearish: 'bg-bearish/10 text-bearish border border-bearish/20 hover:bg-bearish/15',
  };
  
  const sizes = {
    xs: 'h-7 px-2 text-xs gap-1',
    sm: 'h-8 px-3 text-sm gap-1.5',
    default: 'h-9 px-4 py-2 text-sm gap-2',
    lg: 'h-11 px-5 text-base gap-2',
    icon: 'h-9 w-9',
    'icon-sm': 'h-7 w-7',
    'icon-xs': 'h-6 w-6',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-40',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// ═══════════════════════════════════════════════════════════════════════════════
// CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Card = forwardRef(({ className, variant = 'default', interactive = false, ...props }, ref) => {
  const variants = {
    default: 'glass',
    solid: 'bg-card border border-border',
    surface: 'bg-surface-1 border border-border/50',
    gradient: 'bg-gradient-to-br from-card to-surface-1 border border-border/50',
    ghost: 'bg-transparent',
  };
  
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl',
        variants[variant],
        interactive && 'cursor-pointer transition-all duration-150 hover:border-border-hover hover:shadow-card-hover',
        className
      )}
      {...props}
    />
  );
});
Card.displayName = 'Card';

export const CardHeader = forwardRef(({ className, compact, ...props }, ref) => (
  <div ref={ref} className={cn(compact ? 'flex flex-col space-y-1 p-4' : 'flex flex-col space-y-1.5 p-5', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs text-foreground-muted', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(({ className, compact, ...props }, ref) => (
  <div ref={ref} className={cn(compact ? 'px-4 pb-4' : 'px-5 pb-5', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Badge = ({ className, variant = 'default', size = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-primary/12 text-primary border-primary/20',
    secondary: 'bg-secondary text-secondary-foreground border-border',
    success: 'bg-bullish/12 text-bullish border-bullish/20',
    destructive: 'bg-bearish/12 text-bearish border-bearish/20',
    warning: 'bg-amber-500/12 text-amber-500 border-amber-500/20',
    info: 'bg-blue-500/12 text-blue-400 border-blue-500/20',
    outline: 'border border-border bg-transparent text-foreground-secondary',
    bullish: 'bg-bullish/10 text-bullish border-bullish/15',
    bearish: 'bg-bearish/10 text-bearish border-bearish/15',
  };

  const sizes = {
    sm: 'px-1.5 py-px text-2xs',
    default: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-0.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-semibold border transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-lg border border-border bg-surface-1/50 px-3 py-2 text-sm',
      'placeholder:text-foreground-faint',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-all duration-150',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-lg border border-border bg-surface-1/50 px-3 py-2 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-all duration-150 cursor-pointer',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

// ═══════════════════════════════════════════════════════════════════════════════
// TABS COMPONENT (pill style)
// ═══════════════════════════════════════════════════════════════════════════════
export const Tabs = ({ tabs, activeTab, onChange, className, size = 'default' }) => {
  const sizes = {
    sm: 'text-xs px-2.5 py-1.5',
    default: 'text-sm px-3.5 py-2',
    lg: 'text-sm px-4 py-2.5',
  };
  
  return (
    <div className={cn('flex gap-0.5 p-0.5 rounded-lg bg-surface-1/50', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 font-medium rounded-md transition-all duration-150 relative',
            sizes[size],
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground-secondary hover:bg-surface-2/50'
          )}
        >
          {tab.icon && <tab.icon className="w-3.5 h-3.5 mr-1.5 inline" />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-1.5 text-2xs font-bold',
              activeTab === tab.id ? 'text-primary-foreground/70' : 'text-foreground-faint'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STAT DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const StatDisplay = ({ label, value, change, changePercent, icon: Icon, className, compact = false }) => {
  const isPositive = change >= 0;
  
  return (
    <div className={cn('stat-card', compact && 'p-2.5', className)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xs text-foreground-muted uppercase tracking-wider font-medium">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 text-foreground-faint" />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-bold tabular-nums', compact ? 'text-lg' : 'text-xl')}>{value}</span>
        {change !== undefined && (
          <span className={cn('text-xs font-medium tabular-nums', isPositive ? 'text-bullish' : 'text-bearish')}>
            {isPositive ? '+' : ''}{change} ({changePercent}%)
          </span>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════════════
export const Spinner = ({ size = 'default', className }) => {
  const sizes = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border',
    default: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-2',
  };
  
  return (
    <div className={cn(
      'rounded-full border-primary/20 border-t-primary animate-spin',
      sizes[size],
      className
    )} />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════════
export const Skeleton = ({ className, ...props }) => (
  <div className={cn('skeleton', className)} {...props} />
);

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    {Icon && (
      <div className="w-12 h-12 rounded-xl bg-surface-1 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-foreground-muted" />
      </div>
    )}
    <h3 className="text-sm font-semibold mb-1">{title}</h3>
    <p className="text-xs text-foreground-muted max-w-xs mb-3">{description}</p>
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE CHANGE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
export const PriceChange = ({ value, percentage, showIcon = true, size = 'default' }) => {
  const isPositive = value >= 0;
  const sizes = {
    xs: 'text-2xs',
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 font-medium tabular-nums',
      sizes[size],
      isPositive ? 'text-bullish' : 'text-bearish'
    )}>
      {showIcon && (
        <span className="text-2xs">
          {isPositive ? '▲' : '▼'}
        </span>
      )}
      {isPositive ? '+' : ''}{value?.toFixed(2)} ({percentage?.toFixed(2)}%)
    </span>
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
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge variant={getColor(accuracy)} size="sm">
        {accuracy}%
      </Badge>
      {trades && (
        <span className="text-2xs text-foreground-muted tabular-nums">
          {trades} trades
        </span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════════════════
export const ProgressBar = ({ value = 0, max = 100, variant = 'default', size = 'default', className }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const variants = {
    default: 'bg-primary',
    bullish: 'bg-bullish',
    bearish: 'bg-bearish',
    warning: 'bg-amber-500',
  };
  const sizes = {
    sm: 'h-1',
    default: 'h-1.5',
    lg: 'h-2',
  };
  
  return (
    <div className={cn('w-full rounded-full bg-surface-1 overflow-hidden', sizes[size], className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', variants[variant])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MINI CHIP (for tags, filters etc.)
// ═══════════════════════════════════════════════════════════════════════════════
export const Chip = ({ children, active, onClick, className }) => (
  <button
    onClick={onClick}
    className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
      active
        ? 'bg-primary/12 text-primary border border-primary/25'
        : 'bg-surface-1 text-foreground-muted border border-border/50 hover:border-border hover:text-foreground-secondary',
      className
    )}
  >
    {children}
  </button>
);

export default {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Input, Select, Tabs, StatDisplay, Spinner, Skeleton,
  EmptyState, PriceChange, AccuracyBadge, ProgressBar, Chip
};
