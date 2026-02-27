// Dashboard — Market Overview (Index Cards)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { Card } from '../ui';
import { cn, formatNumber, fetchAPI } from '../../lib/utils';

const MarketOverview = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/indices');
        const indicesArray = response?.all_indices || response?.data || [];
        if (indicesArray && indicesArray.length > 0) {
          const keySymbols = ['NIFTY 50', 'NIFTY BANK', 'NIFTY MIDCAP 50', 'NIFTY FIN SERVICE', 'INDIA VIX', 'SENSEX'];
          const keyIndices = keySymbols.map(sym =>
            indicesArray.find(idx => idx.symbol === sym || idx.name === sym)
          ).filter(Boolean);
          setIndices(keyIndices.length > 0 ? keyIndices : indicesArray.slice(0, 6));
        }
      } catch (error) {
        console.error('Market Overview fetch error:', error);
        setIndices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Is this VIX?
  const isVIX = (sym) => (sym || '').toUpperCase().includes('VIX');

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[90px] skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {indices.map((index, i) => {
        const isPositive = (index.pChange || 0) >= 0;
        const price = index.last || index.lastPrice || 0;
        const change = index.change || 0;
        const pChange = index.pChange || 0;
        const sym = index.symbol || index.name || '';
        const vix = isVIX(sym);

        // Short display name
        const shortName = sym
          .replace('NIFTY ', '')
          .replace('INDIA ', '')
          .replace('NIFTY', '')
          .trim();

        return (
          <motion.div
            key={sym}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <div className={cn(
              'relative group h-full rounded-xl border overflow-hidden transition-all duration-300 cursor-pointer',
              'bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm',
              'border-border/40 hover:border-border/80',
              'hover:shadow-xl hover:-translate-y-0.5',
              isPositive ? 'hover:shadow-emerald-500/10' : 'hover:shadow-rose-500/10'
            )}>
              {/* Top accent strip */}
              <div className={cn(
                'h-[2px] w-full',
                isPositive
                  ? 'bg-gradient-to-r from-emerald-500/60 via-emerald-400 to-emerald-500/60'
                  : 'bg-gradient-to-r from-rose-500/60 via-rose-400 to-rose-500/60'
              )} />

              {/* Background glow */}
              <div className={cn(
                'absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                isPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10'
              )} />

              <div className="p-2.5 relative">
                {/* Header: name + icon */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] md:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider truncate max-w-[75%]">
                    {shortName || sym}
                  </span>
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-110',
                    isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  )}>
                    {vix
                      ? <Zap className="w-3 h-3" />
                      : isPositive
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />
                    }
                  </div>
                </div>

                {/* Price */}
                <div className="text-base md:text-lg font-bold tabular-nums tracking-tight mb-1">
                  {vix ? price.toFixed(2) : price >= 1000 ? formatNumber(price, { decimals: 0 }) : price.toFixed(2)}
                </div>

                {/* Change row */}
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums',
                    isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  )}>
                    {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{pChange.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {change >= 0 ? '+' : ''}{Math.abs(change).toFixed(change >= 100 ? 0 : 2)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default MarketOverview;
