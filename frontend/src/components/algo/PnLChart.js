/**
 * P&L Equity Curve Chart for Algo Trading Page
 * Shows real-time P&L performance across all bots
 */
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { formatINR } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/chartTheme';

const CustomTooltip = ({ active, payload, label }) => {
  const theme = useTheme();
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
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      {payload.map((entry, i) => (
        <Typography key={i} variant="body2" fontWeight={500} style={{ color: entry.color }}>
          {entry.name}: {formatINR(entry.value)}
        </Typography>
      ))}
    </Paper>
  );
};

const PnLChart = ({ data = [], className }) => {
  const theme = useTheme();

  // If no data, show empty state
  if (!data.length) {
    return (
      <Card className={className}>
        <CardHeader sx={{ pb: 1 }}>
          <CardTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
              <TrendingUp style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
              P&L Performance
            </Box>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Box
            sx={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <TrendingUp style={{ width: 40, height: 40, margin: '0 auto 8px', opacity: 0.3, color: theme.palette.text.secondary }} />
              <Typography variant="body2">No P&L data yet</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Start a bot to see performance chart
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <TrendingUp style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            P&L Performance
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 'auto', fontWeight: 400 }}
            >
              {data.length} data points
            </Typography>
          </Box>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Box sx={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
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
                  <stop offset="5%" stopColor={CHART_COLORS.bullish} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.bullish} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="time"
                stroke={CHART_COLORS.axis}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={CHART_COLORS.axis}
                fontSize={11}
                tickFormatter={(v) => `\u20B9${v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}`}
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
                  stroke={CHART_COLORS.bullish}
                  fill="url(#deltaGradient)"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="pnl"
                name="Total P&L"
                stroke={CHART_COLORS.primary}
                fill="url(#pnlGradient)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(PnLChart);
