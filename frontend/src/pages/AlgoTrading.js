/**
 * Algo Trading Page - AI-Powered Trading Bots
 * Clean, modern design with live trading functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Bot, Play, Square, Settings, TrendingUp, TrendingDown,
  Activity, Target, Shield, Zap, BarChart3, Brain,
  AlertCircle, CheckCircle2, Clock,
  RefreshCw, ChevronRight, ChevronDown,
  Wallet, Link, Unlink, ArrowUpRight,
  ArrowDownRight, Sparkles, Crown, Info, Coins
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Input, Spinner
} from '../components/ui';
import { formatINR, fetchAPI } from '../lib/utils';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { API_BASE_URL, fetchWithAuth } from '../config/api';
import { toast } from '../hooks/use-toast';
import { useConfirm } from '../hooks/useConfirm';
import { getTokenBalance, checkCanUseTokens } from '../services/tokenService';
import PnLChart from '../components/algo/PnLChart';
import RiskAnalytics from '../components/algo/RiskAnalytics';
import StrategyShowcase from '../components/algo/StrategyShowcase';
import ActivityFeed from '../components/algo/ActivityFeed';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL = 5000; // 5 seconds

const BOT_CONFIGS = {
  vwap: {
    id: 'vwap',
    name: 'VWAP Momentum Bot',
    description: 'Auto-trades stocks showing strong momentum signals above/below VWAP',
    icon: TrendingUp,
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    color: 'blue',
    features: ['Momentum Detection', 'Auto Position Sizing', 'Trailing Stop Loss'],
    riskLevel: 'Medium',
    winRate: '68%*',
    avgReturn: '+2.1%*',
    disclaimer: '*Based on backtested data. Past performance \u2260 future results.',
    tokenAction: 'bot_start',
    tokenCost: 15,
  },
  strangle: {
    id: 'strangle',
    name: 'QuantStrangle AI Bot',
    description: 'Claude-powered delta-neutral strangle with 15\u03B4 entry & 30\u03B4 adjustments',
    icon: Brain,
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    color: 'purple',
    features: ['Claude 4.5 AI', '15-Delta Entry', 'Auto Adjustments at 30\u03B4'],
    riskLevel: 'Medium-High',
    winRate: '72%*',
    avgReturn: '+1.8%*',
    disclaimer: '*Based on backtested data. Past performance \u2260 future results.',
    isPremium: true,
    tokenAction: 'bot_start_ai_hedging',
    tokenCost: 60,
  },
  delta: {
    id: 'delta',
    name: 'Delta Neutral Bot',
    description: 'Iron Condor, Butterfly & Strangle strategies with auto-adjustments \u2014 choose your risk profile',
    icon: Shield,
    gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
    color: 'emerald',
    features: ['4 Strategy Modes', 'Defined Risk Options', 'Daily & Weekly', 'Auto Adjustments', 'Trailing Profit'],
    riskLevel: 'Low-Medium',
    winRate: '78%*',
    avgReturn: '+2-4%*',
    disclaimer: '*Based on backtested data. Past performance \u2260 future results.',
    tokenAction: 'bot_start_hedging',
    tokenCost: 40,
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const AlgoTrading = () => {
  const navigate = useNavigate();
  const [ConfirmEl, confirm] = useConfirm();
  const theme = useTheme();
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────

  // Broker Connection
  const [brokerConnected, setBrokerConnected] = useState(false);
  const [brokerToken, setBrokerToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [connectingBroker, setConnectingBroker] = useState(false);
  const [brokerInfo, setBrokerInfo] = useState(null);
  const [selectedBroker, setSelectedBroker] = useState('dhan'); // 'dhan' or 'upstox'

  // Bot States
  const [vwapBot, setVwapBot] = useState({ running: false, loading: false, status: null });
  const [strangleBot, setStrangleBot] = useState({ running: false, loading: false, status: null });
  const [deltaBot, setDeltaBot] = useState({ running: false, loading: false, status: null });

  // Bot Configurations
  const [vwapConfig, setVwapConfig] = useState({
    capital: 100000,
    riskPerTrade: 1,
    maxPositions: 3,
    targetPercent: 2,
    stopLossPercent: 1,
    trailingStopPercent: 0.5
  });

  const [strangleConfig, setStrangleConfig] = useState({
    underlying: 'NIFTY',
    numLots: 1,
    entryDelta: 15,
    adjustmentDelta: 30,
    rollTargetDelta: 15,
    profitTargetPct: 50,
    maxLossMultiplier: 2,
    useAI: true,
    aiConfidenceThreshold: 70,
    maxAdjustmentsPerDay: 3,
    entryTime: '09:30',
    exitTime: '15:15'
  });

  const [deltaConfig, setDeltaConfig] = useState({
    underlying: 'NIFTY',
    lotSize: 65,
    maxDeltaDrift: 0.1,
    hedgeThreshold: 0.05,
    // ─── Strategy & Timeframe ───
    strategyMode: 'iron_condor',    // iron_condor | iron_butterfly | short_strangle | straddle_hedge
    timeframe: 'weekly',            // intraday | weekly | smart
    entryDelta: 16,
    wingWidth: 200,
    profitTargetPct: 50,
    trailingProfit: true,
    ivEntryMin: 25,
    maxAdjustmentsPerDay: 3,
  });

  // UI State
  const [expandedBot, setExpandedBot] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [todayPnL, setTodayPnL] = useState(0);
  const [activePositions, setActivePositions] = useState(0);

  // Token State
  const [tokenBalance, setTokenBalance] = useState(0);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // P&L Chart State
  const [pnlHistory, setPnlHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ms_pnl_history') || '[]');
    } catch { return []; }
  });

  // Activity Feed State
  const [activityEvents, setActivityEvents] = useState([]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK BROKER CONNECTION ON MOUNT
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const savedToken = sessionStorage.getItem('ms_broker_token') || localStorage.getItem('ms_broker_token');
    const savedBroker = localStorage.getItem('ms_connected_broker');
    const savedClientId = localStorage.getItem('ms_client_id');
    const savedSandbox = localStorage.getItem('ms_is_sandbox') === 'true';

    // Migrate from localStorage to sessionStorage if needed
    if (localStorage.getItem('ms_broker_token')) {
      sessionStorage.setItem('ms_broker_token', localStorage.getItem('ms_broker_token'));
      localStorage.removeItem('ms_broker_token');
    }

    if (savedToken && savedBroker) {
      setBrokerToken(savedToken);
      setClientId(savedClientId || '');
      setIsSandbox(savedSandbox);
      setBrokerConnected(true);
      setBrokerInfo({ broker: savedBroker, sandbox: savedSandbox });
      setSelectedBroker(savedBroker);
    }

    // Load token balance
    const loadBalance = async () => {
      try {
        const res = await getTokenBalance();
        setTokenBalance(res.balance || 0);
        setIsAdminUser(res.is_admin || res.unlimited || false);
      } catch (e) { /* ignore */ }
    };
    loadBalance();
  }, []);

  // Check if user has enough tokens (pre-flight, no deduction)
  const checkBotTokens = async (cost = 15) => {
    if (isAdminUser) return true;
    try {
      const res = await getTokenBalance();
      const balance = res.balance || 0;
      setTokenBalance(balance);
      if (balance < cost) {
        toast({ title: 'Insufficient Tokens', description: `You need ${cost} tokens to start this bot. Current balance: ${balance}. Go to Profile \u2192 AI Tokens to recharge.`, variant: 'destructive' });
        return false;
      }
      return true;
    } catch (e) {
      toast({ title: 'Token Check Failed', description: 'Could not verify token balance. Please check your connection and try again.', variant: 'destructive' });
      return false;
    }
  };

  // Deduct tokens AFTER successful bot start
  const deductBotTokens = async (action = 'bot_start') => {
    if (isAdminUser) return;
    try {
      const userId = JSON.parse(localStorage.getItem('ms_user') || '{}').email || 'anonymous';
      const res = await fetchAPI('/ai/tokens/use', {
        method: 'POST',
        headers: { 'X-User-Id': userId },
        body: JSON.stringify({ action })
      });
      if (res.success) setTokenBalance(res.remaining_balance);
    } catch (e) {
      console.error('Token deduction failed:', e);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // BROKER CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────

  const connectBroker = async () => {
    if (!brokerToken.trim()) {
      toast({ title: 'Error', description: `Please enter your ${selectedBroker === 'upstox' ? 'Upstox' : 'Dhan'} access token`, variant: 'destructive' });
      return;
    }

    // Sandbox only applies to Dhan
    if (selectedBroker === 'dhan' && isSandbox && !clientId.trim()) {
      toast({ title: 'Error', description: 'Please enter your Sandbox Client ID', variant: 'destructive' });
      return;
    }

    setConnectingBroker(true);
    const requestBody = {
      access_token: brokerToken,
      client_id: (selectedBroker === 'dhan' && isSandbox) ? clientId : undefined,
      sandbox: selectedBroker === 'dhan' ? isSandbox : false
    };

    // Use the appropriate validation endpoint based on selected broker
    const validatePath = selectedBroker === 'upstox'
      ? '/upstox/validate-token'
      : '/dhan/validate-token';

    try {
      const response = await fetchWithAuth(validatePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.valid) {
        sessionStorage.setItem('ms_broker_token', brokerToken);
        localStorage.setItem('ms_connected_broker', selectedBroker);
        localStorage.setItem('ms_client_id', clientId || data.client_id || '');
        localStorage.setItem('ms_is_sandbox', (selectedBroker === 'dhan' && isSandbox) ? 'true' : 'false');
        setBrokerConnected(true);
        setBrokerInfo({ broker: selectedBroker, sandbox: selectedBroker === 'dhan' && isSandbox, ...data });
        setShowTokenInput(false);
        const brokerName = selectedBroker === 'upstox' ? 'Upstox' : 'Dhan';
        toast({
          title: 'Connected',
          description: (selectedBroker === 'dhan' && isSandbox) ? 'Sandbox mode connected!' : `${brokerName} connected successfully!`
        });
        fetchBotStatuses();
      } else {
        toast({ title: 'Invalid Token', description: data.error || 'Token validation failed', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({ title: 'Connection Failed', description: error.message, variant: 'destructive' });
    }
    setConnectingBroker(false);
  };

  const disconnectBroker = () => {
    sessionStorage.removeItem('ms_broker_token');
    localStorage.removeItem('ms_connected_broker');
    localStorage.removeItem('ms_client_id');
    localStorage.removeItem('ms_is_sandbox');
    setBrokerConnected(false);
    setBrokerToken('');
    setClientId('');
    setIsSandbox(false);
    setBrokerInfo(null);
    setSelectedBroker('dhan'); // Reset to default
    setVwapBot({ running: false, loading: false, status: null });
    setStrangleBot({ running: false, loading: false, status: null });
    setDeltaBot({ running: false, loading: false, status: null });
    toast({ title: 'Disconnected', description: 'Broker disconnected' });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH BOT STATUSES
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchBotStatuses = useCallback(async () => {
    if (!brokerConnected) return;

    let vwapData = {};
    let strangleData = {};
    let deltaData = {};

    try {
      // Parallel fetch all bot statuses
      const [vwapRes, strangleRes, deltaRes] = await Promise.allSettled([
        fetchWithAuth('/trade-algo/vwap-bot/status'),
        fetchWithAuth('/trade-algo/ai-delta-strangle/status'),
        fetchWithAuth('/trade-algo/delta-neutral/status'),
      ]);

      if (vwapRes.status === 'fulfilled' && vwapRes.value.ok) {
        vwapData = await vwapRes.value.json();
        setVwapBot(prev => ({ ...prev, running: vwapData.status === 'running', status: vwapData }));
      }

      if (strangleRes.status === 'fulfilled' && strangleRes.value.ok) {
        strangleData = await strangleRes.value.json();
        setStrangleBot(prev => ({
          ...prev,
          running: strangleData.bot_status === 'running' || strangleData.status === 'active',
          status: strangleData
        }));
      }

      if (deltaRes.status === 'fulfilled' && deltaRes.value.ok) {
        deltaData = await deltaRes.value.json();
        setDeltaBot(prev => ({
          ...prev,
          running: deltaData.is_running || deltaData.running || deltaData.status === 'active',
          status: deltaData
        }));
      }

      // Update aggregate stats
      const allPositions = (vwapData.positions?.length || 0) +
                          (strangleData.positions?.length || 0) +
                          (deltaData.positions?.length || 0);
      setActivePositions(allPositions);

      const allTrades = [
        ...(vwapData.trades || []),
        ...(strangleData.trade_history || []),
        ...(deltaData.trades || [])
      ].sort((a, b) => new Date(b.timestamp || b.time) - new Date(a.timestamp || a.time));
      setTradeHistory(allTrades.slice(0, 20));

      // Calculate P&L
      const total = (vwapData.total_pnl || 0) +
                   (strangleData.total_pnl || 0) +
                   (deltaData.total_pnl || 0);
      setTotalPnL(total);

      const today = (vwapData.today_pnl || 0) +
                   (strangleData.today_pnl || 0) +
                   (deltaData.today_pnl || 0);
      setTodayPnL(today);

      // Track P&L history for chart
      const now = new Date();
      const timeLabel = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const newPoint = {
        time: timeLabel,
        pnl: total,
        vwap: vwapData.total_pnl || 0,
        strangle: strangleData.total_pnl || 0,
        delta: deltaData.total_pnl || 0,
      };
      setPnlHistory(prev => {
        const updated = [...prev, newPoint].slice(-100); // Keep last 100 points
        // Persist to localStorage at most every 30 seconds
        if (updated.length % 6 === 0) {
          try { localStorage.setItem('ms_pnl_history', JSON.stringify(updated)); } catch {}
        }
        return updated;
      });

    } catch (error) {
      console.error('Failed to fetch bot statuses:', error);
    }
  }, [brokerConnected]);

  // Poll bot statuses
  useEffect(() => {
    if (brokerConnected) {
      fetchBotStatuses();
      const interval = setInterval(() => { if (!document.hidden) fetchBotStatuses(); }, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [brokerConnected, fetchBotStatuses]);

  // Helper to add activity events
  const addActivityEvent = useCallback((type, message, pnl) => {
    setActivityEvents(prev => [...prev, {
      id: Date.now(),
      type,
      message,
      pnl,
      timestamp: new Date().toISOString(),
    }].slice(-50)); // Keep last 50 events
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // BOT CONTROLS
  // ─────────────────────────────────────────────────────────────────────────────

  // Shared helper — reads broker connection state from storage
  const getBrokerContext = () => {
    const isSandboxMode = localStorage.getItem('ms_is_sandbox') === 'true';
    const connectedBroker = localStorage.getItem('ms_connected_broker') || 'dhan';
    const brokerName = connectedBroker === 'upstox' ? 'Upstox' : 'Dhan';
    const token = sessionStorage.getItem('ms_broker_token');
    const clientIdVal = localStorage.getItem('ms_client_id') || 'default';
    return { isSandboxMode, connectedBroker, brokerName, token, clientIdVal };
  };

  const startVwapBot = async () => {
    const { isSandboxMode, connectedBroker, brokerName, token, clientIdVal } = getBrokerContext();
    const confirmed = await confirm({
      title: `${isSandboxMode ? 'SANDBOX' : 'LIVE'} Trading Confirmation`,
      message: `You are about to start VWAP Momentum Bot${isSandboxMode ? ' in SANDBOX mode' : ' with REAL MONEY'}!\n\n` +
        `Capital: \u20B9${vwapConfig.capital.toLocaleString()} | Risk: ${vwapConfig.riskPerTrade}%\n` +
        `Max Positions: ${vwapConfig.maxPositions} | Target: ${vwapConfig.targetPercent}% | SL: ${vwapConfig.stopLossPercent}%\n\n` +
        `${isSandboxMode ? 'This will simulate trades (no real orders).' : `This will place REAL orders on your ${brokerName} account.`}`,
      confirmText: 'Start Bot',
      variant: isSandboxMode ? 'default' : 'destructive',
    });
    if (!confirmed) return;

    // Pre-flight token check (no deduction yet)
    const hasTokens = await checkBotTokens(BOT_CONFIGS.vwap.tokenCost);
    if (!hasTokens) return;

    setVwapBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetchWithAuth('/trade-algo/vwap-bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_token: token,
          broker: connectedBroker,
          user_id: clientIdVal,
          mock_mode: isSandboxMode,
          scenario: 'random',
          config: {
            capital: vwapConfig.capital,
            risk_per_trade: vwapConfig.riskPerTrade,
            max_positions: vwapConfig.maxPositions,
            target_percent: vwapConfig.targetPercent,
            stop_loss_percent: vwapConfig.stopLossPercent,
            trailing_stop_percent: vwapConfig.trailingStopPercent
          }
        })
      });
      const data = await response.json();
      if (data.status === 'success' || data.status === 'running') {
        setVwapBot(prev => ({ ...prev, running: true }));
        await deductBotTokens(BOT_CONFIGS.vwap.tokenAction);
        toast({ title: 'Bot Started', description: `VWAP Momentum Bot is now active${isSandboxMode ? ' [SANDBOX]' : ''}` });
        addActivityEvent('bot_start', `VWAP Momentum Bot started${isSandboxMode ? ' (Sandbox)' : ''}`);
      } else {
        toast({ title: 'Error', description: data.detail || data.message || 'Failed to start bot', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setVwapBot(prev => ({ ...prev, loading: false }));
  };

  const stopVwapBot = async () => {
    setVwapBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetchWithAuth('/trade-algo/vwap-bot/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.status === 'success' || data.status === 'stopped') {
        setVwapBot(prev => ({ ...prev, running: false }));
        toast({ title: 'Bot Stopped', description: 'VWAP Momentum Bot stopped' });
        addActivityEvent('bot_stop', 'VWAP Momentum Bot stopped');
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setVwapBot(prev => ({ ...prev, loading: false }));
  };

  const startStrangleBot = async () => {
    const { isSandboxMode, connectedBroker, brokerName, token } = getBrokerContext();
    const confirmed = await confirm({
      title: `${isSandboxMode ? 'SANDBOX' : 'LIVE'} Trading Confirmation`,
      message: `You are about to start QuantStrangle AI Bot${isSandboxMode ? ' in SANDBOX mode' : ' with REAL MONEY'}!\n\n` +
        `Strategy: Delta-Neutral Short Strangle\n` +
        `Underlying: ${strangleConfig.underlying} | Lots: ${strangleConfig.numLots} | Entry Delta: ${strangleConfig.entryDelta}\n` +
        `Adjustment Trigger: ${strangleConfig.adjustmentDelta} delta | Profit Target: ${strangleConfig.profitTargetPct}%\n` +
        `Claude AI: ${strangleConfig.useAI ? 'ENABLED' : 'DISABLED'} | Token Cost: 60 tokens\n\n` +
        `${isSandboxMode ? 'This will simulate trades (no real orders).' : `This will place REAL options orders on your ${brokerName} account.`}`,
      confirmText: 'Start Bot',
      variant: isSandboxMode ? 'default' : 'destructive',
    });
    if (!confirmed) return;

    // Pre-flight token check (no deduction yet)
    const hasTokens = await checkBotTokens(BOT_CONFIGS.strangle.tokenCost);
    if (!hasTokens) return;

    setStrangleBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetchWithAuth('/trade-algo/ai-delta-strangle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          broker: connectedBroker,
          underlying: strangleConfig.underlying,
          num_lots: strangleConfig.numLots,
          entry_delta: strangleConfig.entryDelta,
          adjustment_trigger_delta: strangleConfig.adjustmentDelta,
          roll_target_delta: strangleConfig.rollTargetDelta,
          profit_target_pct: strangleConfig.profitTargetPct,
          max_loss_multiplier: strangleConfig.maxLossMultiplier,
          use_ai_decisions: strangleConfig.useAI,
          ai_confidence_threshold: strangleConfig.aiConfidenceThreshold,
          max_adjustments_per_day: strangleConfig.maxAdjustmentsPerDay
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setStrangleBot(prev => ({ ...prev, running: true, status: data }));
        await deductBotTokens(BOT_CONFIGS.strangle.tokenAction);
        toast({ title: 'QuantStrangle AI Started', description: data.message || 'Bot is now monitoring positions' });
        addActivityEvent('bot_start', 'QuantStrangle AI Bot started');
      } else {
        toast({ title: 'Error', description: data.message || data.detail || 'Failed to start bot', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setStrangleBot(prev => ({ ...prev, loading: false }));
  };

  const stopStrangleBot = async () => {
    setStrangleBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetchWithAuth('/trade-algo/ai-delta-strangle/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default', close_positions: true })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setStrangleBot(prev => ({ ...prev, running: false, status: null }));
        toast({ title: 'Bot Stopped', description: 'QuantStrangle AI stopped' });
        addActivityEvent('bot_stop', 'QuantStrangle AI Bot stopped');
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setStrangleBot(prev => ({ ...prev, loading: false }));
  };

  // Scan function for serverless execution
  const scanStrangleBot = async () => {
    try {
      const response = await fetchWithAuth('/trade-algo/ai-delta-strangle/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        toast({ title: 'Scan Failed', description: `Server returned ${response.status}`, variant: 'destructive' });
        return;
      }
      const data = await response.json();
      setStrangleBot(prev => ({ ...prev, status: data }));
      if (data.action_taken) {
        toast({
          title: 'Action Taken',
          description: `${data.action_taken.reason}: ${data.action_taken.trigger || ''}`
        });
      }
      return data;
    } catch (error) {
      console.error('Scan error:', error);
      toast({ title: 'Scan Error', description: error.message, variant: 'destructive' });
    }
  };

  const STRATEGY_LABELS = {
    iron_condor: 'Iron Condor (Defined Risk)',
    iron_butterfly: 'Iron Butterfly (High Premium)',
    short_strangle: 'Short Strangle (Aggressive)',
    straddle_hedge: 'Straddle + Hedge (Max Theta)',
  };

  const TIMEFRAME_LABELS = {
    intraday: '0DTE Intraday',
    weekly: 'Weekly Expiry',
    smart: 'Smart (Auto-select)',
  };

  const startDeltaBot = async () => {
    const { isSandboxMode, connectedBroker, brokerName, token } = getBrokerContext();
    const strategyLabel = STRATEGY_LABELS[deltaConfig.strategyMode] || deltaConfig.strategyMode;
    const timeframeLabel = TIMEFRAME_LABELS[deltaConfig.timeframe] || deltaConfig.timeframe;
    const isDefinedRisk = ['iron_condor', 'iron_butterfly'].includes(deltaConfig.strategyMode);

    const confirmed = await confirm({
      title: `${isSandboxMode ? 'SANDBOX' : 'LIVE'} Trading Confirmation`,
      message: `You are about to start Delta Neutral Bot${isSandboxMode ? ' in SANDBOX mode' : ' with REAL MONEY'}!\n\n` +
        `Strategy: ${strategyLabel} | Timeframe: ${timeframeLabel}\n` +
        `Underlying: ${deltaConfig.underlying} | Entry Delta: ${deltaConfig.entryDelta}\u03B4\n` +
        (isDefinedRisk ? `Wing Protection: ${deltaConfig.wingWidth} pts (capped loss)\n` : 'Unlimited risk \u2014 no wing protection\n') +
        `Profit Target: ${deltaConfig.profitTargetPct}%${deltaConfig.trailingProfit ? ' (trailing)' : ''} | Token Cost: 40 tokens\n\n` +
        `${isSandboxMode ? 'This will simulate trades (no real orders).' : `This will place REAL options orders on your ${brokerName} account.`}`,
      confirmText: 'Start Bot',
      variant: isSandboxMode ? 'default' : 'destructive',
    });
    if (!confirmed) return;

    // Pre-flight token check (no deduction yet)
    const hasTokens = await checkBotTokens(BOT_CONFIGS.delta.tokenCost);
    if (!hasTokens) return;

    setDeltaBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetchWithAuth('/trade-algo/delta-neutral/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          broker: connectedBroker,
          underlying: deltaConfig.underlying,
          lot_size: deltaConfig.lotSize,
          max_delta_drift: deltaConfig.maxDeltaDrift,
          auto_adjust: true,
          adjustment_interval: 60,
          stop_loss_percent: 2.0,
          target_profit_percent: 1.0,
          mock_mode: isSandboxMode,
          // ── New strategy params ──
          strategy_mode: deltaConfig.strategyMode,
          timeframe: deltaConfig.timeframe,
          entry_delta: deltaConfig.entryDelta,
          wing_width: deltaConfig.wingWidth,
          profit_target_pct: deltaConfig.profitTargetPct,
          trailing_profit: deltaConfig.trailingProfit,
          iv_entry_min: deltaConfig.ivEntryMin,
          max_adjustments_per_day: deltaConfig.maxAdjustmentsPerDay,
        })
      });
      const data = await response.json();
      if (data.success || data.status === 'success') {
        setDeltaBot(prev => ({ ...prev, running: true }));
        await deductBotTokens(BOT_CONFIGS.delta.tokenAction);
        toast({ title: 'Bot Started', description: data.message || `${strategyLabel} bot is now active` });
        addActivityEvent('bot_start', `Delta Neutral (${strategyLabel}) Bot started`);
      } else {
        toast({ title: 'Error', description: data.error || data.message || data.detail || 'Failed to start bot', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setDeltaBot(prev => ({ ...prev, loading: false }));
  };

  const stopDeltaBot = async () => {
    setDeltaBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetchWithAuth('/trade-algo/delta-neutral/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default' })
      });
      const data = await response.json();
      if (data.success || data.status === 'success') {
        setDeltaBot(prev => ({ ...prev, running: false }));
        toast({ title: 'Bot Stopped', description: 'Delta Neutral Bot stopped' });
        addActivityEvent('bot_stop', 'Delta Neutral Bot stopped');
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setDeltaBot(prev => ({ ...prev, loading: false }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - BROKER CONNECTION CARD
  // ─────────────────────────────────────────────────────────────────────────────

  const renderBrokerConnection = () => (
    <Card sx={{
      border: 2,
      borderColor: alpha(theme.palette.primary.main, 0.2),
      background: `linear-gradient(to bottom right, ${alpha(theme.palette.primary.main, 0.05)}, transparent)`,
    }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: brokerConnected
                ? alpha(theme.palette.success.main, 0.2)
                : alpha(theme.palette.warning.main, 0.2),
            }}>
              {brokerConnected
                ? <Link style={{ width: 28, height: 28, color: theme.palette.success.main }} />
                : <Unlink style={{ width: 28, height: 28, color: theme.palette.warning.main }} />
              }
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {brokerConnected ? 'Broker Connected' : 'Connect Broker'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {brokerConnected
                  ? `Connected to ${brokerInfo?.broker === 'upstox' ? 'Upstox' : 'Dhan'}${brokerInfo?.sandbox ? ' (Sandbox)' : ''} \u2022 ${brokerInfo?.sandbox ? 'Test' : 'Live'} trading enabled`
                  : 'Connect your broker account to start live trading'
                }
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5}>
            {brokerConnected ? (
              <>
                {brokerInfo?.available_balance !== undefined && (
                  <Badge variant="outline" sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                    borderColor: alpha(theme.palette.info.main, 0.3),
                    fontFamily: 'monospace',
                  }}>
                    {'\u20B9'}{Number(brokerInfo.available_balance).toLocaleString('en-IN')}
                  </Badge>
                )}
                <Badge variant="outline" sx={brokerInfo?.sandbox
                  ? { bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main, borderColor: alpha(theme.palette.warning.main, 0.3) }
                  : { bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main, borderColor: alpha(theme.palette.success.main, 0.3) }
                }>
                  <CheckCircle2 style={{ width: 12, height: 12, marginRight: 4 }} /> {brokerInfo?.sandbox ? 'Sandbox' : 'Live'}
                </Badge>
                <Button variant="outline" size="sm" onClick={disconnectBroker}>
                  <Unlink style={{ width: 16, height: 16, marginRight: 8 }} /> Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowTokenInput(!showTokenInput)}>
                <Link style={{ width: 16, height: 16, marginRight: 8 }} /> Connect Broker
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Token Input */}
        <AnimatePresence>
          {showTokenInput && !brokerConnected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                {/* Broker Selector */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight={500}>Select Broker:</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant={selectedBroker === 'dhan' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedBroker('dhan')}
                      sx={selectedBroker === 'dhan' ? { bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } } : {}}
                    >
                      Dhan
                    </Button>
                    <Button
                      variant={selectedBroker === 'upstox' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedBroker('upstox')}
                      sx={selectedBroker === 'upstox' ? { bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } } : {}}
                    >
                      Upstox
                    </Button>
                  </Stack>
                </Stack>

                {/* Sandbox Toggle (Dhan only) */}
                {selectedBroker === 'dhan' && (
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'pointer' }}>
                      <Checkbox
                        checked={isSandbox}
                        onChange={(e) => setIsSandbox(e.target.checked)}
                        size="small"
                        sx={{
                          p: 0.5,
                          color: alpha(theme.palette.warning.main, 0.5),
                          '&.Mui-checked': { color: 'warning.main' },
                        }}
                      />
                      <Typography variant="body2" fontWeight={500}>Sandbox Mode</Typography>
                    </Stack>
                    {isSandbox && (
                      <Badge variant="outline" sx={{
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        borderColor: alpha(theme.palette.warning.main, 0.3),
                      }}>
                        Test Environment
                      </Badge>
                    )}
                  </Stack>
                )}

                {/* Client ID (for Dhan sandbox) */}
                {selectedBroker === 'dhan' && isSandbox && (
                  <Box sx={{ mb: 1.5 }}>
                    <Input
                      type="text"
                      placeholder="Sandbox Client ID (e.g., 2601288179)"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </Box>
                )}

                {/* Access Token */}
                <Stack direction="row" spacing={1.5}>
                  <Input
                    type="password"
                    placeholder={selectedBroker === 'upstox'
                      ? "Paste your Upstox access token..."
                      : (isSandbox ? "Paste your Sandbox access token..." : "Paste your Dhan access token...")}
                    value={brokerToken}
                    onChange={(e) => setBrokerToken(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <Button onClick={connectBroker} disabled={connectingBroker}>
                    {connectingBroker ? <Spinner size="sm" /> : 'Connect'}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {selectedBroker === 'upstox' ? (
                    <>
                      Get your access token from{' '}
                      <Box component="a" href="https://login.upstox.com/" target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
                        Upstox Developer Console
                      </Box>
                    </>
                  ) : (
                    <>
                      Get your {isSandbox ? 'sandbox' : 'access'} token from{' '}
                      <Box component="a" href="https://dhanhq.co/login" target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
                        Dhan Developer Console
                      </Box>
                      {isSandbox && ' \u2192 Sandbox section'}
                    </>
                  )}
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - STATS CARDS
  // ─────────────────────────────────────────────────────────────────────────────

  const renderStats = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
      {/* Active Bots */}
      <Card sx={{
        background: `linear-gradient(to bottom right, ${alpha(theme.palette.info.main, 0.1)}, transparent)`,
        borderColor: alpha(theme.palette.info.main, 0.2),
      }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: alpha(theme.palette.info.main, 0.2),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot style={{ width: 20, height: 20, color: theme.palette.info.main }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Active Bots</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>
                {[vwapBot.running, strangleBot.running, deltaBot.running].filter(Boolean).length}/3
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Open Positions */}
      <Card sx={{
        background: `linear-gradient(to bottom right, ${alpha(theme.palette.secondary.main, 0.1)}, transparent)`,
        borderColor: alpha(theme.palette.secondary.main, 0.2),
      }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: alpha(theme.palette.secondary.main, 0.2),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity style={{ width: 20, height: 20, color: theme.palette.secondary.main }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Open Positions</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>{activePositions}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Today's P&L */}
      <Card sx={{
        background: `linear-gradient(to bottom right, ${alpha(todayPnL >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.1)}, transparent)`,
        borderColor: alpha(todayPnL >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.2),
      }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: alpha(todayPnL >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.2),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {todayPnL >= 0
                ? <ArrowUpRight style={{ width: 20, height: 20, color: theme.palette.success.main }} />
                : <ArrowDownRight style={{ width: 20, height: 20, color: theme.palette.error.main }} />
              }
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Today's P&L</Typography>
              <Typography sx={{
                fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2,
                color: todayPnL >= 0 ? 'success.main' : 'error.main',
              }}>
                {todayPnL >= 0 ? '+' : ''}{formatINR(todayPnL)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Total P&L */}
      <Card sx={{
        background: `linear-gradient(to bottom right, ${alpha(totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.1)}, transparent)`,
        borderColor: alpha(totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.2),
      }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: alpha(totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main, 0.2),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Wallet style={{ width: 20, height: 20, color: totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total P&L</Typography>
              <Typography sx={{
                fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2,
                color: totalPnL >= 0 ? 'success.main' : 'error.main',
              }}>
                {totalPnL >= 0 ? '+' : ''}{formatINR(totalPnL)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - BOT CARD
  // ─────────────────────────────────────────────────────────────────────────────

  const renderBotCard = (config, botState, startBot, stopBot, renderConfig) => {
    const { id, name, description, icon: Icon, gradient, features, riskLevel, winRate, avgReturn, tokenCost, disclaimer } = config;
    const isExpanded = expandedBot === id;
    const isRunning = botState.running;
    const isLoading = botState.loading;

    return (
      <Card
        key={id}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.05)}`,
          },
          ...(isRunning && {
            outline: `2px solid ${alpha(theme.palette.success.main, 0.5)}`,
            boxShadow: `0 10px 25px ${alpha(theme.palette.success.main, 0.1)}`,
            '@keyframes glow': {
              '0%, 100%': { boxShadow: `0 4px 15px ${alpha(theme.palette.success.main, 0.1)}` },
              '50%': { boxShadow: `0 8px 30px ${alpha(theme.palette.success.main, 0.2)}` },
            },
            animation: 'glow 2s ease-in-out infinite',
          }),
          ...(!brokerConnected && { opacity: 0.6 }),
        }}
      >
        {/* Gradient Header */}
        <Box sx={{ height: 8, background: gradient }} />

        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{
                width: 56, height: 56, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: gradient,
              }}>
                <Icon style={{ width: 28, height: 28, color: '#fff' }} />
              </Box>
              <Box>
                <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
                  <Typography variant="h6" fontWeight={600}>{name}</Typography>
                  <Badge variant="outline" sx={{
                    bgcolor: alpha('#8b5cf6', 0.1),
                    color: '#8b5cf6',
                    borderColor: alpha('#8b5cf6', 0.3),
                  }}>
                    <Coins style={{ width: 12, height: 12, marginRight: 4 }} />{tokenCost} tokens
                  </Badge>
                  {isRunning && (
                    <Badge sx={{
                      bgcolor: alpha(theme.palette.success.main, 0.2),
                      color: theme.palette.success.main,
                      borderColor: alpha(theme.palette.success.main, 0.3),
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                      },
                      animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                    }}>
                      <Activity style={{ width: 12, height: 12, marginRight: 4 }} /> Running
                    </Badge>
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>
              </Box>
            </Stack>

            {/* Start/Stop Button */}
            <Button
              variant={isRunning ? "destructive" : "default"}
              size="sm"
              onClick={isRunning ? stopBot : startBot}
              disabled={isLoading || !brokerConnected}
              sx={{ minWidth: 100 }}
            >
              {isLoading ? (
                <Spinner size="sm" />
              ) : isRunning ? (
                <><Square style={{ width: 16, height: 16, marginRight: 8 }} /> Stop</>
              ) : (
                <><Play style={{ width: 16, height: 16, marginRight: 8 }} /> Start</>
              )}
            </Button>
          </Stack>

          {/* Stats Row */}
          <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ gap: { xs: 2, sm: 3 }, mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Target style={{ width: 16, height: 16, color: theme.palette.info.main }} />
              <Typography variant="body2" color="text.secondary">Win Rate:</Typography>
              <Typography variant="body2" fontWeight={500}>{winRate}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <TrendingUp style={{ width: 16, height: 16, color: theme.palette.success.main }} />
              <Typography variant="body2" color="text.secondary">Avg Return:</Typography>
              <Typography variant="body2" fontWeight={500} sx={{ color: 'success.main' }}>{avgReturn}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Shield style={{ width: 16, height: 16, color: theme.palette.warning.main }} />
              <Typography variant="body2" color="text.secondary">Risk:</Typography>
              <Typography variant="body2" fontWeight={500}>{riskLevel}</Typography>
            </Stack>
          </Stack>
          {disclaimer && (
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', mb: 2 }}>{disclaimer}</Typography>
          )}

          {/* Features */}
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {features.map((feature, i) => (
              <Badge key={i} variant="secondary">
                <Sparkles style={{ width: 12, height: 12, marginRight: 4 }} />
                {feature}
              </Badge>
            ))}
          </Stack>

          {/* Expand/Collapse Config */}
          <Box
            component="button"
            onClick={() => setExpandedBot(isExpanded ? null : id)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              fontSize: '0.875rem', color: 'text.secondary',
              bgcolor: 'transparent', border: 'none', cursor: 'pointer', p: 0,
              transition: 'color 0.2s ease',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <Settings style={{ width: 16, height: 16 }} />
            Configure Settings
            <ChevronDown style={{
              width: 16, height: 16,
              transition: 'transform 0.2s',
              transform: isExpanded ? 'rotate(180deg)' : 'none',
            }} />
          </Box>

          {/* Config Panel */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  {renderConfig()}
                </Box>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Running Status */}
          {isRunning && botState.status && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CheckCircle2 style={{ width: 16, height: 16, color: theme.palette.success.main }} />
                <Typography variant="body2" sx={{ color: 'success.main' }}>
                  Bot is actively monitoring the market
                </Typography>
              </Stack>
              {botState.status.positions?.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {botState.status.positions.length} active position(s)
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - BOT CONFIGS
  // ─────────────────────────────────────────────────────────────────────────────

  const clampVwap = (key, min, max) => {
    setVwapConfig(prev => {
      const v = Number(prev[key]);
      if (isNaN(v) || v < min) return { ...prev, [key]: min };
      if (v > max) return { ...prev, [key]: max };
      return prev;
    });
  };

  const renderVwapConfig = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
      <Box>
        <Typography variant="caption" color="text.secondary">Capital ({'\u20B9'})</Typography>
        <Input
          type="number"
          min={10000} max={50000000}
          value={vwapConfig.capital}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, capital: Number(e.target.value) }))}
          onBlur={() => clampVwap('capital', 10000, 50000000)}
          sx={{ mt: 0.5 }}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Risk per Trade (%)</Typography>
        <Input
          type="number"
          min={0.1} max={5} step={0.1}
          value={vwapConfig.riskPerTrade}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, riskPerTrade: Number(e.target.value) }))}
          onBlur={() => clampVwap('riskPerTrade', 0.1, 5)}
          sx={{ mt: 0.5 }}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Max Positions</Typography>
        <Input
          type="number"
          min={1} max={10}
          value={vwapConfig.maxPositions}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, maxPositions: Number(e.target.value) }))}
          onBlur={() => clampVwap('maxPositions', 1, 10)}
          sx={{ mt: 0.5 }}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Target (%)</Typography>
        <Input
          type="number"
          min={0.5} max={10} step={0.5}
          value={vwapConfig.targetPercent}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, targetPercent: Number(e.target.value) }))}
          onBlur={() => clampVwap('targetPercent', 0.5, 10)}
          sx={{ mt: 0.5 }}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Stop Loss (%)</Typography>
        <Input
          type="number"
          min={0.5} max={5} step={0.5}
          value={vwapConfig.stopLossPercent}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, stopLossPercent: Number(e.target.value) }))}
          onBlur={() => clampVwap('stopLossPercent', 0.5, 5)}
          sx={{ mt: 0.5 }}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Trailing SL (%)</Typography>
        <Input
          type="number"
          min={0.1} max={3} step={0.1}
          value={vwapConfig.trailingStopPercent}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, trailingStopPercent: Number(e.target.value) }))}
          onBlur={() => clampVwap('trailingStopPercent', 0.1, 3)}
          sx={{ mt: 0.5 }}
        />
      </Box>
    </Box>
  );

  const renderStrangleConfig = () => (
    <Stack spacing={2}>
      {/* Row 1: Core Settings */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Underlying</Typography>
          <TextField
            select
            size="small"
            fullWidth
            value={strangleConfig.underlying}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, underlying: e.target.value }))}
            sx={{ mt: 0.5 }}
          >
            <MenuItem value="NIFTY">NIFTY</MenuItem>
            <MenuItem value="BANKNIFTY">BANK NIFTY</MenuItem>
            <MenuItem value="FINNIFTY">FIN NIFTY</MenuItem>
          </TextField>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Number of Lots</Typography>
          <Input
            type="number"
            min="1"
            max="20"
            value={strangleConfig.numLots}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, numLots: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" color="text.secondary">Entry Delta</Typography>
            <Typography variant="caption" sx={{ color: theme.palette.secondary.main }}>{'\u03B4'}</Typography>
          </Stack>
          <Input
            type="number"
            min="10"
            max="25"
            value={strangleConfig.entryDelta}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, entryDelta: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" color="text.secondary">Adjustment Delta</Typography>
            <Typography variant="caption" sx={{ color: 'error.main' }}>{'\u03B4'}</Typography>
          </Stack>
          <Input
            type="number"
            min="25"
            max="50"
            value={strangleConfig.adjustmentDelta}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, adjustmentDelta: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
      </Box>

      {/* Row 2: P&L Settings */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Profit Target %</Typography>
          <Input
            type="number"
            min="20"
            max="80"
            value={strangleConfig.profitTargetPct}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, profitTargetPct: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Max Loss (x Credit)</Typography>
          <Input
            type="number"
            min="1"
            max="5"
            step="0.5"
            value={strangleConfig.maxLossMultiplier}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, maxLossMultiplier: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Entry Time</Typography>
          <Input
            type="time"
            value={strangleConfig.entryTime}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, entryTime: e.target.value }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Exit Time</Typography>
          <Input
            type="time"
            value={strangleConfig.exitTime}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, exitTime: e.target.value }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
      </Box>

      {/* Row 3: AI Settings */}
      <Box sx={{
        p: 1.5, borderRadius: 2,
        bgcolor: alpha(theme.palette.secondary.main, 0.1),
        border: 1,
        borderColor: alpha(theme.palette.secondary.main, 0.2),
      }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Brain style={{ width: 16, height: 16, color: theme.palette.secondary.light }} />
          <Typography variant="body2" fontWeight={500} sx={{ color: theme.palette.secondary.light }}>Claude AI Settings</Typography>
          <Badge variant="outline" sx={{
            ml: 'auto',
            borderColor: alpha(theme.palette.secondary.main, 0.5),
            color: theme.palette.secondary.light,
          }}>
            <Sparkles style={{ width: 12, height: 12, marginRight: 4 }} /> Premium
          </Badge>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Checkbox
              id="useAI"
              checked={strangleConfig.useAI}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, useAI: e.target.checked }))}
              size="small"
              sx={{
                p: 0.5,
                color: alpha(theme.palette.secondary.main, 0.5),
                '&.Mui-checked': { color: 'secondary.main' },
              }}
            />
            <Typography variant="caption" color="text.secondary" component="label" htmlFor="useAI" sx={{ cursor: 'pointer' }}>
              Enable AI Decisions
            </Typography>
          </Stack>
          <Box>
            <Typography variant="caption" color="text.secondary">AI Confidence %</Typography>
            <Input
              type="number"
              min="50"
              max="100"
              value={strangleConfig.aiConfidenceThreshold}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, aiConfidenceThreshold: Number(e.target.value) }))}
              sx={{ mt: 0.5 }}
              disabled={!strangleConfig.useAI}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Max Adjustments/Day</Typography>
            <Input
              type="number"
              min="0"
              max="10"
              value={strangleConfig.maxAdjustmentsPerDay}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, maxAdjustmentsPerDay: Number(e.target.value) }))}
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Status Display */}
      {strangleBot.status && strangleBot.running && (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.5), border: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>Position Status</Typography>
            <Button size="sm" variant="outline" onClick={scanStrangleBot}>
              <RefreshCw style={{ width: 12, height: 12, marginRight: 4 }} /> Scan Now
            </Button>
          </Stack>
          {strangleBot.status.position && strangleBot.status.position.status !== 'none' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <Box>
                <Typography component="span" variant="caption" color="text.secondary">Call:</Typography>
                <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                  {strangleBot.status.position.call_leg?.strike} @ {'\u03B4'}{strangleBot.status.position.call_leg?.delta?.toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography component="span" variant="caption" color="text.secondary">Put:</Typography>
                <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                  {strangleBot.status.position.put_leg?.strike} @ {'\u03B4'}{strangleBot.status.position.put_leg?.delta?.toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography component="span" variant="caption" color="text.secondary">P&L:</Typography>
                <Typography component="span" variant="caption" fontWeight={500} sx={{
                  ml: 1,
                  color: strangleBot.status.position.total_pnl >= 0 ? 'success.main' : 'error.main',
                }}>
                  {'\u20B9'}{strangleBot.status.position.total_pnl?.toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography component="span" variant="caption" color="text.secondary">Net Delta:</Typography>
                <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                  {strangleBot.status.position.net_delta?.toFixed(4)}
                </Typography>
              </Box>
            </Box>
          )}
          {strangleBot.status.ai_summary && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption">
                <Typography component="span" variant="caption" sx={{ color: theme.palette.secondary.light }}>AI: </Typography>
                {strangleBot.status.ai_summary.action}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({strangleBot.status.ai_summary.confidence}% confidence)
                </Typography>
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );

  const renderDeltaConfig = () => (
    <Stack spacing={2}>
      {/* Strategy Mode & Timeframe */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>Strategy Mode</Typography>
          <TextField
            select
            size="small"
            fullWidth
            value={deltaConfig.strategyMode}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, strategyMode: e.target.value }))}
            sx={{ mt: 0.5 }}
          >
            <MenuItem value="iron_condor">Iron Condor (Defined Risk)</MenuItem>
            <MenuItem value="iron_butterfly">Iron Butterfly (High Premium)</MenuItem>
            <MenuItem value="short_strangle">Short Strangle (Aggressive)</MenuItem>
            <MenuItem value="straddle_hedge">Straddle + Hedge (Max Theta)</MenuItem>
          </TextField>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>Timeframe</Typography>
          <TextField
            select
            size="small"
            fullWidth
            value={deltaConfig.timeframe}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, timeframe: e.target.value }))}
            sx={{ mt: 0.5 }}
          >
            <MenuItem value="weekly">Weekly Expiry</MenuItem>
            <MenuItem value="intraday">0DTE Intraday</MenuItem>
            <MenuItem value="smart">Smart (Auto-select)</MenuItem>
          </TextField>
        </Box>
      </Box>

      {/* Strategy description */}
      <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
        {deltaConfig.strategyMode === 'iron_condor' && (
          <Typography variant="caption" color="text.secondary">
            Sells OTM options + buys protective wings.{' '}
            <Typography component="span" variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>Max loss is capped.</Typography>
            {' '}Ideal for hands-off weekly income. Target 2-4% on margin.
          </Typography>
        )}
        {deltaConfig.strategyMode === 'iron_butterfly' && (
          <Typography variant="caption" color="text.secondary">
            Sells ATM straddle + buys OTM wings.{' '}
            <Typography component="span" variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>Higher premium, defined risk.</Typography>
            {' '}Best for range-bound/low-vol days. Target 3-6% weekly.
          </Typography>
        )}
        {deltaConfig.strategyMode === 'short_strangle' && (
          <Typography variant="caption" color="text.secondary">
            Sells naked OTM options.{' '}
            <Typography component="span" variant="caption" sx={{ color: 'error.main', fontWeight: 500 }}>Unlimited risk -- no wings.</Typography>
            {' '}Highest premium but needs active monitoring. For experienced traders.
          </Typography>
        )}
        {deltaConfig.strategyMode === 'straddle_hedge' && (
          <Typography variant="caption" color="text.secondary">
            Sells ATM straddle + dynamic hedging.{' '}
            <Typography component="span" variant="caption" sx={{ color: theme.palette.info.main, fontWeight: 500 }}>Pure theta capture with gamma scalping.</Typography>
            {' '}Most automated, bot handles everything.
          </Typography>
        )}
      </Box>

      {/* Core Settings */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Underlying</Typography>
          <TextField
            select
            size="small"
            fullWidth
            value={deltaConfig.underlying}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, underlying: e.target.value }))}
            sx={{ mt: 0.5 }}
          >
            <MenuItem value="NIFTY">NIFTY</MenuItem>
            <MenuItem value="BANKNIFTY">BANK NIFTY</MenuItem>
            <MenuItem value="FINNIFTY">FIN NIFTY</MenuItem>
          </TextField>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Entry Delta ({'\u03B4'})</Typography>
          <Input
            type="number"
            min={5} max={50} step={1}
            value={deltaConfig.entryDelta}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, entryDelta: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        {['iron_condor', 'iron_butterfly', 'straddle_hedge'].includes(deltaConfig.strategyMode) && (
          <Box>
            <Typography variant="caption" color="text.secondary">Wing Width (pts)</Typography>
            <Input
              type="number"
              min={50} max={500} step={50}
              value={deltaConfig.wingWidth}
              onChange={(e) => setDeltaConfig(prev => ({ ...prev, wingWidth: Number(e.target.value) }))}
              sx={{ mt: 0.5 }}
            />
          </Box>
        )}
      </Box>

      {/* Profit & Risk Settings */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Profit Target (%)</Typography>
          <Input
            type="number"
            min={10} max={90} step={5}
            value={deltaConfig.profitTargetPct}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, profitTargetPct: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">IV Entry Min (%ile)</Typography>
          <Input
            type="number"
            min={0} max={80} step={5}
            value={deltaConfig.ivEntryMin}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, ivEntryMin: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Max Adj/Day</Typography>
          <Input
            type="number"
            min={1} max={10} step={1}
            value={deltaConfig.maxAdjustmentsPerDay}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, maxAdjustmentsPerDay: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Lot Size</Typography>
          <Input
            type="number"
            value={deltaConfig.lotSize}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, lotSize: Number(e.target.value) }))}
            sx={{ mt: 0.5 }}
          />
        </Box>
      </Box>

      {/* Toggle switches */}
      <Stack direction="row" spacing={3}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'pointer' }}>
          <Checkbox
            checked={deltaConfig.trailingProfit}
            onChange={(e) => setDeltaConfig(prev => ({ ...prev, trailingProfit: e.target.checked }))}
            size="small"
            sx={{ p: 0.5 }}
          />
          <Typography variant="body2">Trailing Profit</Typography>
        </Stack>
      </Stack>
    </Stack>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - TRADE HISTORY
  // ─────────────────────────────────────────────────────────────────────────────

  const renderTradeHistory = () => (
    <Card>
      <CardHeader>
        <CardTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Clock style={{ width: 20, height: 20 }} />
            <span>Recent Trades</span>
          </Stack>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tradeHistory.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Activity style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.5, display: 'block', color: theme.palette.text.secondary }} />
            <Typography color="text.secondary">No trades yet. Start a bot to begin trading!</Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {tradeHistory.slice(0, 10).map((trade, i) => (
              <Stack
                key={i}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: (trade.type === 'BUY' || trade.action === 'buy')
                      ? alpha(theme.palette.success.main, 0.2)
                      : alpha(theme.palette.error.main, 0.2),
                  }}>
                    {(trade.type === 'BUY' || trade.action === 'buy')
                      ? <ArrowUpRight style={{ width: 16, height: 16, color: theme.palette.success.main }} />
                      : <ArrowDownRight style={{ width: 16, height: 16, color: theme.palette.error.main }} />
                    }
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{trade.symbol || trade.stock}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {trade.quantity || trade.qty} @ {'\u20B9'}{trade.price?.toFixed(2)}
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight={500} sx={{
                    color: (trade.pnl || 0) >= 0 ? 'success.main' : 'error.main',
                  }}>
                    {(trade.pnl || 0) >= 0 ? '+' : ''}{'\u20B9'}{(trade.pnl || 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(trade.timestamp || trade.time).toLocaleTimeString()}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <PageLayout>
      {ConfirmEl}
      <SEO {...getSeoConfig('/algo')} path="/algo" />
      <PageHeader
        title="Algo Trading"
        description="AI-powered trading bots that execute trades automatically"
        icon={Bot}
        badge={
          <Badge variant="outline" sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            borderColor: alpha(theme.palette.primary.main, 0.3),
          }}>
            <Zap style={{ width: 12, height: 12, marginRight: 4 }} /> Live Trading
          </Badge>
        }
      />

      <Stack spacing={3}>
        {/* Token Balance Bar */}
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          p: 2,
          borderRadius: 3,
          background: `linear-gradient(to right, ${alpha('#8b5cf6', 0.1)}, ${alpha(theme.palette.primary.main, 0.1)})`,
          border: 1,
          borderColor: alpha('#8b5cf6', 0.2),
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: alpha('#8b5cf6', 0.2),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Coins style={{ width: 20, height: 20, color: '#8b5cf6' }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">AI Token Balance</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>
                {isAdminUser ? '\u221E' : tokenBalance}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>tokens</Typography>
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">Cost per bot start</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#8b5cf6' }}>15 - 60 tokens</Typography>
            </Box>
            {!isAdminUser && tokenBalance < 15 && (
              <Button size="sm" onClick={() => navigate('/profile')} sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}>
                <Coins style={{ width: 16, height: 16, marginRight: 8 }} />Recharge
              </Button>
            )}
            {isAdminUser && (
              <Badge variant="outline" sx={{
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: 'success.main',
                borderColor: alpha(theme.palette.success.main, 0.3),
              }}>
                <Crown style={{ width: 12, height: 12, marginRight: 4 }} />Admin Free
              </Badge>
            )}
          </Stack>
        </Box>

        {/* Broker Connection */}
        {renderBrokerConnection()}

        {/* Stats Dashboard */}
        {brokerConnected && renderStats()}

        {/* P&L Performance Chart */}
        {brokerConnected && <PnLChart data={pnlHistory} />}

        {/* Risk Analytics Panel */}
        {brokerConnected && (
          <RiskAnalytics
            botStates={{ vwap: vwapBot, strangle: strangleBot, delta: deltaBot }}
            tradeHistory={tradeHistory}
          />
        )}

        {/* Strategy Comparison (shown when no bots running) */}
        {!vwapBot.running && !strangleBot.running && !deltaBot.running && (
          <StrategyShowcase onSelectStrategy={(id) => {
            // Find the corresponding bot section and scroll to it
            const botMap = { iron_condor: 'delta', iron_butterfly: 'delta', short_strangle: 'delta', vwap_momentum: 'vwap' };
            const botId = botMap[id];
            if (botId) setExpandedBot(botId);
          }} />
        )}

        {/* Not Connected Warning */}
        {!brokerConnected && (
          <Card sx={{
            borderColor: alpha(theme.palette.warning.main, 0.3),
            bgcolor: alpha(theme.palette.warning.main, 0.05),
          }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <AlertCircle style={{ width: 40, height: 40, color: theme.palette.warning.main, flexShrink: 0 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>Broker Not Connected</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Connect your Dhan or Upstox broker account above to enable live trading with AI bots.
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Trading Bots */}
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Brain style={{ width: 20, height: 20 }} />
            <Typography variant="h6" fontWeight={600}>
              AI Trading Bots
            </Typography>
            <Badge variant="secondary" sx={{ ml: 1 }}>
              <Coins style={{ width: 12, height: 12, marginRight: 4 }} />15-60 tokens/start
            </Badge>
          </Stack>

          {renderBotCard(
            BOT_CONFIGS.vwap,
            vwapBot,
            startVwapBot,
            stopVwapBot,
            renderVwapConfig
          )}

          {renderBotCard(
            BOT_CONFIGS.strangle,
            strangleBot,
            startStrangleBot,
            stopStrangleBot,
            renderStrangleConfig
          )}

          {renderBotCard(
            BOT_CONFIGS.delta,
            deltaBot,
            startDeltaBot,
            stopDeltaBot,
            renderDeltaConfig
          )}
        </Stack>

        {/* Trade History */}
        {brokerConnected && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
            {renderTradeHistory()}
            <ActivityFeed events={activityEvents} />
          </Box>
        )}

        {/* Risk Disclaimer */}
        <Card sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="flex-start" spacing={1.5}>
              <Info style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, color: theme.palette.text.secondary }} />
              <Box>
                <Typography variant="body2" fontWeight={500} color="text.primary">Risk Disclaimer</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Trading involves significant risk. These AI bots make automated trades based on
                  algorithms and market conditions. Past performance does not guarantee future results.
                  Only trade with capital you can afford to lose.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageLayout>
  );
};

export default AlgoTrading;
