// Advance-Decline Bar — NIFTY 500 breadth indicator
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, fetchAPI } from '../../lib/utils';

const AdvanceDeclineBar = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreadth = async () => {
      try {
        const res = await fetchAPI('/nse/market-breadth');
        setData(res);
      } catch (err) {
        console.error('Breadth error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBreadth();
    // Let React Query handle refetching via useMarketStats hook instead of manual polling
  }, []);

  if (loading) return <div className="h-[88px] skeleton rounded-2xl" />;
  if (!data) return null;

  const adv = data.advances ?? 0;
  const dec = data.declines ?? 0;
  const unch = data.unchanged ?? 0;
  const total = adv + dec + unch || 1;
  const advPct = (adv / total) * 100;
  const decPct = (dec / total) * 100;
  const unchPct = (unch / total) * 100;
  const adRatio = data.advanceDeclineRatio ?? (adv / Math.max(dec, 1));
  const sentiment = data.sentiment || 'NEUTRAL';

  const isBullish = sentiment.includes('BULL');
  const isBearish = sentiment.includes('BEAR');

  const sentimentConfig = isBullish
    ? { color: 'text-emerald-400', bg: 'bg-emerald-500/10', glow: 'rgba(16,185,129,0.15)', border: 'border-emerald-500/30' }
    : isBearish
    ? { color: 'text-rose-400', bg: 'bg-rose-500/10', glow: 'rgba(244,63,94,0.15)', border: 'border-rose-500/30' }
    : { color: 'text-amber-400', bg: 'bg-amber-500/10', glow: 'rgba(245,158,11,0.15)', border: 'border-amber-500/30' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm"
    >
      {/* Top accent strip */}
      <div className="h-[2px] w-full" style={{
        background: `linear-gradient(to right, rgba(16,185,129,0.6) ${advPct}%, rgba(245,158,11,0.4) ${advPct}%, rgba(245,158,11,0.4) ${advPct + unchPct}%, rgba(244,63,94,0.6) ${advPct + unchPct}%)`
      }} />

      {/* Background glow */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-20 rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{ backgroundColor: sentimentConfig.glow }}
      />

      <div className="p-4 relative">
        {/* Stats Row */}
        <div className="flex items-center justify-between mb-3">
          {/* Advances */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{adv}</div>
              <div className="text-[9px] text-muted-foreground font-medium">Advancing</div>
            </div>
          </div>

          {/* Sentiment badge + ratio */}
          <div className="flex flex-col items-center gap-1">
            <span className={cn(
              'text-[10px] font-bold px-2.5 py-0.5 rounded-full border',
              sentimentConfig.color, sentimentConfig.bg, sentimentConfig.border
            )}>
              {sentiment.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
              A/D {adRatio.toFixed(2)}
            </span>
          </div>

          {/* Declines */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm font-bold text-rose-400 tabular-nums">{dec}</div>
              <div className="text-[9px] text-muted-foreground font-medium">Declining</div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>
        </div>

        {/* The Bar */}
        <div className="relative">
          <div className="flex h-6 rounded-full overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {/* Advances */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${advPct}%` }}
              transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative overflow-hidden"
              style={{ background: 'linear-gradient(90deg, #059669, #10b981, #34d399)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              {advPct > 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm tabular-nums">
                  {advPct.toFixed(0)}%
                </span>
              )}
            </motion.div>

            {/* Unchanged */}
            {unch > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${unchPct}%` }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="bg-amber-500/30 relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
              </motion.div>
            )}

            {/* Declines */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${decPct}%` }}
              transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
              className="relative overflow-hidden"
              style={{ background: 'linear-gradient(90deg, #f43f5e, #e11d48, #be123c)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              {decPct > 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm tabular-nums">
                  {decPct.toFixed(0)}%
                </span>
              )}
            </motion.div>
          </div>

          {/* Glow underneath the bar */}
          <div className="absolute -bottom-1 left-0 right-0 h-3 rounded-full blur-md pointer-events-none"
            style={{
              background: `linear-gradient(to right, rgba(16,185,129,0.2) ${advPct}%, transparent ${advPct}%, transparent ${advPct + unchPct}%, rgba(244,63,94,0.2) ${advPct + unchPct}%)`
            }}
          />
        </div>

        {/* Unchanged footer */}
        {unch > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Minus className="w-3 h-3 text-amber-500/60" />
            <span className="text-[9px] text-muted-foreground tabular-nums">{unch} Unchanged</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdvanceDeclineBar;
