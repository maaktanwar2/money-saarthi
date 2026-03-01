/**
 * Risk Analytics Panel for Algo Trading Page
 * Shows Greeks exposure, risk metrics, and open positions
 */
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import { alpha, useTheme } from '@mui/material/styles';
import { Shield, Activity, BarChart3, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Tabs } from '../ui';
import { formatINR } from '../../lib/utils';

// ─── Greeks Display ──────────────────────────────────────────────────────────

const GreekGauge = ({ label, value, safeRange, unit = '' }) => {
  const theme = useTheme();
  const absVal = Math.abs(value);
  const max = safeRange * 2;
  const pct = Math.min((absVal / max) * 100, 100);
  const isBreached = absVal > safeRange;

  return (
    <Box sx={{ flex: 1, minWidth: 120 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: isBreached ? 'error.main' : 'success.main',
          }}
        >
          {value >= 0 ? '+' : ''}{typeof value === 'number' ? value.toFixed(2) : value}{unit}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: (t) => alpha(t.palette.action.hover, 0.12),
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            bgcolor: isBreached ? 'error.main' : 'success.main',
            transition: 'all 0.5s',
          },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>0</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
          Safe: {'\u00B1'}{safeRange}
        </Typography>
      </Box>
    </Box>
  );
};

const GreeksTab = ({ greeks }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
      gap: 2,
      mt: 2,
    }}
  >
    <GreekGauge label="Delta (\u0394)" value={greeks.delta} safeRange={0.3} />
    <GreekGauge label="Gamma (\u0393)" value={greeks.gamma} safeRange={0.05} />
    <GreekGauge label="Theta (\u0398)" value={greeks.theta} safeRange={2000} unit="\u20B9" />
    <GreekGauge label="Vega (\u03BD)" value={greeks.vega} safeRange={500} unit="\u20B9" />
  </Box>
);

// ─── Risk Metrics Display ────────────────────────────────────────────────────

const MetricCard = ({ label, value, suffix = '', good }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: (t) => alpha(t.palette.action.hover, 0.06),
        p: 1.5,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{
          ...(good === true && { color: 'success.main' }),
          ...(good === false && { color: 'error.main' }),
        }}
      >
        {value}{suffix}
      </Typography>
    </Box>
  );
};

const RiskMetricsTab = ({ tradeHistory = [] }) => {
  const metrics = useMemo(() => {
    if (!tradeHistory.length) return null;

    const wins = tradeHistory.filter(t => (t.pnl || 0) > 0);
    const losses = tradeHistory.filter(t => (t.pnl || 0) < 0);
    const winRate = (wins.length / tradeHistory.length * 100);
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;

    // Calculate max drawdown
    let peak = 0, maxDrawdown = 0, cumPnl = 0;
    tradeHistory.forEach(t => {
      cumPnl += (t.pnl || 0);
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak - cumPnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });

    // Sharpe-like ratio (simplified)
    const returns = tradeHistory.map(t => t.pnl || 0);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length);
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

    return { winRate, avgWin, avgLoss, profitFactor, maxDrawdown, sharpe, totalTrades: tradeHistory.length };
  }, [tradeHistory]);

  if (!metrics) {
    return (
      <Box sx={{ height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">No trade data available yet</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
        gap: 1.5,
        mt: 2,
      }}
    >
      <MetricCard label="Win Rate" value={metrics.winRate.toFixed(1)} suffix="%" good={metrics.winRate > 50} />
      <MetricCard label="Avg Win" value={formatINR(metrics.avgWin)} good={true} />
      <MetricCard label="Avg Loss" value={formatINR(metrics.avgLoss)} good={false} />
      <MetricCard label="Profit Factor" value={metrics.profitFactor.toFixed(2)} good={metrics.profitFactor > 1} />
      <MetricCard label="Max Drawdown" value={formatINR(metrics.maxDrawdown)} good={false} />
      <MetricCard label="Sharpe Ratio" value={metrics.sharpe.toFixed(2)} good={metrics.sharpe > 1} />
    </Box>
  );
};

// ─── Positions Table ─────────────────────────────────────────────────────────

const PositionsTab = ({ botStates }) => {
  const theme = useTheme();

  const positions = useMemo(() => {
    const all = [];
    const bots = [
      { name: 'VWAP', state: botStates.vwap },
      { name: 'Strangle', state: botStates.strangle },
      { name: 'Delta', state: botStates.delta },
    ];

    bots.forEach(({ name, state }) => {
      if (state?.status?.positions) {
        state.status.positions.forEach(pos => {
          all.push({ bot: name, ...pos });
        });
      }
    });
    return all;
  }, [botStates]);

  if (!positions.length) {
    return (
      <Box sx={{ height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">No open positions</Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Bot</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Symbol</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Type</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Qty</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Avg Price</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>LTP</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>P&L</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map((pos, i) => {
            const pnl = pos.pnl || ((pos.ltp || 0) - (pos.avg_price || 0)) * (pos.qty || 0);
            return (
              <TableRow
                key={i}
                hover
                sx={{
                  bgcolor: (t) => alpha(pnl >= 0 ? t.palette.success.main : t.palette.error.main, 0.04),
                  transition: 'background-color 0.2s',
                }}
              >
                <TableCell sx={{ fontWeight: 500 }}>{pos.bot}</TableCell>
                <TableCell>{pos.symbol || pos.tradingsymbol || 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant="outline">{pos.type || pos.transaction_type || 'N/A'}</Badge>
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{pos.qty || pos.quantity || 0}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{formatINR(pos.avg_price || pos.entry_price || 0)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{formatINR(pos.ltp || pos.current_price || 0)}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    color: pnl >= 0 ? 'success.main' : 'error.main',
                  }}
                >
                  {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const RiskAnalytics = ({ botStates = {}, tradeHistory = [], className }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('greeks');

  // Aggregate greeks from all bots
  const greeks = useMemo(() => {
    const defaults = { delta: 0, gamma: 0, theta: 0, vega: 0 };
    const bots = [botStates.vwap, botStates.strangle, botStates.delta];

    bots.forEach(bot => {
      if (bot?.status?.greeks) {
        defaults.delta += bot.status.greeks.delta || 0;
        defaults.gamma += bot.status.greeks.gamma || 0;
        defaults.theta += bot.status.greeks.theta || 0;
        defaults.vega += bot.status.greeks.vega || 0;
      }
    });
    return defaults;
  }, [botStates]);

  const tabs = [
    { id: 'greeks', label: 'Greeks', icon: Activity },
    { id: 'metrics', label: 'Risk Metrics', icon: BarChart3 },
    { id: 'positions', label: 'Positions', icon: Shield },
  ];

  return (
    <Card className={className}>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <Shield style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            Risk Analytics
            {greeks.delta !== 0 && Math.abs(greeks.delta) > 0.3 && (
              <Badge variant="destructive" sx={{ ml: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AlertTriangle style={{ width: 12, height: 12 }} />
                  Delta Breach
                </Box>
              </Badge>
            )}
          </Box>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'greeks' && <GreeksTab greeks={greeks} />}
        {activeTab === 'metrics' && <RiskMetricsTab tradeHistory={tradeHistory} />}
        {activeTab === 'positions' && <PositionsTab botStates={botStates} />}
      </CardContent>
    </Card>
  );
};

export default React.memo(RiskAnalytics);
