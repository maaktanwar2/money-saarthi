// UI Component Library - Base components for Money Saarthi
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
    default: 'bg-primary-dark text-primary-foreground hover:bg-primary-dark/85 shadow-lg shadow-primary/20',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    gradient: 'gradient-primary text-white hover:opacity-90 shadow-lg shadow-emerald-500/20',
  };
  
  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 px-3 text-sm',
    lg: 'h-12 px-6 text-lg',
    icon: 'h-10 w-10',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
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
export const Card = forwardRef(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'glass',
    solid: 'bg-card border border-border',
    gradient: 'bg-gradient-to-br from-card to-card/50 border border-white/[0.08]',
  };
  
  return (
    <div
      ref={ref}
      className={cn('rounded-2xl', variants[variant], className)}
      {...props}
    />
  );
});
Card.displayName = 'Card';

export const CardHeader = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-xl font-semibold leading-none tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Badge = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-primary/15 text-primary border-primary/20',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-500/15 text-green-500 border-green-500/20',
    destructive: 'bg-red-500/15 text-red-500 border-red-500/20',
    warning: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
    outline: 'border border-border bg-transparent',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors',
        variants[variant],
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
      'flex h-10 w-full rounded-xl border border-input bg-background/50 px-4 py-2 text-sm',
      'placeholder:text-muted-foreground',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-all duration-200',
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
      'flex h-10 w-full rounded-xl border border-input bg-background/50 px-4 py-2 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-all duration-200 cursor-pointer',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

// ═══════════════════════════════════════════════════════════════════════════════
// TABS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const Tabs = ({ tabs, activeTab, onChange, className }) => (
  <div className={cn('flex gap-1 p-1 rounded-xl bg-secondary/50', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={cn(
          'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
          activeTab === tab.id
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        )}
      >
        {tab.icon && <tab.icon className="w-4 h-4 mr-2 inline" />}
        {tab.label}
      </button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// STAT DISPLAY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const StatDisplay = ({ label, value, change, changePercent, icon: Icon, className }) => {
  const isPositive = change >= 0;
  
  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {change !== undefined && (
          <span className={cn('text-sm font-medium', isPositive ? 'text-bullish' : 'text-bearish')}>
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
    sm: 'w-4 h-4',
    default: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  
  return (
    <div className={cn('relative', sizes[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
    </div>
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
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {Icon && (
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
    )}
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE CHANGE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
export const PriceChange = ({ value, percentage, showIcon = true, size = 'default' }) => {
  const isPositive = value >= 0;
  const sizes = {
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 font-medium',
      sizes[size],
      isPositive ? 'text-bullish' : 'text-bearish'
    )}>
      {showIcon && (
        <span className={cn('text-xs', isPositive ? '▲' : '▼')}>
          {isPositive ? '▲' : '▼'}
        </span>
      )}
      {isPositive ? '+' : ''}{value?.toFixed(2)} ({percentage?.toFixed(2)}%)
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACCURACY BADGE (For tool statistics)
// ═══════════════════════════════════════════════════════════════════════════════
export const AccuracyBadge = ({ accuracy, trades, className }) => {
  const getColor = (acc) => {
    if (acc >= 70) return 'success';
    if (acc >= 50) return 'warning';
    return 'destructive';
  };
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant={getColor(accuracy)}>
        {accuracy}% Accuracy
      </Badge>
      <span className="text-xs text-muted-foreground">
        ({trades} trades)
      </span>
    </div>
  );
};

export default {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Input, Select, Tabs, StatDisplay, Spinner, Skeleton,
  EmptyState, PriceChange, AccuracyBadge
};
