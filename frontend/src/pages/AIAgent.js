/**
 * AI Agent Page - Autonomous Self-Thinking Trading Agent
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Brain, Play, Square, Pause, Rocket,
  TrendingUp, Target, Gauge
} from 'lucide-react';
import { PageLayout } from '../components/PageLayout';
import { Button, Badge, Spinner } from '../components/ui';
import { formatINR } from '../lib/utils';
import { toast } from '../hooks/use-toast';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { fetchWithAuth } from '../config/api';

// Get current user ID from localStorage
const getUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    return user.id || user.email || 'default';
  } catch { return 'default'; }
};

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

// Map color names to hex values for dynamic state styling
const COLOR_HEX = {
  green: '#22c55e', red: '#ef4444', blue: '#3b82f6',
  yellow: '#eab308', amber: '#f59e0b', emerald: '#10b981',
  purple: '#a855f7', cyan: '#06b6d4', pink: '#ec4899',
  slate: '#64748b', gray: '#6b7280',
};
const getHex = (name) => COLOR_HEX[name] || COLOR_HEX.gray;

const POLL_ACTIVE = 3000;   // 3s when agent is running
const POLL_IDLE = 30000;    // 30s when idle/stopped

const AIAgent = () => {
  const [agentStatus, setAgentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const [eventFilter, setEventFilter] = useState('ALL');
  const pollRef = useRef(null);
  const theme = useTheme();

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

  // Determine current poll interval based on agent state
  const getInterval = useCallback(() => {
    const active = agentStatus?.active;
    return active ? POLL_ACTIVE : POLL_IDLE;
  }, [agentStatus?.active]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/ai-agent/status?user_id=${getUserId()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        body: JSON.stringify({ user_id: getUserId(), ...config }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentStatus(data.data);
        setShowConfig(false);
        toast({ title: 'Agent Launched', description: 'Autonomous trading agent is now running.', variant: 'default' });
      } else {
        toast({ title: 'Start Failed', description: data.message || 'Could not start agent.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Start error:', err);
      toast({ title: 'Start Error', description: err.message || 'Network error starting agent.', variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  };

  const stopAgent = async () => {
    setStopping(true);
    try {
      const res = await fetchWithAuth(`/ai-agent/stop?user_id=${getUserId()}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAgentStatus(prev => ({ ...prev, ...data.data, state: 'stopped', active: false }));
        toast({ title: 'Agent Stopped', description: 'All positions closed. Final report available.', variant: 'default' });
      } else {
        toast({ title: 'Stop Failed', description: data.message || 'Could not stop agent.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Stop error:', err);
      toast({ title: 'Stop Error', description: err.message || 'Network error stopping agent.', variant: 'destructive' });
    } finally {
      setStopping(false);
    }
  };

  const pauseAgent = async () => {
    try {
      const res = await fetchWithAuth(`/ai-agent/pause?user_id=${getUserId()}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
        toast({ title: 'Agent Paused', description: 'Monitoring continues, no new trades.', variant: 'default' });
      } else {
        toast({ title: 'Pause Failed', description: data.message || 'Could not pause.', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Pause Error', description: err.message || 'Network error.', variant: 'destructive' });
    }
  };

  const resumeAgent = async () => {
    try {
      const res = await fetchWithAuth(`/ai-agent/resume?user_id=${getUserId()}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
        toast({ title: 'Agent Resumed', description: 'Trading operations resumed.', variant: 'default' });
      } else {
        toast({ title: 'Resume Failed', description: data.message || 'Could not resume.', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Resume Error', description: err.message || 'Network error.', variant: 'destructive' });
    }
  };

  // Smart polling: fast when active, slow when idle
  useEffect(() => {
    fetchStatus();

    const interval = getInterval();
    pollRef.current = setInterval(() => {
      if (!document.hidden) fetchStatus();
    }, interval);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchStatus, getInterval]);

  const isActive = agentStatus?.active || false;
  const state = agentStatus?.state || 'idle';
  const stateConf = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const stateColor = getHex(stateConf.color);

  if (loading) {
    return (
      <PageLayout>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Brain
              style={{
                width: 48,
                height: 48,
                color: '#a855f7',
                display: 'block',
                margin: '0 auto 16px',
              }}
            />
            <Typography color="text.secondary">Initializing AI Agent...</Typography>
          </Box>
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/ai-agent')} path="/ai-agent" />

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ position: 'relative' }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(to bottom right, ${alpha('#a855f7', 0.2)}, ${alpha('#ec4899', 0.2)})`,
                  border: 1,
                  borderColor: alpha('#a855f7', 0.3),
                }}
              >
                <Brain style={{ width: 24, height: 24, color: '#c084fc' }} />
              </Box>
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    bgcolor: 'success.main',
                    borderRadius: '50%',
                    border: 2,
                    borderColor: 'background.default',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                    animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                  }}
                />
              )}
            </Box>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6" fontWeight={700} color="text.primary">
                  AI Trading Agent
                </Typography>
                <Chip
                  label="AUTONOMOUS"
                  size="small"
                  sx={{
                    background: 'linear-gradient(to right, #a855f7, #ec4899)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    height: 20,
                    border: 0,
                  }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Self-thinking · Self-adjusting · Multi-strategy
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5}>
            {/* State indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 10,
                fontSize: '0.875rem',
                fontWeight: 500,
                bgcolor: alpha(stateColor, 0.1),
                color: stateColor,
                border: 1,
                borderColor: alpha(stateColor, 0.2),
              }}
            >
              {stateConf.pulse && (
                <Box sx={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      bgcolor: stateColor,
                      opacity: 0.75,
                      '@keyframes ping': {
                        '75%, 100%': { transform: 'scale(2)', opacity: 0 },
                      },
                      animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      bgcolor: stateColor,
                    }}
                  />
                </Box>
              )}
              <stateConf.icon style={{ width: 16, height: 16 }} />
              {stateConf.label}
            </Box>

            {/* Action buttons */}
            {!isActive ? (
              <Button
                onClick={() => setShowConfig(true)}
                disabled={starting}
                sx={{
                  background: 'linear-gradient(to right, #9333ea, #db2777)',
                  color: '#fff',
                  border: 0,
                  '&:hover': { background: 'linear-gradient(to right, #a855f7, #ec4899)' },
                }}
              >
                {starting ? <Spinner sx={{ mr: 1 }} /> : <Rocket style={{ width: 16, height: 16, marginRight: 8 }} />}
                {starting ? 'Starting...' : 'Launch Agent'}
              </Button>
            ) : (
              <Stack direction="row" spacing={1}>
                {state === 'paused' ? (
                  <Button
                    onClick={resumeAgent}
                    size="sm"
                    sx={{ bgcolor: 'success.main', color: '#fff', border: 0, '&:hover': { bgcolor: 'success.dark' } }}
                  >
                    <Play style={{ width: 16, height: 16, marginRight: 4 }} /> Resume
                  </Button>
                ) : (
                  <Button
                    onClick={pauseAgent}
                    size="sm"
                    sx={{ bgcolor: 'warning.main', color: '#fff', border: 0, '&:hover': { bgcolor: 'warning.dark' } }}
                  >
                    <Pause style={{ width: 16, height: 16, marginRight: 4 }} /> Pause
                  </Button>
                )}
                <Button
                  onClick={stopAgent}
                  disabled={stopping}
                  size="sm"
                  sx={{ bgcolor: 'error.main', color: '#fff', border: 0, '&:hover': { bgcolor: 'error.dark' } }}
                >
                  {stopping ? <Spinner sx={{ mr: 0.5 }} /> : <Square style={{ width: 16, height: 16, marginRight: 4 }} />} Stop
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </Box>

      <AnimatePresence>
        {showConfig && <ConfigPanel key="config-panel" config={config} setConfig={setConfig} onStart={startAgent} onClose={() => setShowConfig(false)} starting={starting} />}
      </AnimatePresence>

      {isActive || agentStatus?.cycle_count > 0 ? (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <StatCard title="Daily P&L" value={formatINR(agentStatus?.performance?.daily_pnl || 0)} icon={TrendingUp} color={(agentStatus?.performance?.daily_pnl || 0) >= 0 ? 'emerald' : 'red'} subtitle={`${agentStatus?.performance?.total_trades || 0} trades today`} />
            <StatCard title="Win Rate" value={`${agentStatus?.performance?.win_rate || 0}%`} icon={Target} color="blue" subtitle={`${agentStatus?.performance?.winning_trades || 0}W / ${agentStatus?.performance?.losing_trades || 0}L`} />
            <StatCard title="Confidence" value={`${agentStatus?.evolved_params?.confidence_threshold?.toFixed(0) || 65}%`} icon={Brain} color="purple" subtitle={`Cycle #${agentStatus?.cycle_count || 0}`} />
            <StatCard title="Positions" value={agentStatus?.active_positions?.length || 0} icon={Gauge} color="amber" subtitle={`Max: ${agentStatus?.config?.max_positions || 3}`} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}>
            <Stack spacing={2}>
              <LatestDecision decision={agentStatus?.last_decision} snapshot={agentStatus?.market_snapshot} />
              <PositionsPanel positions={agentStatus?.active_positions || []} />
              <DecisionHistory decisions={agentStatus?.recent_decisions || []} onShowThoughts={() => setShowThoughts(!showThoughts)} />
            </Stack>
            <Stack spacing={2}>
              <MarketSnapshotCard snapshot={agentStatus?.market_snapshot} />
              <EventFeed events={agentStatus?.event_feed || []} filter={eventFilter} setFilter={setEventFilter} />
            </Stack>
          </Box>

          <AnimatePresence>{showThoughts && <ThoughtLogPanel key="thought-log" agentStatus={agentStatus} />}</AnimatePresence>
          <EvolvedParamsCard params={agentStatus?.evolved_params} performance={agentStatus?.performance} />
        </Stack>
      ) : (
        <IdleView onLaunch={() => setShowConfig(true)} />
      )}
    </PageLayout>
  );
};

export default AIAgent;
