// SectorPerformance – 11 NSE F&O Sectoral Index performance (TradeFinder-style)
import { useState, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  Activity, ExternalLink
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
        color: positive === true ? 'success.main' : positive === false ? 'error.main' : 'text.primary',
      }}
    >
      {value}
    </Typography>
  </Box>
);

// ═══════════════════════════════════════════════════════════════
// SECTOR ROW – single sector bar
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
              <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: (t) => alpha(t.palette.divider, 0.4), pt: 1.5 }}>
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
                    <Typography sx={{ fontSize: '10px', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      52-Week Range
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" color="text.secondary">{formatINR(sector.year_low)}</Typography>
                      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.06), position: 'relative' }}>
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
                      <Typography variant="caption" color="text.secondary">{formatINR(sector.year_high)}</Typography>
                    </Stack>
                  </Box>
                )}

                {/* constituent stocks */}
                <Box>
                  <Typography sx={{ fontSize: '10px', color: 'text.secondary', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const SectorPerformance = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [sortBy, setSortBy] = useState('change'); // change | name
  const theme = useTheme();

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
    const iv = setInterval(() => { if (!document.hidden) fetchData(true); }, 120_000); // 2 min refresh
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
      <SEO {...getSeoConfig('/sector-performance')} path="/sector-performance" />
      <PageHeader
        title="Sector Performance"
        description="11 NSE F&O sectoral indices \u2014 live index data"
        icon={BarChart3}
      />

      {/* Top summary cards */}
      {!loading && data && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 3 }}>
          <Card sx={{ p: 1.5 }}>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sectors
            </Typography>
            <Typography variant="h5" fontWeight={700}>{data.total_sectors}</Typography>
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mood
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
              <Typography variant="body2" fontWeight={700} color="success.main">{mood.bullish || 0}</Typography>
              <Typography variant="caption" color="text.secondary">/</Typography>
              <Typography variant="body2" fontWeight={700} color="error.main">{mood.bearish || 0}</Typography>
              <Typography variant="caption" color="text.secondary">/</Typography>
              <Typography variant="body2" fontWeight={700} color="text.secondary">{mood.neutral || 0}</Typography>
            </Stack>
          </Card>
          {sectors[0] && (
            <Card sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: '10px', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Top Sector
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{sectors[0].name}</Typography>
                <Typography variant="caption" fontWeight={700} color="success.main">
                  +{sectors[0].change_percent.toFixed(2)}%
                </Typography>
              </Stack>
            </Card>
          )}
          {sectors.length > 1 && (
            <Card sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: '10px', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Worst Sector
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{sectors[sectors.length - 1].name}</Typography>
                <Typography variant="caption" fontWeight={700} color="error.main">
                  {sectors[sectors.length - 1].change_percent.toFixed(2)}%
                </Typography>
              </Stack>
            </Card>
          )}
        </Box>
      )}

      {/* Controls */}
      {!loading && data && (
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
            {[
              { key: 'change', label: 'By Change' },
              { key: 'name', label: 'A-Z' },
            ].map((o) => (
              <Box
                key={o.key}
                component="button"
                onClick={() => setSortBy(o.key)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                  ...(sortBy === o.key
                    ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                    : { bgcolor: 'transparent', color: 'text.secondary', '&:hover': { color: 'text.primary' } }),
                }}
              >
                {o.label}
              </Box>
            ))}
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              component="button"
              onClick={() => setExpanded(new Set(sectors.map((s) => s.id)))}
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
              onClick={() => setExpanded(new Set())}
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
              onClick={() => fetchData(true)}
              disabled={refreshing}
              size="small"
              sx={{
                bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) },
                ...(refreshing && {
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

      {/* Loading */}
      {loading && <SkeletonPage cards={11} cols={4} />}

      {/* Error */}
      {error && !loading && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Activity style={{ width: 40, height: 40, margin: '0 auto 12px', color: theme.palette.text.secondary }} />
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>{error}</Typography>
          <Button onClick={() => fetchData()}>
            Try Again
          </Button>
        </Card>
      )}

      {/* Sector rows */}
      {!loading && !error && sectors.length > 0 && (
        <Stack spacing={1}>
          {sectors.map((s) => (
            <SectorRow
              key={s.id}
              sector={s}
              maxAbsChange={maxAbsChange}
              isExpanded={expanded.has(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </Stack>
      )}

      {/* Footer */}
      {!loading && !error && data && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          Data from NSE sectoral indices {'\u2022'} Auto-refreshes every 2 minutes {'\u2022'} Click stock to view on TradingView
        </Typography>
      )}
    </PageLayout>
  );
};

export default SectorPerformance;
