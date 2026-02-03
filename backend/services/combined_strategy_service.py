"""
Combined Strategy Signals Service
==================================
Integrates Nifty trading strategies with OI analysis, scanner data, 
and market context for high-confluence trade signals.

Features:
- Combines strategy signals with OI buildup/unwinding data
- Uses scanner results for stock selection
- Adds FII/DII data for institutional context
- Provides weighted recommendation based on all factors
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np

# Import our strategy engine
from services.nifty_strategies import (
    NiftyTradingStrategies,
    TradingSignal,
    SignalType,
    StrategyName
)

# Import scanner service if available
try:
    from services.scanner_service import ScannerService, ScannerType
    scanner_service = ScannerService()
    SCANNER_AVAILABLE = True
except ImportError:
    SCANNER_AVAILABLE = False
    scanner_service = None

logger = logging.getLogger(__name__)


class ConfluenceLevel(Enum):
    """Level of signal confluence"""
    VERY_HIGH = "very_high"   # 4+ confirmations
    HIGH = "high"             # 3 confirmations
    MODERATE = "moderate"     # 2 confirmations
    LOW = "low"               # 1 confirmation
    NONE = "none"             # No confluence


@dataclass
class OIContext:
    """Open Interest context"""
    pcr: float = 1.0                    # Put-Call Ratio
    max_pain: float = 0                 # Max pain strike
    call_oi_concentration: float = 0    # Highest call OI
    put_oi_concentration: float = 0     # Highest put OI
    call_buildup: bool = False          # Call OI increasing
    put_buildup: bool = False           # Put OI increasing
    trend: str = "neutral"              # bullish/bearish/neutral


@dataclass
class MarketContext:
    """Overall market context"""
    vix: float = 15.0                   # India VIX
    fii_flow: float = 0                 # FII cash flow (crores)
    dii_flow: float = 0                 # DII cash flow (crores)
    market_trend: str = "neutral"       # bullish/bearish/neutral
    sector_strength: str = "neutral"    # strong/weak/neutral
    expiry_near: bool = False           # Within 2 days of expiry
    gap_type: str = "none"              # gap_up/gap_down/none


@dataclass
class CombinedSignal:
    """Combined signal from multiple sources"""
    direction: SignalType
    entry_price: float
    stop_loss: float
    target1: float
    target2: float
    target3: float
    
    # Confidence scores
    strategy_confidence: float
    oi_confidence: float
    market_confidence: float
    overall_confidence: float
    
    # Confluence
    confluence_level: ConfluenceLevel
    confluence_factors: List[str]
    
    # Individual signals
    strategy_signals: Dict[str, str]
    oi_signal: str
    market_signal: str
    
    # Risk metrics
    risk_reward_ratio: float
    position_size_suggested: int  # Lots
    max_risk_percent: float
    
    # Recommendation
    recommendation: str
    action_plan: List[str]
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class CombinedStrategyService:
    """
    Combines multiple analysis sources for high-confluence signals
    """
    
    def __init__(self, symbol: str = "NIFTY"):
        self.symbol = symbol
        self.strategy_engine = NiftyTradingStrategies(symbol=symbol)
        
        # Weights for different signal sources
        self.weights = {
            'strategy': 0.4,      # Technical strategies
            'oi': 0.35,           # Open Interest
            'market_context': 0.25  # FII/DII, VIX, etc.
        }
        
        # Strategy type weights (based on backtest performance)
        self.strategy_weights = {
            StrategyName.BOLLINGER_SQUEEZE: 1.0,   # Best performer
            StrategyName.SUPERTREND: 0.9,          # Very good
            StrategyName.CPR_PIVOT: 0.85,          # Good for intraday
            StrategyName.NINE_TWENTY: 0.85,        # Good for morning
            StrategyName.ORB: 0.8,                 # Good breakout
            StrategyName.VWAP_STRATEGY: 0.75,      # Decent
            StrategyName.MOMENTUM: 0.7,            # Moderate
            StrategyName.EMA_CROSSOVER: 0.6,       # Average
            StrategyName.RSI_REVERSAL: 0.5,        # Below average
            StrategyName.OPEN_HIGH_LOW: 0.7        # Situational
        }
    
    def analyze_oi_context(
        self,
        current_price: float,
        option_chain_data: Optional[Dict] = None
    ) -> OIContext:
        """
        Analyze Open Interest context
        
        Args:
            current_price: Current underlying price
            option_chain_data: Option chain with OI data
        
        Returns:
            OIContext with OI analysis
        """
        context = OIContext()
        
        if not option_chain_data:
            return context
        
        try:
            # Calculate PCR
            total_call_oi = sum(d.get('call_oi', 0) for d in option_chain_data.values() if isinstance(d, dict))
            total_put_oi = sum(d.get('put_oi', 0) for d in option_chain_data.values() if isinstance(d, dict))
            context.pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 1.0
            
            # Find max pain (strike with highest total OI)
            max_oi = 0
            for strike, data in option_chain_data.items():
                if isinstance(data, dict):
                    total_oi = data.get('call_oi', 0) + data.get('put_oi', 0)
                    if total_oi > max_oi:
                        max_oi = total_oi
                        context.max_pain = float(strike)
            
            # Determine trend based on PCR
            if context.pcr > 1.2:
                context.trend = "bullish"  # More puts = bullish (support)
            elif context.pcr < 0.8:
                context.trend = "bearish"  # More calls = bearish (resistance)
            else:
                context.trend = "neutral"
            
        except Exception as e:
            logger.error(f"Error analyzing OI context: {e}")
        
        return context
    
    def analyze_market_context(
        self,
        vix: Optional[float] = None,
        fii_data: Optional[Dict] = None,
        prev_close: Optional[float] = None,
        current_price: Optional[float] = None,
        expiry_date: Optional[str] = None
    ) -> MarketContext:
        """
        Analyze overall market context
        
        Args:
            vix: India VIX value
            fii_data: FII/DII flow data
            prev_close: Previous day close
            current_price: Current price
            expiry_date: Next expiry date
        
        Returns:
            MarketContext with market analysis
        """
        context = MarketContext()
        
        # VIX
        if vix is not None:
            context.vix = vix
            if vix > 20:
                context.market_trend = "volatile"
            elif vix < 12:
                context.market_trend = "calm"
        
        # FII/DII flows
        if fii_data:
            context.fii_flow = fii_data.get('fii_net', 0)
            context.dii_flow = fii_data.get('dii_net', 0)
            
            if context.fii_flow > 500:
                context.market_trend = "bullish"
            elif context.fii_flow < -500:
                context.market_trend = "bearish"
        
        # Gap analysis
        if prev_close and current_price:
            gap_percent = ((current_price - prev_close) / prev_close) * 100
            if gap_percent > 0.5:
                context.gap_type = "gap_up"
            elif gap_percent < -0.5:
                context.gap_type = "gap_down"
        
        # Expiry proximity
        if expiry_date:
            try:
                expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
                days_to_expiry = (expiry - datetime.now()).days
                context.expiry_near = days_to_expiry <= 2
            except Exception:
                pass
        
        return context
    
    def get_strategy_signals(
        self,
        df: pd.DataFrame,
        prev_day_data: Optional[Dict] = None
    ) -> Tuple[Dict[str, TradingSignal], Dict]:
        """
        Get signals from all strategies
        
        Args:
            df: OHLCV DataFrame
            prev_day_data: Previous day OHLC for CPR
        
        Returns:
            Tuple of (signals dict, combined recommendation)
        """
        signals = self.strategy_engine.get_all_signals(df, prev_day_data)
        recommendation = self.strategy_engine.get_combined_recommendation(signals)
        
        return signals, recommendation
    
    def calculate_confluence(
        self,
        strategy_signals: Dict[str, TradingSignal],
        oi_context: OIContext,
        market_context: MarketContext
    ) -> Tuple[ConfluenceLevel, List[str]]:
        """
        Calculate confluence level from all signals
        
        Returns:
            Tuple of (confluence level, list of confirming factors)
        """
        bullish_factors = []
        bearish_factors = []
        
        # 1. Strategy signals
        for name, signal in strategy_signals.items():
            weight = self.strategy_weights.get(StrategyName(name), 0.5)
            if signal.signal == SignalType.BUY and signal.confidence > 0.6:
                bullish_factors.append(f"Strategy {name}: BUY (conf: {signal.confidence:.0%})")
            elif signal.signal == SignalType.SELL and signal.confidence > 0.6:
                bearish_factors.append(f"Strategy {name}: SELL (conf: {signal.confidence:.0%})")
        
        # 2. OI context
        if oi_context.trend == "bullish":
            bullish_factors.append(f"OI PCR: {oi_context.pcr:.2f} (bullish)")
        elif oi_context.trend == "bearish":
            bearish_factors.append(f"OI PCR: {oi_context.pcr:.2f} (bearish)")
        
        if oi_context.put_buildup:
            bullish_factors.append("Put OI buildup (support)")
        if oi_context.call_buildup:
            bearish_factors.append("Call OI buildup (resistance)")
        
        # 3. Market context
        if market_context.market_trend == "bullish":
            bullish_factors.append(f"FII buying: ₹{market_context.fii_flow:.0f} Cr")
        elif market_context.market_trend == "bearish":
            bearish_factors.append(f"FII selling: ₹{market_context.fii_flow:.0f} Cr")
        
        if market_context.gap_type == "gap_up":
            bullish_factors.append("Gap up opening")
        elif market_context.gap_type == "gap_down":
            bearish_factors.append("Gap down opening")
        
        # Determine confluence
        net_bullish = len(bullish_factors)
        net_bearish = len(bearish_factors)
        
        dominant_factors = bullish_factors if net_bullish > net_bearish else bearish_factors
        total_factors = max(net_bullish, net_bearish)
        
        if total_factors >= 4:
            level = ConfluenceLevel.VERY_HIGH
        elif total_factors >= 3:
            level = ConfluenceLevel.HIGH
        elif total_factors >= 2:
            level = ConfluenceLevel.MODERATE
        elif total_factors >= 1:
            level = ConfluenceLevel.LOW
        else:
            level = ConfluenceLevel.NONE
        
        return level, dominant_factors
    
    def calculate_position_size(
        self,
        capital: float,
        entry: float,
        stop_loss: float,
        max_risk_percent: float = 2.0,
        lot_size: int = 50
    ) -> int:
        """
        Calculate optimal position size based on risk
        
        Args:
            capital: Trading capital
            entry: Entry price
            stop_loss: Stop loss price
            max_risk_percent: Maximum risk per trade (%)
            lot_size: Contract lot size
        
        Returns:
            Number of lots to trade
        """
        risk_per_share = abs(entry - stop_loss)
        max_risk_amount = capital * (max_risk_percent / 100)
        
        if risk_per_share <= 0:
            return 1
        
        shares = max_risk_amount / risk_per_share
        lots = int(shares / lot_size)
        
        return max(1, lots)  # Minimum 1 lot
    
    def generate_action_plan(
        self,
        signal: SignalType,
        entry: float,
        stop_loss: float,
        targets: List[float],
        confluence_level: ConfluenceLevel,
        oi_context: OIContext,
        market_context: MarketContext
    ) -> List[str]:
        """
        Generate actionable trading plan
        """
        actions = []
        
        if signal == SignalType.NEUTRAL:
            actions.append("⏸️ NO TRADE - Wait for clearer setup")
            return actions
        
        direction = "BUY" if signal == SignalType.BUY else "SELL"
        
        # Entry action
        if confluence_level in [ConfluenceLevel.VERY_HIGH, ConfluenceLevel.HIGH]:
            actions.append(f"🟢 ENTER {direction} at ₹{entry:.2f}")
            actions.append(f"📊 High confluence - Full position size")
        elif confluence_level == ConfluenceLevel.MODERATE:
            actions.append(f"🟡 ENTER {direction} at ₹{entry:.2f}")
            actions.append(f"📊 Moderate confluence - 50% position size")
        else:
            actions.append(f"🟠 CONSIDER {direction} at ₹{entry:.2f}")
            actions.append(f"📊 Low confluence - Wait for confirmation or 25% position")
        
        # Stop loss
        actions.append(f"🛑 STOP LOSS at ₹{stop_loss:.2f}")
        
        # Targets
        actions.append(f"🎯 Target 1: ₹{targets[0]:.2f} (Exit 50%)")
        actions.append(f"🎯 Target 2: ₹{targets[1]:.2f} (Exit 30%)")
        if len(targets) > 2 and targets[2] > 0:
            actions.append(f"🎯 Target 3: ₹{targets[2]:.2f} (Trail remaining)")
        
        # Special conditions
        if market_context.expiry_near:
            actions.append("⚠️ EXPIRY NEAR - Reduce position size, tight stops")
        
        if market_context.vix > 20:
            actions.append("⚠️ HIGH VIX - Expect wider swings, adjust stops")
        
        if oi_context.max_pain > 0:
            actions.append(f"📍 Max Pain: ₹{oi_context.max_pain:.0f} - Price may gravitate here")
        
        return actions
    
    def get_combined_signal(
        self,
        df: pd.DataFrame,
        option_chain_data: Optional[Dict] = None,
        vix: Optional[float] = None,
        fii_data: Optional[Dict] = None,
        prev_day_data: Optional[Dict] = None,
        capital: float = 100000,
        lot_size: int = 50
    ) -> CombinedSignal:
        """
        Generate combined signal from all analysis sources
        
        Args:
            df: OHLCV DataFrame
            option_chain_data: Option chain OI data
            vix: Current VIX
            fii_data: FII/DII flow data
            prev_day_data: Previous day OHLC
            capital: Trading capital
            lot_size: Contract lot size
        
        Returns:
            CombinedSignal with full analysis
        """
        current_price = df.iloc[-1]['close']
        prev_close = df.iloc[-2]['close'] if len(df) > 1 else current_price
        
        # 1. Get strategy signals
        strategy_signals, strategy_recommendation = self.get_strategy_signals(df, prev_day_data)
        
        # 2. Analyze OI context
        oi_context = self.analyze_oi_context(current_price, option_chain_data)
        
        # 3. Analyze market context
        market_context = self.analyze_market_context(
            vix=vix,
            fii_data=fii_data,
            prev_close=prev_close,
            current_price=current_price
        )
        
        # 4. Calculate confluence
        confluence_level, confluence_factors = self.calculate_confluence(
            strategy_signals, oi_context, market_context
        )
        
        # 5. Determine overall direction
        bullish_score = 0
        bearish_score = 0
        
        for name, signal in strategy_signals.items():
            weight = self.strategy_weights.get(StrategyName(name), 0.5)
            if signal.signal == SignalType.BUY:
                bullish_score += weight * signal.confidence
            elif signal.signal == SignalType.SELL:
                bearish_score += weight * signal.confidence
        
        # Add OI weight
        if oi_context.trend == "bullish":
            bullish_score += 0.3
        elif oi_context.trend == "bearish":
            bearish_score += 0.3
        
        # Add market context weight
        if market_context.market_trend == "bullish":
            bullish_score += 0.2
        elif market_context.market_trend == "bearish":
            bearish_score += 0.2
        
        # Determine direction
        if bullish_score > bearish_score + 0.2:
            direction = SignalType.BUY
        elif bearish_score > bullish_score + 0.2:
            direction = SignalType.SELL
        else:
            direction = SignalType.NEUTRAL
        
        # 6. Calculate entry, SL, targets
        if direction == SignalType.BUY:
            # Get the strongest bullish strategy signal
            best_signal = None
            best_score = 0
            for name, signal in strategy_signals.items():
                if signal.signal == SignalType.BUY:
                    score = self.strategy_weights.get(StrategyName(name), 0.5) * signal.confidence
                    if score > best_score:
                        best_score = score
                        best_signal = signal
            
            if best_signal:
                entry = best_signal.entry_price
                stop_loss = best_signal.stop_loss
                target1 = best_signal.target1
                target2 = best_signal.target2
                target3 = target2 + (target2 - target1)  # Extension
            else:
                entry = current_price
                stop_loss = current_price * 0.99
                target1 = current_price * 1.01
                target2 = current_price * 1.02
                target3 = current_price * 1.03
        
        elif direction == SignalType.SELL:
            # Get the strongest bearish strategy signal
            best_signal = None
            best_score = 0
            for name, signal in strategy_signals.items():
                if signal.signal == SignalType.SELL:
                    score = self.strategy_weights.get(StrategyName(name), 0.5) * signal.confidence
                    if score > best_score:
                        best_score = score
                        best_signal = signal
            
            if best_signal:
                entry = best_signal.entry_price
                stop_loss = best_signal.stop_loss
                target1 = best_signal.target1
                target2 = best_signal.target2
                target3 = target2 - (target1 - target2)  # Extension
            else:
                entry = current_price
                stop_loss = current_price * 1.01
                target1 = current_price * 0.99
                target2 = current_price * 0.98
                target3 = current_price * 0.97
        
        else:
            entry = current_price
            stop_loss = current_price
            target1 = current_price
            target2 = current_price
            target3 = current_price
        
        # 7. Calculate confidences
        strategy_confidence = strategy_recommendation.get('confidence', 0.5)
        oi_confidence = 0.6 if oi_context.trend != "neutral" else 0.4
        market_confidence = 0.6 if market_context.market_trend != "neutral" else 0.4
        
        overall_confidence = (
            strategy_confidence * self.weights['strategy'] +
            oi_confidence * self.weights['oi'] +
            market_confidence * self.weights['market_context']
        )
        
        # 8. Risk metrics
        risk_reward_ratio = abs(target1 - entry) / abs(entry - stop_loss) if entry != stop_loss else 0
        position_size = self.calculate_position_size(capital, entry, stop_loss, 2.0, lot_size)
        
        # 9. Generate action plan
        action_plan = self.generate_action_plan(
            direction, entry, stop_loss, [target1, target2, target3],
            confluence_level, oi_context, market_context
        )
        
        # 10. Generate recommendation text
        if direction == SignalType.NEUTRAL:
            recommendation = "⏸️ NO TRADE - Market conditions unclear. Wait for better setup."
        elif confluence_level == ConfluenceLevel.VERY_HIGH:
            recommendation = f"🟢 STRONG {direction.value.upper()} - Very high confluence. Execute with full conviction."
        elif confluence_level == ConfluenceLevel.HIGH:
            recommendation = f"🟢 {direction.value.upper()} RECOMMENDED - High confluence. Good setup."
        elif confluence_level == ConfluenceLevel.MODERATE:
            recommendation = f"🟡 {direction.value.upper()} POSSIBLE - Moderate confluence. Use smaller position."
        else:
            recommendation = f"🟠 WEAK {direction.value.upper()} - Low confluence. Consider waiting."
        
        # Create combined signal
        return CombinedSignal(
            direction=direction,
            entry_price=entry,
            stop_loss=stop_loss,
            target1=target1,
            target2=target2,
            target3=target3,
            strategy_confidence=strategy_confidence,
            oi_confidence=oi_confidence,
            market_confidence=market_confidence,
            overall_confidence=overall_confidence,
            confluence_level=confluence_level,
            confluence_factors=confluence_factors,
            strategy_signals={name: signal.signal.value for name, signal in strategy_signals.items()},
            oi_signal=oi_context.trend,
            market_signal=market_context.market_trend,
            risk_reward_ratio=risk_reward_ratio,
            position_size_suggested=position_size,
            max_risk_percent=2.0,
            recommendation=recommendation,
            action_plan=action_plan
        )


# Export
__all__ = ['CombinedStrategyService', 'CombinedSignal', 'ConfluenceLevel', 'OIContext', 'MarketContext']
