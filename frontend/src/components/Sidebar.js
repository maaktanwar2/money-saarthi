// Sidebar Component - Professional navigation sidebar
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  BarChart3,
  Target,
  Zap,
  BookOpen,
  Users,
  User,
  Shield,
  Crown,
  Lock,
  Sparkles,
  Bot,
  Coins,
} from 'lucide-react';
import { cn, storage } from '../lib/utils';

// Check if user has pro access
const checkProAccess = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    if (user.isAdmin) return true;
    const sub = user.subscription;
    if (!sub || sub.plan !== 'pro' || sub.status !== 'active') return false;
    if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
};

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
    isPro: true,
    description: 'Options chain & analytics',
  },
  {
    id: 'signals',
    label: 'Signals',
    icon: TrendingUp,
    path: '/signals',
    badge: 'Pro',
    isPro: true,
    description: 'AI-powered trade signals',
  },
  {
    id: 'market',
    label: 'Market Pulse',
    icon: Activity,
    path: '/market',
    badge: 'Pro',
    isPro: true,
    description: 'FII/DII, sectors, breadth',
  },
  {
    id: 'algo',
    label: 'Algo Trading',
    icon: Bot,
    path: '/algo',
    badge: 'Live',
    isPro: true,
    description: 'AI bots that trade for you',
  },
  {
    id: 'tokens',
    label: 'AI Tokens',
    icon: Coins,
    path: '/tokens',
    description: 'Buy tokens for AI features',
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
    badge: 'Pro',
    isPro: true,
  },
  {
    id: 'backtest',
    label: 'Backtesting',
    icon: BarChart3,
    path: '/backtest',
    badge: 'Pro',
    isPro: true,
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
const NavItem = ({ item, collapsed, hasPro }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === item.path || 
    (item.path !== '/' && location.pathname.startsWith(item.path));
  const isLocked = item.isPro && !hasPro;

  const handleClick = (e) => {
    if (isLocked) {
      e.preventDefault();
      navigate('/pricing');
    }
  };

  return (
    <NavLink
      to={item.path}
      onClick={handleClick}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
        'hover:bg-white/[0.06]',
        isActive && !isLocked && 'bg-primary/10 text-primary',
        isLocked && 'opacity-60'
      )}
    >
      {/* Active Indicator */}
      {isActive && !isLocked && (
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
            'ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1',
            item.badge === 'AI' && 'bg-violet-500/20 text-violet-400',
            item.badge === 'Pro' && (isLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'),
            !['AI', 'Pro'].includes(item.badge) && 'bg-primary/20 text-primary'
          )}
        >
          {isLocked && <Lock className="w-2.5 h-2.5" />}
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
  const [hasPro, setHasPro] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    storage.set('sidebarCollapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    // Check admin status and pro access on mount and when storage changes
    const updateStatus = () => {
      setIsAdmin(isUserAdmin());
      setHasPro(checkProAccess());
    };
    
    updateStatus();
    
    // Listen for storage changes (when user logs in/out)
    window.addEventListener('storage', updateStatus);
    
    // Also check periodically in case of same-tab changes
    const interval = setInterval(updateStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', updateStatus);
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
          <img 
            src="/logo.png" 
            alt="Money Saarthi" 
            className="w-10 h-10 object-contain"
            style={{ background: 'transparent' }}
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <h1 className="font-bold text-lg" style={{ color: '#D4A574' }}>Money Saarthi</h1>
                <p className="text-[10px] text-muted-foreground -mt-0.5">AI@Market Intelligence</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.id} item={item} collapsed={collapsed} hasPro={hasPro} />
        ))}
        
        {/* Upgrade CTA - Only show for non-pro users */}
        {!hasPro && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mx-1"
          >
            <button
              onClick={() => navigate('/pricing')}
              className="w-full p-4 rounded-xl bg-gradient-to-br from-primary/20 via-amber-500/10 to-primary/20 border border-primary/30 hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Upgrade to Pro</p>
                  <p className="text-xs text-muted-foreground">₹899/mo or ₹4,999/yr</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary group-hover:gap-2 transition-all">
                <Sparkles className="w-3 h-3" />
                Unlock all features
              </div>
            </button>
          </motion.div>
        )}
        
        {/* Pro Badge - Show for pro users */}
        {hasPro && !isAdmin && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mx-1"
          >
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">Pro Member</span>
              </div>
            </div>
          </motion.div>
        )}
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
