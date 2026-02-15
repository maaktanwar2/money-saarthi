// AI Agent — Shared constants & config
import {
  Eye, Brain, Lightbulb, Zap, Sparkles, Pause, Square,
  AlertCircle, CircleDot
} from 'lucide-react';

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
  strongly_bullish: 'text-green-400',
  bullish: 'text-green-400',
  mildly_bullish: 'text-emerald-400',
  range_bound: 'text-blue-400',
  mildly_bearish: 'text-orange-400',
  bearish: 'text-red-400',
  strongly_bearish: 'text-red-500',
  high_volatility: 'text-amber-400',
  unknown: 'text-slate-400',
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
