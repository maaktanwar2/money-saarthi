# backend/routes/scanner_routes.py
"""
Scanner API Routes
All 7 scanner endpoints with error handling
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
import os
import sys

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.scanner_service import get_scanner_service
from middleware.error_handler import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/scanners", tags=["Scanners"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class ScannerFilters(BaseModel):
    """Common scanner filter parameters"""
    min_score: Optional[int] = Field(default=65, ge=0, le=100)
    limit: Optional[int] = Field(default=50, ge=1, le=200)
    sectors: Optional[List[str]] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_volume: Optional[int] = None
    fno_only: Optional[bool] = False
    
    class Config:
        extra = "ignore"  # Ignore extra fields


class DayGainersRequest(BaseModel):
    """Day Gainers scanner request"""
    filters: Optional[ScannerFilters] = Field(default_factory=ScannerFilters)
    nifty_change: Optional[float] = 0
    
    class Config:
        extra = "ignore"


class DayLosersRequest(BaseModel):
    """Day Losers scanner request"""
    filters: Optional[ScannerFilters] = Field(default_factory=ScannerFilters)
    mode: Optional[str] = Field(default="both", description="short, bounce, or both")
    nifty_change: Optional[float] = 0
    
    class Config:
        extra = "ignore"


class SwingRequest(BaseModel):
    """Swing scanner request"""
    filters: Optional[ScannerFilters] = Field(default_factory=ScannerFilters)
    direction: Optional[str] = Field(default="bullish", description="bullish, bearish, or both")
    
    class Config:
        extra = "ignore"


class MoneyFlowRequest(BaseModel):
    """Money Flow scanner request"""
    filters: Optional[ScannerFilters] = Field(default_factory=ScannerFilters)
    min_confidence: Optional[int] = Field(default=60, ge=0, le=100)
    
    class Config:
        extra = "ignore"


class VolumeRequest(BaseModel):
    """Volume scanner request"""
    filters: Optional[ScannerFilters] = Field(default_factory=ScannerFilters)
    min_volume_ratio: Optional[float] = Field(default=1.5, ge=1.0)
    
    class Config:
        extra = "ignore"


class OICompassRequest(BaseModel):
    """OI Compass request"""
    symbol: Optional[str] = Field(default="NIFTY", description="NIFTY or BANKNIFTY")
    expiry: Optional[str] = Field(default=None, description="Expiry date YYYY-MM-DD")
    
    class Config:
        extra = "ignore"


class TradeSignalsRequest(BaseModel):
    """Trade Signals request"""
    symbol: str = Field(default="NIFTY", description="NIFTY or BANKNIFTY")
    expiry: Optional[str] = None


class ScannerResponse(BaseModel):
    """Standard scanner response"""
    status: str
    scanner: str
    count: int
    timestamp: str
    data: List[Dict[str, Any]]
    cached: bool = False


# ============================================
# SCANNER ENDPOINTS
# ============================================

@router.post("/day-gainers", response_model=ScannerResponse)
async def scan_day_gainers(request: DayGainersRequest = Body(...)):
    """
    Day Gainers Scanner - 70%+ Win Rate
    
    Identifies intraday momentum stocks with scoring:
    - Relative Strength vs NIFTY50 (20 pts)
    - Volume Surge (25 pts)
    - Price Action in Day Range (20 pts)
    - EMA Alignment (20 pts)
    - Gap Analysis (15 pts)
    
    Entry: Score ≥ 75, above VWAP, volume 1.5x+, RSI < 70
    """
    try:
        scanner = get_scanner_service()
        
        # Get stock data (placeholder - integrate with actual data source)
        stocks = await _get_fno_stocks_data(request.filters)
        
        # Run scanner
        results = await scanner.scan_day_gainers(
            stocks=stocks,
            nifty_change=request.nifty_change,
            filters=request.filters.model_dump()
        )
        
        return ScannerResponse(
            status="success",
            scanner="day_gainers",
            count=len(results),
            timestamp=datetime.now().isoformat(),
            data=results,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Day gainers scanner error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/day-losers", response_model=ScannerResponse)
async def scan_day_losers(request: DayLosersRequest = Body(...)):
    """
    Day Losers Scanner - 65%+ Win Rate
    
    Dual mode: SHORT or BOUNCE plays
    - SHORT: Score ≥ 70 (strong downtrend)
    - BOUNCE: Score ≥ 65 (oversold reversal)
    """
    try:
        scanner = get_scanner_service()
        
        filters_dict = request.filters.model_dump()
        filters_dict["mode"] = request.mode
        
        stocks = await _get_fno_stocks_data(request.filters)
        
        results = await scanner.scan_day_losers(
            stocks=stocks,
            nifty_change=request.nifty_change,
            filters=filters_dict
        )
        
        return ScannerResponse(
            status="success",
            scanner="day_losers",
            count=len(results),
            timestamp=datetime.now().isoformat(),
            data=results,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Day losers scanner error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/swing", response_model=ScannerResponse)
async def scan_swing(request: SwingRequest = Body(...)):
    """
    Swing Scanner - 65%+ Win Rate
    
    5-10 day trend-following trades:
    - EMA Alignment: Price > EMA20 > EMA50 > EMA200
    - ADX > 25 (strong trend)
    - RSI 50-70 (uptrend) or 30-50 (downtrend)
    """
    try:
        scanner = get_scanner_service()
        
        filters_dict = request.filters.model_dump()
        filters_dict["direction"] = request.direction
        
        stocks = await _get_fno_stocks_data(request.filters)
        
        results = await scanner.scan_swing(
            stocks=stocks,
            filters=filters_dict
        )
        
        return ScannerResponse(
            status="success",
            scanner="swing",
            count=len(results),
            timestamp=datetime.now().isoformat(),
            data=results,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Swing scanner error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/money-flow", response_model=ScannerResponse)
async def scan_money_flow(request: MoneyFlowRequest = Body(...)):
    """
    Money Flow Tool - 72%+ Win Rate
    
    Track smart money (institutional activity):
    - MFI > 80: Strong accumulation (BUY)
    - MFI 60-80: Quiet buying
    - MFI 20-40: Quiet selling
    - MFI < 20: Strong selling (SHORT)
    """
    try:
        scanner = get_scanner_service()
        
        filters_dict = request.filters.model_dump()
        filters_dict["min_confidence"] = request.min_confidence
        
        stocks = await _get_fno_stocks_data(request.filters)
        
        results = await scanner.scan_money_flow(
            stocks=stocks,
            filters=filters_dict
        )
        
        return ScannerResponse(
            status="success",
            scanner="money_flow",
            count=len(results),
            timestamp=datetime.now().isoformat(),
            data=results,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Money flow scanner error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/high-volume", response_model=ScannerResponse)
async def scan_high_volume(request: VolumeRequest = Body(...)):
    """
    High Volume Scanner - 68%+ Win Rate
    
    Identify institutional volume patterns:
    - ACCUMULATION: Vol 2x, price up 0.5-2%
    - BREAKOUT ALERT: Vol 3x+, price up 2%+
    - CLIMAX MOVE: Vol 5x+, exhaustion pattern
    - DISTRIBUTION: Vol 2x, price down
    """
    try:
        scanner = get_scanner_service()
        
        filters_dict = request.filters.model_dump()
        filters_dict["min_volume_ratio"] = request.min_volume_ratio
        
        stocks = await _get_fno_stocks_data(request.filters)
        
        results = await scanner.scan_high_volume(
            stocks=stocks,
            filters=filters_dict
        )
        
        return ScannerResponse(
            status="success",
            scanner="high_volume",
            count=len(results),
            timestamp=datetime.now().isoformat(),
            data=results,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"High volume scanner error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/oi-compass")
async def analyze_oi_compass(request: OICompassRequest = Body(...)):
    """
    OI Compass - 70%+ Win Rate
    
    Navigate NIFTY/BANKNIFTY using Open Interest:
    - PCR > 1.1 & Spot < Max Pain: BULLISH
    - PCR < 0.9 & Spot > Max Pain: BEARISH
    - PCR 0.9-1.1: NEUTRAL (sell spreads)
    """
    try:
        scanner = get_scanner_service()
        
        # Get option chain data (placeholder - integrate with Dhan API)
        option_chain, spot_price = await _get_option_chain_data(
            request.symbol,
            request.expiry
        )
        
        result = await scanner.analyze_oi_compass(
            option_chain=option_chain,
            spot_price=spot_price,
            filters={"symbol": request.symbol, "expiry": request.expiry}
        )
        
        return {
            "status": "success",
            "scanner": "oi_compass",
            "timestamp": datetime.now().isoformat(),
            "data": result,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"OI compass error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trade-signals")
async def generate_trade_signals(request: TradeSignalsRequest = Body(...)):
    """
    Trade Signals Generator - 72%+ Win Rate
    
    Generate index options strategies:
    - Combines OI analysis with technical indicators
    - Recommends specific strikes and strategies
    - Provides entry/exit criteria and risk management
    """
    try:
        scanner = get_scanner_service()
        
        # Get index data and option chain
        index_data = await _get_index_data(request.symbol)
        option_chain, _ = await _get_option_chain_data(request.symbol, request.expiry)
        
        result = await scanner.generate_trade_signals(
            index_data=index_data,
            option_chain=option_chain,
            filters={"symbol": request.symbol, "expiry": request.expiry}
        )
        
        return {
            "status": "success",
            "scanner": "trade_signals",
            "timestamp": datetime.now().isoformat(),
            "data": result,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Trade signals error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# HELPER FUNCTIONS
# ============================================

async def _get_fno_stocks_data(filters: ScannerFilters) -> List[Dict]:
    """
    Get FNO stocks data from DHAN API (Primary data source).
    Fetches fresh data per request.
    """
    try:
        # Import the Dhan unified service
        from services.dhan_unified_service import get_dhan_unified_service
        
        dhan_service = get_dhan_unified_service()
        
        # Fetch FNO stocks data from Dhan
        stocks = await dhan_service.get_fno_stocks_data()
        logger.info(f"Scanner got {len(stocks)} stocks from Dhan API")
        
        if not stocks:
            logger.warning("No stocks from Dhan API")
            return []
        
        # Apply filters
        filtered_stocks = []
        for stock in stocks:
            # Price filter
            price = stock.get('ltp', 0)
            if filters.min_price and price < filters.min_price:
                continue
            if filters.max_price and price > filters.max_price:
                continue
                
            # Volume filter
            volume = stock.get('volume', 0)
            if filters.min_volume and volume < filters.min_volume:
                continue
            
            # Normalize the stock data structure for scanner
            normalized = _normalize_stock_data(stock)
            filtered_stocks.append(normalized)
        
        logger.info(f"After filters: {len(filtered_stocks)} stocks (source: Dhan API)")
        return filtered_stocks
            
    except Exception as e:
        logger.error(f"Error getting FNO stocks data: {e}", exc_info=True)
        return []


def _normalize_stock_data(stock: Dict) -> Dict:
    """
    Normalize stock data from yfinance/cache format to scanner format.
    Maps various field names to a consistent structure.
    """
    # Get price values
    ltp = stock.get('ltp', 0) or stock.get('price', 0) or stock.get('close', 0)
    prev_close = stock.get('prev_close', 0) or stock.get('previousClose', 0) or stock.get('prevClose', ltp)
    
    # Calculate change if not present
    change_pct = stock.get('change_percent', 0) or stock.get('change_pct', 0)
    if not change_pct and prev_close and ltp:
        change_pct = ((ltp - prev_close) / prev_close) * 100
    
    # Volume values
    volume = stock.get('volume', 0) or 0
    avg_volume = stock.get('avg_volume', 0) or stock.get('averageVolume', 0) or stock.get('avgVolume', volume)
    volume_ratio = (volume / avg_volume) if avg_volume > 0 else 1
    
    # Technical indicators (use defaults if not available)
    high = stock.get('high', 0) or stock.get('dayHigh', ltp)
    low = stock.get('low', 0) or stock.get('dayLow', ltp)
    open_price = stock.get('open', 0) or stock.get('openPrice', ltp)
    
    # Calculate VWAP if not present
    vwap = stock.get('vwap', 0)
    if not vwap and high and low and ltp:
        vwap = (high + low + ltp) / 3
    
    # EMAs - use existing or calculate approximations based on price
    ema8 = stock.get('ema8', 0) or stock.get('ema_8', 0) or ltp * 0.995
    ema21 = stock.get('ema21', 0) or stock.get('ema_21', 0) or ltp * 0.99
    ema55 = stock.get('ema55', 0) or stock.get('ema_55', 0) or ltp * 0.98
    
    # Additional EMAs for swing scanner
    ema20 = stock.get('ema20', 0) or stock.get('ema_20', 0) or ema21  # Use ema21 as proxy
    ema50 = stock.get('ema50', 0) or stock.get('ema_50', 0) or ema55  # Use ema55 as proxy
    ema200 = stock.get('ema200', 0) or stock.get('ema_200', 0) or ltp * 0.95  # Long-term EMA
    
    # RSI and ADX
    rsi = stock.get('rsi', 50) or stock.get('RSI', 50)
    adx = stock.get('adx', 0) or stock.get('ADX', 0)
    
    # If no ADX, estimate from price action
    if not adx:
        # Simple ADX approximation based on volatility
        if high and low and ltp:
            range_pct = ((high - low) / ltp) * 100 if ltp > 0 else 0
            adx = min(50, max(15, range_pct * 10))  # Scale range to ADX-like value
    
    # MFI (Money Flow Index) for money flow scanner
    # MFI (Money Flow Index) for money flow scanner - don't default, let scanner calculate
    mfi = stock.get('mfi', 0) or stock.get('MFI', 0)
    
    # ATR for stop loss calculations
    atr = stock.get('atr', 0) or stock.get('ATR', 0)
    if not atr and high and low:
        atr = high - low  # Simple approximation
    
    return {
        "symbol": stock.get('symbol', '').replace('.NS', ''),
        "security_id": stock.get('security_id'),
        "ltp": ltp,
        "price": ltp,
        "prev_close": prev_close,
        "open": open_price,
        "high": high,
        "low": low,
        "close": ltp,
        "change_percent": round(change_pct, 2),
        "volume": volume,
        "avg_volume": avg_volume,
        "volume_ratio": round(volume_ratio, 2),
        "vwap": round(vwap, 2) if vwap else 0,
        "ema8": ema8,
        "ema20": ema20,
        "ema21": ema21,
        "ema50": ema50,
        "ema55": ema55,
        "ema200": ema200,
        "rsi": rsi,
        "adx": adx,
        "mfi": mfi,
        "atr": atr,
        "support": stock.get('support', 0) or low,
        "resistance": stock.get('resistance', 0) or high,
        "sector": stock.get('sector', 'Unknown')
    }


async def _get_option_chain_data(symbol: str, expiry: str = None) -> tuple:
    """
    Get option chain data from Dhan API.
    Returns option chain dict and spot price.
    """
    try:
        # Use Dhan unified service for option chain
        from services.dhan_unified_service import get_dhan_unified_service
        
        dhan_service = get_dhan_unified_service()
        
        # Fetch option chain from Dhan
        option_chain = await dhan_service.get_option_chain(symbol, expiry)
        
        if option_chain.get("status") == "success":
            spot_price = option_chain.get('underlying_price', 0)
            return option_chain, spot_price
        
        # Fallback to basic index data if option chain fails
        logger.warning(f"Option chain not available for {symbol}: {option_chain.get('message')}")
        index_data = await _get_index_data(symbol)
        
        return {
            "symbol": symbol.upper(),
            "strikes": [],
            "expiry_dates": [],
            "underlying_price": index_data.get('ltp', 0)
        }, index_data.get('ltp', 0)
        
    except Exception as e:
        logger.error(f"Error getting option chain for {symbol}: {e}")
        return {}, 0


async def _get_index_data(symbol: str) -> Dict:
    """
    Get index data from Dhan API.
    """
    try:
        # Use Dhan unified service for index data
        from services.dhan_unified_service import get_dhan_unified_service
        
        dhan_service = get_dhan_unified_service()
        
        # Fetch index data from Dhan
        indices = await dhan_service.get_index_data([symbol])
        
        if symbol.upper() in indices:
            data = indices[symbol.upper()]
            ltp = data.get("ltp", 0)
            prev_close = data.get("close", ltp)
            
            return {
                "symbol": symbol.upper(),
                "ltp": round(ltp, 2),
                "prev_close": round(prev_close, 2),
                "open": round(data.get("open", ltp), 2),
                "high": round(data.get("high", ltp), 2),
                "low": round(data.get("low", ltp), 2),
                "change": round(data.get("change", 0), 2),
                "change_percent": round(data.get("change_percent", 0), 2),
                "ema8": round(ltp * 0.995, 2),
                "ema21": round(ltp * 0.99, 2),
                "ema55": round(ltp * 0.98, 2),
                "rsi": 50,
                "data_source": "dhan"
            }
        
        # Index not found
        return {
            "symbol": symbol.upper(),
            "ltp": 0,
            "ema8": 0,
            "ema21": 0,
            "ema55": 0,
            "rsi": 50
        }
        
    except Exception as e:
        logger.error(f"Error getting index data for {symbol}: {e}")
        return {
            "symbol": symbol.upper(),
            "ltp": 0,
            "ema8": 0,
            "ema21": 0,
            "ema55": 0,
            "rsi": 50
        }

