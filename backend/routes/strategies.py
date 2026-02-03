"""
Nifty Trading Strategies API Routes
====================================
Endpoints for accessing trading strategies, signals, and backtesting.

Routes:
- GET /api/strategies - List all available strategies
- GET /api/strategies/{strategy_name}/signal - Get signal for specific strategy
- POST /api/strategies/signals - Get all strategy signals for given data
- POST /api/strategies/backtest - Run backtest on strategy
- POST /api/strategies/backtest/all - Run backtest on all strategies
- GET /api/strategies/recommendation - Get combined recommendation
- POST /api/strategies/combined-signal - Get high-confluence combined signal
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import logging

# Import strategy engine
from services.nifty_strategies import (
    NiftyTradingStrategies,
    StrategyBacktester,
    StrategyName,
    SignalType
)

# Import combined strategy service
from services.combined_strategy_service import (
    CombinedStrategyService,
    CombinedSignal,
    ConfluenceLevel
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/strategies", tags=["Trading Strategies"])

# Initialize strategy engine
strategy_engine = NiftyTradingStrategies(symbol="NIFTY")
backtester = StrategyBacktester(strategy_engine)


# ============================================
# PYDANTIC MODELS
# ============================================

class OHLCVData(BaseModel):
    """OHLCV candle data"""
    timestamp: Optional[str] = None
    open: float
    high: float
    low: float
    close: float
    volume: float = 0

class PriceDataRequest(BaseModel):
    """Request with price data"""
    symbol: str = "NIFTY"
    candles: List[OHLCVData]
    prev_day: Optional[Dict] = None  # Previous day OHLC for CPR

class BacktestRequest(BaseModel):
    """Backtest request"""
    strategy: str
    symbol: str = "NIFTY"
    candles: List[OHLCVData]
    capital: float = 100000
    lot_size: int = 50

class CPRRequest(BaseModel):
    """CPR calculation request"""
    prev_high: float
    prev_low: float
    prev_close: float
    current_price: float

class NineTwentyRequest(BaseModel):
    """9:20 candle strategy request"""
    candle_high: float
    candle_low: float
    candle_open: float
    candle_close: float
    current_price: float

class OHLRequest(BaseModel):
    """Open High/Low strategy request"""
    open_price: float
    high_price: float
    low_price: float
    current_price: float
    vwap: Optional[float] = None
    volume: Optional[float] = None
    avg_volume: Optional[float] = None

class StrategyInfo(BaseModel):
    """Strategy information"""
    name: str
    description: str
    type: str  # trend_following, mean_reversion, breakout, etc.
    timeframe: str  # intraday, swing, positional
    historical_win_rate: float
    parameters: Dict

class TradingSignalResponse(BaseModel):
    """Trading signal response"""
    strategy: str
    signal: str
    entry_price: float
    stop_loss: float
    target1: float
    target2: float
    target3: Optional[float] = None
    confidence: float
    risk_reward: float
    reason: str
    timestamp: str
    additional_data: Dict = {}


# ============================================
# ROUTES
# ============================================

@router.get("/")
async def list_strategies():
    """
    List all available trading strategies with details
    
    Returns list of strategies with:
    - Name and description
    - Type (trend following, mean reversion, etc.)
    - Historical win rate
    - Recommended timeframe
    - Key parameters
    """
    strategies = [
        {
            "name": "supertrend",
            "display_name": "Supertrend Strategy",
            "description": "Trend following strategy using ATR-based dynamic support/resistance. Best in trending markets.",
            "type": "trend_following",
            "timeframe": "intraday/swing",
            "historical_win_rate": 58,
            "parameters": strategy_engine.strategy_params[StrategyName.SUPERTREND],
            "strengths": ["Works well in trending markets", "Clear entry/exit signals", "Built-in stop loss"],
            "weaknesses": ["Whipsaws in sideways markets", "Late entries in fast moves"]
        },
        {
            "name": "orb_breakout",
            "display_name": "Opening Range Breakout (ORB)",
            "description": "Trade breakouts from the first 15/30 minute range. Captures morning momentum.",
            "type": "breakout",
            "timeframe": "intraday",
            "historical_win_rate": 55,
            "parameters": strategy_engine.strategy_params[StrategyName.ORB],
            "strengths": ["Catches early momentum", "Clear levels", "High reward potential"],
            "weaknesses": ["False breakouts", "Requires quick execution"]
        },
        {
            "name": "rsi_reversal",
            "display_name": "RSI Mean Reversion",
            "description": "Trade reversals from overbought/oversold RSI zones. Works in range-bound markets.",
            "type": "mean_reversion",
            "timeframe": "swing",
            "historical_win_rate": 52,
            "parameters": strategy_engine.strategy_params[StrategyName.RSI_REVERSAL],
            "strengths": ["Catches reversals early", "Good in ranges", "Clear zones"],
            "weaknesses": ["Can fail in strong trends", "Needs confirmation"]
        },
        {
            "name": "ema_crossover",
            "display_name": "EMA Crossover (9/21/55)",
            "description": "Trade when fast EMA crosses slow EMA. Simple trend confirmation.",
            "type": "trend_following",
            "timeframe": "intraday/swing",
            "historical_win_rate": 54,
            "parameters": strategy_engine.strategy_params[StrategyName.EMA_CROSSOVER],
            "strengths": ["Simple to follow", "Good trend filter", "Works on multiple timeframes"],
            "weaknesses": ["Lagging indicator", "Whipsaws in ranges"]
        },
        {
            "name": "bollinger_squeeze",
            "display_name": "Bollinger Bands Squeeze",
            "description": "Trade volatility breakouts after low volatility squeeze periods.",
            "type": "volatility_breakout",
            "timeframe": "intraday/swing",
            "historical_win_rate": 60,
            "parameters": strategy_engine.strategy_params[StrategyName.BOLLINGER_SQUEEZE],
            "strengths": ["Catches big moves", "Identifies quiet periods", "Mean reversion option"],
            "weaknesses": ["Needs volatility", "Direction unclear in squeeze"]
        },
        {
            "name": "cpr_pivot",
            "display_name": "CPR (Central Pivot Range)",
            "description": "Trade based on previous day's pivot levels. Good for intraday support/resistance.",
            "type": "support_resistance",
            "timeframe": "intraday",
            "historical_win_rate": 58,
            "parameters": strategy_engine.strategy_params[StrategyName.CPR_PIVOT],
            "strengths": ["Pre-defined levels", "Virgin CPR = strong moves", "Good risk management"],
            "weaknesses": ["Needs previous day data", "Levels can be broken"]
        },
        {
            "name": "vwap_strategy",
            "display_name": "VWAP Strategy",
            "description": "Trade around Volume Weighted Average Price. Institutional favorite.",
            "type": "mean_reversion",
            "timeframe": "intraday",
            "historical_win_rate": 56,
            "parameters": strategy_engine.strategy_params[StrategyName.VWAP_STRATEGY],
            "strengths": ["Institutional level", "Good for mean reversion", "Volume-based"],
            "weaknesses": ["Only valid intraday", "Resets daily"]
        },
        {
            "name": "momentum",
            "display_name": "Momentum Strategy",
            "description": "Ride strong price momentum with volume confirmation.",
            "type": "momentum",
            "timeframe": "intraday/swing",
            "historical_win_rate": 55,
            "parameters": strategy_engine.strategy_params[StrategyName.MOMENTUM],
            "strengths": ["Catches big moves", "Volume confirmation", "Trend continuation"],
            "weaknesses": ["Late entry risk", "Reversal risk"]
        },
        {
            "name": "nine_twenty",
            "display_name": "9:20 AM Candle Strategy",
            "description": "Trade breakout of first 5-minute candle (9:15-9:20). Popular intraday method.",
            "type": "breakout",
            "timeframe": "intraday",
            "historical_win_rate": 62,
            "parameters": strategy_engine.strategy_params[StrategyName.NINE_TWENTY],
            "strengths": ["High win rate", "Clear rules", "Time-bound exit"],
            "weaknesses": ["Gap days challenging", "Requires morning attention"]
        },
        {
            "name": "open_high_low",
            "display_name": "Open High/Low (OHL) Strategy",
            "description": "Trade when Open equals Day's High or Low after first 15 minutes.",
            "type": "pattern",
            "timeframe": "intraday",
            "historical_win_rate": 58,
            "parameters": strategy_engine.strategy_params[StrategyName.OPEN_HIGH_LOW],
            "strengths": ["Easy to identify", "Clear direction", "VWAP filter available"],
            "weaknesses": ["Not always available", "Needs volume confirmation"]
        }
    ]
    
    return {
        "total_strategies": len(strategies),
        "strategies": strategies,
        "note": "Use /api/strategies/{name}/signal to get current signal for any strategy"
    }


@router.post("/signals")
async def get_all_signals(request: PriceDataRequest):
    """
    Get signals from all strategies for given price data
    
    Provide OHLCV candles and optionally previous day data for CPR.
    Returns signals from all strategies with combined recommendation.
    """
    import math
    import json
    from starlette.responses import Response
    
    def sanitize_for_json(obj):
        """Recursively sanitize values for JSON compatibility"""
        if obj is None:
            return None
        if isinstance(obj, dict):
            return {k: sanitize_for_json(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [sanitize_for_json(item) for item in obj]
        if isinstance(obj, bool):
            return obj
        if isinstance(obj, str):
            return obj
        if hasattr(obj, 'item'):  # numpy scalar
            obj = obj.item()
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0.0
            return obj
        if isinstance(obj, int):
            return obj
        try:
            f = float(obj)
            if math.isnan(f) or math.isinf(f):
                return 0.0
            return f
        except (ValueError, TypeError):
            return str(obj) if obj is not None else None
    
    try:
        # Convert candles to DataFrame
        df = pd.DataFrame([c.dict() for c in request.candles])
        
        # Ensure required columns
        required_cols = ['open', 'high', 'low', 'close']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing column: {col}")
        
        if 'volume' not in df.columns:
            df['volume'] = 0
        
        # Get all signals
        signals = strategy_engine.get_all_signals(df, request.prev_day)
        
        # Convert to response format with sanitization
        signals_response = {}
        for name, signal in signals.items():
            signals_response[name] = sanitize_for_json({
                "strategy": signal.strategy,
                "signal": signal.signal.value,
                "entry_price": signal.entry_price,
                "stop_loss": signal.stop_loss,
                "target1": signal.target1,
                "target2": signal.target2,
                "confidence": signal.confidence,
                "risk_reward": signal.risk_reward,
                "reason": signal.reason,
                "timestamp": signal.timestamp,
                "additional_data": signal.additional_data
            })
        
        # Get combined recommendation
        recommendation = strategy_engine.get_combined_recommendation(signals)
        recommendation = sanitize_for_json(recommendation)
        
        current_price = float(df.iloc[-1]['close']) if len(df) > 0 else 0.0
        if math.isnan(current_price) or math.isinf(current_price):
            current_price = 0.0
        
        response_data = {
            "symbol": request.symbol,
            "current_price": current_price,
            "signals": signals_response,
            "recommendation": recommendation,
            "timestamp": datetime.now().isoformat()
        }
        
        # Use json.dumps with custom encoder as safety net
        class SafeEncoder(json.JSONEncoder):
            def encode(self, o):
                def _sanitize(v):
                    if isinstance(v, dict):
                        return {k: _sanitize(val) for k, val in v.items()}
                    if isinstance(v, (list, tuple)):
                        return [_sanitize(item) for item in v]
                    if isinstance(v, float):
                        if math.isnan(v) or math.isinf(v):
                            return 0.0
                    return v
                return super().encode(_sanitize(o))
        
        json_str = json.dumps(response_data, cls=SafeEncoder)
        return Response(content=json_str, media_type="application/json")
    
    except Exception as e:
        logger.error(f"Error getting signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{strategy_name}/info")
async def get_strategy_info(strategy_name: str):
    """Get detailed information about a specific strategy"""
    try:
        strategy = StrategyName(strategy_name)
        params = strategy_engine.strategy_params.get(strategy, {})
        win_rate = strategy_engine.historical_win_rates.get(strategy, 0.5)
        
        return {
            "name": strategy_name,
            "parameters": params,
            "historical_win_rate": round(win_rate * 100, 1),
            "description": f"Trading strategy: {strategy_name.replace('_', ' ').title()}"
        }
    
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail=f"Strategy '{strategy_name}' not found. Use /api/strategies to see available strategies."
        )


@router.post("/cpr/calculate")
async def calculate_cpr_levels(request: CPRRequest):
    """
    Calculate CPR levels for today based on previous day's OHLC
    
    Returns:
    - Pivot, TC (Top Central), BC (Bottom Central)
    - Support levels: S1, S2, S3
    - Resistance levels: R1, R2, R3
    - CPR width and narrow CPR indication
    """
    try:
        cpr_levels = strategy_engine.calculate_cpr(
            request.prev_high,
            request.prev_low,
            request.prev_close
        )
        
        signal = strategy_engine.get_cpr_signal(request.current_price, cpr_levels)
        
        return {
            "cpr_levels": cpr_levels,
            "signal": {
                "signal": signal.signal.value,
                "entry_price": signal.entry_price,
                "stop_loss": signal.stop_loss,
                "target1": signal.target1,
                "target2": signal.target2,
                "confidence": signal.confidence,
                "reason": signal.reason
            },
            "interpretation": {
                "is_narrow_cpr": cpr_levels["is_narrow_cpr"],
                "narrow_cpr_note": "Narrow CPR often leads to big directional moves" if cpr_levels["is_narrow_cpr"] else "Normal CPR width",
                "price_position": "Above CPR (Bullish)" if request.current_price > cpr_levels["tc"] else 
                                  "Below CPR (Bearish)" if request.current_price < cpr_levels["bc"] else
                                  "Within CPR (Consolidation)"
            }
        }
    
    except Exception as e:
        logger.error(f"Error calculating CPR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nine-twenty/signal")
async def get_nine_twenty_signal(request: NineTwentyRequest):
    """
    Get 9:20 AM candle strategy signal
    
    Provide the 9:15-9:20 candle OHLC and current price.
    Returns buy/sell signal based on breakout of 9:20 candle high/low.
    """
    try:
        candle_920 = {
            "open": request.candle_open,
            "high": request.candle_high,
            "low": request.candle_low,
            "close": request.candle_close
        }
        
        signal = strategy_engine.get_nine_twenty_signal(candle_920, request.current_price)
        
        return {
            "candle_920": candle_920,
            "current_price": request.current_price,
            "signal": signal.signal.value,
            "entry_price": signal.entry_price,
            "stop_loss": signal.stop_loss,
            "target1": signal.target1,
            "target2": signal.target2,
            "confidence": signal.confidence,
            "risk_reward": signal.risk_reward,
            "reason": signal.reason,
            "additional_data": signal.additional_data,
            "rules": {
                "buy_above": round(request.candle_high * 1.001, 2),
                "sell_below": round(request.candle_low * 0.999, 2),
                "exit_time": "15:15",
                "strategy_type": "Intraday Breakout"
            }
        }
    
    except Exception as e:
        logger.error(f"Error in 9:20 signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ohl/signal")
async def get_open_high_low_signal(request: OHLRequest):
    """
    Get Open High/Low (OHL) strategy signal
    
    If Open = High after 15 minutes -> Bearish (sell near VWAP)
    If Open = Low after 15 minutes -> Bullish (buy near VWAP)
    """
    try:
        signal = strategy_engine.get_open_high_low_signal(
            request.open_price,
            request.high_price,
            request.low_price,
            request.current_price,
            request.vwap,
            request.volume,
            request.avg_volume
        )
        
        # Determine pattern
        tolerance = 0.001
        pattern = "NONE"
        if abs(request.open_price - request.high_price) / request.open_price < tolerance:
            pattern = "OPEN_EQUALS_HIGH (Bearish)"
        elif abs(request.open_price - request.low_price) / request.open_price < tolerance:
            pattern = "OPEN_EQUALS_LOW (Bullish)"
        
        return {
            "price_data": {
                "open": request.open_price,
                "high": request.high_price,
                "low": request.low_price,
                "current": request.current_price,
                "vwap": request.vwap
            },
            "pattern": pattern,
            "signal": signal.signal.value,
            "entry_price": signal.entry_price,
            "stop_loss": signal.stop_loss,
            "target1": signal.target1,
            "target2": signal.target2,
            "confidence": signal.confidence,
            "reason": signal.reason,
            "rules": {
                "entry_condition": "Wait 15 mins after open, check if Open = High or Open = Low",
                "vwap_filter": "Enter near VWAP for better risk/reward",
                "volume_confirmation": "Higher volume = stronger signal"
            }
        }
    
    except Exception as e:
        logger.error(f"Error in OHL signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backtest")
async def run_backtest(request: BacktestRequest):
    """
    Run backtest on a specific strategy
    
    Provide historical candle data and strategy name.
    Returns detailed backtest results with metrics.
    """
    try:
        # Validate strategy
        try:
            strategy = StrategyName(request.strategy)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid strategy: {request.strategy}"
            )
        
        # Convert candles to DataFrame
        df = pd.DataFrame([c.dict() for c in request.candles])
        
        if len(df) < 50:
            raise HTTPException(
                status_code=400,
                detail="Need at least 50 candles for backtesting"
            )
        
        # Run backtest
        result = backtester.backtest_strategy(
            df,
            strategy,
            request.capital,
            request.lot_size
        )
        
        return {
            "strategy": result.strategy_name,
            "symbol": request.symbol,
            "capital": request.capital,
            "lot_size": request.lot_size,
            "period": f"{len(request.candles)} candles",
            "results": {
                "total_trades": result.total_trades,
                "winning_trades": result.winning_trades,
                "losing_trades": result.losing_trades,
                "win_rate": result.win_rate,
                "total_pnl": result.total_pnl,
                "total_pnl_percent": result.total_pnl_percent,
                "avg_profit": result.avg_profit,
                "avg_loss": result.avg_loss,
                "max_profit": result.max_profit,
                "max_loss": result.max_loss,
                "max_drawdown": result.max_drawdown,
                "profit_factor": result.profit_factor,
                "sharpe_ratio": result.sharpe_ratio
            },
            "trades": [
                {
                    "entry_date": t.entry_date,
                    "entry_price": t.entry_price,
                    "exit_date": t.exit_date,
                    "exit_price": t.exit_price,
                    "pnl": t.pnl,
                    "pnl_percent": t.pnl_percent,
                    "exit_reason": t.exit_reason
                }
                for t in result.trades[:50]  # Limit to 50 trades in response
            ],
            "equity_curve": result.equity_curve[:100] if result.equity_curve else [],
            "recommendation": _get_backtest_recommendation(result)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backtest/all")
async def run_all_backtests(request: PriceDataRequest, capital: float = 100000, lot_size: int = 50):
    """
    Run backtest on all strategies and compare results
    
    Returns comparison of all strategies with recommendations.
    """
    try:
        # Convert candles to DataFrame
        df = pd.DataFrame([c.dict() for c in request.candles])
        
        if len(df) < 50:
            raise HTTPException(
                status_code=400,
                detail="Need at least 50 candles for backtesting"
            )
        
        # Run all backtests
        results = backtester.run_all_backtests(df, capital, lot_size)
        
        # Generate report
        report = backtester.generate_backtest_report(results)
        
        # Format results
        strategy_results = {}
        for name, result in results.items():
            strategy_results[name] = {
                "total_trades": result.total_trades,
                "win_rate": result.win_rate,
                "total_pnl": result.total_pnl,
                "profit_factor": result.profit_factor,
                "max_drawdown": result.max_drawdown,
                "sharpe_ratio": result.sharpe_ratio
            }
        
        return {
            "symbol": request.symbol,
            "capital": capital,
            "lot_size": lot_size,
            "period": f"{len(request.candles)} candles",
            "strategy_results": strategy_results,
            "summary": report["summary"],
            "best_strategy": report["best_strategy"],
            "total_combined_pnl": report["total_combined_pnl"],
            "average_win_rate": report["average_win_rate"],
            "recommendations": report["recommendations"]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in all backtests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_backtest_recommendation(result) -> str:
    """Generate recommendation based on backtest results"""
    if result.total_trades == 0:
        return "⚠️ No trades generated - check data quality or strategy parameters"
    
    if result.win_rate >= 55 and result.profit_factor >= 1.5:
        return f"✅ RECOMMENDED: Strong performance with {result.win_rate}% win rate and {result.profit_factor:.2f} profit factor"
    
    elif result.win_rate >= 50 and result.profit_factor >= 1.2:
        return f"⚠️ MODERATE: Acceptable performance - consider combining with other confirmations"
    
    else:
        return f"❌ CAUTION: Below average performance - optimize parameters or use different strategy"


# ============================================
# COMBINED SIGNAL ENDPOINTS
# ============================================

class CombinedSignalRequest(BaseModel):
    """Request for combined signal analysis"""
    symbol: str = "NIFTY"
    candles: List[OHLCVData]
    prev_day: Optional[Dict] = None
    option_chain_data: Optional[Dict] = None
    vix: Optional[float] = None
    fii_data: Optional[Dict] = None
    capital: float = 100000
    lot_size: int = 50


# Initialize combined service
combined_service = CombinedStrategyService(symbol="NIFTY")


@router.post("/combined-signal")
async def get_combined_signal(request: CombinedSignalRequest):
    """
    Get high-confluence combined signal from multiple analysis sources
    
    Combines:
    - 10 technical strategy signals
    - Open Interest analysis
    - FII/DII market context
    - VIX volatility context
    
    Returns comprehensive trade recommendation with:
    - Entry, Stop Loss, Targets
    - Confluence level and factors
    - Position sizing suggestion
    - Action plan
    """
    try:
        # Convert candles to DataFrame
        df = pd.DataFrame([c.dict() for c in request.candles])
        
        if len(df) < 20:
            raise HTTPException(status_code=400, detail="Need at least 20 candles for analysis")
        
        # Ensure required columns
        required_cols = ['open', 'high', 'low', 'close']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing column: {col}")
        
        if 'volume' not in df.columns:
            df['volume'] = 0
        
        # Get combined signal
        signal = combined_service.get_combined_signal(
            df=df,
            option_chain_data=request.option_chain_data,
            vix=request.vix,
            fii_data=request.fii_data,
            prev_day_data=request.prev_day,
            capital=request.capital,
            lot_size=request.lot_size
        )
        
        return {
            "symbol": request.symbol,
            "current_price": df.iloc[-1]['close'],
            "signal": {
                "direction": signal.direction.value,
                "entry_price": signal.entry_price,
                "stop_loss": signal.stop_loss,
                "target1": signal.target1,
                "target2": signal.target2,
                "target3": signal.target3
            },
            "confidence": {
                "strategy": round(signal.strategy_confidence * 100, 1),
                "oi": round(signal.oi_confidence * 100, 1),
                "market": round(signal.market_confidence * 100, 1),
                "overall": round(signal.overall_confidence * 100, 1)
            },
            "confluence": {
                "level": signal.confluence_level.value,
                "factors": signal.confluence_factors
            },
            "individual_signals": {
                "strategies": signal.strategy_signals,
                "oi": signal.oi_signal,
                "market": signal.market_signal
            },
            "risk_metrics": {
                "risk_reward_ratio": round(signal.risk_reward_ratio, 2),
                "suggested_lots": signal.position_size_suggested,
                "max_risk_percent": signal.max_risk_percent
            },
            "recommendation": signal.recommendation,
            "action_plan": signal.action_plan,
            "timestamp": signal.timestamp
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting combined signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/confluence-guide")
async def get_confluence_guide():
    """
    Get guide for understanding confluence levels and when to trade
    """
    return {
        "confluence_levels": {
            "very_high": {
                "description": "4+ confirming factors",
                "action": "Execute with full conviction. Use full position size.",
                "win_probability": "70-80%"
            },
            "high": {
                "description": "3 confirming factors",
                "action": "Good setup. Execute with confidence.",
                "win_probability": "60-70%"
            },
            "moderate": {
                "description": "2 confirming factors",
                "action": "Use smaller position. Set tight stops.",
                "win_probability": "50-60%"
            },
            "low": {
                "description": "1 confirming factor",
                "action": "Wait for more confirmation or skip.",
                "win_probability": "40-50%"
            },
            "none": {
                "description": "No clear signals",
                "action": "Do not trade. Wait for better setup.",
                "win_probability": "<40%"
            }
        },
        "signal_sources": {
            "strategies": "10 technical strategies (Supertrend, ORB, RSI, etc.)",
            "oi": "Open Interest PCR, buildup analysis, max pain",
            "market": "FII/DII flows, VIX, gap analysis"
        },
        "best_practices": [
            "Always wait for at least MODERATE confluence",
            "Use position sizing based on risk (max 2% per trade)",
            "Honor stop losses - never move them against you",
            "Book partial profits at Target 1",
            "Trail stop to entry after Target 1 hit",
            "Avoid trading during high VIX (>20) with full size",
            "Be extra cautious near expiry dates"
        ]
    }


# Export router
__all__ = ['router']
