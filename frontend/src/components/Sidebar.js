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
  Layers,
  Star,
} from 'lucide-react';
import { cn, storage, isAdmin as isAdminCheck } from '../lib/utils';

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

// Navigation Items grouped by section
const NAV_SECTIONS = [
  {
    label: null, // no header for top items
    items: [
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
        path: '/signals',
        badge: '15+',
        badgeColor: 'emerald',
        description: 'Stock screeners & filters',
      },
    ],
  },
  {
    label: 'Markets',
    items: [
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
        id: 'market',
        label: 'Market Pulse',
        icon: Activity,
        path: '/market',
        badge: 'Pro',
        isPro: true,
        description: 'FII/DII, sectors, breadth',
      },
      {
        id: 'sectors',
        label: 'Sectors',
        icon: Layers,
        path: '/sectors',
        badge: 'Pro',
        isPro: true,
        description: 'Sectoral indices & stocks by sector',
      },
    ],
  },
  {
    label: 'AI & Automation',
    items: [
      {
        id: 'ai-agent',
        label: 'AI Agent',
        icon: Brain,
        path: '/ai-agent',
        badge: 'New',
        badgeColor: 'cyan',
        isPro: true,
        description: 'Self-thinking autonomous trading',
      },
      {
        id: 'algo',
        label: 'Algo Trading',
        icon: Bot,
        path: '/algo',
        badge: 'Live',
        badgeColor: 'live',
        isPro: true,
        description: 'AI bots that trade for you',
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      {
        id: 'ltp-calculator',
        label: 'LTP Calculator',
        icon: Target,
        path: '/ltp-calculator',
        badge: 'New',
        badgeColor: 'cyan',
        description: 'P&L, Option Chain, COA Analysis',
      },
      {
        id: 'trade-finder',
        label: 'Trade Finder',
        icon: Zap,
        path: '/trade-finder',
        badge: 'New',
        badgeColor: 'cyan',
        description: 'Auto strategy suggestions from OI data',
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
      {
        id: 'watchlist',
        label: 'Watchlist',
        icon: Star,
        path: '/watchlist',
        description: 'Track favorite stocks',
      },
    ],
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
        'group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200',
        'hover:bg-white/[0.06]',
        isActive && !isLocked && 'bg-primary/10 text-primary',
        isLocked && 'opacity-60'
      )}
    >
      {/* Active Indicator */}
      {isActive && !isLocked && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 w-1 h-5 bg-gradient-to-b from-primary to-primary/60 rounded-full shadow-sm shadow-primary/30"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      
      {/* Icon */}
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200',
        isActive ? 'bg-primary/15 shadow-sm shadow-primary/10' : 'group-hover:bg-white/[0.05]'
      )}>
        <item.icon className={cn(
          'w-4 h-4 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )} />
      </div>
      
      {/* Label */}
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className={cn(
              'text-[13px] font-medium whitespace-nowrap overflow-hidden',
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
            'ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-1 border',
            item.badge === 'Pro' && isLocked && 'bg-amber-500/15 text-amber-400 border-amber-500/25',
            item.badge === 'Pro' && !isLocked && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
            item.badgeColor === 'cyan' && 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
            item.badgeColor === 'emerald' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
            item.badgeColor === 'live' && 'bg-green-500/15 text-green-400 border-green-500/25 animate-pulse'
          )}
        >
          {isLocked && <Lock className="w-2.5 h-2.5" />}
          {item.badgeColor === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />}
          {item.badge}
        </motion.span>
      )}
      
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-2xl shadow-black/30">
          <p className="font-medium text-sm">{item.label}</p>
          {item.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
          )}
          {item.badge && (
            <span className={cn(
              'inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded border',
              item.badge === 'Pro' && 'bg-amber-500/15 text-amber-400 border-amber-500/25',
              item.badgeColor === 'cyan' && 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
              item.badgeColor === 'emerald' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
              item.badgeColor === 'live' && 'bg-green-500/15 text-green-400 border-green-500/25'
            )}>{item.badge}</span>
          )}
        </div>
      )}
    </NavLink>
  );
};

// Main Sidebar Component
const sidebarScrollCSS = `
.sidebar-scroll::-webkit-scrollbar { width: 3px; }
.sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
.sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
`;

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(() => storage.get('sidebarCollapsed', false));
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    storage.set('sidebarCollapsed', collapsed);
    // Dispatch custom event so PageLayout can sync without polling
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed } }));
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
    
    // Also check periodically in case of same-tab changes (60s is plenty)
    const interval = setInterval(() => { if (!document.hidden) updateStatus(); }, 60000);
    
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
        'border-r border-border',
        'bg-background/80 backdrop-blur-xl'
      )}
    >
      <style>{sidebarScrollCSS}</style>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
          {/* Logo with glow ring */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 blur-md opacity-60 group-hover:opacity-90 transition-opacity" />
            <img 
              src="/logo.png" 
              alt="Money Saarthi" 
              className="relative w-10 h-10 object-contain rounded-xl ring-1 ring-white/10 group-hover:ring-amber-500/30 transition-all duration-300"
              style={{ background: 'transparent' }}
            />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="font-extrabold text-base tracking-tight leading-tight bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 bg-clip-text text-transparent">
                  Money Saarthi
                </h1>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="px-1.5 py-[1px] rounded text-[9px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/20 tracking-wide">
                    AI
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
                    Market Intelligence
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0 sidebar-scroll">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx}>
            {/* Section divider + label */}
            {section.label && !collapsed && (
              <div className="flex items-center gap-2 pt-3 pb-1 px-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{section.label}</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
            )}
            {section.label && collapsed && (
              <div className="my-2 mx-3 h-px bg-white/[0.06]" />
            )}
            {section.items.map((item) => (
              <NavItem key={item.id} item={item} collapsed={collapsed} hasPro={hasPro} />
            ))}
          </div>
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
      <div className="border-t border-white/[0.06] py-2 px-2.5 space-y-0">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.id} item={item} collapsed={collapsed} />
        ))}
        
        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'group relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg',
            'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
            'transition-all duration-200'
          )}
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center group-hover:bg-white/[0.05] transition-all">
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
          {collapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap shadow-2xl shadow-black/30">
              <p className="font-medium text-sm">Collapse</p>
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
