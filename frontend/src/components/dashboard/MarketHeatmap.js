// Market Heatmap — Card grid of F&O stocks (Research360 style)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { cn, fetchAPI } from '../../lib/utils';

/* ─── NIFTY 50 approximate weightages (%) ─── */
const NIFTY_WEIGHTS = {
  HDFCBANK: 13.1, RELIANCE: 9.5, ICICIBANK: 8.1, INFY: 6.2, TCS: 4.8,
  BHARTIARTL: 4.1, LT: 3.9, ITC: 3.8, SBIN: 3.2, KOTAKBANK: 3.1,
  AXISBANK: 2.9, BAJFINANCE: 2.6, HINDUNILVR: 2.5, MARUTI: 1.9, SUNPHARMA: 1.8,
  TATAMOTORS: 1.7, HCLTECH: 1.7, NTPC: 1.6, TITAN: 1.5, ONGC: 1.4,
  POWERGRID: 1.4, ADANIENT: 1.3, ADANIPORTS: 1.3, ULTRACEMCO: 1.2, ASIANPAINT: 1.1,
  TATASTEEL: 1.1, WIPRO: 1.0, COALINDIA: 1.0, BAJAJFINSV: 1.0, JSWSTEEL: 0.9,
  NESTLEIND: 0.9, DRREDDY: 0.9, TECHM: 0.8, HINDALCO: 0.8, M_M: 0.8,
  INDUSINDBK: 0.8, CIPLA: 0.8, GRASIM: 0.7, SBILIFE: 0.7, BRITANNIA: 0.7,
  HDFCLIFE: 0.7, APOLLOHOSP: 0.7, DIVISLAB: 0.5, EICHERMOT: 0.5, HEROMOTOCO: 0.5,
  TATACONSUM: 0.5, BAJAJ_AUTO: 0.5, BPCL: 0.5, SHRIRAMFIN: 0.4, LTIM: 0.4,
  // Extra F&O heavyweights
  BANKBARODA: 0.4, VEDL: 0.3, TRENT: 0.3, ZOMATO: 0.3, PNB: 0.3,
  HAL: 0.3, BEL: 0.3, IRCTC: 0.3, PIIND: 0.3, VOLTAS: 0.3,
  BANDHANBNK: 0.2, IDFCFIRSTB: 0.2, MUTHOOTFIN: 0.2, BIOCON: 0.2,
  TATAPOWER: 0.2, DLF: 0.2, PEL: 0.2, SAIL: 0.2, NMDC: 0.2,
  MCX: 0.2, LICHSGFIN: 0.2, CANBK: 0.2, MRF: 0.2, PAGEIND: 0.2,
};

/* Also check with M&M variant */
const getWeight = (sym) => {
  if (NIFTY_WEIGHTS[sym]) return NIFTY_WEIGHTS[sym];
  // Handle M&M → M_M mapping
  const cleaned = sym.replace(/&/g, '_').replace(/-/g, '_');
  if (NIFTY_WEIGHTS[cleaned]) return NIFTY_WEIGHTS[cleaned];
  return 0.15; // default small weight for unlisted F&O stocks
};

/* ─── No multi-span — uniform compact cards ─── */

/* ─── Color helpers ─── */
const getCardColors = (pct) => {
  if (pct >= 3)    return { bg: 'from-emerald-600/30 to-emerald-700/20', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' };
  if (pct >= 1.5)  return { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/5' };
  if (pct >= 0.5)  return { bg: 'from-green-500/15 to-green-600/8', border: 'border-green-500/20', text: 'text-green-400', glow: '' };
  if (pct >= 0)    return { bg: 'from-green-500/8 to-green-600/4', border: 'border-green-500/10', text: 'text-green-300', glow: '' };
  if (pct >= -0.5) return { bg: 'from-rose-500/8 to-rose-600/4', border: 'border-rose-500/10', text: 'text-rose-300', glow: '' };
  if (pct >= -1.5) return { bg: 'from-rose-500/15 to-rose-600/8', border: 'border-rose-500/20', text: 'text-rose-400', glow: '' };
  if (pct >= -3)   return { bg: 'from-rose-500/20 to-rose-600/10', border: 'border-rose-500/20', text: 'text-rose-400', glow: 'shadow-rose-500/5' };
  return { bg: 'from-red-600/30 to-red-700/20', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-red-500/10' };
};

const getAccentBar = (pct) => {
  if (pct >= 2) return 'bg-emerald-400';
  if (pct >= 0) return 'bg-green-400';
  if (pct >= -2) return 'bg-rose-400';
  return 'bg-red-400';
};

/* ─── Compact Stock Card ─── */
const StockCard = ({ stock, weight, index }) => {
  const pct = stock.price_change ?? 0;
  const isUp = pct >= 0;
  const colors = getCardColors(pct);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.01, type: 'spring', stiffness: 320, damping: 26 }}
      className={cn(
        'relative group cursor-pointer rounded-lg border overflow-hidden',
        'bg-gradient-to-br backdrop-blur-sm',
        'hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
        colors.bg, colors.border, colors.glow
      )}
      onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
    >
      {/* Top accent bar */}
      <div className={cn('absolute top-0 inset-x-0 h-[2px]', getAccentBar(pct))} />

      {/* Content — compact */}
      <div className="px-2.5 py-2 flex flex-col gap-0.5">
        {/* Symbol row */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold tracking-tight text-foreground/90 truncate">
            {stock.symbol}
          </span>
          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
        </div>

        {/* Price + Change on same row */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-foreground/70">
            ₹{stock.price?.toFixed(stock.price >= 1000 ? 0 : 2)}
          </span>
          <span className={cn(
            'flex items-center gap-0.5 text-[10px] font-bold',
            colors.text
          )}>
            {isUp ? <TrendingUp className="w-2.5 h-2.5 flex-shrink-0" /> : <TrendingDown className="w-2.5 h-2.5 flex-shrink-0" />}
            {isUp ? '+' : ''}{pct.toFixed(2)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const MarketHeatmap = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | gainers | losers

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await fetchAPI('/tools/fno-heatmap');
        setStocks(res?.stocks || []);
      } catch (err) {
        console.error('Heatmap error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmap();
    // Remove manual polling - let React Query handle refetching
  }, []);

  /* Sort by day performance — top movers first based on market direction */
  const sortedStocks = useMemo(() => {
    let filtered = stocks.filter(s => s.symbol && s.price_change != null);
    if (filter === 'gainers') filtered = filtered.filter(s => (s.price_change ?? 0) > 0);
    if (filter === 'losers') filtered = filtered.filter(s => (s.price_change ?? 0) < 0);

    const mapped = filtered.map(s => ({ ...s, weight: getWeight(s.symbol) }));

    // Determine market direction from average change
    const avgChange = mapped.length > 0
      ? mapped.reduce((sum, s) => sum + (s.price_change ?? 0), 0) / mapped.length
      : 0;

    // Sort: if market up → biggest gainers first; if down → biggest losers first
    mapped.sort((a, b) => {
      if (avgChange >= 0) return (b.price_change ?? 0) - (a.price_change ?? 0);
      return (a.price_change ?? 0) - (b.price_change ?? 0);
    });

    return mapped.slice(0, 50);
  }, [stocks, filter]);

  const gainers = stocks.filter(s => (s.price_change ?? 0) > 0).length;
  const losers = stocks.filter(s => (s.price_change ?? 0) < 0).length;

  if (loading) return <div className="h-[350px] skeleton rounded-2xl" />;

  if (!sortedStocks.length) {
    return (
      <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm p-8 text-center text-muted-foreground text-sm">
        Heatmap data unavailable
      </div>
    );
  }

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: `Gainers (${gainers})` },
    { key: 'losers', label: `Losers (${losers})` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative rounded-2xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Accent strip */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 opacity-80" />

      {/* Header with filter pills */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">{gainers} Gaining</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-muted-foreground">{losers} Declining</span>
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                filter === f.key
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid — compact */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 auto-rows-auto">
          <AnimatePresence mode="popLayout">
            {sortedStocks.map((stock, i) => (
              <StockCard key={stock.symbol} stock={stock} weight={stock.weight} index={i} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer note */}
      <div className="px-4 pb-2.5 flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span>Sorted by day performance · Click to open chart</span>
        <span>{sortedStocks.length} stocks</span>
      </div>
    </motion.div>
  );
};

export default MarketHeatmap;
