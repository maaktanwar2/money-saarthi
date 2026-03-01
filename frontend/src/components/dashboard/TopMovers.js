// Dashboard — Top Gainers & Losers (Strong Movers Only)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronRight, Zap } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import { formatINR, fetchAPI } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/chartTheme';

const refineMovers = (stocks) => {
  if (!Array.isArray(stocks)) return [];
  return stocks.filter(stock => {
    const changePct = Math.abs(stock.change_pct ?? stock.pChange ?? 0);
    const volumeRatio = stock.volume_ratio ?? 1;
    const score = stock.score ?? stock.day_trading_score ?? 0;
    return changePct >= 2 || volumeRatio >= 1.3 || score >= 50;
  }).slice(0, 5);
};

const StockRow = ({ stock, i, type }) => {
  const theme = useTheme();
  const changePct = stock.change_pct ?? stock.pChange ?? 0;
  const priceValue = stock.price || stock.lastPrice || stock.ltp || 0;
  const volumeRatio = stock.volume_ratio ?? 1;
  const score = stock.score ?? stock.day_trading_score ?? 0;
  const isStrong = volumeRatio >= 1.5 || score >= 60;
  const isGainer = type === 'gainer';
  const absPct = Math.abs(changePct);

  // Bar width proportional to change — max at 8%
  const barWidth = Math.min((absPct / 8) * 100, 100);
  const accentColor = isGainer ? theme.palette.success.main : theme.palette.error.main;

  return (
    <motion.div
      key={stock.symbol}
      initial={{ opacity: 0, x: isGainer ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Box
        onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.25,
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
            transform: 'translateY(-2px)',
          },
          '&:hover .bg-bar': {
            opacity: 0.08,
          },
          '&:hover .stock-symbol': {
            color: 'text.primary',
          },
        }}
      >
        {/* Background bar (subtle strength indicator) */}
        <Box
          className="bg-bar"
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            borderRadius: 3,
            opacity: 0.04,
            transition: 'all 0.2s',
            bgcolor: accentColor,
            width: `${barWidth}%`,
          }}
        />

        {/* Rank */}
        <Box
          sx={{
            position: 'relative',
            width: 24,
            height: 24,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.625rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            ...(i === 0
              ? {
                  bgcolor: isGainer ? alpha(theme.palette.success.main, 0.2) : alpha(theme.palette.error.main, 0.2),
                  color: accentColor,
                }
              : {
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  color: 'text.secondary',
                }),
          }}
        >
          {i + 1}
        </Box>

        {/* Stock info */}
        <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography
              className="stock-symbol"
              sx={{
                fontSize: '0.875rem',
                fontWeight: 700,
                transition: 'color 0.2s',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {stock.symbol}
            </Typography>
            {isStrong && (
              <Zap style={{ width: 12, height: 12, flexShrink: 0, color: accentColor }} />
            )}
            {volumeRatio > 1.3 && (
              <Typography
                component="span"
                sx={{
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  color: 'text.secondary',
                  flexShrink: 0,
                }}
              >
                {volumeRatio.toFixed(1)}x
              </Typography>
            )}
          </Box>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatINR(priceValue)}
          </Typography>
        </Box>

        {/* Change badge */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Typography
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              fontSize: '0.75rem',
              fontWeight: 700,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              fontVariantNumeric: 'tabular-nums',
              bgcolor: isGainer ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
              color: accentColor,
            }}
          >
            {changePct >= 0 ? '+' : ''}{Number(changePct).toFixed(2)}%
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
};

const MoversPanel = ({ title, stocks, type, loading, linkTo, linkLabel }) => {
  const theme = useTheme();
  const isGainer = type === 'gainer';
  const accentColor = isGainer ? theme.palette.success.main : theme.palette.error.main;
  const glowColor = isGainer ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.error.main, 0.12);
  const accentHex = isGainer ? CHART_COLORS.bullish : CHART_COLORS.bearish;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: isGainer ? 0 : 0.08 }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backdropFilter: 'blur(8px)',
          height: '100%',
        }}
      >
        {/* Top accent strip */}
        <Box
          sx={{ height: 2, width: '100%' }}
          style={{ background: `linear-gradient(to right, ${glowColor}, ${accentHex}, ${glowColor})` }}
        />

        {/* Background glow */}
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 128,
            height: 128,
            borderRadius: '50%',
            filter: 'blur(48px)',
            opacity: 0.3,
            pointerEvents: 'none',
            bgcolor: glowColor,
          }}
        />

        <Box sx={{ position: 'relative', p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isGainer ? alpha(theme.palette.success.main, 0.15) : alpha(theme.palette.error.main, 0.15),
                  boxShadow: `0 4px 14px ${glowColor}`,
                }}
              >
                {isGainer
                  ? <TrendingUp style={{ width: 16, height: 16, color: accentColor }} />
                  : <TrendingDown style={{ width: 16, height: 16, color: accentColor }} />
                }
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: accentColor }}>
                {title}
              </Typography>
            </Box>
            <Typography
              component="span"
              sx={{
                fontSize: '0.5625rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                px: 1,
                py: 0.25,
                borderRadius: 5,
                border: 1,
                borderColor: isGainer ? alpha(theme.palette.success.main, 0.25) : alpha(theme.palette.error.main, 0.25),
                color: accentColor,
                bgcolor: isGainer ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
              }}
            >
              Strong Only
            </Typography>
          </Box>

          {/* Stock list */}
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" sx={{ height: 52, borderRadius: 3 }} animation="wave" />
              ))}
            </Box>
          ) : stocks.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', fontSize: '0.875rem', color: 'text.secondary' }}>
              No strong movers today
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.125 }}>
              {stocks.map((stock, i) => (
                <StockRow key={stock.symbol} stock={stock} i={i} type={type} />
              ))}
            </Box>
          )}

          {/* View All link */}
          <Box
            component={Link}
            to={linkTo}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              fontSize: '0.875rem',
              fontWeight: 600,
              mt: 1.5,
              pt: 1.5,
              borderTop: 1,
              borderColor: (t) => alpha(t.palette.divider, 0.3),
              color: accentColor,
              textDecoration: 'none',
              transition: 'color 0.2s',
              '&:hover': {
                color: isGainer ? alpha(theme.palette.success.main, 0.8) : alpha(theme.palette.error.main, 0.8),
              },
            }}
          >
            {linkLabel}
            <ChevronRight style={{ width: 16, height: 16 }} />
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

const TopMovers = () => {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gainersData, losersData] = await Promise.all([
          fetchAPI('/scanners/day-gainers?limit=15'),
          fetchAPI('/scanners/day-losers?limit=15'),
        ]);

        const rawGainers = gainersData?.data || gainersData || [];
        const rawLosers = losersData?.data || losersData || [];

        setGainers(refineMovers(rawGainers));
        setLosers(refineMovers(rawLosers));
      } catch (error) {
        setGainers([]);
        setLosers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Remove manual polling - let React Query handle refetching
  }, []);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <MoversPanel
        title="Top Gainers"
        stocks={gainers}
        type="gainer"
        loading={loading}
        linkTo="/scanners?tab=gainers"
        linkLabel="View All Gainers"
      />
      <MoversPanel
        title="Top Losers"
        stocks={losers}
        type="loser"
        loading={loading}
        linkTo="/scanners?tab=losers"
        linkLabel="View All Losers"
      />
    </Box>
  );
};

export default TopMovers;
