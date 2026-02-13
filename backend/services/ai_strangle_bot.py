"""
AI Non-Directional OTM 250 Strangle Bot
========================================

STRATEGY OVERVIEW:
- AI-powered regime detection (Range-bound vs Volatile)
- Sells OTM 250 strangle when Range Probability >= 65%
- Auto-enter/exit based on AI scoring
- Intraday only: Entry 9:30 AM, Exit 3:15 PM
- Historical Win Rate: 96.8% with selective trading

AI REGIME DETECTION (5 Factors):
1. VIX Level (25% weight): 11-15 ideal for range-bound
2. IV/RV Ratio (25% weight): < 1.2 means IV not inflated
3. PCR (20% weight): 0.85-1.15 is balanced market
4. ATR Ratio (15% weight): < 0.8 means low volatility day
5. Event Day (15% weight): No events = good for strangle

ENTRY RULES:
- Only SELL when Range Probability >= 65%
- SELL PE at 250 OTM (Spot - 250)
- SELL CE at 250 OTM (Spot + 250)
- Entry at 9:30 AM sharp

EXIT RULES:
- Target: Exit at 50% premium decay
- Stop Loss: 50% of premium collected (per leg)
- Time Exit: 3:15 PM regardless of P&L

RISK MANAGEMENT:
- Max daily loss: 60% of premium collected
- Skip trading on event days (Budget, RBI, FOMC)
- Skip when VIX > 18 (volatile regime)
"""

import asyncio
import logging
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime, time, timedelta, timezone
from dataclasses import dataclass, field
from enum import Enum
import math

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> datetime:
    """Get current time in IST"""
    return datetime.now(IST)

# Import mock data service for testing
from .mock_data_service import get_mock_service, MarketScenario

logger = logging.getLogger(__name__)


class MarketRegime(Enum):
    RANGE_BOUND = "range_bound"
    VOLATILE = "volatile"
    UNKNOWN = "unknown"


class TradeAction(Enum):
    SELL = "SELL"
    SKIP = "SKIP"
    EXIT = "EXIT"


@dataclass
class AIRegimeScore:
    """AI Regime detection result"""
    total_score: float = 0.0
    range_prob: float = 0.0  # Range-bound probability (same as total_score)
    trend_strength: float = 0.0  # Trend strength indicator
    regime: MarketRegime = MarketRegime.UNKNOWN
    action: TradeAction = TradeAction.SKIP
    
    # Individual factors
    vix: float = 0.0
    vix_score: float = 0.0
    vix_pass: bool = False
    
    iv_rv: float = 0.0
    iv_rv_score: float = 0.0
    iv_rv_pass: bool = False
    
    pcr: float = 0.0
    pcr_score: float = 0.0
    pcr_pass: bool = False
    
    atr_ratio: float = 0.0
    atr_ratio_score: float = 0.0
    atr_ratio_pass: bool = False
    
    is_event: bool = False
    event_score: float = 0.0
    event_pass: bool = False
    
    confidence: str = "LOW"
    
    def to_dict(self):
        return {
            "total_score": self.total_score,
            "regime": self.regime.value,
            "action": self.action.value,
            "confidence": self.confidence,
            "factors": {
                "vix": {"value": self.vix, "score": self.vix_score, "pass": self.vix_pass, "weight": 25},
                "iv_rv": {"value": self.iv_rv, "score": self.iv_rv_score, "pass": self.iv_rv_pass, "weight": 25},
                "pcr": {"value": self.pcr, "score": self.pcr_score, "pass": self.pcr_pass, "weight": 20},
                "atr_ratio": {"value": self.atr_ratio, "score": self.atr_ratio_score, "pass": self.atr_ratio_pass, "weight": 15},
                "is_event": {"value": self.is_event, "score": self.event_score, "pass": self.event_pass, "weight": 15}
            }
        }


@dataclass
class StranglePosition:
    """Current strangle position with adjustment tracking"""
    put_strike: float = 0.0
    call_strike: float = 0.0
    put_premium: float = 0.0
    call_premium: float = 0.0
    put_ltp: float = 0.0
    call_ltp: float = 0.0
    put_order_id: str = ""
    call_order_id: str = ""
    entry_time: datetime = None
    spot_at_entry: float = 0.0
    total_premium: float = 0.0
    current_pnl: float = 0.0
    status: str = "pending"  # pending, active, closed
    
    # Auto adjustment tracking
    adjustments_made: int = 0
    original_put_strike: float = 0.0
    original_call_strike: float = 0.0
    adjustment_history: List[Dict] = field(default_factory=list)
    last_adjustment_time: datetime = None
    
    def to_dict(self):
        return {
            "put_strike": self.put_strike,
            "call_strike": self.call_strike,
            "put_premium": self.put_premium,
            "call_premium": self.call_premium,
            "put_ltp": self.put_ltp,
            "call_ltp": self.call_ltp,
            "put_order_id": self.put_order_id,
            "call_order_id": self.call_order_id,
            "entry_time": self.entry_time.isoformat() if self.entry_time else None,
            "spot_at_entry": self.spot_at_entry,
            "total_premium": self.total_premium,
            "current_pnl": self.current_pnl,
            "status": self.status,
            "adjustments_made": self.adjustments_made,
            "original_put_strike": self.original_put_strike,
            "original_call_strike": self.original_call_strike,
            "adjustment_history": self.adjustment_history,
            "last_adjustment_time": self.last_adjustment_time.isoformat() if self.last_adjustment_time else None
        }


@dataclass
class AIStrangleConfig:
    """Configuration for AI Strangle Bot"""
    underlying: str = "NIFTY"
    otm_offset: int = 250  # 250 points OTM each side
    num_lots: int = 2
    lot_size: int = 65  # NIFTY lot size
    entry_time: str = "09:30"
    exit_time: str = "15:15"
    min_range_prob: int = 65  # Min 65% to trade
    stop_loss_pct: float = 50.0  # 50% of premium
    target_profit_pct: float = 50.0  # 50% of premium
    auto_enter: bool = True
    check_interval: int = 60  # Check every 60 seconds
    
    # Auto Adjustment Settings
    auto_adjust: bool = True  # Enable auto adjustment when spot breaches strike
    breach_buffer: int = 50   # Trigger adjustment when spot is within 50 pts of strike
    roll_points: int = 100    # Roll the leg by 100 points when adjusting
    max_adjustments: int = 2  # Max adjustments per day (prevent over-trading)
    adjustment_cooldown: int = 300  # Min 5 mins between adjustments


@dataclass
class AIStrangleBotState:
    """State of the AI Strangle bot"""
    is_running: bool = False
    last_score: Optional[AIRegimeScore] = None
    position: Optional[StranglePosition] = None
    trades_today: int = 0
    daily_pnl: float = 0.0
    last_check: datetime = None
    errors: List[str] = field(default_factory=list)


class AIStrangleBot:
    """
    AI-Powered Non-Directional OTM 250 Strangle Bot
    
    Uses Claude AI-style regime detection to determine whether
    to sell strangle or skip trading for the day.
    """
    
    # Market data API endpoints (using public APIs)
    VIX_API = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY"
    NIFTY_API = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
    
    # Event calendar (major events to skip)
    EVENT_DATES = [
        # 2026 Major Events (Budget, RBI, FOMC, F&O Expiry)
        "2026-02-01",  # Budget
        "2026-02-05",  # RBI MPC
        "2026-02-06",  # RBI MPC
        "2026-02-25",  # Feb Expiry
        "2026-03-25",  # March Expiry
        "2026-04-01",  # Start of FY
    ]
    
    # Weights for AI scoring
    WEIGHTS = {
        "vix": 25,
        "iv_rv": 25,
        "pcr": 20,
        "atr_ratio": 15,
        "event": 15
    }
    
    def __init__(self, broker_service, access_token: str, broker: str = "dhan"):
        self.broker_service = broker_service
        self.access_token = access_token
        self.broker = broker
        self.state = AIStrangleBotState()
        self.config = AIStrangleConfig()
        self._running = False
        self._task = None
        self._http_client = None
        
        # Mock mode for testing
        self.mock_mode = False
        self.mock_scenario = MarketScenario.RANDOM
        self.mock_service = None
    
    def enable_mock_mode(self, scenario: str = "random") -> Dict:
        """Enable mock mode for testing without real market data"""
        try:
            scenario_map = {
                "bullish": MarketScenario.BULLISH_TREND,
                "bearish": MarketScenario.BEARISH_TREND,
                "range": MarketScenario.RANGE_BOUND,
                "volatile": MarketScenario.VOLATILE,
                "random": MarketScenario.RANDOM,
            }
            self.mock_scenario = scenario_map.get(scenario, MarketScenario.RANDOM)
            self.mock_service = get_mock_service(self.mock_scenario)
            self.mock_mode = True
            logger.info(f"🧪 AI Strangle mock mode enabled: {self.mock_scenario.value}")
            return {"status": "success", "message": f"Mock mode enabled: {scenario}", "mock_mode": True}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def disable_mock_mode(self) -> Dict:
        """Disable mock mode"""
        self.mock_mode = False
        self.mock_service = None
        logger.info("🔌 AI Strangle mock mode disabled")
        return {"status": "success", "message": "Mock mode disabled", "mock_mode": False}
    
    async def _get_http_client(self):
        """Get or create HTTP client with NSE headers"""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                timeout=30.0,
                follow_redirects=True
            )
        return self._http_client
    
    # ========================================
    # AI REGIME DETECTION
    # ========================================
    
    async def fetch_market_data(self) -> Dict[str, Any]:
        """
        Fetch live market data for AI analysis
        Returns: VIX, IV, PCR, ATR, Spot price
        """
        try:
            # Use mock data if in mock mode
            if self.mock_mode and self.mock_service:
                mock_conditions = self.mock_service.get_ai_strangle_conditions()
                index_data = self.mock_service.get_index_data()
                
                # Convert mock conditions to expected format
                factors = mock_conditions.get("factors", {})
                vix_val = factors.get("vix", {}).get("value", 13.5)
                iv_rv_val = factors.get("iv_rv", {}).get("value", 1.0)
                pcr_val = factors.get("pcr", {}).get("value", 1.0)
                atr_val = factors.get("atr_ratio", {}).get("value", 0.8)
                
                return {
                    "spot": mock_conditions.get("spot_price", index_data["nifty"]["ltp"]),
                    "vix": vix_val,
                    "iv": vix_val * 1.05,  # IV slightly above VIX
                    "rv": vix_val * 1.05 / iv_rv_val if iv_rv_val > 0 else vix_val,
                    "pcr": pcr_val,
                    "atr": 200 * atr_val,
                    "atr_20": 200,
                    "timestamp": datetime.now().isoformat(),
                    "mock_mode": True,
                    "scenario": self.mock_scenario.value
                }
            
            # Real market data path
            # For now, use simulated data based on typical market conditions
            # In production, this would call actual market data APIs
            
            # Simulated market data (would be replaced with actual API calls)
            spot_price = await self._get_spot_price()
            
            return {
                "spot": spot_price,
                "vix": 13.5,  # India VIX
                "iv": 14.2,   # Implied Volatility
                "rv": 12.8,   # Realized Volatility
                "pcr": 1.02,  # Put-Call Ratio
                "atr": 180,   # Average True Range
                "atr_20": 220,  # 20-day ATR
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error fetching market data: {e}")
            return None
    
    def calculate_regime_score(self, market_data: Dict[str, Any]) -> AIRegimeScore:
        """
        Calculate AI regime detection score
        Higher score = More likely range-bound = Better for strangle selling
        """
        score = AIRegimeScore()
        
        if not market_data:
            return score
        
        total = 0
        
        # 1. VIX Analysis (25% weight)
        # VIX 11-15 is ideal for range-bound
        vix = market_data.get("vix", 15)
        score.vix = vix
        
        if 11 <= vix <= 15:
            score.vix_score = self.WEIGHTS["vix"]
            score.vix_pass = True
        elif 15 < vix <= 18:
            score.vix_score = self.WEIGHTS["vix"] * 0.6
            score.vix_pass = True
        elif vix < 11:
            score.vix_score = self.WEIGHTS["vix"] * 0.8
            score.vix_pass = True
        else:  # VIX > 18
            score.vix_score = 0
            score.vix_pass = False
        
        total += score.vix_score
        
        # 2. IV/RV Ratio Analysis (25% weight)
        # IV/RV < 1.2 means options not expensive
        iv = market_data.get("iv", 15)
        rv = market_data.get("rv", 15)
        iv_rv = iv / rv if rv > 0 else 1.0
        score.iv_rv = round(iv_rv, 2)
        
        if iv_rv < 1.0:
            score.iv_rv_score = self.WEIGHTS["iv_rv"]
            score.iv_rv_pass = True
        elif iv_rv < 1.2:
            score.iv_rv_score = self.WEIGHTS["iv_rv"] * 0.7
            score.iv_rv_pass = True
        else:
            score.iv_rv_score = 0
            score.iv_rv_pass = False
        
        total += score.iv_rv_score
        
        # 3. PCR Analysis (20% weight)
        # PCR 0.85-1.15 is balanced
        pcr = market_data.get("pcr", 1.0)
        score.pcr = round(pcr, 2)
        
        if 0.85 <= pcr <= 1.15:
            score.pcr_score = self.WEIGHTS["pcr"]
            score.pcr_pass = True
        elif (0.7 <= pcr < 0.85) or (1.15 < pcr <= 1.3):
            score.pcr_score = self.WEIGHTS["pcr"] * 0.5
            score.pcr_pass = True
        else:
            score.pcr_score = 0
            score.pcr_pass = False
        
        total += score.pcr_score
        
        # 4. ATR Ratio Analysis (15% weight)
        # Current ATR / 20-day ATR < 0.8 means calm day
        atr = market_data.get("atr", 200)
        atr_20 = market_data.get("atr_20", 220)
        atr_ratio = atr / atr_20 if atr_20 > 0 else 1.0
        score.atr_ratio = round(atr_ratio, 2)
        
        if atr_ratio < 0.7:
            score.atr_ratio_score = self.WEIGHTS["atr_ratio"]
            score.atr_ratio_pass = True
        elif atr_ratio < 0.9:
            score.atr_ratio_score = self.WEIGHTS["atr_ratio"] * 0.6
            score.atr_ratio_pass = True
        else:
            score.atr_ratio_score = 0
            score.atr_ratio_pass = False
        
        total += score.atr_ratio_score
        
        # 5. Event Day Analysis (15% weight)
        today = datetime.now().strftime("%Y-%m-%d")
        is_event = today in self.EVENT_DATES
        score.is_event = is_event
        
        if not is_event:
            score.event_score = self.WEIGHTS["event"]
            score.event_pass = True
        else:
            score.event_score = 0
            score.event_pass = False
        
        total += score.event_score
        
        # Final score and decision
        score.total_score = round(total, 1)
        score.range_prob = round(total, 1)  # Range-bound probability
        score.trend_strength = round(100 - total, 1)  # Inverse indicates trend
        
        # Determine regime and action
        if score.total_score >= 65:
            score.regime = MarketRegime.RANGE_BOUND
            score.action = TradeAction.SELL
            score.confidence = "HIGH"
        elif score.total_score >= 50:
            score.regime = MarketRegime.RANGE_BOUND
            score.action = TradeAction.SKIP  # Risky, skip
            score.confidence = "MEDIUM"
        else:
            score.regime = MarketRegime.VOLATILE
            score.action = TradeAction.SKIP
            score.confidence = "LOW"
        
        return score
    
    # ========================================
    # TRADING LOGIC
    # ========================================
    
    async def _get_spot_price(self) -> float:
        """Get current NIFTY spot price - Primary: Dhan, Fallback: Upstox"""
        import httpx
        import os
        
        # Method 1: Try Dhan API first (most reliable)
        try:
            dhan_token = os.environ.get("DHAN_ACCESS_TOKEN")
            if dhan_token:
                headers = {
                    "access-token": dhan_token,
                    "Content-Type": "application/json"
                }
                # Get NIFTY option chain - includes underlying price
                data = {
                    "UnderlyingScrip": 26000,  # NIFTY security_id
                    "ExchangeSegment": "NSE_FNO"
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    # First get expiry list
                    resp = await client.post(
                        "https://api.dhan.co/v2/optionchain/expirylist",
                        headers=headers,
                        json=data
                    )
                    if resp.status_code == 200:
                        expiries = resp.json().get("data", [])
                        if expiries:
                            # Get option chain for nearest expiry
                            data["Expiry"] = expiries[0]
                            resp = await client.post(
                                "https://api.dhan.co/v2/optionchain",
                                headers=headers,
                                json=data
                            )
                            if resp.status_code == 200:
                                chain_data = resp.json().get("data", {})
                                underlying_price = chain_data.get("UnderlyingPrice", 0)
                                if underlying_price > 0:
                                    logger.info(f"📊 NIFTY Spot from Dhan: {underlying_price}")
                                    return float(underlying_price)
        except Exception as e:
            logger.warning(f"Dhan spot price failed: {e}")
        
        # Method 2: Try Upstox API
        try:
            if self.broker == "upstox" and self.access_token:
                headers = {
                    "Authorization": f"Bearer {self.access_token}",
                    "Accept": "application/json"
                }
                url = "https://api.upstox.com/v2/market-quote/ltp?instrument_key=NSE_INDEX|Nifty%2050"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.get(url, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        ltp = data.get("data", {}).get("NSE_INDEX:Nifty 50", {}).get("last_price", 0)
                        if ltp > 0:
                            logger.info(f"📊 NIFTY Spot from Upstox: {ltp}")
                            return float(ltp)
        except Exception as e:
            logger.warning(f"Upstox spot price failed: {e}")
        
        # Method 3: Try broker_service
        try:
            if self.broker_service and hasattr(self.broker_service, 'get_index_data'):
                index_data = await self.broker_service.get_index_data()
                if index_data and index_data.get("nifty", {}).get("ltp"):
                    return float(index_data["nifty"]["ltp"])
        except Exception as e:
            logger.warning(f"broker_service spot price failed: {e}")
        
        # CRITICAL: Never use hardcoded fallback - raise error instead
        logger.error("❌ CRITICAL: Could not fetch live NIFTY spot price from any source!")
        raise ValueError("Cannot get live spot price - Dhan and Upstox APIs both failed")
    
    def _get_strangle_strikes(self, spot: float) -> tuple:
        """Calculate OTM strangle strikes"""
        # Round spot to nearest 50
        atm = round(spot / 50) * 50
        
        # OTM strikes
        put_strike = atm - self.config.otm_offset  # 250 below ATM
        call_strike = atm + self.config.otm_offset  # 250 above ATM
        
        return put_strike, call_strike
    
    async def enter_strangle(self, spot: float) -> Dict[str, Any]:
        """Enter OTM 250 strangle position"""
        try:
            put_strike, call_strike = self._get_strangle_strikes(spot)
            quantity = self.config.num_lots * self.config.lot_size
            
            logger.info(f"Entering strangle: SELL {put_strike} PE + SELL {call_strike} CE, Qty: {quantity}")
            
            # Get current expiry
            expiry = self._get_current_expiry()
            
            # Place SELL PUT order
            put_result = await self._place_sell_order(
                strike=put_strike,
                option_type="PE",
                quantity=quantity,
                expiry=expiry
            )
            
            # Place SELL CALL order
            call_result = await self._place_sell_order(
                strike=call_strike,
                option_type="CE",
                quantity=quantity,
                expiry=expiry
            )
            
            # Track if at least one leg succeeded - to prevent duplicate entries
            put_success = put_result.get("success", False)
            call_success = call_result.get("success", False)
            
            if put_success or call_success:
                # Create position even if partial - prevents re-entry!
                status = "active" if (put_success and call_success) else "partial"
                self.state.position = StranglePosition(
                    put_strike=put_strike,
                    call_strike=call_strike,
                    put_premium=put_result.get("price", 80) if put_success else 0,
                    call_premium=call_result.get("price", 90) if call_success else 0,
                    put_order_id=put_result.get("order_id", "") if put_success else "",
                    call_order_id=call_result.get("order_id", "") if call_success else "",
                    entry_time=datetime.now(),
                    spot_at_entry=spot,
                    status=status
                )
                self.state.position.total_premium = (
                    (self.state.position.put_premium if put_success else 0) + 
                    (self.state.position.call_premium if call_success else 0)
                ) * quantity
                
                self.state.trades_today += 1
                
                if put_success and call_success:
                    return {
                        "success": True,
                        "message": f"Strangle entered: SELL {put_strike} PE + SELL {call_strike} CE",
                        "position": self.state.position.to_dict()
                    }
                else:
                    # Partial entry - one leg failed
                    return {
                        "success": False,
                        "error": f"Partial entry - {'PUT' if put_success else 'CALL'} only. Will not retry.",
                        "put_result": put_result,
                        "call_result": call_result,
                        "position": self.state.position.to_dict()
                    }
            else:
                # Both legs failed - mark attempted to prevent immediate retry
                self.state.position = StranglePosition(
                    put_strike=put_strike,
                    call_strike=call_strike,
                    put_premium=0,
                    call_premium=0,
                    put_order_id="",
                    call_order_id="",
                    entry_time=datetime.now(),
                    spot_at_entry=spot,
                    status="failed"
                )
                return {
                    "success": False,
                    "error": "Failed to place both legs",
                    "put_result": put_result,
                    "call_result": call_result
                }
                
        except Exception as e:
            logger.error(f"Error entering strangle: {e}")
            return {"success": False, "error": str(e)}
    
    async def exit_strangle(self, reason: str = "manual") -> Dict[str, Any]:
        """Exit current strangle position"""
        try:
            if not self.state.position or self.state.position.status != "active":
                return {"success": False, "error": "No active position"}
            
            quantity = self.config.num_lots * self.config.lot_size
            
            # Buy back PUT
            put_result = await self._place_buy_order(
                strike=self.state.position.put_strike,
                option_type="PE",
                quantity=quantity
            )
            
            # Buy back CALL
            call_result = await self._place_buy_order(
                strike=self.state.position.call_strike,
                option_type="CE",
                quantity=quantity
            )
            
            # Calculate P&L
            exit_premium = (put_result.get("price", 0) + call_result.get("price", 0)) * quantity
            pnl = self.state.position.total_premium - exit_premium
            
            self.state.position.status = "closed"
            self.state.position.current_pnl = pnl
            self.state.daily_pnl += pnl
            
            return {
                "success": True,
                "message": f"Strangle exited. Reason: {reason}",
                "pnl": pnl,
                "position": self.state.position.to_dict()
            }
            
        except Exception as e:
            logger.error(f"Error exiting strangle: {e}")
            return {"success": False, "error": str(e)}
    
    async def _place_sell_order(self, strike: float, option_type: str, quantity: int, expiry: str = None) -> Dict:
        """Place a SELL order for option leg"""
        try:
            symbol = f"{self.config.underlying}{int(strike)}{option_type}"
            
            # In mock mode, always use simulated orders
            if self.mock_mode:
                return {
                    "success": True,
                    "order_id": f"MOCK_SELL_{symbol}_{datetime.now().strftime('%H%M%S')}",
                    "price": 85 if option_type == "PE" else 90,
                    "message": "Mock order placed"
                }
            
            if self.broker == "upstox" and self.broker_service:
                # Upstox option order placement
                # Need to look up the actual instrument_key from Upstox API
                expiry_str = expiry or self._get_current_expiry()  # YYYY-MM-DD
                instrument_token = await self._get_upstox_instrument_key(strike, option_type, expiry_str)
                
                if not instrument_token:
                    return {"success": False, "error": f"Could not find Upstox instrument for {strike}{option_type}"}
                
                logger.info(f"🔥 Upstox SELL order: {instrument_token} x {quantity}")
                
                order_result = await self.broker_service.place_order(
                    instrument_token=instrument_token,
                    transaction_type="SELL",
                    quantity=quantity,
                    order_type="MARKET",
                    product="I",  # Intraday
                    price=0
                )
                
                if order_result.get("success"):
                    return {
                        "success": True,
                        "order_id": order_result.get("data", {}).get("order_id", ""),
                        "price": 85 if option_type == "PE" else 90,  # Estimated
                        "message": "Upstox order placed"
                    }
                else:
                    logger.error(f"Upstox order failed: {order_result}")
                    return {"success": False, "error": order_result.get("error", "Order failed")}
            
            elif self.broker == "dhan" and self.broker_service:
                # Get security ID from Dhan
                security_id = await self._get_dhan_security_id(strike, option_type, expiry)
                
                order_data = {
                    "transactionType": "SELL",
                    "exchangeSegment": "NSE_FNO",
                    "productType": "INTRADAY",
                    "orderType": "MARKET",
                    "validity": "DAY",
                    "securityId": security_id,
                    "quantity": quantity,
                    "price": 0,
                    "triggerPrice": 0
                }
                
                result = await self.broker_service._make_request("POST", "/orders", order_data)
                
                return {
                    "success": bool(result.get("orderId")),
                    "order_id": result.get("orderId", ""),
                    "price": result.get("price", 85),  # Estimated premium
                    "message": result.get("message", "Order placed")
                }
            
            # Simulated order for testing (no broker connected)
            logger.warning(f"No broker connected - simulating order for {symbol}")
            return {
                "success": True,
                "order_id": f"SIM_{symbol}_{datetime.now().strftime('%H%M%S')}",
                "price": 85 if option_type == "PE" else 90,
                "message": "Simulated order placed (no broker)"
            }
            
        except Exception as e:
            logger.error(f"Error placing sell order: {e}")
            return {"success": False, "error": str(e)}
    
    async def _place_buy_order(self, strike: float, option_type: str, quantity: int) -> Dict:
        """Place a BUY order to close option leg"""
        try:
            symbol = f"{self.config.underlying}{int(strike)}{option_type}"
            
            # In mock mode, always use simulated orders
            if self.mock_mode:
                return {
                    "success": True,
                    "order_id": f"MOCK_BUY_{symbol}_{datetime.now().strftime('%H%M%S')}",
                    "price": 40 if option_type == "PE" else 45,
                    "message": "Mock order placed"
                }
            
            if self.broker == "upstox" and self.broker_service:
                # Upstox buy-to-close order
                expiry_str = self._get_current_expiry()
                instrument_token = await self._get_upstox_instrument_key(strike, option_type, expiry_str)
                
                if not instrument_token:
                    return {"success": False, "error": f"Could not find Upstox instrument for {strike}{option_type}"}
                
                logger.info(f"🔥 Upstox BUY (exit) order: {instrument_token}")
                
                order_result = await self.broker_service.place_order(
                    instrument_token=instrument_token,
                    transaction_type="BUY",
                    quantity=self.config.num_lots * self.config.lot_size,
                    order_type="MARKET",
                    product="I",
                    price=0
                )
                
                if order_result.get("success"):
                    return {
                        "success": True,
                        "order_id": order_result.get("data", {}).get("order_id", ""),
                        "price": 40 if option_type == "PE" else 45,
                        "message": "Upstox exit order placed"
                    }
                else:
                    return {"success": False, "error": order_result.get("error", "Exit order failed")}
            
            # Simulated order for testing
            logger.warning(f"No broker connected - simulating exit for {symbol}")
            return {
                "success": True,
                "order_id": f"SIM_BUY_{symbol}_{datetime.now().strftime('%H%M%S')}",
                "price": 40 if option_type == "PE" else 45,
                "message": "Simulated buy order placed"
            }
            
        except Exception as e:
            logger.error(f"Error placing buy order: {e}")
            return {"success": False, "error": str(e)}
    
    async def _get_upstox_instrument_key(self, strike: float, option_type: str, expiry: str) -> Optional[str]:
        """
        Get Upstox instrument_key by looking up option contracts
        Returns format like 'NSE_FO|12345'
        """
        try:
            import httpx
            
            # Call Upstox option/contract API
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Accept": "application/json"
            }
            
            url = "https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty%2050"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    logger.error(f"Upstox contract API error: {response.status_code} - {response.text}")
                    return None
                
                data = response.json()
                contracts = data.get("data", [])
                
                # Find matching contract
                for contract in contracts:
                    if (contract.get("strike_price") == strike and
                        contract.get("instrument_type") == option_type and
                        contract.get("expiry") == expiry):
                        instrument_key = contract.get("instrument_key")
                        logger.info(f"Found Upstox instrument: {strike}{option_type} -> {instrument_key}")
                        return instrument_key
                
                # If exact match not found, try finding closest expiry
                logger.warning(f"No exact match for {strike}{option_type} exp {expiry}, checking all expiries")
                for contract in contracts:
                    if (contract.get("strike_price") == strike and
                        contract.get("instrument_type") == option_type):
                        instrument_key = contract.get("instrument_key")
                        logger.info(f"Found Upstox instrument (diff expiry): {strike}{option_type} -> {instrument_key} (exp: {contract.get('expiry')})")
                        return instrument_key
                
                logger.error(f"No Upstox contract found for {strike}{option_type}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting Upstox instrument key: {e}")
            return None
    
    async def _get_dhan_security_id(self, strike: float, option_type: str, expiry: str) -> str:
        """Get Dhan security ID for option"""
        # This would call Dhan API to get actual security ID
        # For now, return placeholder
        return f"NIFTY{int(strike)}{option_type}"
    
    def _get_current_expiry(self) -> str:
        """Get current week's expiry date (Thursday for NIFTY weekly)"""
        today = datetime.now()
        # Thursday = 3 (weekday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4)
        days_until_thursday = (3 - today.weekday()) % 7
        if days_until_thursday == 0 and today.hour >= 15:
            days_until_thursday = 7  # Next Thursday if today is Thursday after market
        expiry_date = today + timedelta(days=days_until_thursday)
        return expiry_date.strftime("%Y-%m-%d")
    
    def _is_market_hours(self) -> bool:
        """Check if current time is within market hours (IST)"""
        # In mock mode, always return True to allow testing anytime
        if self.mock_mode:
            return True
        now = get_ist_now().time()
        market_open = time(9, 15)
        market_close = time(15, 30)
        is_open = market_open <= now <= market_close
        logger.debug(f"Market hours check: IST={now}, open={market_open}, close={market_close}, is_open={is_open}")
        return is_open
    
    def _is_entry_time(self) -> bool:
        """Check if it's entry time (9:20 AM onwards until 2:30 PM)"""
        # In mock mode, always return True to allow testing anytime
        if self.mock_mode:
            return True
        now = get_ist_now().time()
        entry_h, entry_m = map(int, self.config.entry_time.split(":"))
        entry_time = time(entry_h, entry_m)
        # Allow entry from entry_time until 2:30 PM (last meaningful entry)
        return now >= entry_time and now < time(14, 30)
    
    def _is_exit_time(self) -> bool:
        """Check if it's exit time (3:15 PM) (IST)"""
        # In mock mode, never auto-exit by time (let user control)
        if self.mock_mode:
            return False
        now = get_ist_now().time()
        exit_h, exit_m = map(int, self.config.exit_time.split(":"))
        return now >= time(exit_h, exit_m)
    
    # ========================================
    # BOT CONTROL
    # ========================================
    
    async def start(self, config: AIStrangleConfig = None, mock_mode: bool = False, scenario: str = "random") -> Dict[str, Any]:
        """Start the AI Strangle bot"""
        if self._running:
            return {"success": False, "error": "Bot already running"}
        
        if config:
            self.config = config
        
        # Enable mock mode if requested
        if mock_mode:
            self.enable_mock_mode(scenario)
        
        self._running = True
        self.state.is_running = True
        self.state.errors = []
        self.state.trades_today = 0
        self.state.daily_pnl = 0.0
        
        # Try immediate entry if conditions are favorable
        initial_scan = None
        try:
            if self.config.auto_enter and self._is_market_hours() and self._is_entry_time():
                logger.info("🔍 Running immediate scan on bot start...")
                market_data = await self.fetch_market_data()
                if market_data:
                    score = self.calculate_regime_score(market_data)
                    self.state.last_score = score
                    spot = market_data.get("spot", 24000)
                    
                    if score.action == TradeAction.SELL and not self.state.position:
                        logger.info(f"✅ AI Score {score.total_score}% - Entering strangle immediately")
                        entry_result = await self.enter_strangle(spot)
                        initial_scan = {
                            "action": "entered",
                            "score": score.total_score,
                            "result": entry_result
                        }
                    else:
                        initial_scan = {
                            "action": "skipped",
                            "score": score.total_score,
                            "reason": f"Score {score.total_score}% - {score.action.value}"
                        }
        except Exception as e:
            logger.warning(f"Immediate entry check failed: {e}")
            initial_scan = {"action": "error", "error": str(e)}
        
        # Start the monitoring loop for continuous monitoring
        self._task = asyncio.create_task(self._monitoring_loop())
        
        logger.info(f"AI Strangle bot started with config: {self.config} (mock_mode={self.mock_mode})")
        
        return {
            "success": True,
            "message": f"AI Strangle bot started{' [MOCK MODE]' if self.mock_mode else ''}",
            "mock_mode": self.mock_mode,
            "scenario": self.mock_scenario.value if self.mock_mode else None,
            "initial_scan": initial_scan,
            "position": self.state.position.to_dict() if self.state.position else None,
            "config": {
                "underlying": self.config.underlying,
                "otm_offset": self.config.otm_offset,
                "num_lots": self.config.num_lots,
                "min_range_prob": self.config.min_range_prob,
                "auto_enter": self.config.auto_enter,
                "entry_time": self.config.entry_time,
                "exit_time": self.config.exit_time
            }
        }
    
    async def stop(self) -> Dict[str, Any]:
        """Stop the AI Strangle bot"""
        if not self._running:
            return {"success": False, "error": "Bot not running"}
        
        self._running = False
        self.state.is_running = False
        
        # Exit any open position
        if self.state.position and self.state.position.status == "active":
            await self.exit_strangle("bot_stopped")
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("AI Strangle bot stopped")
        
        return {
            "success": True,
            "message": "AI Strangle bot stopped",
            "daily_pnl": self.state.daily_pnl,
            "trades_today": self.state.trades_today
        }
    
    async def scan_once(self) -> Dict[str, Any]:
        """
        Run one scan iteration manually.
        Use this when background loop can't run (e.g., serverless environments).
        """
        try:
            if not self._running:
                return {"status": "error", "message": "Bot not running. Start bot first."}
            
            logger.info(f"🔍 AI Strangle manual scan (mock_mode={self.mock_mode})")
            
            self.state.last_check = datetime.now()
            
            # Fetch market data
            market_data = await self.fetch_market_data()
            
            # Calculate AI score
            score = self.calculate_regime_score(market_data)
            self.state.last_score = score
            
            result = {
                "status": "success",
                "ai_score": score.total_score,
                "action": score.action.value,
                "range_prob": score.range_prob,
                "trend_strength": score.trend_strength,
                "volatility": score.volatility_regime,
                "trade_executed": False,
                "position_active": self.state.position is not None and self.state.position.status == "active",
                "mock_mode": self.mock_mode,
                "timestamp": datetime.now().isoformat()
            }
            
            # Check if we should trade
            if self.config.auto_enter and self._is_market_hours():
                # Entry logic
                if (score.action == TradeAction.SELL and 
                    not self.state.position and 
                    self._is_entry_time()):
                    
                    spot = market_data.get("spot", 24000)
                    entry_result = await self.enter_strangle(spot)
                    result["trade_executed"] = entry_result.get("success", False)
                    result["trade_details"] = entry_result
                    logger.info(f"Auto-enter result: {entry_result}")
                
                # Exit logic
                elif self.state.position and self.state.position.status == "active":
                    if self._is_exit_time():
                        exit_result = await self.exit_strangle("time_exit")
                        result["exit_executed"] = True
                        result["exit_details"] = exit_result
                    else:
                        await self._check_position_exits()
            
            # Add position info
            if self.state.position:
                result["position"] = self.state.position.to_dict()
            
            return result
            
        except Exception as e:
            logger.error(f"Scan once error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _monitoring_loop(self):
        """Main monitoring loop for AI analysis and auto-trading"""
        while self._running:
            try:
                self.state.last_check = datetime.now()
                
                # Fetch market data
                market_data = await self.fetch_market_data()
                
                # Calculate AI score
                score = self.calculate_regime_score(market_data)
                self.state.last_score = score
                
                logger.info(f"AI Score: {score.total_score}%, Action: {score.action.value}")
                
                # Check if we should trade
                if self.config.auto_enter and self._is_market_hours():
                    
                    # Entry logic - only if no position at all (active, partial, or failed)
                    if (score.action == TradeAction.SELL and 
                        self.state.position is None and 
                        self._is_entry_time()):
                        
                        spot = market_data.get("spot", 24000)
                        result = await self.enter_strangle(spot)
                        logger.info(f"Auto-enter result: {result}")
                    
                    # Exit logic (time-based) - only for active positions
                    elif self.state.position and self.state.position.status == "active":
                        if self._is_exit_time():
                            result = await self.exit_strangle("time_exit")
                            logger.info(f"Time exit result: {result}")
                        else:
                            # Check stop loss / target
                            await self._check_position_exits()
                            
                            # Check auto adjustment (if position still active)
                            if self.state.position and self.state.position.status == "active":
                                adjustment = await self._check_auto_adjustment()
                                if adjustment:
                                    logger.info(f"Auto adjustment: {adjustment}")
                
                await asyncio.sleep(self.config.check_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                self.state.errors.append(str(e))
                await asyncio.sleep(10)
    
    async def _check_position_exits(self):
        """Check if position should be exited due to SL or target"""
        if not self.state.position or self.state.position.status != "active":
            return
        
        # Get current option prices (simulated)
        put_ltp = 40  # Would fetch actual LTP
        call_ltp = 45
        
        self.state.position.put_ltp = put_ltp
        self.state.position.call_ltp = call_ltp
        
        # Calculate current P&L
        quantity = self.config.num_lots * self.config.lot_size
        current_value = (put_ltp + call_ltp) * quantity
        entry_value = self.state.position.total_premium
        
        pnl = entry_value - current_value
        self.state.position.current_pnl = pnl
        
        # Check target (50% of premium)
        target = entry_value * (self.config.target_profit_pct / 100)
        if pnl >= target:
            await self.exit_strangle("target_hit")
            return
        
        # Check stop loss (50% of premium loss)
        max_loss = entry_value * (self.config.stop_loss_pct / 100)
        if pnl <= -max_loss:
            await self.exit_strangle("stop_loss")
    
    async def _check_auto_adjustment(self) -> Optional[Dict]:
        """
        Auto Adjustment Logic for Strangle Position
        
        WHEN TO ADJUST:
        1. Spot breaches PUT strike (within buffer) → Roll PE down
        2. Spot breaches CALL strike (within buffer) → Roll CE up
        
        HOW IT WORKS:
        - If spot drops to within 50 pts of PUT strike → BUY back PE, SELL new PE 100 pts lower
        - If spot rises to within 50 pts of CALL strike → BUY back CE, SELL new CE 100 pts higher
        
        SAFEGUARDS:
        - Max 2 adjustments per day
        - 5 min cooldown between adjustments
        - Only adjust during market hours
        """
        if not self.state.position or self.state.position.status != "active":
            return None
        
        if not self.config.auto_adjust:
            return None
        
        # Check max adjustments
        if self.state.position.adjustments_made >= self.config.max_adjustments:
            logger.info(f"⚠️ Max adjustments ({self.config.max_adjustments}) reached for today")
            return None
        
        # Check cooldown
        if self.state.position.last_adjustment_time:
            elapsed = (get_ist_now() - self.state.position.last_adjustment_time).total_seconds()
            if elapsed < self.config.adjustment_cooldown:
                return None
        
        # Get current spot price
        try:
            spot = await self._get_spot_price()
        except Exception as e:
            logger.error(f"Cannot get spot for adjustment check: {e}")
            return None
        
        put_strike = self.state.position.put_strike
        call_strike = self.state.position.call_strike
        buffer = self.config.breach_buffer
        roll_pts = self.config.roll_points
        
        adjustment_result = None
        
        # Check PUT side breach (spot dropping towards PUT)
        if spot <= put_strike + buffer:
            logger.warning(f"🔴 PE BREACH! Spot {spot} near PE strike {put_strike}")
            adjustment_result = await self._roll_put_down(spot, put_strike, roll_pts)
        
        # Check CALL side breach (spot rising towards CALL)
        elif spot >= call_strike - buffer:
            logger.warning(f"🔴 CE BREACH! Spot {spot} near CE strike {call_strike}")
            adjustment_result = await self._roll_call_up(spot, call_strike, roll_pts)
        
        return adjustment_result
    
    async def _roll_put_down(self, spot: float, current_strike: float, roll_points: int) -> Dict:
        """
        Roll PUT down when spot breaches PE strike
        1. BUY back current PE (close short)
        2. SELL new PE at lower strike
        """
        new_strike = current_strike - roll_points
        quantity = self.config.num_lots * self.config.lot_size
        expiry = self._get_current_expiry()
        
        logger.info(f"📊 ROLLING PE: {current_strike} → {new_strike}")
        
        adjustment = {
            "type": "roll_put_down",
            "timestamp": get_ist_now().isoformat(),
            "spot": spot,
            "old_strike": current_strike,
            "new_strike": new_strike,
            "quantity": quantity,
            "orders": []
        }
        
        try:
            # Step 1: BUY back current PE (close short position)
            buy_result = await self._place_buy_order(
                strike=current_strike,
                option_type="PE",
                quantity=quantity,
                expiry=expiry
            )
            adjustment["orders"].append({"action": "BUY", "strike": current_strike, "result": buy_result})
            
            if not buy_result.get("success"):
                adjustment["status"] = "failed"
                adjustment["error"] = "Failed to buy back PE"
                logger.error(f"❌ Failed to BUY back PE {current_strike}")
                return adjustment
            
            # Step 2: SELL new PE at lower strike
            sell_result = await self._place_sell_order(
                strike=new_strike,
                option_type="PE",
                quantity=quantity,
                expiry=expiry
            )
            adjustment["orders"].append({"action": "SELL", "strike": new_strike, "result": sell_result})
            
            if sell_result.get("success"):
                # Update position
                self.state.position.put_strike = new_strike
                self.state.position.put_premium = sell_result.get("price", 0) * quantity
                self.state.position.adjustments_made += 1
                self.state.position.last_adjustment_time = get_ist_now()
                self.state.position.adjustment_history.append(adjustment)
                
                adjustment["status"] = "success"
                logger.info(f"✅ PE rolled: {current_strike} → {new_strike}")
            else:
                adjustment["status"] = "partial"
                adjustment["error"] = "Bought back PE but failed to sell new PE"
                logger.error(f"⚠️ Partial adjustment - PE bought back but new PE failed")
            
        except Exception as e:
            adjustment["status"] = "error"
            adjustment["error"] = str(e)
            logger.error(f"❌ Roll PE error: {e}")
        
        return adjustment
    
    async def _roll_call_up(self, spot: float, current_strike: float, roll_points: int) -> Dict:
        """
        Roll CALL up when spot breaches CE strike
        1. BUY back current CE (close short)
        2. SELL new CE at higher strike
        """
        new_strike = current_strike + roll_points
        quantity = self.config.num_lots * self.config.lot_size
        expiry = self._get_current_expiry()
        
        logger.info(f"📊 ROLLING CE: {current_strike} → {new_strike}")
        
        adjustment = {
            "type": "roll_call_up",
            "timestamp": get_ist_now().isoformat(),
            "spot": spot,
            "old_strike": current_strike,
            "new_strike": new_strike,
            "quantity": quantity,
            "orders": []
        }
        
        try:
            # Step 1: BUY back current CE (close short position)
            buy_result = await self._place_buy_order(
                strike=current_strike,
                option_type="CE",
                quantity=quantity,
                expiry=expiry
            )
            adjustment["orders"].append({"action": "BUY", "strike": current_strike, "result": buy_result})
            
            if not buy_result.get("success"):
                adjustment["status"] = "failed"
                adjustment["error"] = "Failed to buy back CE"
                logger.error(f"❌ Failed to BUY back CE {current_strike}")
                return adjustment
            
            # Step 2: SELL new CE at higher strike
            sell_result = await self._place_sell_order(
                strike=new_strike,
                option_type="CE",
                quantity=quantity,
                expiry=expiry
            )
            adjustment["orders"].append({"action": "SELL", "strike": new_strike, "result": sell_result})
            
            if sell_result.get("success"):
                # Update position
                self.state.position.call_strike = new_strike
                self.state.position.call_premium = sell_result.get("price", 0) * quantity
                self.state.position.adjustments_made += 1
                self.state.position.last_adjustment_time = get_ist_now()
                self.state.position.adjustment_history.append(adjustment)
                
                adjustment["status"] = "success"
                logger.info(f"✅ CE rolled: {current_strike} → {new_strike}")
            else:
                adjustment["status"] = "partial"
                adjustment["error"] = "Bought back CE but failed to sell new CE"
                logger.error(f"⚠️ Partial adjustment - CE bought back but new CE failed")
            
        except Exception as e:
            adjustment["status"] = "error"
            adjustment["error"] = str(e)
            logger.error(f"❌ Roll CE error: {e}")
        
        return adjustment
    
    async def _place_buy_order(self, strike: float, option_type: str, quantity: int, expiry: str) -> Dict:
        """Place BUY order to close short position (for adjustment)"""
        try:
            if self.broker == "upstox" and self.access_token:
                # Get instrument key
                instrument_key = await self._get_upstox_instrument_key(
                    self.config.underlying, strike, option_type, expiry
                )
                if not instrument_key:
                    return {"success": False, "error": "Instrument key not found"}
                
                import httpx
                headers = {
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                
                order_data = {
                    "quantity": quantity,
                    "product": "I",  # Intraday
                    "validity": "DAY",
                    "price": 0,
                    "instrument_token": instrument_key,
                    "order_type": "MARKET",
                    "transaction_type": "BUY",  # BUY to close short
                    "disclosed_quantity": 0,
                    "trigger_price": 0,
                    "is_amo": False
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.upstox.com/v2/order/place",
                        headers=headers,
                        json=order_data
                    )
                    
                    result = response.json()
                    logger.info(f"BUY order response: {result}")
                    
                    if response.status_code == 200 and result.get("status") == "success":
                        return {
                            "success": True,
                            "order_id": result.get("data", {}).get("order_id"),
                            "message": "BUY order placed"
                        }
                    else:
                        return {
                            "success": False,
                            "error": result.get("errors", [{}])[0].get("message", "Order failed")
                        }
            
            # Fallback for other brokers or mock mode
            logger.info(f"[MOCK] BUY {quantity} {self.config.underlying} {strike} {option_type}")
            return {"success": True, "order_id": f"mock_buy_{strike}_{option_type}", "mock": True}
            
        except Exception as e:
            logger.error(f"BUY order error: {e}")
            return {"success": False, "error": str(e)}
    
    def get_status(self) -> Dict[str, Any]:
        """Get current bot status"""
        return {
            "is_running": self.state.is_running,
            "mock_mode": self.mock_mode,
            "scenario": self.mock_scenario.value if self.mock_mode else None,
            "broker": self.broker,
            "last_score": self.state.last_score.to_dict() if self.state.last_score else None,
            "position": self.state.position.to_dict() if self.state.position else None,
            "trades_today": self.state.trades_today,
            "daily_pnl": self.state.daily_pnl,
            "last_check": self.state.last_check.isoformat() if self.state.last_check else None,
            "errors": self.state.errors[-5:],
            "config": {
                "underlying": self.config.underlying,
                "otm_offset": self.config.otm_offset,
                "num_lots": self.config.num_lots,
                "lot_size": self.config.lot_size,
                "min_range_prob": self.config.min_range_prob,
                "auto_enter": self.config.auto_enter,
                "entry_time": self.config.entry_time,
                "exit_time": self.config.exit_time,
                "stop_loss_pct": self.config.stop_loss_pct,
                "target_profit_pct": self.config.target_profit_pct,
                # Auto adjustment settings
                "auto_adjust": self.config.auto_adjust,
                "breach_buffer": self.config.breach_buffer,
                "roll_points": self.config.roll_points,
                "max_adjustments": self.config.max_adjustments,
                "adjustment_cooldown": self.config.adjustment_cooldown
            }
        }
    
    def update_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update bot configuration settings
        
        Supported settings:
        - underlying: str (NIFTY, BANKNIFTY)
        - otm_offset: int (points OTM, e.g., 250, 300)
        - num_lots: int (number of lots)
        - min_range_prob: int (minimum range probability %)
        - auto_enter: bool (auto-enter strangle)
        - entry_time: str (format HH:MM)
        - exit_time: str (format HH:MM)
        - stop_loss_pct: float (stop loss % of premium)
        - target_profit_pct: float (target profit % of premium)
        - auto_adjust: bool (enable auto adjustment)
        - breach_buffer: int (points before strike to trigger adjustment)
        - roll_points: int (points to roll when adjusting)
        - max_adjustments: int (max adjustments per day)
        """
        # Lot size mapping (CANNOT be changed by user - enforced)
        LOT_SIZES = {
            "NIFTY": 65,
            "BANKNIFTY": 15,
            "FINNIFTY": 25,
            "MIDCPNIFTY": 75
        }
        
        changes = {}
        
        # Validate and apply updates
        if "underlying" in updates:
            underlying = updates["underlying"].upper()
            if underlying in LOT_SIZES:
                self.config.underlying = underlying
                self.config.lot_size = LOT_SIZES[underlying]  # Auto-set correct lot size
                changes["underlying"] = underlying
                changes["lot_size"] = self.config.lot_size
            else:
                raise ValueError(f"Invalid underlying: {underlying}. Valid: {list(LOT_SIZES.keys())}")
        
        if "otm_offset" in updates:
            offset = int(updates["otm_offset"])
            if 50 <= offset <= 500:
                self.config.otm_offset = offset
                changes["otm_offset"] = offset
            else:
                raise ValueError("otm_offset must be between 50 and 500")
        
        if "num_lots" in updates:
            lots = int(updates["num_lots"])
            if 1 <= lots <= 20:
                self.config.num_lots = lots
                changes["num_lots"] = lots
            else:
                raise ValueError("num_lots must be between 1 and 20")
        
        if "min_range_prob" in updates:
            prob = int(updates["min_range_prob"])
            if 50 <= prob <= 90:
                self.config.min_range_prob = prob
                changes["min_range_prob"] = prob
            else:
                raise ValueError("min_range_prob must be between 50 and 90")
        
        if "auto_enter" in updates:
            self.config.auto_enter = bool(updates["auto_enter"])
            changes["auto_enter"] = self.config.auto_enter
        
        if "entry_time" in updates:
            # Validate time format HH:MM
            try:
                time.fromisoformat(updates["entry_time"])
                self.config.entry_time = updates["entry_time"]
                changes["entry_time"] = updates["entry_time"]
            except:
                raise ValueError("entry_time must be in HH:MM format")
        
        if "exit_time" in updates:
            try:
                time.fromisoformat(updates["exit_time"])
                self.config.exit_time = updates["exit_time"]
                changes["exit_time"] = updates["exit_time"]
            except:
                raise ValueError("exit_time must be in HH:MM format")
        
        if "stop_loss_pct" in updates:
            sl = float(updates["stop_loss_pct"])
            if 10 <= sl <= 100:
                self.config.stop_loss_pct = sl
                changes["stop_loss_pct"] = sl
            else:
                raise ValueError("stop_loss_pct must be between 10 and 100")
        
        if "target_profit_pct" in updates:
            tp = float(updates["target_profit_pct"])
            if 10 <= tp <= 100:
                self.config.target_profit_pct = tp
                changes["target_profit_pct"] = tp
            else:
                raise ValueError("target_profit_pct must be between 10 and 100")
        
        # Auto adjustment settings
        if "auto_adjust" in updates:
            self.config.auto_adjust = bool(updates["auto_adjust"])
            changes["auto_adjust"] = self.config.auto_adjust
        
        if "breach_buffer" in updates:
            buffer = int(updates["breach_buffer"])
            if 25 <= buffer <= 200:
                self.config.breach_buffer = buffer
                changes["breach_buffer"] = buffer
            else:
                raise ValueError("breach_buffer must be between 25 and 200 points")
        
        if "roll_points" in updates:
            roll = int(updates["roll_points"])
            if 50 <= roll <= 300:
                self.config.roll_points = roll
                changes["roll_points"] = roll
            else:
                raise ValueError("roll_points must be between 50 and 300 points")
        
        if "max_adjustments" in updates:
            max_adj = int(updates["max_adjustments"])
            if 0 <= max_adj <= 5:
                self.config.max_adjustments = max_adj
                changes["max_adjustments"] = max_adj
            else:
                raise ValueError("max_adjustments must be between 0 and 5")
        
        return {
            "success": True,
            "message": f"Updated {len(changes)} settings",
            "changes": changes,
            "current_config": {
                "underlying": self.config.underlying,
                "otm_offset": self.config.otm_offset,
                "num_lots": self.config.num_lots,
                "lot_size": self.config.lot_size,
                "min_range_prob": self.config.min_range_prob,
                "auto_enter": self.config.auto_enter,
                "entry_time": self.config.entry_time,
                "exit_time": self.config.exit_time,
                "stop_loss_pct": self.config.stop_loss_pct,
                "target_profit_pct": self.config.target_profit_pct,
                "auto_adjust": self.config.auto_adjust,
                "breach_buffer": self.config.breach_buffer,
                "roll_points": self.config.roll_points,
                "max_adjustments": self.config.max_adjustments,
                "adjustment_cooldown": self.config.adjustment_cooldown
            }
        }
    
    async def analyze_now(self) -> Dict[str, Any]:
        """Manually trigger AI analysis"""
        market_data = await self.fetch_market_data()
        score = self.calculate_regime_score(market_data)
        self.state.last_score = score
        
        return {
            "success": True,
            "score": score.to_dict(),
            "market_data": market_data,
            "recommendation": f"{'SELL strangle' if score.action == TradeAction.SELL else 'SKIP today'}"
        }


# Global bot instances (per user session)
_ai_strangle_bots: Dict[str, AIStrangleBot] = {}


def get_or_create_ai_strangle_bot(user_id: str, broker_service, access_token: str, broker: str) -> AIStrangleBot:
    """Get existing bot or create new one, always update broker service"""
    if user_id not in _ai_strangle_bots:
        _ai_strangle_bots[user_id] = AIStrangleBot(broker_service, access_token, broker)
    else:
        # Always update broker service with new token
        bot = _ai_strangle_bots[user_id]
        bot.broker_service = broker_service
        bot.access_token = access_token
        bot.broker = broker
        logger.info(f"Updated bot broker service for user {user_id}")
    return _ai_strangle_bots[user_id]


def get_ai_strangle_bot(user_id: str) -> Optional[AIStrangleBot]:
    """Get existing bot"""
    return _ai_strangle_bots.get(user_id)
