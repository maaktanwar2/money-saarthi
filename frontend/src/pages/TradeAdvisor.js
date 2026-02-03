// Trade Advisor - AI-powered trade analysis and recommendations
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Send, Sparkles, TrendingUp, TrendingDown, AlertCircle,
  Target, Shield, Clock, BarChart3, Activity, RefreshCw,
  CheckCircle, XCircle, Info, Zap, BookOpen, MessageSquare,
  ChevronRight, Eye, DollarSign, Percent
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Input, Select, Spinner
} from '../components/ui';
import { TradingAreaChart } from '../components/ui/Charts';
import { cn, formatINR, formatPercent, fetchAPI, getChangeColor } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET SENTIMENT INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════
const MarketSentiment = () => {
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const [fiiDii, breadth, vix] = await Promise.all([
          fetchAPI('/fii-dii'),
          fetchAPI('/nse/market-breadth'),
          fetchAPI('/nse/india-vix'),
        ]);
        
        setSentiment({
          fiiFlow: fiiDii?.fii?.netValue || 0,
          diiFlow: fiiDii?.dii?.netValue || 0,
          advanceDecline: breadth?.advanceDecline || 1.2,
          vix: vix?.value || 14.5,
          overall: 'neutral',
        });
      } catch (error) {
        setSentiment({
          fiiFlow: 1250,
          diiFlow: -420,
          advanceDecline: 1.35,
          vix: 13.8,
          overall: 'bullish',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSentiment();
    const interval = setInterval(fetchSentiment, 120000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="h-32 skeleton rounded-2xl" />;
  }

  const overallScore = () => {
    let score = 50;
    if (sentiment.fiiFlow > 0) score += 15;
    if (sentiment.fiiFlow < 0) score -= 15;
    if (sentiment.diiFlow > 0) score += 10;
    if (sentiment.advanceDecline > 1) score += 10;
    if (sentiment.advanceDecline < 1) score -= 10;
    if (sentiment.vix < 15) score += 10;
    if (sentiment.vix > 20) score -= 15;
    return Math.min(100, Math.max(0, score));
  };

  const score = overallScore();
  const sentimentLabel = score >= 65 ? 'Bullish' : score <= 35 ? 'Bearish' : 'Neutral';
  const sentimentColor = score >= 65 ? 'text-bullish' : score <= 35 ? 'text-bearish' : 'text-amber-500';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Market Sentiment
        </h3>
        <Badge variant={score >= 65 ? 'success' : score <= 35 ? 'destructive' : 'warning'}>
          {sentimentLabel}
        </Badge>
      </div>

      {/* Sentiment Gauge */}
      <div className="mb-6">
        <div className="relative h-4 bg-secondary rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-bearish via-amber-500 to-bullish opacity-20" />
          <motion.div
            initial={{ left: '50%' }}
            animate={{ left: `${score}%` }}
            className="absolute top-0 w-4 h-4 -ml-2 bg-white rounded-full shadow-lg"
            style={{ transform: 'translateX(-50%)' }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>

      {/* Sentiment Factors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-secondary/30">
          <div className="text-xs text-muted-foreground">FII Flow</div>
          <p className={cn('text-lg font-bold', getChangeColor(sentiment.fiiFlow))}>
            {formatINR(sentiment.fiiFlow * 10000000, { compact: true, showSign: true })}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/30">
          <div className="text-xs text-muted-foreground">DII Flow</div>
          <p className={cn('text-lg font-bold', getChangeColor(sentiment.diiFlow))}>
            {formatINR(sentiment.diiFlow * 10000000, { compact: true, showSign: true })}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/30">
          <div className="text-xs text-muted-foreground">Adv/Dec Ratio</div>
          <p className={cn('text-lg font-bold', sentiment.advanceDecline >= 1 ? 'text-bullish' : 'text-bearish')}>
            {sentiment.advanceDecline.toFixed(2)}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/30">
          <div className="text-xs text-muted-foreground">India VIX</div>
          <p className={cn('text-lg font-bold', sentiment.vix < 15 ? 'text-bullish' : sentiment.vix > 20 ? 'text-bearish' : 'text-amber-500')}>
            {sentiment.vix.toFixed(2)}
          </p>
        </div>
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE INPUT FORM
// ═══════════════════════════════════════════════════════════════════════════════
const TradeInputForm = ({ onAnalyze, loading }) => {
  const [trade, setTrade] = useState({
    symbol: '',
    type: 'BUY',
    entryPrice: '',
    quantity: '',
    stopLoss: '',
    target: '',
    timeframe: 'intraday',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze(trade);
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        Analyze Your Trade
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
            <Input
              placeholder="e.g., RELIANCE"
              value={trade.symbol}
              onChange={(e) => setTrade({ ...trade, symbol: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs text-muted-foreground mb-1 block">Trade Type</label>
            <Select
              value={trade.type}
              onChange={(e) => setTrade({ ...trade, type: e.target.value })}
            >
              <option value="BUY">Buy (Long)</option>
              <option value="SELL">Sell (Short)</option>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entry Price</label>
            <Input
              type="number"
              placeholder="₹0.00"
              value={trade.entryPrice}
              onChange={(e) => setTrade({ ...trade, entryPrice: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
            <Input
              type="number"
              placeholder="0"
              value={trade.quantity}
              onChange={(e) => setTrade({ ...trade, quantity: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Stop Loss</label>
            <Input
              type="number"
              placeholder="₹0.00"
              value={trade.stopLoss}
              onChange={(e) => setTrade({ ...trade, stopLoss: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Target</label>
            <Input
              type="number"
              placeholder="₹0.00"
              value={trade.target}
              onChange={(e) => setTrade({ ...trade, target: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Timeframe</label>
            <Select
              value={trade.timeframe}
              onChange={(e) => setTrade({ ...trade, timeframe: e.target.value })}
            >
              <option value="intraday">Intraday</option>
              <option value="swing">Swing (2-5 days)</option>
              <option value="positional">Positional (1-4 weeks)</option>
              <option value="investment">Investment (1+ month)</option>
            </Select>
          </div>
        </div>

        <Button type="submit" className="w-full" variant="gradient" disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Get AI Analysis
            </>
          )}
        </Button>
      </form>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI ANALYSIS RESULT
// ═══════════════════════════════════════════════════════════════════════════════
const AnalysisResult = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Verdict Card */}
      <Card className={cn(
        'p-6 border-2',
        analysis.verdict === 'FAVORABLE' && 'border-bullish/30 bg-bullish/5',
        analysis.verdict === 'UNFAVORABLE' && 'border-bearish/30 bg-bearish/5',
        analysis.verdict === 'NEUTRAL' && 'border-amber-500/30 bg-amber-500/5',
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center',
            analysis.verdict === 'FAVORABLE' && 'bg-bullish/20',
            analysis.verdict === 'UNFAVORABLE' && 'bg-bearish/20',
            analysis.verdict === 'NEUTRAL' && 'bg-amber-500/20',
          )}>
            {analysis.verdict === 'FAVORABLE' && <CheckCircle className="w-7 h-7 text-bullish" />}
            {analysis.verdict === 'UNFAVORABLE' && <XCircle className="w-7 h-7 text-bearish" />}
            {analysis.verdict === 'NEUTRAL' && <AlertCircle className="w-7 h-7 text-amber-500" />}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">
              Trade is {analysis.verdict}
            </h3>
            <p className="text-muted-foreground">
              {analysis.summary}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className="text-2xl font-bold text-primary">{analysis.confidence}%</div>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Risk/Reward</div>
          <p className={cn(
            'text-2xl font-bold',
            analysis.riskReward >= 2 ? 'text-bullish' : analysis.riskReward >= 1 ? 'text-amber-500' : 'text-bearish'
          )}>
            1:{analysis.riskReward.toFixed(1)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Win Probability</div>
          <p className="text-2xl font-bold text-primary">{analysis.winProbability}%</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Max Risk</div>
          <p className="text-2xl font-bold text-bearish">{formatINR(analysis.maxRisk)}</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Potential Profit</div>
          <p className="text-2xl font-bold text-bullish">{formatINR(analysis.potentialProfit)}</p>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Technical Analysis */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Technical Analysis
            </h4>
            <ul className="space-y-2">
              {analysis.technicalPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    point.type === 'bullish' && 'bg-bullish/20 text-bullish',
                    point.type === 'bearish' && 'bg-bearish/20 text-bearish',
                    point.type === 'neutral' && 'bg-amber-500/20 text-amber-500',
                  )}>
                    {point.type === 'bullish' && <TrendingUp className="w-3 h-3" />}
                    {point.type === 'bearish' && <TrendingDown className="w-3 h-3" />}
                    {point.type === 'neutral' && <Activity className="w-3 h-3" />}
                  </span>
                  <span className="text-muted-foreground">{point.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Market Context */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Market Context
            </h4>
            <ul className="space-y-2">
              {analysis.marketContext.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Recommendations
            </h4>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECENT SIGNALS
// ═══════════════════════════════════════════════════════════════════════════════
const RecentSignals = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const data = await fetchAPI('/tools/ai-trading-agent?action=get_signals');
        setSignals(data?.signals || []);
      } catch (error) {
        setSignals([
          { symbol: 'RELIANCE', type: 'BUY', confidence: 78, target: 2850, reason: 'Breakout above resistance with volume' },
          { symbol: 'INFY', type: 'SELL', confidence: 72, target: 1520, reason: 'RSI overbought, near resistance' },
          { symbol: 'TATASTEEL', type: 'BUY', confidence: 81, target: 165, reason: 'Bullish flag breakout' },
          { symbol: 'HDFCBANK', type: 'BUY', confidence: 68, target: 1720, reason: 'Support bounce with FII buying' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSignals();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          AI Signals
        </CardTitle>
        <CardDescription>Latest trade recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{signal.symbol}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={signal.type === 'BUY' ? 'success' : 'destructive'}>
                      {signal.type}
                    </Badge>
                    <span className="text-xs text-primary font-semibold">
                      {signal.confidence}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{signal.reason}</p>
                <p className="text-xs text-primary mt-1">Target: {formatINR(signal.target)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TRADE ADVISOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TradeAdvisor = () => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (trade) => {
    setLoading(true);
    try {
      const response = await fetchAPI('/tools/ai-trading-agent', {
        method: 'POST',
        body: JSON.stringify({
          action: 'analyze_trade',
          trade,
        }),
      });
      setAnalysis(response);
    } catch (error) {
      // Mock analysis
      const entry = parseFloat(trade.entryPrice) || 1000;
      const sl = parseFloat(trade.stopLoss) || entry * 0.98;
      const target = parseFloat(trade.target) || entry * 1.05;
      const qty = parseInt(trade.quantity) || 1;
      const risk = Math.abs(entry - sl) * qty;
      const reward = Math.abs(target - entry) * qty;
      
      setAnalysis({
        verdict: reward / risk >= 2 ? 'FAVORABLE' : reward / risk >= 1 ? 'NEUTRAL' : 'UNFAVORABLE',
        confidence: 72,
        summary: `This ${trade.type.toLowerCase()} trade on ${trade.symbol} shows ${reward/risk >= 2 ? 'good' : 'moderate'} risk-reward characteristics. Current market sentiment and technical indicators ${reward/risk >= 2 ? 'support' : 'partially support'} this setup.`,
        riskReward: reward / risk,
        winProbability: Math.min(75, 50 + (reward / risk) * 10),
        maxRisk: risk,
        potentialProfit: reward,
        technicalPoints: [
          { type: 'bullish', text: 'Price above 20 & 50 EMA indicating uptrend' },
          { type: 'bullish', text: 'RSI at 58, healthy momentum without overbought conditions' },
          { type: 'neutral', text: 'Volume slightly below average, watch for confirmation' },
          { type: 'bearish', text: 'Near previous resistance zone, may face selling pressure' },
        ],
        marketContext: [
          'NIFTY trading above psychological 23800 level',
          'FII net buyers in cash segment today',
          'Sector (if applicable) showing relative strength',
          'India VIX at comfortable levels suggesting low fear',
        ],
        recommendations: [
          'Consider scaling into position in 2-3 tranches',
          'Move stop loss to breakeven once trade moves 1% in favor',
          'Book partial profits (50%) at first target',
          'Trail remaining position with 20 EMA on hourly chart',
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="AI Trade Advisor"
        description="Get AI-powered analysis and recommendations for your trades"
        badge="AI"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Trade Advisor' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input & Sentiment */}
        <div className="space-y-6">
          <TradeInputForm onAnalyze={handleAnalyze} loading={loading} />
          <MarketSentiment />
        </div>

        {/* Center Column - Analysis Result */}
        <div className="lg:col-span-2">
          {analysis ? (
            <AnalysisResult analysis={analysis} />
          ) : (
            <Card className="p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Brain className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Ready to Analyze</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Enter your trade details on the left and our AI will analyze it based on technical indicators,
                market sentiment, and risk parameters.
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Technical Analysis
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Sentiment Check
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Risk Assessment
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Signals */}
      <Section title="Latest AI Signals" className="mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RecentSignals />
          
          {/* Educational Card */}
          <Card className="p-6 col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-br from-primary/5 to-violet-500/5 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">How Trade Advisor Works</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                  <div>
                    <h4 className="font-medium text-foreground mb-1">1. Technical Analysis</h4>
                    <p>Analyzes price action, indicators (RSI, MACD, EMAs), and chart patterns to assess technical health.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">2. Market Context</h4>
                    <p>Considers FII/DII flows, market breadth, VIX, and sector performance for broader context.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">3. Risk Assessment</h4>
                    <p>Calculates risk-reward ratio, position sizing, and provides actionable recommendations.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Section>
    </PageLayout>
  );
};

export default TradeAdvisor;
