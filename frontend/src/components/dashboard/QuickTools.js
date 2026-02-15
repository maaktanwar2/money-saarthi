// Dashboard — Quick Tools Navigation Grid
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScanSearch, LineChart, Brain, Zap, Activity, BarChart3,
  ChevronRight, Target
} from 'lucide-react';
import { Card, Badge } from '../ui';
import { cn } from '../../lib/utils';

const QUICK_TOOLS = [
  {
    id: 'scanners',
    title: 'Stock Scanners',
    description: '15+ pre-built scanners for gainers, breakouts, momentum',
    icon: ScanSearch,
    path: '/scanners',
    color: 'emerald',
  },
  {
    id: 'options',
    title: 'Options Lab',
    description: 'Chain analysis, Greeks, OI analytics, payoff charts',
    icon: LineChart,
    path: '/options',
    color: 'cyan',
    badge: 'Pro',
  },
  {
    id: 'advisor',
    title: 'AI Agent',
    description: 'Autonomous AI trading agent with OODA cycle',
    icon: Brain,
    path: '/ai-agent',
    color: 'violet',
    badge: 'AI',
  },
  {
    id: 'signals',
    title: 'Trade Signals',
    description: 'AI-generated buy/sell signals with confidence scores',
    icon: Zap,
    path: '/signals',
    color: 'amber',
  },
  {
    id: 'market',
    title: 'Market Pulse',
    description: 'FII/DII flows, sector performance, market breadth',
    icon: Activity,
    path: '/market',
    color: 'blue',
  },
  {
    id: 'backtest',
    title: 'Backtesting',
    description: 'Test your strategies against historical data',
    icon: BarChart3,
    path: '/backtest',
    color: 'rose',
  },
];

const QuickTools = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {QUICK_TOOLS.map((tool, i) => (
      <motion.div
        key={tool.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.05 }}
      >
        <Link to={tool.path}>
          <Card className="p-5 h-full group hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                tool.color === 'emerald' && 'bg-emerald-500/15 text-emerald-500',
                tool.color === 'cyan' && 'bg-cyan-500/15 text-cyan-500',
                tool.color === 'violet' && 'bg-violet-500/15 text-violet-500',
                tool.color === 'amber' && 'bg-amber-500/15 text-amber-500',
                tool.color === 'blue' && 'bg-blue-500/15 text-blue-500',
                tool.color === 'rose' && 'bg-rose-500/15 text-rose-500',
              )}>
                <tool.icon className="w-6 h-6" />
              </div>
              {tool.badge && (
                <Badge variant={tool.badge === 'AI' ? 'default' : 'warning'}>
                  {tool.badge}
                </Badge>
              )}
            </div>

            <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
              {tool.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {tool.description}
            </p>

            {tool.accuracy && (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="font-semibold text-primary">{tool.accuracy}%</span>
                  <span className="text-muted-foreground">accuracy</span>
                </span>
                <span className="text-muted-foreground">
                  {tool.trades?.toLocaleString()} trades
                </span>
              </div>
            )}

            <div className="flex items-center text-sm text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open Tool</span>
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      </motion.div>
    ))}
  </div>
);

export default QuickTools;
