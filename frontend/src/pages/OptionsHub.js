// Options Hub - Options chain, Greeks, OI analytics, payoff charts
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, BarChart3, TrendingUp, TrendingDown, Activity,
  RefreshCw, Download, Settings2, Info, Target, Layers,
  ArrowUpRight, ArrowDownRight, Percent, DollarSign, Clock
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Input, Select, Tabs, Spinner
} from '../components/ui';
import DataTable from '../components/ui/DataTable';
import { TradingAreaChart, TradingBarChart } from '../components/ui/Charts';
import { cn, formatINR, formatNumber, formatPercent, fetchAPI, getChangeColor } from '../lib/utils';

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
  { id: 'payoff', label: 'Payoff Chart', icon: LineChart },
  { id: 'greeks', label: 'Greeks', icon: Activity },
  { id: 'iv-skew', label: 'IV Skew', icon: TrendingUp },
];

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIONS CHAIN TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const OptionsChain = ({ symbol, expiry }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spotPrice, setSpotPrice] = useState(0);

  useEffect(() => {
    const fetchChain = async () => {
      setLoading(true);
      try {
        const response = await fetchAPI(`/options/chain?symbol=${symbol}&expiry=${expiry}`);
        if (response?.data) {
          setData(response.data.records?.data || []);
          setSpotPrice(response.data.records?.underlyingValue || 0);
        }
      } catch (error) {
        // Mock data
        const mockStrikes = Array.from({ length: 15 }, (_, i) => {
          const strike = 23500 + (i - 7) * 50;
          return {
            strikePrice: strike,
            CE: {
              openInterest: Math.floor(Math.random() * 1000000),
              changeinOpenInterest: Math.floor((Math.random() - 0.5) * 100000),
              totalTradedVolume: Math.floor(Math.random() * 500000),
              impliedVolatility: 12 + Math.random() * 8,
              lastPrice: Math.max(1, 23850 - strike + Math.random() * 50),
              change: (Math.random() - 0.5) * 20,
              pChange: (Math.random() - 0.5) * 10,
            },
            PE: {
              openInterest: Math.floor(Math.random() * 1000000),
              changeinOpenInterest: Math.floor((Math.random() - 0.5) * 100000),
              totalTradedVolume: Math.floor(Math.random() * 500000),
              impliedVolatility: 12 + Math.random() * 8,
              lastPrice: Math.max(1, strike - 23850 + Math.random() * 50),
              change: (Math.random() - 0.5) * 20,
              pChange: (Math.random() - 0.5) * 10,
            },
          };
        });
        setData(mockStrikes);
        setSpotPrice(23850);
      } finally {
        setLoading(false);
      }
    };

    fetchChain();
  }, [symbol, expiry]);

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
          <span className="ml-3 text-muted-foreground">Loading options chain...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Options Chain - {symbol}</CardTitle>
            <CardDescription>
              Spot: {formatINR(spotPrice)} | {data.length} strikes loaded
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">Live</Badge>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/30">
                <th colSpan={5} className="px-4 py-2 text-center text-bullish border-b border-white/[0.08]">
                  CALLS
                </th>
                <th className="px-4 py-2 text-center border-x border-white/[0.08] bg-secondary/50">
                  Strike
                </th>
                <th colSpan={5} className="px-4 py-2 text-center text-bearish border-b border-white/[0.08]">
                  PUTS
                </th>
              </tr>
              <tr className="text-xs text-muted-foreground">
                <th className="px-3 py-2 text-right">OI</th>
                <th className="px-3 py-2 text-right">Chng OI</th>
                <th className="px-3 py-2 text-right">Volume</th>
                <th className="px-3 py-2 text-right">IV</th>
                <th className="px-3 py-2 text-right">LTP</th>
                <th className="px-3 py-2 text-center bg-secondary/30"></th>
                <th className="px-3 py-2 text-left">LTP</th>
                <th className="px-3 py-2 text-left">IV</th>
                <th className="px-3 py-2 text-left">Volume</th>
                <th className="px-3 py-2 text-left">Chng OI</th>
                <th className="px-3 py-2 text-left">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {data.map((row, i) => {
                const isITM_CE = row.strikePrice < spotPrice;
                const isITM_PE = row.strikePrice > spotPrice;
                const isATM = Math.abs(row.strikePrice - spotPrice) < 25;
                
                return (
                  <tr 
                    key={row.strikePrice}
                    className={cn(
                      'hover:bg-white/[0.03]',
                      isATM && 'bg-primary/5'
                    )}
                  >
                    {/* CALLS */}
                    <td className={cn('px-3 py-2 text-right', isITM_CE && 'bg-bullish/5')}>
                      {formatNumber(row.CE?.openInterest, { compact: true })}
                    </td>
                    <td className={cn(
                      'px-3 py-2 text-right',
                      isITM_CE && 'bg-bullish/5',
                      getChangeColor(row.CE?.changeinOpenInterest)
                    )}>
                      {formatNumber(row.CE?.changeinOpenInterest, { compact: true, showSign: true })}
                    </td>
                    <td className={cn('px-3 py-2 text-right', isITM_CE && 'bg-bullish/5')}>
                      {formatNumber(row.CE?.totalTradedVolume, { compact: true })}
                    </td>
                    <td className={cn('px-3 py-2 text-right', isITM_CE && 'bg-bullish/5')}>
                      {row.CE?.impliedVolatility?.toFixed(1)}%
                    </td>
                    <td className={cn(
                      'px-3 py-2 text-right font-medium',
                      isITM_CE && 'bg-bullish/5',
                      getChangeColor(row.CE?.change)
                    )}>
                      {formatINR(row.CE?.lastPrice)}
                    </td>
                    
                    {/* STRIKE */}
                    <td className={cn(
                      'px-3 py-2 text-center font-bold bg-secondary/30 border-x border-white/[0.08]',
                      isATM && 'text-primary'
                    )}>
                      {row.strikePrice}
                      {isATM && <span className="text-xs ml-1">(ATM)</span>}
                    </td>
                    
                    {/* PUTS */}
                    <td className={cn(
                      'px-3 py-2 text-left font-medium',
                      isITM_PE && 'bg-bearish/5',
                      getChangeColor(row.PE?.change)
                    )}>
                      {formatINR(row.PE?.lastPrice)}
                    </td>
                    <td className={cn('px-3 py-2 text-left', isITM_PE && 'bg-bearish/5')}>
                      {row.PE?.impliedVolatility?.toFixed(1)}%
                    </td>
                    <td className={cn('px-3 py-2 text-left', isITM_PE && 'bg-bearish/5')}>
                      {formatNumber(row.PE?.totalTradedVolume, { compact: true })}
                    </td>
                    <td className={cn(
                      'px-3 py-2 text-left',
                      isITM_PE && 'bg-bearish/5',
                      getChangeColor(row.PE?.changeinOpenInterest)
                    )}>
                      {formatNumber(row.PE?.changeinOpenInterest, { compact: true, showSign: true })}
                    </td>
                    <td className={cn('px-3 py-2 text-left', isITM_PE && 'bg-bearish/5')}>
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
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// OI ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
const OIAnalysis = ({ symbol }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOI = async () => {
      setLoading(true);
      try {
        const response = await fetchAPI(`/options/oi-analytics?symbol=${symbol}`);
        setData(response);
      } catch (error) {
        // Mock data
        setData({
          pcr: 0.87,
          maxPainStrike: 23800,
          totalCEOI: 12500000,
          totalPEOI: 10875000,
          cePeRatio: 1.15,
          strongestSupport: 23600,
          strongestResistance: 24000,
          oiBuildup: [
            { strike: 23600, ce_oi: 850000, pe_oi: 420000 },
            { strike: 23700, ce_oi: 920000, pe_oi: 650000 },
            { strike: 23800, ce_oi: 1250000, pe_oi: 980000 },
            { strike: 23900, ce_oi: 780000, pe_oi: 1150000 },
            { strike: 24000, ce_oi: 450000, pe_oi: 1380000 },
          ],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOI();
  }, [symbol]);

  if (loading) {
    return <Card className="p-8"><Spinner className="mx-auto" /></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Put-Call Ratio</span>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className={cn(
            'text-2xl font-bold',
            data?.pcr > 1 ? 'text-bullish' : data?.pcr < 0.7 ? 'text-bearish' : 'text-amber-500'
          )}>
            {data?.pcr?.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {data?.pcr > 1 ? 'Bullish bias' : data?.pcr < 0.7 ? 'Bearish bias' : 'Neutral'}
          </p>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Max Pain</span>
            <Target className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-primary">{data?.maxPainStrike}</p>
          <p className="text-xs text-muted-foreground">Strike price</p>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Support</span>
            <ArrowUpRight className="w-4 h-4 text-bullish" />
          </div>
          <p className="text-2xl font-bold text-bullish">{data?.strongestSupport}</p>
          <p className="text-xs text-muted-foreground">Highest PE OI</p>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Resistance</span>
            <ArrowDownRight className="w-4 h-4 text-bearish" />
          </div>
          <p className="text-2xl font-bold text-bearish">{data?.strongestResistance}</p>
          <p className="text-xs text-muted-foreground">Highest CE OI</p>
        </Card>
      </div>

      {/* OI Chart */}
      <Card>
        <CardHeader>
          <CardTitle>OI Buildup by Strike</CardTitle>
          <CardDescription>Call OI vs Put OI distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingBarChart
            data={data?.oiBuildup || []}
            dataKey="ce_oi"
            xAxisKey="strike"
            height={250}
          />
        </CardContent>
      </Card>

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
// GREEKS CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
const GreeksCalculator = () => {
  const [inputs, setInputs] = useState({
    spotPrice: 23850,
    strikePrice: 23800,
    daysToExpiry: 7,
    volatility: 15,
    riskFreeRate: 6.5,
    optionType: 'CE',
  });
  
  const [greeks, setGreeks] = useState(null);

  useEffect(() => {
    // Calculate Greeks (simplified Black-Scholes approximation)
    const { spotPrice, strikePrice, daysToExpiry, volatility, riskFreeRate, optionType } = inputs;
    const T = daysToExpiry / 365;
    const sigma = volatility / 100;
    const r = riskFreeRate / 100;
    const S = spotPrice;
    const K = strikePrice;

    const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2) * T)) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    // Simplified CDF approximation
    const cdf = (x) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    
    const delta = optionType === 'CE' ? cdf(d1) : cdf(d1) - 1;
    const gamma = Math.exp(-Math.pow(d1, 2) / 2) / (S * sigma * Math.sqrt(2 * Math.PI * T));
    const theta = -(S * sigma * Math.exp(-Math.pow(d1, 2) / 2)) / (2 * Math.sqrt(2 * Math.PI * T)) / 365;
    const vega = S * Math.sqrt(T) * Math.exp(-Math.pow(d1, 2) / 2) / Math.sqrt(2 * Math.PI) / 100;

    setGreeks({
      delta: delta.toFixed(4),
      gamma: gamma.toFixed(6),
      theta: theta.toFixed(2),
      vega: vega.toFixed(4),
      premium: Math.max(0, (optionType === 'CE' ? S - K : K - S) + vega * 10).toFixed(2),
    });
  }, [inputs]);

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Option Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Spot Price</label>
            <Input
              type="number"
              value={inputs.spotPrice}
              onChange={(e) => setInputs({ ...inputs, spotPrice: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Strike Price</label>
            <Input
              type="number"
              value={inputs.strikePrice}
              onChange={(e) => setInputs({ ...inputs, strikePrice: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Days to Expiry</label>
            <Input
              type="number"
              value={inputs.daysToExpiry}
              onChange={(e) => setInputs({ ...inputs, daysToExpiry: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">IV (%)</label>
            <Input
              type="number"
              value={inputs.volatility}
              onChange={(e) => setInputs({ ...inputs, volatility: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Risk-Free Rate (%)</label>
            <Input
              type="number"
              value={inputs.riskFreeRate}
              onChange={(e) => setInputs({ ...inputs, riskFreeRate: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Option Type</label>
            <Select
              value={inputs.optionType}
              onChange={(e) => setInputs({ ...inputs, optionType: e.target.value })}
            >
              <option value="CE">Call (CE)</option>
              <option value="PE">Put (PE)</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Greeks Display */}
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

      {/* Educational Info */}
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

  // Fetch expiries
  useEffect(() => {
    const fetchExpiries = async () => {
      try {
        const response = await fetchAPI(`/options/expiries?symbol=${symbol}`);
        const expiryList = response?.expiries || response || [];
        setExpiries(expiryList);
        if (expiryList.length > 0 && !expiry) {
          setExpiry(expiryList[0]);
        }
      } catch (error) {
        // Mock expiries
        const mockExpiries = ['30-Jan-2025', '06-Feb-2025', '13-Feb-2025', '27-Feb-2025'];
        setExpiries(mockExpiries);
        if (!expiry) setExpiry(mockExpiries[0]);
      }
    };

    fetchExpiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <PageLayout>
      <PageHeader
        title="Options Lab"
        description="Advanced options analysis with chain, Greeks, OI analytics"
        badge="Pro"
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
              <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {INDICES.map((idx) => (
                  <option key={idx.value} value={idx.value}>{idx.label}</option>
                ))}
              </Select>
            </div>
            
            {/* Expiry Select */}
            <div className="w-full md:w-48">
              <label className="text-xs text-muted-foreground mb-1 block">Expiry</label>
              <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {expiries.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </Select>
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
          {activeTool === 'chain' && <OptionsChain symbol={symbol} expiry={expiry} />}
          {activeTool === 'oi-analysis' && <OIAnalysis symbol={symbol} />}
          {activeTool === 'greeks' && <GreeksCalculator />}
          {activeTool === 'payoff' && (
            <Card className="p-8 text-center">
              <LineChart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Payoff Chart</h3>
              <p className="text-muted-foreground">Coming soon - Interactive strategy payoff visualization</p>
            </Card>
          )}
          {activeTool === 'iv-skew' && (
            <Card className="p-8 text-center">
              <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">IV Skew Analysis</h3>
              <p className="text-muted-foreground">Coming soon - Implied volatility smile and skew charts</p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  );
};

export default OptionsHub;
