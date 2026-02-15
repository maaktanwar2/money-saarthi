// Header Component - Compact top bar with market ticker
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Bell, Sun, Moon, User, Menu,
  TrendingUp, TrendingDown, LogOut, Coins, Clock
} from 'lucide-react';
import { cn, formatNumber, getMarketSession, fetchAPI } from '../lib/utils';
import { Button, Input, Badge } from './ui';
import { useTheme } from './ThemeProvider';

// Market Ticker Component — scrolling index tape
const MarketTicker = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await fetchAPI('/nse/indices');
        const indicesArray = data?.all_indices || data?.data || [];
        if (indicesArray.length > 0) {
          setIndices(indicesArray.slice(0, 8));
        }
      } catch (error) {
        setIndices([
          { symbol: 'NIFTY 50', last: 25727, change: 639, pChange: 2.55 },
          { symbol: 'NIFTY BANK', last: 60041, change: 1422, pChange: 2.43 },
          { symbol: 'INDIA VIX', last: 12.9, change: -0.97, pChange: -6.99 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchIndices();
    const interval = setInterval(fetchIndices, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="h-5 w-48 skeleton rounded" />;
  }

  const tickerItems = [...indices, ...indices];

  return (
    <div className="relative overflow-hidden flex-1 mx-3">
      <div className="ticker-wrapper">
        <div className="ticker-content animate-ticker flex items-center gap-6">
          {tickerItems.map((index, i) => (
            <div
              key={`${index.symbol || index.name}-${i}`}
              className="flex items-center gap-1.5 text-xs whitespace-nowrap"
            >
              <span className="text-foreground-muted font-medium">{index.symbol || index.name}</span>
              <span className="font-semibold tabular-nums">{formatNumber(index.last || index.lastPrice, { decimals: (index.last || 0) < 100 ? 2 : 0 })}</span>
              <span className={cn(
                'flex items-center gap-0.5 font-semibold px-1 py-px rounded text-2xs',
                (index.pChange || 0) >= 0 ? 'text-bullish bg-bullish/8' : 'text-bearish bg-bearish/8'
              )}>
                {(index.pChange || 0) >= 0 ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5" />
                )}
                {(index.pChange || 0) >= 0 ? '+' : ''}{(index.pChange || 0).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        .ticker-wrapper { overflow: hidden; }
        .animate-ticker { animation: ticker 35s linear infinite; }
        .animate-ticker:hover { animation-play-state: paused; }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
};

// Market Clock pill
const MarketClock = () => {
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const interval = setInterval(() => setSession(getMarketSession()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-1/70 border border-border/50">
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        session.status === 'open' ? 'bg-bullish animate-pulse-dot' : 
        session.status === 'pre-market' ? 'bg-amber-500 animate-pulse-dot' : 'bg-foreground-faint'
      )} />
      <span className="text-2xs font-medium text-foreground-secondary whitespace-nowrap">
        {session.label}
      </span>
    </div>
  );
};

// Main Header Component
export const Header = ({ onMenuClick }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications] = useState(3);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(null);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('ms_user') || '{}'); } catch { return {}; }
  })();
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const photoURL = user.photoURL || user.picture || null;

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const userId = user?.email || 'anonymous';
        const data = await fetchAPI('/ai/tokens/balance', { headers: { 'X-User-Id': userId } });
        setTokenBalance(data?.unlimited ? '∞' : (data?.balance ?? null));
      } catch (e) { /* ignore */ }
    };
    loadTokens();
    const interval = setInterval(loadTokens, 60000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('ms_user');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    window.location.href = '/login';
  }, []);

  return (
    <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-3 gap-2">
        {/* Left: Mobile Menu + Market Status */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-foreground-secondary hover:text-foreground hover:bg-surface-1 transition-colors"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          <MarketClock />
        </div>
        
        {/* Center: Running Ticker */}
        <div className="hidden md:flex flex-1 min-w-0">
          <MarketTicker />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Search */}
          <div className="relative">
            <AnimatePresence>
              {searchOpen ? (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                >
                  <Input
                    placeholder="Search stocks, tools..."
                    autoFocus
                    onBlur={() => setSearchOpen(false)}
                    className="pr-8 h-8 rounded-lg bg-surface-1 border-border/50 text-sm"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
                </motion.div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-1/70 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-1/70 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Token Balance */}
          {tokenBalance !== null && (
            <button
              onClick={() => navigate('/profile')}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/15 hover:bg-violet-500/15 transition-colors"
              title="AI Tokens"
            >
              <Coins className="w-3 h-3 text-violet-400" />
              <span className="text-2xs font-bold text-violet-400 tabular-nums">{tokenBalance}</span>
            </button>
          )}

          {/* Notifications */}
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-1/70 transition-colors relative">
            <Bell className="w-4 h-4" />
            {notifications > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {notifications}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-border/60 mx-1" />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 pl-0.5 pr-1.5 py-0.5 rounded-lg hover:bg-surface-1/70 transition-colors"
            >
              {photoURL ? (
                <img src={photoURL} alt="" className="w-7 h-7 rounded-md object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <span className="text-2xs font-bold text-white">{initials}</span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium leading-tight truncate max-w-[80px]">{user.name || 'User'}</p>
                <p className="text-2xs text-foreground-muted leading-tight">
                  {user.subscription?.plan === 'pro' ? '⭐ Pro' : 'Free'}
                </p>
              </div>
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    className="absolute right-0 mt-1.5 w-52 z-50 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-elevated overflow-hidden"
                  >
                    <div className="p-3 border-b border-border/50">
                      <p className="text-sm font-semibold truncate">{user.name || 'User'}</p>
                      <p className="text-xs text-foreground-muted truncate">{user.email || ''}</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-surface-1 transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-foreground-muted" />
                        Profile
                      </button>
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
