/**
 * Algo Trading Page - AI-Powered Trading Bots
 * Clean, modern design with live trading functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Play, Square, Settings, TrendingUp, TrendingDown,
  Activity, Target, Shield, Zap, BarChart3, Brain,
  AlertCircle, CheckCircle2, Clock, Percent,
  RefreshCw, Eye, EyeOff, ChevronRight, ChevronDown, Power,
  Rocket, LineChart, Gauge, Wallet, Link, Unlink, ArrowUpRight,
  ArrowDownRight, Timer, Calendar, Sparkles, Lock, Crown, Info
} from 'lucide-react';
import { PageLayout, PageHeader } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Input, Spinner
} from '../components/ui';
import { cn, formatINR } from '../lib/utils';
import { API_BASE_URL } from '../config/api';
import { toast } from '../hooks/use-toast';

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
    gradient: 'from-blue-500 to-cyan-500',
    color: 'blue',
    features: ['Momentum Detection', 'Auto Position Sizing', 'Trailing Stop Loss'],
    riskLevel: 'Medium',
    winRate: '68%',
    avgReturn: '+2.1%',
  },
  strangle: {
    id: 'strangle',
    name: 'QuantStrangle AI Bot',
    description: 'Claude-powered delta-neutral strangle with 15δ entry & 30δ adjustments',
    icon: Brain,
    gradient: 'from-purple-500 to-pink-500',
    color: 'purple',
    features: ['Claude 4.5 AI', '15-Delta Entry', 'Auto Adjustments at 30δ'],
    riskLevel: 'Medium-High',
    winRate: '72%',
    avgReturn: '+1.8%',
    isPremium: true,
  },
  delta: {
    id: 'delta',
    name: 'Delta Neutral Bot',
    description: 'Sells premium while maintaining delta neutrality through hedging',
    icon: Shield,
    gradient: 'from-emerald-500 to-teal-500',
    color: 'emerald',
    features: ['Theta Decay', 'Auto Hedging', 'Risk Control'],
    riskLevel: 'Low-Medium',
    winRate: '78%',
    avgReturn: '+1.5%',
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const AlgoTrading = () => {
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
    exitTime: '15:15',
    claudeApiKey: ''
  });
  
  const [deltaConfig, setDeltaConfig] = useState({
    underlying: 'NIFTY',
    lotSize: 25,
    maxDeltaDrift: 0.1,
    hedgeThreshold: 0.05
  });
  
  // UI State
  const [expandedBot, setExpandedBot] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [todayPnL, setTodayPnL] = useState(0);
  const [activePositions, setActivePositions] = useState(0);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK BROKER CONNECTION ON MOUNT
  // ─────────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    const savedToken = localStorage.getItem('ms_broker_token');
    const savedBroker = localStorage.getItem('ms_connected_broker');
    const savedClientId = localStorage.getItem('ms_client_id');
    const savedSandbox = localStorage.getItem('ms_is_sandbox') === 'true';
    
    if (savedToken && savedBroker) {
      setBrokerToken(savedToken);
      setClientId(savedClientId || '');
      setIsSandbox(savedSandbox);
      setBrokerConnected(true);
      setBrokerInfo({ broker: savedBroker, sandbox: savedSandbox });
      setSelectedBroker(savedBroker);
    }
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BROKER CONNECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  const connectBroker = async () => {
    console.log('🔌 Connect broker called');
    console.log('  - Broker:', selectedBroker);
    console.log('  - Token length:', brokerToken?.length);
    console.log('  - Client ID:', clientId);
    console.log('  - Sandbox mode:', isSandbox);
    console.log('  - API URL:', API_BASE_URL);
    
    if (!brokerToken.trim()) {
      console.log('❌ No token provided');
      toast({ title: 'Error', description: `Please enter your ${selectedBroker === 'upstox' ? 'Upstox' : 'Dhan'} access token`, variant: 'destructive' });
      return;
    }
    
    // Sandbox only applies to Dhan
    if (selectedBroker === 'dhan' && isSandbox && !clientId.trim()) {
      console.log('❌ Sandbox mode but no client ID');
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
    const validateEndpoint = selectedBroker === 'upstox' 
      ? `${API_BASE_URL}/api/upstox/validate-token`
      : `${API_BASE_URL}/api/dhan/validate-token`;
    
    console.log('📡 Calling API:', validateEndpoint);
    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
    
    try {
      const response = await fetch(validateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Response status:', response.status);
      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (data.valid) {
        localStorage.setItem('ms_broker_token', brokerToken);
        localStorage.setItem('ms_connected_broker', selectedBroker);
        localStorage.setItem('ms_client_id', clientId || data.client_id || '');
        localStorage.setItem('ms_is_sandbox', (selectedBroker === 'dhan' && isSandbox) ? 'true' : 'false');
        setBrokerConnected(true);
        setBrokerInfo({ broker: selectedBroker, sandbox: selectedBroker === 'dhan' && isSandbox, ...data });
        setShowTokenInput(false);
        const brokerName = selectedBroker === 'upstox' ? 'Upstox' : 'Dhan';
        toast({ 
          title: '✅ Connected', 
          description: (selectedBroker === 'dhan' && isSandbox) ? 'Sandbox mode connected!' : `${brokerName} connected successfully!` 
        });
        fetchBotStatuses();
      } else {
        console.log('❌ Token invalid:', data.error);
        toast({ title: 'Invalid Token', description: data.error || 'Token validation failed', variant: 'destructive' });
      }
    } catch (error) {
      console.error('🔥 Connection error:', error);
      toast({ title: 'Connection Failed', description: error.message, variant: 'destructive' });
    }
    setConnectingBroker(false);
  };
  
  const disconnectBroker = () => {
    localStorage.removeItem('ms_broker_token');
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
      // Fetch VWAP Bot Status
      const vwapRes = await fetch(`${API_BASE_URL}/api/trade-algo/vwap-bot/status`);
      if (vwapRes.ok) {
        vwapData = await vwapRes.json();
        setVwapBot(prev => ({
          ...prev,
          running: vwapData.status === 'running',
          status: vwapData
        }));
      }
      
      // Fetch AI Strangle Bot Status
      const strangleRes = await fetch(`${API_BASE_URL}/api/trade-algo/ai-strangle/status`);
      if (strangleRes.ok) {
        strangleData = await strangleRes.json();
        setStrangleBot(prev => ({
          ...prev,
          running: strangleData.status === 'active',
          status: strangleData
        }));
      }
      
      // Fetch Delta Neutral Bot Status
      const deltaRes = await fetch(`${API_BASE_URL}/api/trade-algo/delta-neutral/status`);
      if (deltaRes.ok) {
        deltaData = await deltaRes.json();
        setDeltaBot(prev => ({
          ...prev,
          running: deltaData.running || deltaData.status === 'active',
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
      
    } catch (error) {
      console.error('Failed to fetch bot statuses:', error);
    }
  }, [brokerConnected]);
  
  // Poll bot statuses
  useEffect(() => {
    if (brokerConnected) {
      fetchBotStatuses();
      const interval = setInterval(fetchBotStatuses, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [brokerConnected, fetchBotStatuses]);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BOT CONTROLS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const startVwapBot = async () => {
    const isSandboxMode = localStorage.getItem('ms_is_sandbox') === 'true';
    const connectedBroker = localStorage.getItem('ms_connected_broker') || 'dhan';
    const brokerName = connectedBroker === 'upstox' ? 'Upstox' : 'Dhan';
    const confirmed = window.confirm(
      `⚠️ ${isSandboxMode ? 'SANDBOX' : 'LIVE'} TRADING CONFIRMATION ⚠️\n\n` +
      `You are about to start VWAP Momentum Bot${isSandboxMode ? ' in SANDBOX mode' : ' with REAL MONEY'}!\n\n` +
      `• Capital: ₹${vwapConfig.capital.toLocaleString()}\n` +
      `• Risk per Trade: ${vwapConfig.riskPerTrade}%\n` +
      `• Max Positions: ${vwapConfig.maxPositions}\n` +
      `• Target: ${vwapConfig.targetPercent}%\n` +
      `• Stop Loss: ${vwapConfig.stopLossPercent}%\n\n` +
      `${isSandboxMode ? 'This will simulate trades (no real orders).' : `This will place REAL orders on your ${brokerName} account.`}\n\n` +
      `Are you sure you want to proceed?`
    );
    if (!confirmed) return;
    
    setVwapBot(prev => ({ ...prev, loading: true }));
    try {
      const isSandboxMode = localStorage.getItem('ms_is_sandbox') === 'true';
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/vwap-bot/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_token: localStorage.getItem('ms_broker_token'),
          broker: connectedBroker,
          user_id: localStorage.getItem('ms_client_id') || 'default',
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
        toast({ title: '🚀 Bot Started', description: `VWAP Momentum Bot is now active${isSandboxMode ? ' [SANDBOX]' : ''}` });
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
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/vwap-bot/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.status === 'success' || data.status === 'stopped') {
        setVwapBot(prev => ({ ...prev, running: false }));
        toast({ title: '⏹ Bot Stopped', description: 'VWAP Momentum Bot stopped' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setVwapBot(prev => ({ ...prev, loading: false }));
  };
  
  const startStrangleBot = async () => {
    const confirmed = window.confirm(
      `⚠️ LIVE TRADING CONFIRMATION ⚠️\n\n` +
      `You are about to start QuantStrangle AI Bot with REAL MONEY!\n\n` +
      `Strategy: Delta-Neutral Short Strangle\n` +
      `• Underlying: ${strangleConfig.underlying}\n` +
      `• Number of Lots: ${strangleConfig.numLots}\n` +
      `• Entry Delta: ${strangleConfig.entryDelta} (sell at 15-16 delta)\n` +
      `• Adjustment Trigger: ${strangleConfig.adjustmentDelta} delta\n` +
      `• Profit Target: ${strangleConfig.profitTargetPct}%\n` +
      `• Claude AI: ${strangleConfig.useAI ? 'ENABLED' : 'DISABLED'}\n\n` +
      `This will place REAL options orders on your ${localStorage.getItem('ms_connected_broker') === 'upstox' ? 'Upstox' : 'Dhan'} account.\n\n` +
      `Are you sure you want to proceed?`
    );
    if (!confirmed) return;
    
    setStrangleBot(prev => ({ ...prev, loading: true }));
    try {
      const connectedBroker = localStorage.getItem('ms_connected_broker') || 'dhan';
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/ai-delta-strangle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: localStorage.getItem('ms_broker_token'),
          broker: connectedBroker,
          claude_api_key: strangleConfig.claudeApiKey || null,
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
        toast({ title: '🤖 QuantStrangle AI Started', description: data.message || 'Bot is now monitoring positions' });
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
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/ai-delta-strangle/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ close_positions: true })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setStrangleBot(prev => ({ ...prev, running: false, status: null }));
        toast({ title: '⏹ Bot Stopped', description: 'QuantStrangle AI stopped' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setStrangleBot(prev => ({ ...prev, loading: false }));
  };
  
  // Scan function for serverless execution
  const scanStrangleBot = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/ai-delta-strangle/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setStrangleBot(prev => ({ ...prev, status: data }));
      if (data.action_taken) {
        toast({ 
          title: '🔄 Action Taken', 
          description: `${data.action_taken.reason}: ${data.action_taken.trigger || ''}`
        });
      }
      return data;
    } catch (error) {
      console.error('Scan error:', error);
    }
  };
  
  // Get strangle bot status
  const getStrangleBotStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/ai-delta-strangle/status`);
      const data = await response.json();
      setStrangleBot(prev => ({ ...prev, status: data, running: data.is_running }));
      return data;
    } catch (error) {
      console.error('Status error:', error);
    }
  };
  
  const startDeltaBot = async () => {
    const confirmed = window.confirm(
      `⚠️ LIVE TRADING CONFIRMATION ⚠️\n\n` +
      `You are about to start Delta Neutral Bot with REAL MONEY!\n\n` +
      `• Underlying: ${deltaConfig.underlying}\n` +
      `• Lot Size: ${deltaConfig.lotSize}\n` +
      `• Max Delta Drift: ±${deltaConfig.maxDeltaDrift}\n\n` +
      `This will place REAL options orders on your ${localStorage.getItem('ms_connected_broker') === 'upstox' ? 'Upstox' : 'Dhan'} account.\n\n` +
      `Are you sure you want to proceed?`
    );
    if (!confirmed) return;
    
    setDeltaBot(prev => ({ ...prev, loading: true }));
    try {
      const connectedBroker = localStorage.getItem('ms_connected_broker') || 'dhan';
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/delta-neutral/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: localStorage.getItem('ms_broker_token'),
          broker: connectedBroker,
          underlying: deltaConfig.underlying,
          lot_size: deltaConfig.lotSize,
          max_delta_drift: deltaConfig.maxDeltaDrift,
          auto_adjust: true,
          adjustment_interval: 60,
          stop_loss_percent: 2.0,
          target_profit_percent: 1.0,
          mock_mode: isSandbox
        })
      });
      const data = await response.json();
      if (data.success) {
        setDeltaBot(prev => ({ ...prev, running: true }));
        toast({ title: '🛡️ Bot Started', description: 'Delta Neutral Bot is now active' });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to start bot', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setDeltaBot(prev => ({ ...prev, loading: false }));
  };
  
  const stopDeltaBot = async () => {
    setDeltaBot(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/trade-algo/delta-neutral/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.success) {
        setDeltaBot(prev => ({ ...prev, running: false }));
        toast({ title: '⏹ Bot Stopped', description: 'Delta Neutral Bot stopped' });
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
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center",
              brokerConnected 
                ? "bg-green-500/20 text-green-500" 
                : "bg-orange-500/20 text-orange-500"
            )}>
              {brokerConnected ? <Link className="w-7 h-7" /> : <Unlink className="w-7 h-7" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {brokerConnected ? 'Broker Connected' : 'Connect Broker'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {brokerConnected 
                  ? `Connected to ${brokerInfo?.broker === 'upstox' ? 'Upstox' : 'Dhan'}${brokerInfo?.sandbox ? ' (Sandbox)' : ''} • ${brokerInfo?.sandbox ? 'Test' : 'Live'} trading enabled`
                  : 'Connect your broker account to start live trading'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {brokerConnected ? (
              <>
                {brokerInfo?.available_balance !== undefined && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 font-mono">
                    ₹{Number(brokerInfo.available_balance).toLocaleString('en-IN')}
                  </Badge>
                )}
                <Badge variant="outline" className={cn(
                  brokerInfo?.sandbox 
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                    : "bg-green-500/10 text-green-500 border-green-500/30"
                )}>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> {brokerInfo?.sandbox ? 'Sandbox' : 'Live'}
                </Badge>
                <Button variant="outline" size="sm" onClick={disconnectBroker}>
                  <Unlink className="w-4 h-4 mr-2" /> Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowTokenInput(!showTokenInput)}>
                <Link className="w-4 h-4 mr-2" /> Connect Broker
              </Button>
            )}
          </div>
        </div>
        
        {/* Token Input */}
        <AnimatePresence>
          {showTokenInput && !brokerConnected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t overflow-hidden"
            >
              {/* Broker Selector */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium">Select Broker:</span>
                <div className="flex gap-2">
                  <Button
                    variant={selectedBroker === 'dhan' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedBroker('dhan')}
                    className={selectedBroker === 'dhan' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  >
                    Dhan
                  </Button>
                  <Button
                    variant={selectedBroker === 'upstox' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedBroker('upstox')}
                    className={selectedBroker === 'upstox' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    Upstox
                  </Button>
                </div>
              </div>
              
              {/* Sandbox Toggle (Dhan only) */}
              {selectedBroker === 'dhan' && (
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSandbox}
                    onChange={(e) => setIsSandbox(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm font-medium">Sandbox Mode</span>
                </label>
                {isSandbox && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                    Test Environment
                  </Badge>
                )}
              </div>
              )}
              
              {/* Client ID (for Dhan sandbox) */}
              {selectedBroker === 'dhan' && isSandbox && (
                <div className="mb-3">
                  <Input
                    type="text"
                    placeholder="Sandbox Client ID (e.g., 2601288179)"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}
              
              {/* Access Token */}
              <div className="flex gap-3">
                <Input
                  type="password"
                  placeholder={selectedBroker === 'upstox' 
                    ? "Paste your Upstox access token..." 
                    : (isSandbox ? "Paste your Sandbox access token..." : "Paste your Dhan access token...")}
                  value={brokerToken}
                  onChange={(e) => setBrokerToken(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={connectBroker} disabled={connectingBroker}>
                  {connectingBroker ? <Spinner className="w-4 h-4" /> : 'Connect'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedBroker === 'upstox' ? (
                  <>
                    Get your access token from{' '}
                    <a href="https://login.upstox.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Upstox Developer Console
                    </a>
                  </>
                ) : (
                  <>
                    Get your {isSandbox ? 'sandbox' : 'access'} token from{' '}
                    <a href="https://dhanhq.co/login" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Dhan Developer Console
                    </a>
                    {isSandbox && ' → Sandbox section'}
                  </>
                )}
              </p>
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Bots</p>
              <p className="text-2xl font-bold">
                {[vwapBot.running, strangleBot.running, deltaBot.running].filter(Boolean).length}/3
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Positions</p>
              <p className="text-2xl font-bold">{activePositions}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className={cn(
        "bg-gradient-to-br border-opacity-20",
        todayPnL >= 0 
          ? "from-green-500/10 to-transparent border-green-500/20" 
          : "from-red-500/10 to-transparent border-red-500/20"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              todayPnL >= 0 ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {todayPnL >= 0 
                ? <ArrowUpRight className="w-5 h-5 text-green-500" />
                : <ArrowDownRight className="w-5 h-5 text-red-500" />
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Today's P&L</p>
              <p className={cn(
                "text-2xl font-bold",
                todayPnL >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {todayPnL >= 0 ? '+' : ''}{formatINR(todayPnL)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className={cn(
        "bg-gradient-to-br border-opacity-20",
        totalPnL >= 0 
          ? "from-emerald-500/10 to-transparent border-emerald-500/20" 
          : "from-rose-500/10 to-transparent border-rose-500/20"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              totalPnL >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
            )}>
              <Wallet className={cn("w-5 h-5", totalPnL >= 0 ? "text-emerald-500" : "text-rose-500")} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total P&L</p>
              <p className={cn(
                "text-2xl font-bold",
                totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"
              )}>
                {totalPnL >= 0 ? '+' : ''}{formatINR(totalPnL)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - BOT CARD
  // ─────────────────────────────────────────────────────────────────────────────
  
  const renderBotCard = (config, botState, startBot, stopBot, renderConfig) => {
    const { id, name, description, icon: Icon, gradient, features, riskLevel, winRate, avgReturn } = config;
    const isExpanded = expandedBot === id;
    const isRunning = botState.running;
    const isLoading = botState.loading;
    
    return (
      <Card 
        key={id}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          isRunning && "ring-2 ring-green-500/50",
          !brokerConnected && "opacity-60"
        )}
      >
        {/* Gradient Header */}
        <div className={`h-2 bg-gradient-to-r ${gradient}`} />
        
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br",
                gradient
              )}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">{name}</h3>
                  {isRunning && (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 animate-pulse">
                      <Activity className="w-3 h-3 mr-1" /> Running
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
            
            {/* Start/Stop Button */}
            <Button
              variant={isRunning ? "destructive" : "default"}
              size="sm"
              onClick={isRunning ? stopBot : startBot}
              disabled={isLoading || !brokerConnected}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <Spinner className="w-4 h-4" />
              ) : isRunning ? (
                <><Square className="w-4 h-4 mr-2" /> Stop</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Start</>
              )}
            </Button>
          </div>
          
          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-muted-foreground">Win Rate:</span>
              <span className="font-medium">{winRate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Avg Return:</span>
              <span className="font-medium text-green-500">{avgReturn}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-orange-500" />
              <span className="text-muted-foreground">Risk:</span>
              <span className="font-medium">{riskLevel}</span>
            </div>
          </div>
          
          {/* Features */}
          <div className="flex flex-wrap gap-2 mb-4">
            {features.map((feature, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                {feature}
              </Badge>
            ))}
          </div>
          
          {/* Expand/Collapse Config */}
          <button
            onClick={() => setExpandedBot(isExpanded ? null : id)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configure Settings
            <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
          </button>
          
          {/* Config Panel */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t">
                  {renderConfig()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Running Status */}
          {isRunning && botState.status && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                Bot is actively monitoring the market
              </div>
              {botState.status.positions?.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {botState.status.positions.length} active position(s)
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - BOT CONFIGS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const renderVwapConfig = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <label className="text-xs text-muted-foreground">Capital (₹)</label>
        <Input
          type="number"
          value={vwapConfig.capital}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, capital: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Risk per Trade (%)</label>
        <Input
          type="number"
          value={vwapConfig.riskPerTrade}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, riskPerTrade: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Max Positions</label>
        <Input
          type="number"
          value={vwapConfig.maxPositions}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, maxPositions: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Target (%)</label>
        <Input
          type="number"
          value={vwapConfig.targetPercent}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, targetPercent: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Stop Loss (%)</label>
        <Input
          type="number"
          value={vwapConfig.stopLossPercent}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, stopLossPercent: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Trailing SL (%)</label>
        <Input
          type="number"
          value={vwapConfig.trailingStopPercent}
          onChange={(e) => setVwapConfig(prev => ({ ...prev, trailingStopPercent: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
    </div>
  );
  
  const renderStrangleConfig = () => (
    <div className="space-y-4">
      {/* Row 1: Core Settings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Underlying</label>
          <select
            value={strangleConfig.underlying}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, underlying: e.target.value }))}
            className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="NIFTY">NIFTY</option>
            <option value="BANKNIFTY">BANK NIFTY</option>
            <option value="FINNIFTY">FIN NIFTY</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Number of Lots</label>
          <Input
            type="number"
            min="1"
            max="20"
            value={strangleConfig.numLots}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, numLots: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Entry Delta <span className="text-purple-400">δ</span>
          </label>
          <Input
            type="number"
            min="10"
            max="25"
            value={strangleConfig.entryDelta}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, entryDelta: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Adjustment Delta <span className="text-red-400">δ</span>
          </label>
          <Input
            type="number"
            min="25"
            max="50"
            value={strangleConfig.adjustmentDelta}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, adjustmentDelta: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
      </div>
      
      {/* Row 2: P&L Settings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Profit Target %</label>
          <Input
            type="number"
            min="20"
            max="80"
            value={strangleConfig.profitTargetPct}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, profitTargetPct: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max Loss (x Credit)</label>
          <Input
            type="number"
            min="1"
            max="5"
            step="0.5"
            value={strangleConfig.maxLossMultiplier}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, maxLossMultiplier: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Entry Time</label>
          <Input
            type="time"
            value={strangleConfig.entryTime}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, entryTime: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Exit Time</label>
          <Input
            type="time"
            value={strangleConfig.exitTime}
            onChange={(e) => setStrangleConfig(prev => ({ ...prev, exitTime: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>
      
      {/* Row 3: AI Settings */}
      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-400">Claude AI Settings</span>
          <Badge variant="outline" className="ml-auto text-xs border-purple-500/50 text-purple-400">
            <Sparkles className="w-3 h-3 mr-1" /> Premium
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useAI"
              checked={strangleConfig.useAI}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, useAI: e.target.checked }))}
              className="rounded border-purple-500/50"
            />
            <label htmlFor="useAI" className="text-xs text-muted-foreground">Enable AI Decisions</label>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">AI Confidence %</label>
            <Input
              type="number"
              min="50"
              max="100"
              value={strangleConfig.aiConfidenceThreshold}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, aiConfidenceThreshold: Number(e.target.value) }))}
              className="mt-1"
              disabled={!strangleConfig.useAI}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Adjustments/Day</label>
            <Input
              type="number"
              min="0"
              max="10"
              value={strangleConfig.maxAdjustmentsPerDay}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, maxAdjustmentsPerDay: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Claude API Key
            </label>
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={strangleConfig.claudeApiKey}
              onChange={(e) => setStrangleConfig(prev => ({ ...prev, claudeApiKey: e.target.value }))}
              className="mt-1"
              disabled={!strangleConfig.useAI}
            />
          </div>
        </div>
      </div>
      
      {/* Status Display */}
      {strangleBot.status && strangleBot.running && (
        <div className="p-3 rounded-lg bg-background/50 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Position Status</span>
            <Button size="sm" variant="outline" onClick={scanStrangleBot}>
              <RefreshCw className="w-3 h-3 mr-1" /> Scan Now
            </Button>
          </div>
          {strangleBot.status.position && strangleBot.status.position.status !== 'none' && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Call:</span>
                <span className="ml-2">{strangleBot.status.position.call_leg?.strike} @ δ{strangleBot.status.position.call_leg?.delta?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Put:</span>
                <span className="ml-2">{strangleBot.status.position.put_leg?.strike} @ δ{strangleBot.status.position.put_leg?.delta?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">P&L:</span>
                <span className={cn("ml-2 font-medium", strangleBot.status.position.total_pnl >= 0 ? "text-green-500" : "text-red-500")}>
                  ₹{strangleBot.status.position.total_pnl?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Net Delta:</span>
                <span className="ml-2">{strangleBot.status.position.net_delta?.toFixed(4)}</span>
              </div>
            </div>
          )}
          {strangleBot.status.ai_summary && (
            <div className="mt-2 pt-2 border-t text-xs">
              <span className="text-purple-400">AI: </span>
              <span>{strangleBot.status.ai_summary.action}</span>
              <span className="text-muted-foreground ml-2">({strangleBot.status.ai_summary.confidence}% confidence)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  const renderDeltaConfig = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <label className="text-xs text-muted-foreground">Underlying</label>
        <select
          value={deltaConfig.underlying}
          onChange={(e) => setDeltaConfig(prev => ({ ...prev, underlying: e.target.value }))}
          className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="NIFTY">NIFTY</option>
          <option value="BANKNIFTY">BANK NIFTY</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Lot Size</label>
        <Input
          type="number"
          value={deltaConfig.lotSize}
          onChange={(e) => setDeltaConfig(prev => ({ ...prev, lotSize: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Max Delta Drift</label>
        <Input
          type="number"
          step="0.01"
          value={deltaConfig.maxDeltaDrift}
          onChange={(e) => setDeltaConfig(prev => ({ ...prev, maxDeltaDrift: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Hedge Threshold</label>
        <Input
          type="number"
          step="0.01"
          value={deltaConfig.hedgeThreshold}
          onChange={(e) => setDeltaConfig(prev => ({ ...prev, hedgeThreshold: Number(e.target.value) }))}
          className="mt-1"
        />
      </div>
    </div>
  );
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER - TRADE HISTORY
  // ─────────────────────────────────────────────────────────────────────────────
  
  const renderTradeHistory = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tradeHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No trades yet. Start a bot to begin trading!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tradeHistory.slice(0, 10).map((trade, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    trade.type === 'BUY' || trade.action === 'buy'
                      ? "bg-green-500/20 text-green-500"
                      : "bg-red-500/20 text-red-500"
                  )}>
                    {trade.type === 'BUY' || trade.action === 'buy'
                      ? <ArrowUpRight className="w-4 h-4" />
                      : <ArrowDownRight className="w-4 h-4" />
                    }
                  </div>
                  <div>
                    <p className="font-medium text-sm">{trade.symbol || trade.stock}</p>
                    <p className="text-xs text-muted-foreground">
                      {trade.quantity || trade.qty} @ ₹{trade.price?.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-medium text-sm",
                    (trade.pnl || 0) >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {(trade.pnl || 0) >= 0 ? '+' : ''}₹{(trade.pnl || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(trade.timestamp || trade.time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  
  return (
    <PageLayout>
      <PageHeader
        title="Algo Trading"
        description="AI-powered trading bots that execute trades automatically"
        icon={Bot}
        badge={
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Zap className="w-3 h-3 mr-1" /> Live Trading
          </Badge>
        }
      />
      
      <div className="space-y-6">
        {/* Broker Connection */}
        {renderBrokerConnection()}
        
        {/* Stats Dashboard */}
        {brokerConnected && renderStats()}
        
        {/* Not Connected Warning */}
        {!brokerConnected && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="w-10 h-10 text-orange-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Broker Not Connected</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Dhan broker account above to enable live trading with AI bots.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Trading Bots */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Trading Bots
          </h2>
          
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
        </div>
        
        {/* Trade History */}
        {brokerConnected && renderTradeHistory()}
        
        {/* Risk Disclaimer */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Risk Disclaimer</p>
                <p className="mt-1">
                  Trading involves significant risk. These AI bots make automated trades based on 
                  algorithms and market conditions. Past performance does not guarantee future results. 
                  Only trade with capital you can afford to lose.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default AlgoTrading;
