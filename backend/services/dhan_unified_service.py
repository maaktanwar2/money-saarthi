"""
Dhan Unified Data Service
=========================
Single source of truth for ALL market data using Dhan API v2

Provides:
- Market Quotes (LTP, OHLC, Volume, OI)
- Historical Data (Daily/Intraday candles)
- Option Chain (Greeks, IV, OI, Premiums)
- Index Data (NIFTY, BANKNIFTY, etc.)

API Endpoints Used:
- POST /marketfeed/ltp     - Get LTP (1000 instruments, 1 req/sec)
- POST /marketfeed/ohlc    - Get OHLC data
- POST /marketfeed/quote   - Full quote with depth
- POST /charts/historical  - Daily candles
- POST /charts/intraday    - Intraday candles (1,5,15,25,60 min)
- POST /optionchain        - Option chain with Greeks (1 req/3sec)
- POST /optionchain/expirylist - Expiry dates
"""

import os
import asyncio
import aiohttp
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from functools import lru_cache
from pathlib import Path
import threading

# Official Dhan library for synchronous operations
from dhanhq import dhanhq as DhanClient

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
except ImportError:
    pass

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DHAN_BASE_URL = "https://api.dhan.co/v2"
DHAN_ACCESS_TOKEN = os.getenv("DHAN_ACCESS_TOKEN", "")
DHAN_CLIENT_ID = os.getenv("DHAN_CLIENT_ID", "")

# Exchange Segments
EXCHANGE_SEGMENTS = {
    "IDX_I": "IDX_I",           # Index
    "NSE_EQ": "NSE_EQ",         # NSE Equity Cash
    "NSE_FNO": "NSE_FNO",       # NSE F&O
    "BSE_EQ": "BSE_EQ",         # BSE Equity Cash
    "BSE_FNO": "BSE_FNO",       # BSE F&O
    "MCX_COMM": "MCX_COMM",     # MCX Commodities
    "NSE_CURRENCY": "NSE_CURRENCY",
    "BSE_CURRENCY": "BSE_CURRENCY",
}

# Instrument Types
INSTRUMENTS = {
    "INDEX": "INDEX",
    "EQUITY": "EQUITY",
    "FUTIDX": "FUTIDX",
    "OPTIDX": "OPTIDX",
    "FUTSTK": "FUTSTK",
    "OPTSTK": "OPTSTK",
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY ID MAPPING - Complete FNO Universe
# ═══════════════════════════════════════════════════════════════════════════════

SECURITY_MAP = {
    # INDICES (IDX_I)
    "NIFTY": {"segment": "IDX_I", "security_id": "13", "fno_segment": "NSE_FNO", "fno_id": "26000"},
    "BANKNIFTY": {"segment": "IDX_I", "security_id": "25", "fno_segment": "NSE_FNO", "fno_id": "26009"},
    "FINNIFTY": {"segment": "IDX_I", "security_id": "26037", "fno_segment": "NSE_FNO", "fno_id": "26037"},
    "MIDCPNIFTY": {"segment": "IDX_I", "security_id": "26074", "fno_segment": "NSE_FNO", "fno_id": "26074"},
    "SENSEX": {"segment": "IDX_I", "security_id": "1", "fno_segment": "BSE_FNO", "fno_id": "1"},
    "NIFTY50": {"segment": "IDX_I", "security_id": "13", "fno_segment": "NSE_FNO", "fno_id": "26000"},
    
    # TOP NSE FNO STOCKS
    "RELIANCE": {"segment": "NSE_EQ", "security_id": "2885"},
    "TCS": {"segment": "NSE_EQ", "security_id": "11536"},
    "HDFCBANK": {"segment": "NSE_EQ", "security_id": "1333"},
    "INFY": {"segment": "NSE_EQ", "security_id": "1594"},
    "ICICIBANK": {"segment": "NSE_EQ", "security_id": "4963"},
    "SBIN": {"segment": "NSE_EQ", "security_id": "3045"},
    "BHARTIARTL": {"segment": "NSE_EQ", "security_id": "10604"},
    "HINDUNILVR": {"segment": "NSE_EQ", "security_id": "1394"},
    "ITC": {"segment": "NSE_EQ", "security_id": "1660"},
    "LT": {"segment": "NSE_EQ", "security_id": "11483"},
    "KOTAKBANK": {"segment": "NSE_EQ", "security_id": "1922"},
    "AXISBANK": {"segment": "NSE_EQ", "security_id": "5900"},
    "BAJFINANCE": {"segment": "NSE_EQ", "security_id": "317"},
    "MARUTI": {"segment": "NSE_EQ", "security_id": "10999"},
    "TITAN": {"segment": "NSE_EQ", "security_id": "3506"},
    "WIPRO": {"segment": "NSE_EQ", "security_id": "3787"},
    "TATASTEEL": {"segment": "NSE_EQ", "security_id": "3499"},
    "TATAMOTORS": {"segment": "NSE_EQ", "security_id": "3456"},
    "SUNPHARMA": {"segment": "NSE_EQ", "security_id": "3351"},
    "HCLTECH": {"segment": "NSE_EQ", "security_id": "7229"},
    "TECHM": {"segment": "NSE_EQ", "security_id": "13538"},
    "M&M": {"segment": "NSE_EQ", "security_id": "2031"},
    "NTPC": {"segment": "NSE_EQ", "security_id": "11630"},
    "POWERGRID": {"segment": "NSE_EQ", "security_id": "14977"},
    "ASIANPAINT": {"segment": "NSE_EQ", "security_id": "236"},
    "NESTLEIND": {"segment": "NSE_EQ", "security_id": "17963"},
    "ULTRACEMCO": {"segment": "NSE_EQ", "security_id": "11532"},
    "ONGC": {"segment": "NSE_EQ", "security_id": "2475"},
    "JSWSTEEL": {"segment": "NSE_EQ", "security_id": "11723"},
    "COALINDIA": {"segment": "NSE_EQ", "security_id": "20374"},
    "DRREDDY": {"segment": "NSE_EQ", "security_id": "881"},
    "CIPLA": {"segment": "NSE_EQ", "security_id": "694"},
    "GRASIM": {"segment": "NSE_EQ", "security_id": "1232"},
    "HINDALCO": {"segment": "NSE_EQ", "security_id": "1363"},
    "ADANIPORTS": {"segment": "NSE_EQ", "security_id": "15083"},
    "BPCL": {"segment": "NSE_EQ", "security_id": "526"},
    "INDUSINDBK": {"segment": "NSE_EQ", "security_id": "5258"},
    "DIVISLAB": {"segment": "NSE_EQ", "security_id": "10940"},
    "BRITANNIA": {"segment": "NSE_EQ", "security_id": "547"},
    "EICHERMOT": {"segment": "NSE_EQ", "security_id": "910"},
    "HEROMOTOCO": {"segment": "NSE_EQ", "security_id": "1348"},
    "BAJAJFINSV": {"segment": "NSE_EQ", "security_id": "16675"},
    "APOLLOHOSP": {"segment": "NSE_EQ", "security_id": "157"},
    "TATACONSUM": {"segment": "NSE_EQ", "security_id": "3432"},
    "ZOMATO": {"segment": "NSE_EQ", "security_id": "5097"},
    "ADANIENT": {"segment": "NSE_EQ", "security_id": "25"},
    "LUPIN": {"segment": "NSE_EQ", "security_id": "10440"},
    "VEDL": {"segment": "NSE_EQ", "security_id": "3063"},
    "SAIL": {"segment": "NSE_EQ", "security_id": "2963"},
    "TATAPOWER": {"segment": "NSE_EQ", "security_id": "3426"},
    "JINDALSTEL": {"segment": "NSE_EQ", "security_id": "6733"},
    "PNB": {"segment": "NSE_EQ", "security_id": "10666"},
    "BANKBARODA": {"segment": "NSE_EQ", "security_id": "4668"},
    "CANBK": {"segment": "NSE_EQ", "security_id": "10794"},
    "FEDERALBNK": {"segment": "NSE_EQ", "security_id": "1023"},
    "IDFCFIRSTB": {"segment": "NSE_EQ", "security_id": "11184"},
    "INDHOTEL": {"segment": "NSE_EQ", "security_id": "1512"},
    "IRCTC": {"segment": "NSE_EQ", "security_id": "13611"},
    "NAUKRI": {"segment": "NSE_EQ", "security_id": "13751"},
    "PIDILITIND": {"segment": "NSE_EQ", "security_id": "2664"},
    "PIIND": {"segment": "NSE_EQ", "security_id": "16669"},
    "POLYCAB": {"segment": "NSE_EQ", "security_id": "9590"},
    "SIEMENS": {"segment": "NSE_EQ", "security_id": "3150"},
    "SRF": {"segment": "NSE_EQ", "security_id": "3273"},
    "TORNTPHARM": {"segment": "NSE_EQ", "security_id": "3518"},
    "VOLTAS": {"segment": "NSE_EQ", "security_id": "3718"},
    "LICI": {"segment": "NSE_EQ", "security_id": "17818"},
    "MOTHERSON": {"segment": "NSE_EQ", "security_id": "4204"},
    "DMART": {"segment": "NSE_EQ", "security_id": "19943"},
    "NIFTYBEES": {"segment": "NSE_EQ", "security_id": "14352"},
    "BANKBEES": {"segment": "NSE_EQ", "security_id": "14353"},
}

# FNO Universe List
FNO_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL",
    "HINDUNILVR", "ITC", "LT", "KOTAKBANK", "AXISBANK", "BAJFINANCE", "MARUTI",
    "TITAN", "WIPRO", "TATASTEEL", "TATAMOTORS", "SUNPHARMA", "HCLTECH", "TECHM",
    "M&M", "NTPC", "POWERGRID", "ASIANPAINT", "NESTLEIND", "ULTRACEMCO", "ONGC",
    "JSWSTEEL", "COALINDIA", "DRREDDY", "CIPLA", "GRASIM", "HINDALCO", "ADANIPORTS",
    "BPCL", "INDUSINDBK", "DIVISLAB", "BRITANNIA", "EICHERMOT", "HEROMOTOCO",
    "BAJAJFINSV", "APOLLOHOSP", "TATACONSUM", "ZOMATO", "ADANIENT", "LUPIN",
    "VEDL", "SAIL", "TATAPOWER", "JINDALSTEL", "PNB", "BANKBARODA", "CANBK"
]


class DhanUnifiedServiceError(Exception):
    """Custom exception for Dhan Unified Service"""
    def __init__(self, message: str, error_code: str = None, status_code: int = None):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


class DhanUnifiedService:
    """
    Unified Market Data Service using Dhan API v2
    
    Single source of truth for:
    - Real-time quotes (LTP, OHLC, Volume, OI)
    - Historical data (Daily/Intraday candles)
    - Option chains (Greeks, IV, premiums)
    - Index data and derivatives
    
    Rate Limits:
    - /marketfeed/*: 1 request/second, 1000 instruments/request
    - /optionchain: 1 request/3 seconds
    - /charts/*: Unlimited
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.base_url = DHAN_BASE_URL
        self.access_token = DHAN_ACCESS_TOKEN
        self.client_id = DHAN_CLIENT_ID
        
        # Session management
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Rate limiting
        self._last_quote_time = 0
        self._last_oc_time = 0
        self._rate_lock = asyncio.Lock()
        
        # In-memory cache (short lived)
        self._cache: Dict[str, Any] = {}
        self._cache_expiry: Dict[str, float] = {}
        
        self._initialized = True
        logger.info("✅ DhanUnifiedService initialized")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API headers with authentication"""
        return {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def _ensure_session(self):
        """Ensure aiohttp session is initialized"""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session
    
    async def close(self):
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
    
    async def _rate_limit(self, endpoint_type: str = "quote"):
        """Enforce rate limits"""
        async with self._rate_lock:
            import time
            now = time.time()
            
            if endpoint_type == "option_chain":
                delay = 3.0 - (now - self._last_oc_time)
                if delay > 0:
                    await asyncio.sleep(delay)
                self._last_oc_time = time.time()
            else:
                delay = 1.0 - (now - self._last_quote_time)
                if delay > 0:
                    await asyncio.sleep(delay)
                self._last_quote_time = time.time()
    
    def _get_cache(self, key: str, max_age: int = 30) -> Optional[Any]:
        """Get from cache if not expired"""
        import time
        if key in self._cache:
            if time.time() - self._cache_expiry.get(key, 0) < max_age:
                return self._cache[key]
        return None
    
    def _set_cache(self, key: str, value: Any):
        """Set cache with current timestamp"""
        import time
        self._cache[key] = value
        self._cache_expiry[key] = time.time()
    
    async def _make_request(
        self, 
        endpoint: str, 
        data: dict = None, 
        rate_limit_type: str = "quote"
    ) -> Dict[str, Any]:
        """Make API request with error handling"""
        await self._ensure_session()
        await self._rate_limit(rate_limit_type)
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with self._session.post(
                url,
                json=data,
                headers=self._get_headers()
            ) as response:
                response_text = await response.text()
                
                if response.status == 200:
                    import json
                    return json.loads(response_text)
                else:
                    logger.error(f"Dhan API error {response.status}: {response_text}")
                    return {
                        "status": "error",
                        "error_code": f"HTTP_{response.status}",
                        "message": response_text
                    }
                    
        except asyncio.TimeoutError:
            logger.error(f"Dhan API timeout: {endpoint}")
            return {"status": "error", "message": "API timeout"}
        except aiohttp.ClientError as e:
            logger.error(f"Dhan API client error: {e}")
            return {"status": "error", "message": str(e)}
        except Exception as e:
            logger.error(f"Dhan API error: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MARKET QUOTES - LTP, OHLC, Full Quote
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def get_ltp(self, instruments: Dict[str, List[int]]) -> Dict[str, float]:
        """
        Get Last Traded Price for instruments
        
        Args:
            instruments: {"NSE_EQ": [1333, 11536], "NSE_FNO": [52973]}
        
        Returns:
            {"1333": 1650.50, "11536": 4200.00}
        """
        result = await self._make_request("/marketfeed/ltp", instruments)
        
        prices = {}
        if result.get("status") == "success":
            for segment, items in result.get("data", {}).items():
                for security_id, quote in items.items():
                    prices[security_id] = quote.get("last_price", 0)
        
        return prices
    
    async def get_ohlc(self, instruments: Dict[str, List[int]]) -> Dict[str, Dict]:
        """
        Get OHLC data for instruments
        
        Returns:
            {"1333": {"open": 1640, "high": 1660, "low": 1635, "close": 1650, "ltp": 1652}}
        """
        result = await self._make_request("/marketfeed/ohlc", instruments)
        
        ohlc_data = {}
        if result.get("status") == "success":
            for segment, items in result.get("data", {}).items():
                for security_id, quote in items.items():
                    ohlc = quote.get("ohlc", {})
                    ohlc_data[security_id] = {
                        "open": ohlc.get("open", 0),
                        "high": ohlc.get("high", 0),
                        "low": ohlc.get("low", 0),
                        "close": ohlc.get("close", 0),
                        "ltp": quote.get("last_price", 0),
                        "segment": segment
                    }
        
        return ohlc_data
    
    async def get_quote(self, instruments: Dict[str, List[int]]) -> Dict[str, Dict]:
        """
        Get full market quote with depth
        
        Returns complete data: LTP, OHLC, volume, OI, bid/ask, depth
        """
        result = await self._make_request("/marketfeed/quote", instruments)
        
        quotes = {}
        if result.get("status") == "success":
            for segment, items in result.get("data", {}).items():
                for security_id, q in items.items():
                    ohlc = q.get("ohlc", {})
                    depth = q.get("depth", {})
                    buy_depth = depth.get("buy", [])
                    sell_depth = depth.get("sell", [])
                    
                    quotes[security_id] = {
                        "segment": segment,
                        "ltp": q.get("last_price", 0),
                        "open": ohlc.get("open", 0),
                        "high": ohlc.get("high", 0),
                        "low": ohlc.get("low", 0),
                        "close": ohlc.get("close", 0),
                        "prev_close": ohlc.get("close", 0),
                        "volume": q.get("volume", 0),
                        "oi": q.get("oi", 0),
                        "oi_day_high": q.get("oi_day_high", 0),
                        "oi_day_low": q.get("oi_day_low", 0),
                        "change": q.get("net_change", 0),
                        "change_percent": round((q.get("net_change", 0) / ohlc.get("close", 1)) * 100, 2) if ohlc.get("close") else 0,
                        "avg_price": q.get("average_price", 0),
                        "total_buy_qty": q.get("buy_quantity", 0),
                        "total_sell_qty": q.get("sell_quantity", 0),
                        "bid": buy_depth[0].get("price") if buy_depth else 0,
                        "bid_qty": buy_depth[0].get("quantity") if buy_depth else 0,
                        "ask": sell_depth[0].get("price") if sell_depth else 0,
                        "ask_qty": sell_depth[0].get("quantity") if sell_depth else 0,
                        "upper_circuit": q.get("upper_circuit_limit", 0),
                        "lower_circuit": q.get("lower_circuit_limit", 0),
                        "depth": {
                            "buy": [{"price": b.get("price"), "qty": b.get("quantity"), "orders": b.get("orders")} for b in buy_depth],
                            "sell": [{"price": s.get("price"), "qty": s.get("quantity"), "orders": s.get("orders")} for s in sell_depth]
                        },
                        "timestamp": datetime.now().isoformat()
                    }
        
        return quotes
    
    async def get_quotes_by_symbols(self, symbols: List[str]) -> Dict[str, Dict]:
        """
        Get quotes by symbol names
        
        Args:
            symbols: ["RELIANCE", "TCS", "HDFCBANK"]
        
        Returns:
            {"RELIANCE": {...quote data...}, "TCS": {...}}
        """
        # Organize by segment
        instruments: Dict[str, List[int]] = {}
        symbol_to_id: Dict[str, str] = {}
        
        for symbol in symbols:
            info = SECURITY_MAP.get(symbol.upper())
            if info:
                segment = info["segment"]
                security_id = int(info["security_id"])
                if segment not in instruments:
                    instruments[segment] = []
                instruments[segment].append(security_id)
                symbol_to_id[symbol.upper()] = str(security_id)
        
        if not instruments:
            return {}
        
        # Fetch quotes
        quotes = await self.get_quote(instruments)
        
        # Map back to symbols
        result = {}
        for symbol, security_id in symbol_to_id.items():
            if security_id in quotes:
                result[symbol] = {**quotes[security_id], "symbol": symbol}
        
        return result
    
    # ═══════════════════════════════════════════════════════════════════════════
    # HISTORICAL DATA - Daily and Intraday Candles
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def get_historical_daily(
        self,
        symbol: str,
        from_date: str,
        to_date: str
    ) -> List[Dict]:
        """
        Get daily historical candles
        
        Args:
            symbol: "RELIANCE", "TCS" etc
            from_date: "2024-01-01"
            to_date: "2024-12-31"
        
        Returns:
            List of candles: [{"date": "2024-01-02", "open": 1640, "high": 1660, ...}]
        """
        info = SECURITY_MAP.get(symbol.upper())
        if not info:
            logger.warning(f"Unknown symbol: {symbol}")
            return []
        
        data = {
            "securityId": info["security_id"],
            "exchangeSegment": info["segment"],
            "instrument": "INDEX" if info["segment"] == "IDX_I" else "EQUITY",
            "expiryCode": 0,
            "oi": False,
            "fromDate": from_date,
            "toDate": to_date
        }
        
        result = await self._make_request("/charts/historical", data, "chart")
        
        candles = []
        if "open" in result:
            timestamps = result.get("timestamp", [])
            opens = result.get("open", [])
            highs = result.get("high", [])
            lows = result.get("low", [])
            closes = result.get("close", [])
            volumes = result.get("volume", [])
            
            for i in range(len(timestamps)):
                dt = datetime.fromtimestamp(timestamps[i])
                candles.append({
                    "date": dt.strftime("%Y-%m-%d"),
                    "timestamp": timestamps[i],
                    "open": opens[i] if i < len(opens) else 0,
                    "high": highs[i] if i < len(highs) else 0,
                    "low": lows[i] if i < len(lows) else 0,
                    "close": closes[i] if i < len(closes) else 0,
                    "volume": volumes[i] if i < len(volumes) else 0
                })
        
        return candles
    
    async def get_historical_intraday(
        self,
        symbol: str,
        from_date: str,
        to_date: str,
        interval: str = "5"
    ) -> List[Dict]:
        """
        Get intraday historical candles
        
        Args:
            symbol: "RELIANCE", "TCS" etc
            from_date: "2024-12-01 09:15:00"
            to_date: "2024-12-31 15:30:00"
            interval: "1", "5", "15", "25", "60"
        
        Returns:
            List of candles with timestamp
        """
        info = SECURITY_MAP.get(symbol.upper())
        if not info:
            logger.warning(f"Unknown symbol: {symbol}")
            return []
        
        data = {
            "securityId": info["security_id"],
            "exchangeSegment": info["segment"],
            "instrument": "INDEX" if info["segment"] == "IDX_I" else "EQUITY",
            "interval": interval,
            "oi": False,
            "fromDate": from_date,
            "toDate": to_date
        }
        
        result = await self._make_request("/charts/intraday", data, "chart")
        
        candles = []
        if "open" in result:
            timestamps = result.get("timestamp", [])
            opens = result.get("open", [])
            highs = result.get("high", [])
            lows = result.get("low", [])
            closes = result.get("close", [])
            volumes = result.get("volume", [])
            
            for i in range(len(timestamps)):
                dt = datetime.fromtimestamp(timestamps[i])
                candles.append({
                    "datetime": dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "timestamp": timestamps[i],
                    "open": opens[i] if i < len(opens) else 0,
                    "high": highs[i] if i < len(highs) else 0,
                    "low": lows[i] if i < len(lows) else 0,
                    "close": closes[i] if i < len(closes) else 0,
                    "volume": volumes[i] if i < len(volumes) else 0
                })
        
        return candles
    
    # ═══════════════════════════════════════════════════════════════════════════
    # OPTION CHAIN - Complete with Greeks
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def get_expiry_list(self, symbol: str) -> List[str]:
        """
        Get available expiry dates for a symbol
        
        Args:
            symbol: "NIFTY", "BANKNIFTY", "RELIANCE"
        
        Returns:
            ["2024-12-26", "2025-01-02", "2025-01-09", ...]
        """
        info = SECURITY_MAP.get(symbol.upper())
        if not info:
            return []
        
        # Use FNO ID for option chain
        underlying_id = info.get("fno_id", info["security_id"])
        segment = info.get("fno_segment", info["segment"])
        
        data = {
            "UnderlyingScrip": int(underlying_id),
            "UnderlyingSeg": segment
        }
        
        result = await self._make_request("/optionchain/expirylist", data, "option_chain")
        
        return result.get("data", [])
    
    async def get_option_chain(self, symbol: str, expiry: str = None) -> Dict[str, Any]:
        """
        Get full option chain with Greeks
        
        Args:
            symbol: "NIFTY", "BANKNIFTY", "RELIANCE"
            expiry: "2024-12-26" (optional, uses nearest if not provided)
        
        Returns:
            Complete option chain with all strikes
        """
        info = SECURITY_MAP.get(symbol.upper())
        if not info:
            raise DhanUnifiedServiceError(f"Unknown symbol: {symbol}")
        
        # Get expiry if not provided
        if not expiry:
            expiries = await self.get_expiry_list(symbol)
            if not expiries:
                raise DhanUnifiedServiceError(f"No expiry available for {symbol}")
            expiry = expiries[0]
        
        underlying_id = info.get("fno_id", info["security_id"])
        segment = info.get("fno_segment", info["segment"])
        
        data = {
            "UnderlyingScrip": int(underlying_id),
            "UnderlyingSeg": segment,
            "Expiry": expiry
        }
        
        result = await self._make_request("/optionchain", data, "option_chain")
        
        if result.get("status") != "success":
            return {"status": "error", "message": result.get("message")}
        
        # Process option chain
        return self._process_option_chain(result, symbol, expiry)
    
    def _process_option_chain(self, raw_data: Dict, symbol: str, expiry: str) -> Dict:
        """Process raw option chain into structured format"""
        data = raw_data.get("data", {})
        
        processed = {
            "status": "success",
            "symbol": symbol,
            "expiry": expiry,
            "underlying_price": data.get("last_price", 0),
            "timestamp": datetime.now().isoformat(),
            "strikes": [],
            "summary": {
                "total_ce_oi": 0,
                "total_pe_oi": 0,
                "max_ce_oi": 0,
                "max_pe_oi": 0,
                "max_ce_oi_strike": 0,
                "max_pe_oi_strike": 0,
                "pcr": 0,
                "atm_strike": 0,
                "atm_iv": 0
            }
        }
        
        oc = data.get("oc", {})
        underlying = data.get("last_price", 0)
        atm_strike = 0
        min_atm_diff = float('inf')
        
        for strike_str, strike_data in oc.items():
            try:
                strike_price = float(strike_str)
            except:
                continue
            
            ce = strike_data.get("ce", {})
            pe = strike_data.get("pe", {})
            
            ce_greeks = ce.get("greeks", {})
            pe_greeks = pe.get("greeks", {})
            
            strike = {
                "strike_price": strike_price,
                "call": {
                    "ltp": ce.get("last_price", 0),
                    "oi": ce.get("oi", 0),
                    "volume": ce.get("volume", 0),
                    "iv": ce.get("implied_volatility", 0),
                    "prev_oi": ce.get("previous_oi", 0),
                    "oi_change": ce.get("oi", 0) - ce.get("previous_oi", 0),
                    "delta": ce_greeks.get("delta", 0),
                    "theta": ce_greeks.get("theta", 0),
                    "gamma": ce_greeks.get("gamma", 0),
                    "vega": ce_greeks.get("vega", 0),
                    "bid": ce.get("top_bid_price", 0),
                    "ask": ce.get("top_ask_price", 0),
                    "bid_qty": ce.get("top_bid_quantity", 0),
                    "ask_qty": ce.get("top_ask_quantity", 0),
                    "security_id": ce.get("security_id", 0)
                },
                "put": {
                    "ltp": pe.get("last_price", 0),
                    "oi": pe.get("oi", 0),
                    "volume": pe.get("volume", 0),
                    "iv": pe.get("implied_volatility", 0),
                    "prev_oi": pe.get("previous_oi", 0),
                    "oi_change": pe.get("oi", 0) - pe.get("previous_oi", 0),
                    "delta": pe_greeks.get("delta", 0),
                    "theta": pe_greeks.get("theta", 0),
                    "gamma": pe_greeks.get("gamma", 0),
                    "vega": pe_greeks.get("vega", 0),
                    "bid": pe.get("top_bid_price", 0),
                    "ask": pe.get("top_ask_price", 0),
                    "bid_qty": pe.get("top_bid_quantity", 0),
                    "ask_qty": pe.get("top_ask_quantity", 0),
                    "security_id": pe.get("security_id", 0)
                }
            }
            
            processed["strikes"].append(strike)
            
            # Update summary
            processed["summary"]["total_ce_oi"] += strike["call"]["oi"]
            processed["summary"]["total_pe_oi"] += strike["put"]["oi"]
            
            if strike["call"]["oi"] > processed["summary"]["max_ce_oi"]:
                processed["summary"]["max_ce_oi"] = strike["call"]["oi"]
                processed["summary"]["max_ce_oi_strike"] = strike_price
            
            if strike["put"]["oi"] > processed["summary"]["max_pe_oi"]:
                processed["summary"]["max_pe_oi"] = strike["put"]["oi"]
                processed["summary"]["max_pe_oi_strike"] = strike_price
            
            # Find ATM
            if underlying > 0:
                atm_diff = abs(strike_price - underlying)
                if atm_diff < min_atm_diff:
                    min_atm_diff = atm_diff
                    atm_strike = strike_price
                    processed["summary"]["atm_iv"] = (strike["call"]["iv"] + strike["put"]["iv"]) / 2
        
        # Sort by strike
        processed["strikes"].sort(key=lambda x: x["strike_price"])
        
        # Calculate PCR
        if processed["summary"]["total_ce_oi"] > 0:
            processed["summary"]["pcr"] = round(
                processed["summary"]["total_pe_oi"] / processed["summary"]["total_ce_oi"], 2
            )
        
        processed["summary"]["atm_strike"] = atm_strike
        
        return processed
    
    # ═══════════════════════════════════════════════════════════════════════════
    # FNO STOCK DATA - For Scanners (with NSE Fallback)
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def get_fno_stocks_data(self, symbols: List[str] = None) -> List[Dict]:
        """
        Get complete data for FNO stocks
        Primary: Dhan API | Fallback: NSE India API
        
        Args:
            symbols: List of symbols (defaults to FNO_STOCKS)
        
        Returns:
            List of stock data with quotes
        """
        if symbols is None:
            symbols = FNO_STOCKS
        
        # Try Dhan API first
        stocks = []
        try:
            quotes = await self.get_quotes_by_symbols(symbols)
            
            for symbol in symbols:
                quote = quotes.get(symbol.upper(), {})
                if quote and quote.get("ltp", 0) > 0:
                    ltp = quote.get("ltp", 0)
                    prev_close = quote.get("close", ltp)
                    change = ltp - prev_close if prev_close else 0
                    change_pct = (change / prev_close * 100) if prev_close else 0
                    
                    stocks.append({
                        "symbol": symbol,
                        "ltp": ltp,
                        "open": quote.get("open", 0),
                        "high": quote.get("high", 0),
                        "low": quote.get("low", 0),
                        "close": prev_close,
                        "prev_close": prev_close,
                        "change": round(change, 2),
                        "change_percent": round(change_pct, 2),
                        "volume": quote.get("volume", 0),
                        "avg_price": quote.get("avg_price", 0),
                        "oi": quote.get("oi", 0),
                        "bid": quote.get("bid", 0),
                        "ask": quote.get("ask", 0),
                        "total_buy_qty": quote.get("total_buy_qty", 0),
                        "total_sell_qty": quote.get("total_sell_qty", 0),
                        "timestamp": quote.get("timestamp"),
                        "data_source": "dhan"
                    })
            
            if stocks:
                logger.info(f"Got {len(stocks)} stocks from Dhan API")
                return stocks
        except Exception as e:
            logger.warning(f"Dhan API failed: {e}")
        
        # Fallback to NSE India API
        logger.info("Falling back to NSE India API...")
        stocks = await self._fetch_fno_stocks_from_nse(symbols)
        return stocks
    
    async def _fetch_fno_stocks_from_nse(self, symbols: List[str] = None) -> List[Dict]:
        """Fetch FNO stocks data from NSE India API (fallback)"""
        import httpx
        
        NSE_BASE_URL = "https://www.nseindia.com/api"
        HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/'
        }
        
        stocks = []
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
                # Get session cookies
                await client.get("https://www.nseindia.com", headers=HEADERS)
                
                # Fetch NIFTY 50 stocks
                response = await client.get(
                    f"{NSE_BASE_URL}/equity-stockIndices",
                    params={"index": "NIFTY 50"},
                    headers=HEADERS
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for stock in data.get("data", []):
                        symbol = stock.get("symbol", "")
                        if symbol and (symbols is None or symbol in symbols):
                            ltp = float(stock.get("lastPrice", 0) or 0)
                            prev_close = float(stock.get("previousClose", 0) or ltp)
                            change_pct = float(stock.get("pChange", 0) or 0)
                            
                            stocks.append({
                                "symbol": symbol,
                                "ltp": ltp,
                                "open": float(stock.get("open", 0) or 0),
                                "high": float(stock.get("dayHigh", 0) or 0),
                                "low": float(stock.get("dayLow", 0) or 0),
                                "close": prev_close,
                                "prev_close": prev_close,
                                "change": round(ltp - prev_close, 2),
                                "change_percent": round(change_pct, 2),
                                "volume": int(stock.get("totalTradedVolume", 0) or 0),
                                "avg_price": 0,
                                "oi": 0,
                                "data_source": "nse"
                            })
                    
                    logger.info(f"Got {len(stocks)} stocks from NSE API")
        except Exception as e:
            logger.error(f"NSE API also failed: {e}")
        
        return stocks
    
    async def get_index_data(self, symbols: List[str] = None) -> Dict[str, Dict]:
        """
        Get index data (NIFTY, BANKNIFTY, etc.)
        Primary: Dhan API (using official dhanhq library) | Fallback: NSE India API
        """
        if symbols is None:
            symbols = ["NIFTY", "BANKNIFTY", "FINNIFTY"]
        
        result = {}
        
        # Try Dhan API first using official dhanhq library
        if self.access_token and self.client_id:
            try:
                # Use official dhanhq library (synchronous, run in thread)
                def fetch_from_dhan():
                    dhan = DhanClient(self.client_id, self.access_token)
                    indices_result = {}
                    
                    for symbol in symbols:
                        info = SECURITY_MAP.get(symbol.upper())
                        if info and info["segment"] == "IDX_I":
                            security_id = int(info["security_id"])
                            
                            try:
                                # Use IDX_I segment for index quotes
                                ohlc_resp = dhan.ohlc_data(securities={'IDX_I': [security_id]})
                                
                                if ohlc_resp.get('status') == 'success':
                                    data = ohlc_resp.get('data', {}).get('data', {})
                                    idx_data = data.get('IDX_I', {})
                                    quote = idx_data.get(str(security_id), {})
                                    
                                    if quote and quote.get('last_price', 0) > 0:
                                        ohlc = quote.get('ohlc', {})
                                        ltp = quote.get('last_price', 0)
                                        prev_close = ohlc.get('close', ltp)
                                        change = round(ltp - prev_close, 2) if prev_close else 0
                                        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0
                                        
                                        indices_result[symbol.upper()] = {
                                            "symbol": symbol.upper(),
                                            "ltp": ltp,
                                            "open": ohlc.get('open', 0) or ltp,
                                            "high": ohlc.get('high', 0) or ltp,
                                            "low": ohlc.get('low', 0) or ltp,
                                            "close": prev_close,
                                            "change": change,
                                            "change_percent": change_pct,
                                            "timestamp": datetime.now().isoformat(),
                                            "data_source": "dhan"
                                        }
                            except Exception as e:
                                logger.warning(f"Dhan dhanhq failed for {symbol}: {e}")
                    
                    return indices_result
                
                # Run synchronous code in thread pool
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, fetch_from_dhan)
                logger.info(f"Dhan API returned {len(result)} indices: {list(result.keys())}")
                
            except Exception as e:
                logger.error(f"Dhan dhanhq library error: {e}")
        else:
            logger.warning("Dhan credentials not configured")
        
        # If Dhan didn't return data, fallback to NSE
        if not result or all(v.get("ltp", 0) == 0 for v in result.values()):
            logger.info("Falling back to NSE for index data...")
            nse_data = await self._fetch_index_from_nse(symbols)
            if nse_data:
                result = nse_data
        
        return result
    
    async def _fetch_index_from_nse(self, symbols: List[str]) -> Dict[str, Dict]:
        """Fetch index data from NSE India API (fallback)"""
        import httpx
        
        NSE_BASE_URL = "https://www.nseindia.com/api"
        HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/'
        }
        
        # Map symbols to NSE index names
        symbol_map = {
            "NIFTY": "NIFTY 50",
            "NIFTY50": "NIFTY 50",
            "BANKNIFTY": "NIFTY BANK",
            "FINNIFTY": "NIFTY FIN SERVICE",
            "MIDCPNIFTY": "NIFTY MIDCAP 50"
        }
        
        result = {}
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
                # Get session cookies
                await client.get("https://www.nseindia.com", headers=HEADERS)
                
                # Fetch all indices
                response = await client.get(
                    f"{NSE_BASE_URL}/allIndices",
                    headers=HEADERS
                )
                
                if response.status_code == 200:
                    data = response.json()
                    indices = data.get("data", [])
                    
                    for symbol in symbols:
                        nse_name = symbol_map.get(symbol.upper(), symbol)
                        
                        for idx in indices:
                            if idx.get("index") == nse_name or idx.get("indexSymbol") == nse_name:
                                ltp = float(idx.get("last", 0) or idx.get("lastPrice", 0) or 0)
                                prev_close = float(idx.get("previousClose", 0) or ltp)
                                change_pct = float(idx.get("percentChange", 0) or idx.get("pChange", 0) or 0)
                                
                                result[symbol.upper()] = {
                                    "symbol": symbol.upper(),
                                    "ltp": ltp,
                                    "open": float(idx.get("open", 0) or 0),
                                    "high": float(idx.get("high", 0) or idx.get("dayHigh", 0) or 0),
                                    "low": float(idx.get("low", 0) or idx.get("dayLow", 0) or 0),
                                    "close": prev_close,
                                    "change": round(ltp - prev_close, 2),
                                    "change_percent": round(change_pct, 2),
                                    "timestamp": datetime.now().isoformat(),
                                    "data_source": "nse"
                                }
                                break
                    
                    logger.info(f"Got {len(result)} indices from NSE API")
        except Exception as e:
            logger.error(f"NSE API also failed for indices: {e}")
        
        return result
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MARKET STATUS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_market_status(self) -> Dict:
        """
        Check if market is open
        """
        now = datetime.now()
        
        # Check if weekday
        if now.weekday() >= 5:  # Saturday or Sunday
            return {
                "status": "closed",
                "message": "Market closed (Weekend)",
                "next_open": self._get_next_trading_day()
            }
        
        # Market hours (IST)
        market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
        pre_open = now.replace(hour=9, minute=0, second=0, microsecond=0)
        
        if now < pre_open:
            return {
                "status": "pre_market",
                "message": "Pre-market session not started",
                "market_open": market_open.isoformat()
            }
        elif now < market_open:
            return {
                "status": "pre_open",
                "message": "Pre-open session",
                "market_open": market_open.isoformat()
            }
        elif now <= market_close:
            return {
                "status": "open",
                "message": "Market is open",
                "market_close": market_close.isoformat()
            }
        else:
            return {
                "status": "closed",
                "message": "Market closed for the day",
                "next_open": self._get_next_trading_day()
            }
    
    def _get_next_trading_day(self) -> str:
        """Get next trading day"""
        now = datetime.now()
        next_day = now + timedelta(days=1)
        
        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)
        
        return next_day.replace(hour=9, minute=15, second=0, microsecond=0).isoformat()


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON ACCESSOR
# ═══════════════════════════════════════════════════════════════════════════════

_dhan_service: Optional[DhanUnifiedService] = None


def get_dhan_unified_service() -> DhanUnifiedService:
    """Get singleton instance of DhanUnifiedService"""
    global _dhan_service
    if _dhan_service is None:
        _dhan_service = DhanUnifiedService()
    return _dhan_service


# For backward compatibility
get_unified_service = get_dhan_unified_service
