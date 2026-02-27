// Sectors – Merged: Sectoral Index Performance + Stock Map (by sector)
import { useState, useEffect, useMemo, useCallback } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  RefreshCw, Search, ArrowUpRight, ArrowDownRight,
  BarChart3, Filter, ExternalLink, Layers, Activity
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { SkeletonPage } from '../components/ui/Skeleton';
import { cn, fetchAPI, formatINR } from '../lib/utils';

// ─── colour helpers (for index performance) ──────────────────
const statusColor = (status) => {
  if (status === 'bullish') return { bg: 'bg-green-500/15', text: 'text-green-500', ring: 'ring-green-500/30', bar: 'bg-green-500' };
  if (status === 'bearish') return { bg: 'bg-red-500/15', text: 'text-red-500', ring: 'ring-red-500/30', bar: 'bg-red-500' };
  return { bg: 'bg-gray-500/15', text: 'text-gray-500', ring: 'ring-gray-500/30', bar: 'bg-gray-500' };
};

// ─── small stat pill ─────────────────────────────────────────
const Pill = ({ label, value, positive }) => (
  <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-muted/40">
    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    <span className={cn('text-sm font-bold', positive === true && 'text-green-500', positive === false && 'text-red-500')}>
      {value}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// SECTOR ROW – single index (for Index Performance tab)
// ═══════════════════════════════════════════════════════════════
const SectorRow = ({ sector, maxAbsChange, isExpanded, onToggle }) => {
  const c = statusColor(sector.status);
  const pct = sector.change_percent;
  const barWidth = maxAbsChange > 0 ? Math.min(100, (Math.abs(pct) / maxAbsChange) * 100) : 0;
  const isPos = pct >= 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('overflow-hidden transition-all duration-200', isExpanded && `ring-1 ${c.ring}`)}>
        <button onClick={onToggle} className="w-full text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', c.bg)}>
            {sector.status === 'bullish' ? <TrendingUp className={cn('w-4 h-4', c.text)} />
              : sector.status === 'bearish' ? <TrendingDown className={cn('w-4 h-4', c.text)} />
              : <Minus className={cn('w-4 h-4', c.text)} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{sector.name}</h3>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{sector.index_name}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', c.bar)}
                style={{ width: `${barWidth}%`, opacity: 0.8 }}
              />
            </div>
          </div>
          <div className="text-right shrink-0 min-w-[100px]">
            <div className="text-sm font-medium">{sector.ltp > 0 ? formatINR(sector.ltp) : '—'}</div>
            <div className={cn('text-sm font-bold flex items-center justify-end gap-0.5', c.text)}>
              {isPos ? <ArrowUpRight className="w-3 h-3" /> : pct < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
              {isPos ? '+' : ''}{pct.toFixed(2)}%
            </div>
          </div>
          <div className="shrink-0">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Pill label="Open" value={sector.open > 0 ? formatINR(sector.open) : '—'} />
                  <Pill label="High" value={sector.high > 0 ? formatINR(sector.high) : '—'} />
                  <Pill label="Low" value={sector.low > 0 ? formatINR(sector.low) : '—'} />
                  <Pill label="Prev Close" value={sector.prev_close > 0 ? formatINR(sector.prev_close) : '—'} />
                  <Pill label="Advances" value={sector.advances} positive={true} />
                  <Pill label="Declines" value={sector.declines} positive={false} />
                  {sector.pe && <Pill label="P/E" value={sector.pe} />}
                  {sector.pb && <Pill label="P/B" value={sector.pb} />}
                  {sector.change_30d !== 0 && <Pill label="30D" value={`${sector.change_30d > 0 ? '+' : ''}${sector.change_30d.toFixed(1)}%`} positive={sector.change_30d > 0} />}
                  {sector.change_365d !== 0 && <Pill label="1Y" value={`${sector.change_365d > 0 ? '+' : ''}${sector.change_365d.toFixed(1)}%`} positive={sector.change_365d > 0} />}
                </div>

                {sector.year_high > 0 && sector.year_low > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">52-Week Range</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatINR(sector.year_low)}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/50 relative">
                        <div
                          className="absolute h-3 w-3 rounded-full bg-primary border-2 border-background top-1/2 -translate-y-1/2"
                          style={{ left: `${Math.min(100, Math.max(0, ((sector.ltp - sector.year_low) / (sector.year_high - sector.year_low)) * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{formatINR(sector.year_high)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">
                    Key Stocks ({sector.stocks_count})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(sector.all_stocks || []).map((sym) => (
                      <a
                        key={sym}
                        href={`https://www.tradingview.com/chart/?symbol=NSE:${sym}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/50 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors group"
                      >
                        {sym}
                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECTOR CARD – Shows sector name + expandable stock list (for Stock Map tab)
// ═══════════════════════════════════════════════════════════════
const SectorCard = ({ sector, stocks, avgChange, trend, isExpanded, onToggle, searchQuery }) => {
  const gainers = stocks.filter(s => s.change > 0).length;
  const losers = stocks.filter(s => s.change < 0).length;
  const isPositive = avgChange >= 0;

  // Filter stocks by search query
  const filteredStocks = useMemo(() => {
    if (!searchQuery) return stocks;
    const q = searchQuery.toLowerCase();
    return stocks.filter(s =>
      s.symbol?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q)
    );
  }, [stocks, searchQuery]);

  // If search is active and no stocks match, hide entire sector
  if (searchQuery && filteredStocks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden"
    >
      <Card className={cn(
        'transition-all duration-200',
        isExpanded && 'ring-1 ring-primary/30'
      )}>
        {/* Sector Header - clickable to expand */}
        <button
          onClick={onToggle}
          className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              isPositive ? 'bg-bullish/15' : 'bg-bearish/15'
            )}>
              {isPositive
                ? <TrendingUp className="w-5 h-5 text-bullish" />
                : <TrendingDown className="w-5 h-5 text-bearish" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{sector}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{stocks.length} stocks</span>
                <span>•</span>
                <span className="text-bullish">{gainers} up</span>
                <span className="text-bearish">{losers} down</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={cn(
                'text-sm font-bold',
                isPositive ? 'text-bullish' : 'text-bearish'
              )}>
                {isPositive ? '+' : ''}{avgChange.toFixed(2)}%
              </div>
              <div className={cn(
                'text-[10px] font-medium',
                trend === 'Bullish' ? 'text-bullish/70' : 'text-bearish/70'
              )}>
                {trend}
              </div>
            </div>
            {isExpanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {/* Expanded stock list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 border-t border-border/50">
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-4 sm:col-span-3">Symbol</div>
                  <div className="col-span-3 sm:col-span-3 text-right">Price</div>
                  <div className="col-span-3 sm:col-span-3 text-right">Change %</div>
                  <div className="col-span-2 sm:col-span-3 text-right hidden sm:block">Volume</div>
                </div>

                {/* Stock rows */}
                {filteredStocks.map((stock, i) => {
                  const isUp = stock.change > 0;
                  const isFlat = stock.change === 0;
                  return (
                    <motion.div
                      key={stock.symbol}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                      className={cn(
                        'grid grid-cols-12 gap-2 py-2 items-center cursor-pointer rounded-lg px-1 -mx-1',
                        'hover:bg-muted/40 transition-colors group',
                        i > 0 && 'border-t border-border/30'
                      )}
                    >
                      {/* Symbol */}
                      <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {stock.symbol}
                        </span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>

                      {/* Price */}
                      <div className="col-span-3 sm:col-span-3 text-right text-sm text-muted-foreground">
                        {stock.price > 0 ? formatINR(stock.price) : '—'}
                      </div>

                      {/* Change % */}
                      <div className="col-span-3 sm:col-span-3 text-right">
                        <span className={cn(
                          'inline-flex items-center gap-0.5 text-sm font-bold',
                          isFlat ? 'text-muted-foreground' : isUp ? 'text-bullish' : 'text-bearish'
                        )}>
                          {isUp && <ArrowUpRight className="w-3 h-3" />}
                          {!isUp && !isFlat && <ArrowDownRight className="w-3 h-3" />}
                          {isUp ? '+' : ''}{stock.change.toFixed(2)}%
                        </span>
                      </div>

                      {/* Volume */}
                      <div className="col-span-2 sm:col-span-3 text-right text-xs text-muted-foreground hidden sm:block">
                        {stock.volume > 0 ? `${stock.volume.toFixed(1)}M` : '—'}
                      </div>
                    </motion.div>
                  );
                })}

                {filteredStocks.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No stocks match your search</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TAB BUTTON
// ═══════════════════════════════════════════════════════════════
const TabButton = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
      active
        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

// ═══════════════════════════════════════════════════════════════
// MAIN MERGED PAGE
// ═══════════════════════════════════════════════════════════════
const Sectors = () => {
  const [tab, setTab] = useState('index'); // 'index' | 'stocks'

  // ── Index Performance state ──
  const [indexData, setIndexData] = useState(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(null);
  const [indexRefreshing, setIndexRefreshing] = useState(false);
  const [indexExpanded, setIndexExpanded] = useState(new Set());
  const [indexSort, setIndexSort] = useState('change');

  // ── Stock Map state ──
  const [stockData, setStockData] = useState({});
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState(null);
  const [stockRefreshing, setStockRefreshing] = useState(false);
  const [stockExpanded, setStockExpanded] = useState(new Set());
  const [stockSort, setStockSort] = useState('change');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Fetch: Index Performance ──
  const fetchIndex = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIndexRefreshing(true);
    else setIndexLoading(true);
    setIndexError(null);
    try {
      const res = await fetchAPI('/fno/sectors/performance');
      if (res && res.sectors) setIndexData(res);
      else setIndexError('No sector data returned');
    } catch (err) {
      console.error('Sector perf error:', err);
      setIndexError('Failed to load sector data. Market may be closed.');
    } finally {
      setIndexLoading(false);
      setIndexRefreshing(false);
    }
  }, []);

  // ── Fetch: Stock Map ──
  const fetchStocks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setStockRefreshing(true);
    else setStockLoading(true);
    setStockError(null);
    try {
      const data = await fetchAPI('/scanners/fno-by-sector');
      if (data && typeof data === 'object') setStockData(data);
      else setStockError('Invalid data format');
    } catch (err) {
      console.error('Sector fetch error:', err);
      setStockError('Failed to load sector data. Market may be closed.');
    } finally {
      setStockLoading(false);
      setStockRefreshing(false);
    }
  }, []);

  // Fetch both on mount
  useEffect(() => {
    fetchIndex();
    fetchStocks();
    const iv = setInterval(() => {
      if (!document.hidden) {
        fetchIndex(true);
        fetchStocks(true);
      }
    }, 120_000);
    return () => clearInterval(iv);
  }, [fetchIndex, fetchStocks]);

  // ── Index Performance derived ──
  const indexSectors = useMemo(() => {
    if (!indexData?.sectors) return [];
    const arr = [...indexData.sectors];
    if (indexSort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [indexData, indexSort]);

  const maxAbsChange = useMemo(() => {
    if (!indexSectors.length) return 1;
    return Math.max(...indexSectors.map((s) => Math.abs(s.change_percent)), 0.01);
  }, [indexSectors]);

  const indexMood = indexData?.market_mood || {};

  const toggleIndex = (id) =>
    setIndexExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Stock Map derived ──
  const sortedStockSectors = useMemo(() => {
    const entries = Object.entries(stockData);
    switch (stockSort) {
      case 'change':
        return entries.sort((a, b) => (b[1].avg_change || 0) - (a[1].avg_change || 0));
      case 'name':
        return entries.sort((a, b) => a[0].localeCompare(b[0]));
      case 'stocks':
        return entries.sort((a, b) => (b[1].stocks?.length || 0) - (a[1].stocks?.length || 0));
      default:
        return entries;
    }
  }, [stockData, stockSort]);

  const stockSummary = useMemo(() => {
    const entries = Object.entries(stockData);
    const totalStocks = entries.reduce((acc, [, v]) => acc + (v.stocks?.length || 0), 0);
    const bullishSectors = entries.filter(([, v]) => (v.avg_change || 0) > 0).length;
    const bearishSectors = entries.filter(([, v]) => (v.avg_change || 0) < 0).length;
    const topSector = entries.sort((a, b) => (b[1].avg_change || 0) - (a[1].avg_change || 0))[0];
    return { totalStocks, bullishSectors, bearishSectors, topSector, totalSectors: entries.length };
  }, [stockData]);

  const toggleStock = (sector) => {
    setStockExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector); else next.add(sector);
      return next;
    });
  };

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/sectors')} path="/sectors" />
      <PageHeader
        title="Sectors"
        subtitle="Sectoral index performance & F&O stocks by sector"
        icon={Layers}
      />

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 mb-5">
        <TabButton active={tab === 'index'} icon={BarChart3} label="Index Performance" onClick={() => setTab('index')} />
        <TabButton active={tab === 'stocks'} icon={Layers} label="Stock Map" onClick={() => setTab('stocks')} />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          INDEX PERFORMANCE TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'index' && (
        <>
          {!indexLoading && indexData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Sectors</div>
                <div className="text-xl font-bold">{indexData.total_sectors}</div>
              </Card>
              <Card className="p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Mood</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-green-500">{indexMood.bullish || 0}</span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="text-sm font-bold text-red-500">{indexMood.bearish || 0}</span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="text-sm font-bold text-gray-500">{indexMood.neutral || 0}</span>
                </div>
              </Card>
              {indexSectors[0] && (
                <Card className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Sector</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-sm font-bold truncate">{indexSectors[0].name}</span>
                    <span className="text-xs font-bold text-green-500">+{indexSectors[0].change_percent.toFixed(2)}%</span>
                  </div>
                </Card>
              )}
              {indexSectors.length > 1 && (
                <Card className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Worst Sector</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-sm font-bold truncate">{indexSectors[indexSectors.length - 1].name}</span>
                    <span className="text-xs font-bold text-red-500">
                      {indexSectors[indexSectors.length - 1].change_percent.toFixed(2)}%
                    </span>
                  </div>
                </Card>
              )}
            </div>
          )}

          {!indexLoading && indexData && (
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                {[{ key: 'change', label: 'By Change' }, { key: 'name', label: 'A-Z' }].map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setIndexSort(o.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      indexSort === o.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIndexExpanded(new Set(indexSectors.map((s) => s.id)))} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors">Expand All</button>
                <button onClick={() => setIndexExpanded(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors">Collapse All</button>
                <button onClick={() => fetchIndex(true)} disabled={indexRefreshing} className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <RefreshCw className={cn('w-4 h-4', indexRefreshing && 'animate-spin')} />
                </button>
              </div>
            </div>
          )}

          {indexLoading && <SkeletonPage cards={11} cols={4} />}
          {indexError && !indexLoading && (
            <Card className="p-8 text-center">
              <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-3">{indexError}</p>
              <button onClick={() => fetchIndex()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Try Again</button>
            </Card>
          )}
          {!indexLoading && !indexError && indexSectors.length > 0 && (
            <div className="space-y-2">
              {indexSectors.map((s) => (
                <SectorRow key={s.id} sector={s} maxAbsChange={maxAbsChange} isExpanded={indexExpanded.has(s.id)} onToggle={() => toggleIndex(s.id)} />
              ))}
            </div>
          )}
          {!indexLoading && !indexError && indexData && (
            <p className="text-center text-xs text-muted-foreground mt-6">
              Data from NSE sectoral indices • Auto-refreshes every 2 minutes • Click stock to view on TradingView
            </p>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          STOCK MAP TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'stocks' && (
        <>
          {!stockLoading && Object.keys(stockData).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Total Sectors</div>
                <div className="text-xl font-bold">{stockSummary.totalSectors}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Stocks Tracked</div>
                <div className="text-xl font-bold">{stockSummary.totalStocks}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Market Mood</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-bullish">{stockSummary.bullishSectors} Bullish</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-sm font-bold text-bearish">{stockSummary.bearishSectors} Bearish</span>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Top Sector</div>
                {stockSummary.topSector && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold truncate">{stockSummary.topSector[0]}</span>
                    <span className="text-xs font-bold text-bullish">
                      +{stockSummary.topSector[1].avg_change?.toFixed(2)}%
                    </span>
                  </div>
                )}
              </Card>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search stock or sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                <Filter className="w-3 h-3 text-muted-foreground ml-2" />
                {[
                  { key: 'change', label: 'By Change' },
                  { key: 'name', label: 'A-Z' },
                  { key: 'stocks', label: 'By Size' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setStockSort(opt.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      stockSort === opt.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setStockExpanded(new Set(Object.keys(stockData)))} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors">Expand All</button>
              <button onClick={() => setStockExpanded(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors">Collapse All</button>
              <button onClick={() => fetchStocks(true)} disabled={stockRefreshing} className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <RefreshCw className={cn('w-4 h-4', stockRefreshing && 'animate-spin')} />
              </button>
            </div>
          </div>

          {stockLoading && <SkeletonPage cards={8} cols={4} />}
          {stockError && !stockLoading && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-3">{stockError}</p>
              <button onClick={() => fetchStocks()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Try Again</button>
            </Card>
          )}
          {!stockLoading && !stockError && (
            <div className="space-y-3">
              {sortedStockSectors.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">No sector data available</Card>
              ) : (
                sortedStockSectors.map(([sectorName, data]) => (
                  <SectorCard
                    key={sectorName}
                    sector={sectorName}
                    stocks={data.stocks || []}
                    avgChange={data.avg_change || 0}
                    trend={data.trend || 'Neutral'}
                    isExpanded={stockExpanded.has(sectorName)}
                    onToggle={() => toggleStock(sectorName)}
                    searchQuery={searchQuery}
                  />
                ))
              )}
            </div>
          )}
          {!stockLoading && !stockError && sortedStockSectors.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mt-6">
              Data from NSE F&O stocks list • Click any stock to view chart on TradingView
            </p>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default Sectors;

