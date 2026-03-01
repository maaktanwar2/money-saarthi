// AI Agent — Shared constants & config
import {
  Eye, Brain, Lightbulb, Zap, Sparkles, Pause, Square,
  AlertCircle, CircleDot
} from 'lucide-react';

/** Maps semantic color names to hex values (replaces tw() helper) */
export const COLOR_MAP = {
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#a855f7',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  slate: '#64748b',
  gray: '#9ca3af',
  yellow: '#eab308',
};

export const STRATEGY_INFO = {
  short_strangle: { name: 'Short Strangle', icon: '🎯', color: 'emerald', desc: 'Sell OTM CE+PE' },
  iron_condor: { name: 'Iron Condor', icon: '🛡️', color: 'blue', desc: 'Defined-risk range' },
  iron_butterfly: { name: 'Iron Butterfly', icon: '🦋', color: 'purple', desc: 'ATM premium capture' },
  long_ce: { name: 'Long Call', icon: '📈', color: 'green', desc: 'Bullish directional' },
  long_pe: { name: 'Long Put', icon: '📉', color: 'red', desc: 'Bearish directional' },
  straddle_buy: { name: 'Long Straddle', icon: '⚡', color: 'amber', desc: 'Expecting big move' },
  vwap_reversal: { name: 'VWAP Reversal', icon: '🔄', color: 'cyan', desc: 'Mean reversion' },
  hedge_overlay: { name: 'Hedge Overlay', icon: '🧱', color: 'slate', desc: 'Protect positions' },
  no_trade: { name: 'No Trade', icon: '⏸️', color: 'gray', desc: 'Skip / uncertain' },
};

export const REGIME_COLORS = {
  strongly_bullish: '#4ade80',
  bullish: '#4ade80',
  mildly_bullish: '#34d399',
  range_bound: '#60a5fa',
  mildly_bearish: '#fb923c',
  bearish: '#f87171',
  strongly_bearish: '#ef4444',
  high_volatility: '#fbbf24',
  unknown: '#94a3b8',
};

export const STATE_CONFIG = {
  idle: { color: 'slate', icon: CircleDot, label: 'Idle', pulse: false },
  observing: { color: 'blue', icon: Eye, label: 'Observing', pulse: true },
  thinking: { color: 'purple', icon: Brain, label: 'Thinking...', pulse: true },
  deciding: { color: 'amber', icon: Lightbulb, label: 'Deciding', pulse: true },
  acting: { color: 'emerald', icon: Zap, label: 'Executing', pulse: true },
  reflecting: { color: 'cyan', icon: Sparkles, label: 'Reflecting', pulse: true },
  paused: { color: 'yellow', icon: Pause, label: 'Paused', pulse: false },
  stopped: { color: 'red', icon: Square, label: 'Stopped', pulse: false },
  error: { color: 'red', icon: AlertCircle, label: 'Error', pulse: false },
};
