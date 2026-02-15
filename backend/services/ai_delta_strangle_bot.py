"""
AI Delta-Neutral Strangle Bot

Advanced options trading bot that:
1. Uses live option chain data from Dhan with full Greeks
2. Enters positions at 15-16 Delta on both sides
3. Auto-adjusts when any leg reaches 30 Delta
4. Uses Claude AI for intelligent decision making
5. Supports both Dhan and Upstox for execution

Author: Money Saarthi
Version: 2.0
"""

import asyncio
import logging
import json
import os
import httpx
from datetime import datetime, time, timedelta, timezone
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


# ============================================
# CONSTANTS
# ============================================

LOT_SIZES = {
    "NIFTY": 65,
    "BANKNIFTY": 30,
    "FINNIFTY": 60,
    "MIDCPNIFTY": 120,
    "SENSEX": 10,
}

EXPIRY_DAYS = {
    "NIFTY": 1,       # Tuesday (0=Mon, 1=Tue)
    "BANKNIFTY": 2,   # Wednesday
    "FINNIFTY": 1,    # Tuesday
    "MIDCPNIFTY": 0,  # Monday
    "SENSEX": 4,      # Friday
}

# Dhan Security IDs for underlyings
DHAN_SECURITY_IDS = {
    "NIFTY": 13,
    "BANKNIFTY": 25,
    "FINNIFTY": 27,
    "MIDCPNIFTY": 442
}

# Default Dhan API base
DHAN_API_BASE = "https://api.dhan.co/v2"


# ============================================
# ENUMS
# ============================================

class BotStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


class PositionStatus(str, Enum):
    NONE = "none"
    OPEN = "open"
    ADJUSTING = "adjusting"
    CLOSING = "closing"
    CLOSED = "closed"


class AIAction(str, Enum):
    HOLD = "HOLD"
    ADJUST_CE = "ADJUST_CE"
    ADJUST_PE = "ADJUST_PE"
    CLOSE_ALL = "CLOSE_ALL"
    NEW_ENTRY = "NEW_ENTRY"


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class OptionGreeks:
    """Greek values for an option"""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    iv: float = 0.0


@dataclass
class OptionLeg:
    """Single option leg in a position"""
    option_type: str  # "CE" or "PE"
    strike: float
    entry_price: float
    current_price: float = 0.0
    quantity: int = 0
    greeks: OptionGreeks = field(default_factory=OptionGreeks)
    instrument_key: str = ""
    order_id: str = ""
    security_id: str = ""  # Dhan security ID for order placement
    
    @property
    def pnl(self) -> float:
        """Calculate P&L (short position)"""
        return (self.entry_price - self.current_price) * self.quantity
    
    @property
    def pnl_pct(self) -> float:
        """P&L as percentage"""
        if self.entry_price == 0:
            return 0
        return ((self.entry_price - self.current_price) / self.entry_price) * 100


@dataclass
class StranglePosition:
    """Complete strangle position"""
    call_leg: Optional[OptionLeg] = None
    put_leg: Optional[OptionLeg] = None
    status: PositionStatus = PositionStatus.NONE
    entry_time: Optional[datetime] = None
    entry_credit: float = 0.0
    num_adjustments: int = 0
    adjustment_history: List[Dict] = field(default_factory=list)
    
    @property
    def total_pnl(self) -> float:
        """Total P&L of the position"""
        pnl = 0.0
        if self.call_leg:
            pnl += self.call_leg.pnl
        if self.put_leg:
            pnl += self.put_leg.pnl
        return pnl
    
    @property
    def total_delta(self) -> float:
        """Net delta of the position"""
        delta = 0.0
        if self.call_leg:
            delta += self.call_leg.greeks.delta * self.call_leg.quantity
        if self.put_leg:
            delta += self.put_leg.greeks.delta * self.put_leg.quantity
        return delta


@dataclass
class DeltaStrangleConfig:
    """Configuration for Delta Strangle Bot"""
    underlying: str = "NIFTY"
    lot_size: int = 65
    num_lots: int = 1
    
    # ─── Strategy Mode ───────────────────────────────────────────────────
    # short_strangle: Sell OTM CE + PE (unlimited risk, high premium)
    # iron_condor:    Sell OTM CE + PE, buy further OTM wings (defined risk, hands-off)
    # iron_butterfly: Sell ATM straddle + buy OTM wings (high premium, defined risk)
    # straddle_hedge: Sell ATM straddle + dynamic hedge with far-OTM options
    strategy_mode: str = "iron_condor"
    
    # ─── Timeframe ───────────────────────────────────────────────────────
    # intraday: 0DTE, enter morning, exit by 3:15 PM same day
    # weekly:   Enter Mon/Tue, ride till Thu/Fri expiry
    # smart:    Auto-select based on IV percentile and DTE
    timeframe: str = "weekly"
    
    # Delta Settings
    entry_delta: float = 15.0  # Enter at 15-16 delta
    adjustment_trigger_delta: float = 30.0  # Adjust when delta reaches 30
    roll_target_delta: float = 15.0  # Roll to 15 delta
    
    # ─── Iron Condor / Butterfly Specific ────────────────────────────────
    wing_width: int = 200            # Points between short & long strikes
    wing_delta: float = 5.0          # Delta for protective wings
    
    # Profit/Loss Settings
    profit_target_pct: float = 50.0  # Close at 50% profit
    max_loss_multiplier: float = 2.0  # Stop at 2x credit
    
    # ─── Enhanced Profit Management ──────────────────────────────────────
    trailing_profit: bool = True           # Trail profit instead of fixed exit
    trailing_step_pct: float = 10.0        # Trail in 10% increments
    time_based_exit: bool = True           # Tighter targets as expiry nears
    partial_profit_booking: bool = True    # Close 50% at first target, trail rest
    
    # ─── Smart Entry Filters ─────────────────────────────────────────────
    iv_entry_min: float = 25.0       # Min IV percentile to enter
    min_premium_pct: float = 0.3     # Min premium as % of underlying
    
    # Trading Hours
    entry_time: str = "09:30"
    exit_time: str = "15:15"
    no_entry_after: str = "14:30"    # Don't enter new positions after this
    
    # Adjustment Settings
    max_adjustments_per_day: int = 3
    adjustment_cooldown_seconds: int = 300  # 5 min between adjustments
    cool_down_seconds: int = 120     # Min time between adjustments
    
    # ─── Enhanced Risk Management ────────────────────────────────────────
    vix_exit_threshold: float = 25.0       # Emergency close if VIX exceeds this
    max_daily_loss: float = 10000.0        # Auto-stop if daily loss exceeds this
    
    # AI Settings
    use_ai_decisions: bool = True
    ai_override_delta_rules: bool = True  # AI can override standard delta rules
    ai_confidence_threshold: int = 70  # Min confidence to act on AI decision
    
    # Expiry Settings
    trade_weekly: bool = True
    trade_monthly: bool = False
    days_to_expiry_min: int = 1
    days_to_expiry_max: int = 7
    
    # Check Interval
    check_interval_seconds: int = 30


# ============================================
# CLAUDE AI PROMPTS - QUANTSTRANGLE AI
# ============================================

STRANGLE_BOT_SYSTEM_PROMPT = """
# YOUR IDENTITY & MISSION

You are QuantStrangleAI, an expert options trading specialist focused exclusively on delta-neutral short strangle strategies for Indian markets (NSE). Your sole purpose is to protect capital while generating consistent income through disciplined option selling with systematic adjustments.

You have REAL MONEY on the line. Every decision you make affects actual P&L. Treat this with the seriousness of a professional fund manager.

---

# CORE COMPETENCIES

You possess deep expertise in:

1. **Options Greeks Analysis**
   - Real-time Delta interpretation and position delta calculation
   - Gamma risk assessment (acceleration of delta changes)
   - Theta decay optimization (time value extraction)
   - Vega exposure management (volatility sensitivity)
   - Implied Volatility (IV) percentile and rank analysis

2. **Market Context Understanding**
   - Trend identification (range-bound vs directional)
   - Volatility regime assessment (expanding vs contracting)
   - Support/resistance level recognition
   - Open Interest pattern analysis at key strikes
   - Volume profile interpretation

3. **Risk Management**
   - Position sizing discipline
   - Multi-layered stop-loss protocols
   - Maximum drawdown protection
   - Correlation risk awareness
   - Black swan event preparation

---

# TRADING STRATEGY FRAMEWORK

## Entry Criteria (New Position Setup)

**When to Enter:**
- Market is in range-bound condition (no strong directional bias)
- IV Percentile > 30 (elevated premium environment)
- At least 7 DTE (Days to Expiry) for weekly, 21+ DTE for monthly
- No major events scheduled in next 3 days

**Position Structure:**
- Sell 1 OTM Call at 15-16 Delta (85% probability of expiring worthless)
- Sell 1 OTM Put at 15-16 Delta (85% probability of expiring worthless)
- Equal distance from ATM preferred (balanced position)
- Target credit: Minimum 0.5% of underlying price per side

**Position Sizing:**
- Never risk more than 2% of total capital on single strangle
- Calculate max loss as: (Strike width to breakeven × Lot size × 2 sides)
- Lot size = (Capital × 0.02) / Max Loss per strangle

---

## Adjustment Triggers (When to Act)

You MUST monitor these conditions continuously:

### 1. **DELTA BREACH (Primary Trigger)**
- **Action Required:** When either short strike reaches 30 Delta or higher
- **Response:** Roll the breached side to new 15-16 Delta strike
- **Timing:** Execute within 5 minutes of breach confirmation

### 2. **GAMMA SPIKE (Risk Acceleration)**
- **Action Required:** When short strike Gamma exceeds 0.05
- **Response:** Consider tightening delta threshold to 25 for that side
- **Reasoning:** High gamma means delta will accelerate rapidly

### 3. **IV CRUSH (Premium Collapse)**
- **Action Required:** IV drops below 20th percentile AND position P&L > 40%
- **Response:** Close entire position early, lock profit
- **Reasoning:** No edge remaining in low premium environment

### 4. **DIRECTIONAL MOMENTUM (Trend Development)**
- **Action Required:** Underlying moves 1.5% in one direction within 2 hours + increasing volume
- **Response:** Pre-emptively roll threatened side at 25 Delta (don't wait for 30)
- **Reasoning:** Momentum may accelerate, proactive adjustment prevents larger loss

### 5. **TIME DECAY TARGET (Profit Taking)**
- **Action Required:** Position P&L reaches 50-60% of max credit collected
- **Response:** Close entire position, take profit
- **Reasoning:** Risk/reward no longer favorable, diminishing returns

### 6. **MAXIMUM LOSS (Emergency Exit)**
- **Action Required:** Combined position loss reaches 200% of credit received
- **Response:** Close ENTIRE position immediately, no exceptions
- **Reasoning:** Position structure has failed, preserve capital

---

## Adjustment Execution Rules

### Rolling Methodology:
When rolling a threatened side:

1. **Identify New Strike:** Find strike closest to 15-16 Delta on threatened side
2. **Simultaneous Execution:** 
   - Buy back current short strike (close)
   - Sell new strike at target delta (open)
3. **Order Type:** Use MARKET orders for both legs (priority is execution, not pennies)
4. **Lot Matching:** New position must be same lot size (no scaling)
5. **Record Keeping:** Log adjustment details for review

### What NOT to Do:
- ❌ DO NOT add contracts ("doubling down")
- ❌ DO NOT roll both sides simultaneously (handle one threat at a time)
- ❌ DO NOT wait hoping for reversal (discipline over hope)
- ❌ DO NOT convert to other strategies (stay within strangle framework)

---

# DECISION-MAKING PROCESS

When analyzing market data, follow this chain-of-thought reasoning:

## Step 1: DATA ASSESSMENT
- Verify data quality and timestamp freshness
- Calculate current position Greeks
- Check for any data anomalies or stale quotes

## Step 2: THREAT IDENTIFICATION
- Which side (if any) is approaching delta threshold?
- Are there early warning signs (gamma spike, momentum, volume)?
- How much time until expiry?
- What is current P&L status?

## Step 3: CONTEXTUAL ANALYSIS
- What is the broader market environment? (VIX/India VIX level, trend)
- Is there unusual option activity (OI/Volume spikes)?
- Are we near support/resistance levels?
- Any news or events affecting sentiment?

## Step 4: RISK EVALUATION
- What happens if we do nothing? (best/worst case)
- What happens if we adjust? (cost, new risk profile)
- What is probability of further adverse movement?
- Can we afford to wait for better pricing?

## Step 5: DECISION FORMULATION
- Does situation meet defined trigger criteria?
- Is immediate action required or can we monitor?
- What specific orders need to be placed?
- What is expected outcome of this action?

## Step 6: CONFIDENCE ASSESSMENT
- Rate decision confidence (0-100%)
- List key assumptions behind decision
- Identify what could invalidate this decision

---

# OUTPUT FORMAT SPECIFICATION

You MUST respond in this exact JSON structure:

```json
{
  "timestamp": "YYYY-MM-DD HH:MM:SS",
  "decision": {
    "action": "HOLD | ADJUST_CALL | ADJUST_PUT | CLOSE_POSITION | ENTER_TRADE",
    "urgency": "LOW | MEDIUM | HIGH | CRITICAL",
    "confidence_score": 0-100
  },
  "position_analysis": {
    "call_side": {
      "current_delta": 0.00,
      "delta_status": "SAFE | MONITOR | BREACH",
      "strike": 0,
      "premium_current": 0.00,
      "premium_entry": 0.00,
      "pnl_percent": 0.0
    },
    "put_side": {
      "current_delta": 0.00,
      "delta_status": "SAFE | MONITOR | BREACH",
      "strike": 0,
      "premium_current": 0.00,
      "premium_entry": 0.00,
      "pnl_percent": 0.0
    },
    "combined_pnl": {
      "unrealized_rupees": 0.00,
      "unrealized_percent": 0.0,
      "vs_max_profit": 0.0
    }
  },
  "market_context": {
    "underlying_price": 0.00,
    "price_change_percent": 0.0,
    "iv_percentile": 0,
    "vix_level": 0.00,
    "trend_assessment": "RANGE_BOUND | BULLISH | BEARISH | CHOPPY",
    "volatility_regime": "LOW | NORMAL | ELEVATED | EXTREME"
  },
  "reasoning": {
    "primary_factors": [
      "Factor 1 description",
      "Factor 2 description",
      "Factor 3 description"
    ],
    "risk_assessment": "Detailed risk evaluation in 2-3 sentences",
    "why_this_action": "Clear explanation of why this specific action is chosen"
  },
  "execution_instructions": {
    "required": true/false,
    "orders": [
      {
        "action": "BUY | SELL",
        "instrument": "CE | PE",
        "strike": 0,
        "quantity": 0,
        "order_type": "MARKET | LIMIT",
        "limit_price": 0.00
      }
    ],
    "expected_delta_after": 0.00,
    "expected_credit_debit": 0.00
  },
  "monitoring_alerts": [
    "Alert 1: What to watch next",
    "Alert 2: Next decision point",
    "Alert 3: Risk scenario to monitor"
  ]
}
```
"""

# Alias for backward compatibility
CLAUDE_SYSTEM_PROMPT = STRANGLE_BOT_SYSTEM_PROMPT


USER_PROMPT_TEMPLATE = """
REAL-TIME POSITION ANALYSIS REQUEST

═══════════════════════════════════════════
📊 POSITION IDENTIFICATION
═══════════════════════════════════════════

Underlying Symbol: {underlying_symbol}
Underlying Price: ₹{spot_price}
Price Change Today: {price_change_percent}%

Position ID: {position_id}
Expiry Date: {expiry_date}
Days to Expiry (DTE): {dte}
Entry Date: {entry_date}
Days in Trade: {days_in_trade}

═══════════════════════════════════════════
📞 CALL SIDE ANALYSIS
═══════════════════════════════════════════

Strike Price: {call_strike}
Option Type: CE (Call European)

**Pricing:**
- Entry Premium: ₹{call_entry_premium}
- Current Premium: ₹{call_current_premium}
- Premium Change: {call_premium_change_percent}%

**Greeks (LIVE):**
- Delta: {call_delta} (Target: 0.15-0.16, Danger: >0.30)
- Gamma: {call_gamma}
- Theta: {call_theta}
- Vega: {call_vega}

**Market Data:**
- Implied Volatility: {call_iv}%
- Open Interest: {call_oi} contracts
- OI Change: {call_oi_change}
- Volume Today: {call_volume}
- Bid: ₹{call_bid} | Ask: ₹{call_ask}
- Spread: ₹{call_spread}

**P&L:**
- Unrealized P&L: ₹{call_pnl_rupees} ({call_pnl_percent}%)

═══════════════════════════════════════════
📉 PUT SIDE ANALYSIS
═══════════════════════════════════════════

Strike Price: {put_strike}
Option Type: PE (Put European)

**Pricing:**
- Entry Premium: ₹{put_entry_premium}
- Current Premium: ₹{put_current_premium}
- Premium Change: {put_premium_change_percent}%

**Greeks (LIVE):**
- Delta: {put_delta} (Target: -0.15 to -0.16, Danger: <-0.30)
- Gamma: {put_gamma}
- Theta: {put_theta}
- Vega: {put_vega}

**Market Data:**
- Implied Volatility: {put_iv}%
- Open Interest: {put_oi} contracts
- OI Change: {put_oi_change}
- Volume Today: {put_volume}
- Bid: ₹{put_bid} | Ask: ₹{put_ask}
- Spread: ₹{put_spread}

**P&L:**
- Unrealized P&L: ₹{put_pnl_rupees} ({put_pnl_percent}%)

═══════════════════════════════════════════
💰 COMBINED POSITION P&L
═══════════════════════════════════════════

Total Premium Collected: ₹{total_premium_collected}
Current Position Value: ₹{current_position_value}

**Unrealized P&L:**
- Rupees: ₹{total_unrealized_pnl}
- Percentage: {total_pnl_percent}%
- vs Max Profit: {pnl_vs_max_profit}%

**Risk Metrics:**
- Max Loss Threshold: ₹{max_loss_threshold} (200% of credit)
- Distance to Stop Loss: {distance_to_stoploss}%
- Current Position Delta: {position_delta}

═══════════════════════════════════════════
🌍 MARKET ENVIRONMENT
═══════════════════════════════════════════

**Volatility:**
- ATM IV: {atm_iv}%
- IV Percentile (30D): {iv_percentile}
- IV Rank: {iv_rank}
- India VIX: {india_vix}
- VIX Change: {vix_change}%

**Trend Analysis:**
- 5-Min Trend: {trend_5min}
- 15-Min Trend: {trend_15min}
- 1-Hour Trend: {trend_1hour}
- RSI (14): {rsi_value}

**Support & Resistance:**
- Immediate Support: ₹{support_level_1}
- Immediate Resistance: ₹{resistance_level_1}
- Call Strike Distance to Resistance: {call_distance_to_resistance}%
- Put Strike Distance to Support: {put_distance_to_support}%

**Volume Profile:**
- Current Volume vs Avg: {volume_ratio}x
- Max Pain Strike: {max_pain_strike}
- PCR (Put-Call Ratio): {pcr_ratio}

═══════════════════════════════════════════
📰 RECENT EVENTS & ALERTS
═══════════════════════════════════════════

{recent_market_events}

═══════════════════════════════════════════
🎯 DECISION REQUEST
═══════════════════════════════════════════

Based on the above LIVE data:

1. **Is immediate action required?** (YES/NO and WHY)
2. **Which side is at risk?** (CALL/PUT/BOTH/NEITHER)
3. **What specific action should be taken?** (HOLD/ADJUST/CLOSE)
4. **If adjustment needed, what are the exact orders?**
5. **What is your confidence level in this decision?** (0-100%)
6. **What should I monitor next?** (Key levels/conditions)

Provide your analysis in the specified JSON format.

═══════════════════════════════════════════
END OF DATA INPUT
═══════════════════════════════════════════
"""

# Alias for backward compatibility
CLAUDE_USER_PROMPT_TEMPLATE = USER_PROMPT_TEMPLATE


# ============================================
# AI DELTA STRANGLE BOT CLASS
# ============================================

class AIDeltaStrangleBot:
    """AI-Powered Delta-Neutral Strangle Trading Bot"""
    
    def __init__(
        self,
        broker_service: Any,
        access_token: str,
        broker: str = "dhan",
    ):
        self.broker_service = broker_service
        self.access_token = access_token
        self.broker = broker.lower()
        self.claude_api_key = os.environ.get('ANTHROPIC_API_KEY', '')
        
        # State
        self.config = DeltaStrangleConfig()
        self.position = StranglePosition()
        self.status = BotStatus.IDLE
        self.last_scan_time: Optional[datetime] = None
        self.last_adjustment_time: Optional[datetime] = None
        self.last_ai_decision: Optional[Dict] = None
        self.logs: List[str] = []
        self.decision_history: List[Dict] = []  # Track all AI decisions
        
        # Async loop control
        self._running = False
        self._task: Optional[asyncio.Task] = None
        
        # HTTP client for API calls
        self._http_client: Optional[httpx.AsyncClient] = None
    
    def _log(self, message: str, level: str = "INFO"):
        """Add log entry"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] {message}"
        self.logs.append(log_entry)
        if len(self.logs) > 100:
            self.logs = self.logs[-100:]
        
        if level == "ERROR":
            logger.error(message)
        else:
            logger.info(message)
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    # ============================================
    # OPTION CHAIN DATA METHODS
    # ============================================
    
    async def fetch_option_chain(
        self,
        symbol: Optional[str] = None,
        expiry: Optional[str] = None
    ) -> Dict:
        """
        Fetch live option chain with Greeks from broker service
        
        Returns unified format:
        {
            "underlying_price": float,
            "expiry": str,
            "strikes": [list of strike prices],
            "calls": {strike: {price, delta, gamma, theta, vega, iv, oi, volume, security_id}},
            "puts": {strike: {price, delta, gamma, theta, vega, iv, oi, volume, security_id}},
            "timestamp": str
        }
        """
        symbol = symbol or self.config.underlying
        
        try:
            # Use broker_service if available (preferred method)
            if hasattr(self.broker_service, 'get_option_chain'):
                self._log(f"Fetching option chain via broker_service for {symbol}")
                
                # Get expiry if not provided
                if not expiry:
                    expiry = await self._get_nearest_expiry(symbol)
                
                raw_chain = await self.broker_service.get_option_chain(symbol, expiry)
                return self._transform_broker_option_chain(raw_chain, symbol, expiry)
            
            # Fallback to direct API call
            self._log(f"Fetching option chain via direct API for {symbol}")
            
            # Get spot price first
            spot_price = await self._get_spot_price(symbol)
            
            # Get expiry if not provided
            if not expiry:
                expiry = await self._get_nearest_expiry(symbol)
            
            # Fetch option chain from Dhan
            client = await self._get_http_client()
            
            security_id = DHAN_SECURITY_IDS.get(symbol, 13)
            
            response = await client.post(
                f"{DHAN_API_BASE}/optionchain",
                headers={
                    "access-token": self.access_token,
                    "Content-Type": "application/json"
                },
                json={
                    "UnderlyingScrip": security_id,
                    "Expiry": expiry
                }
            )
            
            if response.status_code != 200:
                self._log(f"Dhan option chain error: {response.text}", "ERROR")
                # Return simulated data for testing
                return self._generate_mock_option_chain(symbol, spot_price, expiry)
            
            data = response.json()
            
            # Parse and structure the data
            return self._parse_dhan_option_chain(data, spot_price, expiry)
            
        except Exception as e:
            self._log(f"Error fetching option chain: {e}", "ERROR")
            # Return mock data for development
            spot = 25000 if symbol == "NIFTY" else 52000
            return self._generate_mock_option_chain(symbol, spot, expiry or "2025-02-20")
    
    def _transform_broker_option_chain(self, raw_chain: Dict, symbol: str, expiry: str) -> Dict:
        """Transform broker_service option chain format to bot's expected format"""
        result = {
            "underlying_price": raw_chain.get("underlying_price", 0),
            "expiry": expiry,
            "strikes": [],
            "calls": {},
            "puts": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # dhan_service returns strikes as a list with call/put dicts
        for strike_data in raw_chain.get("strikes", []):
            strike = strike_data.get("strike_price", 0)
            if strike == 0:
                continue
                
            result["strikes"].append(strike)
            
            call = strike_data.get("call", {})
            put = strike_data.get("put", {})
            
            result["calls"][strike] = {
                "price": call.get("ltp", 0),
                "bid": call.get("bid", 0),
                "ask": call.get("ask", 0),
                "delta": call.get("delta", 0),
                "gamma": call.get("gamma", 0),
                "theta": call.get("theta", 0),
                "vega": call.get("vega", 0),
                "iv": call.get("iv", 0),
                "oi": call.get("oi", 0),
                "volume": call.get("volume", 0),
                "security_id": call.get("security_id", ""),
                "instrument_key": call.get("instrument_key", "")
            }
            
            result["puts"][strike] = {
                "price": put.get("ltp", 0),
                "bid": put.get("bid", 0),
                "ask": put.get("ask", 0),
                "delta": put.get("delta", 0),
                "gamma": put.get("gamma", 0),
                "theta": put.get("theta", 0),
                "vega": put.get("vega", 0),
                "iv": put.get("iv", 0),
                "oi": put.get("oi", 0),
                "volume": put.get("volume", 0),
                "security_id": put.get("security_id", ""),
                "instrument_key": put.get("instrument_key", "")
            }
        
        result["strikes"].sort()
        return result
    
    def _parse_dhan_option_chain(
        self,
        data: Dict,
        spot_price: float,
        expiry: str
    ) -> Dict:
        """Parse Dhan option chain response"""
        result = {
            "underlying_price": spot_price,
            "expiry": expiry,
            "strikes": [],
            "calls": {},
            "puts": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Dhan returns data in a specific format
        option_data = data.get("data", {})
        chain_data = option_data.get("Data", []) if isinstance(option_data, dict) else data.get("data", [])
        
        # Update spot price from response if available
        if isinstance(option_data, dict) and option_data.get("UnderlyingPrice"):
            result["underlying_price"] = float(option_data.get("UnderlyingPrice", spot_price))
        
        if isinstance(chain_data, list):
            for item in chain_data:
                # Handle Dhan's format with StrikePrice
                strike = float(item.get("StrikePrice", item.get("strikePrice", 0)))
                if strike == 0:
                    continue
                
                if strike not in result["strikes"]:
                    result["strikes"].append(strike)
                
                # Extract security IDs - Dhan uses various field names
                ce_security_id = (item.get("CE_SecurityId") or item.get("CE_SecId") or 
                                  item.get("CE_Scrip_Id") or item.get("CE_TradingSymbol") or "")
                pe_security_id = (item.get("PE_SecurityId") or item.get("PE_SecId") or 
                                  item.get("PE_Scrip_Id") or item.get("PE_TradingSymbol") or "")
                
                # Check option type field or use both CE/PE fields
                option_type = item.get("optionType", "")
                
                if option_type == "Call" or item.get("CE_LTP") is not None:
                    result["calls"][strike] = {
                        "price": float(item.get("CE_LTP", item.get("lastPrice", 0)) or 0),
                        "bid": float(item.get("CE_BidPrice", item.get("bidPrice", 0)) or 0),
                        "ask": float(item.get("CE_AskPrice", item.get("askPrice", 0)) or 0),
                        "delta": float(item.get("CE_Delta", item.get("delta", 0)) or 0),
                        "gamma": float(item.get("CE_Gamma", item.get("gamma", 0)) or 0),
                        "theta": float(item.get("CE_Theta", item.get("theta", 0)) or 0),
                        "vega": float(item.get("CE_Vega", item.get("vega", 0)) or 0),
                        "iv": float(item.get("CE_IV", item.get("iv", 0)) or 0),
                        "oi": int(item.get("CE_OI", item.get("openInterest", 0)) or 0),
                        "volume": int(item.get("CE_Volume", item.get("volume", 0)) or 0),
                        "security_id": str(ce_security_id) if ce_security_id else ""
                    }
                
                if option_type == "Put" or option_type == "" or item.get("PE_LTP") is not None:
                    result["puts"][strike] = {
                        "price": float(item.get("PE_LTP", 0) or 0) if item.get("PE_LTP") is not None else float(item.get("lastPrice", 0) or 0),
                        "bid": float(item.get("PE_BidPrice", item.get("bidPrice", 0)) or 0),
                        "ask": float(item.get("PE_AskPrice", item.get("askPrice", 0)) or 0),
                        "delta": float(item.get("PE_Delta", item.get("delta", 0)) or 0),
                        "gamma": float(item.get("PE_Gamma", item.get("gamma", 0)) or 0),
                        "theta": float(item.get("PE_Theta", item.get("theta", 0)) or 0),
                        "vega": float(item.get("PE_Vega", item.get("vega", 0)) or 0),
                        "iv": float(item.get("PE_IV", item.get("iv", 0)) or 0),
                        "oi": int(item.get("PE_OI", item.get("openInterest", 0)) or 0),
                        "volume": int(item.get("PE_Volume", item.get("volume", 0)) or 0),
                        "security_id": str(pe_security_id) if pe_security_id else ""
                    }
        
        result["strikes"].sort()
        return result
    
    def _generate_mock_option_chain(
        self,
        symbol: str,
        spot_price: float,
        expiry: str
    ) -> Dict:
        """Generate realistic mock option chain for testing"""
        import math
        
        # ATM strike
        step = 50 if symbol == "NIFTY" else 100
        atm = round(spot_price / step) * step
        
        result = {
            "underlying_price": spot_price,
            "expiry": expiry,
            "strikes": [],
            "calls": {},
            "puts": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Generate strikes from -500 to +500 points
        for offset in range(-10, 11):
            strike = atm + (offset * step)
            result["strikes"].append(strike)
            
            # Distance from ATM
            moneyness = (strike - spot_price) / spot_price
            
            # Mock IV (smile shape)
            base_iv = 15.0 if symbol == "NIFTY" else 20.0
            iv = base_iv + abs(moneyness) * 100
            
            # Mock Greeks based on moneyness
            call_delta = max(1, min(99, 50 - moneyness * 200))  # 0-100 scale
            put_delta = call_delta - 100  # Negative for puts
            
            # Call option
            call_price = max(0.5, (spot_price - strike) + iv * math.sqrt(7/365) * spot_price / 100)
            if strike > spot_price:  # OTM call
                call_price = max(0.5, iv * math.sqrt(7/365) * spot_price / 100 * math.exp(-moneyness * 5))
            
            result["calls"][strike] = {
                "price": round(call_price, 2),
                "bid": round(call_price * 0.98, 2),
                "ask": round(call_price * 1.02, 2),
                "delta": round(call_delta, 2),
                "gamma": round(0.001 * math.exp(-moneyness**2 * 10), 4),
                "theta": round(-call_price * 0.05, 2),
                "vega": round(spot_price * 0.001 * math.sqrt(7/365), 2),
                "iv": round(iv, 2),
                "oi": int(100000 * math.exp(-abs(moneyness) * 5)),
                "volume": int(50000 * math.exp(-abs(moneyness) * 3)),
                "change": 0,
                "change_pct": 0
            }
            
            # Put option
            put_price = max(0.5, (strike - spot_price) + iv * math.sqrt(7/365) * spot_price / 100)
            if strike < spot_price:  # OTM put
                put_price = max(0.5, iv * math.sqrt(7/365) * spot_price / 100 * math.exp(moneyness * 5))
            
            result["puts"][strike] = {
                "price": round(put_price, 2),
                "bid": round(put_price * 0.98, 2),
                "ask": round(put_price * 1.02, 2),
                "delta": round(put_delta, 2),
                "gamma": round(0.001 * math.exp(-moneyness**2 * 10), 4),
                "theta": round(-put_price * 0.05, 2),
                "vega": round(spot_price * 0.001 * math.sqrt(7/365), 2),
                "iv": round(iv, 2),
                "oi": int(100000 * math.exp(-abs(moneyness) * 5)),
                "volume": int(50000 * math.exp(-abs(moneyness) * 3)),
                "change": 0,
                "change_pct": 0
            }
        
        return result
    
    async def _get_spot_price(self, symbol: str) -> float:
        """Get live spot price from Dhan"""
        try:
            client = await self._get_http_client()
            
            # Dhan index quote endpoint
            security_id = DHAN_SECURITY_IDS.get(symbol, 13)
            
            response = await client.post(
                f"{DHAN_API_BASE}/marketfeed/ltp",
                headers={
                    "access-token": self.access_token,
                    "Content-Type": "application/json"
                },
                json={
                    "NSE_INDEX": [security_id]
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if "data" in data and "NSE_INDEX" in data["data"]:
                    return float(data["data"]["NSE_INDEX"].get(str(security_id), {}).get("last_price", 0))
            
            # Fallback hardcoded
            return 25900.0 if symbol == "NIFTY" else 52000.0
            
        except Exception as e:
            self._log(f"Error getting spot price: {e}", "ERROR")
            return 25900.0 if symbol == "NIFTY" else 52000.0
    
    async def _get_nearest_expiry(self, symbol: str) -> str:
        """Get nearest weekly expiry date"""
        try:
            client = await self._get_http_client()
            
            response = await client.get(
                f"{DHAN_API_BASE}/expirylist/{symbol}",
                headers={"access-token": self.access_token}
            )
            
            if response.status_code == 200:
                data = response.json()
                expiries = data.get("data", [])
                if expiries and len(expiries) > 0:
                    return expiries[0]
            
            # Calculate next expiry manually
            return self._calculate_next_expiry(symbol)
            
        except Exception:
            return self._calculate_next_expiry(symbol)
    
    def _calculate_next_expiry(self, symbol: str) -> str:
        """Calculate next expiry date"""
        expiry_weekday = EXPIRY_DAYS.get(symbol, 1)  # Default Tuesday
        now = datetime.now()
        days_ahead = expiry_weekday - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        next_expiry = now + timedelta(days=days_ahead)
        return next_expiry.strftime("%Y-%m-%d")
    
    # ============================================
    # DELTA-BASED STRIKE SELECTION
    # ============================================
    
    def find_delta_strike(
        self,
        option_chain: Dict,
        target_delta: float,
        option_type: str
    ) -> Optional[Dict]:
        """
        Find strike closest to target delta
        
        Args:
            option_chain: Option chain data
            target_delta: Target delta (e.g., 15 for 0.15)
            option_type: "CE" or "PE"
        
        Returns:
            {strike, price, delta, greeks}
        """
        options = option_chain.get("calls" if option_type == "CE" else "puts", {})
        
        best_strike = None
        best_diff = float('inf')
        
        for strike, data in options.items():
            delta = abs(data.get("delta", 0))
            diff = abs(delta - target_delta)
            
            if diff < best_diff:
                best_diff = diff
                best_strike = {
                    "strike": float(strike),
                    "price": data.get("price", 0),
                    "delta": delta,
                    "gamma": data.get("gamma", 0),
                    "theta": data.get("theta", 0),
                    "vega": data.get("vega", 0),
                    "iv": data.get("iv", 0),
                    "oi": data.get("oi", 0),
                    "security_id": data.get("security_id", ""),
                    "instrument_key": data.get("instrument_key", "")
                }
        
        return best_strike
    
    def find_strikes_by_delta(
        self,
        option_chain: Dict,
        target_delta: float = 15.0
    ) -> Tuple[Optional[Dict], Optional[Dict]]:
        """
        Find both call and put strikes at target delta
        
        Returns:
            (call_strike_data, put_strike_data)
        """
        call_strike = self.find_delta_strike(option_chain, target_delta, "CE")
        put_strike = self.find_delta_strike(option_chain, target_delta, "PE")
        
        return call_strike, put_strike
    
    def get_atm_iv(self, option_chain: Dict) -> float:
        """Get ATM IV from option chain"""
        spot = option_chain.get("underlying_price", 25000)
        strikes = option_chain.get("strikes", [])
        
        if not strikes:
            return 15.0
        
        # Find closest strike to spot
        atm_strike = min(strikes, key=lambda x: abs(x - spot))
        
        call_iv = option_chain.get("calls", {}).get(atm_strike, {}).get("iv", 15)
        put_iv = option_chain.get("puts", {}).get(atm_strike, {}).get("iv", 15)
        
        return (call_iv + put_iv) / 2
    
    # ============================================
    # CLAUDE AI INTEGRATION
    # ============================================
    
    async def get_claude_decision(
        self,
        option_chain: Dict,
        position: Optional[StranglePosition] = None
    ) -> Dict:
        """
        Get trading decision from QuantStrangleAI (Claude 4.5 Sonnet)
        
        Returns comprehensive decision with:
        - action: HOLD | ADJUST_CALL | ADJUST_PUT | CLOSE_POSITION | ENTER_TRADE
        - urgency: LOW | MEDIUM | HIGH | CRITICAL
        - confidence_score: 0-100
        - position_analysis: detailed analysis of both legs
        - market_context: volatility, trend assessment
        - reasoning: primary factors, risk assessment, why this action
        - execution_instructions: specific orders if needed
        - monitoring_alerts: what to watch next
        """
        if not self.claude_api_key:
            return {
                "decision": {"action": "HOLD", "urgency": "LOW", "confidence_score": 50},
                "reasoning": {"why_this_action": "AI disabled - no API key provided"},
                "ai_available": False
            }
        
        try:
            import anthropic
            
            client = anthropic.Anthropic(api_key=self.claude_api_key)
            
            # Build user prompt with all position data
            pos = position or self.position
            user_prompt = self._build_claude_prompt(option_chain, pos)
            
            # Call Claude with QuantStrangleAI system prompt
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4000,  # Increased for detailed response
                temperature=0.3,  # Lower temperature for consistent decisions
                system=STRANGLE_BOT_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            # Parse response
            response_text = message.content[0].text
            
            # Extract JSON from response
            try:
                # Try to parse the entire response as JSON
                decision = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to find JSON block in the response
                import re
                # Look for JSON starting with { and accounting for nested objects
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if json_match:
                    try:
                        decision = json.loads(json_match.group())
                    except:
                        decision = self._create_fallback_decision(response_text)
                else:
                    decision = self._create_fallback_decision(response_text)
            
            # Add metadata
            decision["ai_available"] = True
            decision["api_call_timestamp"] = datetime.now().isoformat()
            decision["model_used"] = "claude-sonnet-4-20250514"
            decision["tokens_used"] = {
                "input": message.usage.input_tokens,
                "output": message.usage.output_tokens
            }
            decision["raw_response"] = response_text[:1000]
            
            # Store in decision history
            self.decision_history.append({
                "timestamp": datetime.now().isoformat(),
                "decision": decision,
                "spot_price": option_chain.get("underlying_price"),
                "position_delta": pos.total_delta if pos else 0
            })
            
            # Keep only last 50 decisions
            if len(self.decision_history) > 50:
                self.decision_history = self.decision_history[-50:]
            
            self.last_ai_decision = decision
            
            # Log decision
            action = decision.get("decision", {}).get("action", "UNKNOWN")
            confidence = decision.get("decision", {}).get("confidence_score", 0)
            urgency = decision.get("decision", {}).get("urgency", "LOW")
            self._log(f"🤖 AI Decision: {action} | Urgency: {urgency} | Confidence: {confidence}%")
            
            return decision
            
        except Exception as e:
            self._log(f"Claude AI error: {e}", "ERROR")
            return {
                "decision": {"action": "HOLD", "urgency": "LOW", "confidence_score": 0},
                "reasoning": {"why_this_action": f"AI error: {str(e)}"},
                "ai_available": False,
                "error": str(e)
            }
    
    def _create_fallback_decision(self, response_text: str) -> Dict:
        """Create fallback decision when JSON parsing fails"""
        return {
            "decision": {
                "action": "HOLD",
                "urgency": "LOW",
                "confidence_score": 50
            },
            "reasoning": {
                "primary_factors": ["Unable to parse AI response"],
                "risk_assessment": "Holding position while AI response is unclear",
                "why_this_action": f"Fallback to HOLD - could not parse: {response_text[:200]}"
            },
            "execution_instructions": {"required": False, "orders": []},
            "monitoring_alerts": ["Manual review recommended", "Check AI connection"]
        }
    
    def _build_claude_prompt(
        self,
        option_chain: Dict,
        position: StranglePosition
    ) -> str:
        """Build comprehensive user prompt for QuantStrangleAI"""
        spot = option_chain.get("underlying_price", 25000)
        expiry = option_chain.get("expiry", "Unknown")
        
        # Calculate DTE and days in trade
        try:
            expiry_date = datetime.strptime(expiry, "%Y-%m-%d")
            dte = (expiry_date - datetime.now()).days
        except:
            dte = 7
        
        entry_date = position.entry_time.strftime("%Y-%m-%d") if position.entry_time else datetime.now().strftime("%Y-%m-%d")
        days_in_trade = (datetime.now() - position.entry_time).days if position.entry_time else 0
        
        # ATM strike
        step = 50 if self.config.underlying == "NIFTY" else 100
        atm = round(spot / step) * step
        
        # Position data
        call_leg = position.call_leg
        put_leg = position.put_leg
        
        # Call side data
        call_strike = call_leg.strike if call_leg else 0
        call_entry = call_leg.entry_price if call_leg else 0
        call_current = call_leg.current_price if call_leg else 0
        call_delta = call_leg.greeks.delta if call_leg else 0
        call_gamma = call_leg.greeks.gamma if call_leg else 0
        call_theta = call_leg.greeks.theta if call_leg else 0
        call_vega = call_leg.greeks.vega if call_leg else 0
        call_iv = call_leg.greeks.iv if call_leg else 0
        call_pnl = call_leg.pnl if call_leg else 0
        call_pnl_pct = call_leg.pnl_pct if call_leg else 0
        call_qty = call_leg.quantity if call_leg else 0
        
        # Put side data
        put_strike = put_leg.strike if put_leg else 0
        put_entry = put_leg.entry_price if put_leg else 0
        put_current = put_leg.current_price if put_leg else 0
        put_delta = put_leg.greeks.delta if put_leg else 0
        put_gamma = put_leg.greeks.gamma if put_leg else 0
        put_theta = put_leg.greeks.theta if put_leg else 0
        put_vega = put_leg.greeks.vega if put_leg else 0
        put_iv = put_leg.greeks.iv if put_leg else 0
        put_pnl = put_leg.pnl if put_leg else 0
        put_pnl_pct = put_leg.pnl_pct if put_leg else 0
        put_qty = put_leg.quantity if put_leg else 0
        
        # Get option chain data for bid/ask and OI
        call_chain = option_chain.get("calls", {}).get(call_strike, {})
        put_chain = option_chain.get("puts", {}).get(put_strike, {})
        
        # Combined P&L
        total_premium = position.entry_credit
        current_value = (call_current + put_current) * (call_qty or put_qty or 1)
        total_pnl = position.total_pnl
        total_pnl_pct = (total_pnl / total_premium * 100) if total_premium > 0 else 0
        pnl_vs_max = (total_pnl / total_premium * 100) if total_premium > 0 else 0
        max_loss_threshold = total_premium * 2  # 200% of credit
        distance_to_stoploss = ((max_loss_threshold + total_pnl) / max_loss_threshold * 100) if max_loss_threshold > 0 else 100
        
        # Calculate PCR
        total_call_oi = sum(c.get("oi", 0) for c in option_chain.get("calls", {}).values())
        total_put_oi = sum(p.get("oi", 0) for p in option_chain.get("puts", {}).values())
        pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 1.0
        
        # Calculate IV percentile (simplified)
        atm_iv = self.get_atm_iv(option_chain)
        iv_percentile = min(100, max(0, int(atm_iv * 4)))  # Rough approximation
        iv_rank = iv_percentile  # Simplified
        
        # Support/Resistance (from option chain OI peaks)
        support_level = self._find_support_from_oi(option_chain, spot)
        resistance_level = self._find_resistance_from_oi(option_chain, spot)
        
        # Distance calculations
        call_dist_to_resist = abs((call_strike - resistance_level) / spot * 100) if spot > 0 else 0
        put_dist_to_support = abs((put_strike - support_level) / spot * 100) if spot > 0 else 0
        
        # Recent events
        events = self._get_recent_market_events()
        
        prompt = USER_PROMPT_TEMPLATE.format(
            underlying_symbol=self.config.underlying,
            spot_price=f"{spot:.2f}",
            price_change_percent="0.0",  # TODO: Calculate from historical data
            position_id=f"{self.config.underlying}_STRANGLE_{expiry}",
            expiry_date=expiry,
            dte=dte,
            entry_date=entry_date,
            days_in_trade=days_in_trade,
            
            # Call side
            call_strike=call_strike,
            call_entry_premium=f"{call_entry:.2f}",
            call_current_premium=f"{call_current:.2f}",
            call_premium_change_percent=f"{((call_current - call_entry) / call_entry * 100) if call_entry > 0 else 0:.1f}",
            call_delta=f"{call_delta:.4f}",
            call_gamma=f"{call_gamma:.6f}",
            call_theta=f"{call_theta:.2f}",
            call_vega=f"{call_vega:.2f}",
            call_iv=f"{call_iv:.1f}",
            call_oi=call_chain.get("oi", 0),
            call_oi_change="N/A",
            call_volume=call_chain.get("volume", 0),
            call_bid=f"{call_chain.get('bid', call_current * 0.98):.2f}",
            call_ask=f"{call_chain.get('ask', call_current * 1.02):.2f}",
            call_spread=f"{(call_chain.get('ask', 0) - call_chain.get('bid', 0)):.2f}",
            call_pnl_rupees=f"{call_pnl:.2f}",
            call_pnl_percent=f"{call_pnl_pct:.1f}",
            
            # Put side
            put_strike=put_strike,
            put_entry_premium=f"{put_entry:.2f}",
            put_current_premium=f"{put_current:.2f}",
            put_premium_change_percent=f"{((put_current - put_entry) / put_entry * 100) if put_entry > 0 else 0:.1f}",
            put_delta=f"{put_delta:.4f}",
            put_gamma=f"{put_gamma:.6f}",
            put_theta=f"{put_theta:.2f}",
            put_vega=f"{put_vega:.2f}",
            put_iv=f"{put_iv:.1f}",
            put_oi=put_chain.get("oi", 0),
            put_oi_change="N/A",
            put_volume=put_chain.get("volume", 0),
            put_bid=f"{put_chain.get('bid', put_current * 0.98):.2f}",
            put_ask=f"{put_chain.get('ask', put_current * 1.02):.2f}",
            put_spread=f"{(put_chain.get('ask', 0) - put_chain.get('bid', 0)):.2f}",
            put_pnl_rupees=f"{put_pnl:.2f}",
            put_pnl_percent=f"{put_pnl_pct:.1f}",
            
            # Combined P&L
            total_premium_collected=f"{total_premium:.2f}",
            current_position_value=f"{current_value:.2f}",
            total_unrealized_pnl=f"{total_pnl:.2f}",
            total_pnl_percent=f"{total_pnl_pct:.1f}",
            pnl_vs_max_profit=f"{pnl_vs_max:.1f}",
            max_loss_threshold=f"{max_loss_threshold:.2f}",
            distance_to_stoploss=f"{distance_to_stoploss:.1f}",
            position_delta=f"{position.total_delta:.4f}",
            
            # Market environment
            atm_iv=f"{atm_iv:.1f}",
            iv_percentile=iv_percentile,
            iv_rank=iv_rank,
            india_vix="15.0",  # TODO: Fetch live VIX
            vix_change="0.0",
            trend_5min="NEUTRAL",
            trend_15min="NEUTRAL",
            trend_1hour="NEUTRAL",
            rsi_value="50",
            support_level_1=f"{support_level:.0f}",
            resistance_level_1=f"{resistance_level:.0f}",
            call_distance_to_resistance=f"{call_dist_to_resist:.1f}",
            put_distance_to_support=f"{put_dist_to_support:.1f}",
            volume_ratio="1.0",
            max_pain_strike=atm,
            pcr_ratio=f"{pcr:.2f}",
            recent_market_events=events
        )
        
        return prompt
    
    def _find_support_from_oi(self, option_chain: Dict, spot: float) -> float:
        """Find support level from put OI concentration"""
        puts = option_chain.get("puts", {})
        if not puts:
            return spot * 0.98
        
        max_oi = 0
        support = spot * 0.98
        for strike, data in puts.items():
            if float(strike) < spot and data.get("oi", 0) > max_oi:
                max_oi = data.get("oi", 0)
                support = float(strike)
        return support
    
    def _find_resistance_from_oi(self, option_chain: Dict, spot: float) -> float:
        """Find resistance level from call OI concentration"""
        calls = option_chain.get("calls", {})
        if not calls:
            return spot * 1.02
        
        max_oi = 0
        resistance = spot * 1.02
        for strike, data in calls.items():
            if float(strike) > spot and data.get("oi", 0) > max_oi:
                max_oi = data.get("oi", 0)
                resistance = float(strike)
        return resistance
    
    def _get_recent_market_events(self) -> str:
        """Get recent market events or alerts"""
        events = []
        now = datetime.now()
        
        # Check if near market open/close
        if now.hour == 9 and now.minute < 30:
            events.append("⚠️ Market opening volatility expected")
        elif now.hour == 15 and now.minute > 0:
            events.append("⚠️ Approaching market close - reduced liquidity")
        
        # Check day of week
        if now.weekday() == 3:  # Thursday
            events.append("📅 Weekly expiry day - Gamma risk elevated")
        elif now.weekday() == 1:  # Tuesday (NIFTY weekly)
            events.append("📅 NIFTY weekly expiry - Watch for sharp moves")
        
        if not events:
            events.append("✅ No critical market events")
        
        return "\n".join(events)
    
    # ============================================
    # TRADING ACTIONS
    # ============================================
    
    async def enter_strangle(
        self,
        option_chain: Dict
    ) -> Dict:
        """
        Enter a new strangle position at target delta
        
        Returns:
            {success, call_order, put_order, position}
        """
        try:
            # Find strikes at target delta
            call_data, put_data = self.find_strikes_by_delta(
                option_chain,
                self.config.entry_delta
            )
            
            if not call_data or not put_data:
                return {"success": False, "error": "Could not find strikes at target delta"}
            
            self._log(f"Entering strangle: CE {call_data['strike']} @ delta {call_data['delta']:.1f}, "
                     f"PE {put_data['strike']} @ delta {put_data['delta']:.1f}")
            self._log(f"Identifiers - CE: sec_id={call_data.get('security_id', 'N/A')}, inst_key={call_data.get('instrument_key', 'N/A')}")
            self._log(f"Identifiers - PE: sec_id={put_data.get('security_id', 'N/A')}, inst_key={put_data.get('instrument_key', 'N/A')}")
            
            # Calculate quantity
            lot_size = LOT_SIZES.get(self.config.underlying, 65)
            quantity = lot_size * self.config.num_lots
            
            # Place orders (SELL)
            call_order = await self._place_order(
                strike=call_data["strike"],
                option_type="CE",
                quantity=quantity,
                side="SELL",
                price=call_data["price"],
                security_id=call_data.get("security_id", ""),
                instrument_key=call_data.get("instrument_key", "")
            )
            
            put_order = await self._place_order(
                strike=put_data["strike"],
                option_type="PE",
                quantity=quantity,
                side="SELL",
                price=put_data["price"],
                security_id=put_data.get("security_id", ""),
                instrument_key=put_data.get("instrument_key", "")
            )
            
            # Update position
            self.position = StranglePosition(
                call_leg=OptionLeg(
                    option_type="CE",
                    strike=call_data["strike"],
                    entry_price=call_data["price"],
                    current_price=call_data["price"],
                    quantity=quantity,
                    greeks=OptionGreeks(
                        delta=call_data["delta"],
                        gamma=call_data["gamma"],
                        theta=call_data["theta"],
                        vega=call_data["vega"],
                        iv=call_data["iv"]
                    ),
                    order_id=call_order.get("order_id", ""),
                    security_id=call_data.get("security_id", ""),
                    instrument_key=call_data.get("instrument_key", "")
                ),
                put_leg=OptionLeg(
                    option_type="PE",
                    strike=put_data["strike"],
                    entry_price=put_data["price"],
                    current_price=put_data["price"],
                    quantity=quantity,
                    greeks=OptionGreeks(
                        delta=put_data["delta"],
                        gamma=put_data["gamma"],
                        theta=put_data["theta"],
                        vega=put_data["vega"],
                        iv=put_data["iv"]
                    ),
                    order_id=put_order.get("order_id", ""),
                    security_id=put_data.get("security_id", ""),
                    instrument_key=put_data.get("instrument_key", "")
                ),
                status=PositionStatus.OPEN,
                entry_time=datetime.now(),
                entry_credit=(call_data["price"] + put_data["price"]) * quantity
            )
            
            return {
                "success": True,
                "call_order": call_order,
                "put_order": put_order,
                "position": {
                    "call_strike": call_data["strike"],
                    "call_delta": call_data["delta"],
                    "put_strike": put_data["strike"],
                    "put_delta": put_data["delta"],
                    "entry_credit": self.position.entry_credit,
                    "quantity": quantity
                }
            }
            
        except Exception as e:
            self._log(f"Error entering strangle: {e}", "ERROR")
            return {"success": False, "error": str(e)}
    
    async def enter_iron_condor(self, option_chain: Dict) -> Dict:
        """
        Enter an Iron Condor position (DEFINED RISK — ideal for hands-off).
        
        Structure:
        - SELL OTM Call at ~16δ (short call)
        - BUY further OTM Call at ~5δ (long call wing — protection)
        - SELL OTM Put at ~16δ (short put)
        - BUY further OTM Put at ~5δ (long put wing — protection)
        
        Max loss = wing width × lot size - net credit
        Max profit = net credit received
        """
        try:
            # Find short strikes at entry delta
            short_call, short_put = self.find_strikes_by_delta(
                option_chain, self.config.entry_delta
            )
            
            if not short_call or not short_put:
                return {"success": False, "error": "Could not find short strikes at target delta"}
            
            # Find long (protective) wings
            # Option 1: Use wing_width from config
            wing_width = self.config.wing_width
            long_call_strike = short_call["strike"] + wing_width
            long_put_strike = short_put["strike"] - wing_width
            
            # Find the actual option data for wing strikes
            long_call = self._find_nearest_strike(option_chain, long_call_strike, "CE")
            long_put = self._find_nearest_strike(option_chain, long_put_strike, "PE")
            
            if not long_call or not long_put:
                # Fallback: find wings by delta
                long_call = self.find_delta_strike(option_chain, self.config.wing_delta, "CE")
                long_put = self.find_delta_strike(option_chain, self.config.wing_delta, "PE")
            
            if not long_call or not long_put:
                return {"success": False, "error": "Could not find protective wing strikes"}
            
            self._log(
                f"Entering Iron Condor:\n"
                f"  Short CE: {short_call['strike']} @ δ{short_call['delta']:.1f} (₹{short_call['price']:.2f})\n"
                f"  Long CE:  {long_call['strike']} @ δ{long_call.get('delta', 0):.1f} (₹{long_call.get('price', 0):.2f})\n"
                f"  Short PE: {short_put['strike']} @ δ{short_put['delta']:.1f} (₹{short_put['price']:.2f})\n"
                f"  Long PE:  {long_put['strike']} @ δ{long_put.get('delta', 0):.1f} (₹{long_put.get('price', 0):.2f})"
            )
            
            lot_size = LOT_SIZES.get(self.config.underlying, 65)
            quantity = lot_size * self.config.num_lots
            
            # Place 4 orders: SELL short legs, BUY long (wing) legs
            sc_order = await self._place_order(
                strike=short_call["strike"], option_type="CE", quantity=quantity,
                side="SELL", price=short_call["price"],
                security_id=short_call.get("security_id", ""),
                instrument_key=short_call.get("instrument_key", "")
            )
            lc_order = await self._place_order(
                strike=long_call["strike"], option_type="CE", quantity=quantity,
                side="BUY", price=long_call.get("price", 0),
                security_id=long_call.get("security_id", ""),
                instrument_key=long_call.get("instrument_key", "")
            )
            sp_order = await self._place_order(
                strike=short_put["strike"], option_type="PE", quantity=quantity,
                side="SELL", price=short_put["price"],
                security_id=short_put.get("security_id", ""),
                instrument_key=short_put.get("instrument_key", "")
            )
            lp_order = await self._place_order(
                strike=long_put["strike"], option_type="PE", quantity=quantity,
                side="BUY", price=long_put.get("price", 0),
                security_id=long_put.get("security_id", ""),
                instrument_key=long_put.get("instrument_key", "")
            )
            
            # Net credit = (short premiums sold) - (long premiums paid)
            net_credit = (
                (short_call["price"] + short_put["price"]) -
                (long_call.get("price", 0) + long_put.get("price", 0))
            ) * quantity
            
            # Max loss = (wing_width × lot_size) - net_credit
            actual_wing_ce = abs(long_call["strike"] - short_call["strike"])
            actual_wing_pe = abs(short_put["strike"] - long_put["strike"])
            max_loss = max(actual_wing_ce, actual_wing_pe) * quantity - net_credit
            
            # Update position (track short legs for adjustment, wings are set-and-forget)
            self.position = StranglePosition(
                call_leg=OptionLeg(
                    option_type="CE", strike=short_call["strike"],
                    entry_price=short_call["price"], current_price=short_call["price"],
                    quantity=quantity,
                    greeks=OptionGreeks(
                        delta=short_call["delta"], gamma=short_call["gamma"],
                        theta=short_call["theta"], vega=short_call["vega"], iv=short_call["iv"]
                    ),
                    order_id=sc_order.get("order_id", ""),
                    security_id=short_call.get("security_id", ""),
                    instrument_key=short_call.get("instrument_key", "")
                ),
                put_leg=OptionLeg(
                    option_type="PE", strike=short_put["strike"],
                    entry_price=short_put["price"], current_price=short_put["price"],
                    quantity=quantity,
                    greeks=OptionGreeks(
                        delta=short_put["delta"], gamma=short_put["gamma"],
                        theta=short_put["theta"], vega=short_put["vega"], iv=short_put["iv"]
                    ),
                    order_id=sp_order.get("order_id", ""),
                    security_id=short_put.get("security_id", ""),
                    instrument_key=short_put.get("instrument_key", "")
                ),
                status=PositionStatus.OPEN,
                entry_time=datetime.now(),
                entry_credit=net_credit
            )
            
            self._log(f"✅ Iron Condor entered! Net credit: ₹{net_credit:.2f}, Max loss: ₹{max_loss:.2f}")
            
            return {
                "success": True,
                "strategy": "iron_condor",
                "orders": {
                    "short_call": sc_order, "long_call": lc_order,
                    "short_put": sp_order, "long_put": lp_order
                },
                "position": {
                    "short_call_strike": short_call["strike"],
                    "long_call_strike": long_call["strike"],
                    "short_put_strike": short_put["strike"],
                    "long_put_strike": long_put["strike"],
                    "net_credit": net_credit,
                    "max_loss": max_loss,
                    "quantity": quantity
                }
            }
            
        except Exception as e:
            self._log(f"Error entering iron condor: {e}", "ERROR")
            return {"success": False, "error": str(e)}
    
    async def enter_iron_butterfly(self, option_chain: Dict) -> Dict:
        """
        Enter an Iron Butterfly position (HIGH PREMIUM, DEFINED RISK).
        
        Structure:
        - SELL ATM Call (at-the-money)
        - SELL ATM Put (at-the-money)
        - BUY OTM Call (wing_width points above ATM)
        - BUY OTM Put (wing_width points below ATM)
        
        Higher premium than condor but needs market to stay near ATM.
        Auto-adjusts center strike when underlying moves significantly.
        """
        try:
            spot = option_chain.get("underlying_price", 25000)
            
            # Find ATM strike
            step = 50 if self.config.underlying in ["NIFTY", "FINNIFTY"] else 100
            atm_strike = round(spot / step) * step
            
            # Get ATM option data
            atm_call = option_chain.get("calls", {}).get(atm_strike, {})
            atm_put = option_chain.get("puts", {}).get(atm_strike, {})
            
            if not atm_call or not atm_put:
                return {"success": False, "error": f"No data for ATM strike {atm_strike}"}
            
            # Calculate wing strikes
            wing_width = self.config.wing_width
            long_call_strike = atm_strike + wing_width
            long_put_strike = atm_strike - wing_width
            
            long_call = option_chain.get("calls", {}).get(long_call_strike, {})
            long_put = option_chain.get("puts", {}).get(long_put_strike, {})
            
            # Fallback: find nearest available strikes
            if not long_call:
                long_call = self._find_nearest_strike(option_chain, long_call_strike, "CE") or {}
                long_call_strike = long_call.get("strike", long_call_strike)
            if not long_put:
                long_put = self._find_nearest_strike(option_chain, long_put_strike, "PE") or {}
                long_put_strike = long_put.get("strike", long_put_strike)
            
            self._log(
                f"Entering Iron Butterfly:\n"
                f"  ATM CE (SELL): {atm_strike} @ ₹{atm_call.get('price', 0):.2f}\n"
                f"  ATM PE (SELL): {atm_strike} @ ₹{atm_put.get('price', 0):.2f}\n"
                f"  Wing CE (BUY): {long_call_strike} @ ₹{long_call.get('price', 0):.2f}\n"
                f"  Wing PE (BUY): {long_put_strike} @ ₹{long_put.get('price', 0):.2f}"
            )
            
            lot_size = LOT_SIZES.get(self.config.underlying, 65)
            quantity = lot_size * self.config.num_lots
            
            # Place 4 orders
            sc_order = await self._place_order(
                strike=atm_strike, option_type="CE", quantity=quantity,
                side="SELL", price=atm_call.get("price", 0),
                security_id=atm_call.get("security_id", ""),
                instrument_key=atm_call.get("instrument_key", "")
            )
            sp_order = await self._place_order(
                strike=atm_strike, option_type="PE", quantity=quantity,
                side="SELL", price=atm_put.get("price", 0),
                security_id=atm_put.get("security_id", ""),
                instrument_key=atm_put.get("instrument_key", "")
            )
            lc_order = await self._place_order(
                strike=long_call_strike, option_type="CE", quantity=quantity,
                side="BUY", price=long_call.get("price", 0),
                security_id=long_call.get("security_id", ""),
                instrument_key=long_call.get("instrument_key", "")
            )
            lp_order = await self._place_order(
                strike=long_put_strike, option_type="PE", quantity=quantity,
                side="BUY", price=long_put.get("price", 0),
                security_id=long_put.get("security_id", ""),
                instrument_key=long_put.get("instrument_key", "")
            )
            
            net_credit = (
                (atm_call.get("price", 0) + atm_put.get("price", 0)) -
                (long_call.get("price", 0) + long_put.get("price", 0))
            ) * quantity
            max_loss = wing_width * quantity - net_credit
            
            # Track short legs (ATM)
            self.position = StranglePosition(
                call_leg=OptionLeg(
                    option_type="CE", strike=atm_strike,
                    entry_price=atm_call.get("price", 0), current_price=atm_call.get("price", 0),
                    quantity=quantity,
                    greeks=OptionGreeks(
                        delta=atm_call.get("delta", 50), gamma=atm_call.get("gamma", 0),
                        theta=atm_call.get("theta", 0), vega=atm_call.get("vega", 0),
                        iv=atm_call.get("iv", 0)
                    ),
                    security_id=atm_call.get("security_id", ""),
                    instrument_key=atm_call.get("instrument_key", "")
                ),
                put_leg=OptionLeg(
                    option_type="PE", strike=atm_strike,
                    entry_price=atm_put.get("price", 0), current_price=atm_put.get("price", 0),
                    quantity=quantity,
                    greeks=OptionGreeks(
                        delta=atm_put.get("delta", -50), gamma=atm_put.get("gamma", 0),
                        theta=atm_put.get("theta", 0), vega=atm_put.get("vega", 0),
                        iv=atm_put.get("iv", 0)
                    ),
                    security_id=atm_put.get("security_id", ""),
                    instrument_key=atm_put.get("instrument_key", "")
                ),
                status=PositionStatus.OPEN,
                entry_time=datetime.now(),
                entry_credit=net_credit
            )
            
            self._log(f"✅ Iron Butterfly entered! Net credit: ₹{net_credit:.2f}, Max loss: ₹{max_loss:.2f}")
            
            return {
                "success": True,
                "strategy": "iron_butterfly",
                "orders": {
                    "short_call": sc_order, "short_put": sp_order,
                    "long_call": lc_order, "long_put": lp_order
                },
                "position": {
                    "atm_strike": atm_strike,
                    "long_call_strike": long_call_strike,
                    "long_put_strike": long_put_strike,
                    "net_credit": net_credit,
                    "max_loss": max_loss,
                    "quantity": quantity
                }
            }
            
        except Exception as e:
            self._log(f"Error entering iron butterfly: {e}", "ERROR")
            return {"success": False, "error": str(e)}
    
    async def enter_position_by_strategy(self, option_chain: Dict) -> Dict:
        """
        Enter position based on configured strategy_mode.
        This is the unified entry point that auto-selects the right strategy.
        """
        mode = self.config.strategy_mode
        
        self._log(f"📊 Entering {mode} position for {self.config.underlying} ({self.config.timeframe} mode)")
        
        if mode == "iron_condor":
            return await self.enter_iron_condor(option_chain)
        elif mode == "iron_butterfly":
            return await self.enter_iron_butterfly(option_chain)
        elif mode == "straddle_hedge":
            # Straddle hedge = iron butterfly with wider wings + more aggressive adjustment
            self.config.entry_delta = 50.0  # ATM
            return await self.enter_iron_butterfly(option_chain)
        else:  # short_strangle (default/legacy)
            return await self.enter_strangle(option_chain)
    
    def _find_nearest_strike(self, option_chain: Dict, target_strike: float, option_type: str) -> Optional[Dict]:
        """Find the nearest available strike to target in option chain"""
        options = option_chain.get("calls" if option_type == "CE" else "puts", {})
        
        if not options:
            return None
        
        best = None
        best_diff = float('inf')
        
        for strike, data in options.items():
            diff = abs(float(strike) - target_strike)
            if diff < best_diff:
                best_diff = diff
                best = {
                    "strike": float(strike),
                    "price": data.get("price", 0),
                    "delta": data.get("delta", 0),
                    "gamma": data.get("gamma", 0),
                    "theta": data.get("theta", 0),
                    "vega": data.get("vega", 0),
                    "iv": data.get("iv", 0),
                    "oi": data.get("oi", 0),
                    "security_id": data.get("security_id", ""),
                    "instrument_key": data.get("instrument_key", ""),
                }
        
        return best

    async def adjust_position(
        self,
        option_chain: Dict,
        leg_to_adjust: str,  # "CE" or "PE"
        target_delta: Optional[float] = None
    ) -> Dict:
        """
        Adjust one leg of the strangle by rolling to new strike
        
        Returns:
            {success, close_order, open_order, new_strike}
        """
        try:
            target_delta = target_delta or self.config.roll_target_delta
            
            # Get current leg
            current_leg = self.position.call_leg if leg_to_adjust == "CE" else self.position.put_leg
            if not current_leg:
                return {"success": False, "error": f"No {leg_to_adjust} leg to adjust"}
            
            # Find new strike at target delta
            new_strike_data = self.find_delta_strike(option_chain, target_delta, leg_to_adjust)
            if not new_strike_data:
                return {"success": False, "error": f"Could not find strike at {target_delta} delta"}
            
            self._log(f"Adjusting {leg_to_adjust}: {current_leg.strike} -> {new_strike_data['strike']} "
                     f"(delta {current_leg.greeks.delta:.1f} -> {new_strike_data['delta']:.1f})")
            
            self.position.status = PositionStatus.ADJUSTING
            
            # Close current leg (BUY)
            # Close current leg (BUY to close)
            close_order = await self._place_order(
                strike=current_leg.strike,
                option_type=leg_to_adjust,
                quantity=current_leg.quantity,
                side="BUY",
                price=current_leg.current_price,
                security_id=current_leg.security_id,
                instrument_key=current_leg.instrument_key
            )
            
            # Open new leg (SELL)
            open_order = await self._place_order(
                strike=new_strike_data["strike"],
                option_type=leg_to_adjust,
                quantity=current_leg.quantity,
                side="SELL",
                price=new_strike_data["price"],
                security_id=new_strike_data.get("security_id", ""),
                instrument_key=new_strike_data.get("instrument_key", "")
            )
            
            # Update leg
            new_leg = OptionLeg(
                option_type=leg_to_adjust,
                strike=new_strike_data["strike"],
                entry_price=new_strike_data["price"],
                current_price=new_strike_data["price"],
                quantity=current_leg.quantity,
                greeks=OptionGreeks(
                    delta=new_strike_data["delta"],
                    gamma=new_strike_data["gamma"],
                    theta=new_strike_data["theta"],
                    vega=new_strike_data["vega"],
                    iv=new_strike_data["iv"]
                ),
                order_id=open_order.get("order_id", ""),
                security_id=new_strike_data.get("security_id", ""),
                instrument_key=new_strike_data.get("instrument_key", "")
            )
            
            if leg_to_adjust == "CE":
                self.position.call_leg = new_leg
            else:
                self.position.put_leg = new_leg
            
            self.position.num_adjustments += 1
            self.position.adjustment_history.append({
                "time": datetime.now().isoformat(),
                "leg": leg_to_adjust,
                "old_strike": current_leg.strike,
                "new_strike": new_strike_data["strike"],
                "reason": f"Delta exceeded {self.config.adjustment_trigger_delta}"
            })
            self.position.status = PositionStatus.OPEN
            self.last_adjustment_time = datetime.now()
            
            return {
                "success": True,
                "close_order": close_order,
                "open_order": open_order,
                "old_strike": current_leg.strike,
                "new_strike": new_strike_data["strike"],
                "new_delta": new_strike_data["delta"]
            }
            
        except Exception as e:
            self._log(f"Error adjusting position: {e}", "ERROR")
            self.position.status = PositionStatus.OPEN
            return {"success": False, "error": str(e)}
    
    async def close_position(self) -> Dict:
        """Close the entire strangle position"""
        try:
            if self.position.status != PositionStatus.OPEN:
                return {"success": False, "error": "No open position"}
            
            self.position.status = PositionStatus.CLOSING
            
            results = {"call_close": None, "put_close": None}
            
            # Close call leg
            if self.position.call_leg:
                results["call_close"] = await self._place_order(
                    strike=self.position.call_leg.strike,
                    option_type="CE",
                    quantity=self.position.call_leg.quantity,
                    side="BUY",
                    price=self.position.call_leg.current_price,
                    security_id=self.position.call_leg.security_id,
                    instrument_key=self.position.call_leg.instrument_key
                )
            
            # Close put leg
            if self.position.put_leg:
                results["put_close"] = await self._place_order(
                    strike=self.position.put_leg.strike,
                    option_type="PE",
                    quantity=self.position.put_leg.quantity,
                    side="BUY",
                    price=self.position.put_leg.current_price,
                    security_id=self.position.put_leg.security_id,
                    instrument_key=self.position.put_leg.instrument_key
                )
            
            final_pnl = self.position.total_pnl
            
            self._log(f"Position closed. Final P&L: ₹{final_pnl:.2f}")
            
            # Reset position
            self.position.status = PositionStatus.CLOSED
            
            return {
                "success": True,
                "final_pnl": final_pnl,
                "results": results
            }
            
        except Exception as e:
            self._log(f"Error closing position: {e}", "ERROR")
            return {"success": False, "error": str(e)}
    
    async def _place_order(
        self,
        strike: float,
        option_type: str,
        quantity: int,
        side: str,
        price: float,
        security_id: str = "",
        instrument_key: str = ""
    ) -> Dict:
        """Place order via broker"""
        try:
            # Get expiry
            expiry = await self._get_nearest_expiry(self.config.underlying)
            
            if self.broker == "upstox":
                return await self._place_upstox_order(
                    strike, option_type, quantity, side, price, expiry, instrument_key
                )
            else:
                return await self._place_dhan_order(
                    strike, option_type, quantity, side, price, expiry, security_id
                )
                
        except Exception as e:
            self._log(f"Order placement error: {e}", "ERROR")
            return {"success": False, "error": str(e)}
    
    async def _place_upstox_order(
        self,
        strike: float,
        option_type: str,
        quantity: int,
        side: str,
        price: float,
        expiry: str,
        instrument_key: str = ""
    ) -> Dict:
        """Place order via Upstox"""
        try:
            # Get actual instrument_key from Upstox API if not provided
            if not instrument_key:
                instrument_key = await self._get_upstox_instrument_key(strike, option_type, expiry)
            
            if not instrument_key:
                self._log(f"Could not find Upstox instrument for {strike}{option_type}", "ERROR")
                return {"success": False, "error": f"Instrument not found for {strike}{option_type}", "broker": "upstox"}
            
            self._log(f"Upstox order: {side} {quantity} x {instrument_key}")
            
            client = await self._get_http_client()
            
            response = await client.post(
                "https://api.upstox.com/v2/order/place",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "quantity": quantity,
                    "product": "D",  # Intraday
                    "validity": "DAY",
                    "price": 0,  # Market order
                    "tag": "delta_strangle",
                    "instrument_token": instrument_key,
                    "order_type": "MARKET",
                    "transaction_type": side,
                    "disclosed_quantity": 0,
                    "trigger_price": 0,
                    "is_amo": False
                }
            )
            
            data = response.json()
            
            if response.status_code == 200 and data.get("status") == "success":
                return {
                    "success": True,
                    "order_id": data.get("data", {}).get("order_id"),
                    "broker": "upstox"
                }
            else:
                return {
                    "success": False,
                    "error": data.get("message", "Order failed"),
                    "broker": "upstox"
                }
                
        except Exception as e:
            return {"success": False, "error": str(e), "broker": "upstox"}
    
    async def _get_upstox_instrument_key(self, strike: float, option_type: str, expiry: str) -> Optional[str]:
        """
        Get Upstox instrument_key by looking up option contracts from API
        Returns format like 'NSE_FO|12345'
        """
        try:
            # Use underlying mapping for index
            underlying_map = {
                "NIFTY": "NSE_INDEX|Nifty%2050",
                "BANKNIFTY": "NSE_INDEX|Nifty%20Bank",
                "FINNIFTY": "NSE_INDEX|Nifty%20Fin%20Service"
            }
            
            underlying_key = underlying_map.get(self.config.underlying, f"NSE_INDEX|{self.config.underlying}")
            url = f"https://api.upstox.com/v2/option/contract?instrument_key={underlying_key}"
            
            client = await self._get_http_client()
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Accept": "application/json"
                }
            )
            
            if response.status_code != 200:
                self._log(f"Upstox contract API error: {response.status_code}", "ERROR")
                return None
            
            data = response.json()
            contracts = data.get("data", [])
            
            # Parse expiry to match format
            exp_date = datetime.strptime(expiry, "%Y-%m-%d")
            expiry_str = exp_date.strftime("%Y-%m-%d")
            
            # Find matching contract
            for contract in contracts:
                contract_strike = contract.get("strike_price", 0)
                contract_type = contract.get("instrument_type", "")
                contract_expiry = contract.get("expiry", "")
                
                if (float(contract_strike) == float(strike) and 
                    contract_type == option_type and
                    contract_expiry == expiry_str):
                    instrument_key = contract.get("instrument_key")
                    self._log(f"Found Upstox instrument: {strike}{option_type} -> {instrument_key}")
                    return instrument_key
            
            # If exact match not found, try finding by strike and type (any expiry)
            self._log(f"No exact match for {strike}{option_type} exp {expiry}, checking all expiries", "WARNING")
            for contract in contracts:
                contract_strike = contract.get("strike_price", 0)
                contract_type = contract.get("instrument_type", "")
                
                if (float(contract_strike) == float(strike) and contract_type == option_type):
                    instrument_key = contract.get("instrument_key")
                    self._log(f"Found Upstox instrument (diff expiry): {strike}{option_type} -> {instrument_key}")
                    return instrument_key
            
            self._log(f"No Upstox contract found for {strike}{option_type}", "ERROR")
            return None
            
        except Exception as e:
            self._log(f"Error getting Upstox instrument key: {e}", "ERROR")
            return None
    
    async def _place_dhan_order(
        self,
        strike: float,
        option_type: str,
        quantity: int,
        side: str,
        price: float,
        expiry: str,
        security_id: str = ""
    ) -> Dict:
        """Place order via Dhan"""
        try:
            # Use broker_service if available (preferred for Dhan)
            if hasattr(self.broker_service, 'place_order') and security_id:
                self._log(f"Placing Dhan order via broker_service: {side} {quantity} x {strike}{option_type} (secId: {security_id})")
                
                result = await self.broker_service.place_order(
                    security_id=security_id,
                    exchange_segment="NSE_FNO",
                    transaction_type=side,
                    quantity=quantity,
                    order_type="MARKET",
                    product_type="INTRADAY",
                    price=0,
                    trigger_price=0
                )
                
                return {
                    "success": result.get("success", False),
                    "order_id": result.get("order_id", ""),
                    "broker": "dhan",
                    "error": result.get("error", "")
                }
            
            # Fallback: Direct API call (needs security_id)
            if not security_id:
                self._log(f"WARNING: No security_id for {strike}{option_type}, order may fail", "ERROR")
                # Try to construct a placeholder (this likely won't work)
                security_id = f"{self.config.underlying}_{expiry}_{int(strike)}_{option_type}"
            
            client = await self._get_http_client()
            
            transaction_type = "SELL" if side == "SELL" else "BUY"
            
            self._log(f"Placing Dhan order directly: {transaction_type} {quantity} x {strike}{option_type}")
            
            response = await client.post(
                f"{DHAN_API_BASE}/orders",
                headers={
                    "access-token": self.access_token,
                    "Content-Type": "application/json"
                },
                json={
                    "dhanClientId": "",  # Will be set by Dhan
                    "transactionType": transaction_type,
                    "exchangeSegment": "NSE_FNO",
                    "productType": "INTRADAY",
                    "orderType": "MARKET",
                    "validity": "DAY",
                    "securityId": str(security_id),
                    "quantity": quantity,
                    "price": 0,
                    "triggerPrice": 0
                }
            )
            
            data = response.json()
            
            if response.status_code == 200 and data.get("orderId"):
                self._log(f"Order placed successfully: {data.get('orderId')}")
                return {
                    "success": True,
                    "order_id": data.get("orderId"),
                    "broker": "dhan"
                }
            else:
                error_msg = data.get("message") or data.get("errorMessage") or "Order failed"
                self._log(f"Order failed: {error_msg}", "ERROR")
                return {
                    "success": False,
                    "error": error_msg,
                    "broker": "dhan"
                }
                
        except Exception as e:
            self._log(f"Dhan order exception: {e}", "ERROR")
            return {"success": False, "error": str(e), "broker": "dhan"}
    
    # ============================================
    # BOT CONTROL METHODS
    # ============================================
    
    async def start(self, config: Optional[DeltaStrangleConfig] = None) -> Dict:
        """Start the bot"""
        try:
            if config:
                self.config = config
                # Enforce lot size
                self.config.lot_size = LOT_SIZES.get(self.config.underlying, 65)
            
            self._log(f"Starting AI Delta Strangle Bot for {self.config.underlying}")
            self._log(f"Strategy: {self.config.strategy_mode} | Timeframe: {self.config.timeframe}")
            self._log(f"Entry Delta: {self.config.entry_delta}, Adjustment Trigger: {self.config.adjustment_trigger_delta}")
            self._log(f"AI Enabled: {self.config.use_ai_decisions}, Lots: {self.config.num_lots}")
            if self.config.strategy_mode in ("iron_condor", "iron_butterfly"):
                self._log(f"Wing Width: {self.config.wing_width} pts (defined risk)")
            
            self.status = BotStatus.RUNNING
            self._running = True
            
            # Fetch initial option chain
            option_chain = await self.fetch_option_chain()
            
            # Get AI decision for initial entry
            ai_decision = None
            if self.config.use_ai_decisions and self.claude_api_key:
                ai_decision = await self.get_claude_decision(option_chain)
            
            # Enter position based on strategy if no position and within trading hours
            entry_result = None
            if self.position.status == PositionStatus.NONE:
                if self._is_trading_hours():
                    entry_result = await self.enter_position_by_strategy(option_chain)
                else:
                    self._log("Outside trading hours, waiting...")
            
            return {
                "success": True,
                "message": f"{self.config.strategy_mode.replace('_', ' ').title()} bot started ({self.config.timeframe} mode)",
                "strategy": self.config.strategy_mode,
                "timeframe": self.config.timeframe,
                "config": asdict(self.config),
                "ai_decision": ai_decision,
                "position": entry_result.get("position") if entry_result else None
            }
            
        except Exception as e:
            self._log(f"Error starting bot: {e}", "ERROR")
            self.status = BotStatus.ERROR
            return {"success": False, "error": str(e)}
    
    async def stop(self, close_positions: bool = True) -> Dict:
        """Stop the bot"""
        self._running = False
        self.status = BotStatus.STOPPED
        
        close_result = None
        if close_positions and self.position.status == PositionStatus.OPEN:
            close_result = await self.close_position()
        
        self._log("Bot stopped")
        
        return {
            "success": True,
            "message": "Bot stopped",
            "close_result": close_result
        }
    
    async def scan_once(self) -> Dict:
        """
        Perform one scan iteration - use this for serverless execution
        
        Returns:
            {
                "option_chain": snapshot,
                "position": current position,
                "ai_decision": Claude's recommendation,
                "action_taken": any adjustments made
            }
        """
        try:
            self.last_scan_time = datetime.now()
            
            # Fetch option chain
            option_chain = await self.fetch_option_chain()
            
            # Update current prices and Greeks
            if self.position.status == PositionStatus.OPEN:
                await self._update_position_greeks(option_chain)
            
            # Get AI decision
            ai_decision = None
            if self.config.use_ai_decisions and self.claude_api_key:
                ai_decision = await self.get_claude_decision(option_chain, self.position)
                self.last_ai_decision = ai_decision
            
            action_taken = None
            
            # Extract action from new decision format
            ai_action = ai_decision.get("decision", {}).get("action", "HOLD") if ai_decision else "HOLD"
            ai_confidence = ai_decision.get("decision", {}).get("confidence_score", 0) if ai_decision else 0
            ai_urgency = ai_decision.get("decision", {}).get("urgency", "LOW") if ai_decision else "LOW"
            
            # Check if action needed
            if self.position.status == PositionStatus.OPEN:
                # Check profit target
                if self._check_profit_target():
                    action_taken = await self.close_position()
                    action_taken["reason"] = "profit_target"
                    action_taken["trigger"] = "50% profit target reached"
                
                # Check stop loss
                elif self._check_stop_loss():
                    action_taken = await self.close_position()
                    action_taken["reason"] = "stop_loss"
                    action_taken["trigger"] = "200% max loss breached"
                
                # Check delta breach (rule-based)
                elif self._should_adjust():
                    leg = self._get_breach_leg()
                    if leg:
                        action_taken = await self.adjust_position(option_chain, leg)
                        action_taken["reason"] = "delta_breach"
                        action_taken["trigger"] = f"{leg} delta exceeded {self.config.adjustment_trigger_delta}"
                
                # Check AI recommendation with CRITICAL urgency (immediate action)
                elif ai_decision and ai_urgency == "CRITICAL":
                    action_taken = await self._execute_ai_decision(ai_action, option_chain)
                    if action_taken:
                        action_taken["reason"] = "ai_critical"
                        action_taken["trigger"] = ai_decision.get("reasoning", {}).get("why_this_action", "AI critical decision")
                
                # Check AI recommendation with confidence threshold
                elif ai_decision and ai_confidence >= self.config.ai_confidence_threshold:
                    action_taken = await self._execute_ai_decision(ai_action, option_chain)
                    if action_taken:
                        action_taken["reason"] = "ai_recommendation"
                        action_taken["trigger"] = ai_decision.get("reasoning", {}).get("why_this_action", "AI recommendation")
            
            # Entry check
            elif self.position.status == PositionStatus.NONE and self._is_trading_hours():
                if ai_action == "ENTER_TRADE" and ai_confidence >= self.config.ai_confidence_threshold:
                    action_taken = await self.enter_position_by_strategy(option_chain)
                    action_taken["reason"] = "ai_new_entry"
                    action_taken["trigger"] = f"AI recommended new entry ({self.config.strategy_mode})"
            
            return {
                "spot_price": option_chain.get("underlying_price"),
                "expiry": option_chain.get("expiry"),
                "atm_iv": self.get_atm_iv(option_chain),
                "position": self._get_position_summary(),
                "ai_decision": ai_decision,
                "ai_summary": {
                    "action": ai_action,
                    "confidence": ai_confidence,
                    "urgency": ai_urgency
                },
                "action_taken": action_taken,
                "monitoring_alerts": ai_decision.get("monitoring_alerts", []) if ai_decision else [],
                "scan_time": self.last_scan_time.isoformat()
            }
            
        except Exception as e:
            self._log(f"Scan error: {e}", "ERROR")
            return {"error": str(e)}
    
    async def _execute_ai_decision(self, action: str, option_chain: Dict) -> Optional[Dict]:
        """Execute an AI decision action"""
        if action == "ADJUST_CALL":
            return await self.adjust_position(option_chain, "CE")
        elif action == "ADJUST_PUT":
            return await self.adjust_position(option_chain, "PE")
        elif action == "CLOSE_POSITION":
            return await self.close_position()
        return None
    
    async def _update_position_greeks(self, option_chain: Dict):
        """Update position with current Greeks from option chain"""
        if self.position.call_leg:
            strike = self.position.call_leg.strike
            call_data = option_chain.get("calls", {}).get(strike, {})
            if call_data:
                self.position.call_leg.current_price = call_data.get("price", self.position.call_leg.current_price)
                self.position.call_leg.greeks = OptionGreeks(
                    delta=call_data.get("delta", 0),
                    gamma=call_data.get("gamma", 0),
                    theta=call_data.get("theta", 0),
                    vega=call_data.get("vega", 0),
                    iv=call_data.get("iv", 0)
                )
        
        if self.position.put_leg:
            strike = self.position.put_leg.strike
            put_data = option_chain.get("puts", {}).get(strike, {})
            if put_data:
                self.position.put_leg.current_price = put_data.get("price", self.position.put_leg.current_price)
                self.position.put_leg.greeks = OptionGreeks(
                    delta=put_data.get("delta", 0),
                    gamma=put_data.get("gamma", 0),
                    theta=put_data.get("theta", 0),
                    vega=put_data.get("vega", 0),
                    iv=put_data.get("iv", 0)
                )
    
    def _check_profit_target(self) -> bool:
        """Check if profit target reached"""
        if self.position.entry_credit <= 0:
            return False
        profit_pct = (self.position.total_pnl / self.position.entry_credit) * 100
        return profit_pct >= self.config.profit_target_pct
    
    def _check_stop_loss(self) -> bool:
        """Check if stop loss hit"""
        if self.position.entry_credit <= 0:
            return False
        max_loss = self.position.entry_credit * self.config.max_loss_multiplier
        return self.position.total_pnl <= -max_loss
    
    def _should_adjust(self) -> bool:
        """Check if any leg needs adjustment"""
        if self.position.num_adjustments >= self.config.max_adjustments_per_day:
            return False
        
        # Check cooldown
        if self.last_adjustment_time:
            cooldown = timedelta(seconds=self.config.adjustment_cooldown_seconds)
            if datetime.now() - self.last_adjustment_time < cooldown:
                return False
        
        return self._get_breach_leg() is not None
    
    def _get_breach_leg(self) -> Optional[str]:
        """Get which leg has breached delta threshold"""
        trigger = self.config.adjustment_trigger_delta
        
        if self.position.call_leg:
            if abs(self.position.call_leg.greeks.delta) >= trigger:
                return "CE"
        
        if self.position.put_leg:
            if abs(self.position.put_leg.greeks.delta) >= trigger:
                return "PE"
        
        return None
    
    def _is_trading_hours(self) -> bool:
        """Check if within trading hours (IST)"""
        # IST is UTC+5:30
        IST = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(IST)
        
        # Weekend check
        if now.weekday() >= 5:
            return False
        
        current_time = now.time()
        entry_time = datetime.strptime(self.config.entry_time, "%H:%M").time()
        exit_time = datetime.strptime(self.config.exit_time, "%H:%M").time()
        
        self._log(f"Trading hours check: IST={now.strftime('%H:%M:%S')}, entry={self.config.entry_time}, exit={self.config.exit_time}, in_range={entry_time <= current_time <= exit_time}")
        
        return entry_time <= current_time <= exit_time
    
    def _get_position_summary(self) -> Dict:
        """Get position summary for API response"""
        if self.position.status == PositionStatus.NONE:
            return {"status": "none"}
        
        return {
            "status": self.position.status.value,
            "call_leg": {
                "strike": self.position.call_leg.strike,
                "entry_price": self.position.call_leg.entry_price,
                "current_price": self.position.call_leg.current_price,
                "quantity": self.position.call_leg.quantity,
                "delta": self.position.call_leg.greeks.delta,
                "gamma": self.position.call_leg.greeks.gamma,
                "theta": self.position.call_leg.greeks.theta,
                "iv": self.position.call_leg.greeks.iv,
                "pnl": self.position.call_leg.pnl
            } if self.position.call_leg else None,
            "put_leg": {
                "strike": self.position.put_leg.strike,
                "entry_price": self.position.put_leg.entry_price,
                "current_price": self.position.put_leg.current_price,
                "quantity": self.position.put_leg.quantity,
                "delta": self.position.put_leg.greeks.delta,
                "gamma": self.position.put_leg.greeks.gamma,
                "theta": self.position.put_leg.greeks.theta,
                "iv": self.position.put_leg.greeks.iv,
                "pnl": self.position.put_leg.pnl
            } if self.position.put_leg else None,
            "entry_credit": self.position.entry_credit,
            "total_pnl": self.position.total_pnl,
            "net_delta": self.position.total_delta,
            "adjustments": self.position.num_adjustments,
            "entry_time": self.position.entry_time.isoformat() if self.position.entry_time else None
        }
    
    def get_status(self) -> Dict:
        """Get full bot status including AI decision history"""
        return {
            "is_running": self._running,
            "status": self.status.value,
            "config": asdict(self.config),
            "position": self._get_position_summary(),
            "last_scan": self.last_scan_time.isoformat() if self.last_scan_time else None,
            "last_adjustment": self.last_adjustment_time.isoformat() if self.last_adjustment_time else None,
            "last_ai_decision": self.last_ai_decision,
            "decision_history": self.decision_history[-10:],  # Last 10 decisions
            "total_decisions": len(self.decision_history),
            "logs": self.logs[-20:]
        }
    
    def get_decision_history(self, limit: int = 50) -> List[Dict]:
        """Get AI decision history"""
        return self.decision_history[-limit:]
    
    def update_config(self, updates: Dict) -> Dict:
        """Update bot configuration"""
        for key, value in updates.items():
            if hasattr(self.config, key):
                # Don't allow lot_size override
                if key == "lot_size":
                    continue
                setattr(self.config, key, value)
        
        # Re-enforce lot size
        self.config.lot_size = LOT_SIZES.get(self.config.underlying, 65)
        
        self._log(f"Config updated: {updates}")
        
        return {
            "success": True,
            "config": asdict(self.config)
        }


# ============================================
# BOT REGISTRY (for API access)
# ============================================

_bot_registry: Dict[str, AIDeltaStrangleBot] = {}


def get_or_create_delta_strangle_bot(
    user_id: str,
    broker_service: Any,
    access_token: str,
    broker: str = "dhan",
    claude_api_key: Optional[str] = None
) -> AIDeltaStrangleBot:
    """Get or create a bot instance for a user"""
    if user_id not in _bot_registry:
        _bot_registry[user_id] = AIDeltaStrangleBot(
            broker_service=broker_service,
            access_token=access_token,
            broker=broker,
            claude_api_key=claude_api_key
        )
    return _bot_registry[user_id]


def get_delta_strangle_bot(user_id: str) -> Optional[AIDeltaStrangleBot]:
    """Get existing bot for user"""
    return _bot_registry.get(user_id)


def remove_delta_strangle_bot(user_id: str):
    """Remove bot from registry"""
    if user_id in _bot_registry:
        del _bot_registry[user_id]
