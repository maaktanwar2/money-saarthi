// Dashboard - Main home page with market overview
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Activity, BarChart3, 
  ScanSearch, LineChart, Brain, Calculator,
  ArrowRight, Zap, Target, Users, Clock,
  ChevronRight, Sparkles, Shield, Eye
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Spinner } from '../components/ui';
import { TradingAreaChart, Sparkline } from '../components/ui/Charts';
import { 
  cn, formatINR, formatNumber, formatPercent, 
  getChangeColor, fetchAPI, getMarketSession 
} from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET OVERVIEW SECTION
// ═══════════════════════════════════════════════════════════════════════════════
const MarketOverview = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchAPI('/nse/indices');
        if (data?.data) {
          setIndices(data.data.slice(0, 6));
        }
      } catch (error) {
        setIndices([
          { name: 'NIFTY 50', lastPrice: 23850.5, change: 125.4, pChange: 0.53, open: 23700, high: 23900, low: 23650 },
          { name: 'BANK NIFTY', lastPrice: 51250.2, change: -85.6, pChange: -0.17, open: 51300, high: 51400, low: 51100 },
          { name: 'NIFTY IT', lastPrice: 35420.8, change: 280.5, pChange: 0.80, open: 35200, high: 35500, low: 35150 },
          { name: 'NIFTY FIN', lastPrice: 22850.6, change: -45.2, pChange: -0.20, open: 22900, high: 22950, low: 22800 },
          { name: 'MIDCAP 50', lastPrice: 14520.3, change: 89.7, pChange: 0.62, open: 14450, high: 14580, low: 14400 },
          { name: 'NIFTY METAL', lastPrice: 8950.4, change: 156.8, pChange: 1.78, open: 8800, high: 8980, low: 8780 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 skeleton rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {indices.map((index, i) => (
        <motion.div
          key={index.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium truncate">
                {index.name || index.indexSymbol}
              </span>
              <span className={cn(
                'text-xs font-semibold',
                (index.pChange || 0) >= 0 ? 'text-bullish' : 'text-bearish'
              )}>
                {(index.pChange || 0) >= 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
              </span>
            </div>
            <div className="text-xl font-bold">
              {formatNumber(index.lastPrice || index.last, { decimals: 0 })}
            </div>
            <div className={cn(
              'text-sm font-medium',
              (index.pChange || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {(index.change || 0) >= 0 ? '+' : ''}{formatNumber(index.change || 0, { decimals: 0 })} ({formatPercent(index.pChange || 0, { showSign: true })})
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK TOOLS NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
const QUICK_TOOLS = [
  {
    id: 'scanners',
    title: 'Stock Scanners',
    description: '15+ pre-built scanners for gainers, breakouts, momentum',
    icon: ScanSearch,
    path: '/scanners',
    color: 'emerald',
    accuracy: 72,
    trades: 15420,
  },
  {
    id: 'options',
    title: 'Options Lab',
    description: 'Chain analysis, Greeks, OI analytics, payoff charts',
    icon: LineChart,
    path: '/options',
    color: 'cyan',
    badge: 'Pro',
  },
  {
    id: 'advisor',
    title: 'Trade Advisor',
    description: 'AI analyzes your trades & market sentiment',
    icon: Brain,
    path: '/advisor',
    color: 'violet',
    badge: 'AI',
  },
  {
    id: 'signals',
    title: 'Trade Signals',
    description: 'AI-generated buy/sell signals with confidence scores',
    icon: Zap,
    path: '/signals',
    color: 'amber',
    accuracy: 68,
    trades: 8540,
  },
  {
    id: 'market',
    title: 'Market Pulse',
    description: 'FII/DII flows, sector performance, market breadth',
    icon: Activity,
    path: '/market',
    color: 'blue',
  },
  {
    id: 'backtest',
    title: 'Backtesting',
    description: 'Test your strategies against historical data',
    icon: BarChart3,
    path: '/backtest',
    color: 'rose',
  },
];

const QuickTools = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {QUICK_TOOLS.map((tool, i) => (
      <motion.div
        key={tool.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.05 }}
      >
        <Link to={tool.path}>
          <Card className="p-5 h-full group hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                tool.color === 'emerald' && 'bg-emerald-500/15 text-emerald-500',
                tool.color === 'cyan' && 'bg-cyan-500/15 text-cyan-500',
                tool.color === 'violet' && 'bg-violet-500/15 text-violet-500',
                tool.color === 'amber' && 'bg-amber-500/15 text-amber-500',
                tool.color === 'blue' && 'bg-blue-500/15 text-blue-500',
                tool.color === 'rose' && 'bg-rose-500/15 text-rose-500',
              )}>
                <tool.icon className="w-6 h-6" />
              </div>
              {tool.badge && (
                <Badge variant={tool.badge === 'AI' ? 'default' : 'warning'}>
                  {tool.badge}
                </Badge>
              )}
            </div>
            
            <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
              {tool.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {tool.description}
            </p>
            
            {/* Accuracy stats if available */}
            {tool.accuracy && (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="font-semibold text-primary">{tool.accuracy}%</span>
                  <span className="text-muted-foreground">accuracy</span>
                </span>
                <span className="text-muted-foreground">
                  {tool.trades?.toLocaleString()} trades
                </span>
              </div>
            )}
            
            <div className="flex items-center text-sm text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open Tool</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      </motion.div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOP GAINERS/LOSERS
// ═══════════════════════════════════════════════════════════════════════════════
const TopMovers = () => {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gainers');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gainersData, losersData] = await Promise.all([
          fetchAPI('/scanners/day-gainers?limit=5'),
          fetchAPI('/scanners/day-losers?limit=5'),
        ]);
        setGainers(gainersData?.data || gainersData || []);
        setLosers(losersData?.data || losersData || []);
      } catch (error) {
        // Fallback data
        setGainers([
          { symbol: 'TATAMOTORS', lastPrice: 985.50, pChange: 5.85 },
          { symbol: 'ADANIENT', lastPrice: 2450.30, pChange: 4.52 },
          { symbol: 'HINDALCO', lastPrice: 625.80, pChange: 3.89 },
          { symbol: 'WIPRO', lastPrice: 458.25, pChange: 3.45 },
          { symbol: 'JSWSTEEL', lastPrice: 892.60, pChange: 3.12 },
        ]);
        setLosers([
          { symbol: 'HDFC', lastPrice: 1580.40, pChange: -2.85 },
          { symbol: 'ICICIBANK', lastPrice: 1125.80, pChange: -2.12 },
          { symbol: 'KOTAK', lastPrice: 1785.30, pChange: -1.89 },
          { symbol: 'SBILIFE', lastPrice: 1420.60, pChange: -1.65 },
          { symbol: 'AXISBANK', lastPrice: 1095.25, pChange: -1.42 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const data = activeTab === 'gainers' ? gainers : losers;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('gainers')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'gainers' 
                ? 'bg-bullish/15 text-bullish' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Top Gainers
          </button>
          <button
            onClick={() => setActiveTab('losers')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'losers' 
                ? 'bg-bearish/15 text-bearish' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Top Losers
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {data.slice(0, 5).map((stock, i) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <div>
                    <p className="font-medium">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatINR(stock.lastPrice || stock.ltp)}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'text-sm font-semibold px-2 py-1 rounded-lg',
                  activeTab === 'gainers' 
                    ? 'text-bullish bg-bullish/10' 
                    : 'text-bearish bg-bearish/10'
                )}>
                  {stock.pChange >= 0 ? '+' : ''}{formatPercent(stock.pChange)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
        
        <Link 
          to={`/scanners?tab=${activeTab}`}
          className="flex items-center justify-center gap-1 text-sm text-primary mt-4 hover:underline"
        >
          View all {activeTab}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FII/DII DATA
// ═══════════════════════════════════════════════════════════════════════════════
const FIIDIIData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchAPI('/fii-dii');
        setData(result);
      } catch (error) {
        setData({
          fii: { buyValue: 12500, sellValue: 11200, netValue: 1300 },
          dii: { buyValue: 8900, sellValue: 9500, netValue: -600 },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="h-48 skeleton rounded-2xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">FII/DII Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* FII */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">FII</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn(
              'text-2xl font-bold',
              (data?.fii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {formatINR((data?.fii?.netValue || 0) * 10000000, { compact: true })}
            </p>
            <p className="text-xs text-muted-foreground">Net Activity</p>
          </div>
          
          {/* DII */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">DII</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn(
              'text-2xl font-bold',
              (data?.dii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {formatINR((data?.dii?.netValue || 0) * 10000000, { compact: true })}
            </p>
            <p className="text-xs text-muted-foreground">Net Activity</p>
          </div>
        </div>
        
        <Link 
          to="/market"
          className="flex items-center justify-center gap-1 text-sm text-primary mt-4 hover:underline"
        >
          View detailed analysis
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const marketSession = getMarketSession();

  return (
    <PageLayout>
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <Badge 
            variant={marketSession.status === 'open' ? 'success' : 'secondary'}
            className="flex items-center gap-1"
          >
            <span className={cn(
              'w-2 h-2 rounded-full',
              marketSession.status === 'open' ? 'bg-bullish animate-pulse' : 'bg-muted-foreground'
            )} />
            {marketSession.label}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Here's what's happening in the market today
        </p>
      </motion.div>

      {/* Market Overview */}
      <Section title="Market Overview" className="mb-8">
        <MarketOverview />
      </Section>

      {/* Quick Tools */}
      <Section 
        title="Trading Tools" 
        description="Access powerful tools with backtested accuracy"
        action={
          <Link to="/scanners">
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        }
        className="mb-8"
      >
        <QuickTools />
      </Section>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Movers */}
        <div className="lg:col-span-2">
          <TopMovers />
        </div>
        
        {/* FII/DII */}
        <div>
          <FIIDIIData />
        </div>
      </div>

      {/* AI Advisor CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Card className="p-6 bg-gradient-to-r from-violet-500/10 to-primary/10 border-violet-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <Brain className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  AI Trade Advisor
                  <Badge variant="default" className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                    New
                  </Badge>
                </h3>
                <p className="text-muted-foreground">
                  Get AI-powered recommendations based on your trades and market sentiment
                </p>
              </div>
            </div>
            <Link to="/advisor">
              <Button variant="gradient" className="whitespace-nowrap">
                <Sparkles className="w-4 h-4 mr-2" />
                Open Advisor
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </PageLayout>
  );
};

export default Dashboard;
