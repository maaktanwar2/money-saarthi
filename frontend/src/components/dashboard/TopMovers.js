// Dashboard — Top Gainers & Losers (Strong Movers Only)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronRight, Zap } from 'lucide-react';
import { cn, formatINR, fetchAPI } from '../../lib/utils';

const refineMovers = (stocks) => {
  if (!Array.isArray(stocks)) return [];
  return stocks.filter(stock => {
    const changePct = Math.abs(stock.change_pct ?? stock.pChange ?? 0);
    const volumeRatio = stock.volume_ratio ?? 1;
    const score = stock.score ?? stock.day_trading_score ?? 0;
    return changePct >= 2 || volumeRatio >= 1.3 || score >= 50;
  }).slice(0, 5);
};

const StockRow = ({ stock, i, type }) => {
  const changePct = stock.change_pct ?? stock.pChange ?? 0;
  const priceValue = stock.price || stock.lastPrice || stock.ltp || 0;
  const volumeRatio = stock.volume_ratio ?? 1;
  const score = stock.score ?? stock.day_trading_score ?? 0;
  const isStrong = volumeRatio >= 1.5 || score >= 60;
  const isGainer = type === 'gainer';
  const absPct = Math.abs(changePct);

  // Bar width proportional to change — max at 8%
  const barWidth = Math.min((absPct / 8) * 100, 100);

  return (
    <motion.div
      key={stock.symbol}
      initial={{ opacity: 0, x: isGainer ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
      onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
      className={cn(
        'relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all duration-200',
        'hover:bg-white/[0.05] hover:-translate-y-0.5',
      )}
    >
      {/* Background bar (subtle strength indicator) */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-xl opacity-[0.04] transition-all group-hover:opacity-[0.08]',
          isGainer ? 'bg-emerald-400' : 'bg-rose-400'
        )}
        style={{ width: `${barWidth}%` }}
      />

      {/* Rank */}
      <div className={cn(
        'relative w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold tabular-nums',
        i === 0 && isGainer ? 'bg-emerald-500/20 text-emerald-400' :
        i === 0 && !isGainer ? 'bg-rose-500/20 text-rose-400' :
        'bg-white/[0.06] text-muted-foreground'
      )}>
        {i + 1}
      </div>

      {/* Stock info */}
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold group-hover:text-foreground transition-colors truncate">
            {stock.symbol}
          </span>
          {isStrong && (
            <Zap className={cn('w-3 h-3 shrink-0', isGainer ? 'text-emerald-400' : 'text-rose-400')} />
          )}
          {volumeRatio > 1.3 && (
            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-white/[0.06] text-muted-foreground shrink-0">
              {volumeRatio.toFixed(1)}×
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">{formatINR(priceValue)}</span>
      </div>

      {/* Change badge */}
      <div className="relative shrink-0">
        <span className={cn(
          'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg tabular-nums',
          isGainer ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
        )}>
          {changePct >= 0 ? '+' : ''}{Number(changePct).toFixed(2)}%
        </span>
      </div>
    </motion.div>
  );
};

const MoversPanel = ({ title, stocks, type, loading, linkTo, linkLabel }) => {
  const isGainer = type === 'gainer';
  const accentColor = isGainer ? 'emerald' : 'rose';
  const glowColor = isGainer ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: isGainer ? 0 : 0.08 }}
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm h-full"
    >
      {/* Top accent strip */}
      <div className={`h-[2px] w-full bg-gradient-to-r from-${accentColor}-500/40 via-${accentColor}-400 to-${accentColor}-500/40`}
        style={{ background: `linear-gradient(to right, ${glowColor}, ${isGainer ? '#10b981' : '#f43f5e'}, ${glowColor})` }}
      />

      {/* Background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ backgroundColor: glowColor }}
      />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center',
              isGainer ? 'bg-emerald-500/15' : 'bg-rose-500/15'
            )}
              style={{ boxShadow: `0 4px 14px ${glowColor}` }}
            >
              {isGainer
                ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                : <TrendingDown className="w-4 h-4 text-rose-400" />
              }
            </div>
            <span className={cn('text-base font-bold', isGainer ? 'text-emerald-400' : 'text-rose-400')}>
              {title}
            </span>
          </div>
          <span className={cn(
            'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
            isGainer
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
              : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
          )}>
            Strong Only
          </span>
        </div>

        {/* Stock list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[52px] skeleton rounded-xl" />
            ))}
          </div>
        ) : stocks.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No strong movers today</div>
        ) : (
          <div className="space-y-0.5">
            {stocks.map((stock, i) => (
              <StockRow key={stock.symbol} stock={stock} i={i} type={type} />
            ))}
          </div>
        )}

        {/* View All link */}
        <Link
          to={linkTo}
          className={cn(
            'flex items-center justify-center gap-1 text-sm font-semibold mt-3 pt-3 border-t border-border/30 transition-colors',
            isGainer ? 'text-emerald-400 hover:text-emerald-300' : 'text-rose-400 hover:text-rose-300'
          )}
        >
          {linkLabel}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
};

const TopMovers = () => {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gainersData, losersData] = await Promise.all([
          fetchAPI('/scanners/day-gainers?limit=15'),
          fetchAPI('/scanners/day-losers?limit=15'),
        ]);

        const rawGainers = gainersData?.data || gainersData || [];
        const rawLosers = losersData?.data || losersData || [];

        setGainers(refineMovers(rawGainers));
        setLosers(refineMovers(rawLosers));
      } catch (error) {
        setGainers([]);
        setLosers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MoversPanel
        title="Top Gainers"
        stocks={gainers}
        type="gainer"
        loading={loading}
        linkTo="/scanners?tab=gainers"
        linkLabel="View All Gainers"
      />
      <MoversPanel
        title="Top Losers"
        stocks={losers}
        type="loser"
        loading={loading}
        linkTo="/scanners?tab=losers"
        linkLabel="View All Losers"
      />
    </div>
  );
};

export default TopMovers;
