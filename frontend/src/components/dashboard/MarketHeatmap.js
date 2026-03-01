// Market Heatmap — Card grid of F&O stocks (Research360 style)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import ButtonBase from '@mui/material/ButtonBase';
import { useTheme, alpha } from '@mui/material/styles';
import { fetchAPI } from '../../lib/utils';

/* ─── NIFTY 50 approximate weightages (%) ─── */
const NIFTY_WEIGHTS = {
  HDFCBANK: 13.1, RELIANCE: 9.5, ICICIBANK: 8.1, INFY: 6.2, TCS: 4.8,
  BHARTIARTL: 4.1, LT: 3.9, ITC: 3.8, SBIN: 3.2, KOTAKBANK: 3.1,
  AXISBANK: 2.9, BAJFINANCE: 2.6, HINDUNILVR: 2.5, MARUTI: 1.9, SUNPHARMA: 1.8,
  TATAMOTORS: 1.7, HCLTECH: 1.7, NTPC: 1.6, TITAN: 1.5, ONGC: 1.4,
  POWERGRID: 1.4, ADANIENT: 1.3, ADANIPORTS: 1.3, ULTRACEMCO: 1.2, ASIANPAINT: 1.1,
  TATASTEEL: 1.1, WIPRO: 1.0, COALINDIA: 1.0, BAJAJFINSV: 1.0, JSWSTEEL: 0.9,
  NESTLEIND: 0.9, DRREDDY: 0.9, TECHM: 0.8, HINDALCO: 0.8, M_M: 0.8,
  INDUSINDBK: 0.8, CIPLA: 0.8, GRASIM: 0.7, SBILIFE: 0.7, BRITANNIA: 0.7,
  HDFCLIFE: 0.7, APOLLOHOSP: 0.7, DIVISLAB: 0.5, EICHERMOT: 0.5, HEROMOTOCO: 0.5,
  TATACONSUM: 0.5, BAJAJ_AUTO: 0.5, BPCL: 0.5, SHRIRAMFIN: 0.4, LTIM: 0.4,
  // Extra F&O heavyweights
  BANKBARODA: 0.4, VEDL: 0.3, TRENT: 0.3, ZOMATO: 0.3, PNB: 0.3,
  HAL: 0.3, BEL: 0.3, IRCTC: 0.3, PIIND: 0.3, VOLTAS: 0.3,
  BANDHANBNK: 0.2, IDFCFIRSTB: 0.2, MUTHOOTFIN: 0.2, BIOCON: 0.2,
  TATAPOWER: 0.2, DLF: 0.2, PEL: 0.2, SAIL: 0.2, NMDC: 0.2,
  MCX: 0.2, LICHSGFIN: 0.2, CANBK: 0.2, MRF: 0.2, PAGEIND: 0.2,
};

/* Also check with M&M variant */
const getWeight = (sym) => {
  if (NIFTY_WEIGHTS[sym]) return NIFTY_WEIGHTS[sym];
  // Handle M&M → M_M mapping
  const cleaned = sym.replace(/&/g, '_').replace(/-/g, '_');
  if (NIFTY_WEIGHTS[cleaned]) return NIFTY_WEIGHTS[cleaned];
  return 0.15; // default small weight for unlisted F&O stocks
};

/* ─── Color helpers ─── */
const getCardColors = (pct, theme) => {
  const success = theme.palette.success.main;
  const error = theme.palette.error.main;
  if (pct >= 3) return { bg: `linear-gradient(to bottom right, ${alpha(success, 0.30)}, ${alpha(success, 0.20)})`, border: alpha(success, 0.30), text: success, shadow: `0 2px 8px ${alpha(success, 0.10)}` };
  if (pct >= 1.5) return { bg: `linear-gradient(to bottom right, ${alpha(success, 0.20)}, ${alpha(success, 0.10)})`, border: alpha(success, 0.20), text: success, shadow: `0 2px 6px ${alpha(success, 0.05)}` };
  if (pct >= 0.5) return { bg: `linear-gradient(to bottom right, ${alpha(success, 0.15)}, ${alpha(success, 0.08)})`, border: alpha(success, 0.20), text: success, shadow: 'none' };
  if (pct >= 0) return { bg: `linear-gradient(to bottom right, ${alpha(success, 0.08)}, ${alpha(success, 0.04)})`, border: alpha(success, 0.10), text: alpha(success, 0.85), shadow: 'none' };
  if (pct >= -0.5) return { bg: `linear-gradient(to bottom right, ${alpha(error, 0.08)}, ${alpha(error, 0.04)})`, border: alpha(error, 0.10), text: alpha(error, 0.85), shadow: 'none' };
  if (pct >= -1.5) return { bg: `linear-gradient(to bottom right, ${alpha(error, 0.15)}, ${alpha(error, 0.08)})`, border: alpha(error, 0.20), text: error, shadow: 'none' };
  if (pct >= -3) return { bg: `linear-gradient(to bottom right, ${alpha(error, 0.20)}, ${alpha(error, 0.10)})`, border: alpha(error, 0.20), text: error, shadow: `0 2px 6px ${alpha(error, 0.05)}` };
  return { bg: `linear-gradient(to bottom right, ${alpha(error, 0.30)}, ${alpha(error, 0.20)})`, border: alpha(error, 0.30), text: error, shadow: `0 2px 8px ${alpha(error, 0.10)}` };
};

const getAccentBarColor = (pct, theme) => {
  const success = theme.palette.success.main;
  const error = theme.palette.error.main;
  if (pct >= 2) return success;
  if (pct >= 0) return alpha(success, 0.8);
  if (pct >= -2) return alpha(error, 0.8);
  return error;
};

/* ─── Compact Stock Card ─── */
const StockCard = ({ stock, weight, index }) => {
  const theme = useTheme();
  const pct = stock.price_change ?? 0;
  const isUp = pct >= 0;
  const colors = getCardColors(pct, theme);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.01, type: 'spring', stiffness: 320, damping: 26 }}
    >
      <Box
        onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
        sx={{
          position: 'relative',
          cursor: 'pointer',
          borderRadius: 2,
          border: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          background: colors.bg,
          backdropFilter: 'blur(8px)',
          boxShadow: colors.shadow,
          transition: 'all 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (t) => `0 4px 12px ${alpha(t.palette.common.black, 0.15)}`,
          },
          '&:hover .external-icon': {
            opacity: 0.6,
          },
        }}
      >
        {/* Top accent bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            bgcolor: getAccentBarColor(pct, theme),
          }}
        />

        {/* Content — compact */}
        <Box sx={{ px: 1.25, py: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {/* Symbol row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: (t) => alpha(t.palette.text.primary, 0.9),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {stock.symbol}
            </Typography>
            <ExternalLink
              className="external-icon"
              style={{
                width: 10,
                height: 10,
                opacity: 0,
                transition: 'opacity 0.2s',
                flexShrink: 0,
                color: theme.palette.text.secondary,
              }}
            />
          </Box>

          {/* Price + Change on same row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: (t) => alpha(t.palette.text.primary, 0.7),
              }}
            >
              {'\u20B9'}{stock.price?.toFixed(stock.price >= 1000 ? 0 : 2)}
            </Typography>
            <Typography
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                fontSize: '0.625rem',
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {isUp
                ? <TrendingUp style={{ width: 10, height: 10, flexShrink: 0 }} />
                : <TrendingDown style={{ width: 10, height: 10, flexShrink: 0 }} />
              }
              {isUp ? '+' : ''}{pct.toFixed(2)}%
            </Typography>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

const MarketHeatmap = () => {
  const theme = useTheme();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | gainers | losers

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await fetchAPI('/tools/fno-heatmap');
        setStocks(res?.stocks || []);
      } catch (err) {
        console.error('Heatmap error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmap();
    // Remove manual polling - let React Query handle refetching
  }, []);

  /* Sort by day performance — top movers first based on market direction */
  const sortedStocks = useMemo(() => {
    let filtered = stocks.filter(s => s.symbol && s.price_change != null);
    if (filter === 'gainers') filtered = filtered.filter(s => (s.price_change ?? 0) > 0);
    if (filter === 'losers') filtered = filtered.filter(s => (s.price_change ?? 0) < 0);

    const mapped = filtered.map(s => ({ ...s, weight: getWeight(s.symbol) }));

    // Determine market direction from average change
    const avgChange = mapped.length > 0
      ? mapped.reduce((sum, s) => sum + (s.price_change ?? 0), 0) / mapped.length
      : 0;

    // Sort: if market up → biggest gainers first; if down → biggest losers first
    mapped.sort((a, b) => {
      if (avgChange >= 0) return (b.price_change ?? 0) - (a.price_change ?? 0);
      return (a.price_change ?? 0) - (b.price_change ?? 0);
    });

    return mapped.slice(0, 50);
  }, [stocks, filter]);

  const gainers = stocks.filter(s => (s.price_change ?? 0) > 0).length;
  const losers = stocks.filter(s => (s.price_change ?? 0) < 0).length;

  if (loading) return <Skeleton variant="rectangular" sx={{ height: 350, borderRadius: 4 }} animation="wave" />;

  if (!sortedStocks.length) {
    return (
      <Box
        sx={{
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backdropFilter: 'blur(8px)',
          p: 4,
          textAlign: 'center',
          color: 'text.secondary',
          fontSize: '0.875rem',
        }}
      >
        Heatmap data unavailable
      </Box>
    );
  }

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: `Gainers (${gainers})` },
    { key: 'losers', label: `Losers (${losers})` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <Box
        sx={{
          position: 'relative',
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
        }}
      >
        {/* Accent strip */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            opacity: 0.8,
          }}
          style={{
            background: `linear-gradient(to right, ${theme.palette.success.main}, ${theme.palette.warning.main}, ${theme.palette.error.main})`,
          }}
        />

        {/* Header with filter pills */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            pt: 2,
            pb: 1.5,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: '0.75rem' }}>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">{gainers} Gaining</Typography>
            </Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
              <Typography variant="caption" color="text.secondary">{losers} Declining</Typography>
            </Box>
          </Box>

          {/* Filter tabs */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
              borderRadius: 2,
              p: 0.25,
              border: 1,
              borderColor: (t) => alpha(t.palette.text.primary, 0.06),
            }}
          >
            {filters.map(f => (
              <ButtonBase
                key={f.key}
                onClick={() => setFilter(f.key)}
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1.5,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  ...(filter === f.key
                    ? {
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                        color: 'primary.main',
                        border: 1,
                        borderColor: (t) => alpha(t.palette.primary.main, 0.2),
                      }
                    : {
                        color: 'text.secondary',
                        border: 1,
                        borderColor: 'transparent',
                        '&:hover': { color: 'text.primary' },
                      }),
                }}
              >
                {f.label}
              </ButtonBase>
            ))}
          </Box>
        </Box>

        {/* Card grid — compact */}
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(4, 1fr)',
                sm: 'repeat(5, 1fr)',
                md: 'repeat(6, 1fr)',
                lg: 'repeat(8, 1fr)',
              },
              gap: 0.75,
              gridAutoRows: 'auto',
            }}
          >
            <AnimatePresence mode="popLayout">
              {sortedStocks.map((stock, i) => (
                <StockCard key={stock.symbol} stock={stock} weight={stock.weight} index={i} />
              ))}
            </AnimatePresence>
          </Box>
        </Box>

        {/* Footer note */}
        <Box
          sx={{
            px: 2,
            pb: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ fontSize: '0.625rem', color: (t) => alpha(t.palette.text.secondary, 0.5) }}>
            Sorted by day performance · Click to open chart
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: (t) => alpha(t.palette.text.secondary, 0.5) }}>
            {sortedStocks.length} stocks
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
};

export default MarketHeatmap;
