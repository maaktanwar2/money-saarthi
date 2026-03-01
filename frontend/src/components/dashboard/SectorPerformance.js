// Dashboard — Sector Vertical Bars (myfno-style) with drill-down
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight, Flame, X
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import { useTheme, alpha } from '@mui/material/styles';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { formatINR, fetchAPI } from '../../lib/utils';

const SectorPerformance = () => {
  const theme = useTheme();
  const [sectors, setSectors] = useState([]);
  const [sectorStocks, setSectorStocks] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stockTab, setStockTab] = useState('momentum');

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetchAPI('/fno/sectors/performance');
        const arr = res?.sectors || [];
        // Sort by change_percent descending (gainers first)
        const sorted = arr.sort((a, b) => (b.change_percent || 0) - (a.change_percent || 0));
        setSectors(sorted);
      } catch (err) {
        console.error('Sector fetch error:', err);
        setSectors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSectors();
    // Remove manual polling - let React Query handle refetching
  }, []);

  const handleSectorClick = useCallback(async (sector) => {
    if (selectedSector?.id === sector.id) {
      setSelectedSector(null);
      setSectorStocks([]);
      return;
    }
    setSelectedSector(sector);
    setStocksLoading(true);
    try {
      const res = await fetchAPI(`/fno/sectors/${sector.id}/stocks`);
      const stocks = res?.stocks || [];
      setSectorStocks(stocks);
    } catch {
      setSectorStocks([]);
    } finally {
      setStocksLoading(false);
    }
  }, [selectedSector]);

  const { momentumStocks, correctionStocks } = useMemo(() => {
    if (!sectorStocks.length) return { momentumStocks: [], correctionStocks: [] };
    const momentum = sectorStocks.filter(s => {
      const chg = s.change_pct ?? 0;
      const volR = s.volume_ratio ?? 1;
      return chg > 0.5 && volR >= 1.0;
    }).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));

    const correction = sectorStocks.filter(s => {
      const chg = s.change_pct ?? 0;
      return chg < -0.3 && chg > -5;
    }).sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0));

    return { momentumStocks: momentum.slice(0, 8), correctionStocks: correction.slice(0, 8) };
  }, [sectorStocks]);

  const maxAbsChange = useMemo(() => {
    return Math.max(...sectors.map(s => Math.abs(s.change_percent ?? 0)), 0.5);
  }, [sectors]);

  if (loading) {
    return (
      <Stack direction="row" spacing={1} sx={{ overflow: 'hidden' }}>
        {[...Array(11)].map((_, i) => (
          <Skeleton key={i} variant="rounded" width={64} height={128} sx={{ borderRadius: 2, flexShrink: 0 }} />
        ))}
      </Stack>
    );
  }

  if (!sectors.length) {
    return (
      <Card sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
          Sector data unavailable. Market may be closed.
        </Typography>
      </Card>
    );
  }

  // Max bar height in px (each half — up for gainers, down for losers)
  const MAX_BAR_H = 70;

  // Color helpers — returns actual CSS values
  const getBarColor = (pct) => {
    if (pct >= 2) return { bg: theme.palette.success.main, glow: alpha(theme.palette.success.main, 0.25), textColor: theme.palette.success.light };
    if (pct >= 1) return { bg: alpha(theme.palette.success.main, 0.8), glow: alpha(theme.palette.success.main, 0.18), textColor: theme.palette.success.light };
    if (pct >= 0.3) return { bg: alpha(theme.palette.success.dark, 0.6), glow: alpha(theme.palette.success.main, 0.12), textColor: theme.palette.success.light };
    if (pct >= 0) return { bg: alpha('#047857', 0.5), glow: alpha(theme.palette.success.main, 0.08), textColor: theme.palette.success.light };
    if (pct >= -0.5) return { bg: alpha('#be123c', 0.5), glow: alpha(theme.palette.error.main, 0.08), textColor: theme.palette.error.light };
    if (pct >= -1) return { bg: alpha('#e11d48', 0.6), glow: alpha(theme.palette.error.main, 0.12), textColor: theme.palette.error.light };
    if (pct >= -1.5) return { bg: alpha('#f43f5e', 0.75), glow: alpha(theme.palette.error.main, 0.18), textColor: theme.palette.error.light };
    if (pct >= -2) return { bg: alpha('#f43f5e', 0.85), glow: alpha(theme.palette.error.main, 0.22), textColor: theme.palette.error.light };
    return { bg: '#f43f5e', glow: alpha(theme.palette.error.main, 0.28), textColor: theme.palette.error.light };
  };

  // Count gainers/losers
  const gainers = sectors.filter(s => (s.change_percent ?? 0) >= 0).length;
  const losers = sectors.length - gainers;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Vertical Bar Chart — myfno-style */}
      <Card
        sx={{
          borderColor: alpha(theme.palette.divider, 0.4),
          background: `linear-gradient(to bottom, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 0.5)})`,
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
        }}
      >
        {/* Summary strip */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {gainers > 0 && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.light' }} />
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'success.light' }}>
                  {gainers} Gaining
                </Typography>
              </Stack>
            )}
            {losers > 0 && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.light' }} />
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'error.light' }}>
                  {losers} Declining
                </Typography>
              </Stack>
            )}
          </Stack>
          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>Click to drill down</Typography>
        </Stack>

        {/* Vertical bars container */}
        <Box sx={{ px: 1, pb: 1, pt: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 0,
              width: '100%',
              minHeight: MAX_BAR_H * 2 + 36,
            }}
          >
            {sectors.map((sector, i) => {
              const pct = sector.change_percent ?? 0;
              const isPositive = pct >= 0;
              const barHeightPx = Math.max((Math.abs(pct) / maxAbsChange) * MAX_BAR_H, 4);
              const colors = getBarColor(pct);
              const isSelected = selectedSector?.id === sector.id;
              const sectorName = sector.name?.replace('NIFTY ', '').replace('Nifty ', '') || '';

              return (
                <motion.button
                  key={sector.id || i}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
                  onClick={() => handleSectorClick(sector)}
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    position: 'relative',
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {/* Percentage label above bar (for positive) */}
                  {isPositive && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 + 0.3 }}
                      style={{
                        fontSize: 'clamp(7px, 1.2vw, 8px)',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        marginBottom: 2,
                        lineHeight: 1,
                        color: colors.textColor,
                      }}
                    >
                      +{Number(pct).toFixed(1)}%
                    </motion.span>
                  )}

                  {/* The vertical bar */}
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Glow effect */}
                    {Math.abs(pct) > 0.8 && (
                      <div
                        style={{
                          position: 'absolute',
                          width: 12,
                          height: barHeightPx * 0.6,
                          borderRadius: 50,
                          filter: 'blur(8px)',
                          pointerEvents: 'none',
                          backgroundColor: colors.glow,
                          ...(isPositive
                            ? { bottom: 0, left: '50%', transform: 'translateX(-50%)' }
                            : { top: 0, left: '50%', transform: 'translateX(-50%)' }),
                        }}
                      />
                    )}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: barHeightPx }}
                      transition={{ delay: i * 0.03 + 0.1, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                      style={{
                        width: 'clamp(12px, 2.5vw, 20px)',
                        borderRadius: '2px 2px 0 0',
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundColor: colors.bg,
                        transition: 'filter 0.2s ease',
                        ...(isSelected && {
                          boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.5)}`,
                        }),
                      }}
                    >
                      {/* Shimmer */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: `linear-gradient(to top, transparent, ${alpha('#fff', 0.15)}, transparent)`,
                        }}
                      />
                      {/* Top edge highlight */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: 1.5,
                          background: `linear-gradient(to right, transparent, ${alpha('#fff', 0.4)}, transparent)`,
                        }}
                      />
                    </motion.div>
                  </div>

                  {/* Percentage label below bar (for negative) */}
                  {!isPositive && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 + 0.3 }}
                      style={{
                        fontSize: 'clamp(7px, 1.2vw, 8px)',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 2,
                        lineHeight: 1,
                        color: colors.textColor,
                      }}
                    >
                      {Number(pct).toFixed(1)}%
                    </motion.span>
                  )}

                  {/* Sector name — rotated vertically */}
                  <div style={{ marginTop: 4, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40 }}>
                    <span
                      style={{
                        fontSize: 'clamp(7px, 1.2vw, 9px)',
                        fontWeight: isSelected ? 600 : 500,
                        whiteSpace: 'nowrap',
                        transition: 'color 0.2s ease',
                        color: isSelected ? theme.palette.text.primary : alpha(theme.palette.text.secondary, 0.7),
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        maxHeight: 40,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sectorName}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </Box>
        </Box>
      </Card>

      {/* Drill-down: Sector -> Stocks */}
      <AnimatePresence>
        {selectedSector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <Card sx={{ borderColor: alpha(theme.palette.primary.main, 0.3) }}>
              <CardHeader sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>
                      {selectedSector.name} — Stocks
                    </CardTitle>
                    <Badge
                      sx={{
                        fontSize: '0.75rem',
                        bgcolor: (selectedSector.change_percent ?? 0) >= 0
                          ? alpha(theme.palette.success.main, 0.2)
                          : alpha(theme.palette.error.main, 0.2),
                        color: (selectedSector.change_percent ?? 0) >= 0
                          ? theme.palette.success.light
                          : theme.palette.error.light,
                      }}
                    >
                      {(selectedSector.change_percent ?? 0) >= 0 ? '+' : ''}{Number(selectedSector.change_percent ?? 0).toFixed(2)}%
                    </Badge>
                    {selectedSector.advances != null && (
                      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                        <Box component="span" sx={{ color: 'success.light' }}>{'\u25B2'}{selectedSector.advances}</Box>
                        {' '}
                        <Box component="span" sx={{ color: 'error.light' }}>{'\u25BC'}{selectedSector.declines}</Box>
                      </Typography>
                    )}
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      component="button"
                      onClick={() => setStockTab('momentum')}
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        bgcolor: stockTab === 'momentum'
                          ? alpha(theme.palette.success.main, 0.2)
                          : 'transparent',
                        color: stockTab === 'momentum'
                          ? theme.palette.success.light
                          : theme.palette.text.secondary,
                        '&:hover': {
                          color: stockTab !== 'momentum' ? theme.palette.text.primary : undefined,
                        },
                      }}
                    >
                      <Flame style={{ width: 12, height: 12, marginRight: 4 }} />Momentum
                    </Box>
                    <Box
                      component="button"
                      onClick={() => setStockTab('correction')}
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        bgcolor: stockTab === 'correction'
                          ? alpha(theme.palette.warning.main, 0.2)
                          : 'transparent',
                        color: stockTab === 'correction'
                          ? theme.palette.warning.light
                          : theme.palette.text.secondary,
                        '&:hover': {
                          color: stockTab !== 'correction' ? theme.palette.text.primary : undefined,
                        },
                      }}
                    >
                      <ArrowDownRight style={{ width: 12, height: 12, marginRight: 4 }} />Pullback
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => { setSelectedSector(null); setSectorStocks([]); }}
                      sx={{ color: 'text.secondary' }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardHeader>
              <CardContent>
                {stocksLoading ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                      gap: 1,
                    }}
                  >
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: 2 }} />
                    ))}
                  </Box>
                ) : (
                  <>
                    {stockTab === 'momentum' && (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                            lg: 'repeat(4, 1fr)',
                          },
                          gap: 1,
                        }}
                      >
                        {momentumStocks.length === 0 ? (
                          <Typography
                            sx={{
                              fontSize: '0.875rem',
                              color: 'text.secondary',
                              gridColumn: '1 / -1',
                              textAlign: 'center',
                              py: 2,
                            }}
                          >
                            No momentum stocks right now
                          </Typography>
                        ) : momentumStocks.map((stock, i) => {
                          const chg = stock.change_pct ?? 0;
                          const price = stock.price ?? 0;
                          const volR = stock.volume_ratio ?? 1;
                          return (
                            <Box
                              component={motion.div}
                              key={stock.symbol}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: alpha(theme.palette.success.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  borderColor: alpha(theme.palette.success.main, 0.4),
                                },
                                '&:hover .stock-sym': {
                                  color: theme.palette.primary.main,
                                },
                              }}
                            >
                              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                <Typography
                                  className="stock-sym"
                                  sx={{ fontWeight: 700, fontSize: '0.875rem', transition: 'color 0.2s ease' }}
                                >
                                  {stock.symbol}
                                </Typography>
                                <ArrowUpRight style={{ width: 12, height: 12, color: theme.palette.success.light }} />
                              </Stack>
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                {formatINR(price)}
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'success.light' }}>
                                  +{Number(chg).toFixed(2)}%
                                </Typography>
                                {volR > 1.2 && (
                                  <Box
                                    component="span"
                                    sx={{
                                      fontSize: '0.625rem',
                                      px: 0.75,
                                      py: 0.25,
                                      borderRadius: 1,
                                      bgcolor: alpha(theme.palette.success.main, 0.1),
                                      color: 'success.light',
                                      fontWeight: 500,
                                    }}
                                  >
                                    Vol {volR.toFixed(1)}x
                                  </Box>
                                )}
                              </Stack>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                    {stockTab === 'correction' && (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                            lg: 'repeat(4, 1fr)',
                          },
                          gap: 1,
                        }}
                      >
                        {correctionStocks.length === 0 ? (
                          <Typography
                            sx={{
                              fontSize: '0.875rem',
                              color: 'text.secondary',
                              gridColumn: '1 / -1',
                              textAlign: 'center',
                              py: 2,
                            }}
                          >
                            No pullback stocks right now
                          </Typography>
                        ) : correctionStocks.map((stock, i) => {
                          const chg = stock.change_pct ?? 0;
                          const price = stock.price ?? 0;
                          const volR = stock.volume_ratio ?? 1;
                          return (
                            <Box
                              component={motion.div}
                              key={stock.symbol}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: alpha(theme.palette.warning.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  borderColor: alpha(theme.palette.warning.main, 0.4),
                                },
                                '&:hover .stock-sym': {
                                  color: theme.palette.primary.main,
                                },
                              }}
                            >
                              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                <Typography
                                  className="stock-sym"
                                  sx={{ fontWeight: 700, fontSize: '0.875rem', transition: 'color 0.2s ease' }}
                                >
                                  {stock.symbol}
                                </Typography>
                                <ArrowDownRight style={{ width: 12, height: 12, color: theme.palette.warning.light }} />
                              </Stack>
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                {formatINR(price)}
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'warning.light' }}>
                                  {Number(chg).toFixed(2)}%
                                </Typography>
                                {volR < 0.8 && (
                                  <Box
                                    component="span"
                                    sx={{
                                      fontSize: '0.625rem',
                                      px: 0.75,
                                      py: 0.25,
                                      borderRadius: 1,
                                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                                      color: 'warning.light',
                                      fontWeight: 500,
                                    }}
                                  >
                                    Low Vol
                                  </Box>
                                )}
                              </Stack>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                    {sectorStocks.length > 0 && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5, fontSize: '0.75rem', color: 'text.secondary' }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Quick:</Typography>
                        <Typography
                          component={Link}
                          to="/options"
                          sx={{
                            fontSize: '0.75rem',
                            color: 'primary.main',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          Options Chain
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{'\u2022'}</Typography>
                        <Typography
                          component={Link}
                          to="/trade-finder"
                          sx={{
                            fontSize: '0.75rem',
                            color: 'primary.main',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          Trade Finder
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{'\u2022'}</Typography>
                        <Typography
                          component={Link}
                          to="/scanners"
                          sx={{
                            fontSize: '0.75rem',
                            color: 'primary.main',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          Full Scanner
                        </Typography>
                      </Stack>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default SectorPerformance;
