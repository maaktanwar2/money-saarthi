// Stock Scanner Hub - Real scanner data from NSE
import { useState, useEffect, useMemo, useCallback } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, TrendingUp, TrendingDown, Target, Clock,
  RefreshCw, AlertCircle, ExternalLink,
  BarChart3, Info
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import { useTheme, alpha } from '@mui/material/styles';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, Button, Badge, Select,
} from '../components/ui';
import { formatINR, formatPercent, fetchAPI } from '../lib/utils';

// ===============================================================================
// HELPER: theme-aware change color (replaces Tailwind getChangeColor)
// ===============================================================================
const useChangeColor = () => {
  const theme = useTheme();
  return (value) => {
    if (value > 0) return theme.palette.success.main;
    if (value < 0) return theme.palette.error.main;
    return theme.palette.text.secondary;
  };
};

// ===============================================================================
// SCANNER CATEGORIES
// ===============================================================================
const SCANNER_TYPES = [
  { id: 'all', label: 'All Stocks', icon: Zap },
  { id: 'buy', label: 'Gainers', icon: TrendingUp },
  { id: 'sell', label: 'Losers', icon: TrendingDown },
  { id: 'swing', label: 'Swing Setups', icon: Target },
];

const TIMEFRAMES = [
  { value: 'intraday', label: 'Intraday' },
  { value: 'swing', label: 'Swing (2-5 days)' },
];

// ===============================================================================
// STOCK CARD COMPONENT -- shows real scanner data only
// ===============================================================================
const StockCard = ({ stock, onView }) => {
  const theme = useTheme();
  const getColor = useChangeColor();
  const isBuy = stock.type === 'BUY';

  const accentColor = isBuy ? theme.palette.success.main : theme.palette.error.main;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Card
        sx={{
          p: 2,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          borderLeft: `4px solid ${accentColor}`,
          '&:hover': {
            borderColor: alpha(accentColor, 0.5),
          },
        }}
        onClick={() => onView(stock)}
      >
        {/* Top row: symbol + badge + change */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
                {stock.symbol}
              </Typography>
              <Badge variant={isBuy ? 'success' : 'destructive'}>
                {isBuy ? 'GAINER' : 'LOSER'}
              </Badge>
              <Badge variant="outline">{stock.category}</Badge>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {stock.strategy}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              sx={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: getColor(stock.changePercent),
              }}
            >
              {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Day Change
            </Typography>
          </Box>
        </Box>

        {/* Middle row: LTP / Target|Volume / StopLoss|Score */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            mb: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>LTP</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatINR(stock.ltp)}</Typography>
          </Box>
          {stock.target ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Target</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'success.main' }}>
                {formatINR(stock.target)}
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Volume</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {stock.volume ? stock.volume.toLocaleString('en-IN') : '\u2014'}
              </Typography>
            </Box>
          )}
          {stock.stopLoss ? (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Stop Loss</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'error.main' }}>
                {formatINR(stock.stopLoss)}
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Scanner Score</Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: stock.score >= 70
                    ? 'success.main'
                    : stock.score >= 50
                      ? 'warning.main'
                      : 'text.secondary',
                }}
              >
                {stock.score || '\u2014'}/100
              </Typography>
            </Box>
          )}
        </Box>

        {/* Bottom row: timeframe + chart link */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Clock style={{ width: 12, height: 12, color: theme.palette.text.secondary }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {stock.timeframe}
            </Typography>
          </Stack>
          <Box
            component="a"
            href={`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '0.75rem',
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Chart <ExternalLink style={{ width: 12, height: 12 }} />
          </Box>
        </Box>

        {/* Optional reason */}
        {stock.reason && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              mt: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {stock.reason}
          </Typography>
        )}
      </Card>
    </motion.div>
  );
};

// ===============================================================================
// STOCK DETAIL MODAL -- shows real data only, no fabricated metrics
// ===============================================================================
const StockDetailModal = ({ stock, onClose }) => {
  const theme = useTheme();
  const getColor = useChangeColor();

  if (!stock) return null;

  const isBuy = stock.type === 'BUY';
  const accentColor = isBuy ? theme.palette.success.main : theme.palette.error.main;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: alpha('#000', 0.6),
        backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 672 }}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 3,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: alpha(accentColor, 0.1),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stock.symbol}
                  </Typography>
                  <Badge variant={isBuy ? 'success' : 'destructive'}>
                    {isBuy ? 'GAINER' : 'LOSER'}
                  </Badge>
                  <Badge variant="outline">{stock.timeframe}</Badge>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {stock.strategy} &mdash; {stock.category}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  sx={{
                    fontSize: '1.875rem',
                    fontWeight: 700,
                    color: getColor(stock.changePercent),
                  }}
                >
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Day Change
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Price Info Cards */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              <Card sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                  LTP
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatINR(stock.ltp)}
                </Typography>
              </Card>
              {stock.target && (
                <Card sx={{ p: 2, textAlign: 'center', borderColor: alpha(theme.palette.success.main, 0.3) }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    Target
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatINR(stock.target)}
                  </Typography>
                </Card>
              )}
              {stock.stopLoss && (
                <Card sx={{ p: 2, textAlign: 'center', borderColor: alpha(theme.palette.error.main, 0.3) }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    Stop Loss
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {formatINR(stock.stopLoss)}
                  </Typography>
                </Card>
              )}
              {stock.score && (
                <Card sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    Scanner Score
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: stock.score >= 70 ? 'success.main' : 'warning.main',
                    }}
                  >
                    {stock.score}/100
                  </Typography>
                </Card>
              )}
            </Box>

            {/* Extra details if available */}
            {stock.volume && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: (t) =>
                      t.palette.mode === 'dark'
                        ? alpha(t.palette.common.white, 0.03)
                        : alpha(t.palette.common.black, 0.02),
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Volume</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {stock.volume.toLocaleString('en-IN')}
                  </Typography>
                </Box>
                {stock.riskReward && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: (t) =>
                        t.palette.mode === 'dark'
                          ? alpha(t.palette.common.white, 0.03)
                          : alpha(t.palette.common.black, 0.02),
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Risk:Reward</Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: stock.riskReward >= 2 ? 'success.main' : 'warning.main',
                      }}
                    >
                      1:{stock.riskReward}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Scanner Reasoning */}
            {stock.reason && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <BarChart3 style={{ width: 16, height: 16, color: theme.palette.primary.main }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Scanner Notes
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {stock.reason}
                </Typography>
              </Box>
            )}

            {/* Actions */}
            <Stack direction="row" spacing={1.5}>
              <Button variant="outline" onClick={onClose} sx={{ flex: 1 }}>
                Close
              </Button>
              <Box
                component="a"
                href={`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ flex: 1, textDecoration: 'none' }}
              >
                <Button variant="gradient" sx={{ width: '100%' }}>
                  <ExternalLink style={{ width: 16, height: 16, marginRight: 8 }} />
                  Open Chart
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>
      </motion.div>
    </motion.div>
  );
};

// ===============================================================================
// SCANNER SUMMARY -- real derived stats, no fabricated accuracy
// ===============================================================================
const ScannerSummary = ({ stocks = [] }) => {
  const theme = useTheme();
  const getColor = useChangeColor();

  const totalStocks = stocks.length;
  const avgScore = totalStocks > 0 ? Math.round(stocks.reduce((sum, s) => sum + (s.score || 0), 0) / totalStocks) : 0;
  const buyCount = stocks.filter(s => s.type === 'BUY').length;
  const avgChange = totalStocks > 0 ? (stocks.reduce((sum, s) => sum + (s.changePercent || 0), 0) / totalStocks).toFixed(2) : '0';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 3,
      }}
    >
      <Card sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Stocks Found
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {totalStocks}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          From scanners
        </Typography>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Avg Scanner Score
        </Typography>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: avgScore >= 70 ? 'success.main' : 'warning.main',
          }}
        >
          {avgScore}/100
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Technical score
        </Typography>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Gainers
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
          {buyCount}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Stocks up today
        </Typography>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Avg Change
        </Typography>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: getColor(parseFloat(avgChange)) }}
        >
          {avgChange}%
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Across scanned stocks
        </Typography>
      </Card>
    </Box>
  );
};

// ===============================================================================
// MAIN STOCK SCANNER COMPONENT -- real data, no synthetic dressing
// ===============================================================================
const SignalsHub = () => {
  const theme = useTheme();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [timeframe, setTimeframe] = useState('all');
  const [selectedStock, setSelectedStock] = useState(null);

  const fetchScannerData = useCallback(async () => {
    setLoading(true);
    try {
      const [gainers, losers, swing] = await Promise.all([
        fetchAPI('/scanners/day-gainers?limit=8').catch(() => ({ data: [] })),
        fetchAPI('/scanners/day-losers?limit=8').catch(() => ({ data: [] })),
        fetchAPI('/scanners/swing?limit=8').catch(() => ({ data: [] }))
      ]);

      const scannedStocks = [];

      // Gainers -- show real data only
      (gainers?.data || []).forEach((s, i) => {
        scannedStocks.push({
          id: `gainer-${i}`,
          symbol: s.symbol,
          type: 'BUY',
          category: 'Day Gainer',
          strategy: 'Momentum',
          ltp: s.ltp || s.entry || 0,
          changePercent: s.change_percent || 0,
          target: s.target_1 || null,
          stopLoss: s.stop_loss || null,
          score: s.score || null,
          volume: s.volume || null,
          timeframe: 'Intraday',
          riskReward: (s.target_1 && s.stop_loss && s.ltp)
            ? (((s.target_1 - s.ltp) / (s.ltp - s.stop_loss)).toFixed(1))
            : null,
          reason: s.signal || (s.change_percent > 3
            ? `Up ${s.change_percent.toFixed(1)}% today with momentum.`
            : `Moderate gain of ${(s.change_percent || 0).toFixed(1)}%.`),
        });
      });

      // Losers -- show real data only
      (losers?.data || []).forEach((s, i) => {
        scannedStocks.push({
          id: `loser-${i}`,
          symbol: s.symbol,
          type: 'SELL',
          category: 'Day Loser',
          strategy: 'Breakdown',
          ltp: s.ltp || s.entry || 0,
          changePercent: s.change_percent || 0,
          target: s.target_1 || null,
          stopLoss: s.stop_loss || null,
          score: s.score || null,
          volume: s.volume || null,
          timeframe: 'Intraday',
          riskReward: (s.target_1 && s.stop_loss && s.ltp)
            ? (((s.ltp - s.target_1) / (s.stop_loss - s.ltp)).toFixed(1))
            : null,
          reason: s.signal || `Down ${Math.abs(s.change_percent || 0).toFixed(1)}% today.`,
        });
      });

      // Swing setups -- show real data only
      (swing?.data || []).forEach((s, i) => {
        scannedStocks.push({
          id: `swing-${i}`,
          symbol: s.symbol,
          type: s.signal === 'SELL' ? 'SELL' : 'BUY',
          category: 'Swing Setup',
          strategy: 'Swing Trade',
          ltp: s.ltp || s.entry || 0,
          changePercent: s.change_percent || 0,
          target: s.target_1 || null,
          stopLoss: s.stop_loss || null,
          score: s.score || null,
          volume: s.volume || null,
          timeframe: 'Swing',
          riskReward: (s.target_1 && s.stop_loss && s.ltp)
            ? (Math.abs((s.target_1 - s.ltp) / (s.ltp - s.stop_loss)).toFixed(1))
            : null,
          reason: s.reason || s.signal || 'Swing setup detected by scanner.',
        });
      });

      setStocks(scannedStocks);
    } catch (error) {
      console.error('Error fetching scanner data:', error);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScannerData();
    const interval = setInterval(() => { if (!document.hidden) fetchScannerData(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchScannerData]);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
      if (activeType === 'buy' && stock.type !== 'BUY') return false;
      if (activeType === 'sell' && stock.type !== 'SELL') return false;
      if (activeType === 'swing' && stock.category !== 'Swing Setup') return false;
      if (timeframe !== 'all' && stock.timeframe.toLowerCase() !== timeframe) return false;
      return true;
    });
  }, [stocks, activeType, timeframe]);

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/signals')} path="/signals" />
      <PageHeader
        title="Stock Scanner"
        description="Real-time scanner results from NSE -- gainers, losers & swing setups"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Scanner' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={fetchScannerData}>
            <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} />
            Refresh
          </Button>
        }
      />

      {/* Scanner Summary */}
      <ScannerSummary stocks={stocks} />

      {/* Filters */}
      <Section>
        <Card sx={{ p: 2, mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
            }}
          >
            {/* Scanner type toggle buttons */}
            <Stack direction="row" spacing={0.5}>
              {SCANNER_TYPES.map((type) => {
                const isActive = activeType === type.id;
                return (
                  <Box
                    key={type.id}
                    component="button"
                    onClick={() => setActiveType(type.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      borderRadius: 2,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      bgcolor: isActive ? 'primary.main' : 'transparent',
                      color: isActive
                        ? 'primary.contrastText'
                        : 'text.secondary',
                      '&:hover': isActive
                        ? {}
                        : {
                            color: 'text.primary',
                            bgcolor: (t) =>
                              t.palette.mode === 'dark'
                                ? alpha(t.palette.common.white, 0.05)
                                : alpha(t.palette.common.black, 0.04),
                          },
                    }}
                  >
                    <type.icon style={{ width: 16, height: 16 }} />
                    {type.label}
                  </Box>
                );
              })}
            </Stack>

            {/* Timeframe selector */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: { md: 'auto' } }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Timeframe:
              </Typography>
              <Select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                sx={{ width: 160 }}
              >
                <MenuItem value="all">All</MenuItem>
                {TIMEFRAMES.map((tf) => (
                  <MenuItem key={tf.value} value={tf.value}>{tf.label}</MenuItem>
                ))}
              </Select>
            </Stack>
          </Box>
        </Card>
      </Section>

      {/* Stocks Grid */}
      {loading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {[...Array(6)].map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={192}
              sx={{ borderRadius: 4 }}
            />
          ))}
        </Box>
      ) : filteredStocks.length === 0 ? (
        <Card sx={{ py: 6, px: 3, textAlign: 'center' }}>
          <AlertCircle
            style={{
              width: 48,
              height: 48,
              color: theme.palette.text.secondary,
              margin: '0 auto 16px',
              display: 'block',
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            No Stocks Found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No stocks match your current filters. Try adjusting the timeframe or category.
          </Typography>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {filteredStocks.map((stock) => (
            <StockCard
              key={stock.id}
              stock={stock}
              onView={setSelectedStock}
            />
          ))}
        </Box>
      )}

      {/* Disclaimer -- honest about data source */}
      <Card
        sx={{
          mt: 4,
          p: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          borderColor: (t) => alpha(t.palette.primary.main, 0.2),
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Info style={{ width: 20, height: 20, color: theme.palette.primary.main, flexShrink: 0, marginTop: 2 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              About Scanner Data
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              This page shows real-time results from our NSE stock scanners. Gainers and losers
              are based on live market data. Swing setups use technical indicators (EMA, RSI, VWAP).
              Scanner scores reflect technical alignment &mdash; they are not predictions. Always do your
              own analysis and use proper risk management.
            </Typography>
          </Box>
        </Stack>
      </Card>

      {/* Stock Detail Modal */}
      <AnimatePresence>
        {selectedStock && (
          <StockDetailModal
            stock={selectedStock}
            onClose={() => setSelectedStock(null)}
          />
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default SignalsHub;
