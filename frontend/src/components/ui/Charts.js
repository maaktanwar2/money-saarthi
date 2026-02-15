// Chart Components v3.0 — Uses CSS variable system
import { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, ComposedChart
} from 'recharts';
import { cn, formatINR, formatNumber, formatPercent } from '../../lib/utils';

// Custom Tooltip — uses design tokens
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-surface-2 border border-border p-2.5 rounded-lg shadow-xl backdrop-blur-xl">
      <p className="text-2xs text-foreground-muted mb-1.5 font-medium">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5 text-xs">
          <span 
            className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
            style={{ backgroundColor: entry.color }} 
          />
          <span className="text-foreground-muted">{entry.name}:</span>
          <span className="font-semibold tabular-nums">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Color definitions — HSL-based
const CHART_COLORS = {
  primary: 'hsl(142, 71%, 45%)',
  secondary: 'hsl(172, 66%, 50%)',
  bullish: 'hsl(142, 71%, 45%)',
  bearish: 'hsl(0, 72%, 51%)',
  neutral: 'hsl(220, 9%, 46%)',
  warning: 'hsl(38, 92%, 50%)',
  info: 'hsl(217, 91%, 60%)',
  area: 'url(#primaryGradient)',
};

// Area Chart with gradient
export const TradingAreaChart = ({
  data = [],
  dataKey = 'value',
  xAxisKey = 'date',
  height = 300,
  showGrid = false,
  showAxis = true,
  color = 'primary',
  formatter,
  className,
}) => {
  const chartColor = CHART_COLORS[color] || color;
  
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 18%)" />
          )}
          
          {showAxis && (
            <>
              <XAxis 
                dataKey={xAxisKey}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
                tickFormatter={formatter}
              />
            </>
          )}
          
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={chartColor}
            strokeWidth={2}
            fill="url(#primaryGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Line Chart for multiple series
export const TradingLineChart = ({
  data = [],
  series = [], // [{ dataKey: 'value', name: 'Price', color: '#10b981' }]
  xAxisKey = 'date',
  height = 300,
  showGrid = true,
  showLegend = false,
  formatter,
  className,
}) => (
  <div className={cn('w-full', className)}>
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 18%)" />
        )}
        
        <XAxis 
          dataKey={xAxisKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
          tickFormatter={formatter}
        />
        
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        
        {showLegend && <Legend />}
        
        {series.map((s, i) => (
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name || s.dataKey}
            stroke={s.color || CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// Bar Chart
export const TradingBarChart = ({
  data = [],
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  colorByValue = false, // Color bars based on positive/negative
  formatter,
  className,
}) => (
  <div className={cn('w-full', className)}>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 18%)" />
        )}
        
        <XAxis 
          dataKey={xAxisKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
          tickFormatter={formatter}
        />
        
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        
        <Bar
          dataKey={dataKey}
          radius={[3, 3, 0, 0]}
          fill={CHART_COLORS.primary}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// Mini Sparkline for compact displays
export const Sparkline = ({
  data = [],
  dataKey = 'value',
  width = 100,
  height = 30,
  color,
  className,
}) => {
  const isPositive = useMemo(() => {
    if (data.length < 2) return true;
    return data[data.length - 1]?.[dataKey] >= data[0]?.[dataKey];
  }, [data, dataKey]);
  
  const lineColor = color || (isPositive ? CHART_COLORS.bullish : CHART_COLORS.bearish);
  
  return (
    <div className={cn('inline-block', className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Candlestick Chart (Simplified using composed chart)
export const CandlestickChart = ({
  data = [], // [{ date, open, high, low, close, volume }]
  height = 400,
  showVolume = true,
  className,
}) => (
  <div className={cn('w-full', className)}>
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 18%)" />
        
        <XAxis 
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
        />
        <YAxis 
          yAxisId="price"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
          domain={['auto', 'auto']}
        />
        {showVolume && (
          <YAxis 
            yAxisId="volume"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
          />
        )}
        
        <Tooltip content={<CustomTooltip />} />
        
        {/* High-Low Range */}
        <Bar
          yAxisId="price"
          dataKey="range"
          fill="transparent"
          stroke={(entry) => entry.close >= entry.open ? CHART_COLORS.bullish : CHART_COLORS.bearish}
        />
        
        {/* Close Line */}
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="close"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          dot={false}
        />
        
        {/* Volume Bars */}
        {showVolume && (
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill={CHART_COLORS.primary}
            opacity={0.3}
            radius={[2, 2, 0, 0]}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

// PnL Chart (Profit/Loss visualization)
export const PnLChart = ({
  data = [],
  height = 200,
  className,
}) => (
  <div className={cn('w-full', className)}>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="pnlRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
            <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 18%)" />
        
        <XAxis 
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }}
          tickFormatter={(v) => formatINR(v, { compact: true })}
        />
        
        <ReferenceLine y={0} stroke="hsl(220, 9%, 46%)" strokeDasharray="3 3" />
        
        <Tooltip content={<CustomTooltip formatter={(v) => formatINR(v)} />} />
        
        <Area
          type="monotone"
          dataKey="pnl"
          stroke="hsl(142, 71%, 45%)"
          fill="url(#pnlGreen)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default {
  TradingAreaChart,
  TradingLineChart,
  TradingBarChart,
  Sparkline,
  CandlestickChart,
  PnLChart,
};
