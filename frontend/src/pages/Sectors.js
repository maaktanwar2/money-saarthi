// Sectors – Merged: Sectoral Index Performance + Stock Map (by sector)
import { useState, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  RefreshCw, Search, ArrowUpRight, ArrowDownRight,
  BarChart3, Filter, ExternalLink, Layers, Activity
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { Card, Button } from '../components/ui';
import { SkeletonPage } from '../components/ui/Skeleton';
import { fetchAPI, formatINR } from '../lib/utils';

// ─── small stat pill ─────────────────────────────────────────
const Pill = ({ label, value, positive }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      px: 1.5,
      py: 0.75,
      borderRadius: 2,
      bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
    }}
  >
    <Typography
      sx={{
        fontSize: '10px',
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      fontWeight={700}
      sx={{
        color:
          positive === true
            ? 'success.main'
            : positive === false
            ? 'error.main'
            : 'text.primary',
      }}
    >
      {value}
    </Typography>
  </Box>
);

// ═══════════════════════════════════════════════════════════════
// SECTOR ROW – single index (for Index Performance tab)
// ═══════════════════════════════════════════════════════════════
const SectorRow = ({ sector, maxAbsChange, isExpanded, onToggle }) => {
  const theme = useTheme();

  const getStatusColor = (status) => {
    if (status === 'bullish') return theme.palette.success.main;
    if (status === 'bearish') return theme.palette.error.main;
    return theme.palette.text.secondary;
  };

  const statusClr = getStatusColor(sector.status);
  const pct = sector.change_percent;
  const barWidth = maxAbsChange > 0 ? Math.min(100, (Math.abs(pct) / maxAbsChange) * 100) : 0;
  const isPos = pct >= 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        sx={{
          overflow: 'hidden',
          transition: 'all 0.2s',
          ...(isExpanded && {
            outline: `1px solid ${alpha(statusClr, 0.3)}`,
          }),
        }}
      >
        {/* main clickable row */}
        <Box
          component="button"
          onClick={onToggle}
          sx={{
            width: '100%',
            textAlign: 'left',
            p: { xs: 1.5, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            bgcolor: 'transparent',
            border: 'none',
            color: 'text.primary',
            '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.03) },
            transition: 'background-color 0.2s',
          }}
        >
          {/* icon */}
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: alpha(statusClr, 0.15),
            }}
          >
            {sector.status === 'bullish' ? (
              <TrendingUp style={{ width: 16, height: 16, color: statusClr }} />
            ) : sector.status === 'bearish' ? (
              <TrendingDown style={{ width: 16, height: 16, color: statusClr }} />
            ) : (
              <Minus style={{ width: 16, height: 16, color: statusClr }} />
            )}
          </Box>

          {/* name + index + bar */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {sector.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: '10px' }}
              >
                {sector.index_name}
              </Typography>
            </Stack>
            {/* bar */}
            <Box
              sx={{
                mt: 0.5,
                height: 6,
                width: '100%',
                borderRadius: 3,
                bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  bgcolor: statusClr,
                  opacity: 0.8,
                  transition: 'width 0.5s',
                  width: `${barWidth}%`,
                }}
              />
            </Box>
          </Box>

          {/* LTP + change */}
          <Box sx={{ textAlign: 'right', flexShrink: 0, minWidth: 100 }}>
            <Typography variant="body2" fontWeight={500}>
              {sector.ltp > 0 ? formatINR(sector.ltp) : '\u2014'}
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="flex-end"
              spacing={0.25}
              sx={{ color: statusClr }}
            >
              {isPos ? (
                <ArrowUpRight style={{ width: 12, height: 12 }} />
              ) : pct < 0 ? (
                <ArrowDownRight style={{ width: 12, height: 12 }} />
              ) : null}
              <Typography variant="body2" fontWeight={700} sx={{ color: 'inherit' }}>
                {isPos ? '+' : ''}{pct.toFixed(2)}%
              </Typography>
            </Stack>
          </Box>

          {/* chevron */}
          <Box sx={{ flexShrink: 0 }}>
            {isExpanded ? (
              <ChevronUp style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
            ) : (
              <ChevronDown style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
            )}
          </Box>
        </Box>

        {/* expanded detail */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <Box
                sx={{
                  px: 2,
                  pb: 2,
                  borderTop: 1,
                  borderColor: (t) => alpha(t.palette.divider, 0.4),
                  pt: 1.5,
                }}
              >
                {/* stats row */}
                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
                  <Pill label="Open" value={sector.open > 0 ? formatINR(sector.open) : '\u2014'} />
                  <Pill label="High" value={sector.high > 0 ? formatINR(sector.high) : '\u2014'} />
                  <Pill label="Low" value={sector.low > 0 ? formatINR(sector.low) : '\u2014'} />
                  <Pill label="Prev Close" value={sector.prev_close > 0 ? formatINR(sector.prev_close) : '\u2014'} />
                  <Pill label="Advances" value={sector.advances} positive={true} />
                  <Pill label="Declines" value={sector.declines} positive={false} />
                  {sector.pe && <Pill label="P/E" value={sector.pe} />}
                  {sector.pb && <Pill label="P/B" value={sector.pb} />}
                  {sector.change_30d !== 0 && (
                    <Pill label="30D" value={`${sector.change_30d > 0 ? '+' : ''}${sector.change_30d.toFixed(1)}%`} positive={sector.change_30d > 0} />
                  )}
                  {sector.change_365d !== 0 && (
                    <Pill label="1Y" value={`${sector.change_365d > 0 ? '+' : ''}${sector.change_365d.toFixed(1)}%`} positive={sector.change_365d > 0} />
                  )}
                </Stack>

                {/* 52-week range */}
                {sector.year_high > 0 && sector.year_low > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography
                      sx={{
                        fontSize: '10px',
                        color: 'text.secondary',
                        mb: 0.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      52-Week Range
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        {formatINR(sector.year_low)}
                      </Typography>
                      <Box
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            height: 12,
                            width: 12,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            border: 2,
                            borderColor: 'background.default',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            left: `${Math.min(100, Math.max(0, ((sector.ltp - sector.year_low) / (sector.year_high - sector.year_low)) * 100))}%`,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatINR(sector.year_high)}
                      </Typography>
                    </Stack>
                  </Box>
                )}

                {/* constituent stocks */}
                <Box>
                  <Typography
                    sx={{
                      fontSize: '10px',
                      color: 'text.secondary',
                      mb: 0.75,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Key Stocks ({sector.stocks_count})
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {(sector.all_stocks || []).map((sym) => (
                      <Box
                        key={sym}
                        component="a"
                        href={`https://www.tradingview.com/chart/?symbol=NSE:${sym}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.25,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1.5,
                          bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'text.primary',
                          textDecoration: 'none',
                          '&:hover': {
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                            color: 'primary.main',
                          },
                          transition: 'all 0.2s',
                          '& .ext-icon': { opacity: 0, transition: 'opacity 0.2s' },
                          '&:hover .ext-icon': { opacity: 1 },
                        }}
                      >
                        {sym}
                        <ExternalLink className="ext-icon" style={{ width: 10, height: 10 }} />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
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
  const theme = useTheme();
  const gainers = stocks.filter(s => s.change > 0).length;
  const losers = stocks.filter(s => s.change < 0).length;
  const isPositive = avgChange >= 0;

  const bullishClr = theme.palette.bullish.main;
  const bearishClr = theme.palette.bearish.main;

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
      style={{ overflow: 'hidden' }}
    >
      <Card
        sx={{
          transition: 'all 0.2s',
          ...(isExpanded && {
            outline: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          }),
        }}
      >
        {/* Sector Header - clickable to expand */}
        <Box
          component="button"
          onClick={onToggle}
          sx={{
            width: '100%',
            textAlign: 'left',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            bgcolor: 'transparent',
            border: 'none',
            color: 'text.primary',
            '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.03) },
            transition: 'background-color 0.2s',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                bgcolor: isPositive ? alpha(bullishClr, 0.15) : alpha(bearishClr, 0.15),
              }}
            >
              {isPositive
                ? <TrendingUp style={{ width: 20, height: 20, color: bullishClr }} />
                : <TrendingDown style={{ width: 20, height: 20, color: bearishClr }} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {sector}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  {stocks.length} stocks
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {'\u2022'}
                </Typography>
                <Typography variant="caption" sx={{ color: bullishClr }}>
                  {gainers} up
                </Typography>
                <Typography variant="caption" sx={{ color: bearishClr }}>
                  {losers} down
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ color: isPositive ? bullishClr : bearishClr }}
              >
                {isPositive ? '+' : ''}{avgChange.toFixed(2)}%
              </Typography>
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: trend === 'Bullish'
                    ? alpha(bullishClr, 0.7)
                    : alpha(bearishClr, 0.7),
                }}
              >
                {trend}
              </Typography>
            </Box>
            {isExpanded
              ? <ChevronUp style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
              : <ChevronDown style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />}
          </Stack>
        </Box>

        {/* Expanded stock list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <Box
                sx={{
                  px: 2,
                  pb: 2,
                  borderTop: 1,
                  borderColor: (t) => alpha(t.palette.divider, 0.5),
                }}
              >
                {/* Column headers */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '4fr 3fr 5fr', sm: '3fr 3fr 3fr 3fr' },
                    gap: 1,
                    py: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Symbol
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'right',
                    }}
                  >
                    Price
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'right',
                    }}
                  >
                    Change %
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'right',
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    Volume
                  </Typography>
                </Box>

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
                    >
                      <Box
                        onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '4fr 3fr 5fr', sm: '3fr 3fr 3fr 3fr' },
                          gap: 1,
                          py: 1,
                          alignItems: 'center',
                          cursor: 'pointer',
                          borderRadius: 2,
                          px: 0.5,
                          mx: -0.5,
                          '&:hover': {
                            bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                          },
                          transition: 'background-color 0.2s',
                          ...(i > 0 && {
                            borderTop: '1px solid',
                            borderColor: (t) => alpha(t.palette.divider, 0.3),
                          }),
                          '& .ext-icon': { opacity: 0, transition: 'opacity 0.2s' },
                          '&:hover .ext-icon': { opacity: 1 },
                          '&:hover .sym-text': { color: theme.palette.primary.main },
                        }}
                      >
                        {/* Symbol */}
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                          <Typography
                            className="sym-text"
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{ transition: 'color 0.2s' }}
                          >
                            {stock.symbol}
                          </Typography>
                          <ExternalLink
                            className="ext-icon"
                            style={{
                              width: 12,
                              height: 12,
                              color: theme.palette.text.secondary,
                              flexShrink: 0,
                            }}
                          />
                        </Stack>

                        {/* Price */}
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                          {stock.price > 0 ? formatINR(stock.price) : '\u2014'}
                        </Typography>

                        {/* Change % */}
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="flex-end"
                          spacing={0.25}
                        >
                          {isUp && <ArrowUpRight style={{ width: 12, height: 12, color: bullishClr }} />}
                          {!isUp && !isFlat && <ArrowDownRight style={{ width: 12, height: 12, color: bearishClr }} />}
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                              color: isFlat
                                ? 'text.secondary'
                                : isUp
                                ? bullishClr
                                : bearishClr,
                            }}
                          >
                            {isUp ? '+' : ''}{stock.change.toFixed(2)}%
                          </Typography>
                        </Stack>

                        {/* Volume */}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}
                        >
                          {stock.volume > 0 ? `${stock.volume.toFixed(1)}M` : '\u2014'}
                        </Typography>
                      </Box>
                    </motion.div>
                  );
                })}

                {filteredStocks.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No stocks match your search
                  </Typography>
                )}
              </Box>
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
  <Box
    component="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 2,
      py: 1,
      borderRadius: 3,
      fontSize: '0.875rem',
      fontWeight: 600,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
      ...(active
        ? {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: (t) => `0 8px 24px ${alpha(t.palette.primary.main, 0.25)}`,
          }
        : {
            bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
            color: 'text.secondary',
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.text.primary, 0.1),
              color: 'text.primary',
            },
          }),
    }}
  >
    <Icon style={{ width: 16, height: 16 }} />
    {label}
  </Box>
);

// ═══════════════════════════════════════════════════════════════
// MAIN MERGED PAGE
// ═══════════════════════════════════════════════════════════════
const Sectors = () => {
  const [tab, setTab] = useState('index'); // 'index' | 'stocks'
  const theme = useTheme();

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

      {/* Tab Switcher */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
        <TabButton active={tab === 'index'} icon={BarChart3} label="Index Performance" onClick={() => setTab('index')} />
        <TabButton active={tab === 'stocks'} icon={Layers} label="Stock Map" onClick={() => setTab('stocks')} />
      </Stack>

      {/* ═══════════════════════════════════════════════════════════
          INDEX PERFORMANCE TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'index' && (
        <>
          {!indexLoading && indexData && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Card sx={{ p: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: '10px',
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Sectors
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {indexData.total_sectors}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography
                  sx={{
                    fontSize: '10px',
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Mood
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {indexMood.bullish || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">/</Typography>
                  <Typography variant="body2" fontWeight={700} color="error.main">
                    {indexMood.bearish || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">/</Typography>
                  <Typography variant="body2" fontWeight={700} color="text.secondary">
                    {indexMood.neutral || 0}
                  </Typography>
                </Stack>
              </Card>
              {indexSectors[0] && (
                <Card sx={{ p: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '10px',
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Top Sector
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {indexSectors[0].name}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color="success.main">
                      +{indexSectors[0].change_percent.toFixed(2)}%
                    </Typography>
                  </Stack>
                </Card>
              )}
              {indexSectors.length > 1 && (
                <Card sx={{ p: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: '10px',
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Worst Sector
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {indexSectors[indexSectors.length - 1].name}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color="error.main">
                      {indexSectors[indexSectors.length - 1].change_percent.toFixed(2)}%
                    </Typography>
                  </Stack>
                </Card>
              )}
            </Box>
          )}

          {!indexLoading && indexData && (
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  borderRadius: 2,
                  p: 0.25,
                }}
              >
                {[{ key: 'change', label: 'By Change' }, { key: 'name', label: 'A-Z' }].map((o) => (
                  <Box
                    key={o.key}
                    component="button"
                    onClick={() => setIndexSort(o.key)}
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.2s',
                      ...(indexSort === o.key
                        ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                        : {
                            bgcolor: 'transparent',
                            color: 'text.secondary',
                            '&:hover': { color: 'text.primary' },
                          }),
                    }}
                  >
                    {o.label}
                  </Box>
                ))}
              </Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                  component="button"
                  onClick={() => setIndexExpanded(new Set(indexSectors.map((s) => s.id)))}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                    color: 'text.primary',
                    '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                    transition: 'background-color 0.2s',
                  }}
                >
                  Expand All
                </Box>
                <Box
                  component="button"
                  onClick={() => setIndexExpanded(new Set())}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                    color: 'text.primary',
                    '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                    transition: 'background-color 0.2s',
                  }}
                >
                  Collapse All
                </Box>
                <IconButton
                  onClick={() => fetchIndex(true)}
                  disabled={indexRefreshing}
                  size="small"
                  sx={{
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                    '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                    ...(indexRefreshing && {
                      '@keyframes spin': {
                        from: { transform: 'rotate(0deg)' },
                        to: { transform: 'rotate(360deg)' },
                      },
                      '& svg': { animation: 'spin 1s linear infinite' },
                    }),
                  }}
                >
                  <RefreshCw style={{ width: 16, height: 16 }} />
                </IconButton>
              </Stack>
            </Stack>
          )}

          {indexLoading && <SkeletonPage cards={11} cols={4} />}
          {indexError && !indexLoading && (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Activity
                style={{
                  width: 40,
                  height: 40,
                  margin: '0 auto 12px',
                  color: theme.palette.text.secondary,
                }}
              />
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                {indexError}
              </Typography>
              <Button onClick={() => fetchIndex()}>Try Again</Button>
            </Card>
          )}
          {!indexLoading && !indexError && indexSectors.length > 0 && (
            <Stack spacing={1}>
              {indexSectors.map((s) => (
                <SectorRow
                  key={s.id}
                  sector={s}
                  maxAbsChange={maxAbsChange}
                  isExpanded={indexExpanded.has(s.id)}
                  onToggle={() => toggleIndex(s.id)}
                />
              ))}
            </Stack>
          )}
          {!indexLoading && !indexError && indexData && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 3 }}
            >
              Data from NSE sectoral indices {'\u2022'} Auto-refreshes every 2 minutes {'\u2022'} Click stock to view on TradingView
            </Typography>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          STOCK MAP TAB
          ═══════════════════════════════════════════════════════════ */}
      {tab === 'stocks' && (
        <>
          {!stockLoading && Object.keys(stockData).length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Sectors
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {stockSummary.totalSectors}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Stocks Tracked
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {stockSummary.totalStocks}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Market Mood
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ color: theme.palette.bullish.main }}
                  >
                    {stockSummary.bullishSectors} Bullish
                  </Typography>
                  <Typography color="text.secondary">/</Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ color: theme.palette.bearish.main }}
                  >
                    {stockSummary.bearishSectors} Bearish
                  </Typography>
                </Stack>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Top Sector
                </Typography>
                {stockSummary.topSector && (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {stockSummary.topSector[0]}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{ color: theme.palette.bullish.main }}
                    >
                      +{stockSummary.topSector[1].avg_change?.toFixed(2)}%
                    </Typography>
                  </Stack>
                )}
              </Card>
            </Box>
          )}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            {/* Search input */}
            <Box sx={{ position: 'relative', width: { xs: '100%', sm: 288 } }}>
              <Search
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  color: theme.palette.text.secondary,
                  zIndex: 1,
                }}
              />
              <InputBase
                type="text"
                placeholder="Search stock or sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  width: '100%',
                  pl: 4.5,
                  pr: 2,
                  py: 1,
                  borderRadius: 3,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
                  fontSize: '0.875rem',
                  '&.Mui-focused': {
                    boxShadow: (t) => `0 0 0 2px ${alpha(t.palette.primary.main, 0.3)}`,
                  },
                }}
              />
            </Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  borderRadius: 2,
                  p: 0.25,
                }}
              >
                <Filter
                  style={{
                    width: 12,
                    height: 12,
                    color: theme.palette.text.secondary,
                    marginLeft: 8,
                  }}
                />
                {[
                  { key: 'change', label: 'By Change' },
                  { key: 'name', label: 'A-Z' },
                  { key: 'stocks', label: 'By Size' },
                ].map((opt) => (
                  <Box
                    key={opt.key}
                    component="button"
                    onClick={() => setStockSort(opt.key)}
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 1.5,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.2s',
                      ...(stockSort === opt.key
                        ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                        : {
                            bgcolor: 'transparent',
                            color: 'text.secondary',
                            '&:hover': { color: 'text.primary' },
                          }),
                    }}
                  >
                    {opt.label}
                  </Box>
                ))}
              </Box>
              <Box
                component="button"
                onClick={() => setStockExpanded(new Set(Object.keys(stockData)))}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  color: 'text.primary',
                  '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                  transition: 'background-color 0.2s',
                }}
              >
                Expand All
              </Box>
              <Box
                component="button"
                onClick={() => setStockExpanded(new Set())}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  color: 'text.primary',
                  '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                  transition: 'background-color 0.2s',
                }}
              >
                Collapse All
              </Box>
              <IconButton
                onClick={() => fetchStocks(true)}
                disabled={stockRefreshing}
                size="small"
                sx={{
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                  ...(stockRefreshing && {
                    '@keyframes spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                    '& svg': { animation: 'spin 1s linear infinite' },
                  }),
                }}
              >
                <RefreshCw style={{ width: 16, height: 16 }} />
              </IconButton>
            </Stack>
          </Stack>

          {stockLoading && <SkeletonPage cards={8} cols={4} />}
          {stockError && !stockLoading && (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                {stockError}
              </Typography>
              <Button onClick={() => fetchStocks()}>Try Again</Button>
            </Card>
          )}
          {!stockLoading && !stockError && (
            <Stack spacing={1.5}>
              {sortedStockSectors.length === 0 ? (
                <Card sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No sector data available</Typography>
                </Card>
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
            </Stack>
          )}
          {!stockLoading && !stockError && sortedStockSectors.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 3 }}
            >
              Data from NSE F&O stocks list {'\u2022'} Click any stock to view chart on TradingView
            </Typography>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default Sectors;
