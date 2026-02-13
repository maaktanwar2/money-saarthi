# backend/services/vwap_trading_bot.py
"""
VWAP Momentum Auto Trading Bot (ChartInk Strategy)
Automatically takes trades based on VWAP momentum signals

Uses: 10-MINUTE CANDLES (as per ChartInk scan)

NIFTY 200 Universe Stock Passes:
═══════════════════════════════════════════════════════════

Strategy (ChartInk-based):
BULLISH Entry (LONG):
1. [-1] 10min Close > [-1] 10min VWAP (previous candle above VWAP)
2. [-2] 10min Close > [-2] 10min VWAP (2 candles ago above VWAP)
3. [-2] 10min Close > [-1] 10min High (pullback entry - strong previous move)

BEARISH Entry (SHORT):
1. [-1] 10min Close < [-1] 10min VWAP (previous candle below VWAP)
2. [-2] 10min Close < [-2] 10min VWAP (2 candles ago below VWAP)
3. [-2] 10min Close < [-1] 10min Low (pullback entry - weak previous move)

Position Management:
- Max positions: 3 at a time
- STOP LOSS: Previous candle's LOW (LONG) / HIGH (SHORT)
- Target: 2:1 Risk-Reward ratio
- Square off at 15:15
"""

import asyncio
import logging
from datetime import datetime, time, timezone, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
import json

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now() -> datetime:
    """Get current time in IST"""
    return datetime.now(IST)

# Import mock data service for testing
from .mock_data_service import get_mock_service, MarketScenario

logger = logging.getLogger(__name__)


class BotStatus(Enum):
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


class TradeDirection(Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class VWAPTradingBot:
    """
    Automated VWAP Momentum Trading Bot (ChartInk Strategy)
    
    Uses 10-minute candles with ChartInk conditions:
    
    BULLISH Entry (LONG):
    1. [-1] 10min Close > [-1] 10min VWAP
    2. [-2] 10min Close > [-2] 10min VWAP
    3. [-2] 10min Close > [-1] 10min High (pullback - strong 2 candles ago)
    
    BEARISH Entry (SHORT):
    1. [-1] 10min Close < [-1] 10min VWAP
    2. [-2] 10min Close < [-2] 10min VWAP
    3. [-2] 10min Close < [-1] 10min Low (pullback - weak 2 candles ago)
    
    Position Management:
    - Max positions: 3 at a time
    - Position size: 2% of capital per trade
    - STOP LOSS: Previous candle LOW (LONG) / HIGH (SHORT)
    - Target: 2:1 Risk-Reward ratio
    - Square off at 15:15
    """
    
    def __init__(self, broker_service=None, unified_service=None):
        self.broker_service = broker_service
        self.broker_type = "dhan"  # Default broker type
        self.unified_service = unified_service
        
        # Bot state
        self.status = BotStatus.STOPPED
        self.is_running = False
        self.scan_task = None
        
        # Mock mode for testing
        self.mock_mode = False
        self.mock_scenario = MarketScenario.RANDOM
        self.mock_service = None
        
        # Trading configuration
        self.config = {
            "capital": 100000,              # Total capital
            "risk_per_trade": 2.0,          # Risk % per trade
            "max_positions": 3,             # Max concurrent positions
            "min_score": 70,                # Minimum VWAP score
            "min_volume_ratio": 1.0,        # Minimum volume multiplier (1.0 = no filter, NSE doesn't provide avg)
            "mode": "both",                 # bullish, bearish, or both
            "scan_interval": 60,            # Scan every 60 seconds
            "market_start": "09:20",        # Start trading time
            "market_end": "15:00",          # Stop new entries
            "square_off_time": "15:15",     # Square off all positions
            "allowed_stocks": [],           # Empty = all F&O stocks
            "blocked_stocks": [],           # Stocks to avoid
            # Candle timeframe
            "candle_interval": 10,          # 10-minute candles (ChartInk default)
            # Stop Loss Settings
            "stoploss_type": "prev_candle", # "prev_candle" (default) or "percent"
            "stop_loss_percent": 1.0,       # Stop loss % (only if stoploss_type=percent)
            # Target Settings
            "target_type": "risk_reward",   # "risk_reward" (default) or "percent"
            "target_rr_ratio": 2.0,         # Target = 2x Risk (2:1 R:R)
            "target_percent": 2.0,          # Target profit % (only if target_type=percent)
            "use_atr_targets": False,       # Use ATR-based targets (not recommended)
            "target_1_atr": 1.5,            # Target 1 in ATR multiples (if enabled)
            "target_2_atr": 2.5,            # Target 2 in ATR multiples (if enabled)
            # Trailing Stop Loss Settings
            "trailing_sl_enabled": False,   # Enable trailing stop loss
            "trailing_sl_activation": 1.0,  # Activate trailing after X% profit
            "trailing_sl_distance": 0.5,    # Trail at X% below high
        }
        
        # Active positions
        self.positions: Dict[str, Dict] = {}
        
        # Trade history
        self.trades: List[Dict] = []
        
        # Session stats
        self.session_stats = {
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "total_pnl": 0,
            "max_drawdown": 0,
            "started_at": None,
            "last_scan": None,
            "signals_found": 0,
            "trades_taken": 0,
            "trades_skipped": 0,
        }
        
        # Pending signals queue
        self.pending_signals: List[Dict] = []
        
        logger.info("VWAP Trading Bot initialized")
    
    def configure(self, config: Dict) -> Dict:
        """Update bot configuration"""
        for key, value in config.items():
            if key in self.config:
                self.config[key] = value
                logger.info(f"Config updated: {key} = {value}")
        
        return {"status": "success", "config": self.config}
    
    def get_config(self) -> Dict:
        """Get current configuration"""
        return self.config.copy()
    
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
            logger.info(f"🧪 Mock mode enabled with scenario: {self.mock_scenario.value}")
            return {"status": "success", "message": f"Mock mode enabled: {scenario}", "mock_mode": True}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def disable_mock_mode(self) -> Dict:
        """Disable mock mode"""
        self.mock_mode = False
        self.mock_service = None
        logger.info("🔌 Mock mode disabled - using real market data")
        return {"status": "success", "message": "Mock mode disabled", "mock_mode": False}
    
    async def start(self, broker_token: str = None, user_id: str = None, mock_mode: bool = False, scenario: str = "random") -> Dict:
        """Start the trading bot"""
        try:
            if self.is_running:
                # Already running - return success with current status instead of error
                return {
                    "status": "success",
                    "message": "Bot is already running",
                    "already_running": True,
                    "config": self.config,
                    "started_at": self.session_stats.get("started_at"),
                    "mock_mode": self.mock_mode
                }
            
            # Enable mock mode if requested
            if mock_mode:
                self.enable_mock_mode(scenario)
            
            # Validate broker connection (not required in mock mode)
            if not broker_token and not self.mock_mode:
                return {"status": "error", "message": "Broker token required (or use mock_mode=true)"}
            
            self.broker_token = broker_token
            self.user_id = user_id
            
            # Initialize session stats
            self.session_stats = {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "total_pnl": 0,
                "max_drawdown": 0,
                "started_at": datetime.now().isoformat(),
                "last_scan": None,
                "signals_found": 0,
                "trades_taken": 0,
                "trades_skipped": 0,
            }
            
            self.is_running = True
            self.status = BotStatus.RUNNING
            
            # Start scanning loop
            self.scan_task = asyncio.create_task(self._scan_loop())
            
            logger.info(f"🤖 VWAP Bot started for user {user_id} (mock_mode={self.mock_mode})")
            
            return {
                "status": "success",
                "message": f"VWAP Trading Bot started{' [MOCK MODE]' if self.mock_mode else ''}",
                "config": self.config,
                "started_at": self.session_stats["started_at"],
                "mock_mode": self.mock_mode,
                "scenario": self.mock_scenario.value if self.mock_mode else None
            }
            
        except Exception as e:
            logger.error(f"Failed to start VWAP bot: {e}")
            self.status = BotStatus.ERROR
            return {"status": "error", "message": str(e)}
    
    async def stop(self) -> Dict:
        """Stop the trading bot"""
        try:
            if not self.is_running:
                return {"status": "error", "message": "Bot is not running"}
            
            self.is_running = False
            self.status = BotStatus.STOPPED
            
            # Cancel scan task
            if self.scan_task:
                self.scan_task.cancel()
                try:
                    await self.scan_task
                except asyncio.CancelledError:
                    pass
            
            # Calculate final stats
            final_stats = self._calculate_session_stats()
            
            logger.info(f"🛑 VWAP Bot stopped. P&L: ₹{final_stats['total_pnl']:.2f}")
            
            return {
                "status": "success",
                "message": "VWAP Trading Bot stopped",
                "session_stats": final_stats,
                "positions": list(self.positions.values()),
                "trades": self.trades[-10:]  # Last 10 trades
            }
            
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")
            return {"status": "error", "message": str(e)}
    
    def pause(self) -> Dict:
        """Pause the bot (no new entries)"""
        if self.status == BotStatus.RUNNING:
            self.status = BotStatus.PAUSED
            return {"status": "success", "message": "Bot paused - no new entries"}
        return {"status": "error", "message": "Bot is not running"}
    
    def resume(self) -> Dict:
        """Resume the bot"""
        if self.status == BotStatus.PAUSED:
            self.status = BotStatus.RUNNING
            return {"status": "success", "message": "Bot resumed"}
        return {"status": "error", "message": "Bot is not paused"}
    
    def get_status(self) -> Dict:
        """Get bot status and stats"""
        return {
            "status": self.status.value,
            "is_running": self.is_running,
            "mock_mode": self.mock_mode,
            "scenario": self.mock_scenario.value if self.mock_mode else None,
            "config": self.config,
            "session_stats": self._calculate_session_stats(),
            "active_positions": len(self.positions),
            "positions": list(self.positions.values()),
            "pending_signals": len(self.pending_signals),
            "recent_trades": self.trades[-5:],
            "timestamp": datetime.now().isoformat()
        }
    
    async def scan_once(self) -> Dict:
        """
        Run one scan iteration manually.
        Use this when background loop can't run (e.g., serverless environments).
        """
        try:
            if not self.is_running:
                return {"status": "error", "message": "Bot not running. Start bot first."}
            
            logger.info(f"🔍 Manual scan triggered (mock_mode={self.mock_mode})")
            
            # Run VWAP momentum scan
            signals = await self._scan_vwap_momentum()
            self.session_stats["last_scan"] = datetime.now().isoformat()
            self.session_stats["signals_found"] += len(signals)
            
            trades_executed = []
            
            # Process signals
            for signal in signals:
                result = await self._process_signal(signal)
                if result and result.get("traded"):
                    trades_executed.append(result)
            
            # Manage existing positions
            exits = await self._manage_positions()
            
            return {
                "status": "success",
                "signals_found": len(signals),
                "trades_executed": len(trades_executed),
                "trades": trades_executed,
                "positions_managed": len(self.positions),
                "exits": exits if exits else [],
                "mock_mode": self.mock_mode,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Scan once error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _scan_loop(self):
        """Main scanning loop"""
        logger.info(f"🔍 VWAP scan loop started (mock_mode={self.mock_mode})")
        
        while self.is_running:
            try:
                # Check market hours (skip in mock mode - allow testing anytime)
                if not self.mock_mode and not self._is_market_hours():
                    logger.debug("Outside market hours, waiting...")
                    await asyncio.sleep(60)
                    continue
                
                # Check if paused
                if self.status == BotStatus.PAUSED:
                    await asyncio.sleep(10)
                    continue
                
                # Run VWAP momentum scan
                signals = await self._scan_vwap_momentum()
                self.session_stats["last_scan"] = datetime.now().isoformat()
                self.session_stats["signals_found"] += len(signals)
                
                # Process signals
                for signal in signals:
                    await self._process_signal(signal)
                
                # Check and manage existing positions
                await self._manage_positions()
                
                # Check for square-off time (skip in mock mode)
                if not self.mock_mode and self._is_square_off_time():
                    await self._square_off_all()
                
                # Wait for next scan
                await asyncio.sleep(self.config["scan_interval"])
                
            except asyncio.CancelledError:
                logger.info("Scan loop cancelled")
                break
            except Exception as e:
                logger.error(f"Scan loop error: {e}")
                await asyncio.sleep(30)
    
    async def _scan_vwap_momentum(self) -> List[Dict]:
        """Scan for VWAP momentum signals"""
        try:
            signals = []
            
            # Use mock data if in mock mode
            if self.mock_mode and self.mock_service:
                mock_signals = self.mock_service.get_vwap_momentum_signals(self.config["min_score"])
                
                # Combine bullish and bearish signals based on mode
                combined = []
                if self.config["mode"] in ["both", "bullish"]:
                    for sig in mock_signals.get("bullish", []):
                        if sig["volume_ratio"] >= self.config["min_volume_ratio"]:
                            if sig["symbol"] not in self.positions:
                                # Convert to signal format
                                price = sig["ltp"]
                                atr = price * 0.015
                                
                                # Use ATR or percentage-based targets
                                if self.config.get("use_atr_targets", True):
                                    target_1 = price + atr * self.config.get("target_1_atr", 1.5)
                                    target_2 = price + atr * self.config.get("target_2_atr", 2.5)
                                    stop_loss = sig["vwap"] * (1 - self.config.get("stop_loss_percent", 1.0) / 100)
                                else:
                                    target_1 = price * (1 + self.config.get("target_percent", 2.0) / 100)
                                    target_2 = price * (1 + self.config.get("target_percent", 2.0) * 1.5 / 100)
                                    stop_loss = price * (1 - self.config.get("stop_loss_percent", 1.0) / 100)
                                
                                combined.append({
                                    "symbol": sig["symbol"],
                                    "name": sig["symbol"],
                                    "direction": "LONG",
                                    "score": sig["score"],
                                    "price": price,
                                    "vwap": sig["vwap"],
                                    "change_pct": sig["change_pct"],
                                    "volume_ratio": sig["volume_ratio"],
                                    "range_position": sig["range_position"],
                                    "entry": price,
                                    "stop_loss": stop_loss,
                                    "target_1": target_1,
                                    "target_2": target_2,
                                    "quantity": self._calculate_quantity(price, atr * 0.5),
                                    "timestamp": datetime.now().isoformat(),
                                    "mock": True
                                })
                
                if self.config["mode"] in ["both", "bearish"]:
                    for sig in mock_signals.get("bearish", []):
                        if sig["volume_ratio"] >= self.config["min_volume_ratio"]:
                            if sig["symbol"] not in self.positions:
                                price = sig["ltp"]
                                atr = price * 0.015
                                
                                # Use ATR or percentage-based targets
                                if self.config.get("use_atr_targets", True):
                                    target_1 = price - atr * self.config.get("target_1_atr", 1.5)
                                    target_2 = price - atr * self.config.get("target_2_atr", 2.5)
                                    stop_loss = sig["vwap"] * (1 + self.config.get("stop_loss_percent", 1.0) / 100)
                                else:
                                    target_1 = price * (1 - self.config.get("target_percent", 2.0) / 100)
                                    target_2 = price * (1 - self.config.get("target_percent", 2.0) * 1.5 / 100)
                                    stop_loss = price * (1 + self.config.get("stop_loss_percent", 1.0) / 100)
                                
                                combined.append({
                                    "symbol": sig["symbol"],
                                    "name": sig["symbol"],
                                    "direction": "SHORT",
                                    "score": sig["score"],
                                    "price": price,
                                    "vwap": sig["vwap"],
                                    "change_pct": sig["change_pct"],
                                    "volume_ratio": sig["volume_ratio"],
                                    "range_position": sig["range_position"],
                                    "entry": price,
                                    "stop_loss": stop_loss,
                                    "target_1": target_1,
                                    "target_2": target_2,
                                    "quantity": self._calculate_quantity(price, atr * 0.5),
                                    "timestamp": datetime.now().isoformat(),
                                    "mock": True
                                })
                
                combined.sort(key=lambda x: x["score"], reverse=True)
                logger.info(f"📊 [MOCK] VWAP Scan: Found {len(combined)} signals")
                return combined[:10]
            
            # Real market data path - use broker service (Dhan/Upstox)
            if self.broker_service:
                try:
                    # Dhan has get_all_stocks_data method
                    if hasattr(self.broker_service, 'get_all_stocks_data'):
                        all_stocks = await self.broker_service.get_all_stocks_data()
                        logger.info(f"📡 Got {len(all_stocks)} stocks from broker (Dhan)")
                    else:
                        logger.warning("Broker service doesn't have get_all_stocks_data method")
                        all_stocks = []
                except Exception as broker_err:
                    logger.error(f"Error fetching from broker: {broker_err}")
                    all_stocks = []
            elif self.unified_service:
                # Fallback to unified service
                try:
                    await self.unified_service.fetch_all_stocks(force=True)
                    all_stocks = self.unified_service.get_all_stocks()
                    logger.debug("📡 Fetched from unified service (fallback)")
                except Exception as fetch_err:
                    logger.warning(f"Could not fetch from unified service: {fetch_err}")
                    all_stocks = []
            else:
                logger.warning("No data service available (broker or unified)")
                return signals
            
            if not all_stocks:
                logger.warning("No stocks data available")
                return signals
            
            for stock in all_stocks:
                try:
                    symbol = stock.get("symbol", "")
                    
                    # Skip blocked stocks
                    if symbol in self.config["blocked_stocks"]:
                        continue
                    
                    # Check allowed stocks filter
                    if self.config["allowed_stocks"] and symbol not in self.config["allowed_stocks"]:
                        continue
                    
                    # Skip if already in position
                    if symbol in self.positions:
                        continue
                    
                    # Calculate VWAP signal
                    signal = self._calculate_vwap_signal(stock)
                    
                    if signal and signal["score"] >= self.config["min_score"]:
                        if signal["volume_ratio"] >= self.config["min_volume_ratio"]:
                            # Check mode filter
                            if self.config["mode"] == "both" or \
                               (self.config["mode"] == "bullish" and signal["direction"] == "LONG") or \
                               (self.config["mode"] == "bearish" and signal["direction"] == "SHORT"):
                                signals.append(signal)
                
                except Exception as e:
                    logger.debug(f"Signal calc error for {stock.get('symbol')}: {e}")
            
            # Sort by score and return top signals
            signals.sort(key=lambda x: x["score"], reverse=True)
            
            logger.info(f"📊 VWAP Scan: Found {len(signals)} signals")
            return signals[:10]  # Top 10 signals
            
        except Exception as e:
            logger.error(f"VWAP scan error: {e}")
            return []
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CHARTINK CANDLE-BASED SIGNAL DETECTION
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _calculate_vwap_from_candles(self, candles: List[Dict], idx: int) -> float:
        """Calculate VWAP from candle data up to given index"""
        if idx < 0:
            return 0
        
        total_tp_vol = 0
        total_vol = 0
        
        for i in range(idx + 1):
            c = candles[i]
            high = float(c.get("high", 0))
            low = float(c.get("low", 0))
            close = float(c.get("close", 0))
            volume = float(c.get("volume", 1))
            
            # Skip if no volume
            if volume <= 0:
                volume = 1
            
            typical_price = (high + low + close) / 3
            total_tp_vol += typical_price * volume
            total_vol += volume
        
        return total_tp_vol / total_vol if total_vol > 0 else 0
    
    def _check_chartink_signal(self, candles: List[Dict]) -> Optional[Dict]:
        """
        Check ChartInk VWAP momentum conditions on candle data
        
        Returns signal dict if conditions met, None otherwise
        
        BULLISH (LONG):
        1. [-1] Close > [-1] VWAP
        2. [-2] Close > [-2] VWAP
        3. [-2] Close > [-1] High (pullback entry)
        
        BEARISH (SHORT):
        1. [-1] Close < [-1] VWAP
        2. [-2] Close < [-2] VWAP
        3. [-2] Close < [-1] Low (pullback entry)
        """
        if len(candles) < 3:
            return None
        
        # Get last 3 candles (we need [-1] and [-2])
        current = candles[-1]   # [0] - current candle (for entry price)
        prev = candles[-2]      # [-1] - previous candle
        prev2 = candles[-3]     # [-2] - 2 candles ago
        
        # Calculate VWAP for each candle
        vwap_prev = self._calculate_vwap_from_candles(candles[:-1], len(candles) - 2)
        vwap_prev2 = self._calculate_vwap_from_candles(candles[:-2], len(candles) - 3)
        
        if vwap_prev == 0 or vwap_prev2 == 0:
            return None
        
        # Get prices
        prev_close = float(prev.get("close", 0))
        prev_high = float(prev.get("high", 0))
        prev_low = float(prev.get("low", 0))
        prev2_close = float(prev2.get("close", 0))
        current_close = float(current.get("close", 0))
        
        # BULLISH conditions (ChartInk exact)
        bullish = (
            prev_close > vwap_prev and          # [-1] Close > [-1] VWAP
            prev2_close > vwap_prev2 and        # [-2] Close > [-2] VWAP
            prev2_close > prev_high             # [-2] Close > [-1] High
        )
        
        # BEARISH conditions (ChartInk exact)
        bearish = (
            prev_close < vwap_prev and          # [-1] Close < [-1] VWAP
            prev2_close < vwap_prev2 and        # [-2] Close < [-2] VWAP
            prev2_close < prev_low              # [-2] Close < [-1] Low
        )
        
        if bullish:
            entry_price = current_close
            # STOP LOSS = Previous candle's LOW (for LONG)
            stop_loss = prev_low
            # Calculate target based on risk-reward (2:1 by default)
            risk = entry_price - stop_loss
            target = entry_price + (risk * 2)  # 2:1 R:R
            
            return {
                "direction": "LONG",
                "entry": entry_price,
                "stop_loss": stop_loss,
                "stop_loss_type": "PREV_CANDLE_LOW",
                "target_1": target,
                "target_2": entry_price + (risk * 3),  # 3:1 R:R
                "vwap": vwap_prev,
                "prev_close": prev_close,
                "prev2_close": prev2_close,
                "prev_high": prev_high,
                "prev_low": prev_low,
                "risk_points": round(risk, 2),
                "signal_type": "CHARTINK_BULLISH"
            }
        
        if bearish:
            entry_price = current_close
            # STOP LOSS = Previous candle's HIGH (for SHORT)
            stop_loss = prev_high
            # Calculate target based on risk-reward (2:1 by default)
            risk = stop_loss - entry_price
            target = entry_price - (risk * 2)  # 2:1 R:R
            
            return {
                "direction": "SHORT",
                "entry": entry_price,
                "stop_loss": stop_loss,
                "stop_loss_type": "PREV_CANDLE_HIGH",
                "target_1": target,
                "target_2": entry_price - (risk * 3),  # 3:1 R:R
                "vwap": vwap_prev,
                "prev_close": prev_close,
                "prev2_close": prev2_close,
                "prev_high": prev_high,
                "prev_low": prev_low,
                "risk_points": round(risk, 2),
                "signal_type": "CHARTINK_BEARISH"
            }
        
        return None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SCORE-BASED SIGNAL (FALLBACK FOR MOCK/TICK DATA)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _calculate_vwap_signal(self, stock: Dict) -> Optional[Dict]:
        """Calculate VWAP momentum signal for a stock (score-based fallback)"""
        try:
            price = float(stock.get("ltp", 0))
            change_pct = float(stock.get("change_pct", 0))
            volume_ratio = float(stock.get("volume_ratio", 1))
            day_high = float(stock.get("high", price))
            day_low = float(stock.get("low", price))
            open_price = float(stock.get("open", price))
            
            if price <= 0:
                return None
            
            # Calculate VWAP estimate
            typical_price = (day_high + day_low + price) / 3
            vwap = typical_price
            
            # Day range position
            day_range = max(day_high - day_low, price * 0.001)
            range_position = (price - day_low) / day_range if day_range > 0 else 0.5
            
            # ═══════════════════════════════════════════════════════════════
            # BULLISH SCORING
            # ═══════════════════════════════════════════════════════════════
            bullish_score = 0
            
            # Price > VWAP
            if price > vwap:
                vwap_premium = ((price - vwap) / vwap * 100)
                if vwap_premium > 1:
                    bullish_score += 25
                elif vwap_premium > 0.3:
                    bullish_score += 18
                else:
                    bullish_score += 10
            
            # Sustained momentum (price > open)
            if price > vwap and price > open_price:
                bullish_score += 20
            elif price > vwap:
                bullish_score += 10
            
            # Near day high
            if range_position > 0.85:
                bullish_score += 20
            elif range_position > 0.7:
                bullish_score += 15
            elif range_position > 0.55:
                bullish_score += 8
            
            # Volume confirmation
            if volume_ratio > 2.0:
                bullish_score += 20
            elif volume_ratio > 1.5:
                bullish_score += 15
            elif volume_ratio > 1.2:
                bullish_score += 10
            
            # Positive change
            if change_pct > 3:
                bullish_score += 15
            elif change_pct > 2:
                bullish_score += 12
            elif change_pct > 1:
                bullish_score += 8
            elif change_pct < -1:
                bullish_score -= 15
            
            # ═══════════════════════════════════════════════════════════════
            # BEARISH SCORING
            # ═══════════════════════════════════════════════════════════════
            bearish_score = 0
            
            # Price < VWAP
            if price < vwap:
                vwap_discount = ((vwap - price) / vwap * 100)
                if vwap_discount > 1:
                    bearish_score += 25
                elif vwap_discount > 0.3:
                    bearish_score += 18
                else:
                    bearish_score += 10
            
            # Sustained weakness
            if price < vwap and price < open_price:
                bearish_score += 20
            elif price < vwap:
                bearish_score += 10
            
            # Near day low
            if range_position < 0.15:
                bearish_score += 20
            elif range_position < 0.3:
                bearish_score += 15
            elif range_position < 0.45:
                bearish_score += 8
            
            # Volume confirmation
            if volume_ratio > 2.0:
                bearish_score += 20
            elif volume_ratio > 1.5:
                bearish_score += 15
            elif volume_ratio > 1.2:
                bearish_score += 10
            
            # Negative change
            if change_pct < -3:
                bearish_score += 15
            elif change_pct < -2:
                bearish_score += 12
            elif change_pct < -1:
                bearish_score += 8
            elif change_pct > 1:
                bearish_score -= 15
            
            # ═══════════════════════════════════════════════════════════════
            # DETERMINE SIGNAL
            # ═══════════════════════════════════════════════════════════════
            if bullish_score >= self.config["min_score"] and bullish_score > bearish_score:
                atr = day_range
                return {
                    "symbol": stock.get("symbol"),
                    "security_id": stock.get("security_id", stock.get("symbol")),
                    "name": stock.get("name", stock.get("symbol")),
                    "direction": "LONG",
                    "score": bullish_score,
                    "price": price,
                    "vwap": vwap,
                    "change_pct": change_pct,
                    "volume_ratio": volume_ratio,
                    "range_position": range_position * 100,
                    "entry": price,
                    "stop_loss": max(vwap, day_low + atr * 0.2),
                    "target_1": price + atr * 1.5,
                    "target_2": price + atr * 2.5,
                    "quantity": self._calculate_quantity(price, abs(price - max(vwap, day_low))),
                    "timestamp": datetime.now().isoformat()
                }
            
            elif bearish_score >= self.config["min_score"] and bearish_score > bullish_score:
                atr = day_range
                return {
                    "symbol": stock.get("symbol"),
                    "security_id": stock.get("security_id", stock.get("symbol")),
                    "name": stock.get("name", stock.get("symbol")),
                    "direction": "SHORT",
                    "score": bearish_score,
                    "price": price,
                    "vwap": vwap,
                    "change_pct": change_pct,
                    "volume_ratio": volume_ratio,
                    "range_position": range_position * 100,
                    "entry": price,
                    "stop_loss": min(vwap, day_high - atr * 0.2),
                    "target_1": price - atr * 1.5,
                    "target_2": price - atr * 2.5,
                    "quantity": self._calculate_quantity(price, abs(price - min(vwap, day_high))),
                    "timestamp": datetime.now().isoformat()
                }
            
            return None
            
        except Exception as e:
            logger.debug(f"Signal calc error: {e}")
            return None
    
    def _calculate_quantity(self, price: float, risk_points: float) -> int:
        """Calculate position size based on risk"""
        try:
            risk_amount = self.config["capital"] * (self.config["risk_per_trade"] / 100)
            
            if risk_points <= 0:
                risk_points = price * 0.02  # Default 2% risk
            
            quantity = int(risk_amount / risk_points)
            
            # Ensure minimum quantity
            quantity = max(1, quantity)
            
            # Cap at reasonable lot size
            max_value = self.config["capital"] * 0.25  # Max 25% of capital
            if quantity * price > max_value:
                quantity = int(max_value / price)
            
            return quantity
            
        except Exception as e:
            logger.error(f"Quantity calc error: {e}")
            return 1
    
    async def _process_signal(self, signal: Dict):
        """Process a trading signal"""
        try:
            symbol = signal["symbol"]
            
            # Check max positions
            if len(self.positions) >= self.config["max_positions"]:
                self.session_stats["trades_skipped"] += 1
                logger.info(f"⏸️ Skipped {symbol} - max positions reached")
                return {"traded": False, "reason": "max_positions"}
            
            # Skip if already in position
            if symbol in self.positions:
                return {"traded": False, "reason": "already_in_position"}
            
            # Execute trade
            trade_result = await self._execute_trade(signal)
            
            if trade_result["status"] == "success":
                self.session_stats["trades_taken"] += 1
                logger.info(f"✅ Trade executed: {signal['direction']} {symbol} @ ₹{signal['price']:.2f}")
                return {
                    "traded": True,
                    "symbol": symbol,
                    "direction": signal["direction"],
                    "price": signal["price"],
                    "quantity": signal["quantity"],
                    "order_id": trade_result["order_id"]
                }
            else:
                self.session_stats["trades_skipped"] += 1
                logger.warning(f"❌ Trade failed for {symbol}: {trade_result.get('message')}")
                return {"traded": False, "reason": trade_result.get("message")}
                
        except Exception as e:
            logger.error(f"Process signal error: {e}")
            return {"traded": False, "reason": str(e)}
                
        except Exception as e:
            logger.error(f"Process signal error: {e}")
    
    async def _execute_trade(self, signal: Dict) -> Dict:
        """Execute a trade through broker"""
        try:
            symbol = signal["symbol"]
            direction = signal["direction"]
            price = signal["price"]
            quantity = signal["quantity"]
            
            order_id = f"VWAP_{symbol}_{datetime.now().strftime('%H%M%S')}"
            
            # In mock mode, simulate the order execution
            if self.mock_mode and self.mock_service:
                # Use mock service to simulate order
                mock_order = self.mock_service.simulate_order_execution(
                    symbol=symbol,
                    side="BUY" if direction == "LONG" else "SELL",
                    quantity=quantity,
                    price=price,
                    order_type="MARKET"
                )
                if not mock_order.get("success"):
                    return {"status": "error", "message": mock_order.get("error", "Mock order failed")}
                order_id = mock_order.get("order_id", order_id)
                logger.info(f"🧪 [MOCK] Order placed: {direction} {symbol} × {quantity} @ ₹{price:.2f}")
            
            # In live mode, call actual broker
            elif self.broker_service and not self.mock_mode:
                try:
                    # Get broker type (default to dhan for backwards compatibility)
                    broker_type = getattr(self, 'broker_type', 'dhan')
                    transaction_type = "BUY" if direction == "LONG" else "SELL"
                    
                    if broker_type == "upstox":
                        # Upstox order placement
                        # Format: NSE_EQ|SYMBOL for equity
                        instrument_token = f"NSE_EQ|{symbol}"
                        order_result = await self.broker_service.place_order(
                            instrument_token=instrument_token,
                            transaction_type=transaction_type,
                            quantity=quantity,
                            order_type="MARKET",
                            product="I",  # Intraday
                            price=0
                        )
                    else:
                        # Dhan order placement - use security_id from signal
                        security_id = signal.get("security_id", symbol)
                        order_result = await self.broker_service.place_order(
                            security_id=security_id,
                            exchange_segment="NSE_EQ",
                            transaction_type=transaction_type,
                            quantity=quantity,
                            order_type="MARKET",
                            product_type="INTRADAY",
                            price=0  # Market order
                        )
                    
                    if order_result.get("success"):
                        order_id = order_result.get("order_id") or order_result.get("data", {}).get("order_id", order_id)
                        logger.info(f"🔥 [LIVE] Order placed: {direction} {symbol} × {quantity} @ ₹{price:.2f}")
                    else:
                        logger.error(f"❌ Live order failed: {order_result}")
                        return {"status": "error", "message": order_result.get("error", "Order failed")}
                except Exception as broker_error:
                    logger.error(f"Broker order error: {broker_error}")
                    return {"status": "error", "message": str(broker_error)}
            else:
                # Paper trading mode (no mock service, no broker)
                logger.info(f"📝 [PAPER] Order simulated: {direction} {symbol} × {quantity} @ ₹{price:.2f}")
            
            # Add to positions
            self.positions[symbol] = {
                "order_id": order_id,
                "symbol": symbol,
                "security_id": signal.get("security_id", symbol),
                "name": signal.get("name", symbol),
                "direction": direction,
                "entry_price": price,
                "quantity": quantity,
                "stop_loss": signal["stop_loss"],
                "target_1": signal["target_1"],
                "target_2": signal["target_2"],
                "current_price": price,
                "unrealized_pnl": 0,
                "score": signal["score"],
                "entry_time": datetime.now().isoformat(),
                "status": "ACTIVE"
            }
            
            # Log trade
            self.trades.append({
                "order_id": order_id,
                "symbol": symbol,
                "direction": direction,
                "entry_price": price,
                "quantity": quantity,
                "stop_loss": signal["stop_loss"],
                "target_1": signal["target_1"],
                "score": signal["score"],
                "entry_time": datetime.now().isoformat(),
                "exit_time": None,
                "exit_price": None,
                "pnl": None,
                "status": "OPEN"
            })
            
            return {"status": "success", "order_id": order_id}
            
        except Exception as e:
            logger.error(f"Execute trade error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _manage_positions(self):
        """Manage existing positions - check SL/targets and trailing SL"""
        exits = []
        try:
            positions_to_close = []
            
            for symbol, position in self.positions.items():
                try:
                    # Get current price - use mock data if in mock mode
                    if self.mock_mode and self.mock_service:
                        stock_data = self.mock_service.get_stock_quote(symbol)
                    elif self.unified_service:
                        stock_data = self.unified_service.get_stock(symbol)
                    else:
                        continue
                    
                    if not stock_data:
                        continue
                    
                    current_price = float(stock_data.get("ltp", position["entry_price"]))
                    position["current_price"] = current_price
                    
                    # Initialize tracking fields if not present
                    if "highest_price" not in position:
                        position["highest_price"] = position["entry_price"]
                    if "lowest_price" not in position:
                        position["lowest_price"] = position["entry_price"]
                    if "trailing_active" not in position:
                        position["trailing_active"] = False
                    
                    # Calculate unrealized P&L
                    if position["direction"] == "LONG":
                        position["unrealized_pnl"] = (current_price - position["entry_price"]) * position["quantity"]
                        pnl_percent = ((current_price - position["entry_price"]) / position["entry_price"]) * 100
                        
                        # Track highest price for trailing
                        if current_price > position["highest_price"]:
                            position["highest_price"] = current_price
                        
                        # Trailing stop loss logic
                        if self.config.get("trailing_sl_enabled", False):
                            activation = self.config.get("trailing_sl_activation", 1.0)
                            distance = self.config.get("trailing_sl_distance", 0.5)
                            
                            # Activate trailing if profit threshold reached
                            if pnl_percent >= activation and not position["trailing_active"]:
                                position["trailing_active"] = True
                                logger.info(f"🎯 {symbol}: Trailing SL activated at {pnl_percent:.2f}% profit")
                            
                            # Update trailing stop if active
                            if position["trailing_active"]:
                                new_trailing_sl = position["highest_price"] * (1 - distance / 100)
                                if new_trailing_sl > position["stop_loss"]:
                                    old_sl = position["stop_loss"]
                                    position["stop_loss"] = new_trailing_sl
                                    logger.info(f"📈 {symbol}: Trailing SL updated ₹{old_sl:.2f} → ₹{new_trailing_sl:.2f}")
                        
                        # Check target (only if not using trailing or trailing not active)
                        target = position.get("target_1", position["entry_price"] * 1.02)
                        if not self.config.get("trailing_sl_enabled") or not position["trailing_active"]:
                            if current_price >= target:
                                positions_to_close.append((symbol, "TARGET_HIT", current_price))
                                continue
                        
                        # Check stop loss
                        if current_price <= position["stop_loss"]:
                            reason = "TRAILING_SL_HIT" if position["trailing_active"] else "SL_HIT"
                            positions_to_close.append((symbol, reason, current_price))
                    
                    else:  # SHORT
                        position["unrealized_pnl"] = (position["entry_price"] - current_price) * position["quantity"]
                        pnl_percent = ((position["entry_price"] - current_price) / position["entry_price"]) * 100
                        
                        # Track lowest price for trailing
                        if current_price < position["lowest_price"]:
                            position["lowest_price"] = current_price
                        
                        # Trailing stop loss logic
                        if self.config.get("trailing_sl_enabled", False):
                            activation = self.config.get("trailing_sl_activation", 1.0)
                            distance = self.config.get("trailing_sl_distance", 0.5)
                            
                            # Activate trailing if profit threshold reached
                            if pnl_percent >= activation and not position["trailing_active"]:
                                position["trailing_active"] = True
                                logger.info(f"🎯 {symbol}: Trailing SL activated at {pnl_percent:.2f}% profit")
                            
                            # Update trailing stop if active
                            if position["trailing_active"]:
                                new_trailing_sl = position["lowest_price"] * (1 + distance / 100)
                                if new_trailing_sl < position["stop_loss"]:
                                    old_sl = position["stop_loss"]
                                    position["stop_loss"] = new_trailing_sl
                                    logger.info(f"📉 {symbol}: Trailing SL updated ₹{old_sl:.2f} → ₹{new_trailing_sl:.2f}")
                        
                        # Check target (only if not using trailing or trailing not active)
                        target = position.get("target_1", position["entry_price"] * 0.98)
                        if not self.config.get("trailing_sl_enabled") or not position["trailing_active"]:
                            if current_price <= target:
                                positions_to_close.append((symbol, "TARGET_HIT", current_price))
                                continue
                        
                        # Check stop loss
                        if current_price >= position["stop_loss"]:
                            reason = "TRAILING_SL_HIT" if position["trailing_active"] else "SL_HIT"
                            positions_to_close.append((symbol, reason, current_price))
                
                except Exception as e:
                    logger.debug(f"Position manage error for {symbol}: {e}")
            
            # Close positions
            for symbol, reason, exit_price in positions_to_close:
                exit_result = await self._close_position(symbol, reason, exit_price)
                if exit_result:
                    exits.append(exit_result)
                
        except Exception as e:
            logger.error(f"Manage positions error: {e}")
        
        return exits
    
    async def _close_position(self, symbol: str, reason: str, exit_price: float):
        """Close a position"""
        try:
            if symbol not in self.positions:
                return None
            
            position = self.positions[symbol]
            quantity = position["quantity"]
            direction = position["direction"]
            
            # Place exit order
            if self.mock_mode and self.mock_service:
                # Mock exit order
                exit_order = self.mock_service.simulate_order_execution(
                    symbol=symbol,
                    side="SELL" if direction == "LONG" else "BUY",
                    quantity=quantity,
                    price=exit_price,
                    order_type="MARKET"
                )
                logger.info(f"🧪 [MOCK] Exit order: {symbol} × {quantity} @ ₹{exit_price:.2f}")
            
            elif self.broker_service and not self.mock_mode:
                # Real broker exit order
                try:
                    broker_type = getattr(self, 'broker_type', 'dhan')
                    transaction_type = "SELL" if direction == "LONG" else "BUY"
                    
                    if broker_type == "upstox":
                        # Upstox exit order
                        instrument_token = f"NSE_EQ|{symbol}"
                        exit_result = await self.broker_service.place_order(
                            instrument_token=instrument_token,
                            transaction_type=transaction_type,
                            quantity=quantity,
                            order_type="MARKET",
                            product="I",  # Intraday
                            price=0
                        )
                    else:
                        # Dhan exit order - use security_id from position
                        security_id = position.get("security_id", symbol)
                        exit_result = await self.broker_service.place_order(
                            security_id=security_id,
                            exchange_segment="NSE_EQ",
                            transaction_type=transaction_type,
                            quantity=quantity,
                            order_type="MARKET",
                            product_type="INTRADAY",
                            price=0
                        )
                    
                    if not exit_result.get("success"):
                        logger.error(f"❌ Live exit order failed: {exit_result}")
                    else:
                        logger.info(f"🔥 [LIVE] Exit order: {symbol} × {quantity} @ ₹{exit_price:.2f}")
                except Exception as broker_error:
                    logger.error(f"Broker exit error: {broker_error}")
            else:
                logger.info(f"📝 [PAPER] Exit: {symbol} × {quantity} @ ₹{exit_price:.2f}")
            
            # Calculate P&L
            if direction == "LONG":
                pnl = (exit_price - position["entry_price"]) * quantity
            else:
                pnl = (position["entry_price"] - exit_price) * quantity
            
            # Update stats
            self.session_stats["total_trades"] += 1
            self.session_stats["total_pnl"] += pnl
            
            if pnl > 0:
                self.session_stats["winning_trades"] += 1
            else:
                self.session_stats["losing_trades"] += 1
            
            # Update trade record
            for trade in self.trades:
                if trade["order_id"] == position["order_id"]:
                    trade["exit_time"] = datetime.now().isoformat()
                    trade["exit_price"] = exit_price
                    trade["pnl"] = pnl
                    trade["status"] = "CLOSED"
                    trade["exit_reason"] = reason
                    break
            
            exit_info = {
                "symbol": symbol,
                "reason": reason,
                "entry_price": position["entry_price"],
                "exit_price": exit_price,
                "pnl": pnl,
                "direction": direction
            }
            
            # Remove from positions
            del self.positions[symbol]
            
            emoji = "✅" if pnl > 0 else "❌"
            logger.info(f"{emoji} Closed {symbol}: {reason} | P&L: ₹{pnl:.2f}")
            
            return exit_info
            
        except Exception as e:
            logger.error(f"Close position error: {e}")
            return None
    
    async def _square_off_all(self):
        """Square off all positions at end of day"""
        try:
            logger.info("🔔 Square-off time - closing all positions")
            
            for symbol in list(self.positions.keys()):
                position = self.positions[symbol]
                await self._close_position(symbol, "EOD_SQUAREOFF", position["current_price"])
            
        except Exception as e:
            logger.error(f"Square off error: {e}")
    
    def _is_market_hours(self) -> bool:
        """Check if within market hours (IST)"""
        # In mock mode, always return True to allow testing anytime
        if self.mock_mode:
            return True
        now = get_ist_now().time()
        start = time(*map(int, self.config["market_start"].split(":")))
        end = time(*map(int, self.config["market_end"].split(":")))
        is_in_hours = start <= now <= end
        logger.debug(f"Market hours check: IST={now}, start={start}, end={end}, in_hours={is_in_hours}")
        return is_in_hours
    
    def _is_square_off_time(self) -> bool:
        """Check if it's square-off time (IST)"""
        # In mock mode, never auto square-off
        if self.mock_mode:
            return False
        now = get_ist_now().time()
        square_off = time(*map(int, self.config["square_off_time"].split(":")))
        return now >= square_off
    
    def _calculate_session_stats(self) -> Dict:
        """Calculate session statistics"""
        stats = self.session_stats.copy()
        
        # Add calculated metrics
        total_trades = stats["total_trades"]
        if total_trades > 0:
            stats["win_rate"] = round((stats["winning_trades"] / total_trades) * 100, 1)
            stats["avg_pnl_per_trade"] = round(stats["total_pnl"] / total_trades, 2)
        else:
            stats["win_rate"] = 0
            stats["avg_pnl_per_trade"] = 0
        
        # Current unrealized P&L
        unrealized_pnl = sum(p.get("unrealized_pnl", 0) for p in self.positions.values())
        stats["unrealized_pnl"] = round(unrealized_pnl, 2)
        stats["net_pnl"] = round(stats["total_pnl"] + unrealized_pnl, 2)
        
        return stats
    
    # Manual trade entry
    async def manual_entry(self, symbol: str, direction: str, quantity: int = None) -> Dict:
        """Manually enter a trade"""
        try:
            if symbol in self.positions:
                return {"status": "error", "message": f"Already in position for {symbol}"}
            
            if not self.unified_service:
                return {"status": "error", "message": "Data service not available"}
            
            stock = self.unified_service.get_stock(symbol)
            if not stock:
                return {"status": "error", "message": f"Stock {symbol} not found"}
            
            price = float(stock.get("ltp", 0))
            day_high = float(stock.get("high", price))
            day_low = float(stock.get("low", price))
            atr = day_high - day_low
            
            if direction.upper() == "LONG":
                stop_loss = day_low - atr * 0.1
                target_1 = price + atr * 1.5
                target_2 = price + atr * 2.5
            else:
                stop_loss = day_high + atr * 0.1
                target_1 = price - atr * 1.5
                target_2 = price - atr * 2.5
            
            quantity = quantity or self._calculate_quantity(price, abs(price - stop_loss))
            
            signal = {
                "symbol": symbol,
                "name": stock.get("name", symbol),
                "direction": direction.upper(),
                "score": 100,  # Manual entry
                "price": price,
                "vwap": (day_high + day_low + price) / 3,
                "entry": price,
                "stop_loss": stop_loss,
                "target_1": target_1,
                "target_2": target_2,
                "quantity": quantity,
                "volume_ratio": float(stock.get("volume_ratio", 1)),
            }
            
            result = await self._execute_trade(signal)
            
            if result["status"] == "success":
                return {
                    "status": "success",
                    "message": f"Manual {direction} entry for {symbol}",
                    "position": self.positions.get(symbol)
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Manual entry error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def manual_exit(self, symbol: str) -> Dict:
        """Manually exit a position"""
        try:
            if symbol not in self.positions:
                return {"status": "error", "message": f"No position for {symbol}"}
            
            position = self.positions[symbol]
            await self._close_position(symbol, "MANUAL_EXIT", position["current_price"])
            
            return {
                "status": "success",
                "message": f"Exited {symbol}",
                "pnl": self.trades[-1]["pnl"] if self.trades else 0
            }
            
        except Exception as e:
            logger.error(f"Manual exit error: {e}")
            return {"status": "error", "message": str(e)}

    # ═══════════════════════════════════════════════════════════════════════════
    # BACKTESTING WITH REAL DHAN DATA
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _aggregate_to_10min(self, candles_5min: List[Dict]) -> List[Dict]:
        """Aggregate 5-minute candles to 10-minute candles"""
        if not candles_5min:
            return []
        
        candles_10min = []
        i = 0
        
        while i < len(candles_5min) - 1:
            c1 = candles_5min[i]
            c2 = candles_5min[i + 1]
            
            # Combine two 5-min candles
            candles_10min.append({
                "datetime": c1.get("datetime", ""),
                "timestamp": c1.get("timestamp", 0),
                "open": c1.get("open", 0),
                "high": max(c1.get("high", 0), c2.get("high", 0)),
                "low": min(c1.get("low", 0), c2.get("low", 0)),
                "close": c2.get("close", 0),
                "volume": c1.get("volume", 0) + c2.get("volume", 0)
            })
            i += 2
        
        return candles_10min
    
    def _calculate_vwap_cumulative(self, candles: List[Dict], idx: int) -> float:
        """Calculate cumulative VWAP from day start to given candle index"""
        if idx < 0 or not candles:
            return 0
        
        total_tp_vol = 0
        total_vol = 0
        
        for i in range(idx + 1):
            c = candles[i]
            high = float(c.get("high", 0))
            low = float(c.get("low", 0))
            close = float(c.get("close", 0))
            volume = float(c.get("volume", 1))
            
            if volume <= 0:
                volume = 1
            
            typical_price = (high + low + close) / 3
            total_tp_vol += typical_price * volume
            total_vol += volume
        
        return total_tp_vol / total_vol if total_vol > 0 else 0
    
    async def backtest_vwap_strategy(
        self,
        symbol: str,
        from_date: str,
        to_date: str,
        capital: float = 100000,
        risk_per_trade: float = 2.0,
        target_rr: float = 2.0
    ) -> Dict:
        """
        Backtest VWAP strategy with REAL Dhan data
        
        Args:
            symbol: Stock symbol (e.g., "RELIANCE", "TCS", "NIFTY")
            from_date: Start date "YYYY-MM-DD"
            to_date: End date "YYYY-MM-DD"
            capital: Starting capital
            risk_per_trade: Risk % per trade
            target_rr: Target Risk-Reward ratio (2.0 = 2:1)
        
        Returns:
            Backtest results with trades, metrics, and equity curve
        """
        try:
            logger.info(f"🔄 Starting VWAP backtest for {symbol} from {from_date} to {to_date}")
            
            # Use DhanUnifiedService directly for historical data
            from services.dhan_unified_service import get_dhan_unified_service
            dhan_service = get_dhan_unified_service()
            
            if not dhan_service:
                return {"status": "error", "message": "Dhan service not available for backtest"}
            
            # Fetch 5-minute candles from Dhan
            from_datetime = f"{from_date} 09:15:00"
            to_datetime = f"{to_date} 15:30:00"
            
            candles_5min = await dhan_service.get_historical_intraday(
                symbol=symbol,
                from_date=from_datetime,
                to_date=to_datetime,
                interval="5"  # 5-minute candles
            )
            
            if not candles_5min:
                return {"status": "error", "message": f"No data available for {symbol}"}
            
            logger.info(f"📊 Fetched {len(candles_5min)} 5-min candles")
            
            # Aggregate to 10-minute candles
            candles_10min = self._aggregate_to_10min(candles_5min)
            logger.info(f"📊 Aggregated to {len(candles_10min)} 10-min candles")
            
            # Group candles by date
            daily_candles = {}
            for c in candles_10min:
                dt_str = c.get("datetime", "")
                if dt_str:
                    date = dt_str.split(" ")[0]
                    if date not in daily_candles:
                        daily_candles[date] = []
                    daily_candles[date].append(c)
            
            # Run backtest
            trades = []
            equity_curve = [capital]
            current_capital = capital
            position = None
            
            for date in sorted(daily_candles.keys()):
                day_candles = daily_candles[date]
                
                if len(day_candles) < 4:  # Need at least 4 candles
                    continue
                
                # Scan each candle for signals (start from candle 3 to have history)
                for i in range(3, len(day_candles)):
                    current = day_candles[i]
                    prev = day_candles[i - 1]      # [-1]
                    prev2 = day_candles[i - 2]     # [-2]
                    
                    # Calculate VWAP for each candle
                    vwap_prev = self._calculate_vwap_cumulative(day_candles[:i], i - 1)
                    vwap_prev2 = self._calculate_vwap_cumulative(day_candles[:i-1], i - 2)
                    
                    if vwap_prev == 0 or vwap_prev2 == 0:
                        continue
                    
                    prev_close = float(prev.get("close", 0))
                    prev_high = float(prev.get("high", 0))
                    prev_low = float(prev.get("low", 0))
                    prev2_close = float(prev2.get("close", 0))
                    current_close = float(current.get("close", 0))
                    current_high = float(current.get("high", 0))
                    current_low = float(current.get("low", 0))
                    
                    # Check for exit if in position
                    if position:
                        hit_sl = False
                        hit_target = False
                        exit_price = 0
                        exit_reason = ""
                        
                        if position["direction"] == "LONG":
                            # Check SL hit (previous candle low)
                            if current_low <= position["stop_loss"]:
                                hit_sl = True
                                exit_price = position["stop_loss"]
                                exit_reason = "STOP_LOSS"
                            # Check target hit
                            elif current_high >= position["target"]:
                                hit_target = True
                                exit_price = position["target"]
                                exit_reason = "TARGET_HIT"
                        else:  # SHORT
                            # Check SL hit (previous candle high)
                            if current_high >= position["stop_loss"]:
                                hit_sl = True
                                exit_price = position["stop_loss"]
                                exit_reason = "STOP_LOSS"
                            # Check target hit
                            elif current_low <= position["target"]:
                                hit_target = True
                                exit_price = position["target"]
                                exit_reason = "TARGET_HIT"
                        
                        # Time-based exit at 15:15
                        time_str = current.get("datetime", "").split(" ")[-1] if current.get("datetime") else ""
                        if time_str >= "15:15":
                            if not (hit_sl or hit_target):
                                exit_price = current_close
                                exit_reason = "TIME_EXIT"
                                hit_sl = True  # Force exit
                        
                        if hit_sl or hit_target:
                            # Calculate P&L
                            if position["direction"] == "LONG":
                                pnl = (exit_price - position["entry"]) * position["quantity"]
                            else:
                                pnl = (position["entry"] - exit_price) * position["quantity"]
                            
                            pnl_pct = (pnl / (position["entry"] * position["quantity"])) * 100
                            
                            # Record trade
                            trades.append({
                                "date": date,
                                "symbol": symbol,
                                "direction": position["direction"],
                                "entry_time": position["entry_time"],
                                "entry_price": position["entry"],
                                "exit_time": current.get("datetime", ""),
                                "exit_price": exit_price,
                                "stop_loss": position["stop_loss"],
                                "target": position["target"],
                                "quantity": position["quantity"],
                                "pnl": round(pnl, 2),
                                "pnl_pct": round(pnl_pct, 2),
                                "exit_reason": exit_reason,
                                "result": "WIN" if pnl > 0 else "LOSS"
                            })
                            
                            current_capital += pnl
                            equity_curve.append(current_capital)
                            position = None
                            continue
                    
                    # No position - look for entry signals
                    if position is None:
                        # Skip last 30 mins (no new entries after 15:00)
                        time_str = current.get("datetime", "").split(" ")[-1] if current.get("datetime") else ""
                        if time_str >= "15:00":
                            continue
                        
                        # BULLISH conditions (ChartInk exact)
                        bullish = (
                            prev_close > vwap_prev and          # [-1] Close > [-1] VWAP
                            prev2_close > vwap_prev2 and        # [-2] Close > [-2] VWAP
                            prev2_close > prev_high             # [-2] Close > [-1] High
                        )
                        
                        # BEARISH conditions (ChartInk exact)
                        bearish = (
                            prev_close < vwap_prev and          # [-1] Close < [-1] VWAP
                            prev2_close < vwap_prev2 and        # [-2] Close < [-2] VWAP
                            prev2_close < prev_low              # [-2] Close < [-1] Low
                        )
                        
                        if bullish:
                            entry_price = current_close
                            stop_loss = prev_low  # Previous candle LOW
                            risk = entry_price - stop_loss
                            
                            if risk > 0:
                                target = entry_price + (risk * target_rr)
                                risk_amount = current_capital * (risk_per_trade / 100)
                                quantity = max(1, int(risk_amount / risk))
                                
                                position = {
                                    "direction": "LONG",
                                    "entry": entry_price,
                                    "entry_time": current.get("datetime", ""),
                                    "stop_loss": stop_loss,
                                    "target": target,
                                    "quantity": quantity,
                                    "risk": risk
                                }
                        
                        elif bearish:
                            entry_price = current_close
                            stop_loss = prev_high  # Previous candle HIGH
                            risk = stop_loss - entry_price
                            
                            if risk > 0:
                                target = entry_price - (risk * target_rr)
                                risk_amount = current_capital * (risk_per_trade / 100)
                                quantity = max(1, int(risk_amount / risk))
                                
                                position = {
                                    "direction": "SHORT",
                                    "entry": entry_price,
                                    "entry_time": current.get("datetime", ""),
                                    "stop_loss": stop_loss,
                                    "target": target,
                                    "quantity": quantity,
                                    "risk": risk
                                }
                
                # Close any open position at EOD
                if position and day_candles:
                    last_candle = day_candles[-1]
                    exit_price = float(last_candle.get("close", position["entry"]))
                    
                    if position["direction"] == "LONG":
                        pnl = (exit_price - position["entry"]) * position["quantity"]
                    else:
                        pnl = (position["entry"] - exit_price) * position["quantity"]
                    
                    pnl_pct = (pnl / (position["entry"] * position["quantity"])) * 100
                    
                    trades.append({
                        "date": date,
                        "symbol": symbol,
                        "direction": position["direction"],
                        "entry_time": position["entry_time"],
                        "entry_price": position["entry"],
                        "exit_time": last_candle.get("datetime", ""),
                        "exit_price": exit_price,
                        "stop_loss": position["stop_loss"],
                        "target": position["target"],
                        "quantity": position["quantity"],
                        "pnl": round(pnl, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "exit_reason": "EOD_EXIT",
                        "result": "WIN" if pnl > 0 else "LOSS"
                    })
                    
                    current_capital += pnl
                    equity_curve.append(current_capital)
                    position = None
            
            # Calculate metrics
            total_trades = len(trades)
            winning_trades = len([t for t in trades if t["result"] == "WIN"])
            losing_trades = len([t for t in trades if t["result"] == "LOSS"])
            
            total_pnl = sum(t["pnl"] for t in trades)
            total_pnl_pct = ((current_capital - capital) / capital) * 100
            
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
            
            avg_win = sum(t["pnl"] for t in trades if t["result"] == "WIN") / winning_trades if winning_trades > 0 else 0
            avg_loss = sum(t["pnl"] for t in trades if t["result"] == "LOSS") / losing_trades if losing_trades > 0 else 0
            
            profit_factor = abs(avg_win * winning_trades) / abs(avg_loss * losing_trades) if avg_loss != 0 and losing_trades > 0 else 0
            
            # Max drawdown
            peak = capital
            max_dd = 0
            for equity in equity_curve:
                if equity > peak:
                    peak = equity
                dd = (peak - equity) / peak * 100
                if dd > max_dd:
                    max_dd = dd
            
            # Sharpe ratio estimate
            returns = []
            for i in range(1, len(equity_curve)):
                daily_return = (equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1]
                returns.append(daily_return)
            
            avg_return = sum(returns) / len(returns) if returns else 0
            std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5 if returns else 0
            sharpe = (avg_return / std_return) * (252 ** 0.5) if std_return > 0 else 0
            
            # Exit analysis
            sl_exits = len([t for t in trades if t["exit_reason"] == "STOP_LOSS"])
            target_exits = len([t for t in trades if t["exit_reason"] == "TARGET_HIT"])
            time_exits = len([t for t in trades if t["exit_reason"] in ("TIME_EXIT", "EOD_EXIT")])
            
            logger.info(f"✅ Backtest complete: {total_trades} trades, Win Rate: {win_rate:.1f}%, P&L: ₹{total_pnl:.2f}")
            
            return {
                "status": "success",
                "symbol": symbol,
                "period": f"{from_date} to {to_date}",
                "candles_analyzed": len(candles_10min),
                "trading_days": len(daily_candles),
                "metrics": {
                    "total_trades": total_trades,
                    "winning_trades": winning_trades,
                    "losing_trades": losing_trades,
                    "win_rate": round(win_rate, 2),
                    "total_pnl": round(total_pnl, 2),
                    "total_pnl_pct": round(total_pnl_pct, 2),
                    "avg_win": round(avg_win, 2),
                    "avg_loss": round(avg_loss, 2),
                    "profit_factor": round(profit_factor, 2),
                    "max_drawdown_pct": round(max_dd, 2),
                    "sharpe_ratio": round(sharpe, 2),
                    "final_capital": round(current_capital, 2),
                    "starting_capital": capital
                },
                "exit_analysis": {
                    "stop_loss_exits": sl_exits,
                    "target_exits": target_exits,
                    "time_exits": time_exits
                },
                "strategy_config": {
                    "candle_interval": "10min",
                    "stoploss_type": "previous_candle_low_high",
                    "target_rr": target_rr,
                    "risk_per_trade": risk_per_trade
                },
                "trades": trades[-50:],  # Last 50 trades
                "equity_curve": equity_curve[-100:],  # Last 100 points
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Backtest error: {e}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}


# Global bot instance
_vwap_bot_instance = None

def get_vwap_bot(unified_service=None, broker_service=None) -> VWAPTradingBot:
    """Get or create VWAP bot instance"""
    global _vwap_bot_instance
    if _vwap_bot_instance is None:
        _vwap_bot_instance = VWAPTradingBot(broker_service=broker_service, unified_service=unified_service)
    else:
        # Update services if provided
        if unified_service and _vwap_bot_instance.unified_service is None:
            _vwap_bot_instance.unified_service = unified_service
        if broker_service and _vwap_bot_instance.broker_service is None:
            _vwap_bot_instance.broker_service = broker_service
    return _vwap_bot_instance
