// Options Hub - Real-time Options chain, Greeks, OI analytics, IV Skew, Payoff charts
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, BarChart3, TrendingUp, TrendingDown, Activity,
  RefreshCw, Download, Info, Target, Layers, Wifi, WifiOff,
  ArrowUpRight, ArrowDownRight, Percent, Clock, Zap,
  Shield, AlertTriangle, Eye
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Input, Select, Spinner
} from '../components/ui';
import { TradingAreaChart, TradingBarChart } from '../components/ui/Charts';
import { cn, formatINR, formatNumber, fetchAPI, getChangeColor } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
const INDICES = [
  { value: 'NIFTY', label: 'NIFTY 50' },
  { value: 'BANKNIFTY', label: 'Bank NIFTY' },
  { value: 'FINNIFTY', label: 'FIN NIFTY' },
  { value: 'MIDCPNIFTY', label: 'MIDCAP NIFTY' },
];

const TOOLS = [
  { id: 'chain', label: 'Option Chain', icon: Layers },
  { id: 'oi-analysis', label: 'OI Analysis', icon: BarChart3 },
  { id: 'iv-skew', label: 'IV Skew', icon: TrendingUp },
  { id: 'greeks', label: 'Greeks', icon: Activity },
  { id: 'payoff', label: 'Payoff Chart', icon: LineChart },
];

const REFRESH_INTERVAL = 30000; // 30 seconds

const isMarketHours = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const timeInMins = hours * 60 + minutes;
  return timeInMins >= 555 && timeInMins <= 930; // 9:15 AM - 3:30 PM
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch { return ''; }
};

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIONS CHAIN TABLE (Real-Time)
// ═══════════════════════════════════════════════════════════════════════════════
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
    // Auto-refresh
    intervalRef.current = setInterval(() => {
      if (isMarketHours()) fetchChain(true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchChain]);

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <span className="text-muted-foreground">Fetching real-time option chain for {symbol}...</span>
        </div>
      </Card>
    );
  }

  if (error && data.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <WifiOff className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">{error}</p>
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
            <div className="text-xs text-muted-foreground">Spot Price</div>
            <p className="text-lg font-bold text-primary">{formatINR(spotPrice)}</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">PCR (OI)</div>
            <p className={cn('text-lg font-bold', summary.pcrOI > 1 ? 'text-bullish' : summary.pcrOI < 0.7 ? 'text-bearish' : 'text-amber-500')}>
              {summary.pcrOI?.toFixed(2)}
            </p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Total Call OI</div>
            <p className="text-lg font-bold">{formatNumber(summary.totalCallOI, { compact: true })}</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Total Put OI</div>
            <p className="text-lg font-bold">{formatNumber(summary.totalPutOI, { compact: true })}</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">ATM IV</div>
            <p className="text-lg font-bold">{summary.atmIV?.toFixed(1)}%</p>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">PCR (Vol)</div>
            <p className="text-lg font-bold">{summary.pcrVolume?.toFixed(2)}</p>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-white/[0.08]">
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
                <tr className="bg-secondary/30">
                  <th colSpan={6} className="px-4 py-2 text-center text-bullish border-b border-white/[0.08]">
                    CALLS
                  </th>
                  <th className="px-4 py-2 text-center border-x border-white/[0.08] bg-secondary/50">
                    Strike
                  </th>
                  <th colSpan={6} className="px-4 py-2 text-center text-bearish border-b border-white/[0.08]">
                    PUTS
                  </th>
                </tr>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-2 py-2 text-right">OI</th>
                  <th className="px-2 py-2 text-right">Chng OI</th>
                  <th className="px-2 py-2 text-right">Volume</th>
                  <th className="px-2 py-2 text-right">IV</th>
                  <th className="px-2 py-2 text-right">LTP</th>
                  <th className="px-2 py-2 text-right">Chng%</th>
                  <th className="px-2 py-2 text-center bg-secondary/30"></th>
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
                    <tr 
                      key={row.strikePrice}
                      className={cn(
                        'hover:bg-white/[0.03] transition-colors',
                        isATM && 'bg-primary/10 border-l-2 border-r-2 border-primary/40'
                      )}
                    >
                      {/* CALLS */}
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5')}>
                        {formatNumber(row.CE?.openInterest, { compact: true })}
                      </td>
                      <td className={cn(
                        'px-2 py-1.5 text-right tabular-nums',
                        isITM_CE && 'bg-bullish/5',
                        getChangeColor(row.CE?.oiChange)
                      )}>
                        {formatNumber(row.CE?.oiChange, { compact: true, showSign: true })}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5')}>
                        {formatNumber(row.CE?.volume, { compact: true })}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', isITM_CE && 'bg-bullish/5')}>
                        {row.CE?.iv?.toFixed(1)}%
                      </td>
                      <td className={cn(
                        'px-2 py-1.5 text-right font-medium tabular-nums',
                        isITM_CE && 'bg-bullish/5',
                        getChangeColor(row.CE?.change)
                      )}>
                        {formatINR(row.CE?.ltp)}
                      </td>
                      <td className={cn(
                        'px-2 py-1.5 text-right text-xs tabular-nums',
                        isITM_CE && 'bg-bullish/5',
                        getChangeColor(row.CE?.pctChange)
                      )}>
                        {row.CE?.pctChange > 0 ? '+' : ''}{row.CE?.pctChange?.toFixed(1)}%
                      </td>
                      
                      {/* STRIKE */}
                      <td className={cn(
                        'px-3 py-1.5 text-center font-bold bg-secondary/30 border-x border-white/[0.08] tabular-nums',
                        isATM && 'text-primary'
                      )}>
                        {row.strikePrice}
                        {isATM && <span className="text-[10px] ml-1 text-primary/70">ATM</span>}
                      </td>
                      
                      {/* PUTS */}
                      <td className={cn(
                        'px-2 py-1.5 text-left text-xs tabular-nums',
                        isITM_PE && 'bg-bearish/5',
                        getChangeColor(row.PE?.pctChange)
                      )}>
                        {row.PE?.pctChange > 0 ? '+' : ''}{row.PE?.pctChange?.toFixed(1)}%
                      </td>
                      <td className={cn(
                        'px-2 py-1.5 text-left font-medium tabular-nums',
                        isITM_PE && 'bg-bearish/5',
                        getChangeColor(row.PE?.change)
                      )}>
                        {formatINR(row.PE?.ltp)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5')}>
                        {row.PE?.iv?.toFixed(1)}%
                      </td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5')}>
                        {formatNumber(row.PE?.volume, { compact: true })}
                      </td>
                      <td className={cn(
                        'px-2 py-1.5 text-left tabular-nums',
                        isITM_PE && 'bg-bearish/5',
                        getChangeColor(row.PE?.oiChange)
                      )}>
                        {formatNumber(row.PE?.oiChange, { compact: true, showSign: true })}
                      </td>
                      <td className={cn('px-2 py-1.5 text-left tabular-nums', isITM_PE && 'bg-bearish/5')}>
                        {formatNumber(row.PE?.openInterest, { compact: true })}
                      </td>
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

// ═══════════════════════════════════════════════════════════════════════════════
// OI ANALYSIS (Real-Time from Backend)
// ═══════════════════════════════════════════════════════════════════════════════
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
      if (isMarketHours()) fetchOI(true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchOI]);

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-muted-foreground">Loading OI analytics for {symbol}...</span>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center">
        <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Failed to load OI data</p>
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

  // Build OI buildup chart data from oiAnalysis
  const oiChartData = (data?.oiAnalysis || [])
    .filter(s => Math.abs(s.distanceFromSpot) < 3)
    .map(s => ({
      strike: s.strike,
      'Call OI': s.call?.oi || 0,
      'Put OI': s.put?.oi || 0,
    }));

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">OI Analytics - {symbol}</h3>
          <p className="text-xs text-muted-foreground">Updated: {formatTime(lastUpdated)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchOI(true)} disabled={refreshing}>
          <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Overall Market View */}
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
          <p className="text-sm text-muted-foreground">{data?.summary?.pcrInterpretation}</p>
          {tradeSuggestion && (
            <p className="text-sm font-medium mt-1 text-primary">{tradeSuggestion}</p>
          )}
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Spot Price</span>
            <Eye className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatINR(spotPrice)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Put-Call Ratio</span>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className={cn(
            'text-2xl font-bold',
            pcr > 1 ? 'text-bullish' : pcr < 0.7 ? 'text-bearish' : 'text-amber-500'
          )}>
            {pcr?.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pcr > 1 ? 'Bullish bias' : pcr < 0.7 ? 'Bearish bias' : 'Neutral'}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Max Pain</span>
            <Target className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatNumber(maxPain)}</p>
          {data?.maxPainAnalysis && (
            <p className="text-xs text-muted-foreground">{data.maxPainAnalysis.interpretation}</p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Support</span>
            <ArrowUpRight className="w-4 h-4 text-bullish" />
          </div>
          <p className="text-2xl font-bold text-bullish">{formatNumber(support)}</p>
          <p className="text-xs text-muted-foreground">Highest PE OI</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Resistance</span>
            <ArrowDownRight className="w-4 h-4 text-bearish" />
          </div>
          <p className="text-2xl font-bold text-bearish">{formatNumber(resistance)}</p>
          <p className="text-xs text-muted-foreground">Highest CE OI</p>
        </Card>
      </div>

      {/* Expected Move */}
      {expectedMove && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-primary" />
            <h4 className="font-semibold">Expected Move (1σ)</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Lower Bound</p>
              <p className="text-xl font-bold text-bearish">{formatINR(expectedMove.lowerBound)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Range</p>
              <p className="text-xl font-bold">±{expectedMove.pct?.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">±{formatINR(expectedMove.value)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upper Bound</p>
              <p className="text-xl font-bold text-bullish">{formatINR(expectedMove.upperBound)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* OI Buildup Chart */}
      {oiChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>OI Distribution by Strike</CardTitle>
            <CardDescription>Call OI vs Put OI near ATM strikes</CardDescription>
          </CardHeader>
          <CardContent>
            <TradingBarChart
              data={oiChartData}
              dataKey="Call OI"
              xAxisKey="strike"
              height={250}
            />
          </CardContent>
        </Card>
      )}

      {/* OI Spurts / Unusual Activity */}
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
                    <Badge variant={spurt.type === 'Call' ? 'default' : 'secondary'} className="text-xs">
                      {spurt.type}
                    </Badge>
                    <span className="font-bold tabular-nums">{spurt.strike}</span>
                    <Badge variant={spurt.signal.includes('SUPPORT') ? 'success' : 'destructive'} className="text-xs">
                      {spurt.signal}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-medium tabular-nums', getChangeColor(spurt.oiChange))}>
                      {spurt.oiChange > 0 ? '+' : ''}{formatNumber(spurt.oiChange, { compact: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">{spurt.oiChangePct?.toFixed(1)}% change</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Educational Info */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Understanding OI Analysis</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
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

// ═══════════════════════════════════════════════════════════════════════════════
// IV SKEW ANALYSIS (Real-Time)
// ═══════════════════════════════════════════════════════════════════════════════
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

  if (loading) {
    return <Card className="p-8"><div className="flex flex-col items-center gap-3"><Spinner size="lg" /><span className="text-muted-foreground">Loading IV Skew data...</span></div></Card>;
  }

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
          <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Metrics */}
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

      {/* IV Smile Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Implied Volatility Smile</CardTitle>
          <CardDescription>Call IV vs Put IV across strikes</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingAreaChart
            data={chartData}
            dataKey="Call IV"
            xAxisKey="strike"
            height={300}
          />
        </CardContent>
      </Card>

      {/* IV Skew Table */}
      <Card>
        <CardHeader>
          <CardTitle>IV Skew Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-white/[0.08]">
                  <th className="px-4 py-2 text-left">Strike</th>
                  <th className="px-4 py-2 text-right">Moneyness</th>
                  <th className="px-4 py-2 text-right">Call IV</th>
                  <th className="px-4 py-2 text-right">Put IV</th>
                  <th className="px-4 py-2 text-right">Skew</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {skewData.map((row) => (
                  <tr key={row.strike} className={cn(
                    'hover:bg-white/[0.03]',
                    Math.abs(row.moneyness) < 1 && 'bg-primary/5'
                  )}>
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

      {/* Educational */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOFF CHART (Interactive Strategy Builder)
// ═══════════════════════════════════════════════════════════════════════════════
const PayoffChart = ({ symbol, spotPrice: initialSpot }) => {
  const [legs, setLegs] = useState([
    { type: 'call', strike: 0, premium: 100, quantity: 1 }
  ]);
  const [spotPrice, setSpotPrice] = useState(initialSpot || 24000);
  const [payoffData, setPayoffData] = useState([]);

  useEffect(() => {
    // Calculate payoff across a range of prices
    const step = spotPrice > 5000 ? 50 : 25;
    const range = step * 30;
    const prices = [];
    for (let p = spotPrice - range; p <= spotPrice + range; p += step) prices.push(p);

    const data = prices.map(price => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = leg.strike || spotPrice;
        const premium = leg.premium || 0;
        const qty = leg.quantity || 0;
        const lotSize = symbol === 'BANKNIFTY' ? 15 : symbol === 'FINNIFTY' ? 25 : 25;

        let intrinsic = 0;
        if (leg.type === 'call') intrinsic = Math.max(0, price - strike);
        else intrinsic = Math.max(0, strike - price);

        const pnl = (intrinsic - premium) * qty * lotSize;
        totalPnl += pnl;
      });
      return { price, pnl: Math.round(totalPnl) };
    });
    setPayoffData(data);
  }, [legs, spotPrice, symbol]);

  const addLeg = () => {
    setLegs([...legs, { type: 'call', strike: spotPrice, premium: 50, quantity: -1 }]);
  };

  const removeLeg = (index) => {
    if (legs.length > 1) setLegs(legs.filter((_, i) => i !== index));
  };

  const updateLeg = (index, field, value) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], [field]: value };
    setLegs(updated);
  };

  const maxProfit = Math.max(...payoffData.map(d => d.pnl));
  const maxLoss = Math.min(...payoffData.map(d => d.pnl));
  const breakevens = payoffData.filter((d, i) => {
    if (i === 0) return false;
    return (payoffData[i - 1].pnl < 0 && d.pnl >= 0) || (payoffData[i - 1].pnl >= 0 && d.pnl < 0);
  }).map(d => d.price);

  return (
    <div className="space-y-6">
      {/* Strategy Builder */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Strategy Legs</h3>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Spot:</label>
              <Input
                type="number"
                value={spotPrice}
                onChange={(e) => setSpotPrice(+e.target.value)}
                className="w-28"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addLeg}>+ Add Leg</Button>
          </div>
        </div>
        <div className="space-y-3">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <Select value={leg.type} onChange={(e) => updateLeg(i, 'type', e.target.value)} className="w-24">
                <option value="call">Call</option>
                <option value="put">Put</option>
              </Select>
              <div>
                <label className="text-[10px] text-muted-foreground">Strike</label>
                <Input type="number" value={leg.strike || spotPrice} onChange={(e) => updateLeg(i, 'strike', +e.target.value)} className="w-24" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Premium</label>
                <Input type="number" value={leg.premium} onChange={(e) => updateLeg(i, 'premium', +e.target.value)} className="w-20" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Qty (±)</label>
                <Input type="number" value={leg.quantity} onChange={(e) => updateLeg(i, 'quantity', +e.target.value)} className="w-20" />
              </div>
              <Badge variant={leg.quantity > 0 ? 'success' : 'destructive'} className="text-xs">
                {leg.quantity > 0 ? 'BUY' : 'SELL'}
              </Badge>
              {legs.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeLeg(i)} className="text-muted-foreground hover:text-bearish">×</Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* P&L Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Max Profit</div>
          <p className="text-lg font-bold text-bullish">{maxProfit >= 999999 ? 'Unlimited' : formatINR(maxProfit)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Max Loss</div>
          <p className="text-lg font-bold text-bearish">{maxLoss <= -999999 ? 'Unlimited' : formatINR(maxLoss)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Breakeven(s)</div>
          <p className="text-lg font-bold">{breakevens.length > 0 ? breakevens.map(b => formatNumber(b)).join(', ') : 'N/A'}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Risk-Reward</div>
          <p className="text-lg font-bold">{maxLoss !== 0 ? Math.abs(maxProfit / maxLoss).toFixed(2) + 'x' : '∞'}</p>
        </Card>
      </div>

      {/* Payoff Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Payoff at Expiry</CardTitle>
          <CardDescription>P&L across underlying prices</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingAreaChart
            data={payoffData}
            dataKey="pnl"
            xAxisKey="price"
            height={300}
          />
        </CardContent>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GREEKS CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
const GreeksCalculator = () => {
  const [inputs, setInputs] = useState({
    spotPrice: 24000,
    strikePrice: 24000,
    daysToExpiry: 7,
    volatility: 15,
    riskFreeRate: 6.5,
    optionType: 'CE',
  });
  
  const [greeks, setGreeks] = useState(null);

  useEffect(() => {
    const { spotPrice, strikePrice, daysToExpiry, volatility, riskFreeRate, optionType } = inputs;
    if (daysToExpiry <= 0 || spotPrice <= 0 || strikePrice <= 0) return;
    const T = daysToExpiry / 365;
    const sigma = volatility / 100;
    const r = riskFreeRate / 100;
    const S = spotPrice;
    const K = strikePrice;

    const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const cdf = (x) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    const pdf = (x) => Math.exp(-Math.pow(x, 2) / 2) / Math.sqrt(2 * Math.PI);
    
    const delta = optionType === 'CE' ? cdf(d1) : cdf(d1) - 1;
    const gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
    const theta = -(S * sigma * pdf(d1)) / (2 * Math.sqrt(T)) / 365;
    const vega = S * Math.sqrt(T) * pdf(d1) / 100;

    // Option price
    let price;
    if (optionType === 'CE') {
      price = S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
    } else {
      price = K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
    }

    setGreeks({
      delta: delta.toFixed(4),
      gamma: gamma.toFixed(6),
      theta: theta.toFixed(2),
      vega: vega.toFixed(4),
      premium: Math.max(0.01, price).toFixed(2),
    });
  }, [inputs]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Option Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Spot Price</label>
            <Input type="number" value={inputs.spotPrice} onChange={(e) => setInputs({ ...inputs, spotPrice: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Strike Price</label>
            <Input type="number" value={inputs.strikePrice} onChange={(e) => setInputs({ ...inputs, strikePrice: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Days to Expiry</label>
            <Input type="number" value={inputs.daysToExpiry} onChange={(e) => setInputs({ ...inputs, daysToExpiry: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">IV (%)</label>
            <Input type="number" value={inputs.volatility} onChange={(e) => setInputs({ ...inputs, volatility: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Risk-Free Rate (%)</label>
            <Input type="number" value={inputs.riskFreeRate} onChange={(e) => setInputs({ ...inputs, riskFreeRate: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Option Type</label>
            <Select value={inputs.optionType} onChange={(e) => setInputs({ ...inputs, optionType: e.target.value })}>
              <option value="CE">Call (CE)</option>
              <option value="PE">Put (PE)</option>
            </Select>
          </div>
        </div>
      </Card>

      {greeks && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Delta (Δ)</div>
            <p className="text-2xl font-bold">{greeks.delta}</p>
            <p className="text-xs text-muted-foreground">Price sensitivity</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Gamma (Γ)</div>
            <p className="text-2xl font-bold">{greeks.gamma}</p>
            <p className="text-xs text-muted-foreground">Delta change rate</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Theta (Θ)</div>
            <p className="text-2xl font-bold text-bearish">{greeks.theta}</p>
            <p className="text-xs text-muted-foreground">Time decay/day</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Vega (ν)</div>
            <p className="text-2xl font-bold">{greeks.vega}</p>
            <p className="text-xs text-muted-foreground">IV sensitivity</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Premium</div>
            <p className="text-2xl font-bold text-primary">₹{greeks.premium}</p>
            <p className="text-xs text-muted-foreground">Theoretical value</p>
          </Card>
        </div>
      )}

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Understanding Greeks</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Delta:</strong> How much option price changes for ₹1 spot move</li>
              <li>• <strong>Gamma:</strong> Rate of change of Delta (acceleration)</li>
              <li>• <strong>Theta:</strong> Time decay - value lost per day</li>
              <li>• <strong>Vega:</strong> Sensitivity to 1% change in IV</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN OPTIONS HUB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const OptionsHub = () => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState([]);
  const [activeTool, setActiveTool] = useState('chain');
  const [spotPrice, setSpotPrice] = useState(0);

  // Get expiries from chain endpoint response
  const handleChainLoaded = useCallback((expiryDates, currentExpiry) => {
    if (expiryDates?.length > 0) {
      setExpiries(expiryDates);
      if (!expiry || !expiryDates.includes(expiry)) {
        setExpiry(currentExpiry || expiryDates[0]);
      }
    }
  }, [expiry]);

  // Initial expiry fetch from chain endpoint
  useEffect(() => {
    const fetchExpiries = async () => {
      try {
        const response = await fetchAPI(`/options/chain/${encodeURIComponent(symbol)}`);
        if (response?.expiryDates) {
          setExpiries(response.expiryDates);
          setExpiry(response.currentExpiry || response.expiryDates[0] || '');
          setSpotPrice(response.spotPrice || 0);
        }
      } catch {
        // Chain will retry and populate via onChainLoaded
      }
    };
    fetchExpiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <PageLayout>
      <PageHeader
        title="Options Lab"
        description="Real-time options analysis with live data"
        badge="Live"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Options Lab' },
        ]}
      />

      {/* Controls */}
      <Section className="mb-6">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Symbol Select */}
            <div className="w-full md:w-48">
              <label className="text-xs text-muted-foreground mb-1 block">Index</label>
              <Select value={symbol} onChange={(e) => { setSymbol(e.target.value); setExpiry(''); setExpiries([]); }}>
                {INDICES.map((idx) => (
                  <option key={idx.value} value={idx.value}>{idx.label}</option>
                ))}
              </Select>
            </div>
            
            {/* Expiry Select */}
            <div className="w-full md:w-48">
              <label className="text-xs text-muted-foreground mb-1 block">Expiry</label>
              <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {expiries.length === 0 && <option value="">Loading...</option>}
                {expiries.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </Select>
            </div>

            {/* Market Status */}
            <div className="flex items-center gap-2 md:ml-2">
              {isMarketHours() ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 animate-pulse" /> Market Open - Auto-refresh ON
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Market Closed
                </Badge>
              )}
            </div>
            
            {/* Tool Tabs */}
            <div className="flex-1 w-full">
              <label className="text-xs text-muted-foreground mb-1 block">Tool</label>
              <div className="flex gap-1 flex-wrap">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      activeTool === tool.id
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <tool.icon className="w-4 h-4" />
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </Section>

      {/* Tool Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTool}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTool === 'chain' && <OptionsChain symbol={symbol} expiry={expiry} onChainLoaded={handleChainLoaded} />}
          {activeTool === 'oi-analysis' && <OIAnalysis symbol={symbol} />}
          {activeTool === 'iv-skew' && <IVSkewAnalysis symbol={symbol} />}
          {activeTool === 'greeks' && <GreeksCalculator />}
          {activeTool === 'payoff' && <PayoffChart symbol={symbol} spotPrice={spotPrice} />}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  );
};

export default OptionsHub;
