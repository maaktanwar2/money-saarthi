// Dashboard — Sector Heatmap with drill-down to stocks
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
        const sorted = arr.sort((a, b) => Math.abs(b.change_percent || 0) - Math.abs(a.change_percent || 0));
        setSectors(sorted);
      } catch (err) {
        console.error('Sector fetch error:', err);
        setSectors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
    const interval = setInterval(() => { if (!document.hidden) fetchSectors(); }, 60000);
    return () => clearInterval(interval);
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

  const getColorForChange = (pct) => {
    if (pct >= 2) return 'bg-green-600';
    if (pct >= 1) return 'bg-green-500';
    if (pct >= 0.3) return 'bg-green-700/80';
    if (pct >= 0) return 'bg-green-800/60';
    if (pct >= -0.3) return 'bg-red-800/60';
    if (pct >= -1) return 'bg-red-700/80';
    if (pct >= -2) return 'bg-red-600';
    return 'bg-red-700';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {[...Array(11)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
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

  return (
    <div className="space-y-4">
      {/* Sector Heatmap */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {sectors.map((sector, i) => {
          const pct = sector.change_percent ?? 0;
          const isPositive = pct >= 0;
          const isSelected = selectedSector?.id === sector.id;
          return (
            <motion.button
              key={sector.id || i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => handleSectorClick(sector)}
              className={cn(
                'relative p-3 rounded-xl text-left transition-all duration-200',
                getColorForChange(pct),
                'text-white hover:ring-2 hover:ring-white/30',
                isSelected && 'ring-2 ring-primary shadow-lg scale-[1.02]'
              )}
            >
              <div className="text-[10px] font-bold leading-tight truncate">
                {sector.name}
              </div>
              <div className="text-sm font-bold mt-0.5">
                {isPositive ? '+' : ''}{Number(pct).toFixed(2)}%
              </div>
              {sector.advances != null && (
                <div className="text-[9px] mt-0.5">
                  A:{sector.advances} D:{sector.declines}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

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
                <div className="flex items-center justify-between">
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
                      <Flame className="w-3 h-3 inline mr-1" />Momentum Up
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
                      <ArrowDownRight className="w-3 h-3 inline mr-1" />Day Correction
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        {momentumStocks.length === 0 ? (
                          <p className="text-sm text-muted-foreground col-span-full text-center py-4">No strong momentum stocks in this sector right now</p>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        {correctionStocks.length === 0 ? (
                          <p className="text-sm text-muted-foreground col-span-full text-center py-4">No healthy pullback stocks in this sector right now</p>
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
