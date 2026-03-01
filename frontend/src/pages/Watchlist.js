// Watchlist Page - Track favorite stocks with live prices
import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import { alpha, useTheme } from '@mui/material/styles';
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
import { fetchAPI, formatINR } from '../lib/utils';
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
  const theme = useTheme();

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
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          component="span"
          sx={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            color: 'text.secondary',
            zIndex: 1,
          }}
        >
          <Search style={{ width: 16, height: 16 }} />
        </Box>
        <Box
          component="input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search stocks to add... (e.g. RELIANCE, TCS)"
          sx={{
            width: '100%',
            pl: 5,
            pr: 2,
            py: 1.5,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 3,
            fontSize: '0.875rem',
            color: 'text.primary',
            outline: 'none',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            '&:focus': {
              borderColor: 'primary.main',
              boxShadow: (t) => `0 0 0 2px ${alpha(t.palette.primary.main, 0.25)}`,
            },
            '&::placeholder': {
              color: 'text.secondary',
              opacity: 0.7,
            },
          }}
        />
        {searching && (
          <Box
            sx={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              color: 'text.secondary',
            }}
          >
            <CircularProgress size={16} color="inherit" />
          </Box>
        )}
      </Box>

      <AnimatePresence>
        {focused && (query || suggestions.length > 0) && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{ position: 'absolute', top: '100%', marginTop: 4, width: '100%', zIndex: 50 }}
          >
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                boxShadow: 24,
                maxHeight: 256,
                overflowY: 'auto',
              }}
            >
              {!query && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 1.5,
                    py: 1,
                    fontWeight: 500,
                    color: 'text.secondary',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  Popular Stocks
                </Typography>
              )}
              {suggestions.length === 0 && query && !searching && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 1.5, py: 2, textAlign: 'center' }}
                >
                  No stocks found for &quot;{query}&quot;
                </Typography>
              )}
              {suggestions.map((symbol) => (
                <Box
                  key={symbol}
                  component="button"
                  onClick={() => {
                    onAdd(symbol);
                    setQuery('');
                    setFocused(false);
                  }}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1.25,
                    bgcolor: 'transparent',
                    border: 'none',
                    color: 'text.primary',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.06) },
                    transition: 'background-color 0.15s',
                  }}
                >
                  <Typography variant="body2" fontWeight={500}>{symbol}</Typography>
                  <Plus style={{ width: 16, height: 16, color: theme.palette.primary.main }} />
                </Box>
              ))}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
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
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: (t) => alpha(t.palette.divider, 0.5),
          '&:last-child': { borderBottom: 0 },
          '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.03) },
          transition: 'background-color 0.15s',
          '& .remove-btn': { opacity: 0, transition: 'all 0.2s' },
          '&:hover .remove-btn': { opacity: 1 },
        }}
      >
        {/* Symbol & Name */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0,
              ...(isPositive
                ? { bgcolor: (t) => alpha(t.palette.success.main, 0.1), color: 'success.main' }
                : isNegative
                  ? { bgcolor: (t) => alpha(t.palette.error.main, 0.1), color: 'error.main' }
                  : { bgcolor: (t) => alpha(t.palette.text.primary, 0.08), color: 'text.secondary' }),
            }}
          >
            {item.symbol?.slice(0, 2) || '??'}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {item.symbol}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              NSE
            </Typography>
          </Box>
        </Stack>

        {/* Price */}
        <Box sx={{ textAlign: 'right', mr: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {price > 0 ? formatINR(price) : item.price || '\u2014'}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="flex-end"
            spacing={0.5}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: isPositive ? 'success.main' : isNegative ? 'error.main' : 'text.secondary',
            }}
          >
            {isPositive ? <ArrowUpRight style={{ width: 12, height: 12 }} /> :
             isNegative ? <ArrowDownRight style={{ width: 12, height: 12 }} /> :
             <Minus style={{ width: 12, height: 12 }} />}
            <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 'inherit' }}>
              {item.change || '0.00%'}
            </Typography>
          </Stack>
        </Box>

        {/* Remove Button */}
        <IconButton
          className="remove-btn"
          onClick={() => onRemove(item.id)}
          disabled={isRemoving}
          size="small"
          title="Remove from watchlist"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.error.main, 0.1),
              color: 'error.main',
            },
          }}
        >
          {isRemoving ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <Trash2 style={{ width: 16, height: 16 }} />
          )}
        </IconButton>
      </Box>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST SKELETON
// ═══════════════════════════════════════════════════════════════════════════════
const WatchlistSkeleton = () => (
  <Box>
    {[...Array(5)].map((_, i) => (
      <Box
        key={i}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: (t) => alpha(t.palette.divider, 0.5),
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: 3 }} />
          <Stack spacing={0.75}>
            <Skeleton variant="rounded" width={96} height={16} />
            <Skeleton variant="rounded" width={48} height={12} />
          </Stack>
        </Stack>
        <Stack spacing={0.75} alignItems="flex-end">
          <Skeleton variant="rounded" width={80} height={16} />
          <Skeleton variant="rounded" width={56} height={12} />
        </Stack>
      </Box>
    ))}
  </Box>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════
const EmptyWatchlist = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 8,
      px: 2,
    }}
  >
    <Box
      sx={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2,
        color: 'primary.main',
      }}
    >
      <Eye style={{ width: 40, height: 40, color: 'currentColor' }} />
    </Box>
    <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
      Your watchlist is empty
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 360 }}>
      Search and add stocks above to start tracking their prices in real-time.
    </Typography>
  </Box>
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
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
      <Card sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Gainers
        </Typography>
        <Typography variant="h5" fontWeight={700} color="success.main">
          {gainers}
        </Typography>
      </Card>
      <Card sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Losers
        </Typography>
        <Typography variant="h5" fontWeight={700} color="error.main">
          {losers}
        </Typography>
      </Card>
      <Card sx={{ p: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Unchanged
        </Typography>
        <Typography variant="h5" fontWeight={700} color="text.secondary">
          {unchanged}
        </Typography>
      </Card>
    </Box>
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
  const theme = useTheme();

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
        price: '\u2014',
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
            sx={{
              ...(refreshing && {
                '@keyframes spin': {
                  from: { transform: 'rotate(0deg)' },
                  to: { transform: 'rotate(360deg)' },
                },
                '& svg:first-of-type': { animation: 'spin 1s linear infinite' },
              }),
            }}
          >
            <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} />
            Refresh
          </Button>
        }
      />

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <StockSearch onAdd={handleAdd} existingSymbols={existingSymbols} />
        {adding && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
            <CircularProgress size={12} sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Adding stock...
            </Typography>
          </Stack>
        )}
      </Box>

      {/* Market Summary */}
      <MarketSummary items={items} />

      {/* Watchlist Card */}
      <Card>
        <CardHeader sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, p: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Star style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            <CardTitle>My Stocks</CardTitle>
            {items.length > 0 && (
              <Badge variant="outline">{items.length}</Badge>
            )}
          </Stack>
          {refreshing && (
            <CircularProgress size={16} sx={{ color: 'text.secondary' }} />
          )}
        </CardHeader>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <WatchlistSkeleton />
          ) : error && items.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                px: 2,
              }}
            >
              <AlertCircle style={{ width: 40, height: 40, color: theme.palette.error.main, marginBottom: 12 }} />
              <Typography variant="body2" color="error.main" sx={{ mb: 2 }}>
                {error}
              </Typography>
              <Button variant="outline" size="sm" onClick={() => fetchWatchlist()}>
                Try Again
              </Button>
            </Box>
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          Prices auto-refresh every 30 seconds during market hours
        </Typography>
      )}
    </PageLayout>
  );
};

export default Watchlist;
