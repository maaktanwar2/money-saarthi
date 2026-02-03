// Sidebar Component - Professional navigation sidebar
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ScanSearch,
  LineChart,
  TrendingUp,
  Activity,
  Calculator,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  Target,
  Zap,
  BookOpen,
  Users,
  User,
  Shield,
  Crown,
} from 'lucide-react';
import { cn, storage } from '../lib/utils';

// Navigation Items
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    id: 'scanners',
    label: 'Scanners',
    icon: ScanSearch,
    path: '/scanners',
    badge: '15+',
    description: 'Stock screeners & filters',
  },
  {
    id: 'options',
    label: 'Options Lab',
    icon: LineChart,
    path: '/options',
    badge: 'Pro',
    description: 'Options chain & analytics',
  },
  {
    id: 'signals',
    label: 'Signals',
    icon: TrendingUp,
    path: '/signals',
    description: 'AI-powered trade signals',
  },
  {
    id: 'market',
    label: 'Market Pulse',
    icon: Activity,
    path: '/market',
    description: 'FII/DII, sectors, breadth',
  },
  {
    id: 'advisor',
    label: 'Trade Advisor',
    icon: Brain,
    path: '/advisor',
    badge: 'AI',
    description: 'AI trade recommendations',
  },
  {
    id: 'calculators',
    label: 'Calculators',
    icon: Calculator,
    path: '/calculators',
  },
  {
    id: 'journal',
    label: 'Trade Journal',
    icon: BookOpen,
    path: '/journal',
  },
  {
    id: 'backtest',
    label: 'Backtesting',
    icon: BarChart3,
    path: '/backtest',
    description: 'Strategy backtesting',
  },
];

const BOTTOM_ITEMS = [
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    path: '/profile',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
];

// Admin email check
const ADMIN_EMAILS = [
  'maaktanwar@gmail.com',
  'admin@moneysaarthi.com',
  'superadmin@moneysaarthi.com'
];

const isUserAdmin = () => {
  try {
    const stored = localStorage.getItem('ms_user');
    if (stored) {
      const user = JSON.parse(stored);
      return user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
    }
  } catch (e) {}
  return false;
};

// NavItem Component
const NavItem = ({ item, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === item.path || 
    (item.path !== '/' && location.pathname.startsWith(item.path));

  return (
    <NavLink
      to={item.path}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
        'hover:bg-white/[0.06]',
        isActive && 'bg-primary/10 text-primary'
      )}
    >
      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 w-1 h-6 bg-primary rounded-full"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      
      {/* Icon */}
      <item.icon className={cn(
        'w-5 h-5 flex-shrink-0 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
      )} />
      
      {/* Label */}
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className={cn(
              'text-sm font-medium whitespace-nowrap overflow-hidden',
              isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
            )}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      
      {/* Badge */}
      {!collapsed && item.badge && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded',
            item.badge === 'AI' && 'bg-violet-500/20 text-violet-400',
            item.badge === 'Pro' && 'bg-amber-500/20 text-amber-400',
            !['AI', 'Pro'].includes(item.badge) && 'bg-primary/20 text-primary'
          )}
        >
          {item.badge}
        </motion.span>
      )}
      
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl">
          <p className="font-medium text-sm">{item.label}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>
      )}
    </NavLink>
  );
};

// Main Sidebar Component
export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(() => storage.get('sidebarCollapsed', false));
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    storage.set('sidebarCollapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    // Check admin status on mount and when storage changes
    setIsAdmin(isUserAdmin());
    
    // Listen for storage changes (when user logs in/out)
    const handleStorageChange = () => {
      setIsAdmin(isUserAdmin());
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case of same-tab changes
    const interval = setInterval(() => {
      setIsAdmin(isUserAdmin());
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      className={cn(
        'fixed left-0 top-0 h-screen z-40',
        'flex flex-col',
        'border-r border-white/[0.08]',
        'bg-background/80 backdrop-blur-xl'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <h1 className="font-bold text-lg">Money Saarthi</h1>
                <p className="text-[10px] text-muted-foreground -mt-0.5">Pro Trading Platform</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.id} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-white/[0.08] py-4 px-3 space-y-1">
        {/* Admin Panel Link - Only visible for admins */}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={cn(
              'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
              'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
            )}
          >
            <Crown className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                >
                  Admin Panel
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-xl">
                <p className="font-medium text-sm">Admin Panel</p>
                <p className="text-xs text-muted-foreground">Super Admin Controls</p>
              </div>
            )}
          </NavLink>
        )}
        
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.id} item={item} collapsed={collapsed} />
        ))}
        
        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
            'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
            'transition-all duration-200'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
