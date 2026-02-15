/**
 * AI Agent Page - Autonomous Self-Thinking Trading Agent
 * 
 * The agent autonomously:
 * - Observes market data (spot, VIX, OI, technicals)
 * - Thinks via Claude LLM reasoning
 * - Decides strategy (strangle, condor, directional, etc.)
 * - Acts by placing/adjusting/exiting trades
 * - Reflects on outcomes
 * - Adapts its own parameters based on performance
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tw } from '../lib/colorMap';
import {
  Brain, Play, Square, Pause, RotateCw, Settings, Activity,
  TrendingUp, TrendingDown, Eye, Zap, Shield, Target,
  BarChart3, Clock, AlertCircle, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, RefreshCw, Bot, Sparkles,
  Cpu, Network, Gauge, Flame, Snowflake, ArrowRight,
  Terminal, MessageSquare, Lightbulb, CircleDot, Power,
  Waves, Timer, Rocket, Crown
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Spinner
} from '../components/ui';
import { cn, formatINR } from '../lib/utils';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { API_BASE_URL, fetchWithAuth } from '../config/api';

const API = `${API_BASE_URL}/api`;
const POLL_INTERVAL = 3000;

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY CONFIG DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

const STRATEGY_INFO = {
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

const REGIME_COLORS = {
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

const STATE_CONFIG = {
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


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const AIAgent = () => {
  // State
  const [agentStatus, setAgentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const [eventFilter, setEventFilter] = useState('ALL');
  const pollRef = useRef(null);

  // Config form state
  const [config, setConfig] = useState({
    underlying: 'NIFTY',
    risk_level: 'moderate',
    max_capital: 500000,
    use_mock: true,
    auto_enter: true,
    auto_exit: true,
    auto_adjust: true,
    think_interval: 60,
    min_confidence: 65,
    num_lots: 1,
    max_positions: 3,
    adapt_enabled: true,
  });

  // ═════════════════════════════════════════════════════════════════════════
  // API CALLS
  // ═════════════════════════════════════════════════════════════════════════

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/ai-agent/status?user_id=default`);
      const data = await res.json();
      if (data.success) {
        setAgentStatus(data.data);
      }
    } catch (err) {
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const startAgent = async () => {
    setStarting(true);
    try {
      const res = await fetchWithAuth(`/ai-agent/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default', ...config }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentStatus(data.data);
        setShowConfig(false);
      }
    } catch (err) {
      console.error('Start error:', err);
    } finally {
      setStarting(false);
    }
  };

  const stopAgent = async () => {
    setStopping(true);
    try {
      const res = await fetchWithAuth(`/ai-agent/stop?user_id=default`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAgentStatus(prev => ({ ...prev, state: 'stopped', active: false }));
      }
    } catch (err) {
      console.error('Stop error:', err);
    } finally {
      setStopping(false);
    }
  };

  const pauseAgent = async () => {
    try {
      await fetchWithAuth(`/ai-agent/pause?user_id=default`, { method: 'POST' });
      fetchStatus();
    } catch (err) { console.error(err); }
  };

  const resumeAgent = async () => {
    try {
      await fetchWithAuth(`/ai-agent/resume?user_id=default`, { method: 'POST' });
      fetchStatus();
    } catch (err) { console.error(err); }
  };

  // Polling
  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const isActive = agentStatus?.active || false;
  const state = agentStatus?.state || 'idle';
  const stateConf = STATE_CONFIG[state] || STATE_CONFIG.idle;

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Brain className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-400">Initializing AI Agent...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/ai-agent')} path="/ai-agent" />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30"
              )}>
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              {isActive && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                AI Trading Agent
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-[10px]">
                  AUTONOMOUS
                </Badge>
              </h1>
              <p className="text-xs text-slate-400">Self-thinking · Self-adjusting · Multi-strategy</p>
            </div>
          </div>

          {/* Agent State Badge */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              `${tw(stateConf.color, 'bg10')} ${tw(stateConf.color, 'text400')} border ${tw(stateConf.color, 'border20')}`
            )}>
              {stateConf.pulse && <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tw(stateConf.color, 'bg400')} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${tw(stateConf.color, 'bg500')}`}></span>
              </span>}
              <stateConf.icon className="w-4 h-4" />
              {stateConf.label}
            </div>

            {/* Controls */}
            {!isActive ? (
              <Button
                onClick={() => setShowConfig(true)}
                disabled={starting}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
              >
                {starting ? <Spinner className="w-4 h-4 mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                {starting ? 'Starting...' : 'Launch Agent'}
              </Button>
            ) : (
              <div className="flex gap-2">
                {state === 'paused' ? (
                  <Button onClick={resumeAgent} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0" size="sm">
                    <Play className="w-4 h-4 mr-1" /> Resume
                  </Button>
                ) : (
                  <Button onClick={pauseAgent} className="bg-amber-600 hover:bg-amber-500 text-white border-0" size="sm">
                    <Pause className="w-4 h-4 mr-1" /> Pause
                  </Button>
                )}
                <Button
                  onClick={stopAgent}
                  disabled={stopping}
                  className="bg-red-600 hover:bg-red-500 text-white border-0"
                  size="sm"
                >
                  {stopping ? <Spinner className="w-4 h-4 mr-1" /> : <Square className="w-4 h-4 mr-1" />}
                  Stop
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Config Modal */}
      <AnimatePresence>
        {showConfig && <ConfigPanel config={config} setConfig={setConfig} onStart={startAgent} onClose={() => setShowConfig(false)} starting={starting} />}
      </AnimatePresence>

      {/* Dashboard Grid */}
      {isActive || agentStatus?.cycle_count > 0 ? (
        <div className="space-y-4">
          {/* Top Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="Daily P&L"
              value={formatINR(agentStatus?.performance?.daily_pnl || 0)}
              icon={TrendingUp}
              color={(agentStatus?.performance?.daily_pnl || 0) >= 0 ? 'emerald' : 'red'}
              subtitle={`${agentStatus?.performance?.total_trades || 0} trades today`}
            />
            <StatCard
              title="Win Rate"
              value={`${agentStatus?.performance?.win_rate || 0}%`}
              icon={Target}
              color="blue"
              subtitle={`${agentStatus?.performance?.winning_trades || 0}W / ${agentStatus?.performance?.losing_trades || 0}L`}
            />
            <StatCard
              title="Confidence"
              value={`${agentStatus?.evolved_params?.confidence_threshold?.toFixed(0) || 65}%`}
              icon={Brain}
              color="purple"
              subtitle={`Cycle #${agentStatus?.cycle_count || 0}`}
            />
            <StatCard
              title="Positions"
              value={agentStatus?.active_positions?.length || 0}
              icon={Gauge}
              color="amber"
              subtitle={`Max: ${agentStatus?.config?.max_positions || 3}`}
            />
          </div>

          {/* Main Content: 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Agent Brain + Positions */}
            <div className="lg:col-span-2 space-y-4">
              {/* Latest Decision */}
              <LatestDecision decision={agentStatus?.last_decision} snapshot={agentStatus?.market_snapshot} />

              {/* Active Positions */}
              <PositionsPanel positions={agentStatus?.active_positions || []} />

              {/* Decision History */}
              <DecisionHistory decisions={agentStatus?.recent_decisions || []} onShowThoughts={() => setShowThoughts(!showThoughts)} />
            </div>

            {/* Right: Event Feed */}
            <div className="space-y-4">
              {/* Market Snapshot */}
              <MarketSnapshotCard snapshot={agentStatus?.market_snapshot} />

              {/* Live Event Feed */}
              <EventFeed events={agentStatus?.event_feed || []} filter={eventFilter} setFilter={setEventFilter} />
            </div>
          </div>

          {/* Thought Log (expandable) */}
          <AnimatePresence>
            {showThoughts && <ThoughtLogPanel agentStatus={agentStatus} />}
          </AnimatePresence>

          {/* Evolved Parameters */}
          <EvolvedParamsCard params={agentStatus?.evolved_params} performance={agentStatus?.performance} />
        </div>
      ) : (
        /* Landing / Idle State */
        <IdleView onLaunch={() => setShowConfig(true)} />
      )}
    </PageLayout>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <Card className="bg-slate-800/60 border-slate-700/50">
    <CardContent className="p-4">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tw(color, 'bg10'))}>
          <Icon className={cn("w-4 h-4", tw(color, 'text400'))} />
        </div>
      </div>
      <div className={cn("text-2xl font-bold", tw(color, 'text400'))}>{value}</div>
      {subtitle && <div className="text-[11px] text-slate-500 mt-1">{subtitle}</div>}
    </CardContent>
  </Card>
);


// ──────────────────────────────────────────────────────────────────────────────
// CONFIG PANEL
// ──────────────────────────────────────────────────────────────────────────────

const ConfigPanel = ({ config, setConfig, onStart, onClose, starting }) => {
  const update = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Configure AI Agent</h2>
            <p className="text-xs text-slate-400">Set parameters before launch</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Underlying */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Underlying</label>
            <div className="flex gap-2">
              {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(sym => (
                <button
                  key={sym}
                  onClick={() => update('underlying', sym)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    config.underlying === sym
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:border-slate-500"
                  )}
                >{sym}</button>
              ))}
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Risk Level</label>
            <div className="flex gap-2">
              {[
                { value: 'conservative', icon: Snowflake, label: 'Conservative', color: 'blue' },
                { value: 'moderate', icon: Gauge, label: 'Moderate', color: 'amber' },
                { value: 'aggressive', icon: Flame, label: 'Aggressive', color: 'red' },
              ].map(r => (
                <button
                  key={r.value}
                  onClick={() => update('risk_level', r.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all flex-1",
                    config.risk_level === r.value
                      ? `${tw(r.color, 'bg20')} ${tw(r.color, 'text300')} border ${tw(r.color, 'border40')}`
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:border-slate-500"
                  )}
                >
                  <r.icon className="w-3.5 h-3.5" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capital & Lots */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Max Capital (₹)</label>
              <input
                type="number"
                value={config.max_capital}
                onChange={e => update('max_capital', Number(e.target.value))}
                className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Lots per Trade</label>
              <input
                type="number"
                value={config.num_lots}
                onChange={e => update('num_lots', Number(e.target.value))}
                min={1} max={10}
                className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Confidence & Interval */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Min Confidence ({config.min_confidence}%)</label>
              <input
                type="range"
                min={40} max={95} value={config.min_confidence}
                onChange={e => update('min_confidence', Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Think Interval (sec)</label>
              <input
                type="number"
                value={config.think_interval}
                onChange={e => update('think_interval', Number(e.target.value))}
                min={30} max={300}
                className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Toggle Options */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'use_mock', label: '🧪 Mock Mode (Paper Trade)', hint: 'No real orders' },
              { key: 'auto_enter', label: '⚡ Auto-Enter Trades' },
              { key: 'auto_exit', label: '🚪 Auto-Exit Positions' },
              { key: 'auto_adjust', label: '🔧 Auto-Adjust Positions' },
              { key: 'adapt_enabled', label: '🧬 Self-Adaptation' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => update(opt.key, !config[opt.key])}
                className={cn(
                  "text-left px-3 py-2 rounded-lg text-xs transition-all",
                  config[opt.key]
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-700/30 text-slate-500 border border-slate-600/20"
                )}
              >
                {opt.label}
                {opt.hint && <span className="block text-[10px] opacity-60 mt-0.5">{opt.hint}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button onClick={onClose} variant="outline" className="flex-1 border-slate-600 text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={onStart}
            disabled={starting}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
          >
            {starting ? <Spinner className="w-4 h-4 mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
            {starting ? 'Starting...' : 'Launch Agent'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};


// ──────────────────────────────────────────────────────────────────────────────
// LATEST DECISION
// ──────────────────────────────────────────────────────────────────────────────

const LatestDecision = ({ decision, snapshot }) => {
  if (!decision) {
    return (
      <Card className="bg-slate-800/60 border-slate-700/50">
        <CardContent className="p-6 text-center">
          <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Waiting for first decision...</p>
          <p className="text-slate-600 text-xs mt-1">The agent is analyzing market conditions</p>
        </CardContent>
      </Card>
    );
  }

  const stratInfo = STRATEGY_INFO[decision.strategy] || STRATEGY_INFO.no_trade;
  const regimeColor = REGIME_COLORS[decision.market_regime] || 'text-slate-400';

  return (
    <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden">
      <div className={cn(
        "h-1",
        decision.action === 'ENTER' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
        decision.action === 'EXIT' ? 'bg-gradient-to-r from-red-500 to-orange-500' :
        decision.action === 'ADJUST' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
        'bg-gradient-to-r from-slate-600 to-slate-500'
      )} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Latest Decision
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  decision.action === 'ENTER' ? 'bg-emerald-500/20 text-emerald-400' :
                  decision.action === 'EXIT' ? 'bg-red-500/20 text-red-400' :
                  decision.action === 'ADJUST' ? 'bg-amber-500/20 text-amber-400' :
                  decision.action === 'WAIT' ? 'bg-slate-500/20 text-slate-400' :
                  'bg-blue-500/20 text-blue-400'
                )}>
                  {decision.action}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {decision.timestamp ? new Date(decision.timestamp).toLocaleTimeString('en-IN') : '--'} · {decision.id}
              </p>
            </div>
          </div>

          {/* Confidence meter */}
          <div className="text-right">
            <div className={cn(
              "text-lg font-bold",
              decision.confidence_score >= 80 ? 'text-emerald-400' :
              decision.confidence_score >= 60 ? 'text-amber-400' :
              'text-red-400'
            )}>
              {decision.confidence_score?.toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500">confidence</div>
          </div>
        </div>

        {/* Strategy & Regime */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-lg",
            `${tw(stratInfo.color, 'bg10')} ${tw(stratInfo.color, 'text400')} border ${tw(stratInfo.color, 'border20')}`
          )}>
            <span>{stratInfo.icon}</span> {stratInfo.name}
          </span>
          <span className={cn("text-xs px-2 py-1 rounded-lg bg-slate-700/50 border border-slate-600/20", regimeColor)}>
            {decision.market_regime?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Reasoning */}
        <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
          <p className="text-sm text-slate-300 leading-relaxed">{decision.reasoning || 'No reasoning logged'}</p>
        </div>

        {/* Risk Assessment */}
        {decision.risk_assessment && (
          <div className="flex items-start gap-2 bg-amber-500/5 rounded-lg p-2.5 border border-amber-500/10">
            <Shield className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300/80">{decision.risk_assessment}</p>
          </div>
        )}

        {/* Scenarios */}
        {decision.scenarios_considered?.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Scenarios Considered</p>
            {decision.scenarios_considered.map((s, i) => (
              <div key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-600" />
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Hedge Plan */}
        {decision.hedge_plan && (decision.hedge_plan.required || decision.hedge_plan.reason) && (
          <div className="mt-3 bg-purple-500/5 rounded-lg p-3 border border-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">Hedge Plan</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                decision.hedge_plan.required ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              )}>
                {decision.hedge_plan.required ? '⚠️ Required' : '✅ Not Required'}
              </span>
            </div>
            {decision.hedge_plan.reason && (
              <p className="text-xs text-slate-400 mb-2">{decision.hedge_plan.reason}</p>
            )}
            {decision.hedge_plan.legs?.length > 0 && (
              <div className="space-y-1">
                {decision.hedge_plan.legs.map((leg, i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-2 text-[10px] px-2.5 py-1.5 rounded-lg",
                    leg.direction === 'BUY' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                  )}>
                    <span className={cn("font-bold", leg.direction === 'BUY' ? 'text-green-400' : 'text-red-400')}>
                      {leg.action} {leg.direction}
                    </span>
                    <span className="text-slate-300">
                      {leg.instrument}{leg.strike ? ` @ ${leg.strike}` : ''}
                    </span>
                    {leg.quantity_lots && <span className="text-slate-500">x{leg.quantity_lots}L</span>}
                    {leg.notes && <span className="text-slate-500 ml-auto">{leg.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Position Plan */}
        {decision.position_plan && (decision.position_plan.targets || decision.position_plan.exits) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {decision.position_plan.targets && (
              <div className="bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/10">
                <div className="text-[10px] text-emerald-400 mb-1 font-semibold flex items-center gap-1">
                  <Target className="w-3 h-3" /> Targets / SL
                </div>
                <p className="text-[11px] text-slate-400">{decision.position_plan.targets}</p>
              </div>
            )}
            {decision.position_plan.exits && (
              <div className="bg-red-500/5 rounded-lg p-2.5 border border-red-500/10">
                <div className="text-[10px] text-red-400 mb-1 font-semibold flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Exit Triggers
                </div>
                <p className="text-[11px] text-slate-400">{decision.position_plan.exits}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};


// ──────────────────────────────────────────────────────────────────────────────
// POSITIONS PANEL
// ──────────────────────────────────────────────────────────────────────────────

const PositionsPanel = ({ positions }) => (
  <Card className="bg-slate-800/60 border-slate-700/50">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        Active Positions ({positions.length})
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      {positions.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No active positions</p>
      ) : (
        <div className="space-y-2">
          {positions.map((pos, i) => {
            const stratInfo = STRATEGY_INFO[pos.strategy] || STRATEGY_INFO.no_trade;
            const pnl = pos.current_pnl || 0;
            return (
              <div key={pos.id || i} className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span>{stratInfo.icon}</span>
                    <span className="text-xs font-medium text-white">{stratInfo.name}</span>
                    <span className="text-[10px] text-slate-500">{pos.id}</span>
                  </div>
                  <span className={cn("text-sm font-bold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                  </span>
                </div>
                {/* Legs */}
                <div className="flex flex-wrap gap-1.5">
                  {(pos.legs || []).map((leg, j) => (
                    <span key={j} className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      leg.type?.includes('SELL') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                    )}>
                      {leg.type} {leg.strike} @ ₹{leg.premium?.toFixed(1)}
                    </span>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span>SL: {formatINR(pos.stoploss_pnl || 0)}</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", pnl >= 0 ? "bg-emerald-500" : "bg-red-500")}
                      style={{ width: `${Math.min(100, Math.abs(pnl / (pos.target_pnl || 1)) * 100)}%` }}
                    />
                  </div>
                  <span>Target: {formatINR(pos.target_pnl || 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);


// ──────────────────────────────────────────────────────────────────────────────
// DECISION HISTORY
// ──────────────────────────────────────────────────────────────────────────────

const DecisionHistory = ({ decisions, onShowThoughts }) => (
  <Card className="bg-slate-800/60 border-slate-700/50">
    <CardHeader className="pb-2">
      <div className="flex justify-between items-center">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Decision History ({decisions.length})
        </CardTitle>
        <button onClick={onShowThoughts} className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
          <Terminal className="w-3 h-3" /> Full Thought Log
        </button>
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      {decisions.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No decisions yet</p>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {decisions.map((d, i) => {
            const stratInfo = STRATEGY_INFO[d.strategy] || STRATEGY_INFO.no_trade;
            return (
              <div key={d.id || i} className="flex items-center gap-3 py-1.5 border-b border-slate-700/30 last:border-0">
                <span className="text-[10px] text-slate-500 w-14 flex-shrink-0">
                  {d.timestamp ? new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium w-14 text-center flex-shrink-0",
                  d.action === 'ENTER' ? 'bg-emerald-500/20 text-emerald-400' :
                  d.action === 'EXIT' ? 'bg-red-500/20 text-red-400' :
                  d.action === 'ADJUST' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                )}>
                  {d.action}
                </span>
                <span className="text-xs text-slate-300 truncate flex-1">
                  {stratInfo.icon} {stratInfo.name}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  d.confidence_score >= 70 ? 'text-emerald-400' : d.confidence_score >= 50 ? 'text-amber-400' : 'text-slate-500'
                )}>
                  {d.confidence_score?.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);


// ──────────────────────────────────────────────────────────────────────────────
// MARKET SNAPSHOT
// ──────────────────────────────────────────────────────────────────────────────

const MarketSnapshotCard = ({ snapshot }) => {
  if (!snapshot) return null;

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Waves className="w-4 h-4 text-blue-400" />
          Market Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">{snapshot.symbol}</span>
            <span className="text-sm font-bold text-white">{snapshot.spot_price?.toLocaleString('en-IN')}</span>
          </div>
          <div className={cn(
            "text-right text-xs font-medium",
            snapshot.day_change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {snapshot.day_change_pct >= 0 ? '+' : ''}{snapshot.day_change_pct?.toFixed(2)}%
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Trend</span>
              <span className={cn("font-medium", 
                snapshot.trend === 'BULLISH' ? 'text-green-400' : 
                snapshot.trend === 'BEARISH' ? 'text-red-400' : 'text-blue-400'
              )}>{snapshot.trend}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VIX</span>
              <span className="text-white font-medium">{snapshot.vix?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VWAP</span>
              <span className="text-white">{snapshot.vwap?.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PCR</span>
              <span className="text-white">{snapshot.pcr?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IV Rank</span>
              <span className="text-white">{snapshot.iv_rank?.toFixed(0)}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Session</span>
              <span className="text-white">{snapshot.session}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Support</span>
              <span className="text-green-400">{snapshot.s1?.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Resistance</span>
              <span className="text-red-400">{snapshot.r1?.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


// ──────────────────────────────────────────────────────────────────────────────
// EVENT FEED
// ──────────────────────────────────────────────────────────────────────────────

const EVENT_TYPES = ['ALL', 'THINK', 'ACT', 'REFLECT', 'ADAPT', 'SAFETY', 'ERROR'];
const EVENT_ICONS = {
  SYSTEM: Power,
  START: Rocket,
  STOP: Square,
  OBSERVE: Eye,
  THINK: Brain,
  ACT: Zap,
  REFLECT: Sparkles,
  ADAPT: RotateCw,
  SAFETY: Shield,
  ERROR: AlertCircle,
  WARN: AlertCircle,
  CONFIG: Settings,
  IDLE: Clock,
  EXIT: XCircle,
  PAUSE: Pause,
  RESUME: Play,
};

const EventFeed = ({ events, filter, setFilter }) => {
  const filtered = filter === 'ALL' ? events : events.filter(e => e.type === filter);

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Live Feed
          <span className="text-[10px] text-slate-500 font-normal ml-auto">{filtered.length} events</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {EVENT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-md transition-all",
                filter === t
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >{t}</button>
          ))}
        </div>

        {/* Events list */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No events yet</p>
          ) : (
            filtered.slice(0, 50).map((evt, i) => {
              const EvtIcon = EVENT_ICONS[evt.type] || MessageSquare;
              return (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-700/20 last:border-0">
                  <EvtIcon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0",
                    evt.type === 'ERROR' ? 'text-red-400' :
                    evt.type === 'SAFETY' ? 'text-amber-400' :
                    evt.type === 'ACT' ? 'text-emerald-400' :
                    evt.type === 'THINK' ? 'text-purple-400' :
                    evt.type === 'ADAPT' ? 'text-cyan-400' :
                    'text-slate-500'
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">
                        {evt.time ? new Date(evt.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </span>
                      <span className="text-[11px] font-medium text-slate-200 truncate">{evt.title}</span>
                    </div>
                    {evt.detail && (
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{evt.detail}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};


// ──────────────────────────────────────────────────────────────────────────────
// THOUGHT LOG PANEL
// ──────────────────────────────────────────────────────────────────────────────

const ThoughtLogPanel = ({ agentStatus }) => {
  const [thoughts, setThoughts] = useState([]);

  useEffect(() => {
    const fetchThoughts = async () => {
      try {
        const res = await fetchWithAuth(`/ai-agent/thought-log?user_id=default&limit=10`);
        const data = await res.json();
        if (data.success) setThoughts(data.data.thoughts || []);
      } catch (err) { console.error(err); }
    };
    fetchThoughts();
  }, []);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      <Card className="bg-slate-800/60 border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            Full Thought Log (LLM Reasoning Chains)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {thoughts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No thought logs yet</p>
            ) : (
              thoughts.map((t, i) => (
                <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] text-slate-400">Cycle #{t.cycle}</span>
                    <span className="text-[10px] text-slate-500">{t.time ? new Date(t.time).toLocaleTimeString('en-IN') : ''}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{t.decision?.reasoning}</p>
                  {t.decision?.scenarios_considered?.map((s, j) => (
                    <div key={j} className="text-[10px] text-slate-500 ml-2">• {s}</div>
                  ))}
                  {t.snapshot && (
                    <div className="mt-2 text-[10px] text-slate-600">
                      Spot: {t.snapshot.spot_price} | Trend: {t.snapshot.trend} | VIX: {t.snapshot.vix}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};


// ──────────────────────────────────────────────────────────────────────────────
// EVOLVED PARAMS
// ──────────────────────────────────────────────────────────────────────────────

const EvolvedParamsCard = ({ params, performance }) => {
  if (!params) return null;

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <RotateCw className="w-4 h-4 text-cyan-400" />
          Self-Evolved Parameters
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">ADAPTIVE</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Confidence Threshold</div>
            <div className="text-lg font-bold text-purple-400">{params.confidence_threshold?.toFixed(0)}%</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Vol Comfort</div>
            <div className="text-lg font-bold text-amber-400 capitalize">{params.volatility_comfort || 'medium'}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Time Preference</div>
            <div className="text-lg font-bold text-blue-400 capitalize">{params.time_preference || 'any'}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Drawdown</div>
            <div className="text-lg font-bold text-red-400">{formatINR(performance?.drawdown || 0)}</div>
          </div>
        </div>

        {/* Strategy Performance */}
        {performance?.strategy_stats && Object.keys(performance.strategy_stats).length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strategy Performance</p>
            <div className="space-y-1.5">
              {Object.entries(performance.strategy_stats).map(([strat, stats]) => {
                const wr = stats.trades > 0 ? (stats.wins / stats.trades * 100) : 0;
                const info = STRATEGY_INFO[strat] || { icon: '📊', name: strat };
                return (
                  <div key={strat} className="flex items-center gap-3 text-xs">
                    <span className="w-5 text-center">{info.icon}</span>
                    <span className="text-slate-300 flex-1">{info.name}</span>
                    <span className="text-slate-500">{stats.trades} trades</span>
                    <span className={cn("font-medium w-12 text-right", wr >= 50 ? "text-emerald-400" : "text-red-400")}>
                      {wr.toFixed(0)}% WR
                    </span>
                    <span className={cn("font-medium w-16 text-right", stats.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {formatINR(stats.pnl)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


// ──────────────────────────────────────────────────────────────────────────────
// IDLE / LANDING VIEW
// ──────────────────────────────────────────────────────────────────────────────

const IdleView = ({ onLaunch }) => (
  <div className="space-y-6">
    {/* Hero */}
    <Card className="bg-gradient-to-br from-purple-900/30 via-slate-800/60 to-pink-900/20 border-purple-500/20 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      <CardContent className="p-8 relative">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">
              Autonomous AI Trading Agent
            </h2>
            <p className="text-slate-400 text-sm max-w-lg mb-4">
              A self-thinking, self-adjusting AI agent that autonomously analyzes markets, 
              selects strategies, executes trades, and learns from outcomes. Powered by Claude AI.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                '🧠 Claude AI Brain', '📊 Multi-Strategy', '🔄 Self-Adapting',
                '🛡️ Risk Management', '⚡ Real-Time', '📈 Performance Tracking'
              ].map((tag, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/30">
                  {tag}
                </span>
              ))}
            </div>
            <Button
              onClick={onLaunch}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 shadow-lg shadow-purple-500/20"
              size="lg"
            >
              <Rocket className="w-4 h-4 mr-2" /> Launch AI Agent
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* How It Works */}
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { icon: Eye, title: 'OBSERVE', desc: 'Scans spot, VIX, OI, technicals', color: 'blue' },
        { icon: Brain, title: 'THINK', desc: 'Claude AI reasons through scenarios', color: 'purple' },
        { icon: Lightbulb, title: 'DECIDE', desc: 'Picks optimal strategy & params', color: 'amber' },
        { icon: Zap, title: 'ACT', desc: 'Places/adjusts/exits trades', color: 'emerald' },
        { icon: Sparkles, title: 'REFLECT', desc: 'Analyzes outcomes & learns', color: 'cyan' },
        { icon: RotateCw, title: 'ADAPT', desc: 'Self-modifies for better results', color: 'pink' },
      ].map((step, i) => (
        <Card key={i} className="bg-slate-800/40 border-slate-700/30 hover:border-slate-600/50 transition-all">
          <CardContent className="p-4 text-center">
            <div className={cn("w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center",
              tw(step.color, 'bg10')
            )}>
              <step.icon className={cn("w-5 h-5", tw(step.color, 'text400'))} />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">{step.title}</h3>
            <p className="text-[10px] text-slate-500">{step.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Available Strategies */}
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Network className="w-4 h-4 text-purple-400" />
          Available Strategies (Agent picks autonomously)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(STRATEGY_INFO).filter(([k]) => k !== 'no_trade').map(([key, info]) => (
            <div key={key} className={cn(
              "p-3 rounded-lg border transition-all",
              `${tw(info.color, 'bg5')} ${tw(info.color, 'border10')}`
            )}>
              <span className="text-lg mr-2">{info.icon}</span>
              <span className="text-xs font-medium text-white">{info.name}</span>
              <p className="text-[10px] text-slate-500 mt-1">{info.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);


export default AIAgent;

