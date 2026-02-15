// Sectors Page - All F&O stocks listed by their sector with live % changes
import { useState, useEffect, useMemo, useCallback } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  RefreshCw, Search, ArrowUpRight, ArrowDownRight,
  BarChart3, Filter, ExternalLink, Layers
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { SkeletonPage } from '../components/ui/Skeleton';
import { cn, fetchAPI, formatINR } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════
// SECTOR CARD - Shows sector name, avg change, expand/collapse
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
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
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
              ? <ChevronUp className="w-4 h-4 text-foreground-muted" />
              : <ChevronDown className="w-4 h-4 text-foreground-muted" />}
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
                <div className="grid grid-cols-12 gap-2 py-2 text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
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
                        <ExternalLink className="w-3 h-3 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>

                      {/* Price */}
                      <div className="col-span-3 sm:col-span-3 text-right text-sm text-foreground-muted">
                        {stock.price > 0 ? formatINR(stock.price) : '—'}
                      </div>

                      {/* Change % */}
                      <div className="col-span-3 sm:col-span-3 text-right">
                        <span className={cn(
                          'inline-flex items-center gap-0.5 text-sm font-bold',
                          isFlat ? 'text-foreground-muted' : isUp ? 'text-bullish' : 'text-bearish'
                        )}>
                          {isUp && <ArrowUpRight className="w-3 h-3" />}
                          {!isUp && !isFlat && <ArrowDownRight className="w-3 h-3" />}
                          {isUp ? '+' : ''}{stock.change.toFixed(2)}%
                        </span>
                      </div>

                      {/* Volume */}
                      <div className="col-span-2 sm:col-span-3 text-right text-xs text-foreground-muted hidden sm:block">
                        {stock.volume > 0 ? `${stock.volume.toFixed(1)}M` : '—'}
                      </div>
                    </motion.div>
                  );
                })}

                {filteredStocks.length === 0 && (
                  <p className="text-center text-sm text-foreground-muted py-4">No stocks match your search</p>
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
// MAIN SECTORS PAGE
// ═══════════════════════════════════════════════════════════════
const Sectors = () => {
  const [sectorData, setSectorData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSectors, setExpandedSectors] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('change'); // change | name | stocks
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all sectors with stocks
  const fetchSectors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAPI('/scanners/fno-by-sector');
      if (data && typeof data === 'object') {
        setSectorData(data);
      } else {
        setError('Invalid data format');
      }
    } catch (err) {
      console.error('Sector fetch error:', err);
      setError('Failed to load sector data. Market may be closed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSectors();
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => { if (!document.hidden) fetchSectors(true); }, 120000);
    return () => clearInterval(interval);
  }, [fetchSectors]);

  // Sort sectors
  const sortedSectors = useMemo(() => {
    const entries = Object.entries(sectorData);
    switch (sortBy) {
      case 'change':
        return entries.sort((a, b) => (b[1].avg_change || 0) - (a[1].avg_change || 0));
      case 'name':
        return entries.sort((a, b) => a[0].localeCompare(b[0]));
      case 'stocks':
        return entries.sort((a, b) => (b[1].stocks?.length || 0) - (a[1].stocks?.length || 0));
      default:
        return entries;
    }
  }, [sectorData, sortBy]);

  // Summary stats
  const summary = useMemo(() => {
    const entries = Object.entries(sectorData);
    const totalStocks = entries.reduce((acc, [, v]) => acc + (v.stocks?.length || 0), 0);
    const bullishSectors = entries.filter(([, v]) => (v.avg_change || 0) > 0).length;
    const bearishSectors = entries.filter(([, v]) => (v.avg_change || 0) < 0).length;
    const topSector = entries.sort((a, b) => (b[1].avg_change || 0) - (a[1].avg_change || 0))[0];
    const worstSector = entries.sort((a, b) => (a[1].avg_change || 0) - (b[1].avg_change || 0))[0];
    return { totalStocks, bullishSectors, bearishSectors, topSector, worstSector, totalSectors: entries.length };
  }, [sectorData]);

  const toggleSector = (sector) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSectors(new Set(Object.keys(sectorData)));
  };

  const collapseAll = () => {
    setExpandedSectors(new Set());
  };

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/sectors')} path="/sectors" />
      <PageHeader
        title="Sector Map"
        subtitle="All F&O stocks organized by sector — live prices & changes"
        icon={Layers}
      />

      {/* Summary Bar */}
      {!loading && Object.keys(sectorData).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Total Sectors</div>
            <div className="text-xl font-bold">{summary.totalSectors}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Stocks Tracked</div>
            <div className="text-xl font-bold">{summary.totalStocks}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Market Mood</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-bullish">{summary.bullishSectors} Bullish</span>
              <span className="text-foreground-muted">/</span>
              <span className="text-sm font-bold text-bearish">{summary.bearishSectors} Bearish</span>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Top Sector</div>
            {summary.topSector && (
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold truncate">{summary.topSector[0]}</span>
                <span className="text-xs font-bold text-bullish">
                  +{summary.topSector[1].avg_change?.toFixed(2)}%
                </span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search stock or sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <Filter className="w-3 h-3 text-foreground-muted ml-2" />
            {[
              { key: 'change', label: 'By Change' },
              { key: 'name', label: 'A-Z' },
              { key: 'stocks', label: 'By Size' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  sortBy === opt.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground-muted hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Expand/Collapse All */}
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
          >
            Collapse All
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchSectors(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && <SkeletonPage cards={8} cols={4} />}

      {/* Error State */}
      {error && !loading && (
        <Card className="p-8 text-center">
          <p className="text-foreground-muted mb-3">{error}</p>
          <button
            onClick={() => fetchSectors()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Try Again
          </button>
        </Card>
      )}

      {/* Sector List */}
      {!loading && !error && (
        <div className="space-y-3">
          {sortedSectors.length === 0 ? (
            <Card className="p-8 text-center text-foreground-muted">
              No sector data available
            </Card>
          ) : (
            sortedSectors.map(([sectorName, data]) => (
              <SectorCard
                key={sectorName}
                sector={sectorName}
                stocks={data.stocks || []}
                avgChange={data.avg_change || 0}
                trend={data.trend || 'Neutral'}
                isExpanded={expandedSectors.has(sectorName)}
                onToggle={() => toggleSector(sectorName)}
                searchQuery={searchQuery}
              />
            ))
          )}
        </div>
      )}

      {/* Footer note */}
      {!loading && !error && sortedSectors.length > 0 && (
        <p className="text-center text-xs text-foreground-muted mt-6">
          Data from NSE F&O stocks list • Click any stock to view chart on TradingView
        </p>
      )}
    </PageLayout>
  );
};

export default Sectors;

