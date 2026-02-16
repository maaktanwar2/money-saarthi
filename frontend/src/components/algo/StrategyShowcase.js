/**
 * Strategy Showcase - Interactive strategy comparison cards
 * Shows payoff diagrams, metrics, and strategy explanations
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Shield, Brain, TrendingUp, Zap, ChevronDown } from 'lucide-react';
import { Card, CardContent, Badge } from '../ui';
import { cn } from '../../lib/utils';

const STRATEGIES = [
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    icon: Shield,
    color: 'emerald',
    risk: 'Low-Medium',
    expectedReturn: '2-4% weekly',
    capitalRequired: '₹1.5-2L margin',
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
    color: 'purple',
    risk: 'Medium',
    expectedReturn: '3-6% weekly',
    capitalRequired: '₹1.5-2L margin',
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
    color: 'blue',
    risk: 'Medium-High',
    expectedReturn: '2-5% weekly',
    capitalRequired: '₹2-3L margin',
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
    color: 'cyan',
    risk: 'Medium',
    expectedReturn: '1-3% daily',
    capitalRequired: '₹50K-1L',
    bestFor: 'Trending, High volume',
    description: 'Buy stocks showing strong momentum above VWAP or short below VWAP. Uses trailing stops and position sizing for risk management. Best for intraday trending days.',
    payoffPoints: [
      { x: -300, y: -60 }, { x: -200, y: -40 }, { x: -100, y: -20 },
      { x: 0, y: 0 }, { x: 100, y: 30 },
      { x: 200, y: 60 }, { x: 300, y: 90 }
    ]
  },
];

const colorMap = {
  emerald: { stroke: '#10B981', bg: 'bg-emerald-500/20', text: 'text-emerald-500', fill: '#10B981' },
  purple: { stroke: '#A855F7', bg: 'bg-purple-500/20', text: 'text-purple-500', fill: '#A855F7' },
  blue: { stroke: '#3B82F6', bg: 'bg-blue-500/20', text: 'text-blue-500', fill: '#3B82F6' },
  cyan: { stroke: '#06B6D4', bg: 'bg-cyan-500/20', text: 'text-cyan-500', fill: '#06B6D4' },
};

const StrategyCard = ({ strategy, isSelected, onClick }) => {
  const [showDetail, setShowDetail] = useState(false);
  const colors = colorMap[strategy.color];
  const Icon = strategy.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "cursor-pointer transition-all duration-300 h-full",
          isSelected 
            ? "ring-2 ring-primary shadow-lg shadow-primary/10" 
            : "hover:ring-1 hover:ring-primary/30"
        )}
        onClick={() => onClick(strategy.id)}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
              <Icon className={cn("w-5 h-5", colors.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{strategy.name}</h4>
              <Badge variant="outline" className="text-[10px] mt-0.5">{strategy.risk}</Badge>
            </div>
          </div>
          
          {/* Mini Payoff Diagram */}
          <div className="h-[80px] mb-3 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={strategy.payoffPoints} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <ReferenceLine y={0} stroke="hsl(240, 4%, 20%)" strokeDasharray="3 3" />
                <Area 
                  type="monotone" 
                  dataKey="y" 
                  stroke={colors.stroke} 
                  fill={colors.fill}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Metrics */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Return</span>
              <span className="font-medium text-green-500 text-xs">{strategy.expectedReturn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Capital</span>
              <span className="font-medium text-xs">{strategy.capitalRequired}</span>
            </div>
          </div>
          
          {/* Best For Tag */}
          <Badge className="mt-3 w-full justify-center text-[10px]" variant="secondary">
            {strategy.bestFor}
          </Badge>

          {/* Learn More Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3 w-full justify-center transition-colors"
          >
            Learn More
            <ChevronDown className={cn("w-3 h-3 transition-transform", showDetail && "rotate-180")} />
          </button>

          <AnimatePresence>
            {showDetail && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-xs text-muted-foreground mt-2 overflow-hidden"
              >
                {strategy.description}
              </motion.p>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const StrategyShowcase = ({ onSelectStrategy, className }) => {
  const [selected, setSelected] = useState(null);

  const handleSelect = (id) => {
    setSelected(id);
    onSelectStrategy?.(id);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Strategy Comparison
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Compare strategies and their risk-return profiles
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STRATEGIES.map(strategy => (
          <StrategyCard
            key={strategy.id}
            strategy={strategy}
            isSelected={selected === strategy.id}
            onClick={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(StrategyShowcase);
