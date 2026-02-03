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
        if (data?.data) {
          setIndices(data.data.slice(0, 5)); // Top 5 indices
        }
      } catch (error) {
        // Use fallback data
        setIndices([
          { name: 'NIFTY 50', last: 23850.5, change: 125.4, pChange: 0.53 },
          { name: 'BANK NIFTY', last: 51250.2, change: -85.6, pChange: -0.17 },
          { name: 'NIFTY IT', last: 35420.8, change: 280.5, pChange: 0.80 },
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
    return <div className="h-8 w-96 skeleton rounded" />;
  }

  return (
    <div className="flex items-center gap-6 overflow-hidden">
      {indices.map((index, i) => (
        <motion.div
          key={index.name}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-2 text-sm whitespace-nowrap"
        >
          <span className="text-muted-foreground">{index.name}</span>
          <span className="font-semibold">{formatNumber(index.last || index.lastPrice, { decimals: 0 })}</span>
          <span className={cn(
            'flex items-center text-xs font-medium',
            (index.change || index.pChange || 0) >= 0 ? 'text-bullish' : 'text-bearish'
          )}>
            {(index.change || index.pChange || 0) >= 0 ? (
              <TrendingUp className="w-3 h-3 mr-0.5" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-0.5" />
            )}
            {formatPercent(index.pChange || index.change)}
          </span>
        </motion.div>
      ))}
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
      <div className="h-full flex items-center justify-between px-6 gap-4">
        {/* Left: Mobile Menu + Market Ticker */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          {/* Market Status */}
          <div className="hidden sm:flex items-center gap-2">
            <Activity className={cn('w-4 h-4', marketSession.color)} />
            <span className={cn('text-xs font-medium', marketSession.color)}>
              {marketSession.label}
            </span>
          </div>
          
          {/* Market Ticker */}
          <div className="hidden md:block">
            <MarketTicker />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
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
