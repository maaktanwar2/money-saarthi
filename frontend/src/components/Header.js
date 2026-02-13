// Header Component - Top navigation bar with market info
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Bell, Sun, Moon, User, Menu,
  TrendingUp, TrendingDown, Activity
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const marketSession = getMarketSession();

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
        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <div className="relative">
            {searchOpen ? (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="absolute right-0 top-1/2 -translate-y-1/2"
              >
                <Input
                  placeholder="Search stocks, tools..."
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                  className="pr-10"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </motion.div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-[10px] font-bold rounded-full flex items-center justify-center">
                {notifications}
              </span>
            )}
          </Button>

          {/* User Menu */}
          <Button variant="ghost" size="icon" className="ml-2">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
