// Dashboard — Market Overview (Index Cards)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap, AlertCircle } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import { formatNumber } from '../../lib/utils';
import { useMarketStats } from '../../hooks/useScannerDataEnhanced';

const MarketOverview = () => {
  const theme = useTheme();
  const [indices, setIndices] = useState([]);
  const { data: marketStats, isLoading: loading, error } = useMarketStats({ autoRefresh: true });

  useEffect(() => {
    if (marketStats) {
      const indicesArray = marketStats?.all_indices || marketStats?.data || [];
      if (indicesArray && indicesArray.length > 0) {
        const keySymbols = ['NIFTY 50', 'NIFTY BANK', 'NIFTY MIDCAP 50', 'NIFTY FIN SERVICE', 'INDIA VIX', 'SENSEX'];
        const keyIndices = keySymbols.map(sym =>
          indicesArray.find(idx => idx.symbol === sym || idx.name === sym)
        ).filter(Boolean);
        setIndices(keyIndices.length > 0 ? keyIndices : indicesArray.slice(0, 6));
      }
    }
  }, [marketStats]);

  // Is this VIX?
  const isVIX = (sym) => (sym || '').toUpperCase().includes('VIX');

  if (loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(6, 1fr)',
          },
          gap: 1,
        }}
      >
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} variant="rounded" height={90} sx={{ borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.error.main, 0.1),
          border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
          color: 'error.main',
        }}
      >
        <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Market data unavailable</Typography>
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.75 }}>{error?.message || 'Failed to load market indices'}</Typography>
        </Box>
      </Stack>
    );
  }

  if (!indices.length) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'action.hover',
          border: 1,
          borderColor: alpha(theme.palette.divider, 0.5),
          color: 'text.secondary',
        }}
      >
        <Zap style={{ width: 16, height: 16 }} />
        <Typography sx={{ fontSize: '0.875rem' }}>No market data available</Typography>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(6, 1fr)',
        },
        gap: 1.5,
      }}
    >
      {indices.map((index, i) => {
        const isPositive = (index.pChange || 0) >= 0;
        const price = index.last || index.lastPrice || 0;
        const change = index.change || 0;
        const pChange = index.pChange || 0;
        const sym = index.symbol || index.name || '';
        const vix = isVIX(sym);

        // Short display name
        const shortName = sym
          .replace('NIFTY ', '')
          .replace('INDIA ', '')
          .replace('NIFTY', '')
          .trim();

        const accentColor = isPositive ? theme.palette.success : theme.palette.error;

        return (
          <motion.div
            key={sym}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <Box
              sx={{
                position: 'relative',
                height: '100%',
                borderRadius: 3,
                border: 1,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 0.5)})`,
                backdropFilter: 'blur(8px)',
                borderColor: alpha(theme.palette.divider, 0.4),
                '&:hover': {
                  borderColor: alpha(theme.palette.divider, 0.8),
                  boxShadow: `0 20px 40px ${alpha(accentColor.main, 0.1)}`,
                  transform: 'translateY(-2px)',
                },
                '& .hover-glow': {
                  opacity: 0,
                  transition: 'opacity 0.5s ease',
                },
                '&:hover .hover-glow': {
                  opacity: 1,
                },
                '& .icon-circle': {
                  transition: 'transform 0.2s ease',
                },
                '&:hover .icon-circle': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              {/* Top accent strip */}
              <Box
                sx={{
                  height: 2,
                  width: '100%',
                  background: `linear-gradient(to right, ${alpha(accentColor.main, 0.6)}, ${accentColor.light}, ${alpha(accentColor.main, 0.6)})`,
                }}
              />

              {/* Background glow */}
              <Box
                className="hover-glow"
                sx={{
                  position: 'absolute',
                  top: -32,
                  right: -32,
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  filter: 'blur(16px)',
                  bgcolor: alpha(accentColor.main, 0.1),
                }}
              />

              <Box sx={{ p: 1.25, position: 'relative' }}>
                {/* Header: name + icon */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography
                    sx={{
                      fontSize: { xs: '0.625rem', md: '0.6875rem' },
                      color: 'text.secondary',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '75%',
                    }}
                  >
                    {shortName || sym}
                  </Typography>
                  <Box
                    className="icon-circle"
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(accentColor.main, 0.15),
                      color: accentColor.light,
                    }}
                  >
                    {vix
                      ? <Zap style={{ width: 12, height: 12 }} />
                      : isPositive
                        ? <TrendingUp style={{ width: 12, height: 12 }} />
                        : <TrendingDown style={{ width: 12, height: 12 }} />
                    }
                  </Box>
                </Stack>

                {/* Price */}
                <Typography
                  sx={{
                    fontSize: { xs: '1rem', md: '1.125rem' },
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.025em',
                    mb: 0.5,
                  }}
                >
                  {vix ? price.toFixed(2) : price >= 1000 ? formatNumber(price, { decimals: 0 }) : price.toFixed(2)}
                </Typography>

                {/* Change row */}
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1.5,
                      fontVariantNumeric: 'tabular-nums',
                      bgcolor: alpha(accentColor.main, 0.1),
                      color: accentColor.light,
                    }}
                  >
                    {isPositive ? '\u25B2' : '\u25BC'} {isPositive ? '+' : ''}{pChange.toFixed(2)}%
                  </Box>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.625rem',
                      color: 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {change >= 0 ? '+' : ''}{Math.abs(change).toFixed(change >= 100 ? 0 : 2)}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default MarketOverview;
