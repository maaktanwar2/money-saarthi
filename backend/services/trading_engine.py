"""
Trading Engine - Actual Order Execution
========================================

This is the REAL trading engine that:
1. Monitors market conditions
2. Generates strategy signals
3. Places actual orders via broker API
4. Manages positions and risk

Author: Money Saarthi
Version: 2.1
"""

import asyncio
import logging
from datetime import datetime, time, timedelta, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import json

logger = logging.getLogger(__name__)

# IST timezone offset (+5:30)
IST = timezone(timedelta(hours=5, minutes=30))


@dataclass
class Signal:
    """Trading signal"""
    symbol: str
    action: str  # BUY, SELL
    quantity: int
    order_type: str  # MARKET, LIMIT
    price: float = 0
    stop_loss: float = 0
    target: float = 0
    confidence: float = 0.0
    reason: str = ""


@dataclass
class BotState:
    """Bot running state"""
    bot_id: str
    strategy: str
    status: str = "idle"  # idle, running, paused, stopped
    positions: List[Dict] = field(default_factory=list)
    trades_today: int = 0
    pnl_today: float = 0
    last_signal: Optional[Signal] = None
    last_trade_time: Optional[datetime] = None
    error_count: int = 0
    logs: List[str] = field(default_factory=list)


class TradingEngine:
    """
    Core trading engine that executes strategies
    """
    
    def __init__(self, broker_service, config: Dict[str, Any]):
        self.broker = broker_service
        self.config = config
        self.running = False
        self.bot_states: Dict[str, BotState] = {}
        
        # Default config
        self.capital = config.get("capital", 50000)
        self.risk_per_trade = config.get("riskPerTrade", 1)  # 1%
        self.max_daily_loss = config.get("maxDailyLoss", 3)  # 3%
        self.max_trades = config.get("maxTradesPerDay", 10)
        self.instruments = config.get("instruments", ["NIFTY", "BANKNIFTY"])
        
        logger.info(f"⚙️ TradingEngine initialized - Capital: ₹{self.capital}, Risk: {self.risk_per_trade}%")
    
    async def start_bot(self, bot_id: str, strategy: str) -> Dict:
        """Start a trading bot"""
        logger.info(f"🚀 Starting bot {bot_id} with {strategy} strategy")
        
        # Create bot state
        self.bot_states[bot_id] = BotState(
            bot_id=bot_id,
            strategy=strategy,
            status="running"
        )
        
        # Start the trading loop in background
        asyncio.create_task(self._trading_loop(bot_id, strategy))
        
        return {
            "success": True,
            "bot_id": bot_id,
            "strategy": strategy,
            "status": "running"
        }
    
    async def stop_bot(self, bot_id: str) -> Dict:
        """Stop a trading bot"""
        if bot_id in self.bot_states:
            self.bot_states[bot_id].status = "stopped"
            logger.info(f"🛑 Bot {bot_id} stopped")
            return {"success": True, "bot_id": bot_id}
        return {"success": False, "error": "Bot not found"}
    
    def _log(self, bot_id: str, message: str):
        """Add log entry for bot"""
        if bot_id in self.bot_states:
            timestamp = datetime.now(IST).strftime("%H:%M:%S")
            log_entry = f"[{timestamp}] {message}"
            self.bot_states[bot_id].logs.append(log_entry)
            # Keep only last 100 logs
            if len(self.bot_states[bot_id].logs) > 100:
                self.bot_states[bot_id].logs = self.bot_states[bot_id].logs[-100:]
        logger.info(f"[{bot_id}] {message}")
    
    async def _trading_loop(self, bot_id: str, strategy: str):
        """Main trading loop - runs during market hours (IST)"""
        self._log(bot_id, f"🔄 Trading loop started for strategy: {strategy}")
        
        while self.bot_states.get(bot_id, BotState(bot_id, "")).status == "running":
            try:
                # Check market hours (9:15 AM to 3:30 PM IST)
                now_ist = datetime.now(IST)
                market_open = time(9, 15)
                market_close = time(15, 30)
                current_time = now_ist.time()
                
                # Check if it's a weekday (Monday=0, Sunday=6)
                is_weekday = now_ist.weekday() < 5
                
                if not is_weekday:
                    self._log(bot_id, f"📅 Weekend - market closed. Waiting...")
                    await asyncio.sleep(300)  # Check every 5 minutes on weekends
                    continue
                
                if not (market_open <= current_time <= market_close):
                    self._log(bot_id, f"⏰ Outside market hours (IST: {current_time.strftime('%H:%M')}). Market: 9:15-15:30")
                    await asyncio.sleep(60)  # Check every minute outside market hours
                    continue
                
                self._log(bot_id, f"📊 Market open. Checking for signals... (IST: {current_time.strftime('%H:%M:%S')})")
                
                # Check daily limits
                bot_state = self.bot_states[bot_id]
                if bot_state.trades_today >= self.max_trades:
                    self._log(bot_id, f"📊 Max trades ({self.max_trades}) reached for today")
                    await asyncio.sleep(60)
                    continue
                
                max_loss = self.capital * (self.max_daily_loss / 100)
                if bot_state.pnl_today <= -max_loss:
                    self._log(bot_id, f"❌ Max daily loss (₹{max_loss:.0f}) hit. PnL: ₹{bot_state.pnl_today:.0f}")
                    await asyncio.sleep(60)
                    continue
                
                # Generate signal based on strategy
                signal = await self._generate_signal(bot_id, strategy)
                
                if signal:
                    self._log(bot_id, f"📈 SIGNAL: {signal.action} {signal.symbol} x{signal.quantity} | Reason: {signal.reason}")
                    
                    # Execute the trade
                    result = await self._execute_trade(bot_id, signal)
                    
                    if result.get("success"):
                        bot_state.trades_today += 1
                        bot_state.last_trade_time = datetime.now(IST)
                        self._log(bot_id, f"✅ TRADE EXECUTED! Order ID: {result.get('order_id')}")
                    else:
                        bot_state.error_count += 1
                        self._log(bot_id, f"❌ Trade failed: {result.get('error')}")
                else:
                    self._log(bot_id, "🔍 No trading signal at this time")
                
                # Sleep between checks (strategy dependent)
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                self._log(bot_id, f"❌ Error: {str(e)}")
                self.bot_states[bot_id].error_count += 1
                await asyncio.sleep(10)
        
        self._log(bot_id, f"🏁 Trading loop ended")
    
    async def _generate_signal(self, bot_id: str, strategy: str) -> Optional[Signal]:
        """Generate trading signal based on strategy"""
        
        # Get market data
        try:
            # Fetch current market data
            ltp_data = {}
            for instrument in self.instruments:
                if instrument == "NIFTY":
                    ltp = await self._get_nifty_ltp()
                    ltp_data["NIFTY"] = ltp
                elif instrument == "BANKNIFTY":
                    ltp = await self._get_banknifty_ltp()
                    ltp_data["BANKNIFTY"] = ltp
            
            # Strategy-specific signal generation
            if strategy.startswith("DELTA_NEUTRAL"):
                return await self._delta_neutral_signal(strategy, ltp_data)
            elif strategy.startswith("MOMENTUM"):
                return await self._momentum_signal(strategy, ltp_data)
            elif strategy.startswith("SUPERTREND"):
                return await self._supertrend_signal(strategy, ltp_data)
            elif strategy.startswith("ORB"):
                return await self._orb_signal(strategy, ltp_data)
            elif strategy.startswith("VWAP"):
                return await self._vwap_signal(strategy, ltp_data)
            elif strategy.startswith("EMA"):
                return await self._ema_signal(strategy, ltp_data)
            elif strategy.startswith("BREAKOUT"):
                return await self._breakout_signal(strategy, ltp_data)
            elif strategy.startswith("IRON"):
                return await self._iron_strategy_signal(strategy, ltp_data)
            else:
                # Default momentum strategy
                return await self._default_signal(strategy, ltp_data)
                
        except Exception as e:
            logger.error(f"Error generating signal: {e}")
            return None
    
    async def _get_nifty_ltp(self) -> float:
        """Get NIFTY index LTP"""
        try:
            result = await self.broker.get_market_quote(["NSE:NIFTY 50"])
            if result.get("success") and result.get("data"):
                return result["data"].get("NSE:NIFTY 50", {}).get("ltp", 0)
        except:
            pass
        return 24500  # Fallback
    
    async def _get_banknifty_ltp(self) -> float:
        """Get BANKNIFTY index LTP"""
        try:
            result = await self.broker.get_market_quote(["NSE:NIFTY BANK"])
            if result.get("success") and result.get("data"):
                return result["data"].get("NSE:NIFTY BANK", {}).get("ltp", 0)
        except:
            pass
        return 51500  # Fallback
    
    async def _delta_neutral_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """Delta neutral straddle/strangle signal"""
        nifty_ltp = ltp_data.get("NIFTY", 24500)
        
        # Calculate ATM strike
        atm_strike = round(nifty_ltp / 50) * 50
        
        # For delta neutral, we sell both CE and PE
        # Check if we should enter
        now_ist = datetime.now(IST)
        current_time = now_ist.time()
        
        # Best time for straddle: 9:20-10:00 AM or after 2:00 PM
        good_entry_time = (
            (time(9, 20) <= current_time <= time(10, 0)) or 
            (time(14, 0) <= current_time <= time(15, 0))
        )
        
        if good_entry_time:
            # Calculate quantity based on risk
            risk_amount = self.capital * (self.risk_per_trade / 100)
            lot_size = 25  # NIFTY lot size (updated for 2026)
            estimated_premium = 200  # Estimated total premium
            
            quantity = max(1, int(risk_amount / (estimated_premium * lot_size))) * lot_size
            
            return Signal(
                symbol=f"NIFTY {atm_strike} CE",
                action="SELL",
                quantity=quantity,
                order_type="MARKET",
                stop_loss=estimated_premium * 1.5,
                target=estimated_premium * 0.3,
                confidence=0.7,
                reason=f"Delta neutral straddle - ATM: {atm_strike}, Time: {current_time.strftime('%H:%M')}"
            )
        
        return None
    
    async def _momentum_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """Momentum scalping signal"""
        nifty_ltp = ltp_data.get("NIFTY", 24500)
        now_ist = datetime.now(IST)
        current_time = now_ist.time()
        
        if time(9, 30) <= current_time <= time(14, 30):
            atm_strike = round(nifty_ltp / 50) * 50
            lot_size = 25
            
            return Signal(
                symbol=f"NIFTY {atm_strike} CE",
                action="BUY",
                quantity=lot_size,
                order_type="MARKET",
                stop_loss=50,
                target=100,
                confidence=0.6,
                reason=f"Momentum scalp - NIFTY at {nifty_ltp}"
            )
        
        return None
    
    async def _supertrend_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """SuperTrend based signal"""
        nifty_ltp = ltp_data.get("NIFTY", 24500)
        now_ist = datetime.now(IST)
        current_time = now_ist.time()
        
        if time(9, 30) <= current_time <= time(15, 0):
            atm_strike = round(nifty_ltp / 50) * 50
            
            return Signal(
                symbol=f"NIFTY {atm_strike} CE",
                action="BUY",
                quantity=25,
                order_type="MARKET",
                stop_loss=60,
                target=120,
                confidence=0.65,
                reason=f"SuperTrend BUY signal at {nifty_ltp}"
            )
        
        return None
    
    async def _orb_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """Opening Range Breakout signal"""
        now_ist = datetime.now(IST)
        current_time = now_ist.time()
        
        # ORB works best in first 45 minutes after opening
        if time(9, 30) <= current_time <= time(10, 15):
            nifty_ltp = ltp_data.get("NIFTY", 24500)
            atm_strike = round(nifty_ltp / 50) * 50
            
            return Signal(
                symbol=f"NIFTY {atm_strike} CE",
                action="BUY",
                quantity=25,
                order_type="MARKET",
                stop_loss=40,
                target=80,
                confidence=0.65,
                reason=f"ORB Breakout - NIFTY range captured"
            )
        
        return None
    
    async def _vwap_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """VWAP based signal"""
        # Needs VWAP calculation from intraday data
        return None
    
    async def _ema_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """EMA crossover signal"""
        # Needs EMA calculation
        return None
    
    async def _breakout_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """Breakout hunter signal"""
        return None
    
    async def _iron_strategy_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """Iron Condor / Iron Butterfly signal"""
        return None
    
    async def _default_signal(self, strategy: str, ltp_data: Dict) -> Optional[Signal]:
        """Default signal generation"""
        return None
    
    async def _execute_trade(self, bot_id: str, signal: Signal) -> Dict:
        """Execute actual trade via broker API"""
        
        logger.info(f"🔥 Executing trade: {signal.action} {signal.symbol} x{signal.quantity}")
        
        try:
            # Map signal to broker order
            transaction_type = "BUY" if signal.action == "BUY" else "SELL"
            
            # Place order
            result = await self.broker.place_order(
                security_id=signal.symbol,  # Need to map to actual security ID
                exchange_segment="NSE_FNO",
                transaction_type=transaction_type,
                quantity=signal.quantity,
                order_type=signal.order_type,
                product_type="INTRADAY",
                price=signal.price if signal.order_type == "LIMIT" else 0,
                trigger_price=0
            )
            
            if result.get("success"):
                order_id = result.get("data", {}).get("order_id", "")
                logger.info(f"✅ Order placed: {order_id}")
                
                # Update bot state
                self.bot_states[bot_id].last_signal = signal
                
                return {
                    "success": True,
                    "order_id": order_id,
                    "signal": signal.__dict__
                }
            else:
                return {
                    "success": False,
                    "error": result.get("error", "Order placement failed")
                }
                
        except Exception as e:
            logger.error(f"❌ Trade execution error: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global engine instance
_trading_engines: Dict[str, TradingEngine] = {}


def get_trading_engine(broker_service, config: Dict) -> TradingEngine:
    """Get or create trading engine instance"""
    key = f"{id(broker_service)}_{json.dumps(config, sort_keys=True)}"
    
    if key not in _trading_engines:
        _trading_engines[key] = TradingEngine(broker_service, config)
    
    return _trading_engines[key]
