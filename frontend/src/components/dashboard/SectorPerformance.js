// Dashboard — Sector Vertical Bars (myfno-style) with drill-down
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight, Flame, X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { cn, formatINR, fetchAPI } from '../../lib/utils';

const SectorPerformance = () => {
  const [sectors, setSectors] = useState([]);
  const [sectorStocks, setSectorStocks] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stockTab, setStockTab] = useState('momentum');

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetchAPI('/fno/sectors/performance');
        const arr = res?.sectors || [];
        // Sort by change_percent descending (gainers first)
        const sorted = arr.sort((a, b) => (b.change_percent || 0) - (a.change_percent || 0));
        setSectors(sorted);
      } catch (err) {
        console.error('Sector fetch error:', err);
        setSectors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
    // Remove manual polling - let React Query handle refetching
  }, []);

  const handleSectorClick = useCallback(async (sector) => {
    if (selectedSector?.id === sector.id) {
      setSelectedSector(null);
      setSectorStocks([]);
      return;
    }
    setSelectedSector(sector);
    setStocksLoading(true);
    try {
      const res = await fetchAPI(`/fno/sectors/${sector.id}/stocks`);
      const stocks = res?.stocks || [];
      setSectorStocks(stocks);
    } catch {
      setSectorStocks([]);
    } finally {
      setStocksLoading(false);
    }
  }, [selectedSector]);

  const { momentumStocks, correctionStocks } = useMemo(() => {
    if (!sectorStocks.length) return { momentumStocks: [], correctionStocks: [] };
    const momentum = sectorStocks.filter(s => {
      const chg = s.change_pct ?? 0;
      const volR = s.volume_ratio ?? 1;
      return chg > 0.5 && volR >= 1.0;
    }).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));

    const correction = sectorStocks.filter(s => {
      const chg = s.change_pct ?? 0;
      return chg < -0.3 && chg > -5;
    }).sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0));

    return { momentumStocks: momentum.slice(0, 8), correctionStocks: correction.slice(0, 8) };
  }, [sectorStocks]);

  const maxAbsChange = useMemo(() => {
    return Math.max(...sectors.map(s => Math.abs(s.change_percent ?? 0)), 0.5);
  }, [sectors]);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {[...Array(11)].map((_, i) => <div key={i} className="w-16 h-32 skeleton rounded-lg shrink-0" />)}
      </div>
    );
  }

  if (!sectors.length) {
    return (
      <Card className="p-6 text-center text-muted-foreground text-sm">
        Sector data unavailable. Market may be closed.
      </Card>
    );
  }

  // Max bar height in px (each half — up for gainers, down for losers)
  const MAX_BAR_H = 70;

  // Color helpers
  const getBarColor = (pct) => {
    if (pct >= 2) return { bg: 'bg-emerald-500', glow: 'rgba(16,185,129,0.25)', text: 'text-emerald-400' };
    if (pct >= 1) return { bg: 'bg-emerald-500/80', glow: 'rgba(16,185,129,0.18)', text: 'text-emerald-400' };
    if (pct >= 0.3) return { bg: 'bg-emerald-600/60', glow: 'rgba(16,185,129,0.12)', text: 'text-emerald-400' };
    if (pct >= 0) return { bg: 'bg-emerald-700/50', glow: 'rgba(16,185,129,0.08)', text: 'text-emerald-400' };
    if (pct >= -0.5) return { bg: 'bg-rose-700/50', glow: 'rgba(244,63,94,0.08)', text: 'text-rose-400' };
    if (pct >= -1) return { bg: 'bg-rose-600/60', glow: 'rgba(244,63,94,0.12)', text: 'text-rose-400' };
    if (pct >= -1.5) return { bg: 'bg-rose-500/75', glow: 'rgba(244,63,94,0.18)', text: 'text-rose-400' };
    if (pct >= -2) return { bg: 'bg-rose-500/85', glow: 'rgba(244,63,94,0.22)', text: 'text-rose-400' };
    return { bg: 'bg-rose-500', glow: 'rgba(244,63,94,0.28)', text: 'text-rose-400' };
  };

  // Count gainers/losers
  const gainers = sectors.filter(s => (s.change_percent ?? 0) >= 0).length;
  const losers = sectors.length - gainers;

  return (
    <div className="space-y-4">
      {/* Vertical Bar Chart — myfno-style */}
      <Card className="border-border/40 bg-gradient-to-b from-card/90 to-card/50 backdrop-blur-sm overflow-hidden">
        {/* Summary strip */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-3">
            {gainers > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {gainers} Gaining
              </span>
            )}
            {losers > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {losers} Declining
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">Click to drill down</span>
        </div>

        {/* Vertical bars container */}
        <div className="px-2 pb-2 pt-1">
          <div className="flex items-end justify-center gap-0 w-full" style={{ minHeight: MAX_BAR_H * 2 + 36 }}>
            {sectors.map((sector, i) => {
              const pct = sector.change_percent ?? 0;
              const isPositive = pct >= 0;
              const barHeightPx = Math.max((Math.abs(pct) / maxAbsChange) * MAX_BAR_H, 4);
              const colors = getBarColor(pct);
              const isSelected = selectedSector?.id === sector.id;
              const sectorName = sector.name?.replace('NIFTY ', '').replace('Nifty ', '') || '';

              return (
                <motion.button
                  key={sector.id || i}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
                  onClick={() => handleSectorClick(sector)}
                  className={cn(
                    'flex flex-col items-center cursor-pointer group transition-all duration-200 relative',
                    'hover:opacity-100',
                    isSelected && 'opacity-100',
                    !isSelected && 'opacity-80'
                  )}
                  style={{ flex: '1 1 0', minWidth: 0 }}
                >
                  {/* Percentage label above bar (for positive) */}
                  {isPositive && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 + 0.3 }}
                      className={cn('text-[7px] sm:text-[8px] font-bold tabular-nums mb-0.5 leading-none', colors.text)}
                    >
                      +{Number(pct).toFixed(1)}%
                    </motion.span>
                  )}

                  {/* The vertical bar */}
                  <div className="relative flex flex-col items-center">
                    {/* Glow effect */}
                    {Math.abs(pct) > 0.8 && (
                      <div
                        className="absolute rounded-full blur-md pointer-events-none"
                        style={{
                          width: 12,
                          height: barHeightPx * 0.6,
                          backgroundColor: colors.glow,
                          ...(isPositive
                            ? { bottom: 0, left: '50%', transform: 'translateX(-50%)' }
                            : { top: 0, left: '50%', transform: 'translateX(-50%)' }),
                        }}
                      />
                    )}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: barHeightPx }}
                      transition={{ delay: i * 0.03 + 0.1, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                      className={cn(
                        'w-3 sm:w-4 md:w-5 rounded-t-sm relative overflow-hidden',
                        colors.bg,
                        isSelected && 'ring-1 ring-primary/50',
                        'group-hover:brightness-110 transition-all'
                      )}
                    >
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/15 to-transparent" />
                      {/* Top edge highlight */}
                      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    </motion.div>
                  </div>

                  {/* Percentage label below bar (for negative) */}
                  {!isPositive && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 + 0.3 }}
                      className={cn('text-[7px] sm:text-[8px] font-bold tabular-nums mt-0.5 leading-none', colors.text)}
                    >
                      {Number(pct).toFixed(1)}%
                    </motion.span>
                  )}

                  {/* Sector name — rotated vertically */}
                  <div className="mt-1 w-full flex items-center justify-center" style={{ height: 40 }}>
                    <span
                      className={cn(
                        'text-[7px] sm:text-[8px] md:text-[9px] font-medium whitespace-nowrap transition-colors',
                        isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground/70 group-hover:text-foreground'
                      )}
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        maxHeight: 40,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sectorName}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Drill-down: Sector → Stocks */}
      <AnimatePresence>
        {selectedSector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm">
                      {selectedSector.name} — Stocks
                    </CardTitle>
                    <Badge className={cn(
                      'text-xs',
                      (selectedSector.change_percent ?? 0) >= 0
                        ? 'bg-bullish/20 text-bullish'
                        : 'bg-bearish/20 text-bearish'
                    )}>
                      {(selectedSector.change_percent ?? 0) >= 0 ? '+' : ''}{Number(selectedSector.change_percent ?? 0).toFixed(2)}%
                    </Badge>
                    {selectedSector.advances != null && (
                      <span className="text-[10px] text-muted-foreground">
                        <span className="text-green-400">▲{selectedSector.advances}</span>
                        {' '}
                        <span className="text-red-400">▼{selectedSector.declines}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStockTab('momentum')}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                        stockTab === 'momentum'
                          ? 'bg-bullish/20 text-bullish'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Flame className="w-3 h-3 inline mr-1" />Momentum
                    </button>
                    <button
                      onClick={() => setStockTab('correction')}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                        stockTab === 'correction'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <ArrowDownRight className="w-3 h-3 inline mr-1" />Pullback
                    </button>
                    <button onClick={() => { setSelectedSector(null); setSectorStocks([]); }} className="p-1 rounded hover:bg-white/10">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {stocksLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-lg" />)}
                  </div>
                ) : (
                  <>
                    {stockTab === 'momentum' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {momentumStocks.length === 0 ? (
                          <p className="text-sm text-muted-foreground col-span-full text-center py-4">No momentum stocks right now</p>
                        ) : momentumStocks.map((stock, i) => {
                          const chg = stock.change_pct ?? 0;
                          const price = stock.price ?? 0;
                          const volR = stock.volume_ratio ?? 1;
                          return (
                            <motion.div
                              key={stock.symbol}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                              className="p-3 rounded-lg bg-bullish/5 border border-bullish/20 hover:border-bullish/40 cursor-pointer transition-all group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-sm group-hover:text-primary transition-colors">{stock.symbol}</span>
                                <ArrowUpRight className="w-3 h-3 text-bullish" />
                              </div>
                              <div className="text-xs text-muted-foreground">{formatINR(price)}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold text-bullish">+{Number(chg).toFixed(2)}%</span>
                                {volR > 1.2 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bullish/10 text-bullish font-medium">
                                    Vol {volR.toFixed(1)}×
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                    {stockTab === 'correction' && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {correctionStocks.length === 0 ? (
                          <p className="text-sm text-muted-foreground col-span-full text-center py-4">No pullback stocks right now</p>
                        ) : correctionStocks.map((stock, i) => {
                          const chg = stock.change_pct ?? 0;
                          const price = stock.price ?? 0;
                          const volR = stock.volume_ratio ?? 1;
                          return (
                            <motion.div
                              key={stock.symbol}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                              className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition-all group"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-sm group-hover:text-primary transition-colors">{stock.symbol}</span>
                                <ArrowDownRight className="w-3 h-3 text-amber-400" />
                              </div>
                              <div className="text-xs text-muted-foreground">{formatINR(price)}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold text-amber-400">{Number(chg).toFixed(2)}%</span>
                                {volR < 0.8 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                                    Low Vol
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                    {sectorStocks.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <span>Quick:</span>
                        <Link to={`/options`} className="text-primary hover:underline">Options Chain</Link>
                        <span>•</span>
                        <Link to={`/trade-finder`} className="text-primary hover:underline">Trade Finder</Link>
                        <span>•</span>
                        <Link to={`/scanners`} className="text-primary hover:underline">Full Scanner</Link>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SectorPerformance;
