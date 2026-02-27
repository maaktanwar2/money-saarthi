// Dashboard — FII/DII Activity Card (glassmorphic)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Building2, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, fetchAPI } from '../../lib/utils';

/* ─── Helpers ─── */
const fmt = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toFixed(0);
};

const FlowBar = ({ buy, sell, accent }) => {
  const total = buy + sell;
  const buyPct = total > 0 ? (buy / total) * 100 : 50;
  return (
    <div className="relative h-2.5 w-full rounded-full overflow-hidden bg-white/5 mt-2">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${buyPct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${100 - buyPct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 }}
        className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-rose-500 to-rose-500/50"
      />
    </div>
  );
};

const EntityCard = ({ label, icon: Icon, buy, sell, net, accent, delay }) => {
  const isPositive = net >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay }}
      className="relative rounded-xl border border-border/30 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 overflow-hidden 
                 hover:border-border/50 transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Top accent */}
      <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: accent }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accent}18` }}
          >
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <span className="text-sm font-semibold text-foreground/90">{label}</span>
        </div>
        {/* Net pill */}
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border',
          isPositive
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
        )}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{fmt(net)} Cr
        </div>
      </div>

      {/* Net value big text */}
      <div className={cn(
        'text-2xl font-extrabold tracking-tight mb-1',
        isPositive ? 'text-emerald-400' : 'text-rose-400'
      )}>
        {isPositive ? '+' : ''}{net.toFixed(0)} <span className="text-base font-semibold text-muted-foreground">Cr</span>
      </div>

      {/* Buy / Sell breakdown */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
        <span>Buy: <span className="text-emerald-400 font-semibold">{fmt(buy)} Cr</span></span>
        <span>Sell: <span className="text-rose-400 font-semibold">{fmt(sell)} Cr</span></span>
      </div>

      <FlowBar buy={buy} sell={sell} accent={accent} />
    </motion.div>
  );
};

const FIIDIIData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchAPI('/fii-dii-data');
        const cashData = Array.isArray(result) ? result[0] : result;
        setData({
          fii: {
            buyValue: Number(cashData?.fii_buy) || 0,
            sellValue: Number(cashData?.fii_sell) || 0,
            netValue: Number(cashData?.fii_net) || 0
          },
          dii: {
            buyValue: Number(cashData?.dii_buy) || 0,
            sellValue: Number(cashData?.dii_sell) || 0,
            netValue: Number(cashData?.dii_net) || 0
          },
        });
      } catch (error) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="h-52 skeleton rounded-2xl" />;

  const fii = data?.fii || { buyValue: 0, sellValue: 0, netValue: 0 };
  const dii = data?.dii || { buyValue: 0, sellValue: 0, netValue: 0 };
  const totalNet = fii.netValue + dii.netValue;

  /* Derive sentiment label */
  const sentiment = (() => {
    if (fii.netValue > 0 && dii.netValue > 0) return { label: 'Both Buying', color: 'emerald' };
    if (fii.netValue < 0 && dii.netValue < 0) return { label: 'Both Selling', color: 'rose' };
    if (fii.netValue < 0 && dii.netValue > 0) return { label: 'FII Selling · DII Absorbing', color: 'amber' };
    if (fii.netValue > 0 && dii.netValue < 0) return { label: 'FII Buying · DII Selling', color: 'amber' };
    return { label: 'Neutral', color: 'gray' };
  })();

  const sentimentColors = {
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    gray: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
  };

  const glowColor = totalNet >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative rounded-2xl border border-border/40 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Accent strip — gradient based on net flow */}
      <div className={cn(
        'absolute top-0 inset-x-0 h-[3px]',
        totalNet >= 0
          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
          : 'bg-gradient-to-r from-rose-500 to-pink-400'
      )} />

      {/* Background glow */}
      <div
        className="absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl pointer-events-none"
        style={{ background: glowColor }}
      />

      <div className="relative p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground/90">FII / DII Activity</h3>
          <div className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-bold border',
            sentimentColors[sentiment.color]
          )}>
            {sentiment.label}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <EntityCard
            label="FII (Foreign)"
            icon={Globe}
            buy={fii.buyValue}
            sell={fii.sellValue}
            net={fii.netValue}
            accent="#8b5cf6"
            delay={0.1}
          />
          <EntityCard
            label="DII (Domestic)"
            icon={Building2}
            buy={dii.buyValue}
            sell={dii.sellValue}
            net={dii.netValue}
            accent="#3b82f6"
            delay={0.18}
          />
        </div>

        {/* Net flow summary + link */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Combined Net:{' '}
            <span className={cn('font-bold', totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(0)} Cr
            </span>
          </div>
          <Link
            to="/market"
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            View detailed analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default FIIDIIData;
