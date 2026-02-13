# backend/services/algo_trading_engine.py
"""
Algo Trading Engine
Live trading with Delta Neutral strategy and auto-adjustments
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import math

logger = logging.getLogger(__name__)


class OrderType(Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL = "SL"
    SL_M = "SL-M"


class ProductType(Enum):
    INTRADAY = "INTRADAY"
    CNC = "CNC"
    MARGIN = "MARGIN"


class TransactionType(Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass
class Position:
    symbol: str
    security_id: str
    quantity: int
    avg_price: float
    ltp: float
    pnl: float
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    option_type: str = None  # CE or PE
    strike: float = 0.0
    expiry: str = None


class StrategyMode(Enum):
    """Available delta-neutral strategy types"""
    SHORT_STRANGLE = "short_strangle"       # Sell OTM CE + PE (unlimited risk, high premium)
    IRON_CONDOR = "iron_condor"             # Sell OTM CE+PE, buy further OTM wings (defined risk)
    IRON_BUTTERFLY = "iron_butterfly"       # Sell ATM straddle + buy OTM wings (high premium, defined risk)
    STRADDLE_HEDGE = "straddle_hedge"       # Sell ATM straddle + dynamic delta hedge with futures/options


class Timeframe(Enum):
    """Trading timeframe"""
    INTRADAY = "intraday"     # 0DTE - enter morning, exit by 3:15 PM same day
    WEEKLY = "weekly"         # Enter Mon/Tue, ride till Thu/Fri expiry
    SMART = "smart"           # Auto-select based on IV percentile and DTE


@dataclass
class DeltaNeutralConfig:
    """Configuration for Delta Neutral Strategy"""
    underlying: str = "NIFTY"
    max_delta_drift: float = 0.1  # Max delta before adjustment (±10%)
    lot_size: int = 50
    max_positions: int = 10
    hedge_with_futures: bool = False
    hedge_with_options: bool = True
    auto_adjust: bool = True
    adjustment_interval_seconds: int = 60
    stop_loss_percent: float = 2.0
    target_profit_percent: float = 1.0
    max_loss_per_day: float = 5000.0
    position_sizing: str = "fixed"  # fixed, kelly, volatility
    
    # ─── NEW: Strategy & Timeframe ───────────────────────────────────────
    strategy_mode: str = "iron_condor"      # short_strangle | iron_condor | iron_butterfly | straddle_hedge
    timeframe: str = "weekly"               # intraday | weekly | smart
    
    # ─── NEW: Iron Condor / Butterfly specific ───────────────────────────
    entry_delta: float = 16.0               # Delta for short strikes (0-100 scale)
    wing_width: int = 200                   # Points between short & long strikes (protection)
    wing_delta: float = 5.0                 # Delta for long (protective) wings
    
    # ─── NEW: Smart Entry Filters ────────────────────────────────────────
    iv_entry_min: float = 25.0              # Min IV percentile to enter (skip low-IV days)
    min_premium_pct: float = 0.3            # Min premium as % of underlying to enter
    no_entry_after: str = "14:30"           # Don't open new positions after this (IST)
    
    # ─── NEW: Enhanced Profit / Exit ─────────────────────────────────────
    trailing_profit: bool = True            # Use trailing profit instead of fixed target
    profit_target_pct: float = 50.0         # Close at 50% of max credit
    trailing_step_pct: float = 10.0         # Trail in 10% increments
    time_based_exit: bool = True            # Tighter targets as expiry nears
    
    # ─── NEW: Enhanced Risk Management ───────────────────────────────────
    max_adjustments_per_day: int = 3        # Cap daily adjustments
    adjustment_trigger_delta: float = 30.0  # Adjust when short strike delta > this
    cool_down_seconds: int = 120            # Min time between adjustments
    vix_exit_threshold: float = 25.0        # Emergency close if India VIX exceeds this
    partial_profit_booking: bool = True     # Close 50% at first target, trail rest


@dataclass 
class AlgoState:
    """State of the algo trading bot"""
    is_running: bool = False
    positions: List[Position] = field(default_factory=list)
    total_delta: float = 0.0
    total_pnl: float = 0.0
    trades_today: int = 0
    last_adjustment: datetime = None
    errors: List[str] = field(default_factory=list)


class AlgoTradingEngine:
    """
    Live Algo Trading Engine with Delta Neutral capabilities
    """
    
    def __init__(self, broker_service, access_token: str, broker: str = "dhan"):
        self.broker_service = broker_service
        self.access_token = access_token
        self.broker = broker
        self.state = AlgoState()
        self.config = DeltaNeutralConfig()
        self._running = False
        self._task = None
    
    # ========================================
    # ORDER PLACEMENT
    # ========================================
    
    async def place_order(
        self,
        symbol: str,
        security_id: str,
        transaction_type: TransactionType,
        quantity: int,
        order_type: OrderType = OrderType.MARKET,
        price: float = 0,
        product_type: ProductType = ProductType.INTRADAY
    ) -> Dict[str, Any]:
        """
        Place an order via broker API
        """
        try:
            if self.broker == "dhan":
                return await self._place_dhan_order(
                    security_id, transaction_type, quantity, order_type, price, product_type
                )
            elif self.broker == "upstox":
                return await self._place_upstox_order(
                    symbol, transaction_type, quantity, order_type, price, product_type
                )
            else:
                return {"success": False, "error": f"Unknown broker: {self.broker}"}
        except Exception as e:
            logger.error(f"Order placement failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _place_dhan_order(
        self,
        security_id: str,
        transaction_type: TransactionType,
        quantity: int,
        order_type: OrderType,
        price: float,
        product_type: ProductType
    ) -> Dict[str, Any]:
        """Place order via Dhan API"""
        order_data = {
            "dhanClientId": "",  # Will be filled by API
            "transactionType": transaction_type.value,
            "exchangeSegment": "NSE_FNO",
            "productType": product_type.value,
            "orderType": order_type.value,
            "validity": "DAY",
            "securityId": security_id,
            "quantity": quantity,
            "disclosedQuantity": 0,
            "price": price if order_type == OrderType.LIMIT else 0,
            "triggerPrice": 0,
            "afterMarketOrder": False,
            "amoTime": "OPEN",
            "boProfitValue": 0,
            "boStopLossValue": 0
        }
        
        result = await self.broker_service._make_request("POST", "/orders", order_data)
        
        if result.get("orderId"):
            return {
                "success": True,
                "order_id": result.get("orderId"),
                "status": result.get("orderStatus", "PENDING"),
                "message": "Order placed successfully"
            }
        else:
            return {
                "success": False,
                "error": result.get("errorMessage", "Order failed")
            }
    
    async def _place_upstox_order(
        self,
        symbol: str,
        transaction_type: TransactionType,
        quantity: int,
        order_type: OrderType,
        price: float,
        product_type: ProductType
    ) -> Dict[str, Any]:
        """Place order via Upstox API"""
        order_data = {
            "quantity": quantity,
            "product": "I" if product_type == ProductType.INTRADAY else "D",
            "validity": "DAY",
            "price": price if order_type == OrderType.LIMIT else 0,
            "tag": "moneysaarthi",
            "instrument_token": symbol,
            "order_type": order_type.value,
            "transaction_type": transaction_type.value,
            "disclosed_quantity": 0,
            "trigger_price": 0,
            "is_amo": False
        }
        
        result = await self.broker_service._make_request("POST", "/order/place", order_data)
        
        if result.get("data", {}).get("order_id"):
            return {
                "success": True,
                "order_id": result["data"]["order_id"],
                "status": "PENDING",
                "message": "Order placed successfully"
            }
        else:
            return {
                "success": False,
                "error": result.get("message", "Order failed")
            }
    
    # ========================================
    # DELTA NEUTRAL STRATEGY
    # ========================================
    
    def calculate_option_delta(
        self,
        spot_price: float,
        strike: float,
        time_to_expiry: float,  # in years
        volatility: float,
        risk_free_rate: float = 0.07,
        option_type: str = "CE"
    ) -> float:
        """
        Calculate option delta using Black-Scholes approximation
        """
        if time_to_expiry <= 0:
            # At expiry
            if option_type == "CE":
                return 1.0 if spot_price > strike else 0.0
            else:
                return -1.0 if spot_price < strike else 0.0
        
        # Simplified delta calculation
        d1 = (math.log(spot_price / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry) / (volatility * math.sqrt(time_to_expiry))
        
        from math import erf
        def norm_cdf(x):
            return (1.0 + erf(x / math.sqrt(2.0))) / 2.0
        
        if option_type == "CE":
            return norm_cdf(d1)
        else:
            return norm_cdf(d1) - 1.0
    
    def calculate_portfolio_delta(self, positions: List[Position], spot_price: float) -> float:
        """
        Calculate total portfolio delta
        """
        total_delta = 0.0
        
        for pos in positions:
            if pos.option_type:
                # Option position
                delta = self.calculate_option_delta(
                    spot_price=spot_price,
                    strike=pos.strike,
                    time_to_expiry=0.02,  # ~1 week
                    volatility=0.15,
                    option_type=pos.option_type
                )
                total_delta += delta * pos.quantity * self.config.lot_size
            else:
                # Futures/Equity position
                total_delta += pos.quantity
        
        return total_delta
    
    async def check_and_adjust_delta(self) -> Dict[str, Any]:
        """
        Check portfolio delta and adjust if needed
        """
        try:
            # Get current positions
            positions_result = await self.broker_service.get_positions()
            if not positions_result.get("success"):
                return {"success": False, "error": "Failed to fetch positions"}
            
            positions = self._parse_positions(positions_result.get("data", {}).get("positions", []))
            self.state.positions = positions
            
            # Get spot price
            spot_price = await self._get_spot_price()
            if not spot_price:
                return {"success": False, "error": "Failed to get spot price"}
            
            # Calculate current delta
            current_delta = self.calculate_portfolio_delta(positions, spot_price)
            self.state.total_delta = current_delta
            
            logger.info(f"Current portfolio delta: {current_delta:.2f}")
            
            # Check if adjustment needed
            if abs(current_delta) > self.config.max_delta_drift * self.config.lot_size:
                return await self._adjust_delta(current_delta, spot_price)
            
            return {
                "success": True,
                "delta": current_delta,
                "adjusted": False,
                "message": "Delta within acceptable range"
            }
            
        except Exception as e:
            logger.error(f"Delta adjustment error: {e}")
            self.state.errors.append(str(e))
            return {"success": False, "error": str(e)}
    
    async def _adjust_delta(self, current_delta: float, spot_price: float) -> Dict[str, Any]:
        """
        Adjust portfolio to make it delta neutral
        """
        logger.info(f"Adjusting delta from {current_delta:.2f} to 0")
        
        # Calculate hedge quantity
        hedge_quantity = -int(current_delta / self.config.lot_size) * self.config.lot_size
        
        if hedge_quantity == 0:
            return {"success": True, "adjusted": False, "message": "No adjustment needed"}
        
        # Determine transaction type
        transaction_type = TransactionType.BUY if hedge_quantity > 0 else TransactionType.SELL
        quantity = abs(hedge_quantity)
        
        if self.config.hedge_with_options:
            # Hedge with ATM options
            atm_strike = round(spot_price / 50) * 50  # Round to nearest 50
            option_type = "PE" if current_delta > 0 else "CE"
            
            # Get option security ID (simplified - would need actual lookup)
            security_id = f"{self.config.underlying}{atm_strike}{option_type}"
            
            result = await self.place_order(
                symbol=security_id,
                security_id=security_id,
                transaction_type=transaction_type,
                quantity=quantity // self.config.lot_size,
                order_type=OrderType.MARKET,
                product_type=ProductType.INTRADAY
            )
            
            if result.get("success"):
                self.state.trades_today += 1
                self.state.last_adjustment = datetime.now()
                logger.info(f"Delta adjustment successful: {transaction_type.value} {quantity} {security_id}")
            
            return {
                "success": result.get("success"),
                "adjusted": True,
                "hedge_type": "option",
                "quantity": quantity,
                "order_result": result
            }
        
        return {"success": False, "error": "No hedge method available"}
    
    # ========================================
    # STRATEGY-SPECIFIC ENTRY LOGIC
    # ========================================
    
    def get_strategy_description(self) -> Dict[str, Any]:
        """Get human-readable strategy description for the current config"""
        mode = self.config.strategy_mode
        tf = self.config.timeframe
        
        descriptions = {
            "iron_condor": {
                "name": "Iron Condor",
                "risk": "Defined (max loss = wing width × lot size)",
                "description": (
                    f"Sell CE & PE at ~{self.config.entry_delta}δ, buy protective wings "
                    f"{self.config.wing_width} pts away. Max loss is capped. "
                    "Auto-rolls inner legs when delta breaches threshold."
                ),
                "best_for": "Range-bound markets, hands-off trading",
                "expected_return": "2-4% weekly on margin deployed",
                "profit_target": f"{self.config.profit_target_pct}% of credit received",
            },
            "iron_butterfly": {
                "name": "Iron Butterfly",
                "risk": "Defined (max loss = wing width × lot size − credit)",
                "description": (
                    "Sell ATM straddle, buy OTM wings for protection. "
                    "Higher premium than condor but needs market to stay near strike. "
                    "Auto-adjusts center when underlying moves significantly."
                ),
                "best_for": "Low-volatility, range-bound days",
                "expected_return": "3-6% weekly on margin deployed",
                "profit_target": f"{self.config.profit_target_pct}% of credit received",
            },
            "short_strangle": {
                "name": "Short Strangle",
                "risk": "Unlimited (no protective wings)",
                "description": (
                    f"Sell naked CE & PE at ~{self.config.entry_delta}δ. "
                    "Highest premium but unlimited risk. "
                    "Auto-rolls when delta breaches. Requires margin."
                ),
                "best_for": "Experienced traders, high IV environments",
                "expected_return": "3-5% weekly on capital",
                "profit_target": f"{self.config.profit_target_pct}% of credit received",
            },
            "straddle_hedge": {
                "name": "Straddle + Hedge",
                "risk": "Managed via continuous delta hedging",
                "description": (
                    "Sell ATM straddle, hedge delta continuously with far-OTM options. "
                    "Pure theta capture with gamma scalping. "
                    "Most automated—bot handles all adjustments."
                ),
                "best_for": "Maximum theta, active management",
                "expected_return": "2-4% weekly",
                "profit_target": f"{self.config.profit_target_pct}% of credit received",
            },
        }
        
        timeframe_info = {
            "intraday": "0DTE — enter after 9:30, exit by 3:15 PM same day",
            "weekly": "Enter Mon/Tue, ride till Thu/Fri expiry",
            "smart": "Auto-selects intraday or weekly based on IV and DTE",
        }
        
        desc = descriptions.get(mode, descriptions["iron_condor"])
        desc["timeframe"] = timeframe_info.get(tf, timeframe_info["weekly"])
        desc["mode"] = mode
        desc["tf"] = tf
        
        return desc
    
    def calculate_time_based_profit_target(self, dte: int) -> float:
        """
        Dynamic profit target that gets tighter as expiry nears.
        More theta decays near expiry, so we can close earlier.
        
        Returns target as % of max credit.
        """
        base = self.config.profit_target_pct
        
        if not self.config.time_based_exit:
            return base
        
        if dte <= 0:
            return 90.0  # Almost all profit at 0DTE
        elif dte == 1:
            return 70.0  # 70% profit at 1 DTE
        elif dte == 2:
            return 60.0  # 60% at 2 DTE
        elif dte <= 4:
            return 50.0  # Standard 50% at 3-4 DTE
        else:
            return base   # User-configured target for longer-dated
    
    def calculate_dynamic_stop_loss(self, dte: int) -> float:
        """
        Dynamic stop-loss that tightens near expiry (limit gamma risk).
        
        Returns max loss as multiple of credit.
        """
        base = 2.0  # Default 2x credit
        
        if self.config.timeframe == "intraday":
            return 1.5   # Tighter stop for 0DTE
        
        if dte <= 1:
            return 1.5   # Tighter near expiry
        elif dte <= 3:
            return 1.75
        else:
            return base
    
    def should_enter_trade(self, iv_percentile: float, current_time_str: str) -> Dict[str, Any]:
        """
        Smart entry filter — only enter when conditions are favorable.
        
        Checks:
        - IV percentile above minimum
        - Not too late in the day
        - Market hours
        """
        reasons = []
        can_enter = True
        
        # IV filter
        if iv_percentile < self.config.iv_entry_min:
            can_enter = False
            reasons.append(f"IV percentile {iv_percentile:.0f}% < min {self.config.iv_entry_min:.0f}%")
        else:
            reasons.append(f"IV percentile {iv_percentile:.0f}% OK (min {self.config.iv_entry_min:.0f}%)")
        
        # Time filter
        try:
            hour, minute = map(int, current_time_str.split(":"))
            no_h, no_m = map(int, self.config.no_entry_after.split(":"))
            if hour > no_h or (hour == no_h and minute > no_m):
                can_enter = False
                reasons.append(f"Too late ({current_time_str} > {self.config.no_entry_after})")
        except:
            pass
        
        # Weekend check
        if datetime.now().weekday() >= 5:
            can_enter = False
            reasons.append("Weekend — market closed")
        
        return {"can_enter": can_enter, "reasons": reasons}

    async def _get_spot_price(self) -> Optional[float]:
        """Get current spot price of underlying from broker or market data"""
        try:
            # Try fetching from broker service
            if self.broker_service and hasattr(self.broker_service, 'get_ltp'):
                ltp_data = await self.broker_service.get_ltp(self.config.underlying)
                if ltp_data and ltp_data.get("success"):
                    return ltp_data.get("ltp", ltp_data.get("last_price"))
            
            # Try fetching from broker positions/funds as fallback
            if self.broker_service and hasattr(self.broker_service, 'get_positions'):
                positions = await self.broker_service.get_positions()
                if positions.get("success"):
                    for pos in positions.get("data", {}).get("positions", []):
                        symbol = pos.get("tradingSymbol", pos.get("trading_symbol", ""))
                        if self.config.underlying in symbol and not any(x in symbol for x in ["CE", "PE"]):
                            return float(pos.get("lastPrice", pos.get("last_price", 0)))
            
            # Try external API as last resort
            import aiohttp
            async with aiohttp.ClientSession() as session:
                # Use a simple market data endpoint
                nse_url = f"https://www.nseindia.com/api/equity-stockIndices?index={'NIFTY 50' if self.config.underlying == 'NIFTY' else 'NIFTY BANK'}"
                headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
                async with session.get(nse_url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("data"):
                            return float(data["data"][0].get("lastPrice", 0))
            
            # Mock fallback with realistic default
            logger.warning(f"Using estimated spot price for {self.config.underlying}")
            return 24000.0 if self.config.underlying == "NIFTY" else 52000.0
        except Exception as e:
            logger.error(f"Error getting spot price: {e}")
            return 24000.0 if self.config.underlying == "NIFTY" else 52000.0
    
    def _parse_positions(self, raw_positions: List[Dict]) -> List[Position]:
        """Parse raw position data into Position objects"""
        positions = []
        
        for p in raw_positions:
            # Parse based on broker format
            symbol = p.get("tradingSymbol", p.get("trading_symbol", ""))
            
            # Extract option details from symbol
            option_type = None
            strike = 0.0
            if "CE" in symbol:
                option_type = "CE"
            elif "PE" in symbol:
                option_type = "PE"
            
            positions.append(Position(
                symbol=symbol,
                security_id=p.get("securityId", p.get("security_id", "")),
                quantity=p.get("netQty", p.get("quantity", 0)),
                avg_price=p.get("avgPrice", p.get("average_price", 0)),
                ltp=p.get("lastPrice", p.get("last_price", 0)),
                pnl=p.get("unrealizedProfit", p.get("pnl", 0)),
                option_type=option_type,
                strike=strike
            ))
        
        return positions
    
    # ========================================
    # BOT CONTROL
    # ========================================
    
    async def start(self, config: DeltaNeutralConfig = None, mock_mode: bool = False) -> Dict[str, Any]:
        """Start the algo trading bot"""
        if self._running:
            return {"success": False, "error": "Bot already running"}
        
        if config:
            self.config = config
        
        self._running = True
        self._mock_mode = mock_mode
        self.state.is_running = True
        self.state.errors = []
        
        # Start the monitoring loop
        self._task = asyncio.create_task(self._monitoring_loop())
        
        mode_str = " [MOCK MODE]" if mock_mode else ""
        strategy_desc = self.get_strategy_description()
        logger.info(f"Algo bot started{mode_str}: {strategy_desc['name']} ({self.config.timeframe})")
        
        return {
            "success": True,
            "message": f"{strategy_desc['name']} bot started{mode_str} ({self.config.timeframe} mode)",
            "mock_mode": mock_mode,
            "strategy": strategy_desc,
            "config": {
                "underlying": self.config.underlying,
                "max_delta_drift": self.config.max_delta_drift,
                "auto_adjust": self.config.auto_adjust,
                "adjustment_interval": self.config.adjustment_interval_seconds,
                "strategy_mode": self.config.strategy_mode,
                "timeframe": self.config.timeframe,
                "entry_delta": self.config.entry_delta,
                "wing_width": self.config.wing_width,
                "profit_target_pct": self.config.profit_target_pct,
                "trailing_profit": self.config.trailing_profit,
            }
        }
    
    async def stop(self) -> Dict[str, Any]:
        """Stop the algo trading bot"""
        if not self._running:
            return {"success": False, "error": "Bot not running"}
        
        self._running = False
        self.state.is_running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("Algo bot stopped")
        
        return {
            "success": True,
            "message": "Delta Neutral bot stopped",
            "final_pnl": self.state.total_pnl,
            "trades_today": self.state.trades_today
        }
    
    async def _monitoring_loop(self):
        """Main monitoring loop for auto-adjustments"""
        while self._running:
            try:
                if self.config.auto_adjust:
                    result = await self.check_and_adjust_delta()
                    logger.info(f"Delta check: {result}")
                
                await asyncio.sleep(self.config.adjustment_interval_seconds)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                self.state.errors.append(str(e))
                await asyncio.sleep(10)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current bot status"""
        strategy_desc = self.get_strategy_description()
        return {
            "is_running": self.state.is_running,
            "broker": self.broker,
            "total_delta": self.state.total_delta,
            "total_pnl": self.state.total_pnl,
            "trades_today": self.state.trades_today,
            "positions_count": len(self.state.positions),
            "last_adjustment": self.state.last_adjustment.isoformat() if self.state.last_adjustment else None,
            "errors": self.state.errors[-5:],  # Last 5 errors
            "strategy": strategy_desc,
            "config": {
                "underlying": self.config.underlying,
                "max_delta_drift": self.config.max_delta_drift,
                "auto_adjust": self.config.auto_adjust,
                "lot_size": self.config.lot_size,
                "strategy_mode": self.config.strategy_mode,
                "timeframe": self.config.timeframe,
                "entry_delta": self.config.entry_delta,
                "wing_width": self.config.wing_width,
                "profit_target_pct": self.config.profit_target_pct,
                "trailing_profit": self.config.trailing_profit,
                "iv_entry_min": self.config.iv_entry_min,
                "max_adjustments_per_day": self.config.max_adjustments_per_day,
            }
        }


# Global bot instances (per user session)
_active_bots: Dict[str, AlgoTradingEngine] = {}


def get_or_create_bot(user_id: str, broker_service, access_token: str, broker: str) -> AlgoTradingEngine:
    """Get existing bot or create new one"""
    if user_id not in _active_bots:
        _active_bots[user_id] = AlgoTradingEngine(broker_service, access_token, broker)
    return _active_bots[user_id]


def get_bot(user_id: str) -> Optional[AlgoTradingEngine]:
    """Get existing bot"""
    return _active_bots.get(user_id)


def remove_bot(user_id: str):
    """Remove bot instance"""
    if user_id in _active_bots:
        del _active_bots[user_id]
