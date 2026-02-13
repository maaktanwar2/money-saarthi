// Header Component - Top navigation bar with market info
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Bell, Sun, Moon, User, Menu,
  TrendingUp, TrendingDown, Activity, LogOut, Coins
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
    const interval = setInterval(fetchIndices, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="h-6 w-full skeleton rounded" />;
  }

  // Duplicate for seamless scroll
  const tickerItems = [...indices, ...indices];

  return (
    <div className="relative overflow-hidden flex-1 mx-4">
      <div className="ticker-wrapper">
        <div className="ticker-content animate-ticker flex items-center gap-8">
          {tickerItems.map((index, i) => (
            <div
              key={`${index.symbol || index.name}-${i}`}
              className="flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <span className="text-muted-foreground font-medium">{index.symbol || index.name}</span>
              <span className="font-semibold">{formatNumber(index.last || index.lastPrice, { decimals: index.last < 100 ? 2 : 0 })}</span>
              <span className={cn(
                'flex items-center text-xs font-semibold px-1.5 py-0.5 rounded',
                (index.pChange || 0) >= 0 ? 'text-bullish bg-bullish/10' : 'text-bearish bg-bearish/10'
              )}>
                {(index.pChange || 0) >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {(index.pChange || 0) >= 0 ? '+' : ''}{(index.pChange || 0).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* CSS for ticker animation */}
      <style>{`
        .ticker-wrapper {
          overflow: hidden;
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
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

  // Fetch token balance
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
  }, []);

  // Get user info
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('ms_user') || '{}'); } catch { return {}; }
  })();
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const photoURL = user.photoURL || user.picture || null;

  const handleLogout = () => {
    localStorage.removeItem('ms_user');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    window.location.href = '/login';
  };

  return (
    <header className="h-16 border-b border-white/[0.08] bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-4 gap-2">
        {/* Left: Mobile Menu + Market Status */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
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
        <div className="flex items-center gap-1 shrink-0">
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
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all"
          >
            {theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px]" />
            ) : (
              <Moon className="w-[18px] h-[18px]" />
            )}
          </button>

          {/* Token Balance */}
          {tokenBalance !== null && (
            <button
              onClick={() => navigate('/profile')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
              title="AI Tokens - Click to recharge"
            >
              <Coins className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-bold text-violet-400">{tokenBalance}</span>
            </button>
          )}

          {/* Notifications */}
          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all relative">
            <Bell className="w-[18px] h-[18px]" />
            {notifications > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                {notifications}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10 mx-1.5" />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-white/[0.06] transition-all"
            >
              {photoURL ? (
                <img src={photoURL} alt="" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium leading-tight truncate max-w-[100px]">{user.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {user.subscription?.plan === 'pro' ? '⭐ Pro' : 'Free'}
                </p>
              </div>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute right-0 mt-2 w-56 z-50 rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                >
                  <div className="p-3 border-b border-white/[0.06]">
                    <p className="text-sm font-semibold truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email || ''}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-white/[0.06] transition-colors"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      Profile
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
