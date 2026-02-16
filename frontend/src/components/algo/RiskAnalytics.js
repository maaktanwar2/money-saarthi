/**
 * Risk Analytics Panel for Algo Trading Page
 * Shows Greeks exposure, risk metrics, and open positions
 */
import React, { useMemo, useState } from 'react';
import { Shield, Activity, BarChart3, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Tabs } from '../ui';
import { cn, formatINR } from '../../lib/utils';

// ─── Greeks Display ──────────────────────────────────────────────────────────

const GreekGauge = ({ label, value, safeRange, unit = '' }) => {
  const absVal = Math.abs(value);
  const max = safeRange * 2;
  const pct = Math.min((absVal / max) * 100, 100);
  const isBreached = absVal > safeRange;

  return (
    <div className="flex-1 min-w-[120px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn(
          "text-sm font-mono font-bold",
          isBreached ? "text-red-500" : "text-green-500"
        )}>
          {value >= 0 ? '+' : ''}{typeof value === 'number' ? value.toFixed(2) : value}{unit}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isBreached ? "bg-red-500" : "bg-green-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-muted-foreground">0</span>
        <span className="text-[10px] text-muted-foreground">Safe: ±{safeRange}</span>
      </div>
    </div>
  );
};

const GreeksTab = ({ greeks }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
    <GreekGauge label="Delta (Δ)" value={greeks.delta} safeRange={0.3} />
    <GreekGauge label="Gamma (Γ)" value={greeks.gamma} safeRange={0.05} />
    <GreekGauge label="Theta (Θ)" value={greeks.theta} safeRange={2000} unit="₹" />
    <GreekGauge label="Vega (ν)" value={greeks.vega} safeRange={500} unit="₹" />
  </div>
);

// ─── Risk Metrics Display ────────────────────────────────────────────────────

const MetricCard = ({ label, value, suffix = '', good, className }) => (
  <div className={cn("rounded-xl bg-muted/30 p-3", className)}>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={cn(
      "text-lg font-bold",
      good === true && "text-green-500",
      good === false && "text-red-500"
    )}>
      {value}{suffix}
    </p>
  </div>
);

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
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm mt-4">
        No trade data available yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
      <MetricCard label="Win Rate" value={metrics.winRate.toFixed(1)} suffix="%" good={metrics.winRate > 50} />
      <MetricCard label="Avg Win" value={formatINR(metrics.avgWin)} good={true} />
      <MetricCard label="Avg Loss" value={formatINR(metrics.avgLoss)} good={false} />
      <MetricCard label="Profit Factor" value={metrics.profitFactor.toFixed(2)} good={metrics.profitFactor > 1} />
      <MetricCard label="Max Drawdown" value={formatINR(metrics.maxDrawdown)} good={false} />
      <MetricCard label="Sharpe Ratio" value={metrics.sharpe.toFixed(2)} good={metrics.sharpe > 1} />
    </div>
  );
};

// ─── Positions Table ─────────────────────────────────────────────────────────

const PositionsTab = ({ botStates }) => {
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
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm mt-4">
        No open positions
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-xs text-muted-foreground font-medium">Bot</th>
            <th className="text-left p-2 text-xs text-muted-foreground font-medium">Symbol</th>
            <th className="text-left p-2 text-xs text-muted-foreground font-medium">Type</th>
            <th className="text-right p-2 text-xs text-muted-foreground font-medium">Qty</th>
            <th className="text-right p-2 text-xs text-muted-foreground font-medium">Avg Price</th>
            <th className="text-right p-2 text-xs text-muted-foreground font-medium">LTP</th>
            <th className="text-right p-2 text-xs text-muted-foreground font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => {
            const pnl = pos.pnl || ((pos.ltp || 0) - (pos.avg_price || 0)) * (pos.qty || 0);
            return (
              <tr key={i} className={cn(
                "border-b border-border/50 hover:bg-muted/30 transition-colors",
                pnl >= 0 ? "bg-green-500/5" : "bg-red-500/5"
              )}>
                <td className="p-2 font-medium">{pos.bot}</td>
                <td className="p-2">{pos.symbol || pos.tradingsymbol || 'N/A'}</td>
                <td className="p-2">
                  <Badge variant="outline" className="text-xs">
                    {pos.type || pos.transaction_type || 'N/A'}
                  </Badge>
                </td>
                <td className="p-2 text-right font-mono">{pos.qty || pos.quantity || 0}</td>
                <td className="p-2 text-right font-mono">{formatINR(pos.avg_price || pos.entry_price || 0)}</td>
                <td className="p-2 text-right font-mono">{formatINR(pos.ltp || pos.current_price || 0)}</td>
                <td className={cn(
                  "p-2 text-right font-mono font-medium",
                  pnl >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const RiskAnalytics = ({ botStates = {}, tradeHistory = [], className }) => {
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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-primary" />
          Risk Analytics
          {greeks.delta !== 0 && Math.abs(greeks.delta) > 0.3 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Delta Breach
            </Badge>
          )}
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
