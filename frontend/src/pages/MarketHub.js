// Market Hub - FII/DII, sector performance, market breadth, money flow
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Users, Shield, TrendingUp, TrendingDown, BarChart3,
  PieChart, Layers, ArrowUpRight, ArrowDownRight, RefreshCw,
  Info, Clock, DollarSign, Percent, Building2, Globe
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Tabs, Spinner
} from '../components/ui';
import { TradingAreaChart, TradingBarChart } from '../components/ui/Charts';
import { cn, formatINR, formatNumber, formatPercent, fetchAPI, getChangeColor } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// FII DII SECTION
// ═══════════════════════════════════════════════════════════════════════════════
const FIIDIISection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('cash');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetchAPI('/fii-dii');
        setData(response);
      } catch (error) {
        setData({
          cash: {
            fii: { buyValue: 12500, sellValue: 11200, netValue: 1300 },
            dii: { buyValue: 8900, sellValue: 9500, netValue: -600 },
          },
          derivatives: {
            fii: { futuresNet: 2500, optionsNet: -800, totalNet: 1700 },
            dii: { futuresNet: -1200, optionsNet: 400, totalNet: -800 },
          },
          historical: [
            { date: 'Mon', fii: 1200, dii: -400 },
            { date: 'Tue', fii: -800, dii: 900 },
            { date: 'Wed', fii: 1500, dii: -200 },
            { date: 'Thu', fii: 1100, dii: -600 },
            { date: 'Fri', fii: 1300, dii: -600 },
          ],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="h-96 skeleton rounded-2xl" />;
  }

  const cashData = data?.cash || data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              FII/DII Activity
            </CardTitle>
            <CardDescription>Institutional money flow analysis</CardDescription>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setSegment('cash')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                segment === 'cash' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5'
              )}
            >
              Cash
            </button>
            <button
              onClick={() => setSegment('derivatives')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                segment === 'derivatives' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/5'
              )}
            >
              F&O
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* FII */}
          <div className={cn(
            'p-4 rounded-xl border',
            (cashData.fii?.netValue || 0) >= 0 ? 'bg-bullish/5 border-bullish/20' : 'bg-bearish/5 border-bearish/20'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                FII (Foreign)
              </span>
              <Badge variant={(cashData.fii?.netValue || 0) >= 0 ? 'success' : 'destructive'}>
                {(cashData.fii?.netValue || 0) >= 0 ? 'Net Buyer' : 'Net Seller'}
              </Badge>
            </div>
            <p className={cn(
              'text-3xl font-bold',
              (cashData.fii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {formatINR((cashData.fii?.netValue || 0) * 10000000, { compact: true, showSign: true })}
            </p>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Buy: {formatINR((cashData.fii?.buyValue || 0) * 10000000, { compact: true })}</span>
              <span>Sell: {formatINR((cashData.fii?.sellValue || 0) * 10000000, { compact: true })}</span>
            </div>
          </div>

          {/* DII */}
          <div className={cn(
            'p-4 rounded-xl border',
            (cashData.dii?.netValue || 0) >= 0 ? 'bg-bullish/5 border-bullish/20' : 'bg-bearish/5 border-bearish/20'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                DII (Domestic)
              </span>
              <Badge variant={(cashData.dii?.netValue || 0) >= 0 ? 'success' : 'destructive'}>
                {(cashData.dii?.netValue || 0) >= 0 ? 'Net Buyer' : 'Net Seller'}
              </Badge>
            </div>
            <p className={cn(
              'text-3xl font-bold',
              (cashData.dii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {formatINR((cashData.dii?.netValue || 0) * 10000000, { compact: true, showSign: true })}
            </p>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Buy: {formatINR((cashData.dii?.buyValue || 0) * 10000000, { compact: true })}</span>
              <span>Sell: {formatINR((cashData.dii?.sellValue || 0) * 10000000, { compact: true })}</span>
            </div>
          </div>
        </div>

        {/* Historical Chart */}
        <div>
          <h4 className="text-sm font-medium mb-3">5-Day Activity Trend</h4>
          <TradingBarChart
            data={data?.historical || []}
            dataKey="fii"
            xAxisKey="date"
            height={200}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════
const SectorPerformance = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      setLoading(true);
      try {
        const data = await fetchAPI('/nse/sector-performance');
        setSectors(data?.data || data || []);
      } catch (error) {
        setSectors([
          { sector: 'NIFTY IT', change: 1.85, value: 35420 },
          { sector: 'NIFTY METAL', change: 1.52, value: 8950 },
          { sector: 'NIFTY AUTO', change: 0.92, value: 19850 },
          { sector: 'NIFTY PHARMA', change: 0.45, value: 18520 },
          { sector: 'NIFTY BANK', change: -0.28, value: 51250 },
          { sector: 'NIFTY FMCG', change: -0.52, value: 55840 },
          { sector: 'NIFTY REALTY', change: -0.85, value: 985 },
          { sector: 'NIFTY PSU BANK', change: -1.12, value: 6850 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSectors();
  }, []);

  // Sort by performance
  const sortedSectors = [...sectors].sort((a, b) => (b.change || b.pChange || 0) - (a.change || a.pChange || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-primary" />
          Sector Performance
        </CardTitle>
        <CardDescription>Today's sector-wise market movement</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSectors.map((sector, i) => {
              const change = sector.change || sector.pChange || 0;
              const isPositive = change >= 0;
              
              return (
                <motion.div
                  key={sector.sector || sector.indexSymbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isPositive ? 'bg-bullish/10' : 'bg-bearish/10'
                    )}>
                      {isPositive ? (
                        <ArrowUpRight className="w-4 h-4 text-bullish" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-bearish" />
                      )}
                    </div>
                    <span className="font-medium">{sector.sector || sector.indexSymbol}</span>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-semibold', getChangeColor(change))}>
                      {isPositive ? '+' : ''}{formatPercent(change, { showSign: false })}
                    </p>
                    {sector.value && (
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(sector.value, { decimals: 0 })}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET BREADTH
// ═══════════════════════════════════════════════════════════════════════════════
const MarketBreadth = () => {
  const [breadth, setBreadth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreadth = async () => {
      setLoading(true);
      try {
        const data = await fetchAPI('/nse/market-breadth');
        setBreadth(data);
      } catch (error) {
        setBreadth({
          advances: 1245,
          declines: 892,
          unchanged: 63,
          advanceDeclineRatio: 1.40,
          newHighs: 45,
          newLows: 12,
          aboveAvg: 58,
          belowAvg: 42,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBreadth();
  }, []);

  if (loading) {
    return <div className="h-64 skeleton rounded-2xl" />;
  }

  const total = (breadth?.advances || 0) + (breadth?.declines || 0) + (breadth?.unchanged || 0);
  const advancePercent = total > 0 ? ((breadth?.advances || 0) / total * 100) : 50;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Market Breadth
        </CardTitle>
        <CardDescription>Overall market health indicator</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Advance/Decline Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-bullish">{breadth?.advances} Advances</span>
            <span className="text-bearish">{breadth?.declines} Declines</span>
          </div>
          <div className="h-4 rounded-full bg-bearish/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${advancePercent}%` }}
              className="h-full bg-gradient-to-r from-bullish to-emerald-400 rounded-full"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            {breadth?.unchanged} Unchanged
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">A/D Ratio</p>
            <p className={cn(
              'text-2xl font-bold',
              (breadth?.advanceDeclineRatio || 1) > 1 ? 'text-bullish' : 'text-bearish'
            )}>
              {breadth?.advanceDeclineRatio?.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-xs text-muted-foreground mb-1">New High/Low</p>
            <p className="text-xl font-bold">
              <span className="text-bullish">{breadth?.newHighs}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-bearish">{breadth?.newLows}</span>
            </p>
          </div>
        </div>

        {/* Interpretation */}
        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-sm">
            <span className="font-semibold">Market Sentiment: </span>
            <span className={cn(
              'font-medium',
              (breadth?.advanceDeclineRatio || 1) > 1.3 ? 'text-bullish' :
              (breadth?.advanceDeclineRatio || 1) < 0.7 ? 'text-bearish' : 'text-amber-500'
            )}>
              {(breadth?.advanceDeclineRatio || 1) > 1.3 ? 'Bullish' :
               (breadth?.advanceDeclineRatio || 1) < 0.7 ? 'Bearish' : 'Neutral'}
            </span>
            {' '}- {(breadth?.advanceDeclineRatio || 1) > 1 
              ? 'More stocks advancing, indicates broad-based buying'
              : 'More stocks declining, indicates broad-based selling'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INDIA VIX
// ═══════════════════════════════════════════════════════════════════════════════
const IndiaVIX = () => {
  const [vix, setVix] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVIX = async () => {
      setLoading(true);
      try {
        const data = await fetchAPI('/nse/india-vix');
        setVix(data);
      } catch (error) {
        setVix({
          value: 13.85,
          change: -0.52,
          pChange: -3.62,
          high: 14.25,
          low: 13.60,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVIX();
  }, []);

  if (loading) {
    return <div className="h-48 skeleton rounded-2xl" />;
  }

  const getVIXLevel = (value) => {
    if (value < 15) return { label: 'Low (Complacent)', color: 'text-bullish', desc: 'Market calm, good for selling options' };
    if (value < 20) return { label: 'Normal', color: 'text-amber-500', desc: 'Average volatility expected' };
    if (value < 30) return { label: 'High', color: 'text-orange-500', desc: 'Elevated fear, be cautious' };
    return { label: 'Very High (Fear)', color: 'text-bearish', desc: 'Extreme fear, potential reversal zone' };
  };

  const level = getVIXLevel(vix?.value || 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          India VIX
        </CardTitle>
        <CardDescription>Volatility & Fear Index</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <p className={cn('text-4xl font-bold', level.color)}>
            {vix?.value?.toFixed(2)}
          </p>
          <p className={cn('text-sm font-medium', getChangeColor(vix?.change || 0))}>
            {(vix?.change || 0) >= 0 ? '+' : ''}{vix?.change?.toFixed(2)} ({formatPercent(vix?.pChange || 0)})
          </p>
        </div>

        {/* VIX Gauge */}
        <div className="mb-4">
          <div className="h-3 rounded-full bg-gradient-to-r from-bullish via-amber-500 to-bearish overflow-hidden relative">
            <motion.div
              initial={{ left: '25%' }}
              animate={{ left: `${Math.min(100, (vix?.value || 15) * 2.5)}%` }}
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 -ml-2 bg-white rounded-full shadow-lg border-2 border-primary"
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0 (Low Fear)</span>
            <span>20 (Normal)</span>
            <span>40+ (High Fear)</span>
          </div>
        </div>

        {/* Interpretation */}
        <div className="p-3 rounded-xl bg-secondary/30">
          <p className={cn('font-semibold', level.color)}>{level.label}</p>
          <p className="text-sm text-muted-foreground">{level.desc}</p>
        </div>

        {/* Day Range */}
        <div className="flex justify-between text-sm mt-4">
          <span className="text-muted-foreground">Day Range:</span>
          <span>{vix?.low?.toFixed(2)} - {vix?.high?.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MARKET HUB COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const MarketHub = () => {
  return (
    <PageLayout>
      <PageHeader
        title="Market Pulse"
        description="Comprehensive market overview with institutional flows, sector performance, and breadth analysis"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Market Pulse' },
        ]}
        actions={
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FII/DII */}
        <FIIDIISection />
        
        {/* Sector Performance */}
        <SectorPerformance />
        
        {/* Market Breadth */}
        <MarketBreadth />
        
        {/* India VIX */}
        <IndiaVIX />
      </div>

      {/* Educational Note */}
      <Card className="mt-8 p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Understanding Market Indicators</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p><strong>FII/DII:</strong> FII buying is generally bullish as it brings foreign capital. DII buying during FII selling shows domestic support.</p>
              </div>
              <div>
                <p><strong>VIX:</strong> Low VIX ({`<`}15) = complacent market, good for option sellers. High VIX ({`>`}25) = fear, potential bottoming zone.</p>
              </div>
              <div>
                <p><strong>A/D Ratio:</strong> Above 1.5 indicates strong breadth (broad rally). Below 0.7 indicates weak breadth (narrow decline).</p>
              </div>
              <div>
                <p><strong>Sectors:</strong> Rotation into defensives (FMCG, Pharma) suggests risk-off. Into cyclicals (Metal, Auto) suggests risk-on.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </PageLayout>
  );
};

export default MarketHub;
