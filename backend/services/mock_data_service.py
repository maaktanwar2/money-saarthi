# backend/services/mock_data_service.py
"""
Mock Data Service for Bot Testing
Generates realistic market data for testing trading bots without real market connection

Features:
- Simulated stock prices with realistic movements
- Mock VWAP momentum signals
- Mock option chains for strangle testing
- Configurable market scenarios (trending, ranging, volatile)
"""

import random
import math
from datetime import datetime, time, timedelta
from typing import Dict, List, Any, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class MarketScenario(Enum):
    BULLISH_TREND = "bullish_trend"
    BEARISH_TREND = "bearish_trend"
    RANGE_BOUND = "range_bound"
    VOLATILE = "volatile"
    RANDOM = "random"


class MockDataService:
    """
    Mock data generator for bot testing
    Simulates realistic market data for various trading scenarios
    """
    
    # Popular F&O stocks for testing
    FO_STOCKS = [
        {"symbol": "RELIANCE", "base_price": 2450, "volatility": 0.015},
        {"symbol": "TCS", "base_price": 3850, "volatility": 0.012},
        {"symbol": "HDFCBANK", "base_price": 1650, "volatility": 0.014},
        {"symbol": "INFY", "base_price": 1480, "volatility": 0.016},
        {"symbol": "ICICIBANK", "base_price": 1120, "volatility": 0.015},
        {"symbol": "KOTAKBANK", "base_price": 1780, "volatility": 0.013},
        {"symbol": "SBIN", "base_price": 780, "volatility": 0.018},
        {"symbol": "BHARTIARTL", "base_price": 1520, "volatility": 0.014},
        {"symbol": "ITC", "base_price": 465, "volatility": 0.011},
        {"symbol": "AXISBANK", "base_price": 1180, "volatility": 0.016},
        {"symbol": "TATAMOTORS", "base_price": 980, "volatility": 0.022},
        {"symbol": "MARUTI", "base_price": 11850, "volatility": 0.013},
        {"symbol": "BAJFINANCE", "base_price": 6850, "volatility": 0.019},
        {"symbol": "WIPRO", "base_price": 485, "volatility": 0.014},
        {"symbol": "TATASTEEL", "base_price": 145, "volatility": 0.021},
        {"symbol": "ADANIENT", "base_price": 2650, "volatility": 0.025},
        {"symbol": "LT", "base_price": 3450, "volatility": 0.012},
        {"symbol": "SUNPHARMA", "base_price": 1680, "volatility": 0.015},
        {"symbol": "HINDUNILVR", "base_price": 2480, "volatility": 0.010},
        {"symbol": "TITAN", "base_price": 3250, "volatility": 0.014},
    ]
    
    def __init__(self, scenario: MarketScenario = MarketScenario.RANDOM):
        self.scenario = scenario
        self.tick_count = 0
        self.stock_states: Dict[str, Dict] = {}
        self._initialize_stocks()
        
        # Index data
        self.nifty_base = 22500
        self.nifty_current = self.nifty_base
        self.banknifty_base = 48500
        self.banknifty_current = self.banknifty_base
        
        # Mock VIX
        self.vix = 12.5
        
        # ═══════════════════════════════════════════════════════════════
        # MOCK ACCOUNT / FUNDS
        # ═══════════════════════════════════════════════════════════════
        self.mock_account = {
            "initial_capital": 500000,  # 5 Lakh starting capital
            "available_balance": 500000,
            "used_margin": 0,
            "total_pnl": 0,
            "realized_pnl": 0,
            "unrealized_pnl": 0,
            "positions_value": 0,
            "orders": [],
            "positions": {},
            "trade_history": [],
            # Brokerage & Charges tracking
            "total_brokerage": 0,
            "total_stt": 0,
            "total_exchange_txn": 0,
            "total_sebi": 0,
            "total_gst": 0,
            "total_stamp_duty": 0,
            "total_charges": 0,
            "trade_count": 0,
        }
        
        logger.info(f"MockDataService initialized with scenario: {scenario.value}")
    
    def _initialize_stocks(self):
        """Initialize stock states with realistic starting values including pre-existing moves"""
        for stock in self.FO_STOCKS:
            symbol = stock["symbol"]
            base = stock["base_price"]
            vol = stock["volatility"]
            
            # Simulate some stocks already have intraday moves
            # This allows signals to be generated immediately
            scenario_bias = self._get_scenario_bias() if hasattr(self, 'scenario') else 0.5
            
            # Generate random intraday change based on scenario
            if random.random() < 0.6:  # 60% of stocks have meaningful moves
                if random.random() < scenario_bias:
                    # Bullish move: 0.2% to 2%
                    change = random.uniform(0.002, 0.02)
                else:
                    # Bearish move: -0.2% to -2%
                    change = random.uniform(-0.02, -0.002)
            else:
                # Flat: -0.1% to 0.1%
                change = random.uniform(-0.001, 0.001)
            
            open_price = base * (1 + random.uniform(-0.005, 0.005))
            current_price = base * (1 + change)
            
            # Calculate VWAP slightly lagging (as it does in real markets)
            vwap = base * (1 + change * 0.7)
            
            # High/low based on current price and range
            if change > 0:
                high = current_price * (1 + random.uniform(0, 0.005))
                low = open_price * (1 - random.uniform(0, 0.005))
            else:
                high = open_price * (1 + random.uniform(0, 0.005))
                low = current_price * (1 - random.uniform(0, 0.005))
            
            self.stock_states[symbol] = {
                "symbol": symbol,
                "base_price": base,
                "volatility": vol,
                "open": round(open_price, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(current_price, 2),
                "prev_close": base,
                "vwap": round(vwap, 2),
                "volume": random.randint(500000, 2000000),
                "avg_volume": random.randint(500000, 5000000),
                "trend_direction": 1 if change > 0 else -1 if change < 0 else 0,
                "momentum": round(change * 100, 2),
            }
    
    def set_scenario(self, scenario: MarketScenario):
        """Change market scenario"""
        self.scenario = scenario
        logger.info(f"Market scenario changed to: {scenario.value}")
    
    def _get_scenario_bias(self) -> float:
        """Get price movement bias based on scenario"""
        if self.scenario == MarketScenario.BULLISH_TREND:
            return 0.6  # 60% chance of up move
        elif self.scenario == MarketScenario.BEARISH_TREND:
            return 0.4  # 40% chance of up move
        elif self.scenario == MarketScenario.RANGE_BOUND:
            return 0.5  # 50% chance (mean reverting)
        elif self.scenario == MarketScenario.VOLATILE:
            return 0.5  # 50% but larger moves
        else:
            return random.uniform(0.4, 0.6)  # Random bias
    
    def tick(self) -> Dict[str, Dict]:
        """
        Advance simulation by one tick and return updated stock data
        Call this periodically to simulate live market
        """
        self.tick_count += 1
        bias = self._get_scenario_bias()
        volatility_multiplier = 2.0 if self.scenario == MarketScenario.VOLATILE else 1.0
        
        updated_stocks = {}
        
        for symbol, state in self.stock_states.items():
            vol = state["volatility"] * volatility_multiplier
            
            # Determine move direction
            move_up = random.random() < bias
            
            # Mean reversion in range-bound
            if self.scenario == MarketScenario.RANGE_BOUND:
                if state["close"] > state["vwap"] * 1.01:
                    move_up = random.random() < 0.35
                elif state["close"] < state["vwap"] * 0.99:
                    move_up = random.random() < 0.65
            
            # Calculate price change
            change_pct = random.uniform(0.001, vol) * (1 if move_up else -1)
            new_price = state["close"] * (1 + change_pct)
            
            # Update state
            state["close"] = round(new_price, 2)
            state["high"] = max(state["high"], new_price)
            state["low"] = min(state["low"], new_price)
            
            # Update VWAP (simplified)
            state["volume"] += random.randint(10000, 100000)
            state["vwap"] = round(
                (state["vwap"] * 0.95 + new_price * 0.05), 2
            )
            
            # Update momentum
            state["momentum"] = (state["close"] / state["prev_close"] - 1) * 100
            
            updated_stocks[symbol] = state.copy()
        
        # Update indices
        self._update_indices(bias, volatility_multiplier)
        
        return updated_stocks
    
    def _update_indices(self, bias: float, vol_mult: float):
        """Update NIFTY and BANKNIFTY"""
        nifty_change = random.uniform(-0.002, 0.002) * vol_mult
        if random.random() < bias:
            nifty_change = abs(nifty_change)
        else:
            nifty_change = -abs(nifty_change)
        
        self.nifty_current = round(self.nifty_current * (1 + nifty_change), 2)
        self.banknifty_current = round(self.banknifty_current * (1 + nifty_change * 1.2), 2)
        
        # Update VIX based on volatility
        if self.scenario == MarketScenario.VOLATILE:
            self.vix = random.uniform(16, 22)
        elif self.scenario == MarketScenario.RANGE_BOUND:
            self.vix = random.uniform(11, 14)
        else:
            self.vix = random.uniform(12, 16)
    
    def get_stock_quote(self, symbol: str) -> Optional[Dict]:
        """Get current quote for a stock"""
        if symbol in self.stock_states:
            state = self.stock_states[symbol]
            return {
                "symbol": symbol,
                "ltp": state["close"],
                "open": state["open"],
                "high": state["high"],
                "low": state["low"],
                "close": state["close"],
                "prev_close": state["prev_close"],
                "change": round(state["close"] - state["prev_close"], 2),
                "change_pct": round((state["close"] / state["prev_close"] - 1) * 100, 2),
                "volume": state["volume"],
                "vwap": state["vwap"],
            }
        return None
    
    def get_all_quotes(self) -> List[Dict]:
        """Get quotes for all stocks"""
        return [self.get_stock_quote(s["symbol"]) for s in self.FO_STOCKS]
    
    def get_vwap_momentum_signals(self, min_score: int = 60) -> Dict[str, List[Dict]]:
        """
        Generate mock VWAP momentum signals
        Returns bullish and bearish signals with scores
        """
        self.tick()  # Advance simulation
        
        bullish = []
        bearish = []
        
        for symbol, state in self.stock_states.items():
            close = state["close"]
            vwap = state["vwap"]
            vol_ratio = state["volume"] / max(state["avg_volume"], 1)
            
            # Calculate day's range position
            day_range = state["high"] - state["low"]
            if day_range > 0:
                range_pos = (close - state["low"]) / day_range * 100
            else:
                range_pos = 50
            
            change_pct = (close / state["prev_close"] - 1) * 100
            
            # Calculate VWAP score
            if close > vwap:
                # Bullish potential
                score = 50
                score += min(20, (close / vwap - 1) * 1000)  # Distance from VWAP
                score += min(15, vol_ratio * 5)  # Volume bonus
                score += min(10, max(0, (range_pos - 70) / 3))  # Near high bonus
                score += min(5, change_pct * 2.5)  # Momentum bonus
                score = min(100, int(score))
                
                # Lower threshold for mock mode to generate trades faster
                if score >= min_score and change_pct > 0.1:
                    bullish.append({
                        "symbol": symbol,
                        "ltp": close,
                        "vwap": vwap,
                        "change_pct": round(change_pct, 2),
                        "volume_ratio": round(vol_ratio, 2),
                        "range_position": round(range_pos, 1),
                        "score": score,
                        "signal": "BULLISH",
                        "confidence": "HIGH" if score >= 80 else "MEDIUM" if score >= 70 else "LOW",
                        "mock": True,
                    })
            else:
                # Bearish potential
                score = 50
                score += min(20, (1 - close / vwap) * 1000)  # Distance from VWAP
                score += min(15, vol_ratio * 5)  # Volume bonus
                score += min(10, max(0, (30 - range_pos) / 3))  # Near low bonus
                score += min(5, abs(change_pct) * 2.5)  # Momentum bonus
                score = min(100, int(score))
                
                # Lower threshold for mock mode to generate trades faster
                if score >= min_score and change_pct < -0.1:
                    bearish.append({
                        "symbol": symbol,
                        "ltp": close,
                        "vwap": vwap,
                        "change_pct": round(change_pct, 2),
                        "volume_ratio": round(vol_ratio, 2),
                        "range_position": round(range_pos, 1),
                        "score": score,
                        "signal": "BEARISH",
                        "confidence": "HIGH" if score >= 80 else "MEDIUM" if score >= 70 else "LOW",
                        "mock": True,
                    })
        
        # Sort by score descending
        bullish.sort(key=lambda x: x["score"], reverse=True)
        bearish.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "bullish": bullish[:10],
            "bearish": bearish[:10],
            "scan_time": datetime.now().isoformat(),
            "total_scanned": len(self.FO_STOCKS),
            "scenario": self.scenario.value,
            "mock_mode": True,
        }
    
    def get_index_data(self) -> Dict:
        """Get current index data"""
        return {
            "nifty": {
                "ltp": self.nifty_current,
                "open": self.nifty_base,
                "change": round(self.nifty_current - self.nifty_base, 2),
                "change_pct": round((self.nifty_current / self.nifty_base - 1) * 100, 2),
            },
            "banknifty": {
                "ltp": self.banknifty_current,
                "open": self.banknifty_base,
                "change": round(self.banknifty_current - self.banknifty_base, 2),
                "change_pct": round((self.banknifty_current / self.banknifty_base - 1) * 100, 2),
            },
            "vix": round(self.vix, 2),
        }
    
    def get_ai_strangle_conditions(self) -> Dict:
        """
        Generate mock AI strangle conditions
        Returns regime detection data for strangle bot
        """
        # Base scores on scenario
        if self.scenario == MarketScenario.RANGE_BOUND:
            vix = random.uniform(11, 14)
            iv_rv = random.uniform(0.85, 1.1)
            pcr = random.uniform(0.9, 1.1)
            atr_ratio = random.uniform(0.5, 0.75)
            is_event = False
        elif self.scenario == MarketScenario.VOLATILE:
            vix = random.uniform(17, 24)
            iv_rv = random.uniform(1.3, 1.8)
            pcr = random.choice([random.uniform(0.6, 0.75), random.uniform(1.3, 1.5)])
            atr_ratio = random.uniform(1.1, 1.5)
            is_event = random.random() < 0.3
        else:
            vix = random.uniform(12, 17)
            iv_rv = random.uniform(0.9, 1.3)
            pcr = random.uniform(0.8, 1.2)
            atr_ratio = random.uniform(0.6, 1.0)
            is_event = random.random() < 0.1
        
        # Calculate scores
        vix_score = max(0, 100 - (vix - 11) * 10) if vix <= 18 else 0
        iv_rv_score = max(0, 100 - (iv_rv - 0.8) * 100) if iv_rv <= 1.2 else 0
        pcr_score = 100 if 0.85 <= pcr <= 1.15 else max(0, 100 - abs(pcr - 1) * 200)
        atr_score = max(0, 100 - atr_ratio * 80) if atr_ratio <= 0.8 else 0
        event_score = 100 if not is_event else 0
        
        total_score = (
            vix_score * 0.25 +
            iv_rv_score * 0.25 +
            pcr_score * 0.20 +
            atr_score * 0.15 +
            event_score * 0.15
        )
        
        regime = "range_bound" if total_score >= 65 else "volatile"
        action = "SELL" if total_score >= 65 else "SKIP"
        confidence = "HIGH" if total_score >= 80 else "MEDIUM" if total_score >= 65 else "LOW"
        
        return {
            "total_score": round(total_score, 1),
            "regime": regime,
            "action": action,
            "confidence": confidence,
            "factors": {
                "vix": {"value": round(vix, 2), "score": round(vix_score, 1), "pass": vix <= 18, "weight": 25},
                "iv_rv": {"value": round(iv_rv, 2), "score": round(iv_rv_score, 1), "pass": iv_rv <= 1.2, "weight": 25},
                "pcr": {"value": round(pcr, 2), "score": round(pcr_score, 1), "pass": 0.85 <= pcr <= 1.15, "weight": 20},
                "atr_ratio": {"value": round(atr_ratio, 2), "score": round(atr_score, 1), "pass": atr_ratio <= 0.8, "weight": 15},
                "is_event": {"value": is_event, "score": event_score, "pass": not is_event, "weight": 15},
            },
            "spot_price": self.nifty_current,
            "mock_mode": True,
        }
    
    def get_option_chain(self, symbol: str = "NIFTY", expiry: str = None) -> Dict:
        """
        Generate mock option chain for strangle testing
        """
        if symbol == "NIFTY":
            spot = self.nifty_current
            lot_size = 25
        else:
            spot = self.banknifty_current
            lot_size = 15
        
        # Round to nearest 50
        atm_strike = round(spot / 50) * 50
        
        strikes = []
        for offset in range(-500, 550, 50):
            strike = atm_strike + offset
            distance = abs(strike - spot)
            
            # Calculate premium based on distance (simplified Black-Scholes approximation)
            base_premium = max(5, 200 - distance * 0.3 + random.uniform(-10, 10))
            
            # CE premium higher when spot > strike
            ce_intrinsic = max(0, spot - strike)
            pe_intrinsic = max(0, strike - spot)
            
            ce_premium = round(base_premium + ce_intrinsic + random.uniform(-5, 5), 2)
            pe_premium = round(base_premium + pe_intrinsic + random.uniform(-5, 5), 2)
            
            # IV based on distance
            atm_iv = 15 + self.vix * 0.5
            iv_skew = abs(offset) * 0.01
            ce_iv = round(atm_iv - iv_skew if offset > 0 else atm_iv + iv_skew, 2)
            pe_iv = round(atm_iv + iv_skew if offset > 0 else atm_iv - iv_skew, 2)
            
            strikes.append({
                "strike": strike,
                "ce_ltp": ce_premium,
                "ce_iv": ce_iv,
                "ce_oi": random.randint(100000, 1000000),
                "ce_delta": round(max(-1, min(1, 0.5 - offset / 1000)), 3),
                "pe_ltp": pe_premium,
                "pe_iv": pe_iv,
                "pe_oi": random.randint(100000, 1000000),
                "pe_delta": round(max(-1, min(1, -0.5 + offset / 1000)), 3),
            })
        
        return {
            "symbol": symbol,
            "spot": spot,
            "atm_strike": atm_strike,
            "lot_size": lot_size,
            "expiry": expiry or "2026-02-12",
            "strikes": strikes,
            "mock_mode": True,
        }
    
    def calculate_brokerage(
        self, 
        side: str, 
        quantity: int, 
        price: float, 
        segment: str = "equity_intraday"
    ) -> Dict:
        """
        Calculate realistic Dhan brokerage and charges
        
        Dhan Intraday Equity Charges:
        - Brokerage: ₹20 flat per order
        - STT: 0.025% (sell side only)
        - Exchange Txn: 0.00345% (both sides)
        - SEBI: 0.0001% (both sides)
        - GST: 18% on brokerage
        - Stamp Duty: 0.003% (buy side only)
        """
        turnover = price * quantity
        
        # Brokerage (₹20 flat per order, or 0.03% whichever is lower)
        brokerage = min(20, turnover * 0.0003)
        
        # STT - only on sell side for intraday
        stt = turnover * 0.00025 if side == "SELL" else 0
        
        # Exchange Transaction Charges (NSE)
        exchange_txn = turnover * 0.0000345
        
        # SEBI Charges
        sebi = turnover * 0.000001
        
        # GST (18% on brokerage + exchange txn + SEBI)
        gst = (brokerage + exchange_txn + sebi) * 0.18
        
        # Stamp Duty - only on buy side
        stamp_duty = turnover * 0.00003 if side == "BUY" else 0
        
        # Total charges
        total = brokerage + stt + exchange_txn + sebi + gst + stamp_duty
        
        return {
            "brokerage": round(brokerage, 2),
            "stt": round(stt, 2),
            "exchange_txn": round(exchange_txn, 2),
            "sebi": round(sebi, 2),
            "gst": round(gst, 2),
            "stamp_duty": round(stamp_duty, 2),
            "total": round(total, 2),
            "turnover": round(turnover, 2)
        }
    
    def simulate_order_execution(
        self, 
        symbol: str, 
        side: str, 
        quantity: int, 
        order_type: str = "MARKET"
    ) -> Dict:
        """
        Simulate order execution
        Returns mock order response
        """
        quote = self.get_stock_quote(symbol)
        if not quote:
            return {"status": "REJECTED", "reason": "Symbol not found"}
        
        # Add slippage for market orders
        slippage = 0.0005 if order_type == "MARKET" else 0
        if side == "BUY":
            executed_price = quote["ltp"] * (1 + slippage)
        else:
            executed_price = quote["ltp"] * (1 - slippage)
        
        order_id = f"MOCK_{datetime.now().strftime('%Y%m%d%H%M%S')}_{random.randint(1000, 9999)}"
        executed_price = round(executed_price, 2)
        order_value = executed_price * quantity
        
        # Update mock account
        if side == "BUY":
            # Check if enough balance
            if order_value > self.mock_account["available_balance"]:
                return {"status": "REJECTED", "reason": f"Insufficient funds. Need ₹{order_value:,.0f}, have ₹{self.mock_account['available_balance']:,.0f}"}
            
            # Deduct from balance, add to margin
            self.mock_account["available_balance"] -= order_value
            self.mock_account["used_margin"] += order_value
            
            # Add/update position
            if symbol in self.mock_account["positions"]:
                pos = self.mock_account["positions"][symbol]
                total_qty = pos["quantity"] + quantity
                pos["avg_price"] = (pos["avg_price"] * pos["quantity"] + executed_price * quantity) / total_qty
                pos["quantity"] = total_qty
                pos["value"] = pos["avg_price"] * total_qty
            else:
                self.mock_account["positions"][symbol] = {
                    "symbol": symbol,
                    "quantity": quantity,
                    "avg_price": executed_price,
                    "value": order_value,
                    "side": "LONG",
                    "entry_time": datetime.now().isoformat(),
                    "unrealized_pnl": 0
                }
        else:  # SELL
            if symbol in self.mock_account["positions"]:
                pos = self.mock_account["positions"][symbol]
                if pos["quantity"] >= quantity:
                    # Calculate realized P&L
                    pnl = (executed_price - pos["avg_price"]) * quantity
                    self.mock_account["realized_pnl"] += pnl
                    self.mock_account["total_pnl"] = self.mock_account["realized_pnl"] + self.mock_account["unrealized_pnl"]
                    
                    # Return margin + P&L
                    self.mock_account["available_balance"] += (pos["avg_price"] * quantity) + pnl
                    self.mock_account["used_margin"] -= pos["avg_price"] * quantity
                    
                    pos["quantity"] -= quantity
                    if pos["quantity"] <= 0:
                        del self.mock_account["positions"][symbol]
                    else:
                        pos["value"] = pos["avg_price"] * pos["quantity"]
        
        # Calculate brokerage and charges
        charges = self.calculate_brokerage(side, quantity, executed_price)
        
        # Deduct charges from balance
        self.mock_account["available_balance"] -= charges["total"]
        
        # Track charges
        self.mock_account["total_brokerage"] += charges["brokerage"]
        self.mock_account["total_stt"] += charges["stt"]
        self.mock_account["total_exchange_txn"] += charges["exchange_txn"]
        self.mock_account["total_sebi"] += charges["sebi"]
        self.mock_account["total_gst"] += charges["gst"]
        self.mock_account["total_stamp_duty"] += charges["stamp_duty"]
        self.mock_account["total_charges"] += charges["total"]
        self.mock_account["trade_count"] += 1
        
        # Record order
        order = {
            "order_id": order_id,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "order_type": order_type,
            "price": executed_price,
            "value": order_value,
            "charges": charges,
            "executed_at": datetime.now().isoformat(),
            "status": "COMPLETE"
        }
        self.mock_account["orders"].append(order)
        self.mock_account["trade_history"].append(order)
        
        return {
            "status": "COMPLETE",
            "order_id": order_id,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "order_type": order_type,
            "price": executed_price,
            "value": order_value,
            "executed_at": datetime.now().isoformat(),
            "mock": True,
            "account_balance": self.mock_account["available_balance"]
        }
    
    def get_funds(self) -> Dict:
        """Get mock account funds/balance including brokerage charges"""
        # Update unrealized P&L first
        self._update_unrealized_pnl()
        
        return {
            "initial_capital": self.mock_account["initial_capital"],
            "available_balance": round(self.mock_account["available_balance"], 2),
            "used_margin": round(self.mock_account["used_margin"], 2),
            "total_balance": round(self.mock_account["available_balance"] + self.mock_account["used_margin"], 2),
            "realized_pnl": round(self.mock_account["realized_pnl"], 2),
            "unrealized_pnl": round(self.mock_account["unrealized_pnl"], 2),
            "total_pnl": round(self.mock_account["total_pnl"], 2),
            "positions_count": len(self.mock_account["positions"]),
            # Brokerage & Charges breakdown
            "charges": {
                "total": round(self.mock_account.get("total_charges", 0), 2),
                "brokerage": round(self.mock_account.get("total_brokerage", 0), 2),
                "stt": round(self.mock_account.get("total_stt", 0), 2),
                "exchange_txn": round(self.mock_account.get("total_exchange_txn", 0), 2),
                "sebi": round(self.mock_account.get("total_sebi", 0), 2),
                "gst": round(self.mock_account.get("total_gst", 0), 2),
                "stamp_duty": round(self.mock_account.get("total_stamp_duty", 0), 2),
            },
            "trade_count": self.mock_account.get("trade_count", 0),
            "net_pnl": round(self.mock_account["total_pnl"] - self.mock_account.get("total_charges", 0), 2),
            "mock_mode": True
        }
    
    def get_positions(self) -> List[Dict]:
        """Get mock open positions"""
        self._update_unrealized_pnl()
        return list(self.mock_account["positions"].values())
    
    def get_trade_history(self) -> List[Dict]:
        """Get mock trade history"""
        return self.mock_account["trade_history"][-50:]  # Last 50 trades
    
    def _update_unrealized_pnl(self):
        """Update unrealized P&L based on current prices"""
        total_unrealized = 0
        for symbol, pos in self.mock_account["positions"].items():
            quote = self.get_stock_quote(symbol)
            if quote:
                current_price = quote["ltp"]
                pos["current_price"] = current_price
                pos["unrealized_pnl"] = (current_price - pos["avg_price"]) * pos["quantity"]
                pos["unrealized_pnl_pct"] = ((current_price / pos["avg_price"]) - 1) * 100
                total_unrealized += pos["unrealized_pnl"]
        
        self.mock_account["unrealized_pnl"] = total_unrealized
        self.mock_account["total_pnl"] = self.mock_account["realized_pnl"] + total_unrealized
    
    def set_initial_capital(self, capital: float):
        """Set mock account initial capital"""
        self.mock_account["initial_capital"] = capital
        self.mock_account["available_balance"] = capital
        self.mock_account["used_margin"] = 0
        self.mock_account["positions"] = {}
        self.mock_account["realized_pnl"] = 0
        self.mock_account["unrealized_pnl"] = 0
        self.mock_account["total_pnl"] = 0
        logger.info(f"Mock capital set to ₹{capital:,.0f}")
        return {"status": "success", "capital": capital}
    
    def reset(self):
        """Reset simulation to initial state"""
        self._initialize_stocks()
        self.nifty_current = self.nifty_base
        self.banknifty_current = self.banknifty_base
        self.tick_count = 0
        
        # Reset mock account
        self.mock_account = {
            "initial_capital": 500000,
            "available_balance": 500000,
            "used_margin": 0,
            "total_pnl": 0,
            "realized_pnl": 0,
            "unrealized_pnl": 0,
            "positions_value": 0,
            "orders": [],
            "positions": {},
            "trade_history": [],
            # Reset brokerage & charges
            "total_brokerage": 0,
            "total_stt": 0,
            "total_exchange_txn": 0,
            "total_sebi": 0,
            "total_gst": 0,
            "total_stamp_duty": 0,
            "total_charges": 0,
            "trade_count": 0,
        }
        logger.info("MockDataService reset to initial state")


# Global mock data service instance
_mock_service: Optional[MockDataService] = None

def get_mock_service(scenario: MarketScenario = MarketScenario.RANDOM) -> MockDataService:
    """Get or create mock data service instance"""
    global _mock_service
    if _mock_service is None:
        _mock_service = MockDataService(scenario)
    return _mock_service

def reset_mock_service():
    """Reset the mock service"""
    global _mock_service
    if _mock_service:
        _mock_service.reset()
