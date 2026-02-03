"""
Trade Algorithm Service - Auto Fetch & Trade Suggestions
=========================================================

Features:
1. Auto-fetch trades from Dhan & Upstox
2. Analyze trading patterns & performance
3. Generate AI-powered trade suggestions
4. Track win rate, PnL, and risk metrics

Author: Money Saarthi
Version: 1.0
"""

import os
import logging
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict
import json
import numpy as np

logger = logging.getLogger(__name__)


# ============================================
# DATA MODELS
# ============================================

@dataclass
class Trade:
    """Unified trade structure"""
    trade_id: str
    symbol: str
    exchange: str
    segment: str  # EQ, FNO, MCX
    trade_type: str  # BUY/SELL
    quantity: int
    price: float
    trade_time: datetime
    order_id: str
    product_type: str  # CNC, INTRADAY, MARGIN
    broker: str  # dhan, upstox
    
    # Optional fields
    realized_pnl: float = 0.0
    charges: float = 0.0
    status: str = "COMPLETE"
    option_type: str = ""  # CE/PE for options
    strike_price: float = 0.0
    expiry: str = ""
    
    def to_dict(self):
        return {
            "trade_id": self.trade_id,
            "symbol": self.symbol,
            "exchange": self.exchange,
            "segment": self.segment,
            "trade_type": self.trade_type,
            "quantity": self.quantity,
            "price": self.price,
            "trade_time": self.trade_time.isoformat() if isinstance(self.trade_time, datetime) else self.trade_time,
            "order_id": self.order_id,
            "product_type": self.product_type,
            "broker": self.broker,
            "realized_pnl": self.realized_pnl,
            "charges": self.charges,
            "status": self.status,
            "option_type": self.option_type,
            "strike_price": self.strike_price,
            "expiry": self.expiry
        }


@dataclass
class Position:
    """Current position structure"""
    symbol: str
    exchange: str
    segment: str
    quantity: int
    avg_price: float
    ltp: float
    pnl: float
    pnl_percent: float
    product_type: str
    broker: str
    
    # For options
    option_type: str = ""
    strike_price: float = 0.0
    expiry: str = ""
    
    def to_dict(self):
        return {
            "symbol": self.symbol,
            "exchange": self.exchange,
            "segment": self.segment,
            "quantity": self.quantity,
            "avg_price": self.avg_price,
            "ltp": self.ltp,
            "pnl": self.pnl,
            "pnl_percent": self.pnl_percent,
            "product_type": self.product_type,
            "broker": self.broker,
            "option_type": self.option_type,
            "strike_price": self.strike_price,
            "expiry": self.expiry
        }


@dataclass
class TradeSuggestion:
    """AI-generated trade suggestion"""
    suggestion_id: str
    symbol: str
    action: str  # BUY, SELL, HOLD, AVOID
    segment: str  # EQ, FNO
    confidence: int  # 0-100
    
    # Entry details
    entry_price: float
    stop_loss: float
    target_1: float
    target_2: float
    
    # Reasoning
    reasons: List[str]
    strategy_type: str  # MOMENTUM, REVERSAL, BREAKOUT, etc.
    timeframe: str  # INTRADAY, SWING, POSITIONAL
    
    # Risk metrics
    risk_reward: str
    max_risk: float
    position_size: int
    
    # Additional info
    created_at: datetime = field(default_factory=datetime.now)
    valid_until: datetime = None
    based_on: List[str] = field(default_factory=list)  # Indicators/patterns used
    
    def to_dict(self):
        return {
            "suggestion_id": self.suggestion_id,
            "symbol": self.symbol,
            "action": self.action,
            "segment": self.segment,
            "confidence": self.confidence,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "target_1": self.target_1,
            "target_2": self.target_2,
            "reasons": self.reasons,
            "strategy_type": self.strategy_type,
            "timeframe": self.timeframe,
            "risk_reward": self.risk_reward,
            "max_risk": self.max_risk,
            "position_size": self.position_size,
            "created_at": self.created_at.isoformat(),
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "based_on": self.based_on
        }


# ============================================
# DHAN TRADE FETCHER
# ============================================

class DhanTradeFetcher:
    """
    Fetch trades, positions, and holdings from Dhan API
    
    API Endpoints:
    - GET /orders - All orders
    - GET /trades - Executed trades
    - GET /positions - Current positions
    - GET /holdings - Holdings
    - GET /fundlimit - Funds
    """
    
    BASE_URL = "https://api.dhan.co/v2"
    
    def __init__(self, client_id: str = None, access_token: str = None):
        self.client_id = client_id or os.environ.get('DHAN_CLIENT_ID', '')
        self.access_token = access_token or os.environ.get('DHAN_ACCESS_TOKEN', '')
        self.session = None
        
    def is_configured(self) -> bool:
        return bool(self.client_id and self.access_token)
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json"
        }
    
    async def _ensure_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_trades(self, from_date: str = None, to_date: str = None) -> List[Trade]:
        """
        Fetch executed trades from Dhan
        
        Returns list of Trade objects
        """
        if not self.is_configured():
            logger.warning("Dhan credentials not configured")
            return []
        
        await self._ensure_session()
        
        try:
            # Today's trades
            async with self.session.get(
                f"{self.BASE_URL}/trades",
                headers=self._get_headers()
            ) as response:
                if response.status != 200:
                    logger.error(f"Dhan trades API error: {response.status}")
                    return []
                
                data = await response.json()
                trades = []
                
                # Dhan returns array directly or {"data": [...]}
                trade_list = data if isinstance(data, list) else data.get("data", [])
                
                for t in trade_list:
                    trade = Trade(
                        trade_id=str(t.get("tradeId", "")),
                        symbol=t.get("tradingSymbol", ""),
                        exchange=t.get("exchangeSegment", "").replace("_EQ", "").replace("_FNO", ""),
                        segment="FNO" if "FNO" in t.get("exchangeSegment", "") else "EQ",
                        trade_type=t.get("transactionType", ""),
                        quantity=int(t.get("tradedQuantity", 0)),
                        price=float(t.get("tradedPrice", 0)),
                        trade_time=datetime.fromisoformat(t.get("exchangeTime", datetime.now().isoformat()).replace("Z", "")),
                        order_id=str(t.get("orderId", "")),
                        product_type=t.get("productType", ""),
                        broker="dhan"
                    )
                    trades.append(trade)
                
                return trades
                
        except Exception as e:
            logger.error(f"Error fetching Dhan trades: {e}")
            return []
    
    async def get_positions(self) -> List[Position]:
        """Fetch current positions from Dhan"""
        if not self.is_configured():
            return []
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/positions",
                headers=self._get_headers()
            ) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                positions = []
                
                # Dhan returns array directly or {"data": [...]}
                position_list = data if isinstance(data, list) else data.get("data", [])
                
                for p in position_list:
                    position = Position(
                        symbol=p.get("tradingSymbol", ""),
                        exchange=p.get("exchangeSegment", "").replace("_EQ", "").replace("_FNO", ""),
                        segment="FNO" if "FNO" in p.get("exchangeSegment", "") else "EQ",
                        quantity=int(p.get("netQty", 0)),
                        avg_price=float(p.get("costPrice", 0)),
                        ltp=float(p.get("lastTradedPrice", 0)),
                        pnl=float(p.get("realizedProfit", 0)) + float(p.get("unrealizedProfit", 0)),
                        pnl_percent=0,  # Calculate below
                        product_type=p.get("productType", ""),
                        broker="dhan"
                    )
                    
                    if position.avg_price > 0:
                        position.pnl_percent = round(
                            ((position.ltp - position.avg_price) / position.avg_price) * 100, 2
                        )
                    
                    positions.append(position)
                
                return positions
                
        except Exception as e:
            logger.error(f"Error fetching Dhan positions: {e}")
            return []
    
    async def get_holdings(self) -> List[Dict]:
        """Fetch holdings from Dhan"""
        if not self.is_configured():
            return []
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/holdings",
                headers=self._get_headers()
            ) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                # Dhan returns array directly or {"data": [...]} or error object
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "errorType" in data:
                    return []  # No holdings
                return data.get("data", [])
                
        except Exception as e:
            logger.error(f"Error fetching Dhan holdings: {e}")
            return []
    
    async def get_orders(self) -> List[Dict]:
        """Fetch all orders from Dhan"""
        if not self.is_configured():
            return []
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/orders",
                headers=self._get_headers()
            ) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                # Dhan returns array directly or {"data": [...]}
                if isinstance(data, list):
                    return data
                return data.get("data", [])
                
        except Exception as e:
            logger.error(f"Error fetching Dhan orders: {e}")
            return []
    
    async def get_funds(self) -> Dict:
        """Fetch fund limits from Dhan"""
        if not self.is_configured():
            return {}
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/fundlimit",
                headers=self._get_headers()
            ) as response:
                if response.status != 200:
                    return {}
                
                data = await response.json()
                
                # Dhan returns object directly (not wrapped in "data")
                # Response: {"dhanClientId": "...", "availabelBalance": 111.92, ...}
                fund_data = data if "availabelBalance" in data else data.get("data", {})
                
                return {
                    "available_balance": float(fund_data.get("availabelBalance", 0)),
                    "utilized_amount": float(fund_data.get("utilizedAmount", 0)),
                    "blocked_margin": float(fund_data.get("blockedPayoutAmount", 0)),
                    "total_balance": float(fund_data.get("sodLimit", 0)),
                    "withdrawable": float(fund_data.get("withdrawableBalance", 0)),
                    "broker": "dhan"
                }
                
        except Exception as e:
            logger.error(f"Error fetching Dhan funds: {e}")
            return {}


# ============================================
# UPSTOX TRADE FETCHER
# ============================================

class UpstoxTradeFetcher:
    """
    Fetch trades from Upstox API
    
    API Endpoints:
    - GET /v2/order/trades/get-trades-for-day - Day's trades
    - GET /v2/portfolio/short-term-positions - Positions
    - GET /v2/portfolio/long-term-holdings - Holdings
    - GET /v2/user/get-funds-and-margin - Funds
    """
    
    BASE_URL = "https://api.upstox.com"
    AUTH_URL = "https://api.upstox.com/v2/login/authorization/dialog"
    TOKEN_URL = "https://api.upstox.com/v2/login/authorization/token"
    
    def __init__(self, api_key: str = None, api_secret: str = None, access_token: str = None):
        self.api_key = api_key or os.environ.get('UPSTOX_API_KEY', '')
        self.api_secret = api_secret or os.environ.get('UPSTOX_API_SECRET', '')
        self.access_token = access_token or os.environ.get('UPSTOX_ACCESS_TOKEN', '')
        self.session = None
    
    def is_configured(self) -> bool:
        return bool(self.access_token)
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def _ensure_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def get_trades(self) -> List[Trade]:
        """Fetch today's trades from Upstox"""
        if not self.is_configured():
            logger.warning("Upstox credentials not configured")
            return []
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/v2/order/trades/get-trades-for-day",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if response.status != 200:
                    error_msg = data.get("message", data.get("error", "Unknown error"))
                    logger.error(f"Upstox trades API error: {response.status} - {error_msg}")
                    return []
                
                data = await response.json()
                trades = []
                
                for t in data.get("data", []):
                    trade = Trade(
                        trade_id=str(t.get("trade_id", "")),
                        symbol=t.get("trading_symbol", ""),
                        exchange=t.get("exchange", ""),
                        segment="FNO" if t.get("instrument_type") in ["OPTIDX", "OPTSTK", "FUTIDX", "FUTSTK"] else "EQ",
                        trade_type=t.get("transaction_type", ""),
                        quantity=int(t.get("quantity", 0)),
                        price=float(t.get("average_price", 0)),
                        trade_time=datetime.fromisoformat(t.get("exchange_timestamp", datetime.now().isoformat()).replace("Z", "")),
                        order_id=str(t.get("order_id", "")),
                        product_type=t.get("product", ""),
                        broker="upstox"
                    )
                    trades.append(trade)
                
                return trades
                
        except Exception as e:
            logger.error(f"Error fetching Upstox trades: {e}")
            return []
    
    async def get_positions(self) -> List[Position]:
        """Fetch positions from Upstox"""
        if not self.is_configured():
            return []
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/v2/portfolio/short-term-positions",
                headers=self._get_headers()
            ) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                positions = []
                
                for p in data.get("data", []):
                    position = Position(
                        symbol=p.get("trading_symbol", ""),
                        exchange=p.get("exchange", ""),
                        segment="FNO" if p.get("instrument_type") in ["OPTIDX", "OPTSTK"] else "EQ",
                        quantity=int(p.get("quantity", 0)),
                        avg_price=float(p.get("average_price", 0)),
                        ltp=float(p.get("last_price", 0)),
                        pnl=float(p.get("pnl", 0)),
                        pnl_percent=float(p.get("pnl_percentage", 0)),
                        product_type=p.get("product", ""),
                        broker="upstox"
                    )
                    positions.append(position)
                
                return positions
                
        except Exception as e:
            logger.error(f"Error fetching Upstox positions: {e}")
            return []
    
    async def get_funds(self) -> Dict:
        """Fetch funds from Upstox"""
        if not self.is_configured():
            logger.warning("Upstox not configured - no access token")
            return {"error": "not_configured", "message": "Upstox access token not provided"}
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/v2/user/get-funds-and-margin",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if response.status != 200:
                    error_msg = data.get("message", data.get("error", "Unknown error"))
                    logger.error(f"Upstox funds API error: {response.status} - {error_msg}")
                    return {"error": "api_error", "status": response.status, "message": error_msg}
                
                equity = data.get("data", {}).get("equity", {})
                
                return {
                    "available_balance": float(equity.get("available_margin", 0)),
                    "utilized_amount": float(equity.get("used_margin", 0)),
                    "total_balance": float(equity.get("available_margin", 0)) + float(equity.get("used_margin", 0)),
                    "broker": "upstox"
                }
                
        except Exception as e:
            logger.error(f"Error fetching Upstox funds: {e}")
            return {}

    async def get_orders(self) -> List[Dict]:
        """Fetch today's orders from Upstox"""
        if not self.is_configured():
            logger.warning("Upstox not configured for orders")
            return []
        
        await self._ensure_session()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/v2/order/retrieve-all",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if response.status != 200:
                    error_msg = data.get("message", data.get("error", "Unknown error"))
                    logger.error(f"Upstox orders API error: {response.status} - {error_msg}")
                    return []
                
                return data.get("data", [])
                
        except Exception as e:
            logger.error(f"Error fetching Upstox orders: {e}")
            return []


# ============================================
# TRADE ANALYTICS ENGINE
# ============================================

class TradeAnalytics:
    """
    Analyze trading performance and patterns
    
    Metrics:
    - Win rate
    - Average profit/loss
    - Sharpe ratio
    - Max drawdown
    - Best/worst trades
    - Trading patterns
    """
    
    def __init__(self):
        self.trades: List[Trade] = []
    
    def load_trades(self, trades: List[Trade]):
        """Load trades for analysis"""
        self.trades = trades
    
    def calculate_metrics(self) -> Dict:
        """Calculate comprehensive trading metrics"""
        if not self.trades:
            return self._empty_metrics()
        
        # Group trades into complete trades (buy+sell pairs)
        trade_pairs = self._pair_trades()
        
        if not trade_pairs:
            return self._empty_metrics()
        
        # Calculate PnL for each pair
        pnls = []
        for pair in trade_pairs:
            buy_value = pair["buy_qty"] * pair["buy_price"]
            sell_value = pair["sell_qty"] * pair["sell_price"]
            pnl = sell_value - buy_value
            pnls.append({
                "symbol": pair["symbol"],
                "pnl": pnl,
                "pnl_percent": (pnl / buy_value) * 100 if buy_value > 0 else 0,
                "holding_time": pair.get("holding_time", 0)
            })
        
        # Winning vs losing trades
        winning = [p for p in pnls if p["pnl"] > 0]
        losing = [p for p in pnls if p["pnl"] < 0]
        
        total_trades = len(pnls)
        win_count = len(winning)
        loss_count = len(losing)
        
        # Calculate metrics
        win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0
        
        avg_win = sum(p["pnl"] for p in winning) / win_count if win_count > 0 else 0
        avg_loss = sum(p["pnl"] for p in losing) / loss_count if loss_count > 0 else 0
        
        total_pnl = sum(p["pnl"] for p in pnls)
        avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
        
        # Risk/Reward ratio
        risk_reward = abs(avg_win / avg_loss) if avg_loss != 0 else 0
        
        # Max drawdown
        cumulative_pnl = []
        running_total = 0
        for p in pnls:
            running_total += p["pnl"]
            cumulative_pnl.append(running_total)
        
        peak = cumulative_pnl[0] if cumulative_pnl else 0
        max_drawdown = 0
        for pnl in cumulative_pnl:
            if pnl > peak:
                peak = pnl
            drawdown = (peak - pnl)
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        # Best and worst trades
        best_trade = max(pnls, key=lambda x: x["pnl"]) if pnls else None
        worst_trade = min(pnls, key=lambda x: x["pnl"]) if pnls else None
        
        # Segment breakdown
        segment_stats = self._segment_breakdown(trade_pairs)
        
        # Time-based analysis
        time_analysis = self._time_analysis()
        
        return {
            "summary": {
                "total_trades": total_trades,
                "winning_trades": win_count,
                "losing_trades": loss_count,
                "win_rate": round(win_rate, 2),
                "total_pnl": round(total_pnl, 2),
                "avg_pnl_per_trade": round(avg_pnl, 2),
                "avg_winning_trade": round(avg_win, 2),
                "avg_losing_trade": round(avg_loss, 2),
                "risk_reward_ratio": round(risk_reward, 2),
                "max_drawdown": round(max_drawdown, 2)
            },
            "best_trade": best_trade,
            "worst_trade": worst_trade,
            "segment_breakdown": segment_stats,
            "time_analysis": time_analysis,
            "recent_streak": self._calculate_streak(pnls)
        }
    
    def _pair_trades(self) -> List[Dict]:
        """Pair buy and sell trades for same symbol"""
        # Group by symbol
        by_symbol = defaultdict(list)
        for t in self.trades:
            by_symbol[t.symbol].append(t)
        
        pairs = []
        for symbol, trades in by_symbol.items():
            buys = [t for t in trades if t.trade_type == "BUY"]
            sells = [t for t in trades if t.trade_type == "SELL"]
            
            # Simple pairing - match chronologically
            for i, buy in enumerate(buys):
                if i < len(sells):
                    sell = sells[i]
                    pairs.append({
                        "symbol": symbol,
                        "buy_qty": buy.quantity,
                        "buy_price": buy.price,
                        "sell_qty": sell.quantity,
                        "sell_price": sell.price,
                        "buy_time": buy.trade_time,
                        "sell_time": sell.trade_time,
                        "holding_time": (sell.trade_time - buy.trade_time).total_seconds() / 3600 if isinstance(buy.trade_time, datetime) and isinstance(sell.trade_time, datetime) else 0
                    })
        
        return pairs
    
    def _segment_breakdown(self, pairs: List[Dict]) -> Dict:
        """Break down performance by segment"""
        # Group original trades by segment
        eq_pnl = 0
        fno_pnl = 0
        eq_trades = 0
        fno_trades = 0
        
        for t in self.trades:
            if t.segment == "EQ":
                eq_trades += 1
            else:
                fno_trades += 1
        
        return {
            "equity": {"trades": eq_trades, "pnl": eq_pnl},
            "fno": {"trades": fno_trades, "pnl": fno_pnl}
        }
    
    def _time_analysis(self) -> Dict:
        """Analyze trading by time of day"""
        hour_stats = defaultdict(lambda: {"count": 0, "pnl": 0})
        
        for t in self.trades:
            if isinstance(t.trade_time, datetime):
                hour = t.trade_time.hour
                hour_stats[hour]["count"] += 1
        
        # Find best trading hour
        best_hour = max(hour_stats.items(), key=lambda x: x[1]["count"])[0] if hour_stats else 10
        
        return {
            "most_active_hour": best_hour,
            "hourly_distribution": dict(hour_stats)
        }
    
    def _calculate_streak(self, pnls: List[Dict]) -> Dict:
        """Calculate current winning/losing streak"""
        if not pnls:
            return {"type": "none", "count": 0}
        
        # Look at last 10 trades
        recent = pnls[-10:]
        
        current_streak = 0
        streak_type = "win" if recent[-1]["pnl"] > 0 else "loss"
        
        for p in reversed(recent):
            if (p["pnl"] > 0 and streak_type == "win") or (p["pnl"] < 0 and streak_type == "loss"):
                current_streak += 1
            else:
                break
        
        return {"type": streak_type, "count": current_streak}
    
    def _empty_metrics(self) -> Dict:
        return {
            "summary": {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0,
                "total_pnl": 0,
                "avg_pnl_per_trade": 0,
                "avg_winning_trade": 0,
                "avg_losing_trade": 0,
                "risk_reward_ratio": 0,
                "max_drawdown": 0
            },
            "best_trade": None,
            "worst_trade": None,
            "segment_breakdown": {},
            "time_analysis": {},
            "recent_streak": {"type": "none", "count": 0}
        }


# ============================================
# TRADE SUGGESTION ENGINE
# ============================================

class TradeSuggestionEngine:
    """
    Generate intelligent trade suggestions based on:
    1. User's trading history & patterns
    2. Current market conditions
    3. Technical indicators
    4. Risk management rules
    
    Strategies:
    - Momentum (follow the trend)
    - Mean Reversion (buy dips, sell rallies)
    - Breakout (trade range breaks)
    - Options strategies (based on IV, OI)
    """
    
    def __init__(self):
        self.user_metrics: Dict = {}
        self.market_data: Dict = {}
        self.scanner_data: Dict = {}
    
    def set_user_metrics(self, metrics: Dict):
        """Set user's trading metrics for personalization"""
        self.user_metrics = metrics
    
    def set_market_data(self, data: Dict):
        """Set current market data"""
        self.market_data = data
    
    def set_scanner_data(self, data: Dict):
        """Set scanner results for suggestions"""
        self.scanner_data = data
    
    def generate_suggestions(
        self, 
        max_suggestions: int = 5,
        risk_per_trade: float = 10000,  # Max risk per trade in INR
        preferred_timeframe: str = "INTRADAY"
    ) -> List[TradeSuggestion]:
        """
        Generate personalized trade suggestions
        
        Args:
            max_suggestions: Maximum number of suggestions
            risk_per_trade: Maximum risk amount per trade
            preferred_timeframe: INTRADAY, SWING, POSITIONAL
            
        Returns:
            List of TradeSuggestion objects
        """
        suggestions = []
        
        # 1. Get high-score stocks from scanners
        gainers = self.scanner_data.get("day_gainers", {}).get("data", [])[:10]
        losers = self.scanner_data.get("day_losers", {}).get("data", [])[:10]
        swing = self.scanner_data.get("swing", {}).get("data", [])[:10]
        
        # 2. User's historical win rate determines confidence adjustment
        user_win_rate = self.user_metrics.get("summary", {}).get("win_rate", 50)
        confidence_boost = 0 if user_win_rate < 50 else min(10, (user_win_rate - 50) / 5)
        
        # 3. Generate suggestions from scanners
        
        # Day Gainers - Momentum buys
        for stock in gainers[:2]:
            if stock.get("score", 0) >= 75:
                suggestion = self._create_momentum_suggestion(stock, "BUY", confidence_boost)
                if suggestion:
                    suggestions.append(suggestion)
        
        # Day Losers - Short or avoid
        for stock in losers[:2]:
            if stock.get("score", 0) >= 70:
                suggestion = self._create_momentum_suggestion(stock, "SELL", confidence_boost)
                if suggestion:
                    suggestions.append(suggestion)
        
        # Swing setups
        for stock in swing[:2]:
            if stock.get("score", 0) >= 70:
                suggestion = self._create_swing_suggestion(stock, confidence_boost)
                if suggestion:
                    suggestions.append(suggestion)
        
        # 4. Sort by confidence and limit
        suggestions = sorted(suggestions, key=lambda x: -x.confidence)[:max_suggestions]
        
        return suggestions
    
    def _create_momentum_suggestion(self, stock: Dict, action: str, confidence_boost: float) -> Optional[TradeSuggestion]:
        """Create momentum-based trade suggestion"""
        try:
            symbol = stock.get("symbol", "")
            ltp = float(stock.get("ltp", stock.get("price", 0)))
            score = int(stock.get("score", 0))
            
            if not symbol or ltp <= 0:
                return None
            
            # Calculate levels
            if action == "BUY":
                stop_loss = float(stock.get("stop_loss", ltp * 0.97))
                target_1 = float(stock.get("target_1", ltp * 1.02))
                target_2 = float(stock.get("target_2", ltp * 1.04))
            else:  # SELL
                stop_loss = ltp * 1.02
                target_1 = ltp * 0.98
                target_2 = ltp * 0.96
            
            # Risk reward
            risk = abs(ltp - stop_loss)
            reward = abs(target_1 - ltp)
            rr = round(reward / risk, 1) if risk > 0 else 0
            
            # Confidence based on score + user's track record
            base_confidence = min(score, 85)
            confidence = int(min(95, base_confidence + confidence_boost))
            
            # Reasons
            reasons = []
            score_details = stock.get("score_details", {})
            
            if score_details.get("volume_score", 0) >= 15:
                reasons.append("High volume confirms move")
            if score_details.get("ema_aligned"):
                reasons.append("EMAs aligned in trend direction")
            if score_details.get("range_position", 0) > 70:
                reasons.append("Trading near day's high - strong momentum")
            if action == "BUY":
                reasons.append(f"Gaining {stock.get('change_percent', 0):.1f}% with conviction")
            else:
                reasons.append(f"Falling {abs(stock.get('change_percent', 0)):.1f}% - weakness visible")
            
            # Position size based on risk
            position_size = int(10000 / risk) if risk > 0 else 0
            
            return TradeSuggestion(
                suggestion_id=f"MOM_{symbol}_{datetime.now().strftime('%H%M%S')}",
                symbol=symbol,
                action=action,
                segment="EQ",
                confidence=confidence,
                entry_price=round(ltp, 2),
                stop_loss=round(stop_loss, 2),
                target_1=round(target_1, 2),
                target_2=round(target_2, 2),
                reasons=reasons,
                strategy_type="MOMENTUM",
                timeframe="INTRADAY",
                risk_reward=f"1:{rr}",
                max_risk=round(risk * position_size, 2),
                position_size=position_size,
                valid_until=datetime.now() + timedelta(hours=4),
                based_on=["Price Action", "Volume", "EMA", "Relative Strength"]
            )
            
        except Exception as e:
            logger.error(f"Error creating momentum suggestion: {e}")
            return None
    
    def _create_swing_suggestion(self, stock: Dict, confidence_boost: float) -> Optional[TradeSuggestion]:
        """Create swing trade suggestion"""
        try:
            symbol = stock.get("symbol", "")
            ltp = float(stock.get("ltp", stock.get("price", 0)))
            score = int(stock.get("score", 0))
            direction = stock.get("direction", "bullish")
            
            if not symbol or ltp <= 0:
                return None
            
            action = "BUY" if direction == "bullish" else "SELL"
            
            # Swing targets are larger
            if action == "BUY":
                stop_loss = float(stock.get("stop_loss", ltp * 0.95))
                target_1 = float(stock.get("target_1", ltp * 1.05))
                target_2 = float(stock.get("target_2", ltp * 1.10))
            else:
                stop_loss = ltp * 1.05
                target_1 = ltp * 0.95
                target_2 = ltp * 0.90
            
            risk = abs(ltp - stop_loss)
            reward = abs(target_1 - ltp)
            rr = round(reward / risk, 1) if risk > 0 else 0
            
            confidence = int(min(90, score + confidence_boost))
            
            reasons = [
                f"Swing setup detected - {direction} bias",
                "EMA crossover or support/resistance bounce",
                "RSI in favorable zone",
                "5-10 day holding period expected"
            ]
            
            position_size = int(15000 / risk) if risk > 0 else 0
            
            return TradeSuggestion(
                suggestion_id=f"SWG_{symbol}_{datetime.now().strftime('%H%M%S')}",
                symbol=symbol,
                action=action,
                segment="EQ",
                confidence=confidence,
                entry_price=round(ltp, 2),
                stop_loss=round(stop_loss, 2),
                target_1=round(target_1, 2),
                target_2=round(target_2, 2),
                reasons=reasons,
                strategy_type="SWING",
                timeframe="SWING",
                risk_reward=f"1:{rr}",
                max_risk=round(risk * position_size, 2),
                position_size=position_size,
                valid_until=datetime.now() + timedelta(days=2),
                based_on=["EMA", "RSI", "Support/Resistance", "Volume Pattern"]
            )
            
        except Exception as e:
            logger.error(f"Error creating swing suggestion: {e}")
            return None


# ============================================
# UNIFIED TRADE ALGO SERVICE
# ============================================

class TradeAlgoService:
    """
    Main service that combines all functionality:
    - Auto-fetch trades from brokers
    - Analyze performance
    - Generate suggestions
    """
    
    def __init__(self):
        self.dhan_fetcher = DhanTradeFetcher()
        self.upstox_fetcher = UpstoxTradeFetcher()
        self.analytics = TradeAnalytics()
        self.suggestion_engine = TradeSuggestionEngine()
        
        # Cache
        self._trades_cache: List[Trade] = []
        self._positions_cache: List[Position] = []
        self._metrics_cache: Dict = {}
        self._last_fetch_time: datetime = None
        
        # Load saved credentials from Firestore
        self._load_saved_credentials()
    
    def _load_saved_credentials(self):
        """Load broker credentials from Firestore if available"""
        try:
            from services.firestore_db import get_firestore_client
            db = get_firestore_client()
            
            # Load Dhan credentials
            dhan_doc = db.collection("broker_credentials").document("dhan").get()
            if dhan_doc.exists:
                dhan_data = dhan_doc.to_dict()
                # Only use Firestore credentials if env vars not set
                if not self.dhan_fetcher.access_token:
                    self.dhan_fetcher.client_id = dhan_data.get("client_id", "")
                    self.dhan_fetcher.access_token = dhan_data.get("access_token", "")
                    logger.info(f"✅ Loaded Dhan credentials from Firestore")
            
            # Load Upstox credentials
            upstox_doc = db.collection("broker_credentials").document("upstox").get()
            if upstox_doc.exists:
                upstox_data = upstox_doc.to_dict()
                # Only use Firestore credentials if env vars not set
                if not self.upstox_fetcher.access_token:
                    self.upstox_fetcher.api_key = upstox_data.get("api_key", "")
                    self.upstox_fetcher.api_secret = upstox_data.get("api_secret", "")
                    self.upstox_fetcher.access_token = upstox_data.get("access_token", "")
                    logger.info(f"✅ Loaded Upstox credentials from Firestore")
                    
        except Exception as e:
            logger.warning(f"Could not load saved credentials: {e}")
    
    async def fetch_all_trades(self, force_refresh: bool = False) -> Dict:
        """
        Fetch trades from all configured brokers
        
        Returns combined trades with metadata
        """
        # Check cache (5 min validity)
        if not force_refresh and self._last_fetch_time:
            cache_age = (datetime.now() - self._last_fetch_time).seconds
            if cache_age < 300 and self._trades_cache:
                return {
                    "trades": [t.to_dict() for t in self._trades_cache],
                    "total_count": len(self._trades_cache),
                    "from_cache": True,
                    "cache_age_seconds": cache_age,
                    "brokers": self._get_broker_status()
                }
        
        all_trades = []
        broker_status = {}
        
        # Fetch from Dhan
        if self.dhan_fetcher.is_configured():
            try:
                dhan_trades = await self.dhan_fetcher.get_trades()
                all_trades.extend(dhan_trades)
                broker_status["dhan"] = {
                    "connected": True,
                    "trade_count": len(dhan_trades)
                }
            except Exception as e:
                broker_status["dhan"] = {"connected": False, "error": str(e)}
        else:
            broker_status["dhan"] = {"connected": False, "error": "Not configured"}
        
        # Fetch from Upstox
        if self.upstox_fetcher.is_configured():
            try:
                upstox_trades = await self.upstox_fetcher.get_trades()
                all_trades.extend(upstox_trades)
                broker_status["upstox"] = {
                    "connected": True,
                    "trade_count": len(upstox_trades)
                }
            except Exception as e:
                broker_status["upstox"] = {"connected": False, "error": str(e)}
        else:
            broker_status["upstox"] = {"connected": False, "error": "Not configured"}
        
        # Update cache
        self._trades_cache = all_trades
        self._last_fetch_time = datetime.now()
        
        return {
            "trades": [t.to_dict() for t in all_trades],
            "total_count": len(all_trades),
            "from_cache": False,
            "brokers": broker_status,
            "timestamp": datetime.now().isoformat()
        }
    
    async def fetch_all_positions(self) -> Dict:
        """Fetch positions from all brokers"""
        all_positions = []
        
        if self.dhan_fetcher.is_configured():
            dhan_positions = await self.dhan_fetcher.get_positions()
            all_positions.extend(dhan_positions)
        
        if self.upstox_fetcher.is_configured():
            upstox_positions = await self.upstox_fetcher.get_positions()
            all_positions.extend(upstox_positions)
        
        self._positions_cache = all_positions
        
        # Calculate total PnL
        total_pnl = sum(p.pnl for p in all_positions)
        
        return {
            "positions": [p.to_dict() for p in all_positions],
            "total_count": len(all_positions),
            "total_pnl": round(total_pnl, 2),
            "brokers": self._get_broker_status(),
            "timestamp": datetime.now().isoformat()
        }
    
    async def fetch_funds(self) -> Dict:
        """Fetch funds from all brokers"""
        funds = {"brokers": {}}
        total_available = 0
        
        if self.dhan_fetcher.is_configured():
            dhan_funds = await self.dhan_fetcher.get_funds()
            funds["brokers"]["dhan"] = dhan_funds
            total_available += dhan_funds.get("available_balance", 0)
        
        if self.upstox_fetcher.is_configured():
            upstox_funds = await self.upstox_fetcher.get_funds()
            funds["brokers"]["upstox"] = upstox_funds
            total_available += upstox_funds.get("available_balance", 0)
        
        funds["total_available"] = round(total_available, 2)
        funds["timestamp"] = datetime.now().isoformat()
        
        return funds
    
    async def fetch_orders(self) -> Dict:
        """Fetch today's orders from all brokers"""
        all_orders = []
        
        if self.dhan_fetcher.is_configured():
            dhan_orders = await self.dhan_fetcher.get_orders()
            for order in dhan_orders:
                order["broker"] = "dhan"
                all_orders.append(order)
        
        if self.upstox_fetcher.is_configured():
            upstox_orders = await self.upstox_fetcher.get_orders()
            for order in upstox_orders:
                order["broker"] = "upstox"
                all_orders.append(order)
        
        return {
            "orders": all_orders,
            "total_count": len(all_orders),
            "brokers": self._get_broker_status(),
            "timestamp": datetime.now().isoformat()
        }
    
    async def analyze_performance(self, force_refresh: bool = False) -> Dict:
        """Analyze trading performance"""
        # Fetch trades if needed
        if force_refresh or not self._trades_cache:
            await self.fetch_all_trades(force_refresh)
        
        # Run analytics
        self.analytics.load_trades(self._trades_cache)
        metrics = self.analytics.calculate_metrics()
        
        self._metrics_cache = metrics
        
        return {
            **metrics,
            "trade_count": len(self._trades_cache),
            "timestamp": datetime.now().isoformat()
        }
    
    async def get_trade_suggestions(
        self,
        scanner_data: Dict = None,
        max_suggestions: int = 5,
        risk_per_trade: float = 10000
    ) -> Dict:
        """
        Generate AI-powered trade suggestions
        
        Args:
            scanner_data: Scanner results to base suggestions on
            max_suggestions: Max number of suggestions
            risk_per_trade: Max risk in INR per trade
            
        Returns:
            Dict with suggestions and reasoning
        """
        # Get user metrics for personalization
        if not self._metrics_cache:
            await self.analyze_performance()
        
        self.suggestion_engine.set_user_metrics(self._metrics_cache)
        
        if scanner_data:
            self.suggestion_engine.set_scanner_data(scanner_data)
        
        # Generate suggestions
        suggestions = self.suggestion_engine.generate_suggestions(
            max_suggestions=max_suggestions,
            risk_per_trade=risk_per_trade
        )
        
        return {
            "suggestions": [s.to_dict() for s in suggestions],
            "count": len(suggestions),
            "user_win_rate": self._metrics_cache.get("summary", {}).get("win_rate", 0),
            "personalization_applied": bool(self._metrics_cache.get("summary", {}).get("total_trades", 0) > 5),
            "timestamp": datetime.now().isoformat()
        }
    
    def _get_broker_status(self) -> Dict:
        """Get broker connection status"""
        return {
            "dhan": {
                "configured": self.dhan_fetcher.is_configured(),
                "client_id": self.dhan_fetcher.client_id[:4] + "****" if self.dhan_fetcher.client_id else None
            },
            "upstox": {
                "configured": self.upstox_fetcher.is_configured()
            }
        }
    
    async def close(self):
        """Cleanup resources"""
        await self.dhan_fetcher.close()
        await self.upstox_fetcher.close()


# ============================================
# SINGLETON INSTANCE
# ============================================

_trade_algo_service: TradeAlgoService = None

def get_trade_algo_service() -> TradeAlgoService:
    """Get singleton instance of TradeAlgoService"""
    global _trade_algo_service
    if _trade_algo_service is None:
        _trade_algo_service = TradeAlgoService()
    return _trade_algo_service
