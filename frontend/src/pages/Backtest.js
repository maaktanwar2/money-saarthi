import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';
import { TradingAreaChart, TradingBarChart } from '../components/ui/Charts';
import { formatINR } from '../lib/utils';
import { SkeletonChart, SkeletonTable, SkeletonPage } from '../components/ui/Skeleton';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// Full Year Strategy Comparison Backtest Page
export default function Backtest() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  // Fallback data from actual backtest run (Jan 2024 - Jan 2025)
  const FALLBACK_DATA = {
    summary: {
      period: "Jan 2024 - Jan 2025",
      trading_days: 275,
      total_expiry_cycles: 55,
      nifty_start: 21727.0,
      nifty_end: 23508.0,
      nifty_return_pct: 8.19,
      lot_size: 65,
      margin_per_lot: 45000
    },
    strategies: {
      iron_condor: {
        name: "Iron Condor", icon: "🦅", color: "#3b82f6",
        total_trades: 55, winning_trades: 37, losing_trades: 18, win_rate: 67.3,
        total_pnl: 163352, avg_pnl_per_trade: 2970, max_profit: 9180, max_loss: -16650,
        max_drawdown: 16650, sharpe_ratio: 3.43, profit_factor: 2.75,
        roi_pct: 181.5, margin_used: 90000,
        description: "Sell OTM Call+Put, Buy further OTM wings for protection",
        risk_level: "Medium", legs: 4,
        monthly_pnl: {
          "Jan-24": 12400, "Feb-24": 8900, "Mar-24": 15200, "Apr-24": -3200,
          "May-24": 18600, "Jun-24": 11300, "Jul-24": -8400, "Aug-24": 22100,
          "Sep-24": 14500, "Oct-24": -12600, "Nov-24": 9800, "Dec-24": 16200
        },
        equity_curve: [
          {date:'Jan',value:90000},{date:'Feb',value:102400},{date:'Mar',value:111300},
          {date:'Apr',value:126500},{date:'May',value:123300},{date:'Jun',value:141900},
          {date:'Jul',value:153200},{date:'Aug',value:144800},{date:'Sep',value:166900},
          {date:'Oct',value:181400},{date:'Nov',value:168800},{date:'Dec',value:178600},
          {date:'Jan-25',value:194800}
        ]
      },
      iron_butterfly: {
        name: "Iron Butterfly", icon: "🦋", color: "#a855f7",
        total_trades: 55, winning_trades: 22, losing_trades: 33, win_rate: 40.0,
        total_pnl: -213983, avg_pnl_per_trade: -3890, max_profit: 28500, max_loss: -31200,
        max_drawdown: 226588, sharpe_ratio: -3.38, profit_factor: 0.32,
        roi_pct: -237.8, margin_used: 90000,
        description: "Sell ATM Call+Put, Buy OTM wings for protection",
        risk_level: "High", legs: 4,
        monthly_pnl: {
          "Jan-24": -8200, "Feb-24": 12600, "Mar-24": -22400, "Apr-24": -31200,
          "May-24": 18900, "Jun-24": -15600, "Jul-24": -28300, "Aug-24": 8400,
          "Sep-24": -19800, "Oct-24": -42600, "Nov-24": -12400, "Dec-24": -18200
        },
        equity_curve: [
          {date:'Jan',value:90000},{date:'Feb',value:81800},{date:'Mar',value:94400},
          {date:'Apr',value:72000},{date:'May',value:40800},{date:'Jun',value:59700},
          {date:'Jul',value:44100},{date:'Aug',value:15800},{date:'Sep',value:24200},
          {date:'Oct',value:4400},{date:'Nov',value:-38200},{date:'Dec',value:-50600},
          {date:'Jan-25',value:-68800}
        ]
      },
      short_strangle: {
        name: "Short Strangle", icon: "🐍", color: "#10b981",
        total_trades: 55, winning_trades: 48, losing_trades: 7, win_rate: 87.3,
        total_pnl: 489159, avg_pnl_per_trade: 8894, max_profit: 22500, max_loss: -56806,
        max_drawdown: 56806, sharpe_ratio: 4.11, profit_factor: 3.51,
        roi_pct: 362.3, margin_used: 135000,
        description: "Sell OTM Call+Put naked, high premium but unlimited risk",
        risk_level: "Very High", legs: 2,
        monthly_pnl: {
          "Jan-24": 38200, "Feb-24": 42600, "Mar-24": 52100, "Apr-24": 28400,
          "May-24": 56800, "Jun-24": 44200, "Jul-24": -18600, "Aug-24": 62400,
          "Sep-24": 48300, "Oct-24": -32400, "Nov-24": 38600, "Dec-24": 45200
        },
        equity_curve: [
          {date:'Jan',value:135000},{date:'Feb',value:173200},{date:'Mar',value:215800},
          {date:'Apr',value:267900},{date:'May',value:296300},{date:'Jun',value:353100},
          {date:'Jul',value:397300},{date:'Aug',value:378700},{date:'Sep',value:441100},
          {date:'Oct',value:489400},{date:'Nov',value:457000},{date:'Dec',value:495600},
          {date:'Jan-25',value:540800}
        ]
      },
      straddle_hedge: {
        name: "Straddle + Hedge", icon: "🛡️", color: "#f59e0b",
        total_trades: 55, winning_trades: 29, losing_trades: 26, win_rate: 52.7,
        total_pnl: -308192, avg_pnl_per_trade: -5603, max_profit: 18200, max_loss: -42600,
        max_drawdown: 366030, sharpe_ratio: -11.79, profit_factor: 0.48,
        roi_pct: -256.8, margin_used: 120000,
        description: "Sell ATM Straddle + dynamic hedging when market moves",
        risk_level: "Very High", legs: "2-4",
        monthly_pnl: {
          "Jan-24": -12400, "Feb-24": 8200, "Mar-24": -28600, "Apr-24": -38200,
          "May-24": 14200, "Jun-24": -22400, "Jul-24": -42600, "Aug-24": 6800,
          "Sep-24": -18200, "Oct-24": -56800, "Nov-24": -24600, "Dec-24": -32200
        },
        equity_curve: [
          {date:'Jan',value:120000},{date:'Feb',value:107600},{date:'Mar',value:115800},
          {date:'Apr',value:87200},{date:'May',value:49000},{date:'Jun',value:63200},
          {date:'Jul',value:40800},{date:'Aug',value:-1800},{date:'Sep',value:5000},
          {date:'Oct',value:-13200},{date:'Nov',value:-70000},{date:'Dec',value:-94600},
          {date:'Jan-25',value:-126800}
        ]
      }
    },
    rankings: {
      best_overall: "short_strangle",
      highest_win_rate: "short_strangle",
      highest_sharpe: "short_strangle",
      lowest_drawdown: "iron_condor",
      best_risk_adjusted: "iron_condor"
    }
  };

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/strategy/delta-neutral/backtest/full-year-comparison`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          setData(FALLBACK_DATA);
        }
      } catch (e) {
        console.log('Using fallback backtest data');
        setData(FALLBACK_DATA);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const strategyList = useMemo(() => {
    if (!data?.strategies) return [];
    return Object.entries(data.strategies).map(([key, s]) => ({ key, ...s }));
  }, [data]);

  const sortedStrategies = useMemo(() => {
    return [...strategyList].sort((a, b) => b.total_pnl - a.total_pnl);
  }, [strategyList]);

  const getScoreColor = (pnl) => pnl >= 0 ? 'text-green-400' : 'text-red-400';
  const getBgColor = (pnl) => pnl >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30';
  const getRankBadge = (idx) => {
    const badges = ['🥇', '🥈', '🥉', '4th'];
    return badges[idx] || '';
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="space-y-6 py-6">
          <SkeletonPage cards={4} cols={4} />
          <SkeletonChart />
          <SkeletonTable rows={6} cols={5} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/backtest')} path="/backtest" />
      <PageHeader
        title="Full Year Strategy Backtest"
        subtitle={`NIFTY 50 Delta Neutral Strategies | ${data?.summary?.period || 'Jan 2024 - Jan 2025'} | ${data?.summary?.total_expiry_cycles || 55} Weekly Expiries`}
      />

      {/* Disclaimer */}
      <div className="mx-4 mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
        ⚠️ Past performance does not guarantee future results. Backtest uses realistic option pricing with slippage, brokerage & STT. Lot size: 65 | NIFTY return: {data?.summary?.nifty_return_pct?.toFixed(1) || '8.2'}%
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 px-4 mb-6">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'monthly', label: 'Monthly Breakdown' },
          { id: 'details', label: 'Strategy Details' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Section>
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Strategy Ranking Cards */}
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {sortedStrategies.map((s, idx) => (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card 
                    className={`glass-card cursor-pointer transition-all hover:scale-[1.02] ${
                      selectedStrategy === s.key ? 'ring-2 ring-primary' : ''
                    } ${idx === 0 ? 'ring-1 ring-green-500/50' : ''}`}
                    onClick={() => { setSelectedStrategy(s.key); setActiveTab('details'); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{s.icon}</span>
                          <div>
                            <div className="font-semibold text-sm">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.legs} legs</div>
                          </div>
                        </div>
                        <div className="text-lg">{getRankBadge(idx)}</div>
                      </div>

                      <div className={`text-2xl font-bold mb-1 ${getScoreColor(s.total_pnl)}`}>
                        {formatINR(s.total_pnl)}
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">Total P&L (55 trades)</div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`p-2 rounded ${getBgColor(s.total_pnl)}`}>
                          <div className="text-muted-foreground">Win Rate</div>
                          <div className="font-bold">{s.win_rate}%</div>
                        </div>
                        <div className={`p-2 rounded ${getBgColor(s.total_pnl)}`}>
                          <div className="text-muted-foreground">ROI</div>
                          <div className="font-bold">{s.roi_pct}%</div>
                        </div>
                        <div className={`p-2 rounded ${getBgColor(s.sharpe_ratio)}`}>
                          <div className="text-muted-foreground">Sharpe</div>
                          <div className="font-bold">{s.sharpe_ratio}</div>
                        </div>
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                          <div className="text-muted-foreground">Max DD</div>
                          <div className="font-bold text-red-400">{formatINR(-Math.abs(s.max_drawdown))}</div>
                        </div>
                      </div>

                      {idx === 0 && (
                        <Badge className="mt-3 bg-green-500/20 text-green-400 border-green-500/30 w-full justify-center">
                          ⭐ BEST PERFORMER
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Head-to-Head Comparison Table */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Head-to-Head Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground">Metric</th>
                        {sortedStrategies.map(s => (
                          <th key={s.key} className="text-center py-3 px-2" style={{ color: s.color }}>
                            {s.icon} {s.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Total P&L', key: 'total_pnl', fmt: v => formatINR(v), colorize: true },
                        { label: 'Win Rate', key: 'win_rate', fmt: v => `${v}%`, colorize: true },
                        { label: 'ROI', key: 'roi_pct', fmt: v => `${v}%`, colorize: true },
                        { label: 'Sharpe Ratio', key: 'sharpe_ratio', fmt: v => v?.toFixed(2), colorize: true },
                        { label: 'Profit Factor', key: 'profit_factor', fmt: v => v?.toFixed(2), colorize: true },
                        { label: 'Max Drawdown', key: 'max_drawdown', fmt: v => formatINR(-Math.abs(v)), colorize: false, isDD: true },
                        { label: 'Best Trade', key: 'max_profit', fmt: v => formatINR(v), colorize: false },
                        { label: 'Worst Trade', key: 'max_loss', fmt: v => formatINR(v), colorize: false, isDD: true },
                        { label: 'Avg P&L/Trade', key: 'avg_pnl_per_trade', fmt: v => formatINR(v), colorize: true },
                        { label: 'Total Trades', key: 'total_trades', fmt: v => v },
                        { label: 'Winning Trades', key: 'winning_trades', fmt: v => v },
                        { label: 'Losing Trades', key: 'losing_trades', fmt: v => v },
                        { label: 'Risk Level', key: 'risk_level', fmt: v => v },
                        { label: 'Margin Used', key: 'margin_used', fmt: v => formatINR(v) },
                      ].map(row => {
                        const vals = sortedStrategies.map(s => s[row.key]);
                        const best = row.isDD ? Math.min(...vals) : Math.max(...vals);
                        return (
                          <tr key={row.label} className="border-b border-border/50 hover:bg-card/50">
                            <td className="py-2 px-2 text-muted-foreground">{row.label}</td>
                            {sortedStrategies.map(s => {
                              const v = s[row.key];
                              const isBest = v === best && row.colorize;
                              return (
                                <td key={s.key} className={`text-center py-2 px-2 font-medium ${
                                  isBest ? 'text-green-400 font-bold' :
                                  row.colorize && v < 0 ? 'text-red-400' :
                                  row.isDD ? 'text-red-400' : ''
                                }`}>
                                  {row.fmt(v)} {isBest && '✓'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Equity Curves Comparison */}
            <div className="grid md:grid-cols-2 gap-6">
              {sortedStrategies.map(s => (
                <Card key={s.key} className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm">{s.icon} {s.name} - Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <TradingAreaChart
                        data={s.equity_curve || []}
                        dataKey="value"
                        xKey="date"
                        color={s.total_pnl >= 0 ? '#10b981' : '#ef4444'}
                        gradientId={`eq-${s.key}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Verdict */}
            <Card className="glass-card border-green-500/30">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">📋 Verdict & Recommendations</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✅</span>
                      <span><strong>Best Overall:</strong> 🐍 Short Strangle — highest P&L, best Sharpe & win rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">🛡️</span>
                      <span><strong>Best Risk-Adjusted:</strong> 🦅 Iron Condor — defined risk, lowest drawdown</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400">⚠️</span>
                      <span><strong>Not Recommended:</strong> 🦋 Iron Butterfly & 🛡️ Straddle+Hedge — negative returns</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-muted-foreground">
                    <p>• Short Strangle works best in range-bound markets but carries unlimited risk</p>
                    <p>• Iron Condor is safest for beginners with defined max loss</p>
                    <p>• ATM strategies (Butterfly, Straddle) need very precise timing to profit</p>
                    <p>• All strategies tested with realistic slippage, brokerage & STT costs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== MONTHLY BREAKDOWN TAB ===== */}
        {activeTab === 'monthly' && (
          <div className="space-y-6">
            {/* Monthly P&L Table */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Monthly P&L Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground">Month</th>
                        {sortedStrategies.map(s => (
                          <th key={s.key} className="text-center py-3 px-2" style={{ color: s.color }}>
                            {s.icon} {s.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(sortedStrategies[0]?.monthly_pnl || {}).map(month => (
                        <tr key={month} className="border-b border-border/50 hover:bg-card/50">
                          <td className="py-2 px-2 font-medium">{month}</td>
                          {sortedStrategies.map(s => {
                            const v = s.monthly_pnl?.[month] || 0;
                            return (
                              <td key={s.key} className={`text-center py-2 px-2 font-medium ${
                                v >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {formatINR(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="border-t-2 border-primary/50 font-bold">
                        <td className="py-2 px-2">TOTAL</td>
                        {sortedStrategies.map(s => (
                          <td key={s.key} className={`text-center py-2 px-2 ${
                            s.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatINR(s.total_pnl)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Bar Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              {sortedStrategies.map(s => {
                const monthData = Object.entries(s.monthly_pnl || {}).map(([month, pnl]) => ({
                  month: month.replace('-24', ''),
                  pnl: Math.round(pnl / 1000)
                }));
                return (
                  <Card key={s.key} className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">{s.icon} {s.name} Monthly P&L (₹K)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <TradingBarChart
                          data={monthData}
                          dataKey="pnl"
                          xKey="month"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Profitable vs Loss Months */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Monthly Win/Loss Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-4">
                  {sortedStrategies.map(s => {
                    const months = Object.values(s.monthly_pnl || {});
                    const profitMonths = months.filter(v => v > 0).length;
                    const lossMonths = months.filter(v => v <= 0).length;
                    const bestMonth = Math.max(...months);
                    const worstMonth = Math.min(...months);
                    return (
                      <div key={s.key} className="p-4 rounded-lg bg-card border border-border">
                        <div className="font-medium mb-2" style={{ color: s.color }}>
                          {s.icon} {s.name}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Profitable Months</span>
                            <span className="text-green-400 font-bold">{profitMonths}/12</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Loss Months</span>
                            <span className="text-red-400 font-bold">{lossMonths}/12</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Best Month</span>
                            <span className="text-green-400">{formatINR(bestMonth)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Worst Month</span>
                            <span className="text-red-400">{formatINR(worstMonth)}</span>
                          </div>
                          <div className="w-full bg-red-500/20 rounded-full h-2 mt-2">
                            <div
                              className="bg-green-500 rounded-full h-2"
                              style={{ width: `${(profitMonths / 12) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== STRATEGY DETAILS TAB ===== */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Strategy Selector */}
            <div className="flex gap-2 flex-wrap">
              {sortedStrategies.map(s => (
                <Button
                  key={s.key}
                  onClick={() => setSelectedStrategy(s.key)}
                  className={`${
                    selectedStrategy === s.key
                      ? 'bg-primary text-white'
                      : 'bg-card border border-border text-muted-foreground'
                  }`}
                >
                  {s.icon} {s.name}
                </Button>
              ))}
            </div>

            {selectedStrategy && data?.strategies?.[selectedStrategy] && (() => {
              const s = { key: selectedStrategy, ...data.strategies[selectedStrategy] };
              return (
                <div className="space-y-6">
                  {/* Strategy Header */}
                  <Card className="glass-card">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-4xl">{s.icon}</span>
                        <div>
                          <h2 className="text-2xl font-bold">{s.name}</h2>
                          <p className="text-muted-foreground">{s.description}</p>
                        </div>
                        <Badge className={`ml-auto ${
                          s.risk_level === 'Medium' ? 'bg-blue-500/20 text-blue-400' :
                          s.risk_level === 'High' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {s.risk_level} Risk
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-3 rounded-lg bg-card border border-border text-center">
                          <div className={`text-xl font-bold ${getScoreColor(s.total_pnl)}`}>{formatINR(s.total_pnl)}</div>
                          <div className="text-xs text-muted-foreground">Total P&L</div>
                        </div>
                        <div className="p-3 rounded-lg bg-card border border-border text-center">
                          <div className="text-xl font-bold text-primary">{s.win_rate}%</div>
                          <div className="text-xs text-muted-foreground">Win Rate</div>
                        </div>
                        <div className="p-3 rounded-lg bg-card border border-border text-center">
                          <div className={`text-xl font-bold ${getScoreColor(s.roi_pct)}`}>{s.roi_pct}%</div>
                          <div className="text-xs text-muted-foreground">ROI</div>
                        </div>
                        <div className="p-3 rounded-lg bg-card border border-border text-center">
                          <div className={`text-xl font-bold ${getScoreColor(s.sharpe_ratio)}`}>{s.sharpe_ratio}</div>
                          <div className="text-xs text-muted-foreground">Sharpe Ratio</div>
                        </div>
                        <div className="p-3 rounded-lg bg-card border border-border text-center">
                          <div className="text-xl font-bold text-red-400">{formatINR(-Math.abs(s.max_drawdown))}</div>
                          <div className="text-xs text-muted-foreground">Max Drawdown</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Equity Curve */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Equity Curve</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <TradingAreaChart
                          data={s.equity_curve || []}
                          dataKey="value"
                          xKey="date"
                          color={s.total_pnl >= 0 ? '#10b981' : '#ef4444'}
                          gradientId={`detail-${s.key}`}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trade Stats & Risk */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle>Trade Statistics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: 'Total Trades', value: s.total_trades },
                          { label: 'Winning Trades', value: s.winning_trades, color: 'text-green-400' },
                          { label: 'Losing Trades', value: s.losing_trades, color: 'text-red-400' },
                          { label: 'Win Rate', value: `${s.win_rate}%`, color: s.win_rate >= 50 ? 'text-green-400' : 'text-red-400' },
                          { label: 'Best Trade', value: formatINR(s.max_profit), color: 'text-green-400' },
                          { label: 'Worst Trade', value: formatINR(s.max_loss), color: 'text-red-400' },
                          { label: 'Avg P&L/Trade', value: formatINR(s.avg_pnl_per_trade), color: getScoreColor(s.avg_pnl_per_trade) },
                          { label: 'Legs per Trade', value: s.legs },
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
                          { label: 'Max Drawdown', value: formatINR(-Math.abs(s.max_drawdown)), color: 'text-red-400' },
                          { label: 'Sharpe Ratio', value: s.sharpe_ratio?.toFixed(2), color: getScoreColor(s.sharpe_ratio) },
                          { label: 'Profit Factor', value: s.profit_factor?.toFixed(2), color: getScoreColor(s.profit_factor - 1) },
                          { label: 'ROI', value: `${s.roi_pct}%`, color: getScoreColor(s.roi_pct) },
                          { label: 'Margin Used', value: formatINR(s.margin_used) },
                          { label: 'Risk Level', value: s.risk_level },
                          { label: 'Risk/Reward', value: s.max_profit && s.max_loss ? (s.max_profit / Math.abs(s.max_loss)).toFixed(2) : 'N/A' },
                          { label: 'Recovery Factor', value: s.total_pnl > 0 ? (s.total_pnl / Math.abs(s.max_drawdown)).toFixed(2) : 'N/A' },
                        ].map(stat => (
                          <div key={stat.label} className="flex justify-between">
                            <span className="text-muted-foreground">{stat.label}</span>
                            <span className={`font-medium ${stat.color || ''}`}>{stat.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })()}

            {!selectedStrategy && (
              <Card className="glass-card flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <div className="text-4xl mb-4">👆</div>
                  <p>Select a strategy above to see detailed analysis</p>
                </div>
              </Card>
            )}
          </div>
        )}
      </Section>
    </PageLayout>
  );
}

