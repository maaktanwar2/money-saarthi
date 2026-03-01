/**
 * Strategy Showcase - Interactive strategy comparison cards
 * Shows payoff diagrams, metrics, and strategy explanations
 */
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Shield, Brain, TrendingUp, Zap, ChevronDown } from 'lucide-react';
import { Card, CardContent, Badge } from '../ui';
import { CHART_COLORS } from '../../lib/chartTheme';

const STRATEGIES = [
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    icon: Shield,
    color: 'success',
    risk: 'Low-Medium',
    expectedReturn: '2-4% weekly',
    capitalRequired: '\u20B91.5-2L margin',
    bestFor: 'Range-bound, Low IV',
    description: 'Sell OTM options on both sides with protective wings. Max loss is capped at wing width. Best for sideways markets with low implied volatility.',
    payoffPoints: [
      { x: -300, y: -80 }, { x: -200, y: -80 }, { x: -150, y: -30 },
      { x: -100, y: 40 }, { x: 0, y: 40 }, { x: 100, y: 40 },
      { x: 150, y: -30 }, { x: 200, y: -80 }, { x: 300, y: -80 }
    ]
  },
  {
    id: 'iron_butterfly',
    name: 'Iron Butterfly',
    icon: Zap,
    color: 'secondary',
    risk: 'Medium',
    expectedReturn: '3-6% weekly',
    capitalRequired: '\u20B91.5-2L margin',
    bestFor: 'Low volatility, Pinning',
    description: 'Sell ATM straddle + buy OTM wings for protection. Maximum profit when underlying stays at the strike. Higher premium collected than Iron Condor.',
    payoffPoints: [
      { x: -300, y: -60 }, { x: -200, y: -60 }, { x: -100, y: 10 },
      { x: 0, y: 80 }, { x: 100, y: 10 },
      { x: 200, y: -60 }, { x: 300, y: -60 }
    ]
  },
  {
    id: 'short_strangle',
    name: 'Short Strangle',
    icon: Brain,
    color: 'info',
    risk: 'Medium-High',
    expectedReturn: '2-5% weekly',
    capitalRequired: '\u20B92-3L margin',
    bestFor: 'Range-bound, High IV',
    description: 'Sell OTM Call and OTM Put without protection. Higher premium than condor but unlimited risk. Best with AI-powered adjustments for risk management.',
    payoffPoints: [
      { x: -300, y: -100 }, { x: -200, y: -40 }, { x: -100, y: 30 },
      { x: 0, y: 50 }, { x: 100, y: 30 },
      { x: 200, y: -40 }, { x: 300, y: -100 }
    ]
  },
  {
    id: 'vwap_momentum',
    name: 'VWAP Momentum',
    icon: TrendingUp,
    color: 'primary',
    risk: 'Medium',
    expectedReturn: '1-3% daily',
    capitalRequired: '\u20B950K-1L',
    bestFor: 'Trending, High volume',
    description: 'Buy stocks showing strong momentum above VWAP or short below VWAP. Uses trailing stops and position sizing for risk management. Best for intraday trending days.',
    payoffPoints: [
      { x: -300, y: -60 }, { x: -200, y: -40 }, { x: -100, y: -20 },
      { x: 0, y: 0 }, { x: 100, y: 30 },
      { x: 200, y: 60 }, { x: 300, y: 90 }
    ]
  },
];

const StrategyCard = ({ strategy, isSelected, onClick }) => {
  const theme = useTheme();
  const [showDetail, setShowDetail] = useState(false);
  const Icon = strategy.icon;
  const paletteColor = strategy.color;
  const strokeColor = theme.palette[paletteColor]?.main || theme.palette.primary.main;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        sx={{
          cursor: 'pointer',
          transition: 'all 0.3s',
          height: '100%',
          ...(isSelected
            ? {
                outline: `2px solid ${theme.palette.primary.main}`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
              }
            : {
                '&:hover': {
                  outline: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                },
              }
          ),
        }}
        onClick={() => onClick(strategy.id)}
      >
        <CardContent sx={{ p: 2.5 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => alpha(t.palette[paletteColor].main, 0.2),
              }}
            >
              <Icon style={{ width: 20, height: 20, color: strokeColor }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{strategy.name}</Typography>
              <Badge variant="outline" sx={{ mt: 0.5, fontSize: '0.625rem' }}>{strategy.risk}</Badge>
            </Box>
          </Box>

          {/* Mini Payoff Diagram */}
          <Box sx={{ height: 80, mb: 1.5, mx: -1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={strategy.payoffPoints} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <ReferenceLine y={0} stroke={theme.palette.divider} strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke={strokeColor}
                  fill={strokeColor}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>

          {/* Metrics */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Return</Typography>
              <Typography variant="caption" fontWeight={500} sx={{ color: 'success.main' }}>
                {strategy.expectedReturn}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Capital</Typography>
              <Typography variant="caption" fontWeight={500}>{strategy.capitalRequired}</Typography>
            </Box>
          </Box>

          {/* Best For Tag */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Badge variant="secondary" sx={{ width: '100%', justifyContent: 'center', fontSize: '0.625rem' }}>
              {strategy.bestFor}
            </Badge>
          </Box>

          {/* Learn More Toggle */}
          <ButtonBase
            onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              justifyContent: 'center',
              width: '100%',
              mt: 1.5,
              py: 0.5,
              borderRadius: 1,
              color: 'text.secondary',
              fontSize: '0.75rem',
              transition: 'color 0.2s',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Learn More
            <ChevronDown
              style={{
                width: 12,
                height: 12,
                transition: 'transform 0.2s',
                transform: showDetail ? 'rotate(180deg)' : 'none',
              }}
            />
          </ButtonBase>

          <AnimatePresence>
            {showDetail && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {strategy.description}
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const StrategyShowcase = ({ onSelectStrategy, className }) => {
  const theme = useTheme();
  const [selected, setSelected] = useState(null);

  const handleSelect = (id) => {
    setSelected(id);
    onSelectStrategy?.(id);
  };

  return (
    <Box className={className}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Zap style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            Strategy Comparison
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Compare strategies and their risk-return profiles
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {STRATEGIES.map(strategy => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            isSelected={selected === strategy.id}
            onClick={handleSelect}
          />
        ))}
      </Box>
    </Box>
  );
};

export default React.memo(StrategyShowcase);
