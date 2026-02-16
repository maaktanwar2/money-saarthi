// Options Hub — IV Skew Analysis with charts + table
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Info } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button
} from '../ui';
import { TradingAreaChart } from '../ui/Charts';
import { cn, formatINR, fetchAPI } from '../../lib/utils';
import { SkeletonChart } from '../ui/Skeleton';

const IVSkewAnalysis = ({ symbol }) => {
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
      <Card className="p-8 text-center">
        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Failed to load IV skew data</p>
        <Button onClick={() => fetchIVSkew(false)} variant="outline" size="sm" className="mt-3">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">IV Skew Analysis - {symbol}</h3>
          <p className="text-xs text-muted-foreground">Spot: {formatINR(data.spot_price)} | ATM IV: {data.atm_iv?.toFixed(1)}%</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchIVSkew(true)} disabled={refreshing}>
          <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">ATM IV</div>
          <p className="text-2xl font-bold text-primary">{data.atm_iv?.toFixed(1)}%</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Put Skew</div>
          <p className="text-2xl font-bold text-bearish">{metrics?.put_skew?.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Call Skew</div>
          <p className="text-2xl font-bold text-bullish">{metrics?.call_skew?.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Direction</div>
          <p className={cn('text-lg font-bold',
            metrics?.skew_direction === 'Put Skew' ? 'text-bearish' : 'text-bullish'
          )}>{metrics?.skew_direction}</p>
          <p className="text-xs text-muted-foreground">{metrics?.interpretation}</p>
        </Card>
      </div>

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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 text-left">Strike</th>
                  <th className="px-4 py-2 text-right">Moneyness</th>
                  <th className="px-4 py-2 text-right">Call IV</th>
                  <th className="px-4 py-2 text-right">Put IV</th>
                  <th className="px-4 py-2 text-right">Skew</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {skewData.map((row) => (
                  <tr key={row.strike} className={cn('hover:bg-surface-1', Math.abs(row.moneyness) < 1 && 'bg-primary/5')}>
                    <td className="px-4 py-2 font-medium tabular-nums">{row.strike}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.moneyness?.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums text-bullish">{row.call_iv?.toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums text-bearish">{row.put_iv?.toFixed(2)}%</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', row.skew > 0 ? 'text-bearish' : 'text-bullish')}>
                      {row.skew > 0 ? '+' : ''}{row.skew?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Understanding IV Skew</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Put Skew (OTM Put IV {'>'} OTM Call IV):</strong> Fear of downside, hedging demand</li>
              <li>• <strong>Call Skew (OTM Call IV {'>'} OTM Put IV):</strong> FOMO on upside, very bullish</li>
              <li>• <strong>Vol Smile:</strong> Both OTM puts & calls have higher IV than ATM</li>
              <li>• <strong>High ATM IV:</strong> Market expects large move, good for sellers</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default IVSkewAnalysis;
