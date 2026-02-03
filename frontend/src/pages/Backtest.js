import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs, AccuracyBadge } from '../components/ui';
import { TradingAreaChart, TradingBarChart } from '../components/ui/Charts';
import { formatINR, formatPercent } from '../lib/utils';

// Backtesting Page
export default function Backtest() {
  const [symbol, setSymbol] = useState('NIFTY');
  const [strategy, setStrategy] = useState('momentum');
  const [period, setPeriod] = useState('1Y');
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Available strategies
  const strategies = [
    { id: 'momentum', name: 'Momentum Breakout', desc: 'Buy on breakout above resistance' },
    { id: 'mean-reversion', name: 'Mean Reversion', desc: 'Buy oversold, sell overbought' },
    { id: 'macd-cross', name: 'MACD Crossover', desc: 'Trade MACD signal crossovers' },
    { id: 'rsi-divergence', name: 'RSI Divergence', desc: 'Trade bullish/bearish divergences' },
    { id: 'ema-cross', name: 'EMA Crossover', desc: '9/21 EMA crossover strategy' },
    { id: 'supertrend', name: 'Supertrend', desc: 'Follow Supertrend indicator signals' },
  ];

  const runBacktest = () => {
    setIsRunning(true);
    
    // Simulate backtest (in real app, call API)
    setTimeout(() => {
      setResults({
        totalTrades: 145,
        winningTrades: 89,
        losingTrades: 56,
        winRate: 61.4,
        totalPnL: 285000,
        maxDrawdown: -45000,
        sharpeRatio: 1.85,
        profitFactor: 2.1,
        avgWin: 4500,
        avgLoss: -2800,
        largestWin: 25000,
        largestLoss: -12000,
        avgHoldingDays: 3.5,
        equity: [
          { date: 'Jan', value: 100000 },
          { date: 'Feb', value: 115000 },
          { date: 'Mar', value: 108000 },
          { date: 'Apr', value: 135000 },
          { date: 'May', value: 158000 },
          { date: 'Jun', value: 145000 },
          { date: 'Jul', value: 178000 },
          { date: 'Aug', value: 205000 },
          { date: 'Sep', value: 195000 },
          { date: 'Oct', value: 245000 },
          { date: 'Nov', value: 268000 },
          { date: 'Dec', value: 285000 },
        ],
        monthlyReturns: [
          { month: 'Jan', return: 15 },
          { month: 'Feb', return: -6 },
          { month: 'Mar', return: 25 },
          { month: 'Apr', return: 17 },
          { month: 'May', return: -8 },
          { month: 'Jun', return: 23 },
          { month: 'Jul', return: 15 },
          { month: 'Aug', return: -5 },
          { month: 'Sep', return: 26 },
          { month: 'Oct', return: 9 },
          { month: 'Nov', return: 6 },
          { month: 'Dec', return: 12 },
        ]
      });
      setIsRunning(false);
    }, 2000);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Strategy Backtesting"
        subtitle="Test trading strategies on historical data"
        accuracy={94.5}
        totalTrades="1M+"
      />

      <Section>
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Symbol</label>
                  <select 
                    className="input w-full"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value)}
                  >
                    <option value="NIFTY">NIFTY 50</option>
                    <option value="BANKNIFTY">BANK NIFTY</option>
                    <option value="FINNIFTY">FIN NIFTY</option>
                    <option value="RELIANCE">RELIANCE</option>
                    <option value="TCS">TCS</option>
                    <option value="INFY">INFOSYS</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Strategy</label>
                  <select 
                    className="input w-full"
                    value={strategy}
                    onChange={e => setStrategy(e.target.value)}
                  >
                    {strategies.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {strategies.find(s => s.id === strategy)?.desc}
                  </p>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Period</label>
                  <div className="flex gap-2">
                    {['3M', '6M', '1Y', '2Y', '5Y'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`flex-1 py-2 rounded text-sm ${
                          period === p 
                            ? 'bg-primary text-white' 
                            : 'bg-card border border-border hover:border-primary/50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Initial Capital</label>
                  <Input type="number" defaultValue={100000} />
                </div>

                <Button 
                  className="w-full" 
                  onClick={runBacktest}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Running...
                    </>
                  ) : (
                    'Run Backtest'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Strategy Info */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. Select your preferred trading instrument</p>
                <p>2. Choose a strategy from our pre-built library</p>
                <p>3. Set your testing period and capital</p>
                <p>4. Run the backtest to see historical performance</p>
                <p>5. Analyze results before live trading</p>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3">
            {!results && !isRunning && (
              <Card className="glass-card h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center text-muted-foreground">
                  <div className="text-4xl mb-4">📊</div>
                  <p>Configure and run a backtest to see results</p>
                </div>
              </Card>
            )}

            {isRunning && (
              <Card className="glass-card h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Running backtest on historical data...</p>
                </div>
              </Card>
            )}

            {results && !isRunning && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="glass-card p-4 text-center">
                    <div className={`text-2xl font-bold ${results.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatINR(results.totalPnL)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total P&L</div>
                  </Card>
                  <Card className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{results.winRate}%</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </Card>
                  <Card className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold">{results.profitFactor}</div>
                    <div className="text-xs text-muted-foreground">Profit Factor</div>
                  </Card>
                  <Card className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold">{results.sharpeRatio}</div>
                    <div className="text-xs text-muted-foreground">Sharpe Ratio</div>
                  </Card>
                </div>

                {/* Equity Curve */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <TradingAreaChart 
                        data={results.equity}
                        dataKey="value"
                        xKey="date"
                        color="#10b981"
                        gradientId="equity"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Returns */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Monthly Returns (%)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <TradingBarChart 
                        data={results.monthlyReturns}
                        dataKey="return"
                        xKey="month"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Stats */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Trade Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: 'Total Trades', value: results.totalTrades },
                        { label: 'Winning Trades', value: results.winningTrades, color: 'text-profit' },
                        { label: 'Losing Trades', value: results.losingTrades, color: 'text-loss' },
                        { label: 'Average Win', value: formatINR(results.avgWin), color: 'text-profit' },
                        { label: 'Average Loss', value: formatINR(results.avgLoss), color: 'text-loss' },
                        { label: 'Largest Win', value: formatINR(results.largestWin), color: 'text-profit' },
                        { label: 'Largest Loss', value: formatINR(results.largestLoss), color: 'text-loss' },
                        { label: 'Avg Holding Period', value: `${results.avgHoldingDays} days` },
                      ].map(stat => (
                        <div key={stat.label} className="flex justify-between">
                          <span className="text-muted-foreground">{stat.label}</span>
                          <span className={`font-medium ${stat.color || ''}`}>{stat.value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Risk Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: 'Max Drawdown', value: formatINR(results.maxDrawdown), color: 'text-loss' },
                        { label: 'Sharpe Ratio', value: results.sharpeRatio },
                        { label: 'Profit Factor', value: results.profitFactor },
                        { label: 'Win Rate', value: `${results.winRate}%` },
                        { label: 'Risk/Reward', value: (results.avgWin / Math.abs(results.avgLoss)).toFixed(2) },
                        { label: 'Recovery Factor', value: (results.totalPnL / Math.abs(results.maxDrawdown)).toFixed(2) },
                      ].map(stat => (
                        <div key={stat.label} className="flex justify-between">
                          <span className="text-muted-foreground">{stat.label}</span>
                          <span className={`font-medium ${stat.color || ''}`}>{stat.value}</span>
                        </div>
                      ))}
                      
                      <div className="pt-4 mt-4 border-t border-border">
                        <AccuracyBadge accuracy={results.winRate} />
                        <p className="text-xs text-muted-foreground mt-2">
                          Based on {results.totalTrades} simulated trades over {period}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
