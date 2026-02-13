"""
VWAP Momentum Trading Strategy Backtest
=======================================
Backtests the VWAP bot strategy using Dhan API with real volume data.

Strategy Rules (ChartInk VWAP Logic):
1. BULLISH: [-1] Close > VWAP, [-2] Close > VWAP, [-2] Close > [-1] High
2. BEARISH: [-1] Close < VWAP, [-2] Close < VWAP, [-2] Close < [-1] Low
3. Stop Loss: 1% from entry
4. Target: 2% from entry
5. Max trades per day: 3

Usage:
    python run_vwap_backtest.py --symbol RELIANCE        # Backtest RELIANCE
    python run_vwap_backtest.py --symbol TCS --days 30   # TCS with 30 days
    python run_vwap_backtest.py --interval 5             # 5-minute candles
    
Dhan Token:
    Auto-loaded from DHAN_ACCESS_TOKEN env or .env file
"""

import sys
import os
import json
import logging
import argparse
import asyncio
import httpx

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, use env vars only
from datetime import datetime, timedelta, time
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

import yfinance as yf
import pandas as pd
import numpy as np


@dataclass
class VWAPTrade:
    """Single trade record"""
    entry_time: str
    entry_price: float
    exit_time: str = ""
    exit_price: float = 0.0
    direction: str = "LONG"  # LONG or SHORT
    quantity: int = 50
    pnl: float = 0.0
    pnl_percent: float = 0.0
    exit_reason: str = ""
    vwap_at_entry: float = 0.0
    volume_ratio: float = 0.0


@dataclass
class VWAPBacktestConfig:
    """Backtest configuration - matches VWAP Trading Bot settings"""
    capital: float = 100000
    lot_size: int = 50
    risk_per_trade: float = 2.0  # % of capital (same as bot)
    stop_loss_percent: float = 1.0  # 1% SL (same as bot)
    target_percent: float = 2.0  # 2% target (same as bot)
    trailing_sl_percent: float = 0.5
    max_trades_per_day: int = 3  # same as bot max_positions
    min_volume_ratio: float = 1.5  # same as bot
    market_start: time = time(9, 20)  # same as bot
    market_end: time = time(15, 0)  # same as bot (15:00)
    square_off_time: time = time(15, 15)  # same as bot
    use_trailing_sl: bool = True
    min_score: int = 70  # same as bot (VWAP score threshold)


@dataclass
class VWAPBacktestResult:
    """Backtest results"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    total_pnl_percent: float = 0.0
    avg_profit: float = 0.0
    avg_loss: float = 0.0
    max_profit: float = 0.0
    max_loss: float = 0.0
    max_drawdown: float = 0.0
    profit_factor: float = 0.0
    sharpe_ratio: float = 0.0
    trades: List[VWAPTrade] = field(default_factory=list)
    equity_curve: List[float] = field(default_factory=list)
    daily_pnl: Dict[str, float] = field(default_factory=dict)


class VWAPBacktester:
    """VWAP Momentum Strategy Backtester"""
    
    def __init__(self, config: VWAPBacktestConfig = None):
        self.config = config or VWAPBacktestConfig()
        self.trades: List[VWAPTrade] = []
        self.current_position: Optional[VWAPTrade] = None
        self.daily_trade_count = 0
        self.current_date = None
        self.equity = self.config.capital
        self.equity_curve = [self.config.capital]
        self.max_equity = self.config.capital
        self.max_drawdown = 0.0
    
    def calculate_vwap(self, df: pd.DataFrame, idx: int) -> float:
        """Calculate VWAP (or TWAP if volume unavailable) up to current candle for intraday"""
        # Get all candles from day start up to current
        current_time = df.iloc[idx]['timestamp']
        if not isinstance(current_time, pd.Timestamp):
            current_time = pd.to_datetime(current_time)
        
        current_date = current_time.date()
        
        # Filter candles for current day
        day_mask = df['timestamp'].dt.date == current_date
        day_indices = df.index[day_mask]
        valid_indices = day_indices[day_indices <= idx]
        
        if len(valid_indices) == 0:
            return df.iloc[idx]['close']
        
        day_data = df.loc[valid_indices]
        
        # Typical Price = (High + Low + Close) / 3
        typical_price = (day_data['high'] + day_data['low'] + day_data['close']) / 3
        
        # Check if volume data is available
        total_volume = day_data['volume'].sum()
        
        if total_volume > 0:
            # Standard VWAP = Cumulative(TP * Volume) / Cumulative(Volume)
            cumulative_tp_vol = (typical_price * day_data['volume']).sum()
            return cumulative_tp_vol / total_volume
        else:
            # Fallback: Time-Weighted Average Price (simple average of TP)
            return typical_price.mean()
    
    def calculate_rsi(self, df: pd.DataFrame, idx: int, period: int = 14) -> float:
        """Calculate RSI"""
        if idx < period:
            return 50.0
        
        close_prices = df.iloc[max(0, idx-period-1):idx+1]['close'].values
        deltas = np.diff(close_prices)
        
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:]) if len(gains) >= period else np.mean(gains)
        avg_loss = np.mean(losses[-period:]) if len(losses) >= period else np.mean(losses)
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def calculate_volume_ratio(self, df: pd.DataFrame, idx: int, period: int = 20) -> float:
        """Calculate volume ratio vs average"""
        if idx < period:
            return 1.0
        
        avg_volume = df.iloc[idx-period:idx]['volume'].mean()
        current_volume = df.iloc[idx]['volume']
        
        if avg_volume == 0:
            return 1.0
        
        return current_volume / avg_volume
    
    def check_entry_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        Check for entry signals - ChartInk VWAP Momentum Strategy (EXACT)
        
        Uses 10-minute candle logic (we use 15m as closest match)
        
        BULLISH Entry (LONG):
        1. [-1] Close > [-1] VWAP (previous candle above VWAP)
        2. [-2] Close > [-2] VWAP (2 candles ago above VWAP)
        3. [-2] Close > [-1] High (pullback - 2 candles ago close > previous candle high)
        
        BEARISH Entry (SHORT):
        1. [-1] Close < [-1] VWAP (previous candle below VWAP)
        2. [-2] Close < [-2] VWAP (2 candles ago below VWAP)
        3. [-2] Close < [-1] Low (pullback - 2 candles ago close < previous candle low)
        """
        if idx < 20:  # Need enough data for VWAP calculation
            return None
        
        # Get candle data
        prev = df.iloc[idx-1]       # [-1] - previous candle
        prev2 = df.iloc[idx-2]      # [-2] - 2 candles ago
        
        # Calculate VWAP for each candle
        vwap_prev = self.calculate_vwap(df, idx-1)    # [-1] VWAP
        vwap_prev2 = self.calculate_vwap(df, idx-2)   # [-2] VWAP
        
        # Skip if VWAP is 0 (data issue)
        if vwap_prev == 0 or vwap_prev2 == 0:
            return None
        
        # Get prices
        prev_close = prev['close']
        prev_high = prev['high']
        prev_low = prev['low']
        prev2_close = prev2['close']
        
        # ═══════════════════════════════════════════════════════════════
        # BULLISH Entry Conditions (ChartInk EXACT)
        # This finds stocks that had strong close 2 candles ago (above prev high)
        # but pulled back, still holding above VWAP
        # ═══════════════════════════════════════════════════════════════
        bullish = (
            prev_close > vwap_prev and      # [-1] Close > [-1] VWAP
            prev2_close > vwap_prev2 and    # [-2] Close > [-2] VWAP
            prev2_close > prev_high         # [-2] Close > [-1] High (pullback entry)
        )
        
        if bullish:
            return "LONG"
        
        # ═══════════════════════════════════════════════════════════════
        # BEARISH Entry Conditions (ChartInk EXACT)
        # This finds stocks that had weak close 2 candles ago (below prev low)
        # but bounced, still holding below VWAP
        # ═══════════════════════════════════════════════════════════════
        bearish = (
            prev_close < vwap_prev and      # [-1] Close < [-1] VWAP
            prev2_close < vwap_prev2 and    # [-2] Close < [-2] VWAP
            prev2_close < prev_low          # [-2] Close < [-1] Low (pullback entry)
        )
        
        if bearish:
            return "SHORT"
        
        return None
    
    def check_exit_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """Check exit conditions for current position"""
        if not self.current_position:
            return None
        
        current = df.iloc[idx]
        price = current['close']
        entry_price = self.current_position.entry_price
        direction = self.current_position.direction
        
        # Calculate P&L %
        if direction == "LONG":
            pnl_pct = ((price - entry_price) / entry_price) * 100
        else:
            pnl_pct = ((entry_price - price) / entry_price) * 100
        
        # Target hit
        if pnl_pct >= self.config.target_percent:
            return "TARGET"
        
        # Stop loss hit
        if pnl_pct <= -self.config.stop_loss_percent:
            return "STOP_LOSS"
        
        # Trailing stop (if enabled and in profit)
        if self.config.use_trailing_sl and pnl_pct > self.config.trailing_sl_percent:
            # Trail at trailing_sl_percent below peak
            # For simplicity, we'll check if profit dropped below trail level
            if pnl_pct < self.config.trailing_sl_percent:
                return "TRAILING_SL"
        
        # Time-based exit (end of day)
        current_time = pd.to_datetime(current['timestamp'])
        if current_time.time() >= self.config.square_off_time:
            return "SQUARE_OFF"
        
        return None
    
    def execute_entry(self, df: pd.DataFrame, idx: int, direction: str):
        """Execute entry trade"""
        current = df.iloc[idx]
        price = current['close']
        vwap = self.calculate_vwap(df, idx)
        volume_ratio = self.calculate_volume_ratio(df, idx)
        
        # Calculate position size based on risk
        risk_amount = self.equity * (self.config.risk_per_trade / 100)
        stop_distance = price * (self.config.stop_loss_percent / 100)
        quantity = int(risk_amount / stop_distance)
        quantity = max(self.config.lot_size, quantity)  # Minimum lot size
        
        self.current_position = VWAPTrade(
            entry_time=str(current['timestamp']),
            entry_price=price,
            direction=direction,
            quantity=quantity,
            vwap_at_entry=vwap,
            volume_ratio=volume_ratio
        )
        
        self.daily_trade_count += 1
        logger.debug(f"ENTRY: {direction} @ {price:.2f} (VWAP: {vwap:.2f}, Vol Ratio: {volume_ratio:.2f})")
    
    def execute_exit(self, df: pd.DataFrame, idx: int, reason: str):
        """Execute exit trade"""
        if not self.current_position:
            return
        
        current = df.iloc[idx]
        price = current['close']
        entry_price = self.current_position.entry_price
        direction = self.current_position.direction
        quantity = self.current_position.quantity
        
        # Calculate P&L
        if direction == "LONG":
            pnl = (price - entry_price) * quantity
            pnl_pct = ((price - entry_price) / entry_price) * 100
        else:
            pnl = (entry_price - price) * quantity
            pnl_pct = ((entry_price - price) / entry_price) * 100
        
        self.current_position.exit_time = str(current['timestamp'])
        self.current_position.exit_price = price
        self.current_position.pnl = pnl
        self.current_position.pnl_percent = pnl_pct
        self.current_position.exit_reason = reason
        
        self.trades.append(self.current_position)
        self.equity += pnl
        self.equity_curve.append(self.equity)
        
        # Track max drawdown
        if self.equity > self.max_equity:
            self.max_equity = self.equity
        drawdown = (self.max_equity - self.equity) / self.max_equity * 100
        if drawdown > self.max_drawdown:
            self.max_drawdown = drawdown
        
        logger.debug(f"EXIT ({reason}): {direction} @ {price:.2f}, P&L: ₹{pnl:.2f} ({pnl_pct:.2f}%)")
        
        self.current_position = None
    
    def run_backtest(self, df: pd.DataFrame) -> VWAPBacktestResult:
        """Run the backtest"""
        logger.info(f"Running VWAP backtest on {len(df)} candles...")
        
        # Reset state
        self.trades = []
        self.current_position = None
        self.equity = self.config.capital
        self.equity_curve = [self.config.capital]
        self.max_equity = self.config.capital
        self.max_drawdown = 0.0
        self.daily_trade_count = 0
        self.current_date = None
        
        signals_found = 0
        candles_in_hours = 0
        
        for idx in range(20, len(df)):
            current = df.iloc[idx]
            current_time = current['timestamp']
            
            # Ensure it's a datetime
            if not isinstance(current_time, pd.Timestamp):
                current_time = pd.to_datetime(current_time)
            
            # Reset daily trade count on new day
            if self.current_date != current_time.date():
                self.current_date = current_time.date()
                self.daily_trade_count = 0
            
            # Check if within trading hours
            candle_time = current_time.time()
            if candle_time < self.config.market_start:
                continue
            
            candles_in_hours += 1
            
            # If in position, check exit
            if self.current_position:
                exit_reason = self.check_exit_signal(df, idx)
                if exit_reason:
                    self.execute_exit(df, idx, exit_reason)
                continue
            
            # Check for new entry (if not max trades and within hours)
            if (self.daily_trade_count < self.config.max_trades_per_day and 
                candle_time < self.config.market_end):
                signal = self.check_entry_signal(df, idx)
                if signal:
                    signals_found += 1
                    self.execute_entry(df, idx, signal)
        
        # Close any open position at end
        if self.current_position:
            self.execute_exit(df, len(df)-1, "END_OF_DATA")
        
        logger.info(f"Candles in trading hours: {candles_in_hours}, Signals found: {signals_found}")
        
        # Calculate results
        return self._calculate_results()
    
    def _calculate_results(self) -> VWAPBacktestResult:
        """Calculate backtest metrics"""
        result = VWAPBacktestResult()
        result.trades = self.trades
        result.equity_curve = self.equity_curve
        result.total_trades = len(self.trades)
        
        if result.total_trades == 0:
            return result
        
        # Win/Loss analysis
        profits = [t.pnl for t in self.trades if t.pnl > 0]
        losses = [t.pnl for t in self.trades if t.pnl <= 0]
        
        result.winning_trades = len(profits)
        result.losing_trades = len(losses)
        result.win_rate = (result.winning_trades / result.total_trades) * 100
        
        result.total_pnl = sum(t.pnl for t in self.trades)
        result.total_pnl_percent = (result.total_pnl / self.config.capital) * 100
        
        result.avg_profit = np.mean(profits) if profits else 0
        result.avg_loss = np.mean(losses) if losses else 0
        result.max_profit = max(profits) if profits else 0
        result.max_loss = min(losses) if losses else 0
        result.max_drawdown = self.max_drawdown
        
        # Profit factor
        total_profit = sum(profits) if profits else 0
        total_loss = abs(sum(losses)) if losses else 0
        result.profit_factor = total_profit / total_loss if total_loss > 0 else float('inf')
        
        # Sharpe ratio (simplified)
        returns = [t.pnl_percent for t in self.trades]
        if len(returns) > 1:
            result.sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252) if np.std(returns) > 0 else 0
        
        # Daily P&L
        for trade in self.trades:
            date = trade.entry_time.split()[0] if ' ' in trade.entry_time else trade.entry_time[:10]
            result.daily_pnl[date] = result.daily_pnl.get(date, 0) + trade.pnl
        
        return result


async def fetch_dhan_intraday_data(
    access_token: str,
    symbol: str = "NIFTY",
    days_back: int = 30,
    interval: str = "5"
) -> pd.DataFrame:
    """
    Fetch intraday data from Dhan API with real volume data.
    
    Note: Dhan intraday API only returns recent data (today/yesterday).
    For historical backtesting, this fetches as much as available.
    
    Args:
        access_token: Dhan API access token
        symbol: Symbol to fetch (NIFTY, BANKNIFTY, etc.)
        days_back: Number of days of historical data
        interval: Candle interval - 1, 5, 15, 25, 60 minutes
    
    Returns:
        DataFrame with timestamp, open, high, low, close, volume
    """
    # Symbol mapping for Dhan API (V2)
    # Note: Index data (IDX_I) not available in historical charts API
    # Use equity stocks or ETFs instead
    SYMBOL_MAP = {
        # Index-tracking ETFs (best for NIFTY backtesting)
        "NIFTYBEES": {"security_id": "2723", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "BANKBEES": {"security_id": "2740", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        
        # Large Cap Stocks  
        "HDFCBANK": {"security_id": "1333", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "RELIANCE": {"security_id": "2885", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "TCS": {"security_id": "11536", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "INFY": {"security_id": "1594", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "ICICIBANK": {"security_id": "4963", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "SBIN": {"security_id": "3045", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "BHARTIARTL": {"security_id": "10604", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "HINDUNILVR": {"security_id": "1394", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "ITC": {"security_id": "1660", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "LT": {"security_id": "11483", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "KOTAKBANK": {"security_id": "1922", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "AXISBANK": {"security_id": "5900", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "MARUTI": {"security_id": "10999", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "TATAMOTORS": {"security_id": "3456", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        "TATASTEEL": {"security_id": "3499", "exchange": "NSE_EQ", "instrument": "EQUITY"},
        
        # Fallback - Index segment (may not work for historical)
        "NIFTY": {"security_id": "26000", "exchange": "IDX_I", "instrument": "INDEX"},
        "BANKNIFTY": {"security_id": "26009", "exchange": "IDX_I", "instrument": "INDEX"},
    }
    
    symbol_info = SYMBOL_MAP.get(symbol.upper())
    if not symbol_info:
        logger.error(f"Unknown symbol: {symbol}. Available: {list(SYMBOL_MAP.keys())}")
        return pd.DataFrame()
    
    logger.info(f"Fetching {symbol} intraday data from Dhan API: {days_back} days, {interval}min candles")
    
    # Calculate date range
    to_date = datetime.now()
    from_date = to_date - timedelta(days=days_back)
    
    headers = {
        "access-token": access_token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    # Use V2 API with datetime format (not just date)
    payload = {
        "securityId": symbol_info["security_id"],
        "exchangeSegment": symbol_info["exchange"],
        "instrument": symbol_info["instrument"],
        "interval": interval,
        "oi": False,
        "fromDate": from_date.strftime("%Y-%m-%d 09:15:00"),
        "toDate": to_date.strftime("%Y-%m-%d 15:30:00")
    }
    
    logger.info(f"Request payload: {payload}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use V2 API endpoint
            response = await client.post(
                "https://api.dhan.co/v2/charts/intraday", 
                json=payload, 
                headers=headers
            )
            
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.warning(f"V2 Intraday API error: {response.status_code} - {response.text[:500]}")
                
                # Try with NSE_EQ for index (some indices use equity segment for data)
                if symbol_info["exchange"] == "IDX_I":
                    logger.info("Trying with NSE_FNO segment...")
                    payload["exchangeSegment"] = "NSE_FNO"
                    payload["instrument"] = "FUTIDX"
                    response = await client.post(
                        "https://api.dhan.co/v2/charts/intraday",
                        json=payload,
                        headers=headers
                    )
                    logger.info(f"NSE_FNO Response: {response.status_code}")
                    
                if response.status_code != 200:
                    logger.error(f"All attempts failed: {response.status_code}")
                    return pd.DataFrame()
            
            data = response.json()
            logger.info(f"Raw Dhan response keys: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")
            
            # Dhan returns: {open: [], high: [], low: [], close: [], volume: [], start_Time: []}
            if not data or 'open' not in data:
                logger.error(f"Invalid Dhan response: {str(data)[:200]}")
                return pd.DataFrame()
            
            # Get timestamps and check format
            timestamps = data.get('start_Time', data.get('timestamp', []))
            if timestamps:
                logger.info(f"Sample timestamps: {timestamps[:3]}")
                
                # Dhan timestamps are in epoch seconds
                # Check magnitude to determine format
                if timestamps[0] > 1e12:  # Milliseconds
                    df_ts = pd.to_datetime(timestamps, unit='ms')
                else:  # Seconds
                    df_ts = pd.to_datetime(timestamps, unit='s')
            else:
                logger.error("No timestamps in response")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame({
                'timestamp': df_ts,
                'open': data['open'],
                'high': data['high'],
                'low': data['low'],
                'close': data['close'],
                'volume': data.get('volume', [0] * len(data['open']))
            })
            
            # Sort by timestamp
            df = df.sort_values('timestamp').reset_index(drop=True)
            
            # Filter market hours (9:15 AM - 3:30 PM IST)
            df['hour'] = df['timestamp'].dt.hour
            df['minute'] = df['timestamp'].dt.minute
            df = df[
                ((df['hour'] == 9) & (df['minute'] >= 15)) |
                ((df['hour'] > 9) & (df['hour'] < 15)) |
                ((df['hour'] == 15) & (df['minute'] <= 30))
            ]
            df = df.drop(columns=['hour', 'minute'])
            
            logger.info(f"✅ Fetched {len(df)} candles from Dhan with real volume data")
            
            # Check volume data
            avg_volume = df['volume'].mean()
            logger.info(f"📊 Average volume: {avg_volume:,.0f}")
            
            return df.reset_index(drop=True)
            
    except Exception as e:
        logger.error(f"Error fetching Dhan data: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


def generate_synthetic_volume(df: pd.DataFrame, base_volume: int = 100000) -> pd.DataFrame:
    """
    Generate synthetic volume based on price volatility.
    Higher volatility = higher volume (typical market behavior).
    
    This allows VWAP calculations when real volume data is unavailable.
    """
    df = df.copy()
    
    # Calculate price range as proxy for volatility
    df['range'] = df['high'] - df['low']
    avg_range = df['range'].mean()
    
    # Generate volume proportional to range
    if avg_range > 0:
        df['volume'] = (df['range'] / avg_range * base_volume).astype(int)
        # Add some randomness
        np.random.seed(42)
        df['volume'] = (df['volume'] * (0.8 + np.random.random(len(df)) * 0.4)).astype(int)
    else:
        df['volume'] = base_volume
    
    # Market open typically has higher volume
    if 'timestamp' in df.columns:
        df['hour'] = df['timestamp'].dt.hour
        df['minute'] = df['timestamp'].dt.minute
        
        # First 30 mins: 2x volume, Last 30 mins: 1.5x volume
        mask_open = (df['hour'] == 9) & (df['minute'] < 45)
        mask_close = (df['hour'] == 15) & (df['minute'] > 0)
        
        df.loc[mask_open, 'volume'] = (df.loc[mask_open, 'volume'] * 2).astype(int)
        df.loc[mask_close, 'volume'] = (df.loc[mask_close, 'volume'] * 1.5).astype(int)
        
        df = df.drop(columns=['hour', 'minute'])
    
    df = df.drop(columns=['range'])
    
    logger.info(f"🔧 Generated synthetic volume (avg: {df['volume'].mean():,.0f})")
    return df


def fetch_intraday_data(period: str = "1mo", interval: str = "5m", use_synthetic_volume: bool = True) -> pd.DataFrame:
    """Fetch intraday Nifty data from Yahoo Finance (WARNING: Volume data may be zero)"""
    logger.info(f"Fetching NIFTY intraday data from Yahoo: period={period}, interval={interval}")
    logger.warning("⚠️ Yahoo Finance may return zero volume for Indian indices!")
    
    try:
        ticker = yf.Ticker("^NSEI")
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            logger.warning("Trying alternative ticker...")
            ticker = yf.Ticker("NIFTY50.NS")
            df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            logger.error("Could not fetch data")
            return pd.DataFrame()
        
        df = df.rename(columns={
            'Open': 'open', 'High': 'high', 'Low': 'low',
            'Close': 'close', 'Volume': 'volume'
        })
        df = df.reset_index()
        # Handle both 'Datetime' and 'Date' index names
        if 'Datetime' in df.columns:
            df = df.rename(columns={'Datetime': 'timestamp'})
        elif 'Date' in df.columns:
            df = df.rename(columns={'Date': 'timestamp'})
        
        # Ensure timestamp is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        logger.info(f"Fetched {len(df)} intraday candles")
        
        # Check if volume is zero and generate synthetic if requested
        if use_synthetic_volume and df['volume'].mean() == 0:
            logger.info("Volume is zero - generating synthetic volume...")
            df = generate_synthetic_volume(df)
        
        return df
        
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        return pd.DataFrame()


def format_currency(amount: float) -> str:
    """Format as Indian currency"""
    if amount >= 0:
        return f"₹{amount:,.2f}"
    return f"-₹{abs(amount):,.2f}"


def print_results(result: VWAPBacktestResult, config: VWAPBacktestConfig):
    """Print formatted results"""
    print("\n" + "="*80)
    print("           VWAP MOMENTUM STRATEGY - BACKTEST RESULTS")
    print("="*80)
    
    print(f"\n📊 Configuration:")
    print(f"   Capital: {format_currency(config.capital)}")
    print(f"   Risk per Trade: {config.risk_per_trade}%")
    print(f"   Stop Loss: {config.stop_loss_percent}%")
    print(f"   Target: {config.target_percent}%")
    print(f"   Max Trades/Day: {config.max_trades_per_day}")
    
    print(f"\n📈 Performance Summary:")
    print("-" * 50)
    print(f"   Total Trades:     {result.total_trades}")
    print(f"   Winning Trades:   {result.winning_trades}")
    print(f"   Losing Trades:    {result.losing_trades}")
    print(f"   Win Rate:         {result.win_rate:.1f}%")
    print(f"   Total P&L:        {format_currency(result.total_pnl)} ({result.total_pnl_percent:.2f}%)")
    print(f"   Avg Profit:       {format_currency(result.avg_profit)}")
    print(f"   Avg Loss:         {format_currency(result.avg_loss)}")
    print(f"   Max Profit:       {format_currency(result.max_profit)}")
    print(f"   Max Loss:         {format_currency(result.max_loss)}")
    print(f"   Max Drawdown:     {result.max_drawdown:.2f}%")
    print(f"   Profit Factor:    {result.profit_factor:.2f}")
    print(f"   Sharpe Ratio:     {result.sharpe_ratio:.2f}")
    
    # Rating
    if result.win_rate >= 60 and result.profit_factor >= 1.5:
        rating = "✅ EXCELLENT - Highly Recommended"
    elif result.win_rate >= 50 and result.profit_factor >= 1.2:
        rating = "🟡 GOOD - Can be used with caution"
    else:
        rating = "❌ POOR - Needs optimization"
    
    print(f"\n   Rating: {rating}")
    
    # Recent trades
    if result.trades:
        print(f"\n📋 Recent Trades (Last 10):")
        print("-" * 80)
        print(f"{'Entry Time':<20} {'Dir':<6} {'Entry':>10} {'Exit':>10} {'P&L':>12} {'Reason':<15}")
        print("-" * 80)
        for trade in result.trades[-10:]:
            entry_time = trade.entry_time[-8:] if len(trade.entry_time) > 8 else trade.entry_time
            print(f"{entry_time:<20} {trade.direction:<6} {trade.entry_price:>10.2f} {trade.exit_price:>10.2f} {format_currency(trade.pnl):>12} {trade.exit_reason:<15}")
    
    # Daily P&L
    if result.daily_pnl:
        print(f"\n📅 Daily P&L:")
        print("-" * 40)
        for date, pnl in sorted(result.daily_pnl.items())[-10:]:
            emoji = "🟢" if pnl >= 0 else "🔴"
            print(f"   {date}: {emoji} {format_currency(pnl)}")
    
    print("\n" + "="*80)


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="VWAP Momentum Strategy Backtest",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Use Yahoo Finance with synthetic volume (default)
  python run_vwap_backtest.py

  # Use Dhan API with real volume data (if available)
  python run_vwap_backtest.py --dhan YOUR_ACCESS_TOKEN

  # Custom symbol and interval
  python run_vwap_backtest.py --dhan TOKEN --symbol HDFCBANK --interval 15
  
  # Disable synthetic volume (raw Yahoo data)
  python run_vwap_backtest.py --no-synthetic
        """
    )
    parser.add_argument(
        "--dhan", 
        type=str, 
        default=os.environ.get("DHAN_ACCESS_TOKEN", ""),
        help="Dhan API access token (auto-loads from DHAN_ACCESS_TOKEN env)"
    )
    parser.add_argument(
        "--symbol", 
        type=str, 
        default="RELIANCE",
        help="Symbol to backtest (RELIANCE, HDFCBANK, TCS, etc.)"
    )
    parser.add_argument(
        "--interval", 
        type=str, 
        default="5",
        help="Candle interval in minutes (5 or 10 for ChartInk strategy)"
    )
    parser.add_argument(
        "--days", 
        type=int, 
        default=30,
        help="Number of days of historical data"
    )
    parser.add_argument(
        "--no-synthetic",
        action="store_true",
        help="Disable synthetic volume generation (use raw Yahoo data)"
    )
    
    args = parser.parse_args()
    use_synthetic = not args.no_synthetic
    
    print("\n🚀 Starting VWAP Momentum Strategy Backtest...")
    print("="*60)
    
    # Fetch data - ALWAYS use Dhan API
    if not args.dhan:
        print("❌ ERROR: Dhan API token not found!")
        print("   Set DHAN_ACCESS_TOKEN environment variable")
        print("   Or use: --dhan YOUR_TOKEN")
        return
    
    print(f"📡 Using Dhan API for real market data")
    print(f"   Symbol: {args.symbol}")
    print(f"   Interval: {args.interval} minutes")
    print(f"   Days: {args.days}")
    
    # Run async Dhan data fetch
    df = asyncio.run(fetch_dhan_intraday_data(
        access_token=args.dhan,
        symbol=args.symbol,
        days_back=args.days,
        interval=args.interval
    ))
    
    if df.empty:
        print("❌ Failed to fetch data")
        return
    
    print(f"✅ Loaded {len(df)} intraday candles")
    print(f"   From: {df['timestamp'].iloc[0]}")
    print(f"   To:   {df['timestamp'].iloc[-1]}")
    
    # Check volume data quality
    avg_volume = df['volume'].mean()
    non_zero_volume_pct = (df['volume'] > 0).mean() * 100
    print(f"   Avg Volume: {avg_volume:,.0f}")
    print(f"   Non-zero Volume: {non_zero_volume_pct:.1f}%")
    
    if avg_volume == 0 or non_zero_volume_pct < 50:
        print("\n⚠️  WARNING: Volume data is mostly ZERO!")
        print("   VWAP calculations will be inaccurate.")
        print("   Use --dhan YOUR_TOKEN for real volume data.")
    
    # Configure backtest - using VWAP Bot's exact configuration
    print("\n📌 Using VWAP Bot Configuration:")
    config = VWAPBacktestConfig()  # Use defaults matching bot
    print(f"   Capital: ₹{config.capital:,.0f}")
    print(f"   Risk/Trade: {config.risk_per_trade}%")
    print(f"   Stop Loss: {config.stop_loss_percent}%")
    print(f"   Target: {config.target_percent}%")
    print(f"   Min Score: {config.min_score}")
    print(f"   Min Volume Ratio: {config.min_volume_ratio}x")
    print(f"   Max Trades/Day: {config.max_trades_per_day}")
    print(f"   Trading Hours: {config.market_start} - {config.market_end}")
    
    # Run backtest
    backtester = VWAPBacktester(config)
    result = backtester.run_backtest(df)
    
    # Print results
    print_results(result, config)
    
    # Save results
    results_path = Path(__file__).parent / "vwap_backtest_results.json"
    with open(results_path, 'w') as f:
        json.dump({
            'config': {
                'capital': config.capital,
                'risk_per_trade': config.risk_per_trade,
                'stop_loss_percent': config.stop_loss_percent,
                'target_percent': config.target_percent,
                'max_trades_per_day': config.max_trades_per_day
            },
            'results': {
                'total_trades': result.total_trades,
                'winning_trades': result.winning_trades,
                'losing_trades': result.losing_trades,
                'win_rate': result.win_rate,
                'total_pnl': result.total_pnl,
                'total_pnl_percent': result.total_pnl_percent,
                'profit_factor': result.profit_factor,
                'sharpe_ratio': result.sharpe_ratio,
                'max_drawdown': result.max_drawdown
            },
            'trades': [
                {
                    'entry_time': t.entry_time,
                    'exit_time': t.exit_time,
                    'direction': t.direction,
                    'entry_price': t.entry_price,
                    'exit_price': t.exit_price,
                    'pnl': t.pnl,
                    'pnl_percent': t.pnl_percent,
                    'exit_reason': t.exit_reason
                }
                for t in result.trades
            ],
            'daily_pnl': result.daily_pnl
        }, f, indent=2)
    
    print(f"\n📁 Results saved to: {results_path}")
    print("\n✅ VWAP Backtest Complete!")


if __name__ == "__main__":
    main()
