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
    
    async def _get_spot_price(self) -> Optional[float]:
        """Get current spot price of underlying"""
        try:
            # This would call market data API
            # For now, return a placeholder
            return 22500.0  # Placeholder for NIFTY
        except Exception as e:
            logger.error(f"Error getting spot price: {e}")
            return None
    
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
        logger.info(f"Algo bot started{mode_str} with config: {self.config}")
        
        return {
            "success": True,
            "message": f"Delta Neutral bot started{mode_str}",
            "mock_mode": mock_mode,
            "config": {
                "underlying": self.config.underlying,
                "max_delta_drift": self.config.max_delta_drift,
                "auto_adjust": self.config.auto_adjust,
                "adjustment_interval": self.config.adjustment_interval_seconds
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
        return {
            "is_running": self.state.is_running,
            "broker": self.broker,
            "total_delta": self.state.total_delta,
            "total_pnl": self.state.total_pnl,
            "trades_today": self.state.trades_today,
            "positions_count": len(self.state.positions),
            "last_adjustment": self.state.last_adjustment.isoformat() if self.state.last_adjustment else None,
            "errors": self.state.errors[-5:],  # Last 5 errors
            "config": {
                "underlying": self.config.underlying,
                "max_delta_drift": self.config.max_delta_drift,
                "auto_adjust": self.config.auto_adjust,
                "lot_size": self.config.lot_size
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
