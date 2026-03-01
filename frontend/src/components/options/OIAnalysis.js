// Options Hub — OI Analysis with charts, PCR, max pain, spurts
import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import {
  RefreshCw, WifiOff, Zap, Eye, Percent, Target,
  ArrowUpRight, ArrowDownRight, Shield, AlertTriangle, Info
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../ui';
import { TradingBarChart } from '../ui/Charts';
import { formatINR, formatNumber, fetchAPI, isMarketHours } from '../../lib/utils';
import { SkeletonChart, SkeletonTable } from '../ui/Skeleton';
import { REFRESH_INTERVAL, formatTime } from './constants';

/** Returns a theme-aware MUI color string based on value sign */
const changeColor = (value) => value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.secondary';

const OIAnalysis = ({ symbol }) => {
  const theme = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchOI = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetchAPI(`/options/oi-analytics/${encodeURIComponent(symbol)}`);
      setData(response);
      setLastUpdated(response?.timestamp || new Date().toISOString());
    } catch (err) {
      console.error('OI analytics error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchOI(false);
    intervalRef.current = setInterval(() => {
      if (!document.hidden && isMarketHours()) fetchOI(true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchOI]);

  if (loading) {
    return (
      <Stack spacing={2}>
        <SkeletonChart />
        <SkeletonTable rows={6} cols={5} />
      </Stack>
    );
  }

  if (!data) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <WifiOff style={{ width: 48, height: 48, color: theme.palette.text.secondary, margin: '0 auto 12px' }} />
        <Typography color="text.secondary">Failed to load OI data</Typography>
        <Button onClick={() => fetchOI(false)} variant="outline" size="sm" sx={{ mt: 1.5 }}>
          <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} /> Retry
        </Button>
      </Card>
    );
  }

  const pcr = data?.summary?.pcrOI;
  const maxPain = data?.maxPain;
  const support = data?.supportResistance?.immediateSupport;
  const resistance = data?.supportResistance?.immediateResistance;
  const spotPrice = data?.spotPrice;
  const pcrSignal = data?.summary?.pcrSignal;
  const overallView = data?.summary?.overallView;
  const tradeSuggestion = data?.summary?.tradeSuggestion;
  const oiSpurts = data?.oiSpurts || [];
  const expectedMove = data?.expectedMove;

  const oiChartData = (data?.oiAnalysis || [])
    .filter(s => Math.abs(s.distanceFromSpot) < 3)
    .map(s => ({
      strike: s.strike,
      'Call OI': s.call?.oi || 0,
      'Put OI': s.put?.oi || 0,
    }));

  const viewColor = overallView === 'BULLISH' ? 'success' : overallView === 'BEARISH' ? 'error' : 'warning';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>OI Analytics - {symbol}</Typography>
          <Typography variant="caption" color="text.secondary">Updated: {formatTime(lastUpdated)}</Typography>
        </Box>
        <Button variant="outline" size="sm" onClick={() => fetchOI(true)} disabled={refreshing}>
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

      {/* Overall View Banner */}
      {overallView && (
        <Card
          sx={{
            p: 2,
            borderLeft: 4,
            borderColor: `${viewColor}.main`,
            bgcolor: (t) => alpha(t.palette[viewColor].main, 0.05),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Zap style={{ width: 20, height: 20, color: theme.palette[viewColor].main }} />
            <Typography variant="h6" fontWeight={700}>{overallView}</Typography>
            <Badge variant={overallView === 'BULLISH' ? 'success' : overallView === 'BEARISH' ? 'destructive' : 'secondary'}>
              {pcrSignal}
            </Badge>
          </Box>
          <Typography variant="body2" color="text.secondary">{data?.summary?.pcrInterpretation}</Typography>
          {tradeSuggestion && (
            <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5, color: 'primary.main' }}>
              {tradeSuggestion}
            </Typography>
          )}
        </Card>
      )}

      {/* Key Metrics Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 1.5,
        }}
      >
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Spot Price</Typography>
            <Eye style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>{formatINR(spotPrice)}</Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Put-Call Ratio</Typography>
            <Percent style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
          </Box>
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ color: pcr > 1 ? 'success.main' : pcr < 0.7 ? 'error.main' : 'warning.main' }}
          >
            {pcr?.toFixed(2)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {pcr > 1 ? 'Bullish bias' : pcr < 0.7 ? 'Bearish bias' : 'Neutral'}
          </Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Max Pain</Typography>
            <Target style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>{formatNumber(maxPain)}</Typography>
          {data?.maxPainAnalysis && (
            <Typography variant="caption" color="text.secondary">{data.maxPainAnalysis.interpretation}</Typography>
          )}
        </Card>
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Support</Typography>
            <ArrowUpRight style={{ width: 16, height: 16, color: theme.palette.success.main }} />
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'success.main' }}>{formatNumber(support)}</Typography>
          <Typography variant="caption" color="text.secondary">Highest PE OI</Typography>
        </Card>
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">Resistance</Typography>
            <ArrowDownRight style={{ width: 16, height: 16, color: theme.palette.error.main }} />
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'error.main' }}>{formatNumber(resistance)}</Typography>
          <Typography variant="caption" color="text.secondary">Highest CE OI</Typography>
        </Card>
      </Box>

      {/* Expected Move */}
      {expectedMove && (
        <Card sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Shield style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            <Typography variant="subtitle1" fontWeight={600}>Expected Move (1{'\u03C3'})</Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
              textAlign: 'center',
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">Lower Bound</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'error.main' }}>
                {formatINR(expectedMove.lowerBound)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Expected Range</Typography>
              <Typography variant="h6" fontWeight={700}>
                {'\u00B1'}{expectedMove.pct?.toFixed(2)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {'\u00B1'}{formatINR(expectedMove.value)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Upper Bound</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'success.main' }}>
                {formatINR(expectedMove.upperBound)}
              </Typography>
            </Box>
          </Box>
        </Card>
      )}

      {/* OI Distribution Chart */}
      {oiChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>OI Distribution by Strike</CardTitle>
            <CardDescription>Call OI vs Put OI near ATM strikes</CardDescription>
          </CardHeader>
          <CardContent>
            <TradingBarChart data={oiChartData} dataKey="Call OI" xAxisKey="strike" height={250} />
          </CardContent>
        </Card>
      )}

      {/* OI Spurts */}
      {oiSpurts.length > 0 && (
        <Card>
          <CardHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertTriangle style={{ width: 20, height: 20, color: theme.palette.warning.main }} />
              <CardTitle>OI Spurts - Unusual Activity</CardTitle>
            </Box>
            <CardDescription>Strikes with significant OI changes ({'>'}10%)</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack spacing={1}>
              {oiSpurts.slice(0, 8).map((spurt, i) => {
                const spurtColor = spurt.signal === 'SUPPORT' ? 'success' : spurt.signal === 'RESISTANCE' ? 'error' : 'warning';
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: (t) => alpha(t.palette[spurtColor].main, 0.05),
                      border: 1,
                      borderColor: (t) => alpha(t.palette[spurtColor].main, 0.2),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Badge variant={spurt.type === 'Call' ? 'default' : 'secondary'}>{spurt.type}</Badge>
                      <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{spurt.strike}</Typography>
                      <Badge variant={spurt.signal.includes('SUPPORT') ? 'success' : 'destructive'}>{spurt.signal}</Badge>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ fontVariantNumeric: 'tabular-nums', color: changeColor(spurt.oiChange) }}
                      >
                        {spurt.oiChange > 0 ? '+' : ''}{formatNumber(spurt.oiChange, { compact: true })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {spurt.oiChangePct?.toFixed(1)}% change
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
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
              Understanding OI Analysis
            </Typography>
            <Box component="ul" sx={{ pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>PCR {'>'} 1:</strong> More puts sold = Bullish sentiment (support expected)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>PCR {'<'} 0.7:</strong> More calls sold = Bearish sentiment (resistance expected)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Max Pain:</strong> Strike where option buyers lose maximum premium
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>High PE OI:</strong> Acts as support (put writers defend this level)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>High CE OI:</strong> Acts as resistance (call writers defend this level)
              </Typography>
            </Box>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default OIAnalysis;
