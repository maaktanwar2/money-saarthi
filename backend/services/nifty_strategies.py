"""
Nifty Intraday Trading Strategies Service
==========================================
Based on extensive research from Zerodha Varsity, Elearnmarkets, and proven methods.

Strategies Implemented:
1. Supertrend Strategy - Trend following with ATR-based stops
2. Opening Range Breakout (ORB) - First 15/30 min breakout
3. RSI Mean Reversion - Overbought/Oversold reversals
4. Moving Average Crossover - 9/21 EMA crossover
5. Bollinger Bands Squeeze - Volatility breakout
6. CPR (Central Pivot Range) - Support/Resistance levels
7. VWAP Strategy - Volume-weighted intraday levels
8. Momentum Strategy - Price momentum with volume
9. 9:20 AM Candle Strategy - First candle breakout
10. Open High/Low Strategy - Open = High/Low signals

Author: Money Saarthi AI Trading System
Last Updated: January 2025
"""

import numpy as np
import pandas as pd
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
import math

logger = logging.getLogger(__name__)


class SignalType(Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    EXIT_LONG = "EXIT_LONG"
    EXIT_SHORT = "EXIT_SHORT"


class StrategyName(Enum):
    SUPERTREND = "supertrend"
    ORB = "orb_breakout"
    RSI_REVERSAL = "rsi_reversal"
    EMA_CROSSOVER = "ema_crossover"
    BOLLINGER_SQUEEZE = "bollinger_squeeze"
    CPR_PIVOT = "cpr_pivot"
    VWAP_STRATEGY = "vwap_strategy"
    MOMENTUM = "momentum"
    NINE_TWENTY = "nine_twenty"
    OPEN_HIGH_LOW = "open_high_low"


@dataclass
class TradingSignal:
    """Trading signal from strategy"""
    strategy: str
    signal: SignalType
    entry_price: float
    stop_loss: float
    target1: float
    target2: float
    target3: Optional[float] = None
    confidence: float = 0.0  # 0-100%
    risk_reward: float = 0.0
    reason: str = ""
    timestamp: str = ""
    additional_data: Dict = field(default_factory=dict)


@dataclass
class BacktestTrade:
    """Single backtested trade"""
    entry_date: str
    entry_time: str
    entry_price: float
    exit_date: str
    exit_time: str
    exit_price: float
    signal_type: str  # BUY or SELL
    pnl: float
    pnl_percent: float
    exit_reason: str  # target, stop_loss, time_exit


@dataclass
class StrategyBacktestResult:
    """Backtest result for a strategy"""
    strategy_name: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    total_pnl_percent: float
    avg_profit: float
    avg_loss: float
    max_profit: float
    max_loss: float
    max_drawdown: float
    profit_factor: float
    sharpe_ratio: float
    avg_holding_period: float
    trades: List[BacktestTrade] = field(default_factory=list)
    equity_curve: List[float] = field(default_factory=list)
    monthly_returns: Dict = field(default_factory=dict)


class NiftyTradingStrategies:
    """
    Complete Nifty Intraday Trading Strategies
    
    Each strategy includes:
    - Signal generation logic
    - Entry/Exit rules
    - Risk management (SL, Targets)
    - Backtesting capability
    - Confidence scoring
    """
    
    def __init__(self, symbol: str = "NIFTY"):
        self.symbol = symbol
        self.lot_size = 65 if symbol == "NIFTY" else 30  # BANKNIFTY = 30 (NSE Feb 2026)
        
        # Default strategy parameters (can be customized)
        self.strategy_params = {
            StrategyName.SUPERTREND: {
                "period": 10,
                "multiplier": 3.0,
                "stop_loss_atr_mult": 1.5,
                "target1_atr_mult": 2.0,
                "target2_atr_mult": 3.0
            },
            StrategyName.ORB: {
                "breakout_minutes": 15,
                "volume_threshold": 1.5,  # 1.5x avg volume
                "atr_filter": 0.5,  # Minimum 0.5 ATR move
                "stop_loss_percent": 0.3,
                "target_percent": 0.5
            },
            StrategyName.RSI_REVERSAL: {
                "period": 14,
                "oversold": 30,
                "overbought": 70,
                "divergence_lookback": 5,
                "stop_loss_atr_mult": 1.5
            },
            StrategyName.EMA_CROSSOVER: {
                "fast_period": 9,
                "slow_period": 21,
                "trend_period": 55,
                "volume_filter": True
            },
            StrategyName.BOLLINGER_SQUEEZE: {
                "period": 20,
                "std_dev": 2.0,
                "squeeze_threshold": 0.5,  # Band width < 0.5% triggers squeeze
                "breakout_confirm_bars": 2
            },
            StrategyName.CPR_PIVOT: {
                "pivot_type": "standard",  # standard, fibonacci, camarilla
                "tc_bc_buffer": 0.1,  # 0.1% buffer
                "virgin_cpr_weight": 1.5
            },
            StrategyName.VWAP_STRATEGY: {
                "deviation_bands": [1, 2],  # Standard deviations
                "volume_profile": True,
                "reversion_threshold": 0.5  # 0.5% from VWAP
            },
            StrategyName.MOMENTUM: {
                "lookback_days": 5,
                "momentum_threshold": 2,  # 2% minimum move
                "volume_confirmation": True,
                "rsi_filter": [40, 60]  # RSI between 40-60 for continuation
            },
            StrategyName.NINE_TWENTY: {
                "entry_time": "09:20",
                "exit_time": "15:15",
                "buffer_percent": 0.1,  # 0.1% buffer above/below high/low
                "stop_loss_percent": 0.5
            },
            StrategyName.OPEN_HIGH_LOW: {
                "wait_minutes": 15,
                "vwap_filter": True,
                "volume_confirmation": True,
                "target_percent": 0.5
            }
        }
        
        # Historical win rates (based on research)
        self.historical_win_rates = {
            StrategyName.SUPERTREND: 0.58,
            StrategyName.ORB: 0.55,
            StrategyName.RSI_REVERSAL: 0.52,
            StrategyName.EMA_CROSSOVER: 0.54,
            StrategyName.BOLLINGER_SQUEEZE: 0.60,
            StrategyName.CPR_PIVOT: 0.58,
            StrategyName.VWAP_STRATEGY: 0.56,
            StrategyName.MOMENTUM: 0.55,
            StrategyName.NINE_TWENTY: 0.62,
            StrategyName.OPEN_HIGH_LOW: 0.58
        }
    
    # ============================================
    # 1. SUPERTREND STRATEGY
    # ============================================
    
    def calculate_supertrend(
        self, 
        data: pd.DataFrame,
        period: int = None,
        multiplier: float = None
    ) -> pd.DataFrame:
        """
        Calculate Supertrend indicator
        
        Supertrend = (High + Low) / 2 ± (Multiplier × ATR)
        
        Parameters:
        - period: ATR period (default 10)
        - multiplier: ATR multiplier (default 3.0)
        
        Returns DataFrame with supertrend values and signals
        """
        params = self.strategy_params[StrategyName.SUPERTREND]
        period = period or params["period"]
        multiplier = multiplier or params["multiplier"]
        
        df = data.copy()
        
        # Calculate ATR
        df['tr1'] = abs(df['high'] - df['low'])
        df['tr2'] = abs(df['high'] - df['close'].shift(1))
        df['tr3'] = abs(df['low'] - df['close'].shift(1))
        df['tr'] = df[['tr1', 'tr2', 'tr3']].max(axis=1)
        df['atr'] = df['tr'].rolling(window=period).mean()
        
        # Calculate basic upper and lower bands
        df['basic_ub'] = (df['high'] + df['low']) / 2 + (multiplier * df['atr'])
        df['basic_lb'] = (df['high'] + df['low']) / 2 - (multiplier * df['atr'])
        
        # Calculate final bands
        df['final_ub'] = df['basic_ub']
        df['final_lb'] = df['basic_lb']
        
        for i in range(period, len(df)):
            if df['basic_ub'].iloc[i] < df['final_ub'].iloc[i-1] or df['close'].iloc[i-1] > df['final_ub'].iloc[i-1]:
                df.loc[df.index[i], 'final_ub'] = df['basic_ub'].iloc[i]
            else:
                df.loc[df.index[i], 'final_ub'] = df['final_ub'].iloc[i-1]
                
            if df['basic_lb'].iloc[i] > df['final_lb'].iloc[i-1] or df['close'].iloc[i-1] < df['final_lb'].iloc[i-1]:
                df.loc[df.index[i], 'final_lb'] = df['basic_lb'].iloc[i]
            else:
                df.loc[df.index[i], 'final_lb'] = df['final_lb'].iloc[i-1]
        
        # Calculate supertrend
        df['supertrend'] = np.nan
        df['supertrend_direction'] = np.nan
        
        for i in range(period, len(df)):
            if i == period:
                df.loc[df.index[i], 'supertrend'] = df['final_ub'].iloc[i]
                df.loc[df.index[i], 'supertrend_direction'] = -1
            else:
                if df['supertrend'].iloc[i-1] == df['final_ub'].iloc[i-1]:
                    if df['close'].iloc[i] <= df['final_ub'].iloc[i]:
                        df.loc[df.index[i], 'supertrend'] = df['final_ub'].iloc[i]
                        df.loc[df.index[i], 'supertrend_direction'] = -1
                    else:
                        df.loc[df.index[i], 'supertrend'] = df['final_lb'].iloc[i]
                        df.loc[df.index[i], 'supertrend_direction'] = 1
                else:
                    if df['close'].iloc[i] >= df['final_lb'].iloc[i]:
                        df.loc[df.index[i], 'supertrend'] = df['final_lb'].iloc[i]
                        df.loc[df.index[i], 'supertrend_direction'] = 1
                    else:
                        df.loc[df.index[i], 'supertrend'] = df['final_ub'].iloc[i]
                        df.loc[df.index[i], 'supertrend_direction'] = -1
        
        # Generate signals
        df['supertrend_signal'] = np.where(
            (df['supertrend_direction'] == 1) & (df['supertrend_direction'].shift(1) == -1),
            'BUY',
            np.where(
                (df['supertrend_direction'] == -1) & (df['supertrend_direction'].shift(1) == 1),
                'SELL',
                'HOLD'
            )
        )
        
        return df
    
    def get_supertrend_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate Supertrend trading signal"""
        df = self.calculate_supertrend(data)
        params = self.strategy_params[StrategyName.SUPERTREND]
        
        latest = df.iloc[-1]
        atr = latest['atr']
        
        if latest['supertrend_signal'] == 'BUY':
            entry = latest['close']
            stop_loss = entry - (params["stop_loss_atr_mult"] * atr)
            target1 = entry + (params["target1_atr_mult"] * atr)
            target2 = entry + (params["target2_atr_mult"] * atr)
            
            return TradingSignal(
                strategy=StrategyName.SUPERTREND.value,
                signal=SignalType.BUY,
                entry_price=round(entry, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=self._calculate_confidence(df, 'supertrend'),
                risk_reward=round((target1 - entry) / (entry - stop_loss), 2),
                reason="Supertrend turned bullish - price crossed above supertrend line",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "supertrend_value": round(latest['supertrend'], 2),
                    "atr": round(atr, 2),
                    "direction": "UP"
                }
            )
        
        elif latest['supertrend_signal'] == 'SELL':
            entry = latest['close']
            stop_loss = entry + (params["stop_loss_atr_mult"] * atr)
            target1 = entry - (params["target1_atr_mult"] * atr)
            target2 = entry - (params["target2_atr_mult"] * atr)
            
            return TradingSignal(
                strategy=StrategyName.SUPERTREND.value,
                signal=SignalType.SELL,
                entry_price=round(entry, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=self._calculate_confidence(df, 'supertrend'),
                risk_reward=round((entry - target1) / (stop_loss - entry), 2),
                reason="Supertrend turned bearish - price crossed below supertrend line",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "supertrend_value": round(latest['supertrend'], 2),
                    "atr": round(atr, 2),
                    "direction": "DOWN"
                }
            )
        
        return TradingSignal(
            strategy=StrategyName.SUPERTREND.value,
            signal=SignalType.HOLD,
            entry_price=0,
            stop_loss=0,
            target1=0,
            target2=0,
            reason="No clear signal - wait for trend change",
            timestamp=datetime.now().isoformat()
        )
    
    # ============================================
    # 2. OPENING RANGE BREAKOUT (ORB) STRATEGY
    # ============================================
    
    def calculate_orb_levels(
        self, 
        data: pd.DataFrame,
        breakout_minutes: int = None
    ) -> Dict:
        """
        Calculate Opening Range Breakout levels
        
        ORB identifies the high and low of the first N minutes
        and trades breakouts from this range.
        
        Parameters:
        - breakout_minutes: Minutes for opening range (15/30/60)
        
        Returns dict with ORB levels and signal
        """
        params = self.strategy_params[StrategyName.ORB]
        breakout_minutes = breakout_minutes or params["breakout_minutes"]
        
        # Assuming data has datetime index or 'time' column
        df = data.copy()
        
        # Get opening range (first N minutes candles)
        if 'time' in df.columns:
            market_open = datetime.strptime("09:15", "%H:%M").time()
            orb_end = (datetime.combine(datetime.today(), market_open) + 
                       timedelta(minutes=breakout_minutes)).time()
            
            opening_range = df[df['time'] <= orb_end]
        else:
            # Assume first N rows are opening range
            candles_in_range = max(1, breakout_minutes // 5)  # Assuming 5-min candles
            opening_range = df.head(candles_in_range)
        
        if len(opening_range) == 0:
            return {"error": "No data for opening range"}
        
        orb_high = opening_range['high'].max()
        orb_low = opening_range['low'].min()
        orb_range = orb_high - orb_low
        
        # Calculate targets based on ORB range
        target1_long = orb_high + (orb_range * 0.5)
        target2_long = orb_high + orb_range
        target1_short = orb_low - (orb_range * 0.5)
        target2_short = orb_low - orb_range
        
        return {
            "orb_high": round(orb_high, 2),
            "orb_low": round(orb_low, 2),
            "orb_range": round(orb_range, 2),
            "breakout_buy_above": round(orb_high * 1.001, 2),  # 0.1% buffer
            "breakout_sell_below": round(orb_low * 0.999, 2),
            "stop_loss_long": round(orb_low - (orb_range * 0.3), 2),
            "stop_loss_short": round(orb_high + (orb_range * 0.3), 2),
            "target1_long": round(target1_long, 2),
            "target2_long": round(target2_long, 2),
            "target1_short": round(target1_short, 2),
            "target2_short": round(target2_short, 2)
        }
    
    def get_orb_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate ORB trading signal"""
        orb_levels = self.calculate_orb_levels(data)
        
        if "error" in orb_levels:
            return TradingSignal(
                strategy=StrategyName.ORB.value,
                signal=SignalType.HOLD,
                entry_price=0, stop_loss=0, target1=0, target2=0,
                reason=orb_levels["error"],
                timestamp=datetime.now().isoformat()
            )
        
        current_price = data.iloc[-1]['close']
        
        # Check for breakout
        if current_price > orb_levels["breakout_buy_above"]:
            return TradingSignal(
                strategy=StrategyName.ORB.value,
                signal=SignalType.BUY,
                entry_price=current_price,
                stop_loss=orb_levels["stop_loss_long"],
                target1=orb_levels["target1_long"],
                target2=orb_levels["target2_long"],
                confidence=self._calculate_orb_confidence(data, orb_levels, "BUY"),
                risk_reward=round((orb_levels["target1_long"] - current_price) / 
                                  (current_price - orb_levels["stop_loss_long"]), 2),
                reason=f"Bullish ORB breakout - price {current_price:.2f} above ORB high {orb_levels['orb_high']:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data=orb_levels
            )
        
        elif current_price < orb_levels["breakout_sell_below"]:
            return TradingSignal(
                strategy=StrategyName.ORB.value,
                signal=SignalType.SELL,
                entry_price=current_price,
                stop_loss=orb_levels["stop_loss_short"],
                target1=orb_levels["target1_short"],
                target2=orb_levels["target2_short"],
                confidence=self._calculate_orb_confidence(data, orb_levels, "SELL"),
                risk_reward=round((current_price - orb_levels["target1_short"]) / 
                                  (orb_levels["stop_loss_short"] - current_price), 2),
                reason=f"Bearish ORB breakdown - price {current_price:.2f} below ORB low {orb_levels['orb_low']:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data=orb_levels
            )
        
        return TradingSignal(
            strategy=StrategyName.ORB.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"Price {current_price:.2f} within ORB range [{orb_levels['orb_low']:.2f} - {orb_levels['orb_high']:.2f}]",
            timestamp=datetime.now().isoformat(),
            additional_data=orb_levels
        )
    
    # ============================================
    # 3. RSI MEAN REVERSION STRATEGY
    # ============================================
    
    def calculate_rsi(self, data: pd.DataFrame, period: int = None) -> pd.DataFrame:
        """Calculate RSI indicator"""
        params = self.strategy_params[StrategyName.RSI_REVERSAL]
        period = period or params["period"]
        
        df = data.copy()
        delta = df['close'].diff()
        
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        return df
    
    def get_rsi_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate RSI reversal signal"""
        params = self.strategy_params[StrategyName.RSI_REVERSAL]
        df = self.calculate_rsi(data)
        
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest
        rsi = latest['rsi']
        
        # Calculate ATR for stops
        df['tr'] = df['high'] - df['low']
        atr = df['tr'].rolling(window=14).mean().iloc[-1]
        
        current_price = latest['close']
        
        # Oversold bounce
        if rsi < params["oversold"] and prev['rsi'] < params["oversold"]:
            if rsi > prev['rsi']:  # RSI turning up from oversold
                stop_loss = current_price - (params["stop_loss_atr_mult"] * atr)
                target1 = current_price + (2 * atr)
                target2 = current_price + (3 * atr)
                
                return TradingSignal(
                    strategy=StrategyName.RSI_REVERSAL.value,
                    signal=SignalType.BUY,
                    entry_price=round(current_price, 2),
                    stop_loss=round(stop_loss, 2),
                    target1=round(target1, 2),
                    target2=round(target2, 2),
                    confidence=min(90, (params["oversold"] - rsi) * 3 + 50),
                    risk_reward=round((target1 - current_price) / (current_price - stop_loss), 2),
                    reason=f"RSI {rsi:.1f} turning up from oversold zone (<{params['oversold']})",
                    timestamp=datetime.now().isoformat(),
                    additional_data={"rsi": round(rsi, 2), "zone": "OVERSOLD"}
                )
        
        # Overbought reversal
        elif rsi > params["overbought"] and prev['rsi'] > params["overbought"]:
            if rsi < prev['rsi']:  # RSI turning down from overbought
                stop_loss = current_price + (params["stop_loss_atr_mult"] * atr)
                target1 = current_price - (2 * atr)
                target2 = current_price - (3 * atr)
                
                return TradingSignal(
                    strategy=StrategyName.RSI_REVERSAL.value,
                    signal=SignalType.SELL,
                    entry_price=round(current_price, 2),
                    stop_loss=round(stop_loss, 2),
                    target1=round(target1, 2),
                    target2=round(target2, 2),
                    confidence=min(90, (rsi - params["overbought"]) * 3 + 50),
                    risk_reward=round((current_price - target1) / (stop_loss - current_price), 2),
                    reason=f"RSI {rsi:.1f} turning down from overbought zone (>{params['overbought']})",
                    timestamp=datetime.now().isoformat(),
                    additional_data={"rsi": round(rsi, 2), "zone": "OVERBOUGHT"}
                )
        
        return TradingSignal(
            strategy=StrategyName.RSI_REVERSAL.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"RSI {rsi:.1f} in neutral zone - no reversal signal",
            timestamp=datetime.now().isoformat(),
            additional_data={"rsi": round(rsi, 2), "zone": "NEUTRAL"}
        )
    
    # ============================================
    # 4. EMA CROSSOVER STRATEGY (9/21/55)
    # ============================================
    
    def calculate_ema_crossover(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate EMAs and crossover signals"""
        params = self.strategy_params[StrategyName.EMA_CROSSOVER]
        df = data.copy()
        
        df['ema_fast'] = df['close'].ewm(span=params["fast_period"], adjust=False).mean()
        df['ema_slow'] = df['close'].ewm(span=params["slow_period"], adjust=False).mean()
        df['ema_trend'] = df['close'].ewm(span=params["trend_period"], adjust=False).mean()
        
        # Crossover detection
        df['crossover'] = np.where(
            (df['ema_fast'] > df['ema_slow']) & (df['ema_fast'].shift(1) <= df['ema_slow'].shift(1)),
            'BULLISH_CROSS',
            np.where(
                (df['ema_fast'] < df['ema_slow']) & (df['ema_fast'].shift(1) >= df['ema_slow'].shift(1)),
                'BEARISH_CROSS',
                'NO_CROSS'
            )
        )
        
        # EMA alignment
        df['ema_aligned_bullish'] = (df['close'] > df['ema_fast']) & \
                                     (df['ema_fast'] > df['ema_slow']) & \
                                     (df['ema_slow'] > df['ema_trend'])
        
        df['ema_aligned_bearish'] = (df['close'] < df['ema_fast']) & \
                                     (df['ema_fast'] < df['ema_slow']) & \
                                     (df['ema_slow'] < df['ema_trend'])
        
        return df
    
    def get_ema_crossover_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate EMA crossover signal"""
        df = self.calculate_ema_crossover(data)
        latest = df.iloc[-1]
        
        current_price = latest['close']
        atr = (df['high'] - df['low']).rolling(window=14).mean().iloc[-1]
        
        if latest['crossover'] == 'BULLISH_CROSS' or \
           (latest['ema_aligned_bullish'] and df.iloc[-2]['ema_fast'] <= df.iloc[-2]['ema_slow']):
            stop_loss = min(latest['ema_slow'], current_price - 1.5 * atr)
            target1 = current_price + 2 * atr
            target2 = current_price + 3 * atr
            
            return TradingSignal(
                strategy=StrategyName.EMA_CROSSOVER.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=80 if latest['ema_aligned_bullish'] else 65,
                risk_reward=round((target1 - current_price) / (current_price - stop_loss), 2),
                reason="Bullish EMA crossover - 9 EMA crossed above 21 EMA",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "ema_fast": round(latest['ema_fast'], 2),
                    "ema_slow": round(latest['ema_slow'], 2),
                    "ema_trend": round(latest['ema_trend'], 2),
                    "aligned": latest['ema_aligned_bullish']
                }
            )
        
        elif latest['crossover'] == 'BEARISH_CROSS' or \
             (latest['ema_aligned_bearish'] and df.iloc[-2]['ema_fast'] >= df.iloc[-2]['ema_slow']):
            stop_loss = max(latest['ema_slow'], current_price + 1.5 * atr)
            target1 = current_price - 2 * atr
            target2 = current_price - 3 * atr
            
            return TradingSignal(
                strategy=StrategyName.EMA_CROSSOVER.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=80 if latest['ema_aligned_bearish'] else 65,
                risk_reward=round((current_price - target1) / (stop_loss - current_price), 2),
                reason="Bearish EMA crossover - 9 EMA crossed below 21 EMA",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "ema_fast": round(latest['ema_fast'], 2),
                    "ema_slow": round(latest['ema_slow'], 2),
                    "ema_trend": round(latest['ema_trend'], 2),
                    "aligned": latest['ema_aligned_bearish']
                }
            )
        
        return TradingSignal(
            strategy=StrategyName.EMA_CROSSOVER.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason="No EMA crossover - EMAs not crossing",
            timestamp=datetime.now().isoformat()
        )
    
    # ============================================
    # 5. BOLLINGER BANDS SQUEEZE STRATEGY
    # ============================================
    
    def calculate_bollinger_bands(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Bollinger Bands and squeeze detection"""
        params = self.strategy_params[StrategyName.BOLLINGER_SQUEEZE]
        df = data.copy()
        
        df['bb_middle'] = df['close'].rolling(window=params["period"]).mean()
        df['bb_std'] = df['close'].rolling(window=params["period"]).std()
        df['bb_upper'] = df['bb_middle'] + (params["std_dev"] * df['bb_std'])
        df['bb_lower'] = df['bb_middle'] - (params["std_dev"] * df['bb_std'])
        
        # Band width as percentage
        df['bb_width'] = ((df['bb_upper'] - df['bb_lower']) / df['bb_middle']) * 100
        
        # Squeeze detection
        df['bb_squeeze'] = df['bb_width'] < params["squeeze_threshold"]
        
        # Position in bands
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
        
        return df
    
    def get_bollinger_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate Bollinger Bands signal"""
        df = self.calculate_bollinger_bands(data)
        params = self.strategy_params[StrategyName.BOLLINGER_SQUEEZE]
        
        latest = df.iloc[-1]
        current_price = latest['close']
        atr = (df['high'] - df['low']).rolling(window=14).mean().iloc[-1]
        
        # Squeeze breakout
        was_in_squeeze = df['bb_squeeze'].iloc[-params["breakout_confirm_bars"]:-1].any()
        
        if was_in_squeeze and not latest['bb_squeeze']:
            # Breakout direction
            if current_price > latest['bb_upper']:
                stop_loss = latest['bb_middle']
                target1 = current_price + (current_price - latest['bb_middle'])
                target2 = current_price + 1.5 * (current_price - latest['bb_middle'])
                
                return TradingSignal(
                    strategy=StrategyName.BOLLINGER_SQUEEZE.value,
                    signal=SignalType.BUY,
                    entry_price=round(current_price, 2),
                    stop_loss=round(stop_loss, 2),
                    target1=round(target1, 2),
                    target2=round(target2, 2),
                    confidence=75,
                    risk_reward=round((target1 - current_price) / (current_price - stop_loss), 2),
                    reason="Bullish Bollinger squeeze breakout - price broke above upper band after squeeze",
                    timestamp=datetime.now().isoformat(),
                    additional_data={
                        "bb_upper": round(latest['bb_upper'], 2),
                        "bb_middle": round(latest['bb_middle'], 2),
                        "bb_lower": round(latest['bb_lower'], 2),
                        "bb_width": round(latest['bb_width'], 2)
                    }
                )
            
            elif current_price < latest['bb_lower']:
                stop_loss = latest['bb_middle']
                target1 = current_price - (latest['bb_middle'] - current_price)
                target2 = current_price - 1.5 * (latest['bb_middle'] - current_price)
                
                return TradingSignal(
                    strategy=StrategyName.BOLLINGER_SQUEEZE.value,
                    signal=SignalType.SELL,
                    entry_price=round(current_price, 2),
                    stop_loss=round(stop_loss, 2),
                    target1=round(target1, 2),
                    target2=round(target2, 2),
                    confidence=75,
                    risk_reward=round((current_price - target1) / (stop_loss - current_price), 2),
                    reason="Bearish Bollinger squeeze breakout - price broke below lower band after squeeze",
                    timestamp=datetime.now().isoformat(),
                    additional_data={
                        "bb_upper": round(latest['bb_upper'], 2),
                        "bb_middle": round(latest['bb_middle'], 2),
                        "bb_lower": round(latest['bb_lower'], 2),
                        "bb_width": round(latest['bb_width'], 2)
                    }
                )
        
        # Mean reversion from bands
        elif latest['bb_position'] < 0.1:  # Near lower band
            return TradingSignal(
                strategy=StrategyName.BOLLINGER_SQUEEZE.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(latest['bb_lower'] - 0.5 * atr, 2),
                target1=round(latest['bb_middle'], 2),
                target2=round(latest['bb_upper'], 2),
                confidence=60,
                risk_reward=round((latest['bb_middle'] - current_price) / 
                                  (current_price - (latest['bb_lower'] - 0.5 * atr)), 2),
                reason="Mean reversion buy - price at lower Bollinger Band",
                timestamp=datetime.now().isoformat()
            )
        
        elif latest['bb_position'] > 0.9:  # Near upper band
            return TradingSignal(
                strategy=StrategyName.BOLLINGER_SQUEEZE.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(latest['bb_upper'] + 0.5 * atr, 2),
                target1=round(latest['bb_middle'], 2),
                target2=round(latest['bb_lower'], 2),
                confidence=60,
                risk_reward=round((current_price - latest['bb_middle']) / 
                                  ((latest['bb_upper'] + 0.5 * atr) - current_price), 2),
                reason="Mean reversion sell - price at upper Bollinger Band",
                timestamp=datetime.now().isoformat()
            )
        
        return TradingSignal(
            strategy=StrategyName.BOLLINGER_SQUEEZE.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"Price within bands - BB position: {latest['bb_position']:.2f}",
            timestamp=datetime.now().isoformat()
        )
    
    # ============================================
    # 6. CPR (Central Pivot Range) STRATEGY
    # ============================================
    
    def calculate_cpr(self, prev_high: float, prev_low: float, prev_close: float) -> Dict:
        """
        Calculate CPR levels for intraday trading
        
        CPR Formula:
        - Pivot = (High + Low + Close) / 3
        - BC (Bottom Central) = (High + Low) / 2
        - TC (Top Central) = (Pivot - BC) + Pivot
        """
        pivot = (prev_high + prev_low + prev_close) / 3
        bc = (prev_high + prev_low) / 2
        tc = (pivot - bc) + pivot
        
        # Ensure TC > BC
        if tc < bc:
            tc, bc = bc, tc
        
        # Support and Resistance levels
        r1 = (2 * pivot) - prev_low
        s1 = (2 * pivot) - prev_high
        r2 = pivot + (prev_high - prev_low)
        s2 = pivot - (prev_high - prev_low)
        r3 = prev_high + 2 * (pivot - prev_low)
        s3 = prev_low - 2 * (prev_high - pivot)
        
        # CPR Width
        cpr_width = tc - bc
        cpr_width_percent = (cpr_width / pivot) * 100
        
        # Virgin CPR check (TC and BC not touched in previous session)
        is_virgin_cpr = True  # This needs historical verification
        
        return {
            "pivot": round(pivot, 2),
            "tc": round(tc, 2),
            "bc": round(bc, 2),
            "r1": round(r1, 2),
            "r2": round(r2, 2),
            "r3": round(r3, 2),
            "s1": round(s1, 2),
            "s2": round(s2, 2),
            "s3": round(s3, 2),
            "cpr_width": round(cpr_width, 2),
            "cpr_width_percent": round(cpr_width_percent, 3),
            "is_virgin_cpr": is_virgin_cpr,
            "is_narrow_cpr": cpr_width_percent < 0.5  # Narrow CPR for big moves
        }
    
    def get_cpr_signal(self, current_price: float, cpr_levels: Dict) -> TradingSignal:
        """Generate CPR-based trading signal"""
        pivot = cpr_levels["pivot"]
        tc = cpr_levels["tc"]
        bc = cpr_levels["bc"]
        r1 = cpr_levels["r1"]
        s1 = cpr_levels["s1"]
        
        # Bullish: Price above CPR
        if current_price > tc:
            stop_loss = bc
            target1 = r1
            target2 = cpr_levels["r2"]
            
            confidence = 70
            if cpr_levels["is_narrow_cpr"]:
                confidence += 10  # Narrow CPR = bigger move expected
            if cpr_levels.get("is_virgin_cpr"):
                confidence += 5
            
            return TradingSignal(
                strategy=StrategyName.CPR_PIVOT.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=min(confidence, 90),
                risk_reward=round((target1 - current_price) / (current_price - stop_loss), 2),
                reason=f"Bullish CPR - Price {current_price:.2f} above TC {tc:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data=cpr_levels
            )
        
        # Bearish: Price below CPR
        elif current_price < bc:
            stop_loss = tc
            target1 = s1
            target2 = cpr_levels["s2"]
            
            confidence = 70
            if cpr_levels["is_narrow_cpr"]:
                confidence += 10
            if cpr_levels.get("is_virgin_cpr"):
                confidence += 5
            
            return TradingSignal(
                strategy=StrategyName.CPR_PIVOT.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=min(confidence, 90),
                risk_reward=round((current_price - target1) / (stop_loss - current_price), 2),
                reason=f"Bearish CPR - Price {current_price:.2f} below BC {bc:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data=cpr_levels
            )
        
        # Price within CPR - range trading
        return TradingSignal(
            strategy=StrategyName.CPR_PIVOT.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"Price {current_price:.2f} within CPR range [{bc:.2f} - {tc:.2f}] - wait for breakout",
            timestamp=datetime.now().isoformat(),
            additional_data=cpr_levels
        )
    
    # ============================================
    # 7. VWAP STRATEGY
    # ============================================
    
    def calculate_vwap(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate VWAP and standard deviation bands"""
        df = data.copy()
        
        # Typical price
        df['typical_price'] = (df['high'] + df['low'] + df['close']) / 3
        
        # Cumulative values for VWAP
        df['tp_volume'] = df['typical_price'] * df['volume']
        df['cum_tp_volume'] = df['tp_volume'].cumsum()
        df['cum_volume'] = df['volume'].cumsum()
        
        # VWAP
        df['vwap'] = df['cum_tp_volume'] / df['cum_volume']
        
        # Standard deviation bands
        df['vwap_std'] = df['typical_price'].expanding().std()
        df['vwap_upper1'] = df['vwap'] + df['vwap_std']
        df['vwap_lower1'] = df['vwap'] - df['vwap_std']
        df['vwap_upper2'] = df['vwap'] + 2 * df['vwap_std']
        df['vwap_lower2'] = df['vwap'] - 2 * df['vwap_std']
        
        # Distance from VWAP
        df['vwap_distance'] = ((df['close'] - df['vwap']) / df['vwap']) * 100
        
        return df
    
    def get_vwap_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate VWAP-based trading signal"""
        df = self.calculate_vwap(data)
        params = self.strategy_params[StrategyName.VWAP_STRATEGY]
        
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest
        current_price = latest['close']
        vwap = latest['vwap']
        
        # Calculate ATR
        atr = (df['high'] - df['low']).rolling(window=14).mean().iloc[-1]
        
        # VWAP crossover signals
        price_crossed_above_vwap = current_price > vwap and prev['close'] <= prev['vwap']
        price_crossed_below_vwap = current_price < vwap and prev['close'] >= prev['vwap']
        
        if price_crossed_above_vwap:
            return TradingSignal(
                strategy=StrategyName.VWAP_STRATEGY.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(latest['vwap_lower1'], 2),
                target1=round(latest['vwap_upper1'], 2),
                target2=round(latest['vwap_upper2'], 2),
                confidence=70,
                risk_reward=round((latest['vwap_upper1'] - current_price) / 
                                  (current_price - latest['vwap_lower1']), 2),
                reason=f"Bullish VWAP crossover - price {current_price:.2f} crossed above VWAP {vwap:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "vwap": round(vwap, 2),
                    "distance_percent": round(latest['vwap_distance'], 2),
                    "upper_band": round(latest['vwap_upper1'], 2),
                    "lower_band": round(latest['vwap_lower1'], 2)
                }
            )
        
        elif price_crossed_below_vwap:
            return TradingSignal(
                strategy=StrategyName.VWAP_STRATEGY.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(latest['vwap_upper1'], 2),
                target1=round(latest['vwap_lower1'], 2),
                target2=round(latest['vwap_lower2'], 2),
                confidence=70,
                risk_reward=round((current_price - latest['vwap_lower1']) / 
                                  (latest['vwap_upper1'] - current_price), 2),
                reason=f"Bearish VWAP crossover - price {current_price:.2f} crossed below VWAP {vwap:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "vwap": round(vwap, 2),
                    "distance_percent": round(latest['vwap_distance'], 2),
                    "upper_band": round(latest['vwap_upper1'], 2),
                    "lower_band": round(latest['vwap_lower1'], 2)
                }
            )
        
        # Mean reversion from bands
        elif latest['vwap_distance'] < -params["reversion_threshold"]:
            return TradingSignal(
                strategy=StrategyName.VWAP_STRATEGY.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(latest['vwap_lower2'], 2),
                target1=round(vwap, 2),
                target2=round(latest['vwap_upper1'], 2),
                confidence=65,
                risk_reward=round((vwap - current_price) / (current_price - latest['vwap_lower2']), 2),
                reason=f"VWAP mean reversion buy - price {latest['vwap_distance']:.2f}% below VWAP",
                timestamp=datetime.now().isoformat()
            )
        
        elif latest['vwap_distance'] > params["reversion_threshold"]:
            return TradingSignal(
                strategy=StrategyName.VWAP_STRATEGY.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(latest['vwap_upper2'], 2),
                target1=round(vwap, 2),
                target2=round(latest['vwap_lower1'], 2),
                confidence=65,
                risk_reward=round((current_price - vwap) / (latest['vwap_upper2'] - current_price), 2),
                reason=f"VWAP mean reversion sell - price {latest['vwap_distance']:.2f}% above VWAP",
                timestamp=datetime.now().isoformat()
            )
        
        return TradingSignal(
            strategy=StrategyName.VWAP_STRATEGY.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"Price near VWAP ({latest['vwap_distance']:.2f}% distance) - no clear signal",
            timestamp=datetime.now().isoformat()
        )
    
    # ============================================
    # 8. MOMENTUM STRATEGY
    # ============================================
    
    def calculate_momentum(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate momentum indicators"""
        params = self.strategy_params[StrategyName.MOMENTUM]
        df = data.copy()
        
        lookback = params["lookback_days"]
        
        # Price momentum
        df['momentum'] = ((df['close'] - df['close'].shift(lookback)) / 
                          df['close'].shift(lookback)) * 100
        
        # Rate of change
        df['roc'] = df['close'].pct_change(lookback) * 100
        
        # Volume momentum
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        df['volume_momentum'] = df['volume'] / df['volume_sma']
        
        # RSI for momentum confirmation
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        return df
    
    def get_momentum_signal(self, data: pd.DataFrame) -> TradingSignal:
        """Generate momentum trading signal"""
        df = self.calculate_momentum(data)
        params = self.strategy_params[StrategyName.MOMENTUM]
        
        latest = df.iloc[-1]
        current_price = latest['close']
        momentum = latest['momentum']
        rsi = latest['rsi']
        volume_momentum = latest['volume_momentum']
        
        atr = (df['high'] - df['low']).rolling(window=14).mean().iloc[-1]
        
        # Strong bullish momentum
        if momentum > params["momentum_threshold"]:
            rsi_ok = params["rsi_filter"][0] <= rsi <= params["rsi_filter"][1]
            volume_ok = volume_momentum > 1.2 if params["volume_confirmation"] else True
            
            if rsi_ok or volume_ok:
                confidence = 60
                if rsi_ok:
                    confidence += 15
                if volume_ok:
                    confidence += 15
                
                return TradingSignal(
                    strategy=StrategyName.MOMENTUM.value,
                    signal=SignalType.BUY,
                    entry_price=round(current_price, 2),
                    stop_loss=round(current_price - 2 * atr, 2),
                    target1=round(current_price + 2 * atr, 2),
                    target2=round(current_price + 3 * atr, 2),
                    confidence=min(confidence, 90),
                    risk_reward=1.0,
                    reason=f"Strong bullish momentum: {momentum:.1f}% in {params['lookback_days']} days",
                    timestamp=datetime.now().isoformat(),
                    additional_data={
                        "momentum": round(momentum, 2),
                        "rsi": round(rsi, 2),
                        "volume_momentum": round(volume_momentum, 2)
                    }
                )
        
        # Strong bearish momentum
        elif momentum < -params["momentum_threshold"]:
            rsi_ok = params["rsi_filter"][0] <= rsi <= params["rsi_filter"][1]
            volume_ok = volume_momentum > 1.2 if params["volume_confirmation"] else True
            
            if rsi_ok or volume_ok:
                confidence = 60
                if rsi_ok:
                    confidence += 15
                if volume_ok:
                    confidence += 15
                
                return TradingSignal(
                    strategy=StrategyName.MOMENTUM.value,
                    signal=SignalType.SELL,
                    entry_price=round(current_price, 2),
                    stop_loss=round(current_price + 2 * atr, 2),
                    target1=round(current_price - 2 * atr, 2),
                    target2=round(current_price - 3 * atr, 2),
                    confidence=min(confidence, 90),
                    risk_reward=1.0,
                    reason=f"Strong bearish momentum: {momentum:.1f}% in {params['lookback_days']} days",
                    timestamp=datetime.now().isoformat(),
                    additional_data={
                        "momentum": round(momentum, 2),
                        "rsi": round(rsi, 2),
                        "volume_momentum": round(volume_momentum, 2)
                    }
                )
        
        return TradingSignal(
            strategy=StrategyName.MOMENTUM.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"No strong momentum - {momentum:.1f}% (threshold: ±{params['momentum_threshold']}%)",
            timestamp=datetime.now().isoformat()
        )
    
    # ============================================
    # 9. 9:20 AM CANDLE STRATEGY
    # ============================================
    
    def get_nine_twenty_signal(
        self, 
        candle_920: Dict,  # {'open': x, 'high': x, 'low': x, 'close': x}
        current_price: float
    ) -> TradingSignal:
        """
        9:20 AM Candle Strategy
        
        Rules:
        1. Wait for 9:15 - 9:20 candle to form
        2. Buy above 9:20 high with SL at 9:20 low
        3. Sell below 9:20 low with SL at 9:20 high
        4. Exit at 3:15 PM if neither target/SL hit
        """
        params = self.strategy_params[StrategyName.NINE_TWENTY]
        
        candle_high = candle_920['high']
        candle_low = candle_920['low']
        candle_range = candle_high - candle_low
        
        buffer = candle_range * params["buffer_percent"]
        
        buy_trigger = candle_high + buffer
        sell_trigger = candle_low - buffer
        
        if current_price > buy_trigger:
            stop_loss = candle_low
            target1 = current_price + candle_range
            target2 = current_price + 1.5 * candle_range
            
            return TradingSignal(
                strategy=StrategyName.NINE_TWENTY.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=75,
                risk_reward=round(candle_range / (current_price - candle_low), 2),
                reason=f"9:20 candle breakout - price {current_price:.2f} above {candle_high:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "candle_high": candle_high,
                    "candle_low": candle_low,
                    "candle_range": round(candle_range, 2),
                    "exit_time": params["exit_time"]
                }
            )
        
        elif current_price < sell_trigger:
            stop_loss = candle_high
            target1 = current_price - candle_range
            target2 = current_price - 1.5 * candle_range
            
            return TradingSignal(
                strategy=StrategyName.NINE_TWENTY.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=75,
                risk_reward=round(candle_range / (candle_high - current_price), 2),
                reason=f"9:20 candle breakdown - price {current_price:.2f} below {candle_low:.2f}",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "candle_high": candle_high,
                    "candle_low": candle_low,
                    "candle_range": round(candle_range, 2),
                    "exit_time": params["exit_time"]
                }
            )
        
        return TradingSignal(
            strategy=StrategyName.NINE_TWENTY.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason=f"Price {current_price:.2f} within 9:20 range [{candle_low:.2f} - {candle_high:.2f}]",
            timestamp=datetime.now().isoformat(),
            additional_data={
                "candle_high": candle_high,
                "candle_low": candle_low,
                "buy_above": round(buy_trigger, 2),
                "sell_below": round(sell_trigger, 2)
            }
        )
    
    # ============================================
    # 10. OPEN HIGH/LOW STRATEGY  
    # ============================================
    
    def get_open_high_low_signal(
        self,
        open_price: float,
        high_price: float,
        low_price: float,
        current_price: float,
        vwap: float = None,
        volume: float = None,
        avg_volume: float = None
    ) -> TradingSignal:
        """
        Open High/Low Strategy (OHL)
        
        Rules:
        1. If Open = High (after 15 mins): Bearish - sell near VWAP
        2. If Open = Low (after 15 mins): Bullish - buy near VWAP
        """
        params = self.strategy_params[StrategyName.OPEN_HIGH_LOW]
        
        # Define tolerance for open = high/low
        tolerance = 0.001  # 0.1%
        
        open_equals_high = abs(open_price - high_price) / open_price < tolerance
        open_equals_low = abs(open_price - low_price) / open_price < tolerance
        
        day_range = high_price - low_price if high_price > low_price else 50
        
        # Volume filter
        volume_ok = True
        if params["volume_confirmation"] and volume and avg_volume:
            volume_ok = volume > avg_volume
        
        # VWAP filter
        vwap_ok = True
        if params["vwap_filter"] and vwap:
            if open_equals_high:
                vwap_ok = current_price >= vwap * 0.998  # Near or above VWAP for selling
            elif open_equals_low:
                vwap_ok = current_price <= vwap * 1.002  # Near or below VWAP for buying
        
        if open_equals_low and vwap_ok and volume_ok:
            # Bullish setup
            stop_loss = low_price - day_range * 0.3
            target1 = current_price + day_range * params["target_percent"]
            target2 = current_price + day_range
            
            return TradingSignal(
                strategy=StrategyName.OPEN_HIGH_LOW.value,
                signal=SignalType.BUY,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=70 if vwap_ok else 60,
                risk_reward=round((target1 - current_price) / (current_price - stop_loss), 2),
                reason=f"Open = Low (Bullish OHL) - buying pressure from open",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "pattern": "OPEN_EQUALS_LOW",
                    "vwap": vwap,
                    "near_vwap": vwap_ok
                }
            )
        
        elif open_equals_high and vwap_ok and volume_ok:
            # Bearish setup
            stop_loss = high_price + day_range * 0.3
            target1 = current_price - day_range * params["target_percent"]
            target2 = current_price - day_range
            
            return TradingSignal(
                strategy=StrategyName.OPEN_HIGH_LOW.value,
                signal=SignalType.SELL,
                entry_price=round(current_price, 2),
                stop_loss=round(stop_loss, 2),
                target1=round(target1, 2),
                target2=round(target2, 2),
                confidence=70 if vwap_ok else 60,
                risk_reward=round((current_price - target1) / (stop_loss - current_price), 2),
                reason=f"Open = High (Bearish OHL) - selling pressure from open",
                timestamp=datetime.now().isoformat(),
                additional_data={
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "pattern": "OPEN_EQUALS_HIGH",
                    "vwap": vwap,
                    "near_vwap": vwap_ok
                }
            )
        
        return TradingSignal(
            strategy=StrategyName.OPEN_HIGH_LOW.value,
            signal=SignalType.HOLD,
            entry_price=0, stop_loss=0, target1=0, target2=0,
            reason="No OHL pattern - Open is neither High nor Low",
            timestamp=datetime.now().isoformat(),
            additional_data={
                "open": open_price,
                "high": high_price,
                "low": low_price
            }
        )
    
    # ============================================
    # UTILITY METHODS
    # ============================================
    
    def _calculate_confidence(self, df: pd.DataFrame, strategy_type: str) -> float:
        """Calculate confidence based on multiple factors"""
        confidence = 50  # Base confidence
        
        latest = df.iloc[-1]
        
        # Volume confirmation
        if 'volume' in df.columns:
            avg_vol = df['volume'].rolling(window=20).mean().iloc[-1]
            if latest['volume'] > avg_vol * 1.5:
                confidence += 15
            elif latest['volume'] > avg_vol:
                confidence += 10
        
        # Trend alignment
        if 'ema_trend' in df.columns:
            if latest['close'] > latest.get('ema_trend', 0):
                confidence += 10
        
        # RSI in favorable zone
        if 'rsi' in df.columns:
            rsi = latest['rsi']
            if 40 < rsi < 60:
                confidence += 5
            elif 30 < rsi < 70:
                confidence += 10
        
        return min(confidence, 95)
    
    def _calculate_orb_confidence(self, df: pd.DataFrame, orb_levels: Dict, direction: str) -> float:
        """Calculate ORB-specific confidence"""
        confidence = 55
        
        # Volume confirmation
        if 'volume' in df.columns:
            current_vol = df.iloc[-1]['volume']
            avg_vol = df['volume'].mean()
            if current_vol > avg_vol * 2:
                confidence += 20
            elif current_vol > avg_vol * 1.5:
                confidence += 15
        
        # Gap in direction of breakout
        if 'open' in df.columns:
            gap = (df.iloc[-1]['open'] - df.iloc[-2]['close']) / df.iloc[-2]['close'] * 100
            if direction == "BUY" and gap > 0.3:
                confidence += 10
            elif direction == "SELL" and gap < -0.3:
                confidence += 10
        
        return min(confidence, 90)
    
    def get_all_signals(self, data: pd.DataFrame, prev_day_data: Dict = None) -> Dict[str, TradingSignal]:
        """Get signals from all strategies"""
        signals = {}
        
        try:
            signals[StrategyName.SUPERTREND.value] = self.get_supertrend_signal(data)
        except Exception as e:
            logger.error(f"Supertrend error: {e}")
        
        try:
            signals[StrategyName.ORB.value] = self.get_orb_signal(data)
        except Exception as e:
            logger.error(f"ORB error: {e}")
        
        try:
            signals[StrategyName.RSI_REVERSAL.value] = self.get_rsi_signal(data)
        except Exception as e:
            logger.error(f"RSI error: {e}")
        
        try:
            signals[StrategyName.EMA_CROSSOVER.value] = self.get_ema_crossover_signal(data)
        except Exception as e:
            logger.error(f"EMA error: {e}")
        
        try:
            signals[StrategyName.BOLLINGER_SQUEEZE.value] = self.get_bollinger_signal(data)
        except Exception as e:
            logger.error(f"Bollinger error: {e}")
        
        try:
            signals[StrategyName.VWAP_STRATEGY.value] = self.get_vwap_signal(data)
        except Exception as e:
            logger.error(f"VWAP error: {e}")
        
        try:
            signals[StrategyName.MOMENTUM.value] = self.get_momentum_signal(data)
        except Exception as e:
            logger.error(f"Momentum error: {e}")
        
        # CPR needs previous day data
        if prev_day_data:
            try:
                cpr_levels = self.calculate_cpr(
                    prev_day_data['high'],
                    prev_day_data['low'],
                    prev_day_data['close']
                )
                current_price = data.iloc[-1]['close']
                signals[StrategyName.CPR_PIVOT.value] = self.get_cpr_signal(current_price, cpr_levels)
            except Exception as e:
                logger.error(f"CPR error: {e}")
        
        return signals
    
    def get_combined_recommendation(self, signals: Dict[str, TradingSignal]) -> Dict:
        """Combine signals from multiple strategies for final recommendation"""
        buy_signals = []
        sell_signals = []
        
        for strategy, signal in signals.items():
            if signal.signal == SignalType.BUY:
                buy_signals.append({
                    "strategy": strategy,
                    "confidence": signal.confidence,
                    "entry": signal.entry_price,
                    "target": signal.target1
                })
            elif signal.signal == SignalType.SELL:
                sell_signals.append({
                    "strategy": strategy,
                    "confidence": signal.confidence,
                    "entry": signal.entry_price,
                    "target": signal.target1
                })
        
        total_strategies = len(signals)
        buy_count = len(buy_signals)
        sell_count = len(sell_signals)
        
        # Calculate weighted confidence
        buy_confidence = sum(s["confidence"] for s in buy_signals) / buy_count if buy_count else 0
        sell_confidence = sum(s["confidence"] for s in sell_signals) / sell_count if sell_count else 0
        
        recommendation = {
            "overall_signal": "HOLD",
            "confidence": 0,
            "buy_count": buy_count,
            "sell_count": sell_count,
            "total_strategies": total_strategies,
            "consensus_percent": 0,
            "buy_signals": buy_signals,
            "sell_signals": sell_signals,
            "recommendation_text": ""
        }
        
        if buy_count > sell_count and buy_count >= 3:
            recommendation["overall_signal"] = "BUY"
            recommendation["confidence"] = round(buy_confidence, 1)
            recommendation["consensus_percent"] = round((buy_count / total_strategies) * 100, 1)
            recommendation["recommendation_text"] = (
                f"BULLISH: {buy_count} of {total_strategies} strategies signal BUY "
                f"with {buy_confidence:.1f}% average confidence"
            )
        
        elif sell_count > buy_count and sell_count >= 3:
            recommendation["overall_signal"] = "SELL"
            recommendation["confidence"] = round(sell_confidence, 1)
            recommendation["consensus_percent"] = round((sell_count / total_strategies) * 100, 1)
            recommendation["recommendation_text"] = (
                f"BEARISH: {sell_count} of {total_strategies} strategies signal SELL "
                f"with {sell_confidence:.1f}% average confidence"
            )
        
        else:
            recommendation["recommendation_text"] = (
                f"NEUTRAL: Mixed signals - {buy_count} BUY, {sell_count} SELL out of {total_strategies}"
            )
        
        return recommendation


# ============================================
# BACKTESTING ENGINE FOR STRATEGIES
# ============================================

class StrategyBacktester:
    """Backtest trading strategies with historical data"""
    
    def __init__(self, strategy_engine: NiftyTradingStrategies):
        self.strategy_engine = strategy_engine
    
    def backtest_strategy(
        self,
        data: pd.DataFrame,
        strategy: StrategyName,
        capital: float = 100000,
        lot_size: int = 50
    ) -> StrategyBacktestResult:
        """
        Backtest a single strategy on historical data
        
        Parameters:
        - data: Historical OHLCV data
        - strategy: Strategy to backtest
        - capital: Starting capital
        - lot_size: Contract/lot size
        
        Returns: StrategyBacktestResult with detailed metrics
        """
        trades = []
        equity_curve = [capital]
        current_capital = capital
        
        # Strategy-specific backtest logic
        if strategy == StrategyName.SUPERTREND:
            trades = self._backtest_supertrend(data, lot_size)
        elif strategy == StrategyName.EMA_CROSSOVER:
            trades = self._backtest_ema_crossover(data, lot_size)
        elif strategy == StrategyName.RSI_REVERSAL:
            trades = self._backtest_rsi(data, lot_size)
        elif strategy == StrategyName.BOLLINGER_SQUEEZE:
            trades = self._backtest_bollinger(data, lot_size)
        # Add more strategy backtests...
        
        # Calculate metrics
        if not trades:
            return StrategyBacktestResult(
                strategy_name=strategy.value,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=0,
                total_pnl=0,
                total_pnl_percent=0,
                avg_profit=0,
                avg_loss=0,
                max_profit=0,
                max_loss=0,
                max_drawdown=0,
                profit_factor=0,
                sharpe_ratio=0,
                avg_holding_period=0
            )
        
        # Build equity curve
        for trade in trades:
            current_capital += trade.pnl * lot_size
            equity_curve.append(current_capital)
        
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl <= 0]
        
        total_profit = sum(t.pnl for t in winning_trades) * lot_size
        total_loss = abs(sum(t.pnl for t in losing_trades)) * lot_size
        
        # Calculate drawdown
        peak = equity_curve[0]
        max_dd = 0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak
            if dd > max_dd:
                max_dd = dd
        
        # Sharpe ratio (simplified)
        returns = [(equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1] 
                   for i in range(1, len(equity_curve))]
        sharpe = (np.mean(returns) / np.std(returns) * np.sqrt(252)) if returns and np.std(returns) > 0 else 0
        
        return StrategyBacktestResult(
            strategy_name=strategy.value,
            total_trades=len(trades),
            winning_trades=len(winning_trades),
            losing_trades=len(losing_trades),
            win_rate=round(len(winning_trades) / len(trades) * 100, 2) if trades else 0,
            total_pnl=round(sum(t.pnl for t in trades) * lot_size, 2),
            total_pnl_percent=round((current_capital - capital) / capital * 100, 2),
            avg_profit=round(np.mean([t.pnl for t in winning_trades]) * lot_size, 2) if winning_trades else 0,
            avg_loss=round(np.mean([t.pnl for t in losing_trades]) * lot_size, 2) if losing_trades else 0,
            max_profit=round(max(t.pnl for t in trades) * lot_size, 2) if trades else 0,
            max_loss=round(min(t.pnl for t in trades) * lot_size, 2) if trades else 0,
            max_drawdown=round(max_dd * 100, 2),
            profit_factor=round(total_profit / total_loss, 2) if total_loss > 0 else float('inf'),
            sharpe_ratio=round(sharpe, 2),
            avg_holding_period=0,  # Calculate based on trades
            trades=trades,
            equity_curve=equity_curve
        )
    
    def _backtest_supertrend(self, data: pd.DataFrame, lot_size: int) -> List[BacktestTrade]:
        """Backtest Supertrend strategy"""
        df = self.strategy_engine.calculate_supertrend(data)
        trades = []
        position = None
        
        for i in range(1, len(df)):
            current = df.iloc[i]
            prev = df.iloc[i-1]
            
            if current['supertrend_signal'] == 'BUY' and position is None:
                position = {
                    'type': 'BUY',
                    'entry_price': current['close'],
                    'entry_date': str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                    'entry_time': str(df.index[i].time()) if hasattr(df.index[i], 'time') else '09:15',
                    'stop_loss': current['supertrend']
                }
            
            elif current['supertrend_signal'] == 'SELL' and position is not None:
                # Exit long position
                pnl = current['close'] - position['entry_price']
                trades.append(BacktestTrade(
                    entry_date=position['entry_date'],
                    entry_time=position['entry_time'],
                    entry_price=position['entry_price'],
                    exit_date=str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                    exit_time=str(df.index[i].time()) if hasattr(df.index[i], 'time') else '15:15',
                    exit_price=current['close'],
                    signal_type='BUY',
                    pnl=round(pnl, 2),
                    pnl_percent=round((pnl / position['entry_price']) * 100, 2),
                    exit_reason='signal_reversal'
                ))
                position = None
            
            # Check stop loss
            elif position is not None:
                if position['type'] == 'BUY' and current['low'] < position['stop_loss']:
                    pnl = position['stop_loss'] - position['entry_price']
                    trades.append(BacktestTrade(
                        entry_date=position['entry_date'],
                        entry_time=position['entry_time'],
                        entry_price=position['entry_price'],
                        exit_date=str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                        exit_time='',
                        exit_price=position['stop_loss'],
                        signal_type='BUY',
                        pnl=round(pnl, 2),
                        pnl_percent=round((pnl / position['entry_price']) * 100, 2),
                        exit_reason='stop_loss'
                    ))
                    position = None
        
        return trades
    
    def _backtest_ema_crossover(self, data: pd.DataFrame, lot_size: int) -> List[BacktestTrade]:
        """Backtest EMA crossover strategy"""
        df = self.strategy_engine.calculate_ema_crossover(data)
        trades = []
        position = None
        
        for i in range(1, len(df)):
            current = df.iloc[i]
            
            if current['crossover'] == 'BULLISH_CROSS' and position is None:
                position = {
                    'type': 'BUY',
                    'entry_price': current['close'],
                    'entry_date': str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                    'entry_time': '',
                    'stop_loss': current['ema_slow']
                }
            
            elif current['crossover'] == 'BEARISH_CROSS' and position is not None:
                pnl = current['close'] - position['entry_price']
                trades.append(BacktestTrade(
                    entry_date=position['entry_date'],
                    entry_time=position['entry_time'],
                    entry_price=position['entry_price'],
                    exit_date=str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                    exit_time='',
                    exit_price=current['close'],
                    signal_type='BUY',
                    pnl=round(pnl, 2),
                    pnl_percent=round((pnl / position['entry_price']) * 100, 2),
                    exit_reason='signal_reversal'
                ))
                position = None
        
        return trades
    
    def _backtest_rsi(self, data: pd.DataFrame, lot_size: int) -> List[BacktestTrade]:
        """Backtest RSI reversal strategy"""
        df = self.strategy_engine.calculate_rsi(data)
        trades = []
        position = None
        params = self.strategy_engine.strategy_params[StrategyName.RSI_REVERSAL]
        
        for i in range(2, len(df)):
            current = df.iloc[i]
            prev = df.iloc[i-1]
            
            # Entry on RSI reversal
            if position is None:
                if current['rsi'] < params['oversold'] and current['rsi'] > prev['rsi']:
                    # Buy signal
                    atr = (df['high'] - df['low']).iloc[i-14:i].mean() if i >= 14 else 50
                    position = {
                        'type': 'BUY',
                        'entry_price': current['close'],
                        'entry_date': str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                        'entry_time': '',
                        'stop_loss': current['close'] - 1.5 * atr,
                        'target': current['close'] + 2 * atr
                    }
            
            else:
                # Check exit conditions
                if current['rsi'] > params['overbought']:
                    # Exit on RSI overbought
                    pnl = current['close'] - position['entry_price']
                    trades.append(BacktestTrade(
                        entry_date=position['entry_date'],
                        entry_time=position['entry_time'],
                        entry_price=position['entry_price'],
                        exit_date=str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                        exit_time='',
                        exit_price=current['close'],
                        signal_type='BUY',
                        pnl=round(pnl, 2),
                        pnl_percent=round((pnl / position['entry_price']) * 100, 2),
                        exit_reason='rsi_overbought'
                    ))
                    position = None
                
                elif current['low'] < position['stop_loss']:
                    pnl = position['stop_loss'] - position['entry_price']
                    trades.append(BacktestTrade(
                        entry_date=position['entry_date'],
                        entry_time=position['entry_time'],
                        entry_price=position['entry_price'],
                        exit_date=str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                        exit_time='',
                        exit_price=position['stop_loss'],
                        signal_type='BUY',
                        pnl=round(pnl, 2),
                        pnl_percent=round((pnl / position['entry_price']) * 100, 2),
                        exit_reason='stop_loss'
                    ))
                    position = None
        
        return trades
    
    def _backtest_bollinger(self, data: pd.DataFrame, lot_size: int) -> List[BacktestTrade]:
        """Backtest Bollinger Bands strategy"""
        df = self.strategy_engine.calculate_bollinger_bands(data)
        trades = []
        position = None
        
        for i in range(20, len(df)):
            current = df.iloc[i]
            
            if position is None:
                # Mean reversion from lower band
                if current['bb_position'] < 0.1:
                    position = {
                        'type': 'BUY',
                        'entry_price': current['close'],
                        'entry_date': str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                        'entry_time': '',
                        'target': current['bb_middle']
                    }
            
            else:
                # Exit at middle band
                if current['close'] >= position['target']:
                    pnl = current['close'] - position['entry_price']
                    trades.append(BacktestTrade(
                        entry_date=position['entry_date'],
                        entry_time=position['entry_time'],
                        entry_price=position['entry_price'],
                        exit_date=str(df.index[i].date()) if hasattr(df.index[i], 'date') else str(i),
                        exit_time='',
                        exit_price=current['close'],
                        signal_type='BUY',
                        pnl=round(pnl, 2),
                        pnl_percent=round((pnl / position['entry_price']) * 100, 2),
                        exit_reason='target'
                    ))
                    position = None
        
        return trades
    
    def run_all_backtests(
        self,
        data: pd.DataFrame,
        capital: float = 100000,
        lot_size: int = 50
    ) -> Dict[str, StrategyBacktestResult]:
        """Run backtests on all strategies"""
        results = {}
        
        strategies = [
            StrategyName.SUPERTREND,
            StrategyName.EMA_CROSSOVER,
            StrategyName.RSI_REVERSAL,
            StrategyName.BOLLINGER_SQUEEZE
        ]
        
        for strategy in strategies:
            try:
                results[strategy.value] = self.backtest_strategy(
                    data, strategy, capital, lot_size
                )
            except Exception as e:
                logger.error(f"Backtest error for {strategy.value}: {e}")
        
        return results
    
    def generate_backtest_report(self, results: Dict[str, StrategyBacktestResult]) -> Dict:
        """Generate comprehensive backtest report"""
        report = {
            "summary": [],
            "best_strategy": None,
            "total_combined_pnl": 0,
            "average_win_rate": 0,
            "recommendations": []
        }
        
        for name, result in results.items():
            report["summary"].append({
                "strategy": name,
                "total_trades": result.total_trades,
                "win_rate": result.win_rate,
                "total_pnl": result.total_pnl,
                "profit_factor": result.profit_factor,
                "max_drawdown": result.max_drawdown,
                "sharpe_ratio": result.sharpe_ratio
            })
            report["total_combined_pnl"] += result.total_pnl
        
        if report["summary"]:
            # Find best strategy by Sharpe ratio
            best = max(report["summary"], key=lambda x: x.get("sharpe_ratio", 0))
            report["best_strategy"] = best["strategy"]
            report["average_win_rate"] = round(
                sum(s["win_rate"] for s in report["summary"]) / len(report["summary"]), 2
            )
            
            # Generate recommendations
            for s in report["summary"]:
                if s["win_rate"] > 55 and s["profit_factor"] > 1.5:
                    report["recommendations"].append(
                        f"✅ {s['strategy']}: High potential - {s['win_rate']}% win rate, "
                        f"{s['profit_factor']:.2f} profit factor"
                    )
                elif s["win_rate"] > 50:
                    report["recommendations"].append(
                        f"⚠️ {s['strategy']}: Moderate potential - consider with other confirmations"
                    )
                else:
                    report["recommendations"].append(
                        f"❌ {s['strategy']}: Low win rate - optimize parameters or avoid"
                    )
        
        return report


# Export main classes
__all__ = [
    'NiftyTradingStrategies',
    'StrategyBacktester',
    'TradingSignal',
    'SignalType',
    'StrategyName',
    'StrategyBacktestResult',
    'BacktestTrade'
]
