import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { fetchAPI, isMarketHours } from '../lib/utils';
import { CHART_COLORS } from '../lib/chartTheme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE FINDER — Full Advanced Page
// 5 Tabs: Strategy Finder | OI Sentiment | Option Clock | OI Blocks | Swing Spectrum
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'strategy',  label: 'Strategy Finder',  desc: 'OI-backed trade suggestions' },
  { id: 'sentiment', label: 'OI Sentiment',      desc: 'PCR, \u0394OI, Support/Resistance' },
  { id: 'clock',     label: 'Option Clock',      desc: 'Time-slice OI targets' },
  { id: 'blocks',    label: 'OI Blocks',         desc: 'Candle-wise momentum' },
  { id: 'swing',     label: 'Swing Spectrum',    desc: 'Breakout & NR7 scanners' },
];

const ChartTooltipStyle = {
  backgroundColor: CHART_COLORS.bg, border: `1px solid ${CHART_COLORS.grid}`, borderRadius: '8px',
  color: CHART_COLORS.text, fontSize: '12px',
};

/** Map color name strings to MUI theme palette values */
const getThemeColor = (theme, color) => {
  const map = {
    primary: theme.palette.primary.main,
    green: theme.palette.success.main,
    red: theme.palette.error.main,
    blue: theme.palette.info.main,
    purple: theme.palette.secondary.main,
    yellow: theme.palette.warning.main,
    gray: theme.palette.grey[500],
  };
  return map[color] || theme.palette.primary.main;
};

/** Shared sx reset applied to every Box component="button" */
const btnReset = {
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  lineHeight: 1.4,
};

// ─── Small reusable cards ───────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'primary', icon }) => {
  const theme = useTheme();
  const c = getThemeColor(theme, color);
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: alpha(c, 0.1),
        border: 1,
        borderColor: alpha(c, 0.2),
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {icon} {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: c, mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function TradeFinder() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('strategy');
  const [selectedIndex, setSelectedIndex] = useState('NIFTY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);

  // ── Inputs ──
  const [riskAppetite, setRiskAppetite] = useState('moderate');
  const [marketOutlook, setMarketOutlook] = useState('neutral');

  // ── Data from backend ──
  const [analysis, setAnalysis] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [clockData, setClockData] = useState(null);
  const [blocksData, setBlocksData] = useState(null);
  const [swingData, setSwingData] = useState(null);
  const [spotPrice, setSpotPrice] = useState(0);
  const [spotChange, setSpotChange] = useState(0);

  // ════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ════════════════════════════════════════════════════════════════════════
  const fetchData = useCallback(async (index) => {
    const symbol = index || selectedIndex;
    setLoading(true);
    setError(null);
    try {
      const [analyzeRes, sentimentRes, clockRes, blocksRes, swingRes, tickerRes] = await Promise.allSettled([
        fetchAPI(`/tradefinder/analyze/${symbol}?outlook=${marketOutlook}&risk=${riskAppetite}`),
        fetchAPI(`/tradefinder/oi-sentiment/${symbol}`),
        fetchAPI(`/tradefinder/option-clock/${symbol}`),
        fetchAPI(`/tradefinder/oi-blocks/${symbol}`),
        fetchAPI(`/tradefinder/swing-scan/${symbol}`),
        fetchAPI('/ticker-data'),
      ]);

      if (analyzeRes.status === 'fulfilled' && analyzeRes.value) {
        setAnalysis(analyzeRes.value);
        if (analyzeRes.value.spot > 0) setSpotPrice(analyzeRes.value.spot);
      }
      if (sentimentRes.status === 'fulfilled') setSentiment(sentimentRes.value);
      if (clockRes.status === 'fulfilled') setClockData(clockRes.value);
      if (blocksRes.status === 'fulfilled') setBlocksData(blocksRes.value);
      if (swingRes.status === 'fulfilled') setSwingData(swingRes.value);

      if (tickerRes.status === 'fulfilled' && Array.isArray(tickerRes.value)) {
        const t = tickerRes.value.find(x => x.symbol === symbol) || tickerRes.value.find(x => x.symbol === 'NIFTY');
        if (t) setSpotChange(t.change || 0);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('TradeFinder fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedIndex, marketOutlook, riskAppetite]);

  useEffect(() => { fetchData(); return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); }; }, [selectedIndex]); // eslint-disable-line
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => { if (!document.hidden && isMarketHours()) fetchData(); }, 30000);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh, fetchData]);

  // Re-fetch strategies when outlook/risk changes
  useEffect(() => {
    if (spotPrice > 0) {
      fetchAPI(`/tradefinder/analyze/${selectedIndex}?outlook=${marketOutlook}&risk=${riskAppetite}`)
        .then(r => { if (r) setAnalysis(r); })
        .catch(() => {});
    }
  }, [marketOutlook, riskAppetite]); // eslint-disable-line

  // Derived
  const strategies = analysis?.strategies || [];
  const pcr = analysis?.pcr || {};
  const sr = analysis?.support_resistance || {};

  // OI change chart data
  const oiChangeChart = useMemo(() => {
    if (!sentiment?.oi_changes_top10) return [];
    return sentiment.oi_changes_top10.map(r => ({
      strike: r.strike,
      'Call OI Chg': Math.round((r.call_oi_change || 0) / 1000),
      'Put OI Chg': Math.round((r.put_oi_change || 0) / 1000),
    }));
  }, [sentiment]);

  // OI Blocks chart data
  const blocksChart = useMemo(() => {
    if (!blocksData?.blocks) return [];
    return blocksData.blocks.map(b => ({
      time: b.time,
      change: Math.round(b.price_change * 100) / 100,
      type: b.type,
    }));
  }, [blocksData]);

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <PageLayout>
      <SEO {...getSeoConfig('/trade-finder')} path="/trade-finder" />
      <PageHeader
        title="Trade Finder Pro"
        subtitle="OI Sentiment \u2022 Strategy Suggestions \u2022 Option Clock \u2022 OI Blocks \u2022 Swing Scanners"
      />

      {/* ── Status Bar ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, px: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: isMarketHours() ? 'success.main' : 'grey.500',
              ...(isMarketHours() && {
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }),
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isMarketHours() ? 'Market Open' : 'Market Closed'}
          </Typography>
        </Box>

        {spotPrice > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {selectedIndex}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                color: spotChange >= 0 ? 'success.light' : 'error.light',
              }}
            >
              {spotChange >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(spotChange).toFixed(2)}%
            </Typography>
          </Box>
        )}

        {lastUpdated && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Updated: {lastUpdated.toLocaleTimeString()}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(idx => (
            <Box
              key={idx}
              component="button"
              type="button"
              onClick={() => setSelectedIndex(idx)}
              sx={{
                ...btnReset,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                fontSize: '0.75rem',
                fontWeight: 500,
                transition: 'all 0.2s ease',
                ...(selectedIndex === idx
                  ? {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      border: 'none',
                    }
                  : {
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.5),
                      },
                    }),
              }}
            >
              {idx}
            </Box>
          ))}

          <Box
            component="button"
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            sx={{
              ...btnReset,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              fontSize: '0.75rem',
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: 'primary.main',
              border: 'none',
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.3) },
              '&:disabled': { opacity: 0.5, cursor: 'default' },
            }}
          >
            {loading ? '\u23F3' : '\uD83D\uDD04'} Refresh
          </Box>

          <Box
            component="button"
            type="button"
            onClick={() => setAutoRefresh(p => !p)}
            sx={{
              ...btnReset,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              fontSize: '0.75rem',
              transition: 'all 0.2s ease',
              ...(autoRefresh
                ? {
                    bgcolor: alpha(theme.palette.success.main, 0.2),
                    color: 'success.light',
                    border: 'none',
                  }
                : {
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                  }),
            }}
          >
            {autoRefresh ? '\uD83D\uDFE2 Auto' : '\u26AA Manual'}
          </Box>
        </Box>
      </Box>

      {/* ── Error Banner ── */}
      {error && (
        <Box
          sx={{
            mx: 2,
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.1),
            border: 1,
            borderColor: alpha(theme.palette.error.main, 0.3),
            color: 'error.light',
            fontSize: '0.875rem',
          }}
        >
          \u274C {error}
        </Box>
      )}

      {/* ── Tabs ── */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 2, mb: 2, overflowX: 'auto', pb: 0.5 }}>
        {TABS.map(tab => (
          <Box
            key={tab.id}
            component="button"
            type="button"
            onClick={() => setActiveTab(tab.id)}
            sx={{
              ...btnReset,
              whiteSpace: 'nowrap',
              px: 2,
              py: 1,
              borderRadius: 2,
              fontSize: '0.75rem',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              ...(activeTab === tab.id
                ? {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    border: 'none',
                    boxShadow: `0 10px 15px -3px ${alpha(theme.palette.primary.main, 0.25)}`,
                  }
                : {
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.5),
                    },
                  }),
            }}
          >
            {tab.label}
          </Box>
        ))}
      </Box>

      <Section>
        <AnimatePresence mode="wait">

          {/* ═══════ TAB 1: STRATEGY FINDER ═══════ */}
          {activeTab === 'strategy' && (
            <motion.div key="strategy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Stack spacing={3}>
                {/* Controls */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                  {/* Market Outlook */}
                  <Card>
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        component="label"
                        variant="body2"
                        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
                      >
                        Market Outlook
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {[
                          { id: 'bullish', label: '\uD83D\uDFE2 Bullish', color: 'green' },
                          { id: 'neutral', label: '\u2696\uFE0F Neutral', color: 'blue' },
                          { id: 'bearish', label: '\uD83D\uDD34 Bearish', color: 'red' },
                        ].map(o => {
                          const c = getThemeColor(theme, o.color);
                          return (
                            <Box
                              key={o.id}
                              component="button"
                              type="button"
                              onClick={() => setMarketOutlook(o.id)}
                              sx={{
                                ...btnReset,
                                flex: 1,
                                py: 1.25,
                                borderRadius: 2,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                transition: 'all 0.2s ease',
                                ...(marketOutlook === o.id
                                  ? {
                                      bgcolor: alpha(c, 0.2),
                                      border: 2,
                                      borderColor: c,
                                      color: c,
                                    }
                                  : {
                                      bgcolor: 'background.paper',
                                      border: 1,
                                      borderColor: 'divider',
                                      color: 'text.secondary',
                                    }),
                              }}
                            >
                              {o.label}
                            </Box>
                          );
                        })}
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Risk Appetite */}
                  <Card>
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        component="label"
                        variant="body2"
                        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
                      >
                        Risk Appetite
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {[
                          { id: 'conservative', label: '\uD83D\uDEE1\uFE0F Safe' },
                          { id: 'moderate', label: '\u2696\uFE0F Moderate' },
                          { id: 'aggressive', label: '\uD83D\uDD25 Aggressive' },
                        ].map(r => (
                          <Box
                            key={r.id}
                            component="button"
                            type="button"
                            onClick={() => setRiskAppetite(r.id)}
                            sx={{
                              ...btnReset,
                              flex: 1,
                              py: 1.25,
                              borderRadius: 2,
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              transition: 'all 0.2s ease',
                              ...(riskAppetite === r.id
                                ? {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    border: 'none',
                                  }
                                : {
                                    bgcolor: 'background.paper',
                                    border: 1,
                                    borderColor: 'divider',
                                    color: 'text.secondary',
                                  }),
                            }}
                          >
                            {r.label}
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Spot Price */}
                  <Card>
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        component="label"
                        variant="body2"
                        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
                      >
                        {selectedIndex} Spot
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            flex: 1,
                            borderRadius: 2,
                            bgcolor: 'background.default',
                            border: 1,
                            borderColor: 'divider',
                            px: 1.5,
                            py: 1.25,
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'primary.main',
                          }}
                        >
                          {spotPrice > 0
                            ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                            : 'Loading...'}
                        </Box>
                        <Badge
                          sx={{
                            bgcolor: alpha(
                              spotChange >= 0
                                ? theme.palette.success.main
                                : theme.palette.error.main,
                              0.2,
                            ),
                            color:
                              spotChange >= 0
                                ? theme.palette.success.light
                                : theme.palette.error.light,
                          }}
                        >
                          {spotChange >= 0 ? '\u25B2' : '\u25BC'}{' '}
                          {Math.abs(spotChange).toFixed(2)}%
                        </Badge>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                        Support: {sr.support || '\u2014'} | Resistance: {sr.resistance || '\u2014'} | PCR: {pcr.pcr_oi || '\u2014'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                {/* OI Interpretation Banner */}
                {analysis?.oi_interpretation && (() => {
                  const sig = analysis.oi_interpretation.signal;
                  const bc =
                    sig === 'Bullish' ? theme.palette.success
                    : sig === 'Bearish' ? theme.palette.error
                    : theme.palette.info;
                  return (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: 1,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        bgcolor: alpha(bc.main, 0.1),
                        borderColor: alpha(bc.main, 0.3),
                        color: bc.light,
                      }}
                    >
                      <Box component="span" sx={{ fontSize: '1.25rem' }}>
                        {analysis.oi_interpretation.icon}
                      </Box>
                      <Box>
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          {analysis.oi_interpretation.label}
                        </Typography>
                        <Typography component="span" sx={{ fontSize: '0.75rem', ml: 1, opacity: 0.8 }}>
                          {analysis.oi_interpretation.explanation}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })()}

                {/* Strategy cards */}
                <Stack spacing={2}>
                  {strategies.length === 0 && !loading && (
                    <Card sx={{ textAlign: 'center' }}>
                      <CardContent sx={{ py: 4 }}>
                        <Typography sx={{ fontSize: '2.25rem', mb: 1.5 }}>
                          \uD83D\uDD0D
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>
                          {spotPrice === 0
                            ? 'Loading market data...'
                            : 'Adjust outlook & risk to see strategies'}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}

                  {strategies.map((trade, idx) => (
                    <motion.div
                      key={trade.name + idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                    >
                      <Card
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2.5 }}>
                          {/* Header */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 2,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 3,
                                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.125rem',
                                  fontWeight: 700,
                                  color: 'primary.main',
                                }}
                              >
                                {idx + 1}
                              </Box>
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
                                  {trade.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {trade.timeframe} \u2022 {trade.risk} risk
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box
                                  sx={{
                                    width: 96,
                                    height: 8,
                                    borderRadius: 1,
                                    bgcolor: 'background.paper',
                                    border: 1,
                                    borderColor: 'divider',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      height: '100%',
                                      borderRadius: 1,
                                      bgcolor:
                                        trade.confidence >= 70
                                          ? 'success.main'
                                          : trade.confidence >= 50
                                          ? 'warning.main'
                                          : 'error.main',
                                      width: `${trade.confidence}%`,
                                    }}
                                  />
                                </Box>
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {trade.confidence}%
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Confidence
                              </Typography>
                            </Box>
                          </Box>

                          {/* Legs */}
                          <Stack spacing={1} sx={{ mb: 2 }}>
                            {trade.legs?.map((leg, li) => {
                              const legColor =
                                leg.type === 'Buy'
                                  ? theme.palette.success.main
                                  : theme.palette.error.main;
                              return (
                                <Box
                                  key={li}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: 1.25,
                                    borderRadius: 2,
                                    bgcolor: alpha(legColor, 0.1),
                                    border: 1,
                                    borderColor: alpha(legColor, 0.2),
                                  }}
                                >
                                  <Badge
                                    sx={{
                                      bgcolor: alpha(legColor, 0.3),
                                      color:
                                        leg.type === 'Buy'
                                          ? theme.palette.success.light
                                          : theme.palette.error.light,
                                    }}
                                  >
                                    {leg.type}
                                  </Badge>
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontWeight: 700,
                                      color:
                                        leg.option === 'CE'
                                          ? 'success.light'
                                          : 'error.light',
                                    }}
                                  >
                                    {leg.strike} {leg.option}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary', ml: 'auto' }}
                                  >
                                    {leg.action}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Stack>

                          {/* Stats grid */}
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                              gap: 1.5,
                              mb: 1.5,
                            }}
                          >
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                border: 1,
                                borderColor: alpha(theme.palette.success.main, 0.2),
                              }}
                            >
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Max Profit
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, color: 'success.light', display: 'block' }}
                              >
                                {trade.maxProfit}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                border: 1,
                                borderColor: alpha(theme.palette.error.main, 0.2),
                              }}
                            >
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Max Loss
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, color: 'error.light', display: 'block' }}
                              >
                                {trade.maxLoss}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.info.main, 0.1),
                                border: 1,
                                borderColor: alpha(theme.palette.info.main, 0.2),
                              }}
                            >
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Win Rate
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, color: 'info.light', display: 'block' }}
                              >
                                {trade.winRate}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                border: 1,
                                borderColor: alpha(theme.palette.secondary.main, 0.2),
                              }}
                            >
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Risk
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, color: 'secondary.light', display: 'block' }}
                              >
                                {trade.risk}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Tags */}
                          {trade.tags?.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                              {trade.tags.map(t => (
                                <Badge
                                  key={t}
                                  sx={{
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: theme.palette.primary.main,
                                    fontSize: '10px',
                                  }}
                                >
                                  {t}
                                </Badge>
                              ))}
                            </Box>
                          )}

                          {/* Reasoning */}
                          <Box
                            sx={{
                              p: 1.25,
                              borderRadius: 2,
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              fontSize: '0.75rem',
                              color: 'text.secondary',
                            }}
                          >
                            <Typography
                              component="span"
                              sx={{ color: 'primary.main', fontWeight: 600, fontSize: 'inherit' }}
                            >
                              \uD83D\uDCCA Reasoning:
                            </Typography>{' '}
                            {trade.reasoning}
                          </Box>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </Stack>

                {/* Disclaimer */}
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    border: 1,
                    borderColor: alpha(theme.palette.warning.main, 0.3),
                    color: 'warning.light',
                    fontSize: '0.75rem',
                  }}
                >
                  \u26A0\uFE0F Strategies are based on live OI data. NOT financial advice. Use proper risk management.
                </Box>
              </Stack>
            </motion.div>
          )}

          {/* ═══════ TAB 2: OI SENTIMENT ═══════ */}
          {activeTab === 'sentiment' && (
            <motion.div key="sentiment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Stack spacing={3}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  <StatCard
                    label="PCR (OI)"
                    value={sentiment?.pcr?.pcr_oi ?? '\u2014'}
                    color="blue"
                    icon="\uD83D\uDCCA"
                  />
                  <StatCard
                    label="PCR (Volume)"
                    value={sentiment?.pcr?.pcr_vol ?? '\u2014'}
                    color="purple"
                    icon="\uD83D\uDCC8"
                  />
                  <StatCard
                    label="Sentiment"
                    value={sentiment?.pcr?.sentiment ?? '\u2014'}
                    color={
                      sentiment?.pcr?.sentiment?.includes('Bullish')
                        ? 'green'
                        : sentiment?.pcr?.sentiment?.includes('Bearish')
                        ? 'red'
                        : 'blue'
                    }
                    icon="\uD83C\uDFAF"
                  />
                  <StatCard
                    label="Interpretation"
                    value={sentiment?.interpretation?.label ?? '\u2014'}
                    color={
                      sentiment?.interpretation?.signal === 'Bullish'
                        ? 'green'
                        : sentiment?.interpretation?.signal === 'Bearish'
                        ? 'red'
                        : 'yellow'
                    }
                    icon={sentiment?.interpretation?.icon ?? '\u26AA'}
                  />
                </Box>

                {/* Support / Resistance */}
                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      OI-Based Support &amp; Resistance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                        gap: 3,
                      }}
                    >
                      {/* Support */}
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', mb: 1, display: 'block' }}
                        >
                          \uD83D\uDFE2 Top 3 Support (Max Put OI)
                        </Typography>
                        {sentiment?.support_resistance?.top3_support?.map((s, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              p: 1,
                              mb: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              border: 1,
                              borderColor: alpha(theme.palette.success.main, 0.2),
                              fontSize: '0.875rem',
                            }}
                          >
                            <Typography
                              component="span"
                              sx={{ fontWeight: 700, color: 'success.light' }}
                            >
                              {s.strike}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              OI: {(s.put_oi / 100000).toFixed(1)}L
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  s.put_oi_chg >= 0
                                    ? 'success.light'
                                    : 'error.light',
                              }}
                            >
                              \u0394 {(s.put_oi_chg / 1000).toFixed(0)}K
                            </Typography>
                          </Box>
                        ))}
                      </Box>

                      {/* Resistance */}
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', mb: 1, display: 'block' }}
                        >
                          \uD83D\uDD34 Top 3 Resistance (Max Call OI)
                        </Typography>
                        {sentiment?.support_resistance?.top3_resistance?.map((s, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              p: 1,
                              mb: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.error.main, 0.1),
                              border: 1,
                              borderColor: alpha(theme.palette.error.main, 0.2),
                              fontSize: '0.875rem',
                            }}
                          >
                            <Typography
                              component="span"
                              sx={{ fontWeight: 700, color: 'error.light' }}
                            >
                              {s.strike}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              OI: {(s.call_oi / 100000).toFixed(1)}L
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  s.call_oi_chg >= 0
                                    ? 'error.light'
                                    : 'success.light',
                              }}
                            >
                              \u0394 {(s.call_oi_chg / 1000).toFixed(0)}K
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* OI Change Chart */}
                {oiChangeChart.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle sx={{ fontSize: '0.875rem' }}>
                        Top OI Changes by Strike (in '000s)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Box sx={{ minHeight: 288 }}>
                        <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={0}>
                          <BarChart
                            data={oiChangeChart}
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                            <XAxis
                              dataKey="strike"
                              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
                            <Tooltip contentStyle={ChartTooltipStyle} />
                            <Bar dataKey="Call OI Chg" fill="#ef4444" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Put OI Chg" fill="#22c55e" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* OI Interpretation matrix */}
                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      \uD83D\uDCD8 OI + Price Interpretation Matrix
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                        gap: 1,
                      }}
                    >
                      {[
                        { label: 'Price \u2191 + Call OI \u2191', signal: '\uD83D\uDFE2 Long Build-Up', color: 'green' },
                        { label: 'Price \u2191 + Put OI \u2193', signal: '\uD83D\uDFE2 Short Covering', color: 'green' },
                        { label: 'Price \u2193 + Put OI \u2191', signal: '\uD83D\uDD34 Short Build-Up', color: 'red' },
                        { label: 'Price \u2193 + Call OI \u2193', signal: '\uD83D\uDD34 Long Unwinding', color: 'red' },
                        { label: 'PCR < 0.7', signal: '\u26A0\uFE0F Call Heavy (Bearish)', color: 'yellow' },
                        { label: 'PCR > 1.3', signal: '\uD83D\uDFE2 Put Heavy (Bullish)', color: 'green' },
                      ].map((item, i) => {
                        const c = getThemeColor(theme, item.color);
                        return (
                          <Box
                            key={i}
                            sx={{
                              p: 1.25,
                              borderRadius: 2,
                              bgcolor: alpha(c, 0.1),
                              border: 1,
                              borderColor: alpha(c, 0.2),
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {item.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700, color: c, mt: 0.25, display: 'block' }}
                            >
                              {item.signal}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </Stack>
            </motion.div>
          )}

          {/* ═══════ TAB 3: OPTION CLOCK ═══════ */}
          {activeTab === 'clock' && (
            <motion.div key="clock" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Stack spacing={3}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  <StatCard
                    label="Intraday Support"
                    value={clockData?.targets?.intraday_support || '\u2014'}
                    color="green"
                    icon="\uD83D\uDEE1\uFE0F"
                  />
                  <StatCard
                    label="Intraday Resistance"
                    value={clockData?.targets?.intraday_resistance || '\u2014'}
                    color="red"
                    icon="\uD83E\uDDF1"
                  />
                  <StatCard
                    label="Max Put OI"
                    value={
                      clockData?.targets?.max_put_oi
                        ? `${(clockData.targets.max_put_oi / 100000).toFixed(1)}L`
                        : '\u2014'
                    }
                    color="green"
                    icon="\uD83D\uDCCA"
                  />
                  <StatCard
                    label="Max Call OI"
                    value={
                      clockData?.targets?.max_call_oi
                        ? `${(clockData.targets.max_call_oi / 100000).toFixed(1)}L`
                        : '\u2014'
                    }
                    color="red"
                    icon="\uD83D\uDCCA"
                  />
                </Box>

                {clockData?.targets?.resistance_shifted && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.warning.main, 0.3),
                      color: 'warning.light',
                      fontSize: '0.75rem',
                    }}
                  >
                    \u26A0\uFE0F Resistance shifted from {clockData.targets.first_resistance} \u2192{' '}
                    {clockData.targets.intraday_resistance} during the day
                  </Box>
                )}
                {clockData?.targets?.support_shifted && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.warning.main, 0.3),
                      color: 'warning.light',
                      fontSize: '0.75rem',
                    }}
                  >
                    \u26A0\uFE0F Support shifted from {clockData.targets.first_support} \u2192{' '}
                    {clockData.targets.intraday_support} during the day
                  </Box>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      \uD83D\uDD50 OI Snapshots Timeline ({clockData?.snapshots_count || 0} stored)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {clockData?.snapshots?.length > 0 ? (
                      <Stack spacing={1} sx={{ maxHeight: 384, overflowY: 'auto' }}>
                        {[...clockData.snapshots].reverse().map((snap, i) => {
                          const maxCe = snap.strikes?.reduce(
                            (a, b) => (b.ce_oi > a.ce_oi ? b : a),
                            { ce_oi: 0 },
                          );
                          const maxPe = snap.strikes?.reduce(
                            (a, b) => (b.pe_oi > a.pe_oi ? b : a),
                            { pe_oi: 0 },
                          );
                          return (
                            <Box
                              key={i}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: 'background.paper',
                                border: 1,
                                borderColor: 'divider',
                                fontSize: '0.875rem',
                              }}
                            >
                              <Typography
                                component="span"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: 'primary.main',
                                  minWidth: 56,
                                }}
                              >
                                {snap.time}
                              </Typography>
                              <Typography
                                component="span"
                                sx={{ color: 'text.secondary' }}
                              >
                                Spot: {snap.spot?.toLocaleString('en-IN')}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: 'success.light' }}
                              >
                                \uD83D\uDEE1\uFE0F {maxPe?.strike || '\u2014'}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: 'error.light' }}
                              >
                                \uD83E\uDDF1 {maxCe?.strike || '\u2014'}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography sx={{ fontSize: '1.875rem', mb: 1 }}>
                          \uD83D\uDD50
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          No snapshots yet. Data builds as you refresh during market hours.
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      \uD83D\uDCD8 How Option Clock Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 Every refresh stores a time-slice snapshot of strike-wise CE &amp; PE OI
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          Intraday Support
                        </Box>{' '}
                        = strike with maximum Put OI at that time
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          Intraday Resistance
                        </Box>{' '}
                        = strike with maximum Call OI at that time
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 If max OI strike{' '}
                        <Box component="strong" sx={{ color: 'warning.light' }}>
                          shifts
                        </Box>{' '}
                        during the day \u2192 level broke, new target formed
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 Price approaching MaxCallStrike from below \u2192 intraday
                        resistance/target
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 Price approaching MaxPutStrike from above \u2192 intraday
                        support/target
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </motion.div>
          )}

          {/* ═══════ TAB 4: OI BLOCKS ═══════ */}
          {activeTab === 'blocks' && (
            <motion.div key="blocks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Stack spacing={3}>
                {blocksData?.momentum && (() => {
                  const mom = blocksData.momentum.momentum;
                  const momColor =
                    mom === 'bullish'
                      ? theme.palette.success
                      : mom === 'bearish'
                      ? theme.palette.error
                      : { main: theme.palette.grey[500], light: theme.palette.grey[400] };
                  return (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: 1,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        bgcolor: alpha(momColor.main, 0.1),
                        borderColor: alpha(momColor.main, 0.3),
                      }}
                    >
                      <Box component="span" sx={{ fontSize: '1.5rem' }}>
                        {mom === 'bullish'
                          ? '\uD83D\uDFE2'
                          : mom === 'bearish'
                          ? '\uD83D\uDD34'
                          : '\u26AA'}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {blocksData.momentum.signal}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
                          Bullish: {blocksData.momentum.total_bullish} | Bearish:{' '}
                          {blocksData.momentum.total_bearish} | Neutral:{' '}
                          {blocksData.momentum.total_neutral}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })()}

                {blocksChart.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle sx={{ fontSize: '0.875rem' }}>
                        Candle-wise Price Change (OI Block coloring)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Box sx={{ minHeight: 320 }}>
                        <ResponsiveContainer
                          width="100%"
                          height={320}
                          minWidth={0}
                          minHeight={0}
                        >
                          <BarChart
                            data={blocksChart}
                            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={CHART_COLORS.grid}
                            />
                            <XAxis
                              dataKey="time"
                              tick={{ fill: CHART_COLORS.axis, fontSize: 9 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
                            <Tooltip contentStyle={ChartTooltipStyle} />
                            <ReferenceLine y={0} stroke={CHART_COLORS.axis} />
                            <Bar dataKey="change" radius={[2, 2, 0, 0]}>
                              {blocksChart.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    entry.type === 'bullish'
                                      ? CHART_COLORS.bullish
                                      : entry.type === 'bearish'
                                      ? CHART_COLORS.bearish
                                      : CHART_COLORS.axis
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      Recent OI Blocks ({blocksData?.blocks?.length || 0} candles)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Stack spacing={0.5} sx={{ maxHeight: 288, overflowY: 'auto' }}>
                      {blocksData?.blocks
                        ?.slice(-20)
                        .reverse()
                        .map((b, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              p: 1,
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              bgcolor:
                                b.type === 'bullish'
                                  ? alpha(theme.palette.success.main, 0.1)
                                  : b.type === 'bearish'
                                  ? alpha(theme.palette.error.main, 0.1)
                                  : alpha(theme.palette.grey[500], 0.05),
                            }}
                          >
                            <Typography
                              component="span"
                              sx={{ fontFamily: 'monospace', minWidth: 48, fontSize: 'inherit' }}
                            >
                              {b.time}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{
                                fontWeight: 700,
                                minWidth: 80,
                                fontSize: 'inherit',
                                color:
                                  b.type === 'bullish'
                                    ? 'success.light'
                                    : b.type === 'bearish'
                                    ? 'error.light'
                                    : 'text.secondary',
                              }}
                            >
                              {b.type === 'bullish'
                                ? '\uD83D\uDFE2'
                                : b.type === 'bearish'
                                ? '\uD83D\uDD34'
                                : '\u26AA'}{' '}
                              {b.type}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{ color: 'text.secondary', fontSize: 'inherit' }}
                            >
                              \u0394 Price: {b.price_change > 0 ? '+' : ''}
                              {b.price_change}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{ color: 'text.secondary', ml: 'auto', fontSize: 'inherit' }}
                            >
                              CE: {b.ce_oi_change > 0 ? '+' : ''}
                              {b.ce_oi_change}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{ color: 'text.secondary', fontSize: 'inherit' }}
                            >
                              PE: {b.pe_oi_change > 0 ? '+' : ''}
                              {b.pe_oi_change}
                            </Typography>
                          </Box>
                        ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      \uD83D\uDCD8 OI Block Logic (Apex-style)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'success.light' }}>
                          Bullish Block
                        </Box>
                        : Price \u2191 AND (Call OI \u2191 OR Put OI \u2193)
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'error.light' }}>
                          Bearish Block
                        </Box>
                        : Price \u2193 AND (Put OI \u2191 OR Call OI \u2193)
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 3+ consecutive same-direction blocks \u2192{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          Momentum Signal
                        </Box>
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 3\u20134 bullish blocks + price above VWAP \u2192 Call buy or Put
                        sell setup
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022 3\u20134 bearish blocks + price below VWAP \u2192 Put buy or Call
                        sell setup
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </motion.div>
          )}

          {/* ═══════ TAB 5: SWING SPECTRUM ═══════ */}
          {activeTab === 'swing' && (
            <motion.div key="swing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Stack spacing={3}>
                {swingData?.scanners &&
                  Object.entries(swingData.scanners).map(([key, scan]) => {
                    const isActive = scan.breakout || scan.is_nr7 || scan.reversal;
                    const color = isActive
                      ? scan.breakout === 'bullish' || scan.reversal === 'bullish'
                        ? 'green'
                        : scan.breakout === 'bearish' || scan.reversal === 'bearish'
                        ? 'red'
                        : 'yellow'
                      : 'gray';
                    const labels = {
                      breakout_10d: '10-Day Breakout',
                      breakout_50d: '50-Day Breakout',
                      channel_breakout: 'Channel Breakout (20D)',
                      nr7: 'NR7 (Narrow Range 7)',
                      reversal_radar: 'Reversal Radar',
                    };
                    const tc = getThemeColor(theme, color);
                    return (
                      <Card
                        key={key}
                        sx={{
                          ...(isActive && {
                            boxShadow: `0 0 0 1px ${alpha(tc, 0.4)}`,
                          }),
                        }}
                      >
                        <CardContent sx={{ p: 2.5 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 1.5,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  bgcolor: isActive ? tc : 'grey.600',
                                  ...(isActive && {
                                    '@keyframes pulse': {
                                      '0%, 100%': { opacity: 1 },
                                      '50%': { opacity: 0.5 },
                                    },
                                    animation:
                                      'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                  }),
                                }}
                              />
                              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                                {labels[key] || key}
                              </Typography>
                            </Box>
                            <Badge
                              sx={{
                                bgcolor: alpha(tc, 0.2),
                                color: tc,
                              }}
                            >
                              {isActive ? scan.signal || 'Active' : 'Inactive'}
                            </Badge>
                          </Box>

                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}
                          >
                            {scan.description || 'No signal detected'}
                          </Typography>

                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: {
                                xs: 'repeat(2, 1fr)',
                                md: 'repeat(4, 1fr)',
                              },
                              gap: 1,
                            }}
                          >
                            {scan.close != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Close
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {typeof scan.close === 'number'
                                    ? scan.close.toLocaleString('en-IN')
                                    : scan.close}
                                </Typography>
                              </Box>
                            )}
                            {scan.prev_high != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {scan.n}D High
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {scan.prev_high?.toLocaleString('en-IN')}
                                </Typography>
                              </Box>
                            )}
                            {scan.prev_low != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {scan.n}D Low
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {scan.prev_low?.toLocaleString('en-IN')}
                                </Typography>
                              </Box>
                            )}
                            {scan.channel_high != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Ch. High
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {scan.channel_high?.toLocaleString('en-IN')}
                                </Typography>
                              </Box>
                            )}
                            {scan.channel_low != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Ch. Low
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {scan.channel_low?.toLocaleString('en-IN')}
                                </Typography>
                              </Box>
                            )}
                            {scan.today_range != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Today Range
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  \u20B9{scan.today_range}
                                </Typography>
                              </Box>
                            )}
                            {scan.avg_range_7d != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  7D Avg Range
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  \u20B9{scan.avg_range_7d}
                                </Typography>
                              </Box>
                            )}
                            {scan.range_contraction_pct != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Contraction
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {scan.range_contraction_pct}%
                                </Typography>
                              </Box>
                            )}
                            {scan.volume != null && scan.avg_volume != null && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Vol Ratio
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {(scan.volume / Math.max(scan.avg_volume, 1)).toFixed(1)}x
                                </Typography>
                              </Box>
                            )}
                            {scan.pattern && (
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  border: 1,
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Pattern
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 700, display: 'block' }}
                                >
                                  {scan.pattern}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}

                {!swingData?.scanners && !loading && (
                  <Card sx={{ textAlign: 'center' }}>
                    <CardContent sx={{ py: 4 }}>
                      <Typography sx={{ fontSize: '2.25rem', mb: 1.5 }}>
                        \uD83D\uDCC8
                      </Typography>
                      <Typography sx={{ color: 'text.secondary' }}>
                        Loading swing scanner data...
                      </Typography>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      \uD83D\uDCD8 Scanner Formulas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          10/50D Breakout
                        </Box>
                        : Close &gt; highest high of N previous days + volume surge (1.2x avg)
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          Channel Breakout
                        </Box>
                        : Close breaks above/below N-day high-low channel with 1% buffer
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          NR7
                        </Box>
                        : Today&#39;s range (H-L) is smallest in 7 days \u2192 volatility expansion
                        expected
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        \u2022{' '}
                        <Box component="strong" sx={{ color: 'primary.main' }}>
                          Reversal Radar
                        </Box>
                        : Hammer/Shooting star near OI-based S/R + 1.5x volume spike
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </motion.div>
          )}

        </AnimatePresence>
      </Section>
    </PageLayout>
  );
}
