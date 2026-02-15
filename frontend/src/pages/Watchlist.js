// Watchlist Page - Track favorite stocks with live prices
import { useState, useEffect, useCallback, useRef } from 'react';
import SEO from '../components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Plus, Trash2, TrendingUp, TrendingDown,
  Search, RefreshCw, ArrowUpRight, ArrowDownRight,
  Eye, X, AlertCircle, Loader2, Minus
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge
} from '../components/ui';
import { cn, fetchAPI, formatINR, getChangeColor } from '../lib/utils';
import { fetchWithAuth } from '../config/api';

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
const POPULAR_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK',
  'LT', 'AXISBANK', 'BAJFINANCE', 'MARUTI', 'TITAN',
  'SUNPHARMA', 'ASIANPAINT', 'HCLTECH', 'WIPRO', 'TATAMOTORS',
  'TATASTEEL', 'NTPC', 'POWERGRID', 'ULTRACEMCO', 'NESTLEIND',
  'M&M', 'JSWSTEEL', 'ADANIENT', 'ADANIPORTS', 'COALINDIA',
  'BAJAJFINSV', 'GRASIM', 'TECHM', 'INDUSINDBK', 'HINDALCO',
  'DRREDDY', 'CIPLA', 'BPCL', 'ONGC', 'DIVISLAB',
  'HEROMOTOCO', 'EICHERMOT', 'APOLLOHOSP', 'TATACONSUM', 'BRITANNIA',
  'NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'INDIA VIX'
];

const StockSearch = ({ onAdd, existingSymbols }) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const filteredPopular = POPULAR_STOCKS.filter(
    s => s.toLowerCase().includes(query.toLowerCase()) && !existingSymbols.includes(s)
  ).slice(0, 8);

  // Search backend for stocks
  useEffect(() => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await fetchAPI(`/nse/search?q=${encodeURIComponent(query)}`);
        const results = (data?.results || data?.data || data || [])
          .filter(r => !existingSymbols.includes(r.symbol || r))
          .slice(0, 10);
        setSearchResults(results);
      } catch {
        // Fallback to popular stocks filter
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, existingSymbols]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const suggestions = searchResults.length > 0
    ? searchResults.map(r => typeof r === 'string' ? r : r.symbol || r.name)
    : filteredPopular;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search stocks to add... (e.g. RELIANCE, TCS)"
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {focused && (query || suggestions.length > 0) && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto"
          >
            {!query && (
              <p className="px-3 py-2 text-xs text-muted-foreground font-medium border-b border-border">
                Popular Stocks
              </p>
            )}
            {suggestions.length === 0 && query && !searching && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                No stocks found for "{query}"
              </p>
            )}
            {suggestions.map((symbol) => (
              <button
                key={symbol}
                onClick={() => {
                  onAdd(symbol);
                  setQuery('');
                  setFocused(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left"
              >
                <span className="text-sm font-medium">{symbol}</span>
                <Plus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST ITEM ROW
// ═══════════════════════════════════════════════════════════════════════════════
const WatchlistRow = ({ item, onRemove, isRemoving }) => {
  const price = parseFloat(String(item.price).replace(/[₹,]/g, '')) || 0;
  const changeStr = String(item.change || '0');
  const changeVal = parseFloat(changeStr.replace(/[%+]/g, '')) || 0;
  const isPositive = !changeStr.startsWith('-') && changeVal > 0;
  const isNegative = changeStr.startsWith('-') || changeVal < 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      className="group flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/[0.03] transition-colors"
    >
      {/* Symbol & Name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0',
          isPositive ? 'bg-emerald-500/10 text-emerald-500' :
          isNegative ? 'bg-red-500/10 text-red-500' :
          'bg-muted text-muted-foreground'
        )}>
          {item.symbol?.slice(0, 2) || '??'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{item.symbol}</p>
          <p className="text-xs text-muted-foreground">NSE</p>
        </div>
      </div>

      {/* Price */}
      <div className="text-right mr-4">
        <p className="font-semibold text-sm tabular-nums">
          {price > 0 ? formatINR(price) : item.price || '—'}
        </p>
        <div className={cn(
          'flex items-center justify-end gap-1 text-xs font-medium',
          isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> :
           isNegative ? <ArrowDownRight className="w-3 h-3" /> :
           <Minus className="w-3 h-3" />}
          <span>{item.change || '0.00%'}</span>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(item.id)}
        disabled={isRemoving}
        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
        title="Remove from watchlist"
      >
        {isRemoving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST SKELETON
// ═══════════════════════════════════════════════════════════════════════════════
const WatchlistSkeleton = () => (
  <div className="space-y-0">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-3 w-12 rounded" />
          </div>
        </div>
        <div className="space-y-1.5 text-right">
          <div className="skeleton h-4 w-20 rounded ml-auto" />
          <div className="skeleton h-3 w-14 rounded ml-auto" />
        </div>
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════
const EmptyWatchlist = () => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
      <Eye className="w-10 h-10 text-primary" />
    </div>
    <h3 className="text-lg font-semibold mb-2">Your watchlist is empty</h3>
    <p className="text-muted-foreground text-sm text-center max-w-sm">
      Search and add stocks above to start tracking their prices in real-time.
    </p>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET SUMMARY BAR
// ═══════════════════════════════════════════════════════════════════════════════
const MarketSummary = ({ items }) => {
  const gainers = items.filter(i => {
    const c = parseFloat(String(i.change).replace(/[%+]/g, ''));
    return !String(i.change).startsWith('-') && c > 0;
  }).length;
  const losers = items.filter(i => String(i.change).startsWith('-')).length;
  const unchanged = items.length - gainers - losers;

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <Card className="p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">Gainers</p>
        <p className="text-xl font-bold text-emerald-500">{gainers}</p>
      </Card>
      <Card className="p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">Losers</p>
        <p className="text-xl font-bold text-red-500">{losers}</p>
      </Card>
      <Card className="p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">Unchanged</p>
        <p className="text-xl font-bold text-muted-foreground">{unchanged}</p>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WATCHLIST PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const Watchlist = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch watchlist from backend
  const fetchWatchlist = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/watchlist');
      if (!response.ok) throw new Error('Failed to load watchlist');
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) setError(err.message);
      // If backend fails, try localStorage fallback
      const local = JSON.parse(localStorage.getItem('ms_watchlist') || '[]');
      if (local.length > 0 && items.length === 0) setItems(local);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    // Refresh prices every 30s
    const interval = setInterval(() => {
      if (!document.hidden) fetchWatchlist(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  // Persist to localStorage as backup
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('ms_watchlist', JSON.stringify(items));
    }
  }, [items]);

  // Add stock to watchlist
  const handleAdd = async (symbol) => {
    setAdding(true);
    try {
      const response = await fetchWithAuth('/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to add stock');
      }
      const newItem = await response.json();
      setItems(prev => [newItem, ...prev]);
    } catch (err) {
      // Optimistic add with local data
      const localItem = {
        id: `local_${Date.now()}`,
        symbol,
        price: '—',
        change: '0.00%',
        timestamp: new Date().toISOString(),
      };
      setItems(prev => [localItem, ...prev]);
    } finally {
      setAdding(false);
    }
  };

  // Remove stock from watchlist
  const handleRemove = async (id) => {
    setRemoving(id);
    try {
      await fetchWithAuth(`/watchlist/${id}`, { method: 'DELETE' });
    } catch {
      // Remove locally even if backend fails
    }
    setItems(prev => prev.filter(i => i.id !== id));
    setRemoving(null);
  };

  const existingSymbols = items.map(i => i.symbol);

  return (
    <PageLayout>
      <SEO title="Watchlist - Money Saarthi" description="Track your favorite stocks with live prices" />
      <PageHeader
        title="Watchlist"
        description="Track your favorite stocks with live price updates"
        badge="Live"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchWatchlist(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="mb-6">
        <StockSearch onAdd={handleAdd} existingSymbols={existingSymbols} />
        {adding && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Adding stock...
          </p>
        )}
      </div>

      {/* Market Summary */}
      <MarketSummary items={items} />

      {/* Watchlist Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">My Stocks</CardTitle>
            {items.length > 0 && (
              <Badge variant="outline" className="ml-2">{items.length}</Badge>
            )}
          </div>
          {refreshing && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <WatchlistSkeleton />
          ) : error && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchWatchlist()}>
                Try Again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <EmptyWatchlist />
          ) : (
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <WatchlistRow
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  isRemoving={removing === item.id}
                />
              ))}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Prices auto-refresh every 30 seconds during market hours
        </p>
      )}
    </PageLayout>
  );
};

export default Watchlist;
