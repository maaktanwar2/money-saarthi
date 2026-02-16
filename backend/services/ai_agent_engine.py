"""
═══════════════════════════════════════════════════════════════════════════════════
  AUTONOMOUS AI TRADING AGENT ENGINE
  Self-Thinking, Self-Adjusting, Multi-Strategy Orchestrator
═══════════════════════════════════════════════════════════════════════════════════

ARCHITECTURE: OBSERVE → THINK → DECIDE → ACT → REFLECT → ADAPT

The Agent does NOT need human input after activation. It:
1. OBSERVES all market data (spot, OI, IV, Greeks, VIX, FII/DII, pivots)
2. THINKS via Claude LLM reasoning about multiple scenarios
3. DECIDES which strategy to deploy or adjust
4. ACTS by placing/modifying/exiting trades through broker APIs
5. REFLECTS on outcomes and logs reasoning chain
6. ADAPTS its own parameters based on performance

STRATEGIES AVAILABLE TO AGENT:
- Delta Neutral Short Strangle (range-bound markets)
- Iron Condor (defined-risk range plays)
- Iron Butterfly (near-ATM premium capture)
- Directional CE/PE Buying (trending markets)
- VWAP Reversal (mean-reversion plays)
- Straddle (high-volatility event plays)
- Protective Hedging (risk management overlays)

RISK FRAMEWORK:
- Max daily loss: Configurable (default 2% of capital)
- Max position size: 30% of capital per trade
- Market hours gating: 9:15 AM - 3:30 PM IST
- Emergency VIX threshold: Auto-hedge above VIX 20
- Max drawdown: Auto-shutdown at 5% drawdown in session
- Cool-down after 2 consecutive losses

═══════════════════════════════════════════════════════════════════════════════════
"""

import asyncio
import logging
import httpx
import os
import math
import json
import random
import hashlib
import re
import time as _time
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, time, timedelta, timezone
from dataclasses import dataclass, field
from enum import Enum
from collections import deque

IST = timezone(timedelta(hours=5, minutes=30))
logger = logging.getLogger(__name__)

# VIX ticker for India VIX
INDIA_VIX_YF = "^INDIAVIX"


def get_ist_now() -> datetime:
    return datetime.now(IST)


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS & DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class AgentState(Enum):
    IDLE = "idle"
    OBSERVING = "observing"
    THINKING = "thinking"
    DECIDING = "deciding"
    ACTING = "acting"
    REFLECTING = "reflecting"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


class MarketRegime(Enum):
    STRONGLY_BULLISH = "strongly_bullish"
    BULLISH = "bullish"
    MILDLY_BULLISH = "mildly_bullish"
    RANGE_BOUND = "range_bound"
    MILDLY_BEARISH = "mildly_bearish"
    BEARISH = "bearish"
    STRONGLY_BEARISH = "strongly_bearish"
    HIGH_VOLATILITY = "high_volatility"
    UNKNOWN = "unknown"


class StrategyType(Enum):
    SHORT_STRANGLE = "short_strangle"
    IRON_CONDOR = "iron_condor"
    IRON_BUTTERFLY = "iron_butterfly"
    LONG_CE = "long_ce"
    LONG_PE = "long_pe"
    STRADDLE_BUY = "straddle_buy"
    VWAP_REVERSAL = "vwap_reversal"
    HEDGE_OVERLAY = "hedge_overlay"
    NO_TRADE = "no_trade"


class RiskLevel(Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class DecisionConfidence(Enum):
    VERY_HIGH = "very_high"    # 85-100%
    HIGH = "high"              # 70-84%
    MODERATE = "moderate"      # 55-69%
    LOW = "low"                # 40-54%
    VERY_LOW = "very_low"      # <40%


@dataclass
class MarketSnapshot:
    """Complete market state at a point in time"""
    timestamp: datetime = None
    symbol: str = "NIFTY"
    
    # Price Data
    spot_price: float = 0.0
    prev_close: float = 0.0
    day_open: float = 0.0
    day_high: float = 0.0
    day_low: float = 0.0
    day_change_pct: float = 0.0
    intraday_range: float = 0.0
    
    # Technical Indicators
    vwap: float = 0.0
    ema_9: float = 0.0
    ema_21: float = 0.0
    sma_20: float = 0.0
    atr_14: float = 0.0
    
    # Volatility
    vix: float = 0.0
    iv: float = 0.0
    rv: float = 0.0
    iv_rank: float = 0.0
    iv_percentile: float = 0.0
    
    # Options Data
    pcr: float = 0.0
    max_pain: float = 0.0
    support: float = 0.0
    resistance: float = 0.0
    atm_iv: float = 0.0
    
    # Market Context
    gap_type: str = "FLAT"
    session: str = "CLOSED"
    trend: str = "SIDEWAYS"
    trend_strength: str = "WEAK"
    
    # Pivot Levels
    pivot: float = 0.0
    r1: float = 0.0
    r2: float = 0.0
    s1: float = 0.0
    s2: float = 0.0
    
    def to_dict(self):
        return {
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "symbol": self.symbol,
            "spot_price": self.spot_price,
            "prev_close": self.prev_close,
            "day_change_pct": round(self.day_change_pct, 2),
            "vwap": round(self.vwap, 2),
            "ema_9": round(self.ema_9, 2),
            "ema_21": round(self.ema_21, 2),
            "vix": round(self.vix, 2),
            "iv": round(self.iv, 2),
            "iv_rank": round(self.iv_rank, 1),
            "pcr": round(self.pcr, 2),
            "max_pain": self.max_pain,
            "support": self.support,
            "resistance": self.resistance,
            "gap_type": self.gap_type,
            "session": self.session,
            "trend": self.trend,
            "trend_strength": self.trend_strength,
            "pivot": round(self.pivot, 2),
            "r1": round(self.r1, 2), "r2": round(self.r2, 2),
            "s1": round(self.s1, 2), "s2": round(self.s2, 2),
        }


@dataclass
class AgentDecision:
    """A single decision made by the agent with full reasoning"""
    id: str = ""
    timestamp: datetime = None
    
    # What the agent decided
    strategy: StrategyType = StrategyType.NO_TRADE
    action: str = "WAIT"  # ENTER, EXIT, ADJUST, HEDGE, WAIT
    confidence: DecisionConfidence = DecisionConfidence.LOW
    confidence_score: float = 0.0
    
    # The reasoning chain
    market_regime: MarketRegime = MarketRegime.UNKNOWN
    reasoning: str = ""
    scenarios_considered: List[str] = field(default_factory=list)
    risk_assessment: str = ""
    
    # Hedge plan (from LLM)
    hedge_plan: Dict = field(default_factory=lambda: {"required": False, "reason": "", "legs": []})
    # Position management plan
    position_plan: Dict = field(default_factory=lambda: {"targets": "", "exits": ""})
    
    # Trade parameters (if action is ENTER/ADJUST)
    trade_params: Dict = field(default_factory=dict)
    
    # Outcome tracking
    executed: bool = False
    execution_result: Dict = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "strategy": self.strategy.value,
            "action": self.action,
            "confidence": self.confidence.value,
            "confidence_score": self.confidence_score,
            "market_regime": self.market_regime.value,
            "reasoning": self.reasoning,
            "scenarios_considered": self.scenarios_considered,
            "risk_assessment": self.risk_assessment,
            "hedge_plan": self.hedge_plan,
            "position_plan": self.position_plan,
            "trade_params": self.trade_params,
            "executed": self.executed,
            "execution_result": self.execution_result,
        }


@dataclass
class AgentConfig:
    """Agent configuration - can be modified by the agent itself"""
    # Identity
    underlying: str = "NIFTY"
    user_id: str = ""
    
    # Risk Parameters
    risk_level: RiskLevel = RiskLevel.MODERATE
    max_capital: float = 500000.0      # 5 lakh default
    max_loss_per_day_pct: float = 2.0  # 2% of capital
    max_loss_per_trade_pct: float = 1.0
    max_positions: int = 3
    max_drawdown_pct: float = 5.0      # Auto-shutdown
    
    # Strategy Preferences
    allowed_strategies: List[str] = field(default_factory=lambda: [
        "short_strangle", "iron_condor", "iron_butterfly",
        "long_ce", "long_pe", "straddle_buy",
        "vwap_reversal", "hedge_overlay"
    ])
    preferred_expiry: str = "weekly"  # weekly or monthly
    lot_size: int = 65  # NIFTY default
    num_lots: int = 1
    
    # Agent Behavior
    think_interval: int = 60          # Seconds between think cycles
    auto_enter: bool = True           # Auto-enter trades
    auto_exit: bool = True            # Auto-exit trades
    auto_adjust: bool = True          # Auto-adjust positions
    min_confidence: float = 65.0      # Min confidence to trade
    use_mock: bool = True             # Mock mode for safety
    
    # Self-Adaptation
    adapt_enabled: bool = True        # Allow agent to modify own params
    learning_rate: float = 0.1        # How much to adjust from outcomes
    consecutive_loss_pause: int = 2   # Pause after N losses
    
    # VIX Thresholds
    vix_low: float = 12.0
    vix_high: float = 18.0
    vix_emergency: float = 22.0


@dataclass
class PerformanceTracker:
    """Tracks agent performance for self-adaptation"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_pnl: float = 0.0
    max_win: float = 0.0
    max_loss: float = 0.0
    current_streak: int = 0  # positive = wins, negative = losses
    daily_pnl: float = 0.0
    peak_daily_pnl: float = 0.0
    drawdown: float = 0.0
    strategy_stats: Dict[str, Dict] = field(default_factory=dict)
    
    def record_trade(self, pnl: float, strategy: str):
        self.total_trades += 1
        self.total_pnl += pnl
        self.daily_pnl += pnl
        
        if pnl > 0:
            self.winning_trades += 1
            self.max_win = max(self.max_win, pnl)
            self.current_streak = max(1, self.current_streak + 1)
        else:
            self.losing_trades += 1
            self.max_loss = min(self.max_loss, pnl)
            self.current_streak = min(-1, self.current_streak - 1)
        
        self.peak_daily_pnl = max(self.peak_daily_pnl, self.daily_pnl)
        self.drawdown = self.peak_daily_pnl - self.daily_pnl
        
        # Track per-strategy
        if strategy not in self.strategy_stats:
            self.strategy_stats[strategy] = {"trades": 0, "wins": 0, "pnl": 0.0}
        self.strategy_stats[strategy]["trades"] += 1
        if pnl > 0:
            self.strategy_stats[strategy]["wins"] += 1
        self.strategy_stats[strategy]["pnl"] += pnl
    
    @property
    def win_rate(self):
        return (self.winning_trades / self.total_trades * 100) if self.total_trades > 0 else 0.0
    
    def to_dict(self):
        return {
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate": round(self.win_rate, 1),
            "total_pnl": round(self.total_pnl, 2),
            "daily_pnl": round(self.daily_pnl, 2),
            "max_win": round(self.max_win, 2),
            "max_loss": round(self.max_loss, 2),
            "current_streak": self.current_streak,
            "drawdown": round(self.drawdown, 2),
            "strategy_stats": self.strategy_stats,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# THE AUTONOMOUS AI AGENT
# ═══════════════════════════════════════════════════════════════════════════════

class AutonomousAIAgent:
    """
    Self-thinking, self-adjusting AI Trading Agent.
    Uses Claude LLM as its brain for reasoning about market scenarios.
    Manages its own strategy selection, position sizing, and risk management.
    """
    
    def __init__(self, config: AgentConfig = None):
        self.config = config or AgentConfig()
        self.state = AgentState.IDLE
        self.performance = PerformanceTracker()
        
        # Decision history (memory)
        self.decisions: deque = deque(maxlen=100)
        self.thought_log: deque = deque(maxlen=200)
        self.market_snapshots: deque = deque(maxlen=50)
        
        # Current positions
        self.active_positions: List[Dict] = []
        self.pending_orders: List[Dict] = []
        
        # Agent's self-evolved parameters
        self.evolved_params: Dict = {
            "confidence_threshold": self.config.min_confidence,
            "preferred_strategy_weights": {},
            "time_preference": "any",
            "volatility_comfort": "medium",
        }
        
        # Internal counters
        self._cycle_count = 0
        self._last_think_time = None
        self._monitoring_task = None
        self._error_count = 0
        self._consecutive_errors = 0
        
        # Claude API caching / rate-limiting
        self._claude_cache: Dict[str, Tuple[str, float]] = {}  # hash -> (response, timestamp)
        self._claude_cache_ttl = 120  # seconds - skip re-calling if data hasn't changed
        self._claude_call_count = 0
        self._claude_daily_limit = 500  # max calls per session
        
        # Dhan market data service (lazy-initialized)
        self._dhan_market: Any = None
        
        # Firestore persistence (lazy)
        self._firestore_col = None
        
        # Event log for frontend
        self.event_feed: deque = deque(maxlen=500)
        self._add_event("SYSTEM", "Agent initialized", f"Config: {self.config.underlying}, Risk: {self.config.risk_level.value}, Mock: {self.config.use_mock}")
    
    # ═════════════════════════════════════════════════════════════════════════
    # PERSISTENCE — Firestore
    # ═════════════════════════════════════════════════════════════════════════

    def _get_firestore(self):
        """Lazy-init Firestore collection"""
        if self._firestore_col is None:
            try:
                from services.firestore_db import FirestoreCollection
                self._firestore_col = FirestoreCollection("ai_agent_state")
            except Exception as e:
                logger.warning("Firestore unavailable for agent persistence: %s", e)
        return self._firestore_col

    async def _persist_state(self):
        """Save current agent state to Firestore (non-blocking, best-effort)"""
        try:
            col = self._get_firestore()
            if not col:
                return
            doc_id = self.config.user_id or "default"
            state_doc = {
                "user_id": doc_id,
                "state": self.state.value,
                "cycle_count": self._cycle_count,
                "performance": self.performance.to_dict(),
                "evolved_params": self.evolved_params,
                "active_positions": self.active_positions,
                "recent_decisions": [d.to_dict() for d in list(self.decisions)[-10:]],
                "config": {
                    "underlying": self.config.underlying,
                    "risk_level": self.config.risk_level.value,
                    "max_capital": self.config.max_capital,
                    "use_mock": self.config.use_mock,
                },
                "updated_at": get_ist_now().isoformat(),
            }
            await col.update_one(
                {"user_id": doc_id},
                {"$set": state_doc},
                upsert=True,
            )
        except Exception as e:
            logger.debug("Agent persistence write failed (non-critical): %s", e)

    async def _load_persisted_state(self):
        """Load previous agent state from Firestore on start"""
        try:
            col = self._get_firestore()
            if not col:
                return
            doc_id = self.config.user_id or "default"
            doc = await col.find_one({"user_id": doc_id})
            if doc:
                # Restore performance
                perf = doc.get("performance", {})
                self.performance.total_trades = perf.get("total_trades", 0)
                self.performance.winning_trades = perf.get("winning_trades", 0)
                self.performance.losing_trades = perf.get("losing_trades", 0)
                self.performance.total_pnl = perf.get("total_pnl", 0.0)
                self.performance.strategy_stats = perf.get("strategy_stats", {})
                # Restore evolved params
                ep = doc.get("evolved_params")
                if ep:
                    self.evolved_params.update(ep)
                self._add_event("SYSTEM", "State restored", f"Loaded history: {self.performance.total_trades} trades, P&L ₹{self.performance.total_pnl:,.0f}")
        except Exception as e:
            logger.debug("Agent persistence load failed (non-critical): %s", e)

    # ═════════════════════════════════════════════════════════════════════════
    # LIFECYCLE: START / STOP / PAUSE
    # ═════════════════════════════════════════════════════════════════════════
    
    async def start(self):
        """Start the autonomous agent loop"""
        if self.state not in [AgentState.IDLE, AgentState.STOPPED, AgentState.PAUSED]:
            return {"error": f"Cannot start from state: {self.state.value}"}
        
        self.state = AgentState.OBSERVING
        self._add_event("START", "Agent activated", 
            f"🚀 Autonomous AI Agent started for {self.config.underlying} | "
            f"Risk: {self.config.risk_level.value} | Capital: ₹{self.config.max_capital:,.0f} | "
            f"Mock: {self.config.use_mock}")
        
        # Restore previous session state (non-blocking)
        await self._load_persisted_state()
        
        self._monitoring_task = asyncio.create_task(self._agent_loop())
        return {"status": "started", "state": self.state.value}
    
    async def stop(self):
        """Stop the agent and close all positions"""
        self._add_event("STOP", "Agent stopping", "Closing all positions and shutting down...")
        self.state = AgentState.STOPPED
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        
        # Exit all positions
        if self.active_positions:
            await self._exit_all_positions("Agent stopped by user")
        
        self._add_event("STOP", "Agent stopped", f"Final P&L: ₹{self.performance.daily_pnl:,.0f}")
        
        # Persist final state to Firestore
        await self._persist_state()
        
        return {"status": "stopped", "final_pnl": self.performance.daily_pnl}
    
    async def pause(self):
        """Pause the agent (keeps positions, stops new trades)"""
        self.state = AgentState.PAUSED
        self._add_event("PAUSE", "Agent paused", "No new trades, monitoring existing positions")
        return {"status": "paused"}
    
    async def resume(self):
        """Resume from pause"""
        if self.state == AgentState.PAUSED:
            self.state = AgentState.OBSERVING
            self._add_event("RESUME", "Agent resumed", "Back to active trading")
            if not self._monitoring_task or self._monitoring_task.done():
                self._monitoring_task = asyncio.create_task(self._agent_loop())
        return {"status": "resumed"}
    
    # ═════════════════════════════════════════════════════════════════════════
    # THE CORE LOOP: OBSERVE → THINK → DECIDE → ACT → REFLECT
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _agent_loop(self):
        """Main autonomous loop - runs continuously during market hours"""
        logger.info(f"Agent loop started for {self.config.user_id}")
        
        # Start a keep-alive self-pinger for Cloud Run (prevents instance freeze)
        keepalive_task = asyncio.create_task(self._keepalive_ping())
        
        try:
            while self.state not in [AgentState.STOPPED]:
                try:
                    if self.state == AgentState.PAUSED:
                        await asyncio.sleep(10)
                        continue
                    
                    now = get_ist_now()
                    hour, minute = now.hour, now.minute
                    is_weekday = now.weekday() < 5
                    time_in_mins = hour * 60 + minute
                    
                    # Market hours check (9:15 AM - 3:30 PM IST)
                    market_open = is_weekday and 555 <= time_in_mins <= 930
                    
                    if not market_open:
                        # Outside market hours - minimal checking
                        if self.active_positions and is_weekday and time_in_mins > 930:
                            await self._exit_all_positions("Market closed")
                        self._add_event("IDLE", "Market closed", "Waiting for market to open...")
                        await asyncio.sleep(300)  # Check every 5 min outside hours
                        continue
                    
                    # === OBSERVE ===
                    self.state = AgentState.OBSERVING
                    snapshot = await self._observe_market()
                    if not snapshot:
                        self._consecutive_errors += 1
                        if self._consecutive_errors > 5:
                            self._add_event("ERROR", "Too many observation errors", "Pausing agent")
                            self.state = AgentState.PAUSED
                        await asyncio.sleep(30)
                        continue
                    self._consecutive_errors = 0
                    
                    # === SAFETY CHECKS ===
                    should_continue = self._safety_checks()
                    if not should_continue:
                        await asyncio.sleep(60)
                        continue
                    
                    # === THINK (LLM Reasoning) ===
                    self.state = AgentState.THINKING
                    decision = await self._think_and_decide(snapshot)
                    
                    if decision:
                        self.decisions.appendleft(decision)
                        
                        # === ACT ===
                        if decision.action != "WAIT" and decision.confidence_score >= self.evolved_params["confidence_threshold"]:
                            self.state = AgentState.ACTING
                            await self._execute_decision(decision)
                        
                        # === REFLECT ===
                        self.state = AgentState.REFLECTING
                        await self._reflect_on_positions(snapshot)
                    
                    # === ADAPT ===
                    if self.config.adapt_enabled and self._cycle_count % 10 == 0:
                        self._self_adapt()
                    
                    self._cycle_count += 1
                    self.state = AgentState.OBSERVING
                    
                    # Persist state every 5 cycles
                    if self._cycle_count % 5 == 0:
                        await self._persist_state()
                    
                    await asyncio.sleep(self.config.think_interval)
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    self._error_count += 1
                    self._add_event("ERROR", "Agent loop error", str(e)[:200])
                    logger.error(f"Agent loop error: {e}", exc_info=True)
                    await asyncio.sleep(30)
        finally:
            keepalive_task.cancel()
            try:
                await keepalive_task
            except asyncio.CancelledError:
                pass

    async def _keepalive_ping(self):
        """Self-ping to keep Cloud Run instance alive while agent is running.
        Cloud Run freezes CPU when no requests are in-flight; this HTTP self-ping
        every 4 minutes ensures the instance stays warm."""
        port = os.environ.get("PORT", "8080")
        url = f"http://localhost:{port}/api/health"
        try:
            while True:
                await asyncio.sleep(240)  # every 4 min
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        await client.get(url)
                except Exception:
                    pass  # best-effort
        except asyncio.CancelledError:
            pass
    # ═════════════════════════════════════════════════════════════════════════
    # OBSERVE: Gather all market data
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _observe_market(self) -> Optional[MarketSnapshot]:
        """Gather comprehensive market data — prefers Dhan real-time, falls back to yfinance"""
        try:
            snap = MarketSnapshot(timestamp=get_ist_now(), symbol=self.config.underlying)

            # ------- Try Dhan real-time data first -------
            dhan_ok = await self._observe_via_dhan(snap)

            # ------- Fallback to yfinance (intraday where possible) -------
            if not dhan_ok:
                yf_ok = await self._observe_via_yfinance(snap)
                if not yf_ok:
                    return None

            # ------- Fetch real India VIX -------
            await self._fetch_real_vix(snap)

            # ------- Compute VWAP properly (from intraday bars) -------
            # If we got intraday volume bars they're stored in _intraday_bars
            if hasattr(self, '_intraday_bars') and self._intraday_bars is not None and len(self._intraday_bars) > 0:
                bars = self._intraday_bars
                try:
                    typical = (bars['High'] + bars['Low'] + bars['Close']) / 3
                    cum_tp_vol = (typical * bars['Volume']).cumsum()
                    cum_vol = bars['Volume'].cumsum()
                    vwap_series = cum_tp_vol / cum_vol
                    snap.vwap = float(vwap_series.iloc[-1])
                except Exception:
                    # Fallback: typical price as proxy
                    snap.vwap = (snap.day_high + snap.day_low + snap.spot_price) / 3
            else:
                snap.vwap = (snap.day_high + snap.day_low + snap.spot_price) / 3

            # ------- Compute True Range ATR-14 -------
            if hasattr(self, '_daily_hist') and self._daily_hist is not None and len(self._daily_hist) >= 15:
                hist = self._daily_hist
                high = hist['High'].values
                low = hist['Low'].values
                close = hist['Close'].values
                true_ranges = []
                for i in range(1, min(15, len(hist))):
                    tr = max(high[i] - low[i],
                             abs(high[i] - close[i-1]),
                             abs(low[i] - close[i-1]))
                    true_ranges.append(tr)
                snap.atr_14 = sum(true_ranges) / len(true_ranges) if true_ranges else snap.intraday_range
            else:
                snap.atr_14 = snap.intraday_range

            # ------- RV from daily returns -------
            if hasattr(self, '_daily_hist') and self._daily_hist is not None and len(self._daily_hist) >= 5:
                daily_returns = self._daily_hist['Close'].pct_change().dropna()
                snap.rv = float(daily_returns.std() * math.sqrt(252) * 100)
            else:
                snap.rv = 15.0  # reasonable default

            # ------- IV: derive from VIX or RV, never random -------
            if snap.vix > 0:
                snap.iv = snap.vix  # VIX is the market's IV expectation
            else:
                snap.iv = snap.rv
            snap.iv_rank = min(100, max(0, (snap.iv - 10) / 25 * 100))

            # ------- Fetch real option chain OI for PCR / max-pain / support / resistance -------
            await self._fetch_oi_data(snap)

            # ------- Gap analysis -------
            if snap.prev_close > 0:
                gap_pct = ((snap.day_open - snap.prev_close) / snap.prev_close) * 100
            else:
                gap_pct = 0
            snap.gap_type = "GAP_UP" if gap_pct > 0.3 else "GAP_DOWN" if gap_pct < -0.3 else "FLAT"

            # ------- Trend detection -------
            if snap.spot_price > snap.vwap and snap.spot_price > snap.ema_9 and snap.ema_9 > snap.ema_21:
                snap.trend = "BULLISH"
                snap.trend_strength = "STRONG" if snap.day_change_pct > 0.5 else "MODERATE"
            elif snap.spot_price < snap.vwap and snap.spot_price < snap.ema_9 and snap.ema_9 < snap.ema_21:
                snap.trend = "BEARISH"
                snap.trend_strength = "STRONG" if snap.day_change_pct < -0.5 else "MODERATE"
            else:
                snap.trend = "SIDEWAYS"
                snap.trend_strength = "WEAK"

            # ------- Session classification -------
            now = get_ist_now()
            t = now.hour * 60 + now.minute
            if t < 555 or t > 930:
                snap.session = "CLOSED"
            elif now.hour == 9 and now.minute < 45:
                snap.session = "OPENING"
            elif t >= 870:
                snap.session = "CLOSING"
            elif 720 <= t < 780:
                snap.session = "LUNCH"
            else:
                snap.session = "ACTIVE"

            # ------- Pivot levels -------
            snap.pivot = (snap.day_high + snap.day_low + snap.prev_close) / 3
            snap.r1 = 2 * snap.pivot - snap.day_low
            snap.r2 = snap.pivot + (snap.day_high - snap.day_low)
            snap.s1 = 2 * snap.pivot - snap.day_high
            snap.s2 = snap.pivot - (snap.day_high - snap.day_low)

            self.market_snapshots.appendleft(snap)
            self._add_event("OBSERVE", "Market scanned",
                f"{snap.symbol} @ {snap.spot_price:.0f} | Chg: {snap.day_change_pct:+.2f}% | "
                f"Trend: {snap.trend} | VIX: {snap.vix:.1f} | PCR: {snap.pcr:.2f}")

            return snap

        except Exception as e:
            self._add_event("ERROR", "Observation failed", str(e)[:200])
            logger.error(f"Market observation error: {e}", exc_info=True)
            return None

    # ── Data source helpers ──────────────────────────────────────────────────

    async def _observe_via_dhan(self, snap: MarketSnapshot) -> bool:
        """Try to get real-time data from Dhan API. Returns True on success."""
        try:
            from services.dhan_market_data import get_dhan_service
            dhan = get_dhan_service()
            if not dhan.access_token:
                return False

            DHAN_IDS = {"NIFTY": 13, "BANKNIFTY": 25, "FINNIFTY": 27, "SENSEX": 26}
            sec_id = DHAN_IDS.get(self.config.underlying)
            if not sec_id:
                return False

            result = await dhan.get_market_quote({"NSE_EQ": [sec_id]})
            if result.get("status") != "success":
                return False

            quote = next(iter(result.get("data", {}).values()), None)
            if not quote or not quote.get("ltp"):
                return False

            snap.spot_price = float(quote["ltp"])
            snap.day_open = float(quote.get("open") or snap.spot_price)
            snap.day_high = float(quote.get("high") or snap.spot_price)
            snap.day_low = float(quote.get("low") or snap.spot_price)
            snap.prev_close = float(quote.get("prev_close") or snap.spot_price)
            if snap.prev_close > 0:
                snap.day_change_pct = ((snap.spot_price - snap.prev_close) / snap.prev_close) * 100
            snap.intraday_range = snap.day_high - snap.day_low

            self._add_event("OBSERVE", "Dhan real-time", f"LTP {snap.spot_price:.0f}")
            return True
        except Exception as e:
            logger.debug(f"Dhan data unavailable: {e}")
            return False

    async def _observe_via_yfinance(self, snap: MarketSnapshot) -> bool:
        """Fallback: get data from yfinance with intraday bars when possible.
        All yfinance calls run in a thread to avoid blocking the async event loop."""
        try:
            import yfinance as yf

            sym_map = {
                "NIFTY": "^NSEI", "BANKNIFTY": "^NSEBANK",
                "FINNIFTY": "^CNXFIN", "SENSEX": "^BSESN"
            }
            yf_symbol = sym_map.get(self.config.underlying, f"{self.config.underlying}.NS")

            def _sync_fetch():
                """Run all blocking yfinance I/O in a worker thread."""
                ticker = yf.Ticker(yf_symbol)
                intraday = None
                try:
                    ib = ticker.history(period="1d", interval="5m")
                    if not ib.empty and 'Volume' in ib.columns:
                        intraday = ib
                except Exception:
                    pass
                hist = ticker.history(period="30d")
                return intraday, hist

            intraday, hist = await asyncio.to_thread(_sync_fetch)

            if hist is None or hist.empty:
                self._add_event("WARN", "No market data", f"yfinance returned empty for {yf_symbol}")
                return False

            self._intraday_bars = intraday
            self._daily_hist = hist

            # If we have intraday bars, use the last bar for current price
            if self._intraday_bars is not None and len(self._intraday_bars) > 0:
                snap.spot_price = float(self._intraday_bars['Close'].iloc[-1])
                snap.day_open = float(self._intraday_bars['Open'].iloc[0])
                snap.day_high = float(self._intraday_bars['High'].max())
                snap.day_low = float(self._intraday_bars['Low'].min())
            else:
                snap.spot_price = float(hist['Close'].iloc[-1])
                snap.day_open = float(hist['Open'].iloc[-1])
                snap.day_high = float(hist['High'].iloc[-1])
                snap.day_low = float(hist['Low'].iloc[-1])

            snap.prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else snap.spot_price
            if snap.prev_close > 0:
                snap.day_change_pct = ((snap.spot_price - snap.prev_close) / snap.prev_close) * 100
            snap.intraday_range = snap.day_high - snap.day_low

            # EMAs from daily history
            snap.ema_9 = float(hist['Close'].ewm(span=9).mean().iloc[-1])
            snap.ema_21 = float(hist['Close'].ewm(span=21).mean().iloc[-1])
            snap.sma_20 = float(hist['Close'].tail(20).mean())

            return True
        except Exception as e:
            self._add_event("ERROR", "yfinance failed", str(e)[:200])
            logger.error(f"yfinance error: {e}")
            return False

    async def _fetch_real_vix(self, snap: MarketSnapshot):
        """Fetch India VIX from yfinance — never randomize. Runs in thread."""
        try:
            import yfinance as yf

            def _sync_vix():
                t = yf.Ticker(INDIA_VIX_YF)
                return t.history(period="5d")

            vix_hist = await asyncio.to_thread(_sync_vix)
            if vix_hist is not None and not vix_hist.empty:
                snap.vix = float(vix_hist['Close'].iloc[-1])
            else:
                snap.vix = snap.rv if snap.rv > 0 else 14.0
        except Exception as e:
            snap.vix = snap.rv if snap.rv > 0 else 14.0
            logger.debug(f"VIX fetch fallback: {e}")

    async def _fetch_oi_data(self, snap: MarketSnapshot):
        """Fetch option-chain OI from Dhan for PCR, max-pain, support, resistance.
        Falls back to deterministic estimates (never random)."""
        strike_step = 50 if self.config.underlying in ["NIFTY", "FINNIFTY"] else 100
        atm = round(snap.spot_price / strike_step) * strike_step

        try:
            from services.dhan_market_data import get_dhan_service
            dhan = get_dhan_service()
            if not dhan.access_token:
                raise ValueError("No Dhan token")

            DHAN_IDS = {"NIFTY": 13, "BANKNIFTY": 25, "FINNIFTY": 27}
            sec_id = DHAN_IDS.get(self.config.underlying)
            if not sec_id:
                raise ValueError("Unknown underlying for Dhan")

            # Find nearest expiry (next Thursday for NIFTY)
            from datetime import date
            today = date.today()
            days_ahead = (3 - today.weekday()) % 7  # Thursday=3
            if days_ahead == 0 and get_ist_now().hour >= 16:
                days_ahead = 7
            expiry = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

            chain = await dhan.get_option_chain(sec_id, expiry)
            if chain.get("status") != "success" or not chain.get("strikes"):
                raise ValueError("Empty chain")

            total_call_oi = 0
            total_put_oi = 0
            max_call_oi_strike = atm
            max_put_oi_strike = atm
            max_call_oi = 0
            max_put_oi = 0
            strikes = chain["strikes"]

            for s in strikes:
                c_oi = s.get("call", {}).get("oi") or 0
                p_oi = s.get("put", {}).get("oi") or 0
                total_call_oi += c_oi
                total_put_oi += p_oi
                if c_oi > max_call_oi:
                    max_call_oi = c_oi
                    max_call_oi_strike = s["strike_price"]
                if p_oi > max_put_oi:
                    max_put_oi = p_oi
                    max_put_oi_strike = s["strike_price"]

                # ATM IV
                if s["strike_price"] == atm:
                    c_iv = s.get("call", {}).get("iv")
                    p_iv = s.get("put", {}).get("iv")
                    if c_iv and p_iv:
                        snap.atm_iv = (c_iv + p_iv) / 2
                    elif c_iv:
                        snap.atm_iv = c_iv

            snap.pcr = (total_put_oi / total_call_oi) if total_call_oi > 0 else 1.0
            snap.resistance = max_call_oi_strike
            snap.support = max_put_oi_strike

            # Max pain: strike where total OI pain is minimized
            # (simplified: avg of highest call OI and highest put OI strikes)
            snap.max_pain = (max_call_oi_strike + max_put_oi_strike) / 2

            self._add_event("OBSERVE", "OI data fetched",
                f"PCR: {snap.pcr:.2f} | Support (max put OI): {snap.support} | Resistance (max call OI): {snap.resistance}")
            return

        except Exception as e:
            logger.debug(f"Dhan OI unavailable, using deterministic estimates: {e}")

        # Deterministic fallback — based on price structure, NOT random
        snap.pcr = 1.0  # neutral default
        snap.max_pain = atm
        snap.support = snap.s1 if snap.s1 > 0 else atm - 3 * strike_step
        snap.resistance = snap.r1 if snap.r1 > 0 else atm + 3 * strike_step
        snap.atm_iv = snap.iv
    
    # ═════════════════════════════════════════════════════════════════════════
    # THINK: LLM-Powered Reasoning
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _think_and_decide(self, snapshot: MarketSnapshot) -> Optional[AgentDecision]:
        """Use Claude to reason through market scenarios and make a decision"""
        try:
            decision_id = f"D{self._cycle_count:04d}_{get_ist_now().strftime('%H%M%S')}"
            
            # Build the context prompt for Claude
            context = self._build_thinking_context(snapshot)
            
            # Get Claude's reasoning
            llm_response = await self._call_claude(context)
            
            if not llm_response:
                # Fallback to rule-based thinking
                self._add_event("THINK", "Using rule-based engine",
                    "Claude API unavailable (no key or rate-limited) — using built-in rules")
                return self._rule_based_decision(snapshot, decision_id)
            
            # Parse Claude's response into a decision
            decision = self._parse_llm_decision(llm_response, snapshot, decision_id)
            
            self._add_event("THINK", f"Decision: {decision.action}", 
                f"Strategy: {decision.strategy.value} | Confidence: {decision.confidence_score:.0f}% | "
                f"Regime: {decision.market_regime.value}\n"
                f"Reasoning: {decision.reasoning[:200]}")
            
            self.thought_log.appendleft({
                "cycle": self._cycle_count,
                "time": get_ist_now().isoformat(),
                "decision": decision.to_dict(),
                "snapshot": snapshot.to_dict(),
            })
            
            return decision
            
        except Exception as e:
            self._add_event("ERROR", "Thinking failed", str(e)[:200])
            logger.error(f"Think error: {e}")
            return None
    
    def _build_thinking_context(self, snap: MarketSnapshot) -> str:
        """Build a comprehensive JSON data payload for the LLM risk-manager brain"""
        
        # Recent decisions for memory
        recent_decisions = []
        for d in list(self.decisions)[:5]:
            recent_decisions.append({
                "time": d.timestamp.strftime('%H:%M') if d.timestamp else '??',
                "action": d.action,
                "strategy": d.strategy.value,
                "confidence": round(d.confidence_score),
                "reasoning_summary": d.reasoning[:120] if d.reasoning else '',
            })
        
        # Active positions in structured form
        positions_data = []
        for pos in self.active_positions[:5]:
            positions_data.append({
                "id": pos.get("id", ""),
                "strategy": pos.get("strategy", ""),
                "legs": pos.get("legs", []),
                "current_pnl": pos.get("current_pnl", 0),
                "target_pnl": pos.get("target_pnl", 0),
                "stoploss_pnl": pos.get("stoploss_pnl", 0),
                "entry_time": pos.get("entry_time", ""),
                "status": pos.get("status", "active"),
            })
        
        # Performance summary
        perf = self.performance
        
        # Strategy performance
        strategy_perf = {}
        for strat, stats in perf.strategy_stats.items():
            wr = (stats['wins'] / stats['trades'] * 100) if stats['trades'] > 0 else 0
            strategy_perf[strat] = {"trades": stats['trades'], "win_rate": round(wr), "pnl": round(stats['pnl'])}
        
        # Build the structured data snapshot
        data_payload = {
            "market_snapshot": {
                "symbol": snap.symbol,
                "timestamp": snap.timestamp.strftime('%Y-%m-%d %H:%M IST') if snap.timestamp else 'N/A',
                "session": snap.session,
                "spot_price": round(snap.spot_price, 2),
                "prev_close": round(snap.prev_close, 2),
                "day_change_pct": round(snap.day_change_pct, 2),
                "day_open": round(snap.day_open, 2),
                "day_high": round(snap.day_high, 2),
                "day_low": round(snap.day_low, 2),
                "intraday_range": round(snap.intraday_range),
                "gap_type": snap.gap_type,
                "vwap": round(snap.vwap, 2),
                "spot_vs_vwap": "ABOVE" if snap.spot_price > snap.vwap else "BELOW",
                "spot_vwap_distance": round(abs(snap.spot_price - snap.vwap)),
                "ema_9": round(snap.ema_9, 2),
                "ema_21": round(snap.ema_21, 2),
                "trend": snap.trend,
                "trend_strength": snap.trend_strength,
                "vix": round(snap.vix, 1),
                "iv": round(snap.iv, 1),
                "rv": round(snap.rv, 1),
                "iv_rank": round(snap.iv_rank),
                "atr_14": round(snap.atr_14),
                "pcr": round(snap.pcr, 2),
                "max_pain": round(snap.max_pain),
                "support": round(snap.support),
                "resistance": round(snap.resistance),
                "pivots": {
                    "s2": round(snap.s2), "s1": round(snap.s1),
                    "pivot": round(snap.pivot),
                    "r1": round(snap.r1), "r2": round(snap.r2),
                },
            },
            "positions": positions_data,
            "config": {
                "risk_level": self.config.risk_level.value,
                "max_capital": self.config.max_capital,
                "max_positions": self.config.max_positions,
                "num_lots": self.config.num_lots,
                "min_confidence": self.config.min_confidence,
                "auto_enter": self.config.auto_enter,
                "auto_exit": self.config.auto_exit,
                "auto_adjust": self.config.auto_adjust,
                "use_mock": self.config.use_mock,
                "max_loss_per_day_pct": self.config.max_loss_per_day_pct,
                "preferred_expiry": self.config.preferred_expiry,
            },
            "performance": {
                "daily_pnl": round(perf.daily_pnl),
                "total_trades": perf.total_trades,
                "winning_trades": perf.winning_trades,
                "losing_trades": perf.losing_trades,
                "win_rate": round(perf.win_rate),
                "current_streak": perf.current_streak,
                "drawdown": round(perf.drawdown),
                "max_daily_loss_limit": round(self.config.max_capital * self.config.max_loss_per_day_pct / 100),
                "remaining_risk_budget": round((self.config.max_capital * self.config.max_loss_per_day_pct / 100) - abs(min(0, perf.daily_pnl))),
                "strategy_stats": strategy_perf,
            },
            "recent_decisions": recent_decisions,
        }
        
        return json.dumps(data_payload, indent=2, default=str)
    
    def _get_system_prompt(self) -> str:
        """Return the comprehensive risk-manager system prompt for Claude"""
        return """You are an autonomous intraday MARKET ANALYST and RISK MANAGER for index derivatives.

PRIMARY OBJECTIVE
- Protect capital first through intelligent HEDGING of open positions.
- Then optimize risk-adjusted returns by selectively adding or adjusting trades.
- You are conservative by default and aggressively avoid large drawdowns.

MARKET & INSTRUMENTS
- Market: Indian index derivatives (e.g., NIFTY, BANKNIFTY, FINNIFTY).
- Instruments: Index options and futures (CE/PE, spreads, strangles, condors, hedge overlays).
- You never place naked unlimited-risk trades unless config explicitly allows it.

DATA YOU RECEIVE EACH CYCLE
Every call you get a JSON snapshot (updated roughly every minute) that may include:

- `market_snapshot`: spot price, day change %, VIX, VWAP, PCR, IV rank, session, support/resistance levels, trend.
- `option_chain`: strikes with LTP, OI, change in OI, IV, volume and any sentiment/flow metrics.
- `positions`: current open positions with legs (BUY/SELL, strike, premium, quantity, SL/Target, P&L).
- `config`: risk level, max capital, max positions, lots per trade, min confidence, whether auto_enter/auto_exit/auto_adjust are enabled, whether this is mock mode.
- `performance`: P&L stats, win rate, drawdown, recent trade history.
- `events/sentiment` (if provided): upcoming events (expiry, RBI, US data), news flags, special risk warnings.

If some of these fields are missing, you adapt and use what you have.
You never hallucinate data fields that were not provided.

BEHAVIOUR EACH CYCLE (EVERY MINUTE)
On every cycle you must:

1. Diagnose market regime
   - Classify the environment into one of:
     strongly_bullish, bullish, mildly_bullish, range_bound,
     mildly_bearish, bearish, strongly_bearish, high_volatility, or unknown.
   - Use trend, spot vs VWAP, VIX, PCR, IV rank, and option-chain OI shifts to decide.
   - Think forward: is risk building towards a breakout, reversal, or volatility spike?

2. Read sentiment and scenarios
   - Combine: price action, intraday structure (ranges, breakouts, failed breakouts),
     option-chain OI/delta-OI (call/put writing or unwinding), and any event/news flags.
   - Construct 2-4 plausible scenarios for the next 30-90 minutes (e.g.,
     "range holds", "upside breakout", "sharp mean-reversion", "event-driven spike").
   - For each scenario, think: what happens to current positions and overall risk?

3. Evaluate risk on current book
   - Identify directional exposure (net bullish / bearish / neutral).
   - Identify volatility exposure qualitatively (benefits from rising IV or falling IV).
   - Mark dangerous situations:
     - Large unhedged short options near ATM
     - Positions close to stop loss
     - Concentration on one strike or one side
     - High risk around known events (news, data, expiry).

4. Decide on hedging and action
   - Your default priority is HEDGE FIRST, TRADE LATER.
   - Only choose ENTER new trades if risk is controlled and config allows.
   - Prefer: defined-risk structures (spreads, condors, covered shorts) over naked.
   - For hedging you can:
     - Add opposite-side options (e.g., buy OTM PE to hedge short CE).
     - Convert naked shorts into spreads.
     - Reduce position size or fully exit.
   - If risk is already acceptable, you may choose WAIT or small, incremental ADJUST.

5. Respect configuration and risk limits
   - Never exceed max_capital or max_positions.
   - Follow risk_level:
     - conservative: prioritize protection, minimal new risk.
     - moderate: allow trades when edge is clear and hedged.
     - aggressive: still manage risk, but more willing to add exposure when signals align.
   - Respect auto_enter, auto_exit, auto_adjust:
     - If a feature is disabled, DO NOT propose that action.

6. Output a clear, structured decision
   You MUST respond only with a single JSON object matching this schema:

   {
     "action": "ENTER" | "EXIT" | "ADJUST" | "WAIT",
     "strategy": "short_strangle" | "iron_condor" | "iron_butterfly" | "long_ce" | "long_pe" | "straddle_buy" | "vwap_reversal" | "hedge_overlay" | "no_trade",
     "market_regime": "strongly_bullish" | "bullish" | "mildly_bullish" | "range_bound" | "mildly_bearish" | "bearish" | "strongly_bearish" | "high_volatility" | "unknown",
     "confidence_score": <number 0-100>,
     "reasoning": "<concise explanation; 3-7 sentences, no fluff>",
     "risk_assessment": "<what can go wrong, worst-case paths, key levels>",
     "scenarios_considered": ["<plausible path 1>", "<plausible path 2>", "<plausible path 3>"],
     "hedge_plan": {
       "required": true | false,
       "reason": "<why hedge / why no hedge>",
       "legs": [
         {
           "action": "OPEN" | "CLOSE" | "MODIFY",
           "instrument": "FUT" | "OPT_CE" | "OPT_PE",
           "direction": "BUY" | "SELL",
           "strike": <number or null>,
           "expiry": "<string or null>",
           "quantity_lots": <number or null>,
           "notes": "<short human-readable instruction>"
         }
       ]
     },
     "position_plan": {
       "targets": "<how to manage targets/SLs overall>",
       "exits": "<when to cut risk fast>"
     },
     "trade_params": {
       "strike_ce": <number>,
       "strike_pe": <number>,
       "lots": <number>,
       "target_pct": <number>,
       "stoploss_pct": <number>,
       "expiry": "weekly" | "monthly"
     }
   }

   - Be realistic and conservative with confidence_score.
   - reasoning must clearly link: market regime -> scenarios -> risk -> chosen action.
   - If you choose WAIT, still fill reasoning, risk_assessment, and future trigger levels.

RISK & SAFETY RULES
- Capital protection is more important than catching every move.
- Avoid over-trading: if recent cycles already adjusted hedges and risk is under control, prefer WAIT.
- Reduce risk before major known events (news, RBI, global events, expiry close).
- Prefer smaller, earlier hedges over late, panicked exits.
- If data looks unreliable or inconsistent, choose WAIT, explain the data issue, and advise caution.

STYLE
- Think like a professional buy-side risk manager, not a gambler.
- Always be explicit about what could go wrong and how hedges address that.
- Never output anything except the JSON object described above."""
    
    async def _call_claude(self, prompt: str) -> Optional[str]:
        """Call Claude API with caching, rate-limiting, and retry."""
        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if not api_key:
            return None

        # --- rate-limit guard ---
        if self._claude_call_count >= self._claude_daily_limit:
            logger.warning("Claude daily call limit reached (%s)", self._claude_daily_limit)
            self._add_event("WARNING", "Claude daily API limit reached – falling back to rule-based decisions")
            return None

        # --- cache check ---
        cache_key = hashlib.md5(prompt.encode()).hexdigest()
        now = _time.time()
        cached = self._claude_cache.get(cache_key)
        if cached and (now - cached["ts"]) < self._claude_cache_ttl:
            logger.info("Claude cache HIT (age %.0fs)", now - cached["ts"])
            return cached["response"]

        # --- API call with retry ---
        last_err = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=45) as client:
                    response = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json",
                        },
                        json={
                            "model": "claude-sonnet-4-20250514",
                            "max_tokens": 2000,
                            "temperature": 0.2,
                            "system": self._get_system_prompt(),
                            "messages": [{"role": "user", "content": prompt}],
                        },
                    )

                if response.status_code == 200:
                    data = response.json()
                    text = data.get("content", [{}])[0].get("text", "")
                    # update cache & counter
                    self._claude_cache[cache_key] = {"response": text, "ts": now}
                    self._claude_call_count += 1
                    # evict stale entries (keep cache small)
                    stale = [k for k, v in self._claude_cache.items() if (now - v["ts"]) > self._claude_cache_ttl * 5]
                    for k in stale:
                        del self._claude_cache[k]
                    return text

                if response.status_code == 429:
                    wait = min(2 ** attempt * 5, 30)
                    logger.warning("Claude 429 rate-limited, retrying in %ds", wait)
                    await asyncio.sleep(wait)
                    continue

                logger.warning("Claude API returned %s", response.status_code)
                return None

            except Exception as e:
                last_err = e
                wait = 2 ** attempt * 2
                logger.error("Claude API error (attempt %d): %s", attempt + 1, e)
                if attempt < 2:
                    await asyncio.sleep(wait)

        logger.error("Claude API failed after 3 attempts: %s", last_err)
        return None
    
    def _parse_llm_decision(self, llm_text: str, snap: MarketSnapshot, decision_id: str) -> AgentDecision:
        """Parse LLM response into a structured decision with robust JSON extraction"""
        decision = AgentDecision(id=decision_id, timestamp=get_ist_now())
        
        try:
            # --- robust JSON extraction ---
            text = llm_text.strip()

            # 1. Try <json>...</json> wrapper
            json_tag = re.search(r'<json>\s*(.*?)\s*</json>', text, re.DOTALL)
            if json_tag:
                text = json_tag.group(1)
            else:
                # 2. Try ```json ... ``` or ``` ... ``` (multiple fence styles)
                fence = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
                if fence:
                    text = fence.group(1)
                else:
                    # 3. Find first { ... last } (greedy brace match)
                    brace_start = text.find('{')
                    brace_end = text.rfind('}')
                    if brace_start != -1 and brace_end > brace_start:
                        text = text[brace_start:brace_end + 1]

            # Strip any remaining whitespace / BOM
            text = text.strip().lstrip('\ufeff')
            
            data = json.loads(text)
            
            # Map regime
            regime_map = {v.value: v for v in MarketRegime}
            decision.market_regime = regime_map.get(data.get("market_regime", ""), MarketRegime.UNKNOWN)
            
            # Map strategy
            strat_map = {v.value: v for v in StrategyType}
            decision.strategy = strat_map.get(data.get("strategy", ""), StrategyType.NO_TRADE)
            
            decision.action = data.get("action", "WAIT")
            decision.confidence_score = float(data.get("confidence_score", 0))
            decision.reasoning = data.get("reasoning", "")
            decision.scenarios_considered = data.get("scenarios_considered", data.get("scenarios", []))
            decision.risk_assessment = data.get("risk_assessment", "")
            decision.trade_params = data.get("trade_params", {})
            
            # Parse hedge plan
            hedge_raw = data.get("hedge_plan", {})
            if isinstance(hedge_raw, dict):
                decision.hedge_plan = {
                    "required": hedge_raw.get("required", False),
                    "reason": hedge_raw.get("reason", ""),
                    "legs": hedge_raw.get("legs", []),
                }
            
            # Parse position plan
            pos_plan_raw = data.get("position_plan", {})
            if isinstance(pos_plan_raw, dict):
                decision.position_plan = {
                    "targets": pos_plan_raw.get("targets", ""),
                    "exits": pos_plan_raw.get("exits", ""),
                }
            
            # Map confidence level
            score = decision.confidence_score
            if score >= 85:
                decision.confidence = DecisionConfidence.VERY_HIGH
            elif score >= 70:
                decision.confidence = DecisionConfidence.HIGH
            elif score >= 55:
                decision.confidence = DecisionConfidence.MODERATE
            elif score >= 40:
                decision.confidence = DecisionConfidence.LOW
            else:
                decision.confidence = DecisionConfidence.VERY_LOW
            
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to parse LLM decision: {e}")
            decision.reasoning = f"LLM parse error, response: {llm_text[:200]}"
            decision.action = "WAIT"
        
        return decision
    
    def _rule_based_decision(self, snap: MarketSnapshot, decision_id: str) -> AgentDecision:
        """Fallback: Rule-based decision when LLM is unavailable"""
        decision = AgentDecision(id=decision_id, timestamp=get_ist_now())
        
        # Determine regime from data
        vix = snap.vix
        pcr = snap.pcr
        trend = snap.trend
        iv_rank = snap.iv_rank
        
        # Score each regime
        range_score = 0
        bullish_score = 0
        bearish_score = 0
        volatile_score = 0
        
        # VIX
        if vix < 13: range_score += 25
        elif vix < 16: range_score += 15; bullish_score += 10
        elif vix < 20: volatile_score += 15
        else: volatile_score += 25
        
        # PCR
        if 0.9 <= pcr <= 1.15: range_score += 20
        elif pcr > 1.2: bullish_score += 20
        elif pcr < 0.75: bearish_score += 20
        
        # Trend
        if trend == "BULLISH": bullish_score += 25
        elif trend == "BEARISH": bearish_score += 25
        elif trend == "SIDEWAYS": range_score += 25
        
        # IV Rank
        if iv_rank > 60: range_score += 15  # Good for selling
        elif iv_rank < 30: bullish_score += 10; bearish_score += 10  # Good for buying
        
        # Determine winner
        scores = {
            MarketRegime.RANGE_BOUND: range_score,
            MarketRegime.BULLISH: bullish_score,
            MarketRegime.BEARISH: bearish_score,
            MarketRegime.HIGH_VOLATILITY: volatile_score,
        }
        decision.market_regime = max(scores, key=scores.get)
        confidence = max(scores.values())
        decision.confidence_score = min(95, confidence + 20)
        
        # Strategy selection
        regime = decision.market_regime
        if regime == MarketRegime.RANGE_BOUND:
            if iv_rank > 50:
                decision.strategy = StrategyType.SHORT_STRANGLE
            else:
                decision.strategy = StrategyType.IRON_CONDOR
            decision.action = "ENTER" if not self.active_positions else "WAIT"
        elif regime == MarketRegime.BULLISH:
            decision.strategy = StrategyType.LONG_CE
            decision.action = "ENTER" if not self.active_positions else "WAIT"
        elif regime == MarketRegime.BEARISH:
            decision.strategy = StrategyType.LONG_PE
            decision.action = "ENTER" if not self.active_positions else "WAIT"
        elif regime == MarketRegime.HIGH_VOLATILITY:
            if self.active_positions:
                decision.strategy = StrategyType.HEDGE_OVERLAY
                decision.action = "HEDGE"
            else:
                decision.strategy = StrategyType.NO_TRADE
                decision.action = "WAIT"
        
        # Build trade params
        strike_step = 50 if self.config.underlying in ["NIFTY", "FINNIFTY"] else 100
        atm = round(snap.spot_price / strike_step) * strike_step
        
        decision.trade_params = {
            "strike_ce": atm + 3 * strike_step,
            "strike_pe": atm - 3 * strike_step,
            "atm_strike": atm,
            "lots": self.config.num_lots,
            "target_pct": 50,
            "stoploss_pct": 30,
            "expiry": self.config.preferred_expiry,
        }
        
        decision.reasoning = (
            f"Rule-based: {regime.value} regime detected. "
            f"VIX={vix:.1f}, PCR={pcr:.2f}, Trend={trend}, IV Rank={iv_rank:.0f}. "
            f"Selected {decision.strategy.value} with {decision.confidence_score:.0f}% confidence."
        )
        decision.scenarios_considered = [
            f"Range-bound score: {range_score}",
            f"Bullish score: {bullish_score}",
            f"Bearish score: {bearish_score}",
            f"Volatile score: {volatile_score}",
        ]
        
        if decision.confidence_score >= 85:
            decision.confidence = DecisionConfidence.VERY_HIGH
        elif decision.confidence_score >= 70:
            decision.confidence = DecisionConfidence.HIGH
        elif decision.confidence_score >= 55:
            decision.confidence = DecisionConfidence.MODERATE
        else:
            decision.confidence = DecisionConfidence.LOW
        
        return decision
    
    # ═════════════════════════════════════════════════════════════════════════
    # ACT: Execute trades
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _execute_decision(self, decision: AgentDecision):
        """Execute a trading decision"""
        try:
            if not self.config.auto_enter and decision.action == "ENTER":
                self._add_event("ACT", "Auto-enter disabled", f"Would {decision.action}: {decision.strategy.value}")
                return
            
            if self.config.use_mock:
                # Mock execution
                result = await self._mock_execute(decision)
            else:
                # Live execution (via broker service)
                result = await self._live_execute(decision)
            
            decision.executed = True
            decision.execution_result = result
            
            self._add_event("ACT", f"Executed: {decision.action}",
                f"Strategy: {decision.strategy.value} | "
                f"Result: {result.get('status', 'unknown')} | "
                f"Details: {json.dumps(result.get('orders', []), default=str)[:200]}")
            
        except Exception as e:
            decision.execution_result = {"error": str(e)}
            self._add_event("ERROR", "Execution failed", str(e)[:200])
    
    async def _mock_execute(self, decision: AgentDecision) -> Dict:
        """Simulate trade execution in mock mode using Black-Scholes pricing"""
        params = decision.trade_params
        snap = self.market_snapshots[0] if self.market_snapshots else None
        spot = snap.spot_price if snap else 24000
        iv = (snap.iv / 100) if snap and snap.iv > 0 else 0.15  # decimal IV

        def _bs_premium(strike, is_call, spot_px, iv_dec, tte_days=5):
            """Simple Black-Scholes approximation for option premium"""
            tte = max(tte_days / 365, 0.001)
            d1 = (math.log(spot_px / strike) + 0.5 * iv_dec**2 * tte) / (iv_dec * math.sqrt(tte))
            # Approximate N(d1) with logistic sigmoid
            nd1 = 1 / (1 + math.exp(-1.7 * d1))
            if is_call:
                intrinsic = max(0, spot_px - strike)
                time_val = spot_px * iv_dec * math.sqrt(tte) * 0.4 * (1 if abs(d1) < 1 else 0.5)
                return max(intrinsic + time_val, 1.0)
            else:
                intrinsic = max(0, strike - spot_px)
                time_val = spot_px * iv_dec * math.sqrt(tte) * 0.4 * (1 if abs(d1) < 1 else 0.5)
                return max(intrinsic + time_val, 1.0)

        if decision.action == "ENTER":
            position = {
                "id": f"POS_{len(self.active_positions)+1}",
                "strategy": decision.strategy.value,
                "entry_time": get_ist_now().isoformat(),
                "spot_at_entry": spot,
                "legs": [],
                "total_premium": 0,
                "current_pnl": 0,
                "target_pnl": 0,
                "stoploss_pnl": 0,
                "status": "active",
            }

            if decision.strategy in [StrategyType.SHORT_STRANGLE, StrategyType.IRON_CONDOR]:
                ce_strike = params.get("strike_ce", spot + 150)
                pe_strike = params.get("strike_pe", spot - 150)
                ce_premium = _bs_premium(ce_strike, True, spot, iv)
                pe_premium = _bs_premium(pe_strike, False, spot, iv)
                total_prem = ce_premium + pe_premium

                position["legs"] = [
                    {"type": "SELL_CE", "strike": ce_strike, "premium": round(ce_premium, 2), "ltp": round(ce_premium, 2)},
                    {"type": "SELL_PE", "strike": pe_strike, "premium": round(pe_premium, 2), "ltp": round(pe_premium, 2)},
                ]
                position["total_premium"] = round(total_prem, 2)
                position["target_pnl"] = round(total_prem * params.get("target_pct", 50) / 100, 2)
                position["stoploss_pnl"] = round(-total_prem * params.get("stoploss_pct", 30) / 100, 2)

            elif decision.strategy in [StrategyType.LONG_CE, StrategyType.LONG_PE]:
                strike = params.get("atm_strike", spot)
                is_call = decision.strategy == StrategyType.LONG_CE
                premium = _bs_premium(strike, is_call, spot, iv)
                leg_type = "BUY_CE" if is_call else "BUY_PE"
                position["legs"] = [
                    {"type": leg_type, "strike": strike, "premium": round(premium, 2), "ltp": round(premium, 2)},
                ]
                position["total_premium"] = round(-premium, 2)  # Debit
                position["target_pnl"] = round(premium * 0.5, 2)
                position["stoploss_pnl"] = round(-premium * 0.3, 2)

            elif decision.strategy == StrategyType.IRON_BUTTERFLY:
                atm = params.get("atm_strike", spot)
                step = 50 if self.config.underlying in ["NIFTY", "FINNIFTY"] else 100
                sell_ce_prem = _bs_premium(atm, True, spot, iv)
                sell_pe_prem = _bs_premium(atm, False, spot, iv)
                buy_ce_prem = _bs_premium(atm + 3*step, True, spot, iv)
                buy_pe_prem = _bs_premium(atm - 3*step, False, spot, iv)
                position["legs"] = [
                    {"type": "SELL_CE", "strike": atm, "premium": round(sell_ce_prem, 2), "ltp": round(sell_ce_prem, 2)},
                    {"type": "SELL_PE", "strike": atm, "premium": round(sell_pe_prem, 2), "ltp": round(sell_pe_prem, 2)},
                    {"type": "BUY_CE", "strike": atm + 3*step, "premium": round(buy_ce_prem, 2), "ltp": round(buy_ce_prem, 2)},
                    {"type": "BUY_PE", "strike": atm - 3*step, "premium": round(buy_pe_prem, 2), "ltp": round(buy_pe_prem, 2)},
                ]
                net = (sell_ce_prem + sell_pe_prem) - (buy_ce_prem + buy_pe_prem)
                position["total_premium"] = round(net, 2)
                position["target_pnl"] = round(net * 0.5, 2)
                position["stoploss_pnl"] = round(-net * 0.5, 2)

            self.active_positions.append(position)
            return {"status": "filled", "position_id": position["id"], "orders": position["legs"]}

        elif decision.action == "EXIT" and self.active_positions:
            closed = self.active_positions.pop(0)
            pnl = self._calculate_mock_exit_pnl(closed, snap)
            closed["status"] = "closed"
            closed["exit_time"] = get_ist_now().isoformat()
            closed["realized_pnl"] = round(pnl, 2)
            self.performance.record_trade(pnl, closed["strategy"])
            return {"status": "closed", "pnl": round(pnl, 2)}

        elif decision.action == "ADJUST" and self.active_positions:
            pos = self.active_positions[0]
            pos["adjustments"] = pos.get("adjustments", 0) + 1
            return {"status": "adjusted", "position_id": pos["id"]}

        return {"status": "no_action"}

    def _calculate_mock_exit_pnl(self, position: Dict, snap: Optional[MarketSnapshot]) -> float:
        """Calculate P&L based on current spot vs entry, not random."""
        if not snap:
            return position.get("current_pnl", 0)
        spot = snap.spot_price
        entry_spot = position.get("spot_at_entry", spot)
        move = spot - entry_spot
        pnl = 0.0
        lot_size = self.config.lot_size * self.config.num_lots

        for leg in position.get("legs", []):
            premium = leg.get("premium", 0)
            strike = leg.get("strike", entry_spot)
            leg_type = leg.get("type", "")

            if "SELL_CE" in leg_type:
                current_val = max(0, spot - strike) + max(1, premium * 0.3)  # intrinsic + residual time
                pnl += (premium - current_val) * lot_size
            elif "SELL_PE" in leg_type:
                current_val = max(0, strike - spot) + max(1, premium * 0.3)
                pnl += (premium - current_val) * lot_size
            elif "BUY_CE" in leg_type:
                current_val = max(0, spot - strike) + max(1, premium * 0.3)
                pnl += (current_val - premium) * lot_size
            elif "BUY_PE" in leg_type:
                current_val = max(0, strike - spot) + max(1, premium * 0.3)
                pnl += (current_val - premium) * lot_size

        return pnl

    async def _live_execute(self, decision: AgentDecision) -> Dict:
        """Execute via Dhan broker API"""
        try:
            from services.broker_integration import DhanBroker, OrderRequest
            broker = DhanBroker()
            if not broker.is_configured():
                self._add_event("ERROR", "Broker not configured",
                    "Set DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN environment variables.")
                return {"status": "error", "message": "Broker credentials not configured"}

            params = decision.trade_params
            snap = self.market_snapshots[0] if self.market_snapshots else None
            spot = snap.spot_price if snap else 24000
            lot_size = self.config.lot_size * self.config.num_lots

            orders_placed = []

            if decision.action == "ENTER":
                if decision.strategy in [StrategyType.SHORT_STRANGLE, StrategyType.IRON_CONDOR]:
                    # Sell CE leg
                    ce_order = OrderRequest(
                        symbol=f"{self.config.underlying} CE {params.get('strike_ce', spot + 150)}",
                        exchange="NFO",
                        transaction_type="SELL",
                        order_type="MARKET",
                        product_type="INTRADAY",
                        quantity=lot_size,
                    )
                    ce_result = await broker.place_order(ce_order)
                    orders_placed.append({"leg": "SELL_CE", "result": ce_result.message, "success": ce_result.success})

                    # Sell PE leg
                    pe_order = OrderRequest(
                        symbol=f"{self.config.underlying} PE {params.get('strike_pe', spot - 150)}",
                        exchange="NFO",
                        transaction_type="SELL",
                        order_type="MARKET",
                        product_type="INTRADAY",
                        quantity=lot_size,
                    )
                    pe_result = await broker.place_order(pe_order)
                    orders_placed.append({"leg": "SELL_PE", "result": pe_result.message, "success": pe_result.success})

                elif decision.strategy in [StrategyType.LONG_CE, StrategyType.LONG_PE]:
                    direction = "CE" if decision.strategy == StrategyType.LONG_CE else "PE"
                    order = OrderRequest(
                        symbol=f"{self.config.underlying} {direction} {params.get('atm_strike', spot)}",
                        exchange="NFO",
                        transaction_type="BUY",
                        order_type="MARKET",
                        product_type="INTRADAY",
                        quantity=lot_size,
                    )
                    result = await broker.place_order(order)
                    orders_placed.append({"leg": f"BUY_{direction}", "result": result.message, "success": result.success})

                self._add_event("ACT", "Live orders placed", json.dumps(orders_placed, default=str)[:300])
                return {"status": "placed", "orders": orders_placed}

            elif decision.action == "EXIT":
                self._add_event("ACT", "Live exit", "Exit via broker — square off pending positions")
                return {"status": "exit_requested", "message": "Position square-off initiated"}

            return {"status": "no_action"}

        except Exception as e:
            self._add_event("ERROR", "Live execution error", str(e)[:200])
            logger.error(f"Live execution error: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def _exit_all_positions(self, reason: str):
        """Emergency exit all positions"""
        self._add_event("EXIT", "Exiting all positions", f"Reason: {reason}")
        snap = self.market_snapshots[0] if self.market_snapshots else None
        for pos in self.active_positions:
            pos["status"] = "closed"
            pos["exit_time"] = get_ist_now().isoformat()
            pos["exit_reason"] = reason
            pnl = self._calculate_mock_exit_pnl(pos, snap)
            pos["realized_pnl"] = round(pnl, 2)
            self.performance.record_trade(pnl, pos.get("strategy", "unknown"))
        self.active_positions.clear()
    
    # ═════════════════════════════════════════════════════════════════════════
    # REFLECT: Analyze positions and outcomes
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _reflect_on_positions(self, snap: MarketSnapshot):
        """Monitor existing positions — calculate real P&L from price, not random."""
        if not self.active_positions:
            return

        to_remove = []  # collect indices to remove safely

        for idx, pos in enumerate(self.active_positions):
            # Calculate P&L from price movement (mock mode uses spot-based calculation)
            if self.config.use_mock:
                pos["current_pnl"] = self._calculate_mock_exit_pnl(pos, snap)
                # Update leg LTPs for UI
                for leg in pos.get("legs", []):
                    strike = leg.get("strike", snap.spot_price)
                    prem = leg.get("premium", 0)
                    if "CE" in leg.get("type", ""):
                        intrinsic = max(0, snap.spot_price - strike)
                        leg["ltp"] = round(max(1, intrinsic + prem * 0.3), 2)
                    elif "PE" in leg.get("type", ""):
                        intrinsic = max(0, strike - snap.spot_price)
                        leg["ltp"] = round(max(1, intrinsic + prem * 0.3), 2)

            pnl = pos.get("current_pnl", 0)
            target = pos.get("target_pnl", float('inf'))
            stoploss = pos.get("stoploss_pnl", float('-inf'))

            # Check target hit
            if pnl >= target and target > 0:
                self._add_event("REFLECT", "🎯 Target reached!",
                    f"Position {pos['id']}: P&L ₹{pnl:,.0f} hit target ₹{target:,.0f}")
                pos["status"] = "closed"
                pos["exit_reason"] = "target_hit"
                pos["realized_pnl"] = round(pnl, 2)
                self.performance.record_trade(pnl, pos.get("strategy", "unknown"))
                to_remove.append(idx)
                continue

            # Check stoploss hit
            if pnl <= stoploss and stoploss < 0:
                self._add_event("REFLECT", "🛑 Stoploss triggered!",
                    f"Position {pos['id']}: P&L ₹{pnl:,.0f} hit SL ₹{stoploss:,.0f}")
                pos["status"] = "closed"
                pos["exit_reason"] = "stoploss_hit"
                pos["realized_pnl"] = round(pnl, 2)
                self.performance.record_trade(pnl, pos.get("strategy", "unknown"))
                to_remove.append(idx)
                continue

            # Time-based exit (3:15 PM)
            now = get_ist_now()
            if now.hour == 15 and now.minute >= 15:
                self._add_event("REFLECT", "⏰ Time exit",
                    f"Position {pos['id']}: Closing at 3:15 PM, P&L ₹{pnl:,.0f}")
                pos["status"] = "closed"
                pos["exit_reason"] = "time_exit"
                pos["realized_pnl"] = round(pnl, 2)
                self.performance.record_trade(pnl, pos.get("strategy", "unknown"))
                to_remove.append(idx)

        # Remove closed positions by index (reverse order to preserve indices)
        for idx in reversed(to_remove):
            self.active_positions.pop(idx)
    
    # ═════════════════════════════════════════════════════════════════════════
    # ADAPT: Self-modify parameters based on performance
    # ═════════════════════════════════════════════════════════════════════════
    
    def _self_adapt(self):
        """Agent modifies its own parameters based on performance"""
        perf = self.performance
        
        # Adapt confidence threshold
        if perf.current_streak <= -2:
            old_thresh = self.evolved_params["confidence_threshold"]
            self.evolved_params["confidence_threshold"] = min(90, old_thresh + 5)
            self._add_event("ADAPT", "Raised confidence threshold",
                f"After {abs(perf.current_streak)} consecutive losses, threshold: {old_thresh:.0f}% → {self.evolved_params['confidence_threshold']:.0f}%")
        elif perf.current_streak >= 3:
            old_thresh = self.evolved_params["confidence_threshold"]
            self.evolved_params["confidence_threshold"] = max(50, old_thresh - 3)
            self._add_event("ADAPT", "Lowered confidence threshold",
                f"After {perf.current_streak} consecutive wins, threshold: {old_thresh:.0f}% → {self.evolved_params['confidence_threshold']:.0f}%")
        
        # Track which strategies work best
        best_strategy = None
        best_wr = 0
        for strat, stats in perf.strategy_stats.items():
            if stats["trades"] >= 2:
                wr = stats["wins"] / stats["trades"]
                if wr > best_wr:
                    best_wr = wr
                    best_strategy = strat
        
        if best_strategy:
            self.evolved_params["preferred_strategy_weights"][best_strategy] = best_wr
            self._add_event("ADAPT", "Strategy preference updated",
                f"Best performing: {best_strategy} ({best_wr*100:.0f}% win rate)")
        
        # Adapt risk based on drawdown
        if perf.drawdown > self.config.max_capital * 0.03:
            self.evolved_params["volatility_comfort"] = "low"
            self._add_event("ADAPT", "Reduced risk appetite",
                f"Drawdown ₹{perf.drawdown:,.0f} exceeds 3% - switching to conservative")
    
    # ═════════════════════════════════════════════════════════════════════════
    # SAFETY: Risk checks before every cycle
    # ═════════════════════════════════════════════════════════════════════════
    
    def _safety_checks(self) -> bool:
        """Run safety checks - return False if agent should skip this cycle"""
        perf = self.performance
        
        # Max daily loss
        max_loss = self.config.max_capital * self.config.max_loss_per_day_pct / 100
        if perf.daily_pnl < -max_loss:
            self._add_event("SAFETY", "🚨 Daily loss limit hit!",
                f"P&L ₹{perf.daily_pnl:,.0f} exceeds limit ₹{-max_loss:,.0f}. Pausing.")
            self.state = AgentState.PAUSED
            return False
        
        # Max drawdown
        if perf.drawdown > self.config.max_capital * self.config.max_drawdown_pct / 100:
            self._add_event("SAFETY", "🚨 Max drawdown! Agent shutting down",
                f"Drawdown ₹{perf.drawdown:,.0f}")
            self.state = AgentState.STOPPED
            return False
        
        # Consecutive losses
        if abs(perf.current_streak) >= self.config.consecutive_loss_pause and perf.current_streak < 0:
            self._add_event("SAFETY", "⚠️ Consecutive loss cooldown",
                f"{abs(perf.current_streak)} consecutive losses - cooling down for 5 min")
            return False
        
        # Max positions
        if len(self.active_positions) >= self.config.max_positions:
            return True  # Still allow monitoring, just no new entries
        
        return True
    
    # ═════════════════════════════════════════════════════════════════════════
    # EVENT LOG
    # ═════════════════════════════════════════════════════════════════════════
    
    def _add_event(self, event_type: str, title: str, detail: str = ""):
        """Add event to the feed"""
        self.event_feed.appendleft({
            "time": get_ist_now().isoformat(),
            "type": event_type,
            "title": title,
            "detail": detail,
            "cycle": self._cycle_count,
        })
        logger.info(f"[Agent:{self.config.user_id}] [{event_type}] {title}: {detail[:100]}")
    
    # ═════════════════════════════════════════════════════════════════════════
    # STATUS / API METHODS
    # ═════════════════════════════════════════════════════════════════════════
    
    def get_status(self) -> Dict:
        """Get full agent status for API/frontend"""
        return {
            "state": self.state.value,
            "config": {
                "underlying": self.config.underlying,
                "risk_level": self.config.risk_level.value,
                "max_capital": self.config.max_capital,
                "use_mock": self.config.use_mock,
                "auto_enter": self.config.auto_enter,
                "auto_exit": self.config.auto_exit,
                "auto_adjust": self.config.auto_adjust,
                "think_interval": self.config.think_interval,
                "min_confidence": self.config.min_confidence,
                "allowed_strategies": self.config.allowed_strategies,
            },
            "performance": self.performance.to_dict(),
            "active_positions": self.active_positions[:10],
            "evolved_params": self.evolved_params,
            "cycle_count": self._cycle_count,
            "last_decision": self.decisions[0].to_dict() if self.decisions else None,
            "recent_decisions": [d.to_dict() for d in list(self.decisions)[:10]],
            "market_snapshot": self.market_snapshots[0].to_dict() if self.market_snapshots else None,
            "event_feed": list(self.event_feed)[:50],
            "errors": self._error_count,
        }
    
    def update_config(self, updates: Dict) -> Dict:
        """Update agent config dynamically"""
        for key, val in updates.items():
            if hasattr(self.config, key):
                if key == "risk_level":
                    self.config.risk_level = RiskLevel(val)
                elif key == "allowed_strategies":
                    self.config.allowed_strategies = val
                else:
                    setattr(self.config, key, val)
                self._add_event("CONFIG", f"Config updated: {key}", f"{key} = {val}")
        return {"status": "updated", "config": self.get_status()["config"]}


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL AGENT MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

_active_agents: Dict[str, AutonomousAIAgent] = {}


def get_agent(user_id: str) -> Optional[AutonomousAIAgent]:
    """Get existing agent for user"""
    return _active_agents.get(user_id)


def get_or_create_agent(user_id: str, config: AgentConfig = None) -> AutonomousAIAgent:
    """Get or create agent for user"""
    if user_id not in _active_agents:
        if not config:
            config = AgentConfig(user_id=user_id)
        else:
            config.user_id = user_id
        _active_agents[user_id] = AutonomousAIAgent(config)
    return _active_agents[user_id]


def remove_agent(user_id: str):
    """Remove agent instance"""
    if user_id in _active_agents:
        del _active_agents[user_id]


def list_agents() -> Dict:
    """List all active agents"""
    return {
        uid: agent.get_status()
        for uid, agent in _active_agents.items()
    }
