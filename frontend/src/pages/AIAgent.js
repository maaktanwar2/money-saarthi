/**
 * AI Agent Page - Autonomous Self-Thinking Trading Agent
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { tw } from '../lib/colorMap';
import {
  Brain, Play, Square, Pause, Rocket,
  TrendingUp, Target, Gauge
} from 'lucide-react';
import { PageLayout } from '../components/PageLayout';
import { Button, Badge, Spinner } from '../components/ui';
import { cn, formatINR } from '../lib/utils';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { fetchWithAuth } from '../config/api';

// Sub-components
import { STATE_CONFIG } from '../components/ai-agent/constants';
import StatCard from '../components/ai-agent/StatCard';
import ConfigPanel from '../components/ai-agent/ConfigPanel';
import LatestDecision from '../components/ai-agent/LatestDecision';
import PositionsPanel from '../components/ai-agent/PositionsPanel';
import DecisionHistory from '../components/ai-agent/DecisionHistory';
import MarketSnapshotCard from '../components/ai-agent/MarketSnapshotCard';
import EventFeed from '../components/ai-agent/EventFeed';
import ThoughtLogPanel from '../components/ai-agent/ThoughtLogPanel';
import EvolvedParamsCard from '../components/ai-agent/EvolvedParamsCard';
import IdleView from '../components/ai-agent/IdleView';

const POLL_INTERVAL = 3000;

const AIAgent = () => {
  const [agentStatus, setAgentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const [eventFilter, setEventFilter] = useState('ALL');
  const pollRef = useRef(null);

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

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/ai-agent/status?user_id=default`);
      const data = await res.json();
      if (data.success) setAgentStatus(data.data);
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
      if (data.success) { setAgentStatus(data.data); setShowConfig(false); }
    } catch (err) { console.error('Start error:', err); }
    finally { setStarting(false); }
  };

  const stopAgent = async () => {
    setStopping(true);
    try {
      const res = await fetchWithAuth(`/ai-agent/stop?user_id=default`, { method: 'POST' });
      const data = await res.json();
      if (data.success) setAgentStatus(prev => ({ ...prev, state: 'stopped', active: false }));
    } catch (err) { console.error('Stop error:', err); }
    finally { setStopping(false); }
  };

  const pauseAgent = async () => {
    try { await fetchWithAuth(`/ai-agent/pause?user_id=default`, { method: 'POST' }); fetchStatus(); }
    catch (err) { console.error(err); }
  };

  const resumeAgent = async () => {
    try { await fetchWithAuth(`/ai-agent/resume?user_id=default`, { method: 'POST' }); fetchStatus(); }
    catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(() => { if (!document.hidden) fetchStatus(); }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const isActive = agentStatus?.active || false;
  const state = agentStatus?.state || 'idle';
  const stateConf = STATE_CONFIG[state] || STATE_CONFIG.idle;

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
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", "bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30")}>
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              {isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                AI Trading Agent
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-[10px]">AUTONOMOUS</Badge>
              </h1>
              <p className="text-xs text-slate-400">Self-thinking · Self-adjusting · Multi-strategy</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium", `${tw(stateConf.color, 'bg10')} ${tw(stateConf.color, 'text400')} border ${tw(stateConf.color, 'border20')}`)}>
              {stateConf.pulse && <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tw(stateConf.color, 'bg400')} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${tw(stateConf.color, 'bg500')}`}></span>
              </span>}
              <stateConf.icon className="w-4 h-4" />
              {stateConf.label}
            </div>

            {!isActive ? (
              <Button onClick={() => setShowConfig(true)} disabled={starting} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0">
                {starting ? <Spinner className="w-4 h-4 mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                {starting ? 'Starting...' : 'Launch Agent'}
              </Button>
            ) : (
              <div className="flex gap-2">
                {state === 'paused' ? (
                  <Button onClick={resumeAgent} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0" size="sm"><Play className="w-4 h-4 mr-1" /> Resume</Button>
                ) : (
                  <Button onClick={pauseAgent} className="bg-amber-600 hover:bg-amber-500 text-white border-0" size="sm"><Pause className="w-4 h-4 mr-1" /> Pause</Button>
                )}
                <Button onClick={stopAgent} disabled={stopping} className="bg-red-600 hover:bg-red-500 text-white border-0" size="sm">
                  {stopping ? <Spinner className="w-4 h-4 mr-1" /> : <Square className="w-4 h-4 mr-1" />} Stop
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showConfig && <ConfigPanel config={config} setConfig={setConfig} onStart={startAgent} onClose={() => setShowConfig(false)} starting={starting} />}
      </AnimatePresence>

      {isActive || agentStatus?.cycle_count > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Daily P&L" value={formatINR(agentStatus?.performance?.daily_pnl || 0)} icon={TrendingUp} color={(agentStatus?.performance?.daily_pnl || 0) >= 0 ? 'emerald' : 'red'} subtitle={`${agentStatus?.performance?.total_trades || 0} trades today`} />
            <StatCard title="Win Rate" value={`${agentStatus?.performance?.win_rate || 0}%`} icon={Target} color="blue" subtitle={`${agentStatus?.performance?.winning_trades || 0}W / ${agentStatus?.performance?.losing_trades || 0}L`} />
            <StatCard title="Confidence" value={`${agentStatus?.evolved_params?.confidence_threshold?.toFixed(0) || 65}%`} icon={Brain} color="purple" subtitle={`Cycle #${agentStatus?.cycle_count || 0}`} />
            <StatCard title="Positions" value={agentStatus?.active_positions?.length || 0} icon={Gauge} color="amber" subtitle={`Max: ${agentStatus?.config?.max_positions || 3}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <LatestDecision decision={agentStatus?.last_decision} snapshot={agentStatus?.market_snapshot} />
              <PositionsPanel positions={agentStatus?.active_positions || []} />
              <DecisionHistory decisions={agentStatus?.recent_decisions || []} onShowThoughts={() => setShowThoughts(!showThoughts)} />
            </div>
            <div className="space-y-4">
              <MarketSnapshotCard snapshot={agentStatus?.market_snapshot} />
              <EventFeed events={agentStatus?.event_feed || []} filter={eventFilter} setFilter={setEventFilter} />
            </div>
          </div>

          <AnimatePresence>{showThoughts && <ThoughtLogPanel agentStatus={agentStatus} />}</AnimatePresence>
          <EvolvedParamsCard params={agentStatus?.evolved_params} performance={agentStatus?.performance} />
        </div>
      ) : (
        <IdleView onLaunch={() => setShowConfig(true)} />
      )}
    </PageLayout>
  );
};

export default AIAgent;
