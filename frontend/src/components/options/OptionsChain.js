// Options Hub — Real-Time Option Chain Table
import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, WifiOff, Wifi, Clock } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../ui';
import { cn, formatINR, formatNumber, fetchAPI, getChangeColor, isMarketHours } from '../../lib/utils';
import { OptionsChainSkeleton } from '../ui/Skeleton';
import { REFRESH_INTERVAL, formatTime } from './constants';

const OptionsChain = ({ symbol, expiry, onChainLoaded }) => {
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
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <WifiOff className="w-12 h-12 text-foreground-muted" />
          <p className="text-foreground-muted">{error}</p>
          <Button onClick={() => fetchChain(false)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Spot Price</div>
            <p className="text-lg font-bold text-primary">{formatINR(spotPrice)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">PCR (OI)</div>
            <p className={cn('text-lg font-bold', summary.pcrOI > 1 ? 'text-bullish' : summary.pcrOI < 0.7 ? 'text-bearish' : 'text-amber-500')}>
              {summary.pcrOI?.toFixed(2)}
            </p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Total Call OI</div>
            <p className="text-lg font-bold">{formatNumber(summary.totalCallOI, { compact: true })}</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">Total Put OI</div>
            <p className="text-lg font-bold">{formatNumber(summary.totalPutOI, { compact: true })}</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">ATM IV</div>
            <p className="text-lg font-bold">{summary.atmIV?.toFixed(1)}%</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-foreground-muted">PCR (Vol)</div>
            <p className="text-lg font-bold">{summary.pcrVolume?.toFixed(2)}</p>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Options Chain - {symbol}</CardTitle>
              <CardDescription>
                Spot: {formatINR(spotPrice)} | {data.length} strikes | Updated: {formatTime(lastUpdated)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isMarketHours() ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Live
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Closed
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchChain(true)} disabled={refreshing}>
                <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} />
                {refreshing ? '' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-1">
                  <th colSpan={6} className="px-4 py-2 text-center text-bullish border-b border-border">CALLS</th>
                  <th className="px-4 py-2 text-center border-x border-border bg-surface-1">Strike</th>
                  <th colSpan={6} className="px-4 py-2 text-center text-bearish border-b border-border">PUTS</th>
                </tr>
                <tr className="text-xs text-foreground-muted">
                  <th className="px-2 py-2 text-right">OI</th>
                  <th className="px-2 py-2 text-right">Chng OI</th>
                  <th className="px-2 py-2 text-right">Volume</th>
                  <th className="px-2 py-2 text-right">IV</th>
                  <th className="px-2 py-2 text-right">LTP</th>
                  <th className="px-2 py-2 text-right">Chng%</th>
                  <th className="px-2 py-2 text-center bg-surface-1"></th>
                  <th className="px-2 py-2 text-left">Chng%</th>
                  <th className="px-2 py-2 text-left">LTP</th>
                  <th className="px-2 py-2 text-left">IV</th>
                  <th className="px-2 py-2 text-left">Volume</th>
                  <th className="px-2 py-2 text-left">Chng OI</th>
                  <th className="px-2 py-2 text-left">OI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.map((row) => {
                  const isITM_CE = row.CE?.itm;
                  const isITM_PE = row.PE?.itm;
                  const isATM = row.isATM;
                  return (
                    <tr key={row.strikePrice} className={cn('hover:bg-surface-1 transition-colors', isATM && 'bg-primary/10 border-l-2 border-r-2 border-primary/40')}>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5')}>{formatNumber(row.CE?.openInterest, { compact: true })}</td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5', getChangeColor(row.CE?.oiChange))}>{formatNumber(row.CE?.oiChange, { compact: true, showSign: true })}</td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5')}>{formatNumber(row.CE?.volume, { compact: true })}</td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5')}>{row.CE?.iv?.toFixed(1)}%</td>
                      <td className={cn('px-2 py-1.5 text-right font-medium tabular-nums', isITM_CE && 'bg-bullish/5', getChangeColor(row.CE?.change))}>{formatINR(row.CE?.ltp)}</td>
                      <td className={cn('px-2 py-1.5 text-right text-xs tabular-nums', isITM_CE && 'bg-bullish/5', getChangeColor(row.CE?.pctChange))}>{row.CE?.pctChange > 0 ? '+' : ''}{row.CE?.pctChange?.toFixed(1)}%</td>
                      <td className={cn('px-3 py-1.5 text-center font-bold bg-surface-1 border-x border-border tabular-nums', isATM && 'text-primary')}>
                        {row.strikePrice}
                        {isATM && <span className="text-[10px] ml-1 text-primary/70">ATM</span>}
                      </td>
                      <td className={cn('px-2 py-1.5 text-left text-xs tabular-nums', isITM_PE && 'bg-bearish/5', getChangeColor(row.PE?.pctChange))}>{row.PE?.pctChange > 0 ? '+' : ''}{row.PE?.pctChange?.toFixed(1)}%</td>
                      <td className={cn('px-2 py-1.5 text-left font-medium tabular-nums', isITM_PE && 'bg-bearish/5', getChangeColor(row.PE?.change))}>{formatINR(row.PE?.ltp)}</td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5')}>{row.PE?.iv?.toFixed(1)}%</td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5')}>{formatNumber(row.PE?.volume, { compact: true })}</td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5', getChangeColor(row.PE?.oiChange))}>{formatNumber(row.PE?.oiChange, { compact: true, showSign: true })}</td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5')}>{formatNumber(row.PE?.openInterest, { compact: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OptionsChain;
