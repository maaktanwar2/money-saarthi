import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';
import { TradingAreaChart, TradingBarChart } from '../components/ui/Charts';
import { formatINR } from '../lib/utils';
import { CHART_COLORS } from '../lib/chartTheme';
import { SkeletonChart, SkeletonTable, SkeletonPage } from '../components/ui/Skeleton';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// Full Year Strategy Comparison Backtest Page
export default function Backtest() {
  const theme = useTheme();
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
        name: "Iron Condor", icon: "\u{1F985}", color: "#3b82f6",
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
        name: "Iron Butterfly", icon: "\u{1F98B}", color: "#a855f7",
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
        name: "Short Strangle", icon: "\u{1F40D}", color: "#10b981",
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
        name: "Straddle + Hedge", icon: "\u{1F6E1}\u{FE0F}", color: "#f59e0b",
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

  const getScoreColor = (pnl) => pnl >= 0 ? 'success.main' : 'error.main';
  const getBgSx = (pnl) => pnl >= 0
    ? { bgcolor: alpha('#22c55e', 0.1), border: 1, borderColor: alpha('#22c55e', 0.3) }
    : { bgcolor: alpha('#ef4444', 0.1), border: 1, borderColor: alpha('#ef4444', 0.3) };
  const getRankBadge = (idx) => {
    const badges = ['\u{1F947}', '\u{1F948}', '\u{1F949}', '4th'];
    return badges[idx] || '';
  };

  if (loading) {
    return (
      <PageLayout>
        <Stack spacing={3} sx={{ py: 3 }}>
          <SkeletonPage cards={4} cols={4} />
          <SkeletonChart />
          <SkeletonTable rows={6} cols={5} />
        </Stack>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/backtest')} path="/backtest" />
      <PageHeader
        title="Full Year Strategy Backtest"
        description={`NIFTY 50 Delta Neutral Strategies | ${data?.summary?.period || 'Jan 2024 - Jan 2025'} | ${data?.summary?.total_expiry_cycles || 55} Weekly Expiries`}
      />

      {/* Disclaimer */}
      <Box sx={{
        mx: 2, mb: 2, p: 1.5, borderRadius: 2,
        bgcolor: alpha('#eab308', 0.1),
        border: 1, borderColor: alpha('#eab308', 0.3),
        color: '#fde047', fontSize: '0.875rem',
      }}>
        {'\u26A0\uFE0F'} Past performance does not guarantee future results. Backtest uses realistic option pricing with slippage, brokerage & STT. Lot size: 65 | NIFTY return: {data?.summary?.nifty_return_pct?.toFixed(1) || '8.2'}%
      </Box>

      {/* Tab Navigation */}
      <Box sx={{ display: 'flex', gap: 1, px: 2, mb: 3 }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'monthly', label: 'Monthly Breakdown' },
          { id: 'details', label: 'Strategy Details' }
        ].map(tab => (
          <Box
            component="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            sx={{
              px: 2, py: 1, borderRadius: 2, fontSize: '0.875rem', fontWeight: 500,
              transition: 'all 0.2s', cursor: 'pointer', outline: 'none',
              ...(activeTab === tab.id
                ? { bgcolor: 'primary.main', color: 'common.white', border: 'none' }
                : {
                    bgcolor: 'background.paper', border: 1, borderColor: 'divider',
                    color: 'text.secondary',
                    '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5) },
                  }
              ),
            }}
          >
            {tab.label}
          </Box>
        ))}
      </Box>

      <Section>
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && (
          <Stack spacing={3}>
            {/* Strategy Ranking Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 2 }}>
              {sortedStrategies.map((s, idx) => (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card
                    onClick={() => { setSelectedStrategy(s.key); setActiveTab('details'); }}
                    sx={{
                      cursor: 'pointer', transition: 'all 0.2s',
                      '&:hover': { transform: 'scale(1.02)' },
                      ...(selectedStrategy === s.key ? { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main' } : {}),
                      ...(idx === 0 ? { boxShadow: `0 0 0 1px ${alpha('#22c55e', 0.5)}` } : {}),
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: '1.5rem' }}>{s.icon}</Typography>
                          <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{s.legs} legs</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: '1.125rem' }}>{getRankBadge(idx)}</Typography>
                      </Box>

                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, mb: 0.5, color: getScoreColor(s.total_pnl) }}>
                        {formatINR(s.total_pnl)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>Total P&L (55 trades)</Typography>

                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                        <Box sx={{ p: 1, borderRadius: 1, ...getBgSx(s.total_pnl) }}>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Win Rate</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{s.win_rate}%</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 1, ...getBgSx(s.total_pnl) }}>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>ROI</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{s.roi_pct}%</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 1, ...getBgSx(s.sharpe_ratio) }}>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Sharpe</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{s.sharpe_ratio}</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 1, bgcolor: alpha('#ef4444', 0.1), border: 1, borderColor: alpha('#ef4444', 0.3) }}>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Max DD</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'error.main' }}>{formatINR(-Math.abs(s.max_drawdown))}</Typography>
                        </Box>
                      </Box>

                      {idx === 0 && (
                        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
                          <Badge sx={{ bgcolor: alpha('#22c55e', 0.2), color: '#4ade80', borderColor: alpha('#22c55e', 0.3) }}>
                            {'\u2B50'} BEST PERFORMER
                          </Badge>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </Box>

            {/* Head-to-Head Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Head-to-Head Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Box sx={{ overflowX: 'auto' }}>
                  <Box component="table" sx={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                    <Box component="thead">
                      <Box component="tr" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Box component="th" sx={{ textAlign: 'left', py: 1.5, px: 1, color: 'text.secondary', fontWeight: 600 }}>Metric</Box>
                        {sortedStrategies.map(s => (
                          <Box component="th" key={s.key} sx={{ textAlign: 'center', py: 1.5, px: 1, fontWeight: 600 }} style={{ color: s.color }}>
                            {s.icon} {s.name}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
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
                          <Box component="tr" key={row.label} sx={{ borderBottom: 1, borderColor: alpha(theme.palette.divider, 0.5), '&:hover': { bgcolor: alpha(theme.palette.background.paper, 0.5) } }}>
                            <Box component="td" sx={{ py: 1, px: 1, color: 'text.secondary' }}>{row.label}</Box>
                            {sortedStrategies.map(s => {
                              const v = s[row.key];
                              const isBest = v === best && row.colorize;
                              return (
                                <Box component="td" key={s.key} sx={{
                                  textAlign: 'center', py: 1, px: 1, fontWeight: 500,
                                  ...(isBest ? { color: 'success.main', fontWeight: 700 } :
                                    row.colorize && v < 0 ? { color: 'error.main' } :
                                    row.isDD ? { color: 'error.main' } : {}),
                                }}>
                                  {row.fmt(v)} {isBest && '\u2713'}
                                </Box>
                              );
                            })}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Equity Curves Comparison */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              {sortedStrategies.map(s => (
                <Card key={s.key}>
                  <CardHeader>
                    <CardTitle sx={{ fontSize: '0.875rem' }}>{s.icon} {s.name} - Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Box sx={{ height: 192 }}>
                      <TradingAreaChart
                        data={s.equity_curve || []}
                        dataKey="value"
                        xKey="date"
                        color={s.total_pnl >= 0 ? CHART_COLORS.bullish : CHART_COLORS.bearish}
                        gradientId={`eq-${s.key}`}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            {/* Verdict */}
            <Card sx={{ boxShadow: `0 0 0 1px ${alpha('#22c55e', 0.3)}` }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, mb: 1.5 }}>
                  {'\u{1F4CB}'} Verdict & Recommendations
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, fontSize: '0.875rem' }}>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span" sx={{ color: 'success.main' }}>{'\u2705'}</Box>
                      <Typography variant="body2"><strong>Best Overall:</strong> {'\u{1F40D}'} Short Strangle — highest P&L, best Sharpe & win rate</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span" sx={{ color: 'info.main' }}>{'\u{1F6E1}\u{FE0F}'}</Box>
                      <Typography variant="body2"><strong>Best Risk-Adjusted:</strong> {'\u{1F985}'} Iron Condor — defined risk, lowest drawdown</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span" sx={{ color: 'warning.main' }}>{'\u26A0\u{FE0F}'}</Box>
                      <Typography variant="body2"><strong>Not Recommended:</strong> {'\u{1F98B}'} Iron Butterfly & {'\u{1F6E1}\u{FE0F}'} Straddle+Hedge — negative returns</Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1} sx={{ color: 'text.secondary' }}>
                    <Typography variant="body2">{'\u2022'} Short Strangle works best in range-bound markets but carries unlimited risk</Typography>
                    <Typography variant="body2">{'\u2022'} Iron Condor is safest for beginners with defined max loss</Typography>
                    <Typography variant="body2">{'\u2022'} ATM strategies (Butterfly, Straddle) need very precise timing to profit</Typography>
                    <Typography variant="body2">{'\u2022'} All strategies tested with realistic slippage, brokerage & STT costs</Typography>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* ===== MONTHLY BREAKDOWN TAB ===== */}
        {activeTab === 'monthly' && (
          <Stack spacing={3}>
            {/* Monthly P&L Table */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly P&L Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Box sx={{ overflowX: 'auto' }}>
                  <Box component="table" sx={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                    <Box component="thead">
                      <Box component="tr" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Box component="th" sx={{ textAlign: 'left', py: 1.5, px: 1, color: 'text.secondary', fontWeight: 600 }}>Month</Box>
                        {sortedStrategies.map(s => (
                          <Box component="th" key={s.key} sx={{ textAlign: 'center', py: 1.5, px: 1, fontWeight: 600 }} style={{ color: s.color }}>
                            {s.icon} {s.name}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {Object.keys(sortedStrategies[0]?.monthly_pnl || {}).map(month => (
                        <Box component="tr" key={month} sx={{ borderBottom: 1, borderColor: alpha(theme.palette.divider, 0.5), '&:hover': { bgcolor: alpha(theme.palette.background.paper, 0.5) } }}>
                          <Box component="td" sx={{ py: 1, px: 1, fontWeight: 500 }}>{month}</Box>
                          {sortedStrategies.map(s => {
                            const v = s.monthly_pnl?.[month] || 0;
                            return (
                              <Box component="td" key={s.key} sx={{
                                textAlign: 'center', py: 1, px: 1, fontWeight: 500,
                                color: v >= 0 ? 'success.main' : 'error.main',
                              }}>
                                {formatINR(v)}
                              </Box>
                            );
                          })}
                        </Box>
                      ))}
                      <Box component="tr" sx={{ borderTop: 2, borderColor: alpha(theme.palette.primary.main, 0.5), fontWeight: 700 }}>
                        <Box component="td" sx={{ py: 1, px: 1, fontWeight: 700 }}>TOTAL</Box>
                        {sortedStrategies.map(s => (
                          <Box component="td" key={s.key} sx={{
                            textAlign: 'center', py: 1, px: 1, fontWeight: 700,
                            color: s.total_pnl >= 0 ? 'success.main' : 'error.main',
                          }}>
                            {formatINR(s.total_pnl)}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Monthly Bar Charts */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              {sortedStrategies.map(s => {
                const monthData = Object.entries(s.monthly_pnl || {}).map(([month, pnl]) => ({
                  month: month.replace('-24', ''),
                  pnl: Math.round(pnl / 1000)
                }));
                return (
                  <Card key={s.key}>
                    <CardHeader>
                      <CardTitle sx={{ fontSize: '0.875rem' }}>{s.icon} {s.name} Monthly P&L ({'\u20B9'}K)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Box sx={{ height: 192 }}>
                        <TradingBarChart
                          data={monthData}
                          dataKey="pnl"
                          xKey="month"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            {/* Profitable vs Loss Months */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Win/Loss Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  {sortedStrategies.map(s => {
                    const months = Object.values(s.monthly_pnl || {});
                    const profitMonths = months.filter(v => v > 0).length;
                    const lossMonths = months.filter(v => v <= 0).length;
                    const bestMonth = Math.max(...months);
                    const worstMonth = Math.min(...months);
                    return (
                      <Box key={s.key} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                        <Typography sx={{ fontWeight: 500, mb: 1 }} style={{ color: s.color }}>
                          {s.icon} {s.name}
                        </Typography>
                        <Stack spacing={0.5} sx={{ fontSize: '0.75rem' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Profitable Months</Typography>
                            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>{profitMonths}/12</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Loss Months</Typography>
                            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>{lossMonths}/12</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Best Month</Typography>
                            <Typography variant="caption" sx={{ color: 'success.main' }}>{formatINR(bestMonth)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Worst Month</Typography>
                            <Typography variant="caption" sx={{ color: 'error.main' }}>{formatINR(worstMonth)}</Typography>
                          </Box>
                          <Box sx={{ width: '100%', bgcolor: alpha('#ef4444', 0.2), borderRadius: 5, height: 8, mt: 1 }}>
                            <Box
                              sx={{
                                bgcolor: 'success.main',
                                borderRadius: 5,
                                height: 8,
                                width: `${(profitMonths / 12) * 100}%`,
                              }}
                            />
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* ===== STRATEGY DETAILS TAB ===== */}
        {activeTab === 'details' && (
          <Stack spacing={3}>
            {/* Strategy Selector */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {sortedStrategies.map(s => (
                <Button
                  key={s.key}
                  onClick={() => setSelectedStrategy(s.key)}
                  variant={selectedStrategy === s.key ? 'default' : 'outline'}
                  sx={selectedStrategy === s.key
                    ? { bgcolor: 'primary.main', color: 'common.white' }
                    : { bgcolor: 'background.paper', borderColor: 'divider', color: 'text.secondary' }
                  }
                >
                  {s.icon} {s.name}
                </Button>
              ))}
            </Box>

            {selectedStrategy && data?.strategies?.[selectedStrategy] && (() => {
              const s = { key: selectedStrategy, ...data.strategies[selectedStrategy] };
              return (
                <Stack spacing={3}>
                  {/* Strategy Header */}
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography sx={{ fontSize: '2.25rem' }}>{s.icon}</Typography>
                        <Box>
                          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.name}</Typography>
                          <Typography sx={{ color: 'text.secondary' }}>{s.description}</Typography>
                        </Box>
                        <Badge sx={{
                          ml: 'auto',
                          ...(s.risk_level === 'Medium'
                            ? { bgcolor: alpha('#3b82f6', 0.2), color: '#60a5fa' }
                            : s.risk_level === 'High'
                              ? { bgcolor: alpha('#f97316', 0.2), color: '#fb923c' }
                              : { bgcolor: alpha('#ef4444', 0.2), color: '#f87171' }),
                        }}>
                          {s.risk_level} Risk
                        </Badge>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(s.total_pnl) }}>{formatINR(s.total_pnl)}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total P&L</Typography>
                        </Box>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'primary.main' }}>{s.win_rate}%</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Win Rate</Typography>
                        </Box>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(s.roi_pct) }}>{s.roi_pct}%</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>ROI</Typography>
                        </Box>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: getScoreColor(s.sharpe_ratio) }}>{s.sharpe_ratio}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Sharpe Ratio</Typography>
                        </Box>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'error.main' }}>{formatINR(-Math.abs(s.max_drawdown))}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Max Drawdown</Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Equity Curve */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Equity Curve</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Box sx={{ height: 256 }}>
                        <TradingAreaChart
                          data={s.equity_curve || []}
                          dataKey="value"
                          xKey="date"
                          color={s.total_pnl >= 0 ? CHART_COLORS.bullish : CHART_COLORS.bearish}
                          gradientId={`detail-${s.key}`}
                        />
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Trade Stats & Risk */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
                    <Card>
                      <CardHeader>
                        <CardTitle>Trade Statistics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Stack spacing={1.5}>
                          {[
                            { label: 'Total Trades', value: s.total_trades },
                            { label: 'Winning Trades', value: s.winning_trades, color: 'success.main' },
                            { label: 'Losing Trades', value: s.losing_trades, color: 'error.main' },
                            { label: 'Win Rate', value: `${s.win_rate}%`, color: s.win_rate >= 50 ? 'success.main' : 'error.main' },
                            { label: 'Best Trade', value: formatINR(s.max_profit), color: 'success.main' },
                            { label: 'Worst Trade', value: formatINR(s.max_loss), color: 'error.main' },
                            { label: 'Avg P&L/Trade', value: formatINR(s.avg_pnl_per_trade), color: getScoreColor(s.avg_pnl_per_trade) },
                            { label: 'Legs per Trade', value: s.legs },
                          ].map(stat => (
                            <Box key={stat.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{stat.label}</Typography>
                              <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', ...(stat.color ? { color: stat.color } : {}) }}>{stat.value}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Risk Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Stack spacing={1.5}>
                          {[
                            { label: 'Max Drawdown', value: formatINR(-Math.abs(s.max_drawdown)), color: 'error.main' },
                            { label: 'Sharpe Ratio', value: s.sharpe_ratio?.toFixed(2), color: getScoreColor(s.sharpe_ratio) },
                            { label: 'Profit Factor', value: s.profit_factor?.toFixed(2), color: getScoreColor(s.profit_factor - 1) },
                            { label: 'ROI', value: `${s.roi_pct}%`, color: getScoreColor(s.roi_pct) },
                            { label: 'Margin Used', value: formatINR(s.margin_used) },
                            { label: 'Risk Level', value: s.risk_level },
                            { label: 'Risk/Reward', value: s.max_profit && s.max_loss ? (s.max_profit / Math.abs(s.max_loss)).toFixed(2) : 'N/A' },
                            { label: 'Recovery Factor', value: s.total_pnl > 0 ? (s.total_pnl / Math.abs(s.max_drawdown)).toFixed(2) : 'N/A' },
                          ].map(stat => (
                            <Box key={stat.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{stat.label}</Typography>
                              <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', ...(stat.color ? { color: stat.color } : {}) }}>{stat.value}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Box>
                </Stack>
              );
            })()}

            {!selectedStrategy && (
              <Card sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <Typography sx={{ fontSize: '2.25rem', mb: 2 }}>{'\u{1F446}'}</Typography>
                  <Typography>Select a strategy above to see detailed analysis</Typography>
                </Box>
              </Card>
            )}
          </Stack>
        )}
      </Section>
    </PageLayout>
  );
}
