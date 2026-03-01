// OI Scans — Top 5 OI Buildup + Top 5 OI Unwinding
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import { fetchAPI } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/chartTheme';

const OIScans = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOI = async () => {
      try {
        const res = await fetchAPI('/tools/fno-heatmap');
        const all = res?.stocks || [];
        setStocks(all);
      } catch (err) {
        console.error('OI Scan error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOI();
    // Remove manual polling - let React Query handle refetching
  }, []);

  const oiUp = [...stocks].filter(s => (s.oi_change ?? 0) > 0).sort((a, b) => (b.oi_change ?? 0) - (a.oi_change ?? 0)).slice(0, 5);
  const oiDown = [...stocks].filter(s => (s.oi_change ?? 0) < 0).sort((a, b) => (a.oi_change ?? 0) - (b.oi_change ?? 0)).slice(0, 5);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        {[0, 1].map(i => (
          <Skeleton key={i} variant="rectangular" sx={{ height: 220, borderRadius: 3 }} animation="wave" />
        ))}
      </Box>
    );
  }

  const OIPanel = ({ title, items, type }) => {
    const theme = useTheme();
    const isUp = type === 'up';
    const glowColor = isUp ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.error.main, 0.12);
    const accentHex = isUp ? CHART_COLORS.bullish : CHART_COLORS.bearish;
    const accentColor = isUp ? theme.palette.success.main : theme.palette.error.main;
    const accentColorFaded = isUp ? alpha(theme.palette.success.main, 0.7) : alpha(theme.palette.error.main, 0.7);
    const maxOI = Math.max(...items.map(s => Math.abs(s.oi_change ?? 0)), 1);

    return (
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: isUp ? 0 : 0.08 }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 3,
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

          <Box sx={{ position: 'relative', p: 1.5 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isUp ? alpha(theme.palette.success.main, 0.15) : alpha(theme.palette.error.main, 0.15),
                    boxShadow: `0 4px 14px ${glowColor}`,
                  }}
                >
                  {isUp
                    ? <TrendingUp style={{ width: 16, height: 16, color: accentColor }} />
                    : <TrendingDown style={{ width: 16, height: 16, color: accentColor }} />
                  }
                </Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: accentColor }}>
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
                  borderColor: isUp ? alpha(theme.palette.success.main, 0.25) : alpha(theme.palette.error.main, 0.25),
                  color: accentColor,
                  bgcolor: isUp ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                }}
              >
                {isUp ? 'Buildup' : 'Unwinding'}
              </Typography>
            </Box>

            {/* Stock rows */}
            {items.length === 0 ? (
              <Typography sx={{ py: 4, textAlign: 'center', fontSize: '0.875rem', color: 'text.secondary' }}>
                No data available
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.125 }}>
                {items.map((stock, i) => {
                  const oiChg = stock.oi_change ?? 0;
                  const priceChg = stock.price_change ?? 0;
                  const barWidth = Math.min((Math.abs(oiChg) / maxOI) * 100, 100);
                  const isStrongOI = Math.abs(oiChg) > 5;

                  return (
                    <motion.div
                      key={stock.symbol}
                      initial={{ opacity: 0, x: isUp ? -16 : 16 }}
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
                        {/* Background bar */}
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
                                  bgcolor: isUp ? alpha(theme.palette.success.main, 0.2) : alpha(theme.palette.error.main, 0.2),
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

                        {/* Symbol + price change */}
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
                            {isStrongOI && (
                              <Zap style={{ width: 12, height: 12, flexShrink: 0, color: accentColor }} />
                            )}
                          </Box>
                          {priceChg !== 0 && (
                            <Typography
                              sx={{
                                fontSize: '0.625rem',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 500,
                                color: priceChg > 0 ? accentColorFaded : alpha(theme.palette.error.main, 0.7),
                              }}
                            >
                              Price {priceChg > 0 ? '+' : ''}{priceChg.toFixed(1)}%
                            </Typography>
                          )}
                        </Box>

                        {/* OI change badge */}
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
                              bgcolor: isUp ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                              color: accentColor,
                            }}
                          >
                            {isUp ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
                            {oiChg > 0 ? '+' : ''}{oiChg.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </motion.div>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </motion.div>
    );
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
      <OIPanel title="OI Up" items={oiUp} type="up" />
      <OIPanel title="OI Down" items={oiDown} type="down" />
    </Box>
  );
};

export default OIScans;
