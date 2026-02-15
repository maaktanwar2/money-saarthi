// SectorPerformance – 11 NSE F&O Sectoral Index performance (TradeFinder-style)
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  Activity, ExternalLink
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { Card, Spinner } from '../components/ui';
import { cn, fetchAPI, formatINR } from '../lib/utils';

// ─── colour helpers ──────────────────────────────────────────
const statusColor = (status) => {
  if (status === 'bullish') return { bg: 'bg-green-500/15', text: 'text-green-500', ring: 'ring-green-500/30', bar: 'bg-green-500' };
  if (status === 'bearish') return { bg: 'bg-red-500/15', text: 'text-red-500', ring: 'ring-red-500/30', bar: 'bg-red-500' };
  return { bg: 'bg-gray-500/15', text: 'text-gray-500', ring: 'ring-gray-500/30', bar: 'bg-gray-500' };
};

// ─── small stat pill ─────────────────────────────────────────
const Pill = ({ label, value, positive }) => (
  <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-muted/40">
    <span className="text-[10px] text-foreground-muted uppercase tracking-wider">{label}</span>
    <span className={cn('text-sm font-bold', positive === true && 'text-green-500', positive === false && 'text-red-500')}>
      {value}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// SECTOR ROW – single sector bar
// ═══════════════════════════════════════════════════════════════
const SectorRow = ({ sector, maxAbsChange, isExpanded, onToggle }) => {
  const c = statusColor(sector.status);
  const pct = sector.change_percent;
  const barWidth = maxAbsChange > 0 ? Math.min(100, (Math.abs(pct) / maxAbsChange) * 100) : 0;
  const isPos = pct >= 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('overflow-hidden transition-all duration-200', isExpanded && `ring-1 ${c.ring}`)}>
        {/* main clickable row */}
        <button onClick={onToggle} className="w-full text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
          {/* icon */}
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', c.bg)}>
            {sector.status === 'bullish' ? <TrendingUp className={cn('w-4 h-4', c.text)} />
              : sector.status === 'bearish' ? <TrendingDown className={cn('w-4 h-4', c.text)} />
              : <Minus className={cn('w-4 h-4', c.text)} />}
          </div>

          {/* name + index */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{sector.name}</h3>
              <span className="text-[10px] text-foreground-muted hidden sm:inline">{sector.index_name}</span>
            </div>
            {/* bar */}
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', c.bar)}
                style={{ width: `${barWidth}%`, opacity: 0.8 }}
              />
            </div>
          </div>

          {/* LTP + change */}
          <div className="text-right shrink-0 min-w-[100px]">
            <div className="text-sm font-medium">{sector.ltp > 0 ? formatINR(sector.ltp) : '—'}</div>
            <div className={cn('text-sm font-bold flex items-center justify-end gap-0.5', c.text)}>
              {isPos ? <ArrowUpRight className="w-3 h-3" /> : pct < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
              {isPos ? '+' : ''}{pct.toFixed(2)}%
            </div>
          </div>

          {/* chevron */}
          <div className="shrink-0">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-foreground-muted" /> : <ChevronDown className="w-4 h-4 text-foreground-muted" />}
          </div>
        </button>

        {/* expanded detail */}
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
                {/* stats row */}
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

                {/* 52-week range */}
                {sector.year_high > 0 && sector.year_low > 0 && (
                  <div>
                    <div className="text-[10px] text-foreground-muted mb-1 uppercase tracking-wider">52-Week Range</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground-muted">{formatINR(sector.year_low)}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/50 relative">
                        <div
                          className="absolute h-3 w-3 rounded-full bg-primary border-2 border-background top-1/2 -translate-y-1/2"
                          style={{ left: `${Math.min(100, Math.max(0, ((sector.ltp - sector.year_low) / (sector.year_high - sector.year_low)) * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs text-foreground-muted">{formatINR(sector.year_high)}</span>
                    </div>
                  </div>
                )}

                {/* constituent stocks */}
                <div>
                  <div className="text-[10px] text-foreground-muted mb-1.5 uppercase tracking-wider">
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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const SectorPerformance = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [sortBy, setSortBy] = useState('change'); // change | name

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchAPI('/fno/sectors/performance');
      if (res && res.sectors) setData(res);
      else setError('No sector data returned');
    } catch (err) {
      console.error('Sector perf error:', err);
      setError('Failed to load sector data. Market may be closed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(true), 120_000); // 2 min refresh
    return () => clearInterval(iv);
  }, [fetchData]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const sectors = useMemo(() => {
    if (!data?.sectors) return [];
    const arr = [...data.sectors];
    if (sortBy === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    // default already sorted by change from backend
    return arr;
  }, [data, sortBy]);

  const maxAbsChange = useMemo(() => {
    if (!sectors.length) return 1;
    return Math.max(...sectors.map((s) => Math.abs(s.change_percent)), 0.01);
  }, [sectors]);

  const mood = data?.market_mood || {};

  return (
    <PageLayout>
      <PageHeader
        title="Sector Performance"
        subtitle="11 NSE F&O sectoral indices — live index data"
        icon={BarChart3}
      />

      {/* ── Top summary cards ── */}
      {!loading && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-3">
            <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Sectors</div>
            <div className="text-xl font-bold">{data.total_sectors}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Mood</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-green-500">{mood.bullish || 0}</span>
              <span className="text-foreground-muted text-xs">/</span>
              <span className="text-sm font-bold text-red-500">{mood.bearish || 0}</span>
              <span className="text-foreground-muted text-xs">/</span>
              <span className="text-sm font-bold text-gray-500">{mood.neutral || 0}</span>
            </div>
          </Card>
          {sectors[0] && (
            <Card className="p-3">
              <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Top Sector</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm font-bold truncate">{sectors[0].name}</span>
                <span className="text-xs font-bold text-green-500">+{sectors[0].change_percent.toFixed(2)}%</span>
              </div>
            </Card>
          )}
          {sectors.length > 1 && (
            <Card className="p-3">
              <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Worst Sector</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm font-bold truncate">{sectors[sectors.length - 1].name}</span>
                <span className="text-xs font-bold text-red-500">
                  {sectors[sectors.length - 1].change_percent.toFixed(2)}%
                </span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Controls ── */}
      {!loading && data && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            {[
              { key: 'change', label: 'By Change' },
              { key: 'name', label: 'A-Z' },
            ].map((o) => (
              <button
                key={o.key}
                onClick={() => setSortBy(o.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  sortBy === o.key ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(new Set(sectors.map((s) => s.id)))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={() => setExpanded(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
            >
              Collapse All
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner className="w-8 h-8" />
          <p className="text-sm text-foreground-muted">Loading sector performance…</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <Card className="p-8 text-center">
          <Activity className="w-10 h-10 mx-auto mb-3 text-foreground-muted" />
          <p className="text-foreground-muted mb-3">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Try Again
          </button>
        </Card>
      )}

      {/* ── Sector rows ── */}
      {!loading && !error && sectors.length > 0 && (
        <div className="space-y-2">
          {sectors.map((s) => (
            <SectorRow
              key={s.id}
              sector={s}
              maxAbsChange={maxAbsChange}
              isExpanded={expanded.has(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {!loading && !error && data && (
        <p className="text-center text-xs text-foreground-muted mt-6">
          Data from NSE sectoral indices • Auto-refreshes every 2 minutes • Click stock to view on TradingView
        </p>
      )}
    </PageLayout>
  );
};

export default SectorPerformance;

