// Options Hub — IV Skew Analysis with charts + table
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import { alpha, useTheme } from '@mui/material/styles';
import { RefreshCw, TrendingUp, Info } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button
} from '../ui';
import { TradingAreaChart } from '../ui/Charts';
import { formatINR, fetchAPI } from '../../lib/utils';
import { SkeletonChart } from '../ui/Skeleton';

const IVSkewAnalysis = ({ symbol }) => {
  const theme = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIVSkew = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetchAPI(`/options/iv-skew/${encodeURIComponent(symbol)}`);
      setData(response);
    } catch (err) {
      console.error('IV Skew error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => { fetchIVSkew(false); }, [fetchIVSkew]);

  if (loading) return <SkeletonChart />;

  if (!data) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <TrendingUp style={{ width: 48, height: 48, color: theme.palette.text.secondary, margin: '0 auto 12px' }} />
        <Typography color="text.secondary">Failed to load IV skew data</Typography>
        <Button onClick={() => fetchIVSkew(false)} variant="outline" size="sm" sx={{ mt: 1.5 }}>
          <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} /> Retry
        </Button>
      </Card>
    );
  }

  const metrics = data?.metrics;
  const skewData = data?.skew_data || [];
  const chartData = skewData.map(s => ({
    strike: s.strike,
    'Call IV': s.call_iv,
    'Put IV': s.put_iv,
    'Skew': s.skew,
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>IV Skew Analysis - {symbol}</Typography>
          <Typography variant="caption" color="text.secondary">
            Spot: {formatINR(data.spot_price)} | ATM IV: {data.atm_iv?.toFixed(1)}%
          </Typography>
        </Box>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchIVSkew(true)}
          disabled={refreshing}
        >
          <RefreshCw
            style={{
              width: 16,
              height: 16,
              marginRight: 4,
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          Refresh
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <Card sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            ATM IV
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>
            {data.atm_iv?.toFixed(1)}%
          </Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Put Skew
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'error.main' }}>
            {metrics?.put_skew?.toFixed(2)}
          </Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Call Skew
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'success.main' }}>
            {metrics?.call_skew?.toFixed(2)}
          </Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Direction
          </Typography>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              color: metrics?.skew_direction === 'Put Skew' ? 'error.main' : 'success.main',
            }}
          >
            {metrics?.skew_direction}
          </Typography>
          <Typography variant="caption" color="text.secondary">{metrics?.interpretation}</Typography>
        </Card>
      </Box>

      <Card>
        <CardHeader>
          <CardTitle>Implied Volatility Smile</CardTitle>
          <CardDescription>Call IV vs Put IV across strikes</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingAreaChart data={chartData} dataKey="Call IV" xAxisKey="strike" height={300} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IV Skew Data</CardTitle>
        </CardHeader>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Strike</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Moneyness</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Call IV</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Put IV</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Skew</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {skewData.map((row) => (
                  <TableRow
                    key={row.strike}
                    hover
                    sx={{
                      ...(Math.abs(row.moneyness) < 1 && {
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
                      }),
                    }}
                  >
                    <TableCell sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {row.strike}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.moneyness?.toFixed(1)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'success.main' }}>
                      {row.call_iv?.toFixed(2)}%
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>
                      {row.put_iv?.toFixed(2)}%
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color: row.skew > 0 ? 'error.main' : 'success.main',
                      }}
                    >
                      {row.skew > 0 ? '+' : ''}{row.skew?.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card
        sx={{
          p: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          borderColor: (t) => alpha(t.palette.primary.main, 0.2),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Info style={{ width: 20, height: 20, color: theme.palette.primary.main, marginTop: 2 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Understanding IV Skew
            </Typography>
            <Box component="ul" sx={{ pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Put Skew (OTM Put IV {'>'} OTM Call IV):</strong> Fear of downside, hedging demand
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Call Skew (OTM Call IV {'>'} OTM Put IV):</strong> FOMO on upside, very bullish
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Vol Smile:</strong> Both OTM puts & calls have higher IV than ATM
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>High ATM IV:</strong> Market expects large move, good for sellers
              </Typography>
            </Box>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default IVSkewAnalysis;
