// Chart Components - MUI-integrated reusable chart components for trading platform
import { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, ComposedChart
} from 'recharts';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { formatINR, formatNumber, formatPercent } from '../../lib/utils';
import { CHART_COLORS, getChartColorsFromTheme } from '../../lib/chartTheme';

// Custom Tooltip - MUI Paper based
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minWidth: 120,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      {payload.map((entry, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: entry.color,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {entry.name}:
          </Typography>
          <Typography variant="caption" fontWeight={600}>
            {formatter ? formatter(entry.value) : entry.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

/** Hook to get theme-aware chart colors */
const useChartColors = () => {
  const theme = useMuiTheme();
  return useMemo(() => ({
    ...getChartColorsFromTheme(theme),
    area: 'url(#primaryGradient)',
  }), [theme]);
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
  const COLORS = useChartColors();
  const chartColor = COLORS[color] || color;

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeOpacity={0.3} />
          )}

          {showAxis && (
            <>
              <XAxis
                dataKey={xAxisKey}
                axisLine={false}
                tickLine={false}
                tick={{ fill: COLORS.axis, fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: COLORS.axis, fontSize: 12 }}
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
    </Box>
  );
};

// Line Chart for multiple series
export const TradingLineChart = ({
  data = [],
  series = [],
  xAxisKey = 'date',
  height = 300,
  showGrid = true,
  showLegend = false,
  formatter,
  className,
}) => {
  const COLORS = useChartColors();

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeOpacity={0.3} />
          )}

          <XAxis
            dataKey={xAxisKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
            tickFormatter={formatter}
          />

          <Tooltip content={<CustomTooltip formatter={formatter} />} />

          {showLegend && <Legend />}

          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name || s.dataKey}
              stroke={s.color || COLORS.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Bar Chart
export const TradingBarChart = ({
  data = [],
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  colorByValue = false,
  formatter,
  className,
}) => {
  const COLORS = useChartColors();

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeOpacity={0.3} />
          )}

          <XAxis
            dataKey={xAxisKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
            tickFormatter={formatter}
          />

          <Tooltip content={<CustomTooltip formatter={formatter} />} />

          <Bar
            dataKey={dataKey}
            radius={[4, 4, 0, 0]}
            fill={COLORS.primary}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Mini Sparkline for compact displays
export const Sparkline = ({
  data = [],
  dataKey = 'value',
  width = 100,
  height = 30,
  color,
  className,
}) => {
  const COLORS = useChartColors();

  const isPositive = useMemo(() => {
    if (data.length < 2) return true;
    return data[data.length - 1]?.[dataKey] >= data[0]?.[dataKey];
  }, [data, dataKey]);

  const lineColor = color || (isPositive ? COLORS.bullish : COLORS.bearish);

  return (
    <Box className={className} sx={{ display: 'inline-block', width, height }}>
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
    </Box>
  );
};

// Candlestick Chart (Simplified using composed chart)
export const CandlestickChart = ({
  data = [],
  height = 400,
  showVolume = true,
  className,
}) => {
  const COLORS = useChartColors();

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeOpacity={0.3} />

          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            yAxisId="price"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
            domain={['auto', 'auto']}
          />
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: COLORS.axis, fontSize: 12 }}
            />
          )}

          <Tooltip content={<CustomTooltip />} />

          <Bar
            yAxisId="price"
            dataKey="range"
            fill="transparent"
            stroke={(entry) => entry.close >= entry.open ? COLORS.bullish : COLORS.bearish}
          />

          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke={COLORS.primary}
            strokeWidth={2}
            dot={false}
          />

          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill={COLORS.primary}
              opacity={0.3}
              radius={[2, 2, 0, 0]}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
};

// PnL Chart (Profit/Loss visualization)
export const PnLChart = ({
  data = [],
  height = 200,
  className,
}) => {
  const COLORS = useChartColors();

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pnlGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.bullish} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.bullish} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pnlRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.bearish} stopOpacity={0} />
              <stop offset="100%" stopColor={COLORS.bearish} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} strokeOpacity={0.3} />

          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 12 }}
            tickFormatter={(v) => formatINR(v, { compact: true })}
          />

          <ReferenceLine y={0} stroke={COLORS.axis} strokeDasharray="3 3" />

          <Tooltip content={<CustomTooltip formatter={(v) => formatINR(v)} />} />

          <Area
            type="monotone"
            dataKey="pnl"
            stroke={COLORS.bullish}
            fill="url(#pnlGreen)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default {
  TradingAreaChart,
  TradingLineChart,
  TradingBarChart,
  Sparkline,
  CandlestickChart,
  PnLChart,
};
