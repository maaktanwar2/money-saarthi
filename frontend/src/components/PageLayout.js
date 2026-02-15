// Page Layout Component - Premium trading platform shell
// Desktop: Collapsible sidebar + header + content
// Mobile: Bottom tab nav + header + content (no sidebar)
import { useState, useEffect } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ScanSearch, Zap, LayoutDashboard, MoreHorizontal,
  BarChart3, LineChart, Brain, Calculator, BookOpen,
  Settings, User, Activity, Target, Bot, Coins, Layers
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn, storage } from '../lib/utils';

// Bottom nav items for mobile (user chose: Scanners/Strategies/Watchlist/More)
const BOTTOM_TABS = [
  { id: 'home', label: 'Home', icon: LayoutDashboard, path: '/' },
  { id: 'scanners', label: 'Scanners', icon: ScanSearch, path: '/signals' },
  { id: 'strategies', label: 'Strategies', icon: Zap, path: '/trade-finder' },
  { id: 'options', label: 'Options', icon: LineChart, path: '/options' },
  { id: 'more', label: 'More', icon: MoreHorizontal, path: null },
];

// "More" menu items
const MORE_ITEMS = [
  { label: 'Market Pulse', icon: Activity, path: '/market' },
  { label: 'Sector Map', icon: Layers, path: '/sectors' },
  { label: 'Sector Performance', icon: BarChart3, path: '/sector-performance' },
  { label: 'AI Agent', icon: Brain, path: '/ai-agent' },
  { label: 'Algo Trading', icon: Bot, path: '/algo' },
  { label: 'LTP Calculator', icon: Target, path: '/ltp-calculator' },
  { label: 'Calculators', icon: Calculator, path: '/calculators' },
  { label: 'Trade Journal', icon: BookOpen, path: '/journal' },
  { label: 'AI Tokens', icon: Coins, path: '/profile' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'Profile', icon: User, path: '/profile' },
];

// Mobile Bottom Tab Bar
const BottomTabBar = () => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close more menu on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[45] bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-[var(--bottom-nav-height)] left-0 right-0 max-h-[60vh] overflow-y-auto rounded-t-2xl bg-card border-t border-x border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2" />
              <div className="grid grid-cols-3 gap-1 p-3">
                {MORE_ITEMS.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors no-tap-highlight ios-touch',
                        isActive ? 'bg-primary/10 text-primary' : 'text-foreground-muted hover:bg-surface-1'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-2xs font-medium text-center leading-tight">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav className="bottom-nav lg:hidden">
        <div className="h-full flex items-center justify-around px-2">
          {BOTTOM_TABS.map((tab) => {
            const isMore = tab.id === 'more';
            const isActive = isMore ? moreOpen : (
              tab.path === '/' 
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname.startsWith(tab.path)
            );

            if (isMore) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors no-tap-highlight ios-touch min-w-[56px]',
                    isActive ? 'text-primary' : 'text-foreground-muted'
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="text-2xs font-medium">{tab.label}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors no-tap-highlight ios-touch min-w-[56px]',
                  isActive ? 'text-primary' : 'text-foreground-muted'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomTabIndicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                <span className={cn('text-2xs font-medium', isActive && 'text-primary')}>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export const PageLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => storage.get('sidebarCollapsed', false)
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(storage.get('sidebarCollapsed', false));
    };
    const handleSidebarToggle = (e) => {
      setSidebarCollapsed(e.detail.collapsed);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sidebarToggle', handleSidebarToggle);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarToggle', handleSidebarToggle);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay (hamburger fallback - optional) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-200',
          sidebarCollapsed ? 'lg:pl-[64px]' : 'lg:pl-[256px]'
        )}
      >
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        
        <div className="px-4 py-4 lg:px-6 lg:py-5 safe-bottom">
          <div className="max-w-content mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomTabBar />
    </div>
  );
};

// Page Header Component
export const PageHeader = ({ 
  title, 
  description, 
  badge,
  accuracy,
  trades,
  actions,
  breadcrumbs = [],
  compact = false,
}) => (
  <div className={cn('mb-5', compact && 'mb-3')}>
    {/* Breadcrumbs */}
    {breadcrumbs.length > 0 && (
      <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-3">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-foreground-faint">/</span>}
            {crumb.link ? (
              <a href={crumb.link} className="hover:text-foreground transition-colors">
                {crumb.label}
              </a>
            ) : (
              <span className="text-foreground-secondary">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>
    )}

    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className={cn(
            'font-bold tracking-tight truncate',
            compact ? 'text-xl' : 'text-2xl lg:text-3xl'
          )}>{title}</h1>
          {badge && (
            <span className={cn(
              'px-2 py-0.5 text-2xs font-semibold rounded-md shrink-0',
              badge === 'AI' && 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
              badge === 'Pro' && 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
              badge === 'New' && 'bg-primary/15 text-primary border border-primary/20',
              badge === 'Live' && 'bg-bullish/15 text-bullish border border-bullish/20',
              !['AI', 'Pro', 'New', 'Live'].includes(badge) && 'bg-secondary text-secondary-foreground border border-border'
            )}>
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-foreground-muted mt-0.5 line-clamp-1">{description}</p>
        )}
        
        {/* Accuracy Stats */}
        {(accuracy !== undefined || trades !== undefined) && (
          <div className="flex items-center gap-3 mt-2">
            {accuracy !== undefined && (
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  accuracy >= 70 ? 'bg-bullish' : accuracy >= 50 ? 'bg-amber-500' : 'bg-bearish'
                )} />
                <span className="text-xs">
                  <span className="font-semibold tabular-nums">{accuracy}%</span>
                  <span className="text-foreground-muted ml-1">Accuracy</span>
                </span>
              </div>
            )}
            {trades !== undefined && (
              <span className="text-xs text-foreground-muted tabular-nums">
                {trades.toLocaleString()} trades
              </span>
            )}
          </div>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  </div>
);

// Section Component
export const Section = ({ title, description, children, className, action, compact = false }) => (
  <section className={cn(compact ? 'mb-4' : 'mb-6', className)}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          {title && <h2 className={cn('font-semibold tracking-tight', compact ? 'text-base' : 'text-lg')}>{title}</h2>}
          {description && (
            <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export default PageLayout;

