// Sidebar Component - Premium desktop navigation
import { useState, useEffect, useCallback } from 'react';
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
  User,
  Shield,
  Crown,
  Lock,
  Sparkles,
  Bot,
  Coins,
  Layers,
} from 'lucide-react';
import { cn, storage, isAdmin as isAdminCheck } from '../lib/utils';

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

// Navigation Items — grouped for visual structure
const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { id: 'scanners', label: 'Scanners', icon: ScanSearch, path: '/signals', badge: '15+', description: 'Stock screeners & filters' },
      { id: 'trade-finder', label: 'Trade Finder', icon: Zap, path: '/trade-finder', badge: 'New', description: 'OI-backed trade suggestions' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'options', label: 'Options Lab', icon: LineChart, path: '/options', badge: 'Pro', isPro: true, description: 'Options chain & analytics' },
      { id: 'market', label: 'Market Pulse', icon: Activity, path: '/market', badge: 'Pro', isPro: true, description: 'FII/DII, sectors, breadth' },
      { id: 'sectors', label: 'Sector Map', icon: Layers, path: '/sectors', badge: 'Pro', isPro: true, description: 'All stocks by sector' },
      { id: 'sector-performance', label: 'Sector Perf', icon: BarChart3, path: '/sector-performance', badge: 'New', isPro: true, description: 'F&O sectoral performance' },
    ],
  },
  {
    label: 'AI & Automation',
    items: [
      { id: 'ai-agent', label: 'AI Agent', icon: Brain, path: '/ai-agent', badge: 'AI', isPro: true, description: 'Autonomous trading AI' },
      { id: 'algo', label: 'Algo Trading', icon: Bot, path: '/algo', badge: 'Live', isPro: true, description: 'AI trading bots' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'ltp-calculator', label: 'LTP Calculator', icon: Target, path: '/ltp-calculator', description: 'P&L & option analysis' },
      { id: 'calculators', label: 'Calculators', icon: Calculator, path: '/calculators' },
      { id: 'journal', label: 'Trade Journal', icon: BookOpen, path: '/journal', badge: 'Pro', isPro: true },
      { id: 'backtest', label: 'Backtesting', icon: BarChart3, path: '/backtest', badge: 'Pro', isPro: true },
    ],
  },
];

const BOTTOM_ITEMS = [
  { id: 'tokens', label: 'AI Tokens', icon: Coins, path: '/profile' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

const isUserAdmin = () => {
  try {
    const stored = localStorage.getItem('ms_user');
    if (stored) {
      const user = JSON.parse(stored);
      return isAdminCheck(user?.email);
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
        'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150',
        'hover:bg-surface-1',
        isActive && !isLocked && 'bg-primary/8 text-primary',
        isLocked && 'opacity-50'
      )}
    >
      {/* Active Indicator */}
      {isActive && !isLocked && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 w-[3px] h-5 bg-primary rounded-r-full"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
      
      {/* Icon */}
      <item.icon className={cn(
        'w-[18px] h-[18px] flex-shrink-0 transition-colors',
        isActive ? 'text-primary' : 'text-foreground-muted group-hover:text-foreground-secondary'
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
              isActive ? 'text-primary' : 'text-foreground-secondary group-hover:text-foreground'
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
            'ml-auto px-1.5 py-px text-2xs font-semibold rounded flex items-center gap-0.5',
            item.badge === 'AI' && 'bg-violet-500/15 text-violet-400',
            item.badge === 'Pro' && (isLocked ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'),
            item.badge === 'Live' && 'bg-bullish/15 text-bullish',
            !['AI', 'Pro', 'Live'].includes(item.badge) && 'bg-primary/12 text-primary'
          )}
        >
          {isLocked && <Lock className="w-2.5 h-2.5" />}
          {item.badge}
        </motion.span>
      )}
      
      {/* Tooltip for collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-elevated">
          <p className="font-medium text-xs">{item.label}</p>
          {item.description && (
            <p className="text-2xs text-foreground-muted">{item.description}</p>
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
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed } }));
  }, [collapsed]);

  useEffect(() => {
    const updateStatus = () => {
      setIsAdmin(isUserAdmin());
      setHasPro(checkProAccess());
    };
    updateStatus();
    window.addEventListener('storage', updateStatus);
    const interval = setInterval(updateStatus, 60000);
    return () => {
      window.removeEventListener('storage', updateStatus);
      clearInterval(interval);
    };
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'fixed left-0 top-0 h-screen z-40',
        'flex flex-col',
        'border-r border-border/50',
        'bg-background/95 backdrop-blur-xl'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-border/50">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img 
            src="/logo.png" 
            alt="Money Saarthi" 
            className="w-9 h-9 object-contain flex-shrink-0"
            style={{ background: 'transparent' }}
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="min-w-0"
              >
                <h1 className="font-bold text-sm tracking-tight" style={{ color: '#D4A574' }}>Money Saarthi</h1>
                <p className="text-2xs text-foreground-muted -mt-0.5">AI Market Intelligence</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-thin">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-4')}>
            {/* Group label */}
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-2xs font-semibold text-foreground-faint uppercase tracking-widest px-2.5 mb-1.5"
              >
                {group.label}
              </motion.p>
            )}
            {collapsed && gi > 0 && (
              <div className="w-6 h-px bg-border/50 mx-auto my-2" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.id} item={item} collapsed={collapsed} hasPro={hasPro} />
              ))}
            </div>
          </div>
        ))}
        
        {/* Upgrade CTA */}
        {!hasPro && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mx-0.5"
          >
            <button
              onClick={() => navigate('/pricing')}
              className="w-full p-3 rounded-xl bg-gradient-to-br from-primary/10 via-amber-500/5 to-primary/10 border border-primary/20 hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Crown className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-semibold">Upgrade to Pro</p>
                  <p className="text-2xs text-foreground-muted">₹899/mo</p>
                </div>
              </div>
            </button>
          </motion.div>
        )}
        
        {hasPro && !isAdmin && !collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mx-0.5"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Crown className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-500">Pro Member</span>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border/50 py-2.5 px-2.5 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.id} item={item} collapsed={collapsed} hasPro={hasPro} />
        ))}
        
        {/* Admin */}
        {isAdmin && (
          <NavItem 
            item={{ id: 'admin', label: 'Admin', icon: Shield, path: '/admin', badge: 'Admin' }} 
            collapsed={collapsed} 
            hasPro={true} 
          />
        )}
        
        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg',
            'text-foreground-muted hover:text-foreground-secondary hover:bg-surface-1',
            'transition-colors duration-150'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px]" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
