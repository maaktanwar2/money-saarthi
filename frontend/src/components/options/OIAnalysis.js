// Options Hub — OI Analysis with charts, PCR, max pain, spurts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, WifiOff, Zap, Eye, Percent, Target,
  ArrowUpRight, ArrowDownRight, Shield, AlertTriangle, Info
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../ui';
import { TradingBarChart } from '../ui/Charts';
import { cn, formatINR, formatNumber, fetchAPI, getChangeColor, isMarketHours } from '../../lib/utils';
import { SkeletonChart, SkeletonTable } from '../ui/Skeleton';
import { REFRESH_INTERVAL, formatTime } from './constants';

const OIAnalysis = ({ symbol }) => {
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
      <div className="space-y-4">
        <SkeletonChart />
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center">
        <WifiOff className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
        <p className="text-foreground-muted">Failed to load OI data</p>
        <Button onClick={() => fetchOI(false)} variant="outline" size="sm" className="mt-3">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">OI Analytics - {symbol}</h3>
          <p className="text-xs text-foreground-muted">Updated: {formatTime(lastUpdated)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchOI(true)} disabled={refreshing}>
          <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {overallView && (
        <Card className={cn(
          'p-4 border-l-4',
          overallView === 'BULLISH' ? 'border-l-green-500 bg-green-500/5' :
          overallView === 'BEARISH' ? 'border-l-red-500 bg-red-500/5' :
          'border-l-amber-500 bg-amber-500/5'
        )}>
          <div className="flex items-center gap-3 mb-2">
            <Zap className={cn('w-5 h-5',
              overallView === 'BULLISH' ? 'text-bullish' :
              overallView === 'BEARISH' ? 'text-bearish' : 'text-amber-500'
            )} />
            <span className="font-bold text-lg">{overallView}</span>
            <Badge variant={overallView === 'BULLISH' ? 'success' : overallView === 'BEARISH' ? 'destructive' : 'secondary'}>
              {pcrSignal}
            </Badge>
          </div>
          <p className="text-sm text-foreground-muted">{data?.summary?.pcrInterpretation}</p>
          {tradeSuggestion && <p className="text-sm font-medium mt-1 text-primary">{tradeSuggestion}</p>}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-muted">Spot Price</span>
            <Eye className="w-4 h-4 text-foreground-muted" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatINR(spotPrice)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-muted">Put-Call Ratio</span>
            <Percent className="w-4 h-4 text-foreground-muted" />
          </div>
          <p className={cn('text-2xl font-bold', pcr > 1 ? 'text-bullish' : pcr < 0.7 ? 'text-bearish' : 'text-amber-500')}>
            {pcr?.toFixed(2)}
          </p>
          <p className="text-xs text-foreground-muted">{pcr > 1 ? 'Bullish bias' : pcr < 0.7 ? 'Bearish bias' : 'Neutral'}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-muted">Max Pain</span>
            <Target className="w-4 h-4 text-foreground-muted" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatNumber(maxPain)}</p>
          {data?.maxPainAnalysis && <p className="text-xs text-foreground-muted">{data.maxPainAnalysis.interpretation}</p>}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-muted">Support</span>
            <ArrowUpRight className="w-4 h-4 text-bullish" />
          </div>
          <p className="text-2xl font-bold text-bullish">{formatNumber(support)}</p>
          <p className="text-xs text-foreground-muted">Highest PE OI</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-muted">Resistance</span>
            <ArrowDownRight className="w-4 h-4 text-bearish" />
          </div>
          <p className="text-2xl font-bold text-bearish">{formatNumber(resistance)}</p>
          <p className="text-xs text-foreground-muted">Highest CE OI</p>
        </Card>
      </div>

      {expectedMove && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-primary" />
            <h4 className="font-semibold">Expected Move (1σ)</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-foreground-muted">Lower Bound</p>
              <p className="text-xl font-bold text-bearish">{formatINR(expectedMove.lowerBound)}</p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Expected Range</p>
              <p className="text-xl font-bold">±{expectedMove.pct?.toFixed(2)}%</p>
              <p className="text-xs text-foreground-muted">±{formatINR(expectedMove.value)}</p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Upper Bound</p>
              <p className="text-xl font-bold text-bullish">{formatINR(expectedMove.upperBound)}</p>
            </div>
          </div>
        </Card>
      )}

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

      {oiSpurts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <CardTitle>OI Spurts - Unusual Activity</CardTitle>
            </div>
            <CardDescription>Strikes with significant OI changes ({'>'}10%)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {oiSpurts.slice(0, 8).map((spurt, i) => (
                <div key={i} className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  spurt.signal === 'SUPPORT' ? 'bg-green-500/5 border border-green-500/20' :
                  spurt.signal === 'RESISTANCE' ? 'bg-red-500/5 border border-red-500/20' :
                  'bg-amber-500/5 border border-amber-500/20'
                )}>
                  <div className="flex items-center gap-3">
                    <Badge variant={spurt.type === 'Call' ? 'default' : 'secondary'} className="text-xs">{spurt.type}</Badge>
                    <span className="font-bold tabular-nums">{spurt.strike}</span>
                    <Badge variant={spurt.signal.includes('SUPPORT') ? 'success' : 'destructive'} className="text-xs">{spurt.signal}</Badge>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-medium tabular-nums', getChangeColor(spurt.oiChange))}>
                      {spurt.oiChange > 0 ? '+' : ''}{formatNumber(spurt.oiChange, { compact: true })}
                    </p>
                    <p className="text-xs text-foreground-muted">{spurt.oiChangePct?.toFixed(1)}% change</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Understanding OI Analysis</h4>
            <ul className="text-sm text-foreground-muted space-y-1">
              <li>• <strong>PCR {'>'} 1:</strong> More puts sold = Bullish sentiment (support expected)</li>
              <li>• <strong>PCR {'<'} 0.7:</strong> More calls sold = Bearish sentiment (resistance expected)</li>
              <li>• <strong>Max Pain:</strong> Strike where option buyers lose maximum premium</li>
              <li>• <strong>High PE OI:</strong> Acts as support (put writers defend this level)</li>
              <li>• <strong>High CE OI:</strong> Acts as resistance (call writers defend this level)</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OIAnalysis;
