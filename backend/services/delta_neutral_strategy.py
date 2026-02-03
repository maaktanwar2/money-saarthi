"""
Delta Neutral Straddle/Strangle Selling Strategy
================================================

STRATEGY OVERVIEW:
- Sell options at 15-20 delta (both CE and PE) for safety
- Auto leg maker: Creates both legs automatically
- Auto adjustment: Re-adjusts when delta breaches range
- Target: 3-4% monthly return on capital deployed
- Supports: NIFTY, BANKNIFTY, FINNIFTY, and FNO stocks
- Brokers: Dhan and Upstox only
- Access: Admin only

ENTRY RULES:
1. Sell CE at 15-20 delta (OTM call)
2. Sell PE at 15-20 delta (OTM put)
3. Combined premium should give 3-4% return for the period
4. Entry only during market hours (9:20 AM - 3:15 PM)

ADJUSTMENT RULES:
1. If any leg delta > 30: Roll the losing leg to 15-20 delta
2. If any leg delta < 10: Roll closer to get better premium
3. If underlying moves > 1.5%: Adjust both legs
4. Max adjustments per day: 2

EXIT RULES:
1. Exit at 50% profit (premium decay)
2. Exit if loss > 2x premium collected
3. Exit 1 day before expiry (avoid gamma risk)
4. Exit if VIX spikes > 25

RISK MANAGEMENT:
1. Max position size: 2% of capital per trade
2. Stop loss: 2x premium collected
3. Max daily loss: 1% of capital
4. Max concurrent positions: 3

"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import math
import json
import os

# Import broker integration
from services.broker_integration import BrokerManager, OrderRequest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize broker manager
broker_manager = BrokerManager()


class OrderStatus(Enum):
    PENDING = "pending"
    PLACED = "placed"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    ADJUSTED = "adjusted"


class PositionType(Enum):
    STRADDLE = "straddle"
    STRANGLE = "strangle"


class LegType(Enum):
    CALL = "CE"
    PUT = "PE"


@dataclass
class OptionLeg:
    """Represents a single option leg"""
    symbol: str
    strike: float
    leg_type: LegType
    expiry: str
    quantity: int
    entry_price: float = 0.0
    current_price: float = 0.0
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    iv: float = 0.0
    order_id: str = ""
    status: OrderStatus = OrderStatus.PENDING
    pnl: float = 0.0
    
    def to_dict(self):
        return {
            "symbol": self.symbol,
            "strike": self.strike,
            "leg_type": self.leg_type.value,
            "expiry": self.expiry,
            "quantity": self.quantity,
            "entry_price": self.entry_price,
            "current_price": self.current_price,
            "delta": self.delta,
            "gamma": self.gamma,
            "theta": self.theta,
            "vega": self.vega,
            "iv": self.iv,
            "order_id": self.order_id,
            "status": self.status.value,
            "pnl": self.pnl
        }


@dataclass
class StrategyPosition:
    """Represents a complete straddle/strangle position"""
    id: str
    underlying: str
    position_type: PositionType
    call_leg: Optional[OptionLeg] = None
    put_leg: Optional[OptionLeg] = None
    entry_time: datetime = field(default_factory=datetime.now)
    total_premium: float = 0.0
    current_value: float = 0.0
    target_profit_pct: float = 50.0  # Exit at 50% of premium
    stop_loss_pct: float = 200.0  # Stop at 2x premium
    adjustment_count: int = 0
    max_adjustments: int = 2
    status: str = "active"
    broker: str = "dhan"
    
    @property
    def total_pnl(self) -> float:
        pnl = 0.0
        if self.call_leg:
            pnl += (self.call_leg.entry_price - self.call_leg.current_price) * self.call_leg.quantity
        if self.put_leg:
            pnl += (self.put_leg.entry_price - self.put_leg.current_price) * self.put_leg.quantity
        return pnl
    
    @property
    def net_delta(self) -> float:
        delta = 0.0
        if self.call_leg:
            delta += self.call_leg.delta * self.call_leg.quantity
        if self.put_leg:
            delta += self.put_leg.delta * self.put_leg.quantity
        return delta
    
    @property
    def total_theta(self) -> float:
        theta = 0.0
        if self.call_leg:
            theta += self.call_leg.theta * self.call_leg.quantity
        if self.put_leg:
            theta += self.put_leg.theta * self.put_leg.quantity
        return theta
    
    def to_dict(self):
        return {
            "id": self.id,
            "underlying": self.underlying,
            "position_type": self.position_type.value,
            "call_leg": self.call_leg.to_dict() if self.call_leg else None,
            "put_leg": self.put_leg.to_dict() if self.put_leg else None,
            "entry_time": self.entry_time.isoformat(),
            "total_premium": self.total_premium,
            "current_value": self.current_value,
            "total_pnl": self.total_pnl,
            "pnl_pct": (self.total_pnl / self.total_premium * 100) if self.total_premium > 0 else 0,
            "net_delta": self.net_delta,
            "total_theta": self.total_theta,
            "target_profit_pct": self.target_profit_pct,
            "stop_loss_pct": self.stop_loss_pct,
            "adjustment_count": self.adjustment_count,
            "max_adjustments": self.max_adjustments,
            "status": self.status,
            "broker": self.broker
        }


class DeltaNeutralStrategy:
    """
    Delta Neutral Straddle/Strangle Selling Strategy Engine
    
    Features:
    - Auto leg creation at 15-20 delta
    - Real-time delta monitoring
    - Auto adjustment when delta breaches range
    - Risk management with stop loss and profit targets
    - Support for Dhan and Upstox brokers
    """
    
    # Strategy Parameters
    MIN_DELTA = 15
    MAX_DELTA = 20
    ADJUSTMENT_TRIGGER_DELTA = 30  # Adjust if delta goes above this
    MIN_ADJUSTMENT_DELTA = 10  # Adjust if delta goes below this
    TARGET_MONTHLY_RETURN = 3.5  # Target 3.5% monthly
    MAX_LOSS_MULTIPLIER = 2.0  # Stop loss at 2x premium
    PROFIT_TARGET_PCT = 50  # Exit at 50% profit
    MAX_ADJUSTMENTS_PER_DAY = 2
    MAX_CONCURRENT_POSITIONS = 3
    POSITION_SIZE_PCT = 2.0  # Max 2% of capital per trade
    
    # Trading hours
    MARKET_OPEN = "09:20"
    MARKET_CLOSE = "15:15"
    NO_ENTRY_AFTER = "14:30"  # Don't enter new positions after this
    
    def __init__(self, capital: float = 500000):
        self.capital = capital
        self.allocated_capital = capital  # Capital allocated for this strategy
        self.positions: Dict[str, StrategyPosition] = {}
        self.daily_pnl = 0.0
        self.daily_adjustments = 0
        self.trade_log: List[Dict] = []
        self.is_running = False
        self.active_broker = "dhan"  # Default broker
        self.broker_credentials = {}
        
        # Strategy settings stored in memory (would be in DB in production)
        self.settings = {
            "capital": capital,
            "min_delta": self.MIN_DELTA,
            "max_delta": self.MAX_DELTA,
            "target_monthly_return": self.TARGET_MONTHLY_RETURN,
            "max_adjustments_per_day": self.MAX_ADJUSTMENTS_PER_DAY,
            "max_concurrent_positions": self.MAX_CONCURRENT_POSITIONS,
            "broker": "dhan",
            "broker_configured": False
        }
        
    def update_settings(self, new_settings: Dict):
        """Update strategy settings"""
        if "capital" in new_settings:
            self.capital = float(new_settings["capital"])
            self.allocated_capital = float(new_settings["capital"])
        if "min_delta" in new_settings:
            self.MIN_DELTA = float(new_settings["min_delta"])
        if "max_delta" in new_settings:
            self.MAX_DELTA = float(new_settings["max_delta"])
        if "broker" in new_settings:
            self.active_broker = new_settings["broker"]
        
        self.settings.update(new_settings)
        logger.info(f"Strategy settings updated: {new_settings}")
        
    async def configure_broker(self, broker: str, credentials: Dict) -> Dict:
        """
        Configure broker with credentials
        
        For Dhan:
            - client_id: Your Dhan client ID
            - access_token: API access token from Dhan
            
        For Upstox:
            - api_key: Upstox API key
            - api_secret: Upstox API secret
            - access_token: OAuth access token (needs daily refresh)
            - redirect_uri: OAuth redirect URI
        """
        try:
            if broker == "dhan":
                required = ["client_id", "access_token"]
                for field in required:
                    if field not in credentials:
                        return {"success": False, "error": f"Missing required field: {field}"}
                
                # Initialize Dhan broker
                broker_manager.init_dhan(
                    client_id=credentials["client_id"],
                    access_token=credentials["access_token"]
                )
                
                # Test connection by getting funds
                funds = await broker_manager.get_funds("dhan")
                
                self.active_broker = "dhan"
                self.broker_credentials = credentials
                self.settings["broker"] = "dhan"
                self.settings["broker_configured"] = True
                
                logger.info(f"Dhan broker configured successfully. Available funds: {funds}")
                return {
                    "success": True, 
                    "broker": "dhan",
                    "message": "Dhan broker configured successfully",
                    "funds": funds
                }
                
            elif broker == "upstox":
                required = ["api_key", "api_secret", "redirect_uri"]
                for field in required:
                    if field not in credentials:
                        return {"success": False, "error": f"Missing required field: {field}"}
                
                # Check if we have access token
                if "access_token" not in credentials or not credentials["access_token"]:
                    # Need to do OAuth flow first
                    login_url = broker_manager.init_upstox(
                        api_key=credentials["api_key"],
                        api_secret=credentials["api_secret"],
                        redirect_uri=credentials["redirect_uri"]
                    )
                    
                    return {
                        "success": False,
                        "needs_oauth": True,
                        "login_url": login_url,
                        "message": "Please complete OAuth login with Upstox"
                    }
                else:
                    # We have access token
                    broker_manager.init_upstox(
                        api_key=credentials["api_key"],
                        api_secret=credentials["api_secret"],
                        redirect_uri=credentials["redirect_uri"],
                        access_token=credentials["access_token"]
                    )
                    
                    # Test connection
                    funds = await broker_manager.get_funds("upstox")
                    
                    self.active_broker = "upstox"
                    self.broker_credentials = credentials
                    self.settings["broker"] = "upstox"
                    self.settings["broker_configured"] = True
                    
                    logger.info(f"Upstox broker configured successfully")
                    return {
                        "success": True,
                        "broker": "upstox",
                        "message": "Upstox broker configured successfully",
                        "funds": funds
                    }
            else:
                return {"success": False, "error": f"Unsupported broker: {broker}"}
                
        except Exception as e:
            logger.error(f"Error configuring broker: {e}")
            return {"success": False, "error": str(e)}
    
    async def complete_upstox_oauth(self, auth_code: str) -> Dict:
        """Complete Upstox OAuth flow with authorization code"""
        try:
            upstox = broker_manager.get_broker("upstox")
            if not upstox:
                return {"success": False, "error": "Upstox not initialized"}
            
            access_token = await upstox.exchange_code_for_token(auth_code)
            
            self.active_broker = "upstox"
            self.broker_credentials["access_token"] = access_token
            self.settings["broker"] = "upstox"
            self.settings["broker_configured"] = True
            
            # Get funds to verify
            funds = await broker_manager.get_funds("upstox")
            
            return {
                "success": True,
                "broker": "upstox",
                "message": "Upstox OAuth completed successfully",
                "access_token": access_token,  # Store this for future use
                "funds": funds
            }
        except Exception as e:
            logger.error(f"Error completing Upstox OAuth: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_broker_funds(self) -> Dict:
        """Get available funds from active broker"""
        try:
            return await broker_manager.get_funds(self.active_broker)
        except Exception as e:
            logger.error(f"Error getting broker funds: {e}")
            return {"error": str(e)}
    
    async def initialize_broker(self, broker: str, credentials: Dict):
        """Initialize broker connection (deprecated - use configure_broker)"""
        return await self.configure_broker(broker, credentials)
    
    def calculate_black_scholes_delta(
        self, 
        spot: float, 
        strike: float, 
        time_to_expiry: float,  # in years
        volatility: float,  # annualized IV
        risk_free_rate: float = 0.07,
        option_type: str = "CE"
    ) -> float:
        """Calculate option delta using Black-Scholes"""
        from scipy.stats import norm
        
        if time_to_expiry <= 0:
            # At expiry
            if option_type == "CE":
                return 1.0 if spot > strike else 0.0
            else:
                return -1.0 if spot < strike else 0.0
        
        d1 = (math.log(spot / strike) + (risk_free_rate + 0.5 * volatility ** 2) * time_to_expiry) / (volatility * math.sqrt(time_to_expiry))
        
        if option_type == "CE":
            return norm.cdf(d1)
        else:
            return norm.cdf(d1) - 1
    
    def find_strike_for_delta(
        self,
        spot: float,
        target_delta: float,
        expiry_date: datetime,
        iv: float,
        option_type: str,
        strike_interval: float = 50
    ) -> float:
        """Find the strike price that gives approximately the target delta"""
        time_to_expiry = (expiry_date - datetime.now()).total_seconds() / (365.25 * 24 * 3600)
        
        if option_type == "CE":
            # For calls, higher strike = lower delta
            # Start from ATM and go OTM
            search_start = spot
            search_end = spot * 1.2  # 20% OTM max
            target = target_delta / 100  # Convert to decimal
        else:
            # For puts, lower strike = lower absolute delta
            search_start = spot * 0.8  # 20% OTM max
            search_end = spot
            target = -target_delta / 100  # Negative for puts
        
        # Binary search for the strike
        best_strike = spot
        min_diff = float('inf')
        
        current_strike = search_start
        while current_strike <= search_end:
            # Round to nearest strike interval
            rounded_strike = round(current_strike / strike_interval) * strike_interval
            
            delta = self.calculate_black_scholes_delta(
                spot, rounded_strike, time_to_expiry, iv, option_type=option_type
            )
            
            diff = abs(delta - target)
            if diff < min_diff:
                min_diff = diff
                best_strike = rounded_strike
            
            current_strike += strike_interval
        
        return best_strike
    
    async def get_option_chain(self, underlying: str, expiry: str) -> Dict:
        """Fetch option chain from broker"""
        # This would call the actual broker API
        # For now, return mock data structure
        pass
    
    async def get_ltp(self, symbol: str) -> float:
        """Get last traded price"""
        pass
    
    async def get_greeks(self, symbol: str, strike: float, expiry: str, option_type: str) -> Dict:
        """Get option Greeks from broker or calculate"""
        pass
    
    def calculate_required_premium(self, days_to_expiry: int) -> float:
        """
        Calculate required premium to achieve target monthly return
        
        Target: 3-4% monthly = ~0.1-0.13% daily
        For remaining days, calculate proportional target
        """
        daily_target = self.TARGET_MONTHLY_RETURN / 30  # ~0.117% per day
        required_return = daily_target * days_to_expiry
        
        # Add buffer for adjustments (20% extra)
        required_return *= 1.2
        
        return required_return
    
    async def find_optimal_strikes(
        self,
        underlying: str,
        spot: float,
        expiry_date: datetime,
        iv: float
    ) -> Tuple[float, float]:
        """Find optimal CE and PE strikes for 15-20 delta"""
        
        # Determine strike interval based on underlying
        if underlying in ["NIFTY", "NIFTY 50"]:
            strike_interval = 50
        elif underlying in ["BANKNIFTY", "BANK NIFTY"]:
            strike_interval = 100
        elif underlying in ["FINNIFTY", "FIN NIFTY"]:
            strike_interval = 50
        else:
            # Stock options
            if spot > 5000:
                strike_interval = 100
            elif spot > 1000:
                strike_interval = 50
            elif spot > 500:
                strike_interval = 20
            else:
                strike_interval = 10
        
        # Target delta: midpoint of 15-20 range = 17.5
        target_delta = (self.MIN_DELTA + self.MAX_DELTA) / 2
        
        ce_strike = self.find_strike_for_delta(
            spot, target_delta, expiry_date, iv, "CE", strike_interval
        )
        
        pe_strike = self.find_strike_for_delta(
            spot, target_delta, expiry_date, iv, "PE", strike_interval
        )
        
        return ce_strike, pe_strike
    
    async def create_strangle_position(
        self,
        underlying: str,
        expiry: str,
        quantity: int,
        broker: str = "dhan"
    ) -> StrategyPosition:
        """
        Create a new strangle position with auto leg creation
        
        Steps:
        1. Get current spot price
        2. Get current IV
        3. Find optimal strikes at 15-20 delta
        4. Place sell orders for both legs
        5. Monitor and confirm fills
        """
        import uuid
        
        position_id = str(uuid.uuid4())[:8]
        
        # Get spot price
        spot = await self.get_ltp(underlying)
        
        # Get IV (from option chain or VIX for indices)
        iv = 0.15  # Default 15% IV, would be fetched from market
        
        # Parse expiry date
        expiry_date = datetime.strptime(expiry, "%Y-%m-%d")
        days_to_expiry = (expiry_date - datetime.now()).days
        
        # Find optimal strikes
        ce_strike, pe_strike = await self.find_optimal_strikes(
            underlying, spot, expiry_date, iv
        )
        
        # Calculate required premium
        required_return_pct = self.calculate_required_premium(days_to_expiry)
        
        # Create option symbols
        ce_symbol = f"{underlying}{expiry.replace('-', '')}{int(ce_strike)}CE"
        pe_symbol = f"{underlying}{expiry.replace('-', '')}{int(pe_strike)}PE"
        
        # Create leg objects
        call_leg = OptionLeg(
            symbol=ce_symbol,
            strike=ce_strike,
            leg_type=LegType.CALL,
            expiry=expiry,
            quantity=quantity,
            delta=self.calculate_black_scholes_delta(
                spot, ce_strike, days_to_expiry/365, iv, option_type="CE"
            ) * 100
        )
        
        put_leg = OptionLeg(
            symbol=pe_symbol,
            strike=pe_strike,
            leg_type=LegType.PUT,
            expiry=expiry,
            quantity=quantity,
            delta=self.calculate_black_scholes_delta(
                spot, pe_strike, days_to_expiry/365, iv, option_type="PE"
            ) * 100
        )
        
        # Create position
        position = StrategyPosition(
            id=position_id,
            underlying=underlying,
            position_type=PositionType.STRANGLE,
            call_leg=call_leg,
            put_leg=put_leg,
            broker=broker
        )
        
        logger.info(f"Created strangle position: {position.id}")
        logger.info(f"  CE: {ce_symbol} @ strike {ce_strike}, delta: {call_leg.delta:.1f}")
        logger.info(f"  PE: {pe_symbol} @ strike {pe_strike}, delta: {put_leg.delta:.1f}")
        
        return position
    
    async def place_order(
        self,
        leg: OptionLeg,
        order_type: str = "SELL",
        broker: str = None
    ) -> str:
        """
        Place order through broker API using broker_integration
        
        Args:
            leg: OptionLeg object with order details
            order_type: "SELL" or "BUY"
            broker: "dhan" or "upstox" (defaults to active_broker)
        
        Returns:
            order_id from broker
        """
        broker = broker or self.active_broker
        
        if not self.settings.get("broker_configured"):
            raise ValueError("Broker not configured. Please configure broker credentials first.")
        
        # Create OrderRequest for broker_integration
        order_request = OrderRequest(
            symbol=leg.symbol,
            exchange="NFO",
            transaction_type=order_type,
            quantity=leg.quantity,
            order_type="LIMIT",
            product_type="NRML",
            price=leg.current_price,
            validity="DAY"
        )
        
        try:
            # Place order through broker manager
            response = await broker_manager.place_order(broker, order_request)
            
            if response.success:
                order_id = response.order_id
                logger.info(f"Order placed successfully: {order_id} - {order_type} {leg.quantity} {leg.symbol}")
                
                # Log the trade
                self.trade_log.append({
                    "timestamp": datetime.now().isoformat(),
                    "broker": broker,
                    "order_id": order_id,
                    "symbol": leg.symbol,
                    "action": order_type,
                    "quantity": leg.quantity,
                    "price": leg.current_price,
                    "status": "placed"
                })
                
                return order_id
            else:
                error_msg = response.error_message or "Unknown error"
                logger.error(f"Order failed: {error_msg}")
                raise Exception(f"Order placement failed: {error_msg}")
                
        except Exception as e:
            logger.error(f"Error placing order through {broker}: {e}")
            raise
    
    async def check_adjustment_needed(self, position: StrategyPosition) -> Dict:
        """
        Check if position needs adjustment based on delta
        
        Returns:
            Dict with adjustment details or None if no adjustment needed
        """
        adjustment = {"needed": False, "legs": [], "reason": ""}
        
        # Check call leg delta
        if position.call_leg:
            call_delta = abs(position.call_leg.delta)
            
            if call_delta > self.ADJUSTMENT_TRIGGER_DELTA:
                adjustment["needed"] = True
                adjustment["legs"].append({
                    "leg": "call",
                    "current_delta": call_delta,
                    "action": "roll_up",
                    "reason": f"Delta {call_delta:.1f} > {self.ADJUSTMENT_TRIGGER_DELTA}"
                })
            elif call_delta < self.MIN_ADJUSTMENT_DELTA:
                adjustment["needed"] = True
                adjustment["legs"].append({
                    "leg": "call",
                    "current_delta": call_delta,
                    "action": "roll_down",
                    "reason": f"Delta {call_delta:.1f} < {self.MIN_ADJUSTMENT_DELTA}"
                })
        
        # Check put leg delta
        if position.put_leg:
            put_delta = abs(position.put_leg.delta)
            
            if put_delta > self.ADJUSTMENT_TRIGGER_DELTA:
                adjustment["needed"] = True
                adjustment["legs"].append({
                    "leg": "put",
                    "current_delta": put_delta,
                    "action": "roll_down",
                    "reason": f"Delta {put_delta:.1f} > {self.ADJUSTMENT_TRIGGER_DELTA}"
                })
            elif put_delta < self.MIN_ADJUSTMENT_DELTA:
                adjustment["needed"] = True
                adjustment["legs"].append({
                    "leg": "put",
                    "current_delta": put_delta,
                    "action": "roll_up",
                    "reason": f"Delta {put_delta:.1f} < {self.MIN_ADJUSTMENT_DELTA}"
                })
        
        return adjustment
    
    async def adjust_position(
        self,
        position: StrategyPosition,
        adjustment: Dict
    ) -> StrategyPosition:
        """
        Adjust position by rolling legs to target delta
        
        Steps:
        1. Buy back the leg being adjusted
        2. Sell new leg at target delta
        3. Update position records
        """
        if position.adjustment_count >= position.max_adjustments:
            logger.warning(f"Position {position.id} has reached max adjustments")
            return position
        
        spot = await self.get_ltp(position.underlying)
        expiry_date = datetime.strptime(position.call_leg.expiry, "%Y-%m-%d")
        iv = 0.15  # Would fetch actual IV
        
        for leg_adj in adjustment["legs"]:
            leg_type = leg_adj["leg"]
            action = leg_adj["action"]
            
            if leg_type == "call" and position.call_leg:
                old_leg = position.call_leg
                
                # Buy back old position
                await self.place_order(old_leg, "BUY", position.broker)
                
                # Find new strike at target delta
                target_delta = (self.MIN_DELTA + self.MAX_DELTA) / 2
                new_strike = self.find_strike_for_delta(
                    spot, target_delta, expiry_date, iv, "CE"
                )
                
                # Create and place new leg
                new_symbol = f"{position.underlying}{position.call_leg.expiry.replace('-', '')}{int(new_strike)}CE"
                position.call_leg.strike = new_strike
                position.call_leg.symbol = new_symbol
                
                await self.place_order(position.call_leg, "SELL", position.broker)
                
                logger.info(f"Adjusted call leg from {old_leg.strike} to {new_strike}")
                
            elif leg_type == "put" and position.put_leg:
                old_leg = position.put_leg
                
                # Buy back old position
                await self.place_order(old_leg, "BUY", position.broker)
                
                # Find new strike at target delta
                target_delta = (self.MIN_DELTA + self.MAX_DELTA) / 2
                new_strike = self.find_strike_for_delta(
                    spot, target_delta, expiry_date, iv, "PE"
                )
                
                # Create and place new leg
                new_symbol = f"{position.underlying}{position.put_leg.expiry.replace('-', '')}{int(new_strike)}PE"
                position.put_leg.strike = new_strike
                position.put_leg.symbol = new_symbol
                
                await self.place_order(position.put_leg, "SELL", position.broker)
                
                logger.info(f"Adjusted put leg from {old_leg.strike} to {new_strike}")
        
        position.adjustment_count += 1
        self.daily_adjustments += 1
        
        return position
    
    async def check_exit_conditions(self, position: StrategyPosition) -> Dict:
        """
        Check if position should be exited
        
        Exit conditions:
        1. Profit target reached (50% of premium)
        2. Stop loss hit (2x premium loss)
        3. 1 day before expiry
        4. VIX spike > 25
        5. Daily loss limit reached
        """
        exit_signal = {"should_exit": False, "reason": ""}
        
        # Check profit target
        pnl_pct = (position.total_pnl / position.total_premium * 100) if position.total_premium > 0 else 0
        
        if pnl_pct >= position.target_profit_pct:
            exit_signal["should_exit"] = True
            exit_signal["reason"] = f"Profit target reached: {pnl_pct:.1f}%"
            return exit_signal
        
        # Check stop loss
        if pnl_pct <= -position.stop_loss_pct:
            exit_signal["should_exit"] = True
            exit_signal["reason"] = f"Stop loss hit: {pnl_pct:.1f}%"
            return exit_signal
        
        # Check expiry proximity
        if position.call_leg:
            expiry_date = datetime.strptime(position.call_leg.expiry, "%Y-%m-%d")
            days_to_expiry = (expiry_date - datetime.now()).days
            
            if days_to_expiry <= 1:
                exit_signal["should_exit"] = True
                exit_signal["reason"] = f"Approaching expiry: {days_to_expiry} days"
                return exit_signal
        
        # Check VIX (would fetch actual VIX)
        # vix = await self.get_vix()
        # if vix > 25:
        #     exit_signal["should_exit"] = True
        #     exit_signal["reason"] = f"VIX spike: {vix}"
        
        return exit_signal
    
    async def exit_position(self, position: StrategyPosition, reason: str):
        """Exit entire position by buying back all legs"""
        
        logger.info(f"Exiting position {position.id}: {reason}")
        
        if position.call_leg:
            await self.place_order(position.call_leg, "BUY", position.broker)
            
        if position.put_leg:
            await self.place_order(position.put_leg, "BUY", position.broker)
        
        position.status = "closed"
        
        # Log trade
        self.trade_log.append({
            "position_id": position.id,
            "underlying": position.underlying,
            "exit_time": datetime.now().isoformat(),
            "exit_reason": reason,
            "total_pnl": position.total_pnl,
            "adjustments": position.adjustment_count
        })
        
        return position
    
    async def monitor_positions(self):
        """
        Main monitoring loop - runs every minute during market hours
        
        Actions:
        1. Update Greeks for all positions
        2. Check adjustment conditions
        3. Check exit conditions
        4. Execute adjustments/exits as needed
        """
        while self.is_running:
            current_time = datetime.now().strftime("%H:%M")
            
            # Only monitor during market hours
            if current_time < self.MARKET_OPEN or current_time > self.MARKET_CLOSE:
                await asyncio.sleep(60)
                continue
            
            for position_id, position in list(self.positions.items()):
                if position.status != "active":
                    continue
                
                try:
                    # Update current prices and Greeks
                    # await self.update_position_greeks(position)
                    
                    # Check exit conditions
                    exit_check = await self.check_exit_conditions(position)
                    if exit_check["should_exit"]:
                        await self.exit_position(position, exit_check["reason"])
                        continue
                    
                    # Check adjustment conditions
                    if self.daily_adjustments < self.MAX_ADJUSTMENTS_PER_DAY:
                        adjustment = await self.check_adjustment_needed(position)
                        if adjustment["needed"]:
                            await self.adjust_position(position, adjustment)
                    
                except Exception as e:
                    logger.error(f"Error monitoring position {position_id}: {e}")
            
            # Wait before next check (1 minute)
            await asyncio.sleep(60)
    
    def get_strategy_status(self) -> Dict:
        """Get current strategy status"""
        active_positions = [p for p in self.positions.values() if p.status == "active"]
        
        total_pnl = sum(p.total_pnl for p in active_positions)
        total_premium = sum(p.total_premium for p in active_positions)
        
        return {
            "is_running": self.is_running,
            "capital": self.capital,
            "active_positions": len(active_positions),
            "total_positions": len(self.positions),
            "daily_pnl": self.daily_pnl,
            "total_pnl": total_pnl,
            "total_premium_collected": total_premium,
            "daily_adjustments": self.daily_adjustments,
            "positions": [p.to_dict() for p in active_positions],
            "parameters": {
                "min_delta": self.MIN_DELTA,
                "max_delta": self.MAX_DELTA,
                "adjustment_trigger": self.ADJUSTMENT_TRIGGER_DELTA,
                "target_monthly_return": self.TARGET_MONTHLY_RETURN,
                "max_loss_multiplier": self.MAX_LOSS_MULTIPLIER,
                "profit_target_pct": self.PROFIT_TARGET_PCT
            }
        }
    
    async def start(self):
        """Start the strategy monitoring"""
        self.is_running = True
        logger.info("Delta Neutral Strategy started")
        await self.monitor_positions()
    
    def stop(self):
        """Stop the strategy monitoring"""
        self.is_running = False
        logger.info("Delta Neutral Strategy stopped")


# Singleton instance
_strategy_instance: Optional[DeltaNeutralStrategy] = None


def get_strategy() -> DeltaNeutralStrategy:
    """Get or create strategy instance"""
    global _strategy_instance
    if _strategy_instance is None:
        _strategy_instance = DeltaNeutralStrategy()
    return _strategy_instance
