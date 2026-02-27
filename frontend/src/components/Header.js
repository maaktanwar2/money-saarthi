// Header Component - Top navigation bar with market info
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Bell, Sun, Moon, User, Menu,
  TrendingUp, TrendingDown, Activity, LogOut, Coins, Crown, Settings
} from 'lucide-react';
import { cn, formatNumber, formatPercent, getMarketSession, fetchAPI } from '../lib/utils';
import { Button, Input, Badge } from './ui';
import { useTheme } from './ThemeProvider';

// Market Ticker Component
const MarketTicker = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await fetchAPI('/nse/indices');
        const indicesArray = data?.all_indices || data?.data || [];
        if (indicesArray.length > 0) {
          setIndices(indicesArray.slice(0, 8)); // Top 8 indices for ticker
        }
      } catch (error) {
        // Use fallback data
        setIndices([
          { symbol: 'NIFTY 50', last: 25727, change: 639, pChange: 2.55 },
          { symbol: 'NIFTY BANK', last: 60041, change: 1422, pChange: 2.43 },
          { symbol: 'NIFTY IT', last: 35420, change: 280, pChange: 0.80 },
          { symbol: 'NIFTY MIDCAP 50', last: 17013, change: 464, pChange: 2.80 },
          { symbol: 'INDIA VIX', last: 12.9, change: -0.97, pChange: -6.99 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
    const interval = setInterval(() => { if (!document.hidden) fetchIndices(); }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="h-6 w-full skeleton rounded" />;
  }

  // Duplicate for seamless scroll
  const tickerItems = [...indices, ...indices];

  return (
    <div className="relative overflow-hidden flex-1 mx-3">
      {/* Left fade mask */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/95 to-transparent z-10 pointer-events-none" />
      {/* Right fade mask */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/95 to-transparent z-10 pointer-events-none" />

      <div className="ticker-wrapper">
        <div className="ticker-content animate-ticker flex items-center gap-5">
          {tickerItems.map((index, i) => {
            const pct = index.pChange || 0;
            const isUp = pct >= 0;
            return (
              <div
                key={`${index.symbol || index.name}-${i}`}
                className="flex items-center gap-1.5 text-[13px] whitespace-nowrap px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors"
              >
                <span className="font-semibold text-foreground/90">
                  {(index.symbol || index.name || '').replace('NIFTY ', '').replace('INDIA ', '')}
                </span>
                <span className="text-muted-foreground font-medium">
                  {formatNumber(index.last || index.lastPrice, { decimals: (index.last || 0) < 100 ? 2 : 0 })}
                </span>
                <span className={cn(
                  'flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md border',
                  isUp
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                )}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isUp ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* CSS for ticker animation */}
      <style>{`
        .ticker-wrapper {
          overflow: hidden;
        }
        .animate-ticker {
          animation: ticker 35s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

// Main Header Component
export const Header = ({ onMenuClick }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(null);
  const marketSession = getMarketSession();

  // Get user info (must be before useEffect that references it)
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('ms_user') || '{}'); } catch { return {}; }
  })();
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const photoURL = user.photoURL || user.picture || null;

  // Fetch token balance
  const userEmail = user?.email;
  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;
    const loadTokens = async () => {
      try {
        const data = await fetchAPI('/ai/tokens/balance', { headers: { 'X-User-Id': userEmail } });
        if (!cancelled) setTokenBalance(data?.unlimited ? '∞' : (data?.balance ?? null));
      } catch { /* ignore */ }
    };
    loadTokens();
    const interval = setInterval(() => { if (!document.hidden) loadTokens(); }, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userEmail]);

  const handleLogout = () => {
    localStorage.removeItem('ms_user');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur-xl sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-4 gap-2">
        {/* Left: Mobile Menu + Logo + Market Status */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Mobile logo — visible only on small screens when sidebar is hidden */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-500/25 to-orange-500/15 blur-sm" />
              <img 
                src="/logo.png" 
                alt="Money Saarthi" 
                className="relative w-8 h-8 object-contain rounded-lg ring-1 ring-white/10"
              />
            </div>
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 bg-clip-text text-transparent">
              Money Saarthi
            </span>
          </div>
          
          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className={cn(
              'w-2 h-2 rounded-full animate-pulse',
              marketSession.status === 'open' ? 'bg-bullish' : 
              marketSession.status === 'pre-market' ? 'bg-amber-500' : 'bg-muted-foreground'
            )} />
            <span className="text-xs font-semibold whitespace-nowrap">
              {marketSession.label}
            </span>
          </div>
        </div>
        
        {/* Center: Running Ticker Banner */}
        <div className="hidden md:flex flex-1 min-w-0">
          <MarketTicker />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Search */}
          <div className="relative">
            {searchOpen ? (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="absolute right-0 top-1/2 -translate-y-1/2"
              >
                <Input
                  placeholder="Search stocks, tools..."
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                  className="pr-10 h-9 rounded-xl bg-secondary/80 border-white/10"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </motion.div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search stocks and tools"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-all"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Token Balance */}
          {tokenBalance !== null && (
            <button
              onClick={() => navigate('/profile')}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/30 transition-all"
              title="AI Tokens"
            >
              <Coins className="w-3 h-3 text-violet-400" />
              <span className="text-[11px] font-bold text-violet-400">{tokenBalance}</span>
            </button>
          )}

          {/* Notifications */}
          <button
            aria-label="Notifications"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all relative"
          >
            <Bell className="w-4 h-4" />
            {notifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
                {notifications}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-7 bg-border/50 mx-1.5" />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 pl-0.5 pr-1.5 py-0.5 rounded-xl hover:bg-white/[0.04] transition-all group"
            >
              {/* Avatar with ring */}
              <div className="relative">
                {photoURL ? (
                  <img src={photoURL} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-primary/30 transition-all" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-2 ring-white/10 group-hover:ring-emerald-500/30 transition-all">
                    <span className="text-[11px] font-bold text-white">{initials}</span>
                  </div>
                )}
                {/* Pro indicator dot */}
                {user.subscription?.plan === 'pro' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 ring-2 ring-background flex items-center justify-center">
                    <Crown className="w-2 h-2 text-white" />
                  </span>
                )}
              </div>

              {/* Name + badge */}
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[12px] font-semibold leading-tight truncate max-w-[90px] text-foreground/90">
                  {(user.name || 'User').split(' ')[0]}
                </span>
                {user.subscription?.plan === 'pro' ? (
                  <span className="text-[9px] font-bold text-amber-400 leading-tight flex items-center gap-0.5">
                    <Crown className="w-2 h-2" /> PRO
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground leading-tight">Free</span>
                )}
              </div>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="absolute right-0 mt-2 w-60 z-50 rounded-2xl border border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden"
                >
                  {/* User card */}
                  <div className="p-4 border-b border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent">
                    <div className="flex items-center gap-3">
                      {photoURL ? (
                        <img src={photoURL} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-2 ring-white/10">
                          <span className="text-sm font-bold text-white">{initials}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{user.name || 'User'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email || ''}</p>
                      </div>
                    </div>
                    {/* Plan badge */}
                    {user.subscription?.plan === 'pro' && (
                      <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 w-fit">
                        <Crown className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-400">Pro Member</span>
                      </div>
                    )}
                    {/* Token balance in dropdown */}
                    {tokenBalance !== null && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 w-fit">
                        <Coins className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] font-bold text-violet-400">{tokenBalance} AI Tokens</span>
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-white/[0.06] transition-colors"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      Profile & Tokens
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-white/[0.06] transition-colors"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      Settings
                    </button>
                    <div className="my-1 h-px bg-white/[0.06]" />
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
