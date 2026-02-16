/**
 * P&L Equity Curve Chart for Algo Trading Page
 * Shows real-time P&L performance across all bots
 */
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { formatINR } from '../../lib/utils';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatINR(entry.value)}
        </p>
      ))}
    </div>
  );
};

const PnLChart = ({ data = [], className }) => {
  // If no data, show empty state
  if (!data.length) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-primary" />
            P&L Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No P&L data yet</p>
              <p className="text-xs mt-1">Start a bot to see performance chart</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-5 h-5 text-primary" />
          P&L Performance
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {data.length} data points
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vwapGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="strangleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="deltaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 4%, 16%)" />
              <XAxis 
                dataKey="time" 
                stroke="hsl(240, 5%, 65%)" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(240, 5%, 65%)" 
                fontSize={11}
                tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {data[0]?.vwap !== undefined && (
                <Area 
                  type="monotone" 
                  dataKey="vwap" 
                  name="VWAP Bot"
                  stroke="#3B82F6" 
                  fill="url(#vwapGradient)" 
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              {data[0]?.strangle !== undefined && (
                <Area 
                  type="monotone" 
                  dataKey="strangle" 
                  name="Strangle Bot"
                  stroke="#A855F7" 
                  fill="url(#strangleGradient)" 
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              {data[0]?.delta !== undefined && (
                <Area 
                  type="monotone" 
                  dataKey="delta" 
                  name="Delta Bot"
                  stroke="#10B981" 
                  fill="url(#deltaGradient)" 
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              <Area 
                type="monotone" 
                dataKey="pnl" 
                name="Total P&L"
                stroke="hsl(160, 84%, 39%)" 
                fill="url(#pnlGradient)" 
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(PnLChart);
