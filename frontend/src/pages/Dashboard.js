// Dashboard - Main home page with market overview
import { useState, useEffect, useMemo, useCallback } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Activity, BarChart3, 
  ScanSearch, LineChart, Brain,
  Zap, Target, Users,
  ChevronRight, Sparkles, Shield,
  ArrowUpRight, ArrowDownRight, Flame, X
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '../components/ui';
import { 
  cn, formatINR, formatNumber, 
  fetchAPI, getMarketSession 
} from '../lib/utils';

// Get user's first name from localStorage
const getUserFirstName = () => {
  try {
    const stored = localStorage.getItem('ms_user');
    if (stored) {
      const user = JSON.parse(stored);
      const name = user?.name || user?.displayName || '';
      return name.split(' ')[0] || 'Trader';
    }
  } catch (e) {}
  return 'Trader';
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET OVERVIEW SECTION
// ═══════════════════════════════════════════════════════════════════════════════
const MarketOverview = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/indices');
        // API returns {all_indices: [...], categorized: {...}}
        const indicesArray = response?.all_indices || response?.data || [];
        if (indicesArray && indicesArray.length > 0) {
          // Get key indices: NIFTY 50, BANK NIFTY, MIDCAP 50, FIN SERVICE, INDIA VIX, SENSEX
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 skeleton rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {indices.map((index, i) => {
        const isPositive = (index.pChange || 0) >= 0;
        const price = index.last || index.lastPrice || 0;
        const change = index.change || 0;
        const pChange = index.pChange || 0;
        
        return (
          <motion.div
            key={index.symbol || index.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={cn(
              "p-4 h-full transition-all duration-200 cursor-pointer",
              "hover:shadow-lg hover:border-primary/40",
              isPositive ? "hover:bg-bullish/5" : "hover:bg-bearish/5"
            )}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide truncate max-w-[80%]">
                  {index.symbol || index.name}
                </span>
                <span className={cn(
                  'p-1 rounded-full',
                  isPositive ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'
                )}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">
                {price >= 1000 ? formatNumber(price, { decimals: 0 }) : price.toFixed(2)}
              </div>
              <div className={cn(
                'text-sm font-semibold flex items-center gap-1',
                isPositive ? 'text-bullish' : 'text-bearish'
              )}>
                <span>{isPositive ? '▲' : '▼'}</span>
                <span>{Math.abs(change).toFixed(change >= 100 ? 0 : 2)}</span>
                <span className="text-xs">({isPositive ? '+' : ''}{pChange.toFixed(2)}%)</span>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK TOOLS NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
const QUICK_TOOLS = [
  {
    id: 'scanners',
    title: 'Stock Scanners',
    description: '15+ pre-built scanners for gainers, breakouts, momentum',
    icon: ScanSearch,
    path: '/scanners',
    color: 'emerald',
  },
  {
    id: 'options',
    title: 'Options Lab',
    description: 'Chain analysis, Greeks, OI analytics, payoff charts',
    icon: LineChart,
    path: '/options',
    color: 'cyan',
    badge: 'Pro',
  },
  {
    id: 'advisor',
    title: 'AI Agent',
    description: 'Autonomous AI trading agent with OODA cycle',
    icon: Brain,
    path: '/ai-agent',
    color: 'violet',
    badge: 'AI',
  },
  {
    id: 'signals',
    title: 'Trade Signals',
    description: 'AI-generated buy/sell signals with confidence scores',
    icon: Zap,
    path: '/signals',
    color: 'amber',
  },
  {
    id: 'market',
    title: 'Market Pulse',
    description: 'FII/DII flows, sector performance, market breadth',
    icon: Activity,
    path: '/market',
    color: 'blue',
  },
  {
    id: 'backtest',
    title: 'Backtesting',
    description: 'Test your strategies against historical data',
    icon: BarChart3,
    path: '/backtest',
    color: 'rose',
  },
];

const QuickTools = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {QUICK_TOOLS.map((tool, i) => (
      <motion.div
        key={tool.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.05 }}
      >
        <Link to={tool.path}>
          <Card className="p-5 h-full group hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                tool.color === 'emerald' && 'bg-emerald-500/15 text-emerald-500',
                tool.color === 'cyan' && 'bg-cyan-500/15 text-cyan-500',
                tool.color === 'violet' && 'bg-violet-500/15 text-violet-500',
                tool.color === 'amber' && 'bg-amber-500/15 text-amber-500',
                tool.color === 'blue' && 'bg-blue-500/15 text-blue-500',
                tool.color === 'rose' && 'bg-rose-500/15 text-rose-500',
              )}>
                <tool.icon className="w-6 h-6" />
              </div>
              {tool.badge && (
                <Badge variant={tool.badge === 'AI' ? 'default' : 'warning'}>
                  {tool.badge}
                </Badge>
              )}
            </div>
            
            <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
              {tool.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {tool.description}
            </p>
            
            {/* Accuracy stats if available */}
            {tool.accuracy && (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="font-semibold text-primary">{tool.accuracy}%</span>
                  <span className="text-muted-foreground">accuracy</span>
                </span>
                <span className="text-muted-foreground">
                  {tool.trades?.toLocaleString()} trades
                </span>
              </div>
            )}
            
            <div className="flex items-center text-sm text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open Tool</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      </motion.div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTOR PERFORMANCE — Where is money flowing?
// ═══════════════════════════════════════════════════════════════════════════════
const SectorPerformance = () => {
  const [sectors, setSectors] = useState([]);
  const [sectorStocks, setSectorStocks] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stockTab, setStockTab] = useState('momentum'); // momentum | correction

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetchAPI('/fno/sectors/performance');
        const arr = res?.sectors || [];
        // Sort by absolute change_percent — biggest moves first
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
    const interval = setInterval(fetchSectors, 60000);
    return () => clearInterval(interval);
  }, []);

  // When a sector is selected, fetch its constituent stocks
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

  // Split stocks into momentum (strong gainers w/ volume) vs correction (pullback on lower vol)
  const { momentumStocks, correctionStocks } = useMemo(() => {
    if (!sectorStocks.length) return { momentumStocks: [], correctionStocks: [] };
    const momentum = sectorStocks.filter(s => {
      const chg = s.change_pct ?? 0;
      const volR = s.volume_ratio ?? 1;
      return chg > 0.5 && volR >= 1.0;
    }).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));

    const correction = sectorStocks.filter(s => {
      const chg = s.change_pct ?? 0;
      // Healthy pullback: slightly negative on lower volume
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
                    {/* Quick links for selected stock */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// TOP GAINERS/LOSERS - SIDE BY SIDE VIEW (REFINED - Only Strong Movers)
// ═══════════════════════════════════════════════════════════════════════════════
const TopMovers = () => {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refine function: Filter only strong, persistent movers
  const refineMovers = (stocks, isGainer = true) => {
    if (!Array.isArray(stocks)) return [];
    
    return stocks.filter(stock => {
      const changePct = Math.abs(stock.change_pct ?? stock.pChange ?? 0);
      const volumeRatio = stock.volume_ratio ?? 1;
      const score = stock.score ?? stock.day_trading_score ?? 0;
      
      // Strong movers criteria:
      // 1. Change >= 2% (significant move)
      // 2. Volume ratio >= 1.3 (volume confirmation)
      // 3. Score >= 50 (quality signal)
      const isStrongMover = changePct >= 2 || volumeRatio >= 1.3 || score >= 50;
      
      // At least one strong indicator must be present
      return isStrongMover;
    }).slice(0, 5);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gainersData, losersData] = await Promise.all([
          fetchAPI('/scanners/day-gainers?limit=15'), // Fetch more for filtering
          fetchAPI('/scanners/day-losers?limit=15'),
        ]);
        
        const rawGainers = gainersData?.data || gainersData || [];
        const rawLosers = losersData?.data || losersData || [];
        
        // Apply refinement filter
        setGainers(refineMovers(rawGainers, true));
        setLosers(refineMovers(rawLosers, false));
      } catch (error) {
        // Show empty state on API failure instead of fake data
        setGainers([]);
        setLosers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const StockList = ({ stocks, type }) => (
    <div className="space-y-2">
      {stocks.slice(0, 5).map((stock, i) => {
        // Get percentage change - API returns change_pct as number
        const changePct = stock.change_pct ?? stock.pChange ?? 0;
        const priceValue = stock.price || stock.lastPrice || stock.ltp || 0;
        const volumeRatio = stock.volume_ratio ?? 1;
        const score = stock.score ?? stock.day_trading_score ?? 0;
        
        // Strong mover indicator (volume confirmed)
        const isStrong = volumeRatio >= 1.5 || score >= 60;
        
        return (
          <motion.div
            key={stock.symbol}
            initial={{ opacity: 0, x: type === 'gainer' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full",
                type === 'gainer' ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"
              )}>
                {i + 1}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium group-hover:text-primary transition-colors">{stock.symbol}</p>
                  {isStrong && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      type === 'gainer' ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"
                    )}>
                      🔥
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatINR(priceValue)}
                  {volumeRatio > 1.3 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">Vol {volumeRatio.toFixed(1)}×</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={cn(
                'text-sm font-bold px-2 py-1 rounded-lg',
                type === 'gainer' 
                  ? 'text-bullish-light bg-bullish/10' 
                  : 'text-bearish-light bg-bearish/10'
              )}>
                {changePct >= 0 ? '+' : ''}{Number(changePct).toFixed(2)}%
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Gainers Card */}
      <Card className="h-full border-bullish/20 bg-gradient-to-br from-bullish/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-bullish/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-bullish" />
              </div>
              <CardTitle className="text-lg text-bullish">Top Gainers</CardTitle>
            </div>
            <Badge variant="outline" className="bg-bullish/10 text-bullish border-bullish/30 text-xs">
              🔥 Strong Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-lg" />
              ))}
            </div>
          ) : (
            <StockList stocks={gainers} type="gainer" />
          )}
          <Link 
            to="/scanners?tab=gainers"
            className="flex items-center justify-center gap-1 text-sm text-bullish mt-4 hover:underline font-medium"
          >
            View All Gainers
            <ChevronRight className="w-4 h-4" />
          </Link>
        </CardContent>
      </Card>

      {/* Top Losers Card */}
      <Card className="h-full border-bearish/20 bg-gradient-to-br from-bearish/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-bearish/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-bearish" />
              </div>
              <CardTitle className="text-lg text-bearish">Top Losers</CardTitle>
            </div>
            <Badge variant="outline" className="bg-bearish/15 text-bearish-light border-bearish/30 text-xs">
              🔥 Strong Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-lg" />
              ))}
            </div>
          ) : (
            <StockList stocks={losers} type="loser" />
          )}
          <Link 
            to="/scanners?tab=losers"
            className="flex items-center justify-center gap-1 text-sm text-bearish mt-4 hover:underline font-medium"
          >
            View All Losers
            <ChevronRight className="w-4 h-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FII/DII DATA
// ═══════════════════════════════════════════════════════════════════════════════
const FIIDIIData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchAPI('/fii-dii-data');
        // API returns array like [{fii_net, dii_net, fii_buy, fii_sell, ...}]
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
        // Show empty state instead of fake FII/DII data
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="h-48 skeleton rounded-2xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">FII/DII Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* FII */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">FII</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn(
              'text-2xl font-bold',
              (data?.fii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {(data?.fii?.netValue || 0) >= 0 ? '+' : ''}{(data?.fii?.netValue || 0).toFixed(0)} Cr
            </p>
            <p className="text-xs text-muted-foreground">Net Activity</p>
          </div>
          
          {/* DII */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">DII</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn(
              'text-2xl font-bold',
              (data?.dii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {(data?.dii?.netValue || 0) >= 0 ? '+' : ''}{(data?.dii?.netValue || 0).toFixed(0)} Cr
            </p>
            <p className="text-xs text-muted-foreground">Net Activity</p>
          </div>
        </div>
        
        <Link 
          to="/market"
          className="flex items-center justify-center gap-1 text-sm text-primary mt-4 hover:underline"
        >
          View detailed analysis
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const marketSession = getMarketSession();

  const seo = getSeoConfig('/dashboard');

  return (
    <PageLayout>
      <SEO title={seo.title} description={seo.description} keywords={seo.keywords} path="/dashboard" jsonLd={seo.jsonLd} />
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <Badge 
            variant={marketSession.status === 'open' ? 'success' : 'secondary'}
            className="flex items-center gap-1"
          >
            <span className={cn(
              'w-2 h-2 rounded-full',
              marketSession.status === 'open' ? 'bg-bullish animate-pulse' : 'bg-muted-foreground'
            )} />
            {marketSession.label}
          </Badge>
        </div>
        <p className="text-lg text-muted-foreground font-medium" style={{ color: '#D4A574' }}>
          {getUserFirstName()}
        </p>
        <p className="text-muted-foreground mt-1">
          Here's what's happening in the market today
        </p>
      </motion.div>

      {/* Market Overview */}
      <Section title="Market Overview" className="mb-8">
        <MarketOverview />
      </Section>

      {/* Sector Performance — Where is money flowing? */}
      <Section 
        title="Sector Performance" 
        description="Click any sector to see its top stocks — momentum movers & healthy pullbacks"
        className="mb-8"
      >
        <SectorPerformance />
      </Section>

      {/* Top Gainers & Losers Section */}
      <Section 
        title="Top Movers" 
        description="Today's top performing and declining F&O stocks"
        className="mb-8"
      >
        <TopMovers />
      </Section>

      {/* Quick Tools */}
      <Section 
        title="Trading Tools" 
        description="Access powerful tools with backtested accuracy"
        action={
          <Link to="/scanners">
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        }
        className="mb-8"
      >
        <QuickTools />
      </Section>

      {/* Bottom Grid - FII/DII Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FII/DII */}
        <div>
          <FIIDIIData />
        </div>
      </div>

      {/* AI Advisor CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Card className="p-6 bg-gradient-to-r from-violet-500/10 to-primary/10 border-violet-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <Brain className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  AI Trade Advisor
                  <Badge variant="default" className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                    AI
                  </Badge>
                </h3>
                <p className="text-muted-foreground">
                  Get AI-powered recommendations based on your trades and market sentiment
                </p>
              </div>
            </div>
            <Link to="/algo">
              <Button variant="gradient" className="whitespace-nowrap">
                <Sparkles className="w-4 h-4 mr-2" />
                Open Advisor
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </PageLayout>
  );
};

export default Dashboard;
