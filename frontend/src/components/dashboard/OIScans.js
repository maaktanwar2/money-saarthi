// OI Scans — Top 5 OI Buildup + Top 5 OI Unwinding
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { cn, fetchAPI } from '../../lib/utils';

const OIScans = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOI = async () => {
      try {
        const res = await fetchAPI('/tools/fno-heatmap');
        const all = res?.stocks || [];
        setStocks(all);
      } catch (err) {
        console.error('OI Scan error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOI();
    const interval = setInterval(() => { if (!document.hidden) fetchOI(); }, 180000);
    return () => clearInterval(interval);
  }, []);

  const oiUp = [...stocks].filter(s => (s.oi_change ?? 0) > 0).sort((a, b) => (b.oi_change ?? 0) - (a.oi_change ?? 0)).slice(0, 5);
  const oiDown = [...stocks].filter(s => (s.oi_change ?? 0) < 0).sort((a, b) => (a.oi_change ?? 0) - (b.oi_change ?? 0)).slice(0, 5);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <div key={i} className="h-[220px] skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  const OIPanel = ({ title, items, type }) => {
    const isUp = type === 'up';
    const glowColor = isUp ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)';
    const accentHex = isUp ? '#10b981' : '#f43f5e';
    const maxOI = Math.max(...items.map(s => Math.abs(s.oi_change ?? 0)), 1);

    return (
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: isUp ? 0 : 0.08 }}
        className="relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm h-full"
      >
        {/* Top accent strip */}
        <div className="h-[2px] w-full"
          style={{ background: `linear-gradient(to right, ${glowColor}, ${accentHex}, ${glowColor})` }}
        />

        {/* Background glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />

        <div className="relative p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                isUp ? 'bg-emerald-500/15' : 'bg-rose-500/15'
              )}
                style={{ boxShadow: `0 4px 14px ${glowColor}` }}
              >
                {isUp
                  ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                  : <TrendingDown className="w-4 h-4 text-rose-400" />
                }
              </div>
              <span className={cn('text-sm font-bold', isUp ? 'text-emerald-400' : 'text-rose-400')}>
                {title}
              </span>
            </div>
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
              isUp
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
            )}>
              {isUp ? 'Buildup' : 'Unwinding'}
            </span>
          </div>

          {/* Stock rows */}
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No data available</div>
          ) : (
            <div className="space-y-0.5">
              {items.map((stock, i) => {
                const oiChg = stock.oi_change ?? 0;
                const priceChg = stock.price_change ?? 0;
                const barWidth = Math.min((Math.abs(oiChg) / maxOI) * 100, 100);
                const isStrongOI = Math.abs(oiChg) > 5;

                return (
                  <motion.div
                    key={stock.symbol}
                    initial={{ opacity: 0, x: isUp ? -16 : 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                    className="relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all duration-200 hover:bg-white/[0.05] hover:-translate-y-0.5"
                  >
                    {/* Background bar */}
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-xl opacity-[0.04] transition-all group-hover:opacity-[0.08]',
                        isUp ? 'bg-emerald-400' : 'bg-rose-400'
                      )}
                      style={{ width: `${barWidth}%` }}
                    />

                    {/* Rank */}
                    <div className={cn(
                      'relative w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold tabular-nums',
                      i === 0 && isUp ? 'bg-emerald-500/20 text-emerald-400' :
                      i === 0 && !isUp ? 'bg-rose-500/20 text-rose-400' :
                      'bg-white/[0.06] text-muted-foreground'
                    )}>
                      {i + 1}
                    </div>

                    {/* Symbol + price change */}
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold group-hover:text-foreground transition-colors truncate">
                          {stock.symbol}
                        </span>
                        {isStrongOI && (
                          <Zap className={cn('w-3 h-3 shrink-0', isUp ? 'text-emerald-400' : 'text-rose-400')} />
                        )}
                      </div>
                      {priceChg !== 0 && (
                        <span className={cn(
                          'text-[10px] tabular-nums font-medium',
                          priceChg > 0 ? 'text-emerald-400/70' : 'text-rose-400/70'
                        )}>
                          Price {priceChg > 0 ? '+' : ''}{priceChg.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* OI change badge */}
                    <div className="relative shrink-0">
                      <span className={cn(
                        'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg tabular-nums',
                        isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      )}>
                        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {oiChg > 0 ? '+' : ''}{oiChg.toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <OIPanel title="OI Up" items={oiUp} type="up" />
      <OIPanel title="OI Down" items={oiDown} type="down" />
    </div>
  );
};

export default OIScans;
