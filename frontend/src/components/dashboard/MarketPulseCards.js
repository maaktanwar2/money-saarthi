// Market Pulse — PCR + IV mini cards (myfno-style dashboard row)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn, fetchAPI } from '../../lib/utils';

const PulseCard = ({ icon: Icon, label, value, change, changeLabel, color, glowColor, delay = 0 }) => {
  const isPositive = change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 20 }}
      className={cn(
        'relative group overflow-hidden rounded-xl border transition-all duration-300',
        'bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm',
        'border-border/40 hover:border-border/80',
        'hover:shadow-lg hover:-translate-y-0.5'
      )}
    >
      {/* Top accent strip */}
      <div className={cn('h-[2px] w-full', color.replace('bg-', 'bg-gradient-to-r from-') + '/40 via-' + color.replace('bg-', '') + ' to-' + color.replace('bg-', '') + '/40')} 
        style={{ background: `linear-gradient(to right, ${glowColor}66, ${glowColor}, ${glowColor}66)` }}
      />

      {/* Background glow on hover */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ backgroundColor: `${glowColor}15` }}
      />

      <div className="flex items-center gap-2.5 p-2.5 relative">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110',
          color
        )}
          style={{ boxShadow: `0 4px 14px ${glowColor}30` }}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-base font-bold tabular-nums tracking-tight">{value}</span>
            {change != null && (
              <span className={cn(
                'flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums',
                isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              )}>
                {isPositive ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
                {isPositive ? '+' : ''}{typeof change === 'number' ? change.toFixed(2) : change}
              </span>
            )}
          </div>
          {changeLabel && (
            <div className="text-[9px] text-muted-foreground mt-1 font-medium">{changeLabel}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const MarketPulseCards = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPulse = async () => {
      try {
        // Fetch VIX + market breadth in parallel
        const [vixRes, breadthRes] = await Promise.all([
          fetchAPI('/nse/india-vix').catch(() => null),
          fetchAPI('/nse/market-breadth').catch(() => null),
        ]);

        const vix = vixRes?.last ?? vixRes?.value ?? 0;
        const vixChange = vixRes?.change ?? 0;
        const vixLevel = vixRes?.level || '';

        // PCR from breadth (approximate from adv/dec ratio)
        const adv = breadthRes?.advances ?? 0;
        const dec = breadthRes?.declines ?? 0;
        const adRatio = breadthRes?.advanceDeclineRatio ?? (adv / Math.max(dec, 1));

        // Approximate PCR (put-call ratio) — uses AD ratio as proxy
        const pcr = adRatio > 0 ? (1 / adRatio).toFixed(2) : '0.00';
        const pcrVal = parseFloat(pcr);
        const pcrChange = adRatio > 1 ? -(adRatio - 1).toFixed(2) : (1 - adRatio).toFixed(2);

        setData({
          pcr: pcrVal.toFixed(2),
          pcrChange: parseFloat(pcrChange),
          iv: vix.toFixed(1),
          ivChange: vixChange,
          ivLevel: vixLevel,
        });
      } catch (err) {
        console.error('Pulse fetch err:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPulse();
    const interval = setInterval(() => { if (!document.hidden) fetchPulse(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[...Array(2)].map((_, i) => <div key={i} className="h-[60px] skeleton rounded-xl" />)}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <PulseCard
        icon={BarChart3}
        label="PCR"
        value={data.pcr}
        change={data.pcrChange}
        changeLabel={parseFloat(data.pcr) > 1 ? 'Bullish (Put heavy)' : parseFloat(data.pcr) < 0.7 ? 'Bearish (Call heavy)' : 'Neutral'}
        color="bg-violet-500/80"
        glowColor="#8b5cf6"
        delay={0}
      />
      <PulseCard
        icon={Activity}
        label="IV (VIX)"
        value={data.iv}
        change={data.ivChange}
        changeLabel={data.ivLevel || (parseFloat(data.iv) < 15 ? 'Low volatility' : parseFloat(data.iv) > 22 ? 'High volatility' : 'Normal')}
        color="bg-amber-500/80"
        glowColor="#f59e0b"
        delay={0.05}
      />
    </div>
  );
};

export default MarketPulseCards;
