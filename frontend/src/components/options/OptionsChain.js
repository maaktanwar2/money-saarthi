// Options Hub — Real-Time Option Chain Table
import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import { RefreshCw, WifiOff, Wifi, Clock } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../ui';
import { formatINR, formatNumber, fetchAPI, isMarketHours } from '../../lib/utils';
import { OptionsChainSkeleton } from '../ui/Skeleton';
import { REFRESH_INTERVAL, formatTime } from './constants';

/** Returns a theme-aware MUI color string based on value sign */
const changeColor = (value) => value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.secondary';

/** Dense cell padding for trading table */
const densePx = 0.75;
const densePy = 0.5;

const OptionsChain = ({ symbol, expiry, onChainLoaded }) => {
  const theme = useTheme();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spotPrice, setSpotPrice] = useState(0);
  const [summary, setSummary] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchChain = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const expiryParam = expiry ? `?expiry=${encodeURIComponent(expiry)}` : '';
      const response = await fetchAPI(`/options/chain/${encodeURIComponent(symbol)}${expiryParam}`);
      if (response?.data) {
        setData(response.data);
        setSpotPrice(response.spotPrice || 0);
        setSummary(response.summary || null);
        setLastUpdated(response.timestamp || new Date().toISOString());
        if (onChainLoaded && response.expiryDates) {
          onChainLoaded(response.expiryDates, response.currentExpiry);
        }
      }
    } catch (err) {
      console.error('Chain fetch error:', err);
      setError('Failed to load option chain. Retrying...');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol, expiry, onChainLoaded]);

  useEffect(() => {
    fetchChain(false);
    intervalRef.current = setInterval(() => {
      if (!document.hidden && isMarketHours()) fetchChain(true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchChain]);

  if (loading) return <OptionsChainSkeleton />;

  if (error && data.length === 0) {
    return (
      <Card sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <WifiOff style={{ width: 48, height: 48, color: theme.palette.text.secondary }} />
          <Typography color="text.secondary">{error}</Typography>
          <Button onClick={() => fetchChain(false)} variant="outline" size="sm">
            <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} /> Retry
          </Button>
        </Box>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Summary Bar */}
      {summary && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 1.5,
          }}
        >
          <Card sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Spot Price</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'primary.main' }}>{formatINR(spotPrice)}</Typography>
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">PCR (OI)</Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ color: summary.pcrOI > 1 ? 'success.main' : summary.pcrOI < 0.7 ? 'error.main' : 'warning.main' }}
            >
              {summary.pcrOI?.toFixed(2)}
            </Typography>
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Call OI</Typography>
            <Typography variant="h6" fontWeight={700}>{formatNumber(summary.totalCallOI, { compact: true })}</Typography>
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Total Put OI</Typography>
            <Typography variant="h6" fontWeight={700}>{formatNumber(summary.totalPutOI, { compact: true })}</Typography>
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">ATM IV</Typography>
            <Typography variant="h6" fontWeight={700}>{summary.atmIV?.toFixed(1)}%</Typography>
          </Card>
          <Card sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">PCR (Vol)</Typography>
            <Typography variant="h6" fontWeight={700}>{summary.pcrVolume?.toFixed(2)}</Typography>
          </Card>
        </Box>
      )}

      {/* Main Chain Table */}
      <Card>
        <CardHeader sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <CardTitle>Options Chain - {symbol}</CardTitle>
              <CardDescription>
                Spot: {formatINR(spotPrice)} | {data.length} strikes | Updated: {formatTime(lastUpdated)}
              </CardDescription>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isMarketHours() ? (
                <Badge variant="success">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Wifi style={{ width: 12, height: 12 }} /> Live
                  </Box>
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Clock style={{ width: 12, height: 12 }} /> Closed
                  </Box>
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchChain(true)} disabled={refreshing}>
                <RefreshCw
                  style={{
                    width: 16,
                    height: 16,
                    marginRight: refreshing ? 0 : 4,
                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  }}
                />
                {refreshing ? '' : 'Refresh'}
              </Button>
            </Box>
          </Box>
        </CardHeader>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                {/* Header row 1: CALLS / Strike / PUTS */}
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{
                      color: 'success.main',
                      fontWeight: 700,
                      py: 0.75,
                      bgcolor: (t) => alpha(t.palette.action.hover, 0.04),
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    CALLS
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      py: 0.75,
                      bgcolor: (t) => alpha(t.palette.action.hover, 0.04),
                      borderLeft: 1,
                      borderRight: 1,
                      borderColor: 'divider',
                    }}
                  >
                    Strike
                  </TableCell>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{
                      color: 'error.main',
                      fontWeight: 700,
                      py: 0.75,
                      bgcolor: (t) => alpha(t.palette.action.hover, 0.04),
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    PUTS
                  </TableCell>
                </TableRow>
                {/* Header row 2: column labels */}
                <TableRow>
                  <TableCell align="right" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>OI</TableCell>
                  <TableCell align="right" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>Chng OI</TableCell>
                  <TableCell align="right" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>Volume</TableCell>
                  <TableCell align="right" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>IV</TableCell>
                  <TableCell align="right" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>LTP</TableCell>
                  <TableCell align="right" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>Chng%</TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      px: densePx,
                      py: densePy,
                      bgcolor: (t) => alpha(t.palette.action.hover, 0.04),
                      borderLeft: 1,
                      borderRight: 1,
                      borderColor: 'divider',
                    }}
                  />
                  <TableCell align="left" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>Chng%</TableCell>
                  <TableCell align="left" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>LTP</TableCell>
                  <TableCell align="left" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>IV</TableCell>
                  <TableCell align="left" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>Volume</TableCell>
                  <TableCell align="left" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>Chng OI</TableCell>
                  <TableCell align="left" sx={{ px: densePx, py: densePy, fontSize: '0.7rem', color: 'text.secondary' }}>OI</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row) => {
                  const isITM_CE = row.CE?.itm;
                  const isITM_PE = row.PE?.itm;
                  const isATM = row.isATM;

                  const itmCeBg = isITM_CE
                    ? { bgcolor: (t) => alpha(t.palette.success.main, 0.04) }
                    : {};
                  const itmPeBg = isITM_PE
                    ? { bgcolor: (t) => alpha(t.palette.error.main, 0.04) }
                    : {};
                  const tabNums = { fontVariantNumeric: 'tabular-nums' };
                  const cellBase = { px: densePx, py: densePy, fontSize: '0.8rem' };

                  return (
                    <TableRow
                      key={row.strikePrice}
                      hover
                      sx={{
                        transition: 'background-color 0.15s',
                        ...(isATM && {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          borderLeft: 2,
                          borderRight: 2,
                          borderColor: (t) => alpha(t.palette.primary.main, 0.4),
                        }),
                      }}
                    >
                      {/* Call columns */}
                      <TableCell align="right" sx={{ ...cellBase, ...tabNums, ...itmCeBg }}>
                        {formatNumber(row.CE?.openInterest, { compact: true })}
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellBase, ...tabNums, ...itmCeBg, color: changeColor(row.CE?.oiChange) }}>
                        {formatNumber(row.CE?.oiChange, { compact: true, showSign: true })}
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellBase, ...tabNums, ...itmCeBg }}>
                        {formatNumber(row.CE?.volume, { compact: true })}
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellBase, ...tabNums, ...itmCeBg }}>
                        {row.CE?.iv?.toFixed(1)}%
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellBase, ...tabNums, ...itmCeBg, fontWeight: 500, color: changeColor(row.CE?.change) }}>
                        {formatINR(row.CE?.ltp)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellBase, ...tabNums, ...itmCeBg, fontSize: '0.7rem', color: changeColor(row.CE?.pctChange) }}>
                        {row.CE?.pctChange > 0 ? '+' : ''}{row.CE?.pctChange?.toFixed(1)}%
                      </TableCell>

                      {/* Strike column */}
                      <TableCell
                        align="center"
                        sx={{
                          ...cellBase,
                          ...tabNums,
                          fontWeight: 700,
                          bgcolor: (t) => alpha(t.palette.action.hover, 0.04),
                          borderLeft: 1,
                          borderRight: 1,
                          borderColor: 'divider',
                          ...(isATM && { color: 'primary.main' }),
                        }}
                      >
                        {row.strikePrice}
                        {isATM && (
                          <Typography
                            component="span"
                            sx={{ fontSize: '0.6rem', ml: 0.5, color: (t) => alpha(t.palette.primary.main, 0.7) }}
                          >
                            ATM
                          </Typography>
                        )}
                      </TableCell>

                      {/* Put columns */}
                      <TableCell align="left" sx={{ ...cellBase, ...tabNums, ...itmPeBg, fontSize: '0.7rem', color: changeColor(row.PE?.pctChange) }}>
                        {row.PE?.pctChange > 0 ? '+' : ''}{row.PE?.pctChange?.toFixed(1)}%
                      </TableCell>
                      <TableCell align="left" sx={{ ...cellBase, ...tabNums, ...itmPeBg, fontWeight: 500, color: changeColor(row.PE?.change) }}>
                        {formatINR(row.PE?.ltp)}
                      </TableCell>
                      <TableCell align="left" sx={{ ...cellBase, ...tabNums, ...itmPeBg }}>
                        {row.PE?.iv?.toFixed(1)}%
                      </TableCell>
                      <TableCell align="left" sx={{ ...cellBase, ...tabNums, ...itmPeBg }}>
                        {formatNumber(row.PE?.volume, { compact: true })}
                      </TableCell>
                      <TableCell align="left" sx={{ ...cellBase, ...tabNums, ...itmPeBg, color: changeColor(row.PE?.oiChange) }}>
                        {formatNumber(row.PE?.oiChange, { compact: true, showSign: true })}
                      </TableCell>
                      <TableCell align="left" sx={{ ...cellBase, ...tabNums, ...itmPeBg }}>
                        {formatNumber(row.PE?.openInterest, { compact: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default OptionsChain;
