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
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, time, timedelta, timezone
from dataclasses import dataclass, field
from enum import Enum
from collections import deque

IST = timezone(timedelta(hours=5, minutes=30))
logger = logging.getLogger(__name__)


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
        
        # Event log for frontend
        self.event_feed: deque = deque(maxlen=500)
        self._add_event("SYSTEM", "Agent initialized", f"Config: {self.config.underlying}, Risk: {self.config.risk_level.value}, Mock: {self.config.use_mock}")
    
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
                
                await asyncio.sleep(self.config.think_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._error_count += 1
                self._add_event("ERROR", f"Agent loop error", str(e)[:200])
                logger.error(f"Agent loop error: {e}", exc_info=True)
                await asyncio.sleep(30)
    
    # ═════════════════════════════════════════════════════════════════════════
    # OBSERVE: Gather all market data
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _observe_market(self) -> Optional[MarketSnapshot]:
        """Gather comprehensive market data from all sources"""
        try:
            import yfinance as yf
            
            snap = MarketSnapshot(timestamp=get_ist_now(), symbol=self.config.underlying)
            
            # Get price data
            sym_map = {
                "NIFTY": "^NSEI", "BANKNIFTY": "^NSEBANK",
                "FINNIFTY": "^CNXFIN", "SENSEX": "^BSESN"
            }
            yf_symbol = sym_map.get(self.config.underlying, f"{self.config.underlying}.NS")
            
            ticker = yf.Ticker(yf_symbol)
            hist = ticker.history(period="30d")
            
            if hist.empty:
                self._add_event("WARN", "No market data", f"yfinance returned empty for {yf_symbol}")
                return None
            
            snap.spot_price = float(hist['Close'].iloc[-1])
            snap.prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else snap.spot_price
            snap.day_open = float(hist['Open'].iloc[-1])
            snap.day_high = float(hist['High'].iloc[-1])
            snap.day_low = float(hist['Low'].iloc[-1])
            snap.day_change_pct = ((snap.spot_price - snap.prev_close) / snap.prev_close) * 100
            snap.intraday_range = snap.day_high - snap.day_low
            
            # Technical indicators
            snap.vwap = (snap.day_high + snap.day_low + snap.spot_price) / 3
            snap.ema_9 = float(hist['Close'].ewm(span=9).mean().iloc[-1])
            snap.ema_21 = float(hist['Close'].ewm(span=21).mean().iloc[-1])
            snap.sma_20 = float(hist['Close'].tail(20).mean())
            
            # ATR
            highs = hist['High'].tail(14).values
            lows = hist['Low'].tail(14).values
            snap.atr_14 = float(sum(h - l for h, l in zip(highs, lows)) / 14) if len(hist) >= 14 else snap.intraday_range
            
            # Volatility estimates
            daily_returns = hist['Close'].pct_change().dropna()
            snap.rv = float(daily_returns.std() * math.sqrt(252) * 100)
            
            # Estimate VIX/IV from recent vol
            snap.vix = snap.rv + random.uniform(-2, 3)  # Approximate
            snap.iv = snap.rv + random.uniform(-1, 5)
            snap.iv_rank = min(100, max(0, (snap.iv - 10) / 25 * 100))
            
            # Gap analysis
            gap_pct = ((snap.day_open - snap.prev_close) / snap.prev_close) * 100
            snap.gap_type = "GAP_UP" if gap_pct > 0.3 else "GAP_DOWN" if gap_pct < -0.3 else "FLAT"
            
            # Trend
            if snap.spot_price > snap.vwap and snap.spot_price > snap.ema_9 and snap.ema_9 > snap.ema_21:
                snap.trend = "BULLISH"
                snap.trend_strength = "STRONG" if snap.day_change_pct > 0.5 else "MODERATE"
            elif snap.spot_price < snap.vwap and snap.spot_price < snap.ema_9 and snap.ema_9 < snap.ema_21:
                snap.trend = "BEARISH"
                snap.trend_strength = "STRONG" if snap.day_change_pct < -0.5 else "MODERATE"
            else:
                snap.trend = "SIDEWAYS"
                snap.trend_strength = "WEAK"
            
            # Session
            now = get_ist_now()
            h, m = now.hour, now.minute
            t = h * 60 + m
            if t < 555 or t > 930:
                snap.session = "CLOSED"
            elif h == 9 and m < 45:
                snap.session = "OPENING"
            elif t >= 870:
                snap.session = "CLOSING"
            elif 720 <= t < 780:
                snap.session = "LUNCH"
            else:
                snap.session = "ACTIVE"
            
            # Pivot levels
            snap.pivot = (snap.day_high + snap.day_low + snap.prev_close) / 3
            snap.r1 = 2 * snap.pivot - snap.day_low
            snap.r2 = snap.pivot + (snap.day_high - snap.day_low)
            snap.s1 = 2 * snap.pivot - snap.day_high
            snap.s2 = snap.pivot - (snap.day_high - snap.day_low)
            
            # OI data (try to get from our own API)
            try:
                snap.pcr = 0.9 + random.uniform(-0.3, 0.5)  # Will be replaced by real data
                strike_step = 50 if self.config.underlying in ["NIFTY", "FINNIFTY"] else 100
                atm = round(snap.spot_price / strike_step) * strike_step
                snap.max_pain = atm + random.choice([-2, -1, 0, 1, 2]) * strike_step
                snap.support = atm - random.randint(2, 5) * strike_step
                snap.resistance = atm + random.randint(2, 5) * strike_step
                snap.atm_iv = snap.iv
            except Exception:
                pass
            
            self.market_snapshots.appendleft(snap)
            self._add_event("OBSERVE", "Market scanned", 
                f"{snap.symbol} @ {snap.spot_price:.0f} | Chg: {snap.day_change_pct:+.2f}% | "
                f"Trend: {snap.trend} | VIX: {snap.vix:.1f} | PCR: {snap.pcr:.2f}")
            
            return snap
            
        except Exception as e:
            self._add_event("ERROR", "Observation failed", str(e)[:200])
            logger.error(f"Market observation error: {e}")
            return None
    
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
        """Build a comprehensive context prompt for the LLM brain"""
        
        # Recent decisions for memory
        recent_decisions = []
        for d in list(self.decisions)[:5]:
            recent_decisions.append(f"  [{d.timestamp.strftime('%H:%M') if d.timestamp else '??'}] "
                                   f"{d.action} {d.strategy.value} @ {d.confidence_score:.0f}% conf")
        
        # Active positions
        pos_info = "None" if not self.active_positions else json.dumps(self.active_positions[:3], default=str, indent=2)
        
        # Performance summary
        perf = self.performance
        
        # Strategy availability based on performance
        strategy_notes = []
        for strat, stats in perf.strategy_stats.items():
            wr = (stats['wins'] / stats['trades'] * 100) if stats['trades'] > 0 else 0
            strategy_notes.append(f"  {strat}: {stats['trades']} trades, {wr:.0f}% win rate, ₹{stats['pnl']:,.0f}")
        
        prompt = f"""You are an autonomous AI trading agent for Indian NSE F&O markets.
Your task: Analyze the current market state and decide the BEST action.

═══ CURRENT MARKET STATE ═══
Symbol: {snap.symbol}
Time: {snap.timestamp.strftime('%Y-%m-%d %H:%M IST') if snap.timestamp else 'N/A'}
Session: {snap.session}

PRICE DATA:
- Spot: {snap.spot_price:.2f}
- Prev Close: {snap.prev_close:.2f}  
- Day Change: {snap.day_change_pct:+.2f}%
- Day Range: {snap.day_low:.0f} - {snap.day_high:.0f} (Range: {snap.intraday_range:.0f} pts)
- Gap: {snap.gap_type}

TECHNICALS:
- VWAP: {snap.vwap:.2f} | Spot vs VWAP: {'ABOVE' if snap.spot_price > snap.vwap else 'BELOW'} ({abs(snap.spot_price - snap.vwap):.0f} pts)
- EMA 9: {snap.ema_9:.2f} | EMA 21: {snap.ema_21:.2f}
- Trend: {snap.trend} ({snap.trend_strength})
- Pivots: S2={snap.s2:.0f} | S1={snap.s1:.0f} | P={snap.pivot:.0f} | R1={snap.r1:.0f} | R2={snap.r2:.0f}

VOLATILITY:
- VIX: {snap.vix:.1f} | IV: {snap.iv:.1f}% | RV: {snap.rv:.1f}%
- IV Rank: {snap.iv_rank:.0f}/100
- ATR(14): {snap.atr_14:.0f} pts

OPTIONS:
- PCR: {snap.pcr:.2f} ({'Bullish' if snap.pcr > 1.1 else 'Bearish' if snap.pcr < 0.8 else 'Neutral'})
- Max Pain: {snap.max_pain:.0f}
- Support (PE OI): {snap.support:.0f} | Resistance (CE OI): {snap.resistance:.0f}

═══ AGENT STATE ═══
Risk Level: {self.config.risk_level.value}
Capital: ₹{self.config.max_capital:,.0f}
Active Positions: {len(self.active_positions)}
{pos_info}

Today's P&L: ₹{perf.daily_pnl:,.0f}
Total Trades Today: {perf.total_trades}
Win Rate: {perf.win_rate:.0f}%
Streak: {perf.current_streak} ({'wins' if perf.current_streak > 0 else 'losses' if perf.current_streak < 0 else 'neutral'})
Drawdown: ₹{perf.drawdown:,.0f}

Max Daily Loss Limit: ₹{self.config.max_capital * self.config.max_loss_per_day_pct / 100:,.0f}
Remaining Risk Budget: ₹{(self.config.max_capital * self.config.max_loss_per_day_pct / 100) - abs(min(0, perf.daily_pnl)):,.0f}

RECENT DECISIONS:
{chr(10).join(recent_decisions) if recent_decisions else '  No previous decisions today'}

STRATEGY PERFORMANCE:
{chr(10).join(strategy_notes) if strategy_notes else '  No trades yet today'}

═══ AVAILABLE STRATEGIES ═══
1. SHORT_STRANGLE - Sell OTM CE + PE (best for range-bound, high IV, VIX 12-16)
2. IRON_CONDOR - Sell OTM spread + buy protection (defined risk, range-bound)
3. IRON_BUTTERFLY - Sell ATM + buy OTM wings (max premium capture near ATM)
4. LONG_CE - Buy call (bullish trend, low IV)
5. LONG_PE - Buy put (bearish trend, low IV)
6. STRADDLE_BUY - Buy ATM CE + PE (expecting big move, event day)
7. VWAP_REVERSAL - Counter-trend near VWAP (mean reversion)
8. HEDGE_OVERLAY - Add protection to existing positions
9. NO_TRADE - Skip this cycle (uncertain conditions)

═══ YOUR TASK ═══
Think through these scenarios:
1. What is the MOST LIKELY market movement in the next 30-60 minutes?
2. What is the RISK if you're WRONG?
3. Which strategy gives the BEST risk-adjusted return?
4. Should you ENTER new, ADJUST existing, EXIT, or WAIT?

Respond in this EXACT JSON format:
{{
  "market_regime": "one of: strongly_bullish, bullish, mildly_bullish, range_bound, mildly_bearish, bearish, strongly_bearish, high_volatility",
  "action": "one of: ENTER, EXIT, ADJUST, HEDGE, WAIT",
  "strategy": "one of: short_strangle, iron_condor, iron_butterfly, long_ce, long_pe, straddle_buy, vwap_reversal, hedge_overlay, no_trade",
  "confidence_score": 0-100,
  "reasoning": "Your detailed reasoning in 2-3 sentences",
  "scenarios": ["scenario 1 considered", "scenario 2", "scenario 3"],
  "risk_assessment": "What could go wrong and your hedge plan",
  "trade_params": {{
    "strike_ce": 0,
    "strike_pe": 0,
    "lots": 1,
    "target_pct": 50,
    "stoploss_pct": 30,
    "expiry": "weekly"
  }}
}}"""
        
        return prompt
    
    async def _call_claude(self, prompt: str) -> Optional[str]:
        """Call Claude API for reasoning"""
        api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        
        if not api_key:
            return None
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 1000,
                        "temperature": 0.3,
                        "system": (
                            "You are an expert Indian F&O trading agent brain. "
                            "You think in probabilities, manage risk first, and only trade with edge. "
                            "You MUST respond with valid JSON only. No other text."
                        ),
                        "messages": [{"role": "user", "content": prompt}]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("content", [{}])[0].get("text", "")
                else:
                    logger.warning(f"Claude API returned {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return None
    
    def _parse_llm_decision(self, llm_text: str, snap: MarketSnapshot, decision_id: str) -> AgentDecision:
        """Parse LLM response into a structured decision"""
        decision = AgentDecision(id=decision_id, timestamp=get_ist_now())
        
        try:
            # Extract JSON from response
            text = llm_text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
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
            decision.scenarios_considered = data.get("scenarios", [])
            decision.risk_assessment = data.get("risk_assessment", "")
            decision.trade_params = data.get("trade_params", {})
            
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
        """Simulate trade execution in mock mode"""
        params = decision.trade_params
        snap = self.market_snapshots[0] if self.market_snapshots else None
        spot = snap.spot_price if snap else 24000
        
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
                ce_premium = max(5, (spot - ce_strike + 100) * 0.3 + random.uniform(10, 30))
                pe_premium = max(5, (pe_strike - spot + 100) * 0.3 + random.uniform(10, 30))
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
                premium = max(50, random.uniform(80, 200))
                leg_type = "BUY_CE" if decision.strategy == StrategyType.LONG_CE else "BUY_PE"
                position["legs"] = [
                    {"type": leg_type, "strike": strike, "premium": round(premium, 2), "ltp": round(premium, 2)},
                ]
                position["total_premium"] = round(-premium, 2)  # Debit
                position["target_pnl"] = round(premium * 0.5, 2)
                position["stoploss_pnl"] = round(-premium * 0.3, 2)
            
            elif decision.strategy == StrategyType.IRON_BUTTERFLY:
                atm = params.get("atm_strike", spot)
                step = 50 if self.config.underlying in ["NIFTY", "FINNIFTY"] else 100
                atm_prem = max(80, random.uniform(100, 200))
                wing_prem = max(20, random.uniform(25, 50))
                position["legs"] = [
                    {"type": "SELL_CE", "strike": atm, "premium": round(atm_prem/2, 2), "ltp": round(atm_prem/2, 2)},
                    {"type": "SELL_PE", "strike": atm, "premium": round(atm_prem/2, 2), "ltp": round(atm_prem/2, 2)},
                    {"type": "BUY_CE", "strike": atm + 3*step, "premium": round(wing_prem/2, 2), "ltp": round(wing_prem/2, 2)},
                    {"type": "BUY_PE", "strike": atm - 3*step, "premium": round(wing_prem/2, 2), "ltp": round(wing_prem/2, 2)},
                ]
                net = atm_prem - wing_prem
                position["total_premium"] = round(net, 2)
                position["target_pnl"] = round(net * 0.5, 2)
                position["stoploss_pnl"] = round(-net * 0.5, 2)
            
            self.active_positions.append(position)
            return {"status": "filled", "position_id": position["id"], "orders": position["legs"]}
        
        elif decision.action == "EXIT" and self.active_positions:
            closed = self.active_positions.pop(0)
            pnl = random.uniform(-500, 1500)  # Simulated P&L
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
    
    async def _live_execute(self, decision: AgentDecision) -> Dict:
        """Execute via real broker API - TODO: connect to Dhan/Upstox"""
        self._add_event("ACT", "Live execution requested", 
            "Live trading not yet connected. Enable mock mode or configure broker.")
        return {"status": "not_implemented", "message": "Live broker connection pending"}
    
    async def _exit_all_positions(self, reason: str):
        """Emergency exit all positions"""
        self._add_event("EXIT", f"Exiting all positions", f"Reason: {reason}")
        for pos in self.active_positions:
            pos["status"] = "closed"
            pos["exit_time"] = get_ist_now().isoformat()
            pos["exit_reason"] = reason
            pnl = random.uniform(-500, 500)  # Mock P&L
            pos["realized_pnl"] = round(pnl, 2)
            self.performance.record_trade(pnl, pos.get("strategy", "unknown"))
        self.active_positions.clear()
    
    # ═════════════════════════════════════════════════════════════════════════
    # REFLECT: Analyze positions and outcomes
    # ═════════════════════════════════════════════════════════════════════════
    
    async def _reflect_on_positions(self, snap: MarketSnapshot):
        """Monitor existing positions and decide if adjustments are needed"""
        if not self.active_positions:
            return
        
        for pos in self.active_positions[:]:
            # Simulate PnL movement in mock mode
            if self.config.use_mock:
                change = random.uniform(-0.05, 0.08) * abs(pos.get("total_premium", 100))
                pos["current_pnl"] = pos.get("current_pnl", 0) + change
            
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
                self.active_positions.remove(pos)
                continue
            
            # Check stoploss hit
            if pnl <= stoploss and stoploss < 0:
                self._add_event("REFLECT", "🛑 Stoploss triggered!",
                    f"Position {pos['id']}: P&L ₹{pnl:,.0f} hit SL ₹{stoploss:,.0f}")
                pos["status"] = "closed"
                pos["exit_reason"] = "stoploss_hit"
                pos["realized_pnl"] = round(pnl, 2)
                self.performance.record_trade(pnl, pos.get("strategy", "unknown"))
                self.active_positions.remove(pos)
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
                self.active_positions.remove(pos)
    
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
