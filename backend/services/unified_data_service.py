"""
Unified Data Service - Single Source of Truth for Money Saarthi
===============================================================

PRIORITY ORDER:
1. NSE India API (Primary) - Official NSE data
2. Yahoo Finance (Fallback) - Free data when NSE unavailable

This service:
- Fetches data from NSE India first
- Falls back to Yahoo Finance if NSE fails/unavailable
- All data is fetched fresh from API (no caching)
"""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import json
import httpx
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

# Load .env file to get credentials
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# NSE India API Configuration
NSE_BASE_URL = "https://www.nseindia.com"
NSE_API_URL = "https://www.nseindia.com/api"

# Data refresh configuration (in-memory only, no file persistence)
DATA_REFRESH_MINUTES = 3

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=10)

# ═══════════════════════════════════════════════════════════════════════════════
# FNO STOCKS LIST (NSE F&O Universe)
# ═══════════════════════════════════════════════════════════════════════════════

FNO_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HDFC", "SBIN", 
    "BHARTIARTL", "HINDUNILVR", "ITC", "KOTAKBANK", "LT", "AXISBANK",
    "BAJFINANCE", "ASIANPAINT", "MARUTI", "SUNPHARMA", "TITAN", "ULTRACEMCO",
    "WIPRO", "NESTLEIND", "TECHM", "HCLTECH", "POWERGRID", "NTPC", "M&M",
    "TATASTEEL", "JSWSTEEL", "ONGC", "COALINDIA", "BAJAJFINSV", "DIVISLAB",
    "DRREDDY", "CIPLA", "GRASIM", "HEROMOTOCO", "EICHERMOT", "BRITANNIA",
    "HINDALCO", "ADANIPORTS", "BPCL", "INDUSINDBK", "SBILIFE", "HDFCLIFE",
    "TATACONSUM", "APOLLOHOSP", "UPL", "TATAMOTORS", "ADANIENT", "LTIM",
    "ICICIGI", "DMART", "VEDL", "ZOMATO", "PNB", "BANKBARODA", "CANBK",
    "FEDERALBNK", "IDFCFIRSTB", "INDHOTEL", "IRCTC", "JINDALSTEL", "LICI",
    "LUPIN", "MOTHERSON", "NAUKRI", "PIDILITIND", "PIIND", "POLYCAB",
    "PVR", "SAIL", "SIEMENS", "SRF", "TATAPOWER", "TORNTPHARM", "VOLTAS"
]

# Dhan Security ID Mapping (Key symbols)
DHAN_SYMBOL_MAP = {
    # Indices
    "NIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26000"},
    "BANKNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26009"},
    "FINNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26037"},
    "MIDCPNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26074"},
    "SENSEX": {"exchange_segment": "BSE_FNO", "security_id": "1"},
    # Top FNO Stocks
    "RELIANCE": {"exchange_segment": "NSE_EQ", "security_id": "2885"},
    "TCS": {"exchange_segment": "NSE_EQ", "security_id": "11536"},
    "HDFCBANK": {"exchange_segment": "NSE_EQ", "security_id": "1333"},
    "INFY": {"exchange_segment": "NSE_EQ", "security_id": "1594"},
    "ICICIBANK": {"exchange_segment": "NSE_EQ", "security_id": "4963"},
    "SBIN": {"exchange_segment": "NSE_EQ", "security_id": "3045"},
    "BHARTIARTL": {"exchange_segment": "NSE_EQ", "security_id": "10604"},
    "HINDUNILVR": {"exchange_segment": "NSE_EQ", "security_id": "1394"},
    "ITC": {"exchange_segment": "NSE_EQ", "security_id": "1660"},
    "LT": {"exchange_segment": "NSE_EQ", "security_id": "11483"},
    "KOTAKBANK": {"exchange_segment": "NSE_EQ", "security_id": "1922"},
    "AXISBANK": {"exchange_segment": "NSE_EQ", "security_id": "5900"},
    "BAJFINANCE": {"exchange_segment": "NSE_EQ", "security_id": "317"},
    "MARUTI": {"exchange_segment": "NSE_EQ", "security_id": "10999"},
    "TITAN": {"exchange_segment": "NSE_EQ", "security_id": "3506"},
    "WIPRO": {"exchange_segment": "NSE_EQ", "security_id": "3787"},
    "TATASTEEL": {"exchange_segment": "NSE_EQ", "security_id": "3499"},
    "TATAMOTORS": {"exchange_segment": "NSE_EQ", "security_id": "3456"},
    "SUNPHARMA": {"exchange_segment": "NSE_EQ", "security_id": "3351"},
    "HCLTECH": {"exchange_segment": "NSE_EQ", "security_id": "7229"},
    "TECHM": {"exchange_segment": "NSE_EQ", "security_id": "13538"},
    "M&M": {"exchange_segment": "NSE_EQ", "security_id": "2031"},
    "NTPC": {"exchange_segment": "NSE_EQ", "security_id": "11630"},
    "POWERGRID": {"exchange_segment": "NSE_EQ", "security_id": "14977"},
    "ASIANPAINT": {"exchange_segment": "NSE_EQ", "security_id": "236"},
    "NESTLEIND": {"exchange_segment": "NSE_EQ", "security_id": "17963"},
    "ULTRACEMCO": {"exchange_segment": "NSE_EQ", "security_id": "11532"},
    "ONGC": {"exchange_segment": "NSE_EQ", "security_id": "2475"},
    "JSWSTEEL": {"exchange_segment": "NSE_EQ", "security_id": "11723"},
    "COALINDIA": {"exchange_segment": "NSE_EQ", "security_id": "20374"},
    "DRREDDY": {"exchange_segment": "NSE_EQ", "security_id": "881"},
    "CIPLA": {"exchange_segment": "NSE_EQ", "security_id": "694"},
    "GRASIM": {"exchange_segment": "NSE_EQ", "security_id": "1232"},
    "HINDALCO": {"exchange_segment": "NSE_EQ", "security_id": "1363"},
    "ADANIPORTS": {"exchange_segment": "NSE_EQ", "security_id": "15083"},
    "BPCL": {"exchange_segment": "NSE_EQ", "security_id": "526"},
    "INDUSINDBK": {"exchange_segment": "NSE_EQ", "security_id": "5258"},
    "DIVISLAB": {"exchange_segment": "NSE_EQ", "security_id": "10940"},
    "BRITANNIA": {"exchange_segment": "NSE_EQ", "security_id": "547"},
    "EICHERMOT": {"exchange_segment": "NSE_EQ", "security_id": "910"},
    "HEROMOTOCO": {"exchange_segment": "NSE_EQ", "security_id": "1348"},
    "BAJAJFINSV": {"exchange_segment": "NSE_EQ", "security_id": "16675"},
    "APOLLOHOSP": {"exchange_segment": "NSE_EQ", "security_id": "157"},
    "TATACONSUM": {"exchange_segment": "NSE_EQ", "security_id": "3432"},
    "ZOMATO": {"exchange_segment": "NSE_EQ", "security_id": "5097"},
    "ADANIENT": {"exchange_segment": "NSE_EQ", "security_id": "25"},
}


class UnifiedDataServiceError(Exception):
    """Custom exception for Unified Data Service"""
    def __init__(self, message: str, source: str = None, status_code: int = None):
        self.message = message
        self.source = source
        self.status_code = status_code
        super().__init__(self.message)


class UnifiedDataService:
    """
    Single source of truth for all market data.
    
    Priority:
    1. NSE India API (Primary - Official data)
    2. Yahoo Finance (Fallback)
    
    Features:
    - Central in-memory cache for current request cycle
    - Fetches fresh data per request (no file persistence)
    - Graceful fallback between providers
    """
    
    _instance = None
    
    # NSE Headers for API requests
    NSE_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Referer': 'https://www.nseindia.com/'
    }
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        # Data Storage
        self._cache: Dict[str, Any] = {
            "stocks": {},           # symbol -> stock data
            "indices": {},          # index -> data
            "option_chains": {},    # symbol -> option chain
            "scanners": {
                "gainers": [],
                "losers": [],
                "high_volume": [],
                "swing_setups": [],
                "oi_buildup": []
            },
            "meta": {
                "last_fetch": None,
                "last_nse_success": None,
                "last_yahoo_success": None,
                "data_source": None,
                "stock_count": 0
            }
        }
        
        # State tracking
        self._is_fetching = False
        self._fetch_lock = asyncio.Lock()  # Lock for thread-safe fetching
        self._auto_refresh_task = None
        self._http_client = None
        self._nse_cookies = {}
        
        # Rate limiting for NSE
        self._last_nse_call = 0
        self._nse_rate_limit = asyncio.Lock()
        
        self._initialized = True
        logger.info(f"✅ UnifiedDataService initialized with NSE India as primary source (Direct API mode)")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # HTTP CLIENT
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def _ensure_client(self):
        """Ensure HTTP client is initialized"""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """Close HTTP client"""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
    
    # ═══════════════════════════════════════════════════════════════════════════
    # NSE INDIA API METHODS
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def _get_nse_cookies(self) -> Dict[str, str]:
        """Get session cookies from NSE for API access"""
        try:
            await self._ensure_client()
            response = await self._http_client.get(
                NSE_BASE_URL,
                headers=self.NSE_HEADERS,
                follow_redirects=True
            )
            self._nse_cookies = dict(response.cookies)
            return self._nse_cookies
        except Exception as e:
            logger.error(f"Error getting NSE cookies: {e}")
            return {}
    
    async def _nse_rate_limit_wait(self):
        """Enforce NSE rate limits - 1 request per second"""
        async with self._nse_rate_limit:
            now = datetime.now().timestamp()
            wait_time = 1 - (now - self._last_nse_call)
            
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self._last_nse_call = datetime.now().timestamp()
    
    async def _fetch_from_nse(self, index_name: str = "NIFTY 50") -> Tuple[Dict[str, Any], bool]:
        """
        Fetch stock data from NSE India API
        
        Returns:
            Tuple of (data dict, success bool)
        """
        await self._ensure_client()
        
        try:
            # Get fresh cookies
            if not self._nse_cookies:
                await self._get_nse_cookies()
            
            # Rate limit
            await self._nse_rate_limit_wait()
            
            # Fetch index stocks data
            url = f"{NSE_API_URL}/equity-stockIndices"
            
            response = await self._http_client.get(
                url,
                params={"index": index_name},
                headers=self.NSE_HEADERS,
                cookies=self._nse_cookies
            )
            
            if response.status_code != 200:
                logger.warning(f"NSE API error: {response.status_code}")
                # Try refreshing cookies
                await self._get_nse_cookies()
                return {}, False
            
            result = response.json()
            stocks_data = {}
            
            # Process NSE response
            for item in result.get("data", []):
                symbol = item.get("symbol", "")
                if not symbol or symbol == index_name:
                    continue
                
                ltp = item.get("lastPrice", 0)
                open_price = item.get("open", 0)
                high = item.get("dayHigh", 0)
                low = item.get("dayLow", 0)
                prev_close = item.get("previousClose", 0)
                change = item.get("change", 0)
                change_pct = item.get("pChange", 0)
                volume = item.get("totalTradedVolume", 0)
                
                stocks_data[symbol] = {
                    "symbol": symbol,
                    "ltp": round(ltp, 2),
                    "open": round(open_price, 2),
                    "high": round(high, 2),
                    "low": round(low, 2),
                    "prev_close": round(prev_close, 2),
                    "close": round(prev_close, 2),
                    "change": round(change, 2),
                    "change_percent": round(change_pct, 2),
                    "change_pct": round(change_pct, 2),
                    "volume": volume,
                    "avg_volume": volume,  # NSE doesn't provide avg, use current
                    "data_source": "nse_india",
                    "timestamp": datetime.now().isoformat()
                }
            
            logger.info(f"✅ NSE India: Fetched {len(stocks_data)} stocks from {index_name}")
            return stocks_data, True
            
        except Exception as e:
            logger.error(f"NSE fetch error: {e}")
            return {}, False
    
    async def _fetch_all_fno_from_nse(self) -> Tuple[Dict[str, Any], bool]:
        """Fetch all F&O stocks by fetching multiple indices"""
        all_stocks = {}
        success = False
        
        # Fetch from multiple indices to get all F&O stocks
        indices = ["NIFTY 50", "NIFTY NEXT 50", "NIFTY BANK", "NIFTY MIDCAP 50"]
        
        for index in indices:
            try:
                stocks, ok = await self._fetch_from_nse(index)
                if ok:
                    all_stocks.update(stocks)
                    success = True
                await asyncio.sleep(0.5)  # Small delay between requests
            except Exception as e:
                logger.error(f"Error fetching {index}: {e}")
        
        logger.info(f"✅ NSE India Total: {len(all_stocks)} unique stocks")
        return all_stocks, success
    
    async def fetch_option_chain_from_nse(self, symbol: str) -> Dict[str, Any]:
        """Fetch option chain from NSE India API"""
        await self._ensure_client()
        
        try:
            # Get fresh cookies
            if not self._nse_cookies:
                await self._get_nse_cookies()
            
            await self._nse_rate_limit_wait()
            
            # Determine endpoint based on symbol
            if symbol.upper() in ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']:
                endpoint = f"{NSE_API_URL}/option-chain-indices"
            else:
                endpoint = f"{NSE_API_URL}/option-chain-equities"
            
            response = await self._http_client.get(
                endpoint,
                params={"symbol": symbol.upper()},
                headers=self.NSE_HEADERS,
                cookies=self._nse_cookies
            )
            
            if response.status_code != 200:
                logger.warning(f"NSE Option Chain API error: {response.status_code}")
                await self._get_nse_cookies()  # Refresh cookies
                return {}
            
            result = response.json()
            records = result.get("records", {})
            
            processed = {
                "symbol": symbol.upper(),
                "expiry_dates": records.get("expiryDates", []),
                "underlying_price": records.get("underlyingValue", 0),
                "timestamp": datetime.now().isoformat(),
                "data_source": "nse_india",
                "strikes": []
            }
            
            for item in records.get("data", []):
                strike = {
                    "strike_price": item.get("strikePrice", 0),
                    "expiry_date": item.get("expiryDate", ""),
                    "call": {},
                    "put": {}
                }
                
                # Process CE (Call)
                if item.get("CE"):
                    ce = item["CE"]
                    strike["call"] = {
                        "oi": ce.get("openInterest", 0),
                        "oi_change": ce.get("changeinOpenInterest", 0),
                        "volume": ce.get("totalTradedVolume", 0),
                        "ltp": ce.get("lastPrice", 0),
                        "iv": ce.get("impliedVolatility", 0),
                        "bid": ce.get("bidprice", 0),
                        "ask": ce.get("askPrice", 0),
                    }
                
                # Process PE (Put)
                if item.get("PE"):
                    pe = item["PE"]
                    strike["put"] = {
                        "oi": pe.get("openInterest", 0),
                        "oi_change": pe.get("changeinOpenInterest", 0),
                        "volume": pe.get("totalTradedVolume", 0),
                        "ltp": pe.get("lastPrice", 0),
                        "iv": pe.get("impliedVolatility", 0),
                        "bid": pe.get("bidprice", 0),
                        "ask": pe.get("askPrice", 0),
                    }
                
                processed["strikes"].append(strike)
            
            # Cache it
            self._cache["option_chains"][symbol.upper()] = processed
            logger.info(f"✅ NSE India: Fetched option chain for {symbol}")
            return processed
            
        except Exception as e:
            logger.error(f"NSE option chain error: {e}")
            return {}
    
    # ═══════════════════════════════════════════════════════════════════════════
    # YAHOO FINANCE METHODS (FALLBACK)
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _fetch_from_yahoo_sync(self, symbols: List[str]) -> Dict[str, Any]:
        """Synchronous Yahoo Finance fetch (runs in thread pool)"""
        stocks_data = {}
        
        try:
            # Add .NS suffix for NSE stocks
            yahoo_symbols = [f"{s}.NS" if not s.endswith('.NS') else s for s in symbols]
            
            # Batch fetch
            tickers = yf.Tickers(' '.join(yahoo_symbols))
            
            for symbol in symbols:
                try:
                    yahoo_symbol = f"{symbol}.NS" if not symbol.endswith('.NS') else symbol
                    ticker = tickers.tickers.get(yahoo_symbol)
                    
                    if ticker:
                        info = ticker.info
                        
                        ltp = info.get('regularMarketPrice', info.get('currentPrice', 0))
                        prev_close = info.get('previousClose', info.get('regularMarketPreviousClose', ltp))
                        
                        change = ltp - prev_close if prev_close else 0
                        change_pct = (change / prev_close * 100) if prev_close else 0
                        
                        stocks_data[symbol] = {
                            "symbol": symbol,
                            "ltp": ltp,
                            "open": info.get('regularMarketOpen', info.get('open', 0)),
                            "high": info.get('regularMarketDayHigh', info.get('dayHigh', 0)),
                            "low": info.get('regularMarketDayLow', info.get('dayLow', 0)),
                            "close": prev_close,
                            "change": round(change, 2),
                            "change_pct": round(change_pct, 2),
                            "volume": info.get('regularMarketVolume', info.get('volume', 0)),
                            "avg_volume": info.get('averageVolume', 0),
                            "volume_ratio": round(
                                info.get('regularMarketVolume', 0) / info.get('averageVolume', 1) 
                                if info.get('averageVolume', 0) > 0 else 1, 2
                            ),
                            "market_cap": info.get('marketCap', 0),
                            "pe_ratio": info.get('trailingPE', 0),
                            "data_source": "yahoo_finance",
                            "timestamp": datetime.now().isoformat()
                        }
                except Exception as e:
                    logger.debug(f"Yahoo fetch error for {symbol}: {e}")
                    continue
            
            logger.info(f"📊 Yahoo: Fetched {len(stocks_data)} stocks")
            return stocks_data
            
        except Exception as e:
            logger.error(f"Yahoo batch fetch error: {e}")
            return stocks_data
    
    async def _fetch_from_yahoo(self, symbols: List[str]) -> Tuple[Dict[str, Any], bool]:
        """Fetch stock data from Yahoo Finance (async wrapper)"""
        loop = asyncio.get_event_loop()
        
        try:
            # Run synchronous yfinance in thread pool
            stocks_data = await loop.run_in_executor(
                executor,
                self._fetch_from_yahoo_sync,
                symbols
            )
            
            success = len(stocks_data) > 0
            return stocks_data, success
            
        except Exception as e:
            logger.error(f"Yahoo async fetch error: {e}")
            return {}, False
    
    # ═══════════════════════════════════════════════════════════════════════════
    # UNIFIED FETCH METHOD
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def fetch_all_stocks(self, symbols: List[str] = None, force: bool = False) -> Dict[str, Any]:
        """
        Fetch stock data with NSE INDIA FIRST priority, fallback to Yahoo.
        
        Args:
            symbols: List of symbols to fetch (default: FNO_STOCKS)
            force: Force refresh even if cache is fresh
        
        Returns:
            Dict of stock data keyed by symbol
        """
        # Use lock to prevent race conditions
        async with self._fetch_lock:
            if self._is_fetching:
                logger.info("⏳ Fetch already in progress, returning cache")
                return self._cache.get("stocks", {})
            
            self._is_fetching = True
        
        symbols = symbols or FNO_STOCKS
        stocks_data = {}
        data_source = None
        
        try:
            # ═══════════════════════════════════════════════════════════════════
            # PRIORITY 1: TRY NSE INDIA FIRST (Official Data)
            # ═══════════════════════════════════════════════════════════════════
            logger.info("🔄 Fetching from NSE India (primary)...")
            nse_data, nse_success = await self._fetch_all_fno_from_nse()
            
            if nse_success and nse_data:
                stocks_data.update(nse_data)
                data_source = "nse_india"
                self._cache["meta"]["last_nse_success"] = datetime.now().isoformat()
            
            # ═══════════════════════════════════════════════════════════════════
            # PRIORITY 2: FALLBACK TO YAHOO FOR MISSING SYMBOLS
            # ═══════════════════════════════════════════════════════════════════
            missing_symbols = [s for s in symbols if s not in stocks_data]
            
            if missing_symbols and len(missing_symbols) > len(symbols) // 2:
                # NSE failed or returned very few stocks, use Yahoo as backup
                logger.info(f"🔄 NSE returned few stocks, using Yahoo for {len(missing_symbols)} stocks...")
                yahoo_data, yahoo_success = await self._fetch_from_yahoo(missing_symbols)
                
                if yahoo_success:
                    stocks_data.update(yahoo_data)
                    if not data_source:
                        data_source = "yahoo_finance"
                    else:
                        data_source = "nse+yahoo"
                    self._cache["meta"]["last_yahoo_success"] = datetime.now().isoformat()
            
            # ═══════════════════════════════════════════════════════════════════
            # UPDATE CACHE
            # ═══════════════════════════════════════════════════════════════════
            if stocks_data:
                self._cache["stocks"] = stocks_data
                self._cache["meta"]["last_fetch"] = datetime.now().isoformat()
                self._cache["meta"]["data_source"] = data_source
                self._cache["meta"]["stock_count"] = len(stocks_data)
                
                # Update scanner data
                self._update_scanners()
                
                logger.info(f"✅ Unified fetch complete: {len(stocks_data)} stocks from {data_source}")
            
            return stocks_data
            
        except Exception as e:
            logger.error(f"Unified fetch error: {e}")
            return self._cache.get("stocks", {})
            
        finally:
            self._is_fetching = False
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SCANNER DATA METHODS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _update_scanners(self):
        """Update scanner data from cached stocks"""
        stocks = list(self._cache.get("stocks", {}).values())
        
        if not stocks:
            return
        
        # Day Gainers (positive change, sorted by change_pct)
        gainers = [s for s in stocks if s.get("change_pct", 0) > 0]
        self._cache["scanners"]["gainers"] = sorted(
            gainers, key=lambda x: x.get("change_pct", 0), reverse=True
        )[:15]
        
        # Day Losers (negative change, sorted by change_pct)
        losers = [s for s in stocks if s.get("change_pct", 0) < 0]
        self._cache["scanners"]["losers"] = sorted(
            losers, key=lambda x: x.get("change_pct", 0)
        )[:15]
        
        # High Volume (volume_ratio > 1.3)
        high_volume = [s for s in stocks if s.get("volume_ratio", 1) > 1.3]
        self._cache["scanners"]["high_volume"] = sorted(
            high_volume, key=lambda x: x.get("volume_ratio", 1), reverse=True
        )[:20]
        
        logger.info(f"📊 Scanners updated: {len(self._cache['scanners']['gainers'])} gainers, "
                   f"{len(self._cache['scanners']['losers'])} losers")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PUBLIC GETTERS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_all_stocks(self) -> List[Dict]:
        """Get all stock data as list"""
        return list(self._cache.get("stocks", {}).values())
    
    def get_stock(self, symbol: str) -> Optional[Dict]:
        """Get specific stock from data"""
        return self._cache.get("stocks", {}).get(symbol.upper())
    
    def get_gainers(self, limit: int = 15) -> List[Dict]:
        """Get top gainers"""
        return self._cache.get("scanners", {}).get("gainers", [])[:limit]
    
    def get_losers(self, limit: int = 15) -> List[Dict]:
        """Get top losers"""
        return self._cache.get("scanners", {}).get("losers", [])[:limit]
    
    def get_high_volume(self, limit: int = 20) -> List[Dict]:
        """Get high volume stocks"""
        return self._cache.get("scanners", {}).get("high_volume", [])[:limit]
    
    def get_option_chain(self, symbol: str) -> Optional[Dict]:
        """Get option chain"""
        return self._cache.get("option_chains", {}).get(symbol.upper())
    
    def get_cache_info(self) -> Dict:
        """Get data status information"""
        meta = self._cache.get("meta", {})
        last_fetch = meta.get("last_fetch")
        
        time_since = 0
        if last_fetch:
            time_since = (datetime.now() - datetime.fromisoformat(last_fetch)).total_seconds()
        
        return {
            "stock_count": meta.get("stock_count", 0),
            "data_source": meta.get("data_source", "none"),
            "last_fetch": meta.get("last_fetch"),
            "last_nse_success": meta.get("last_nse_success"),
            "last_yahoo_success": meta.get("last_yahoo_success"),
            "seconds_since_fetch": round(time_since),
            "is_stale": time_since > DATA_REFRESH_MINUTES * 60,
            "nse_enabled": True,  # NSE is always available (no credentials needed)
            "is_fetching": self._is_fetching,
            "mode": "direct_api",  # Always fetch fresh from API
            "scanners": {
                "gainers": len(self._cache.get("scanners", {}).get("gainers", [])),
                "losers": len(self._cache.get("scanners", {}).get("losers", [])),
                "high_volume": len(self._cache.get("scanners", {}).get("high_volume", []))
            }
        }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # AUTO REFRESH
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def _auto_refresh_loop(self):
        """Background loop that auto-refreshes data every 3 minutes"""
        logger.info(f"🔄 Auto-refresh loop started (every {DATA_REFRESH_MINUTES} minutes)")
        
        while True:
            try:
                await asyncio.sleep(DATA_REFRESH_MINUTES * 60)
                
                if not self._is_fetching:
                    logger.info("⏰ Auto-refresh triggered...")
                    await self.fetch_all_stocks(force=True)
                    
            except asyncio.CancelledError:
                logger.info("Auto-refresh loop cancelled")
                break
            except Exception as e:
                logger.error(f"Auto-refresh error: {e}")
                await asyncio.sleep(30)
    
    def start_auto_refresh(self):
        """Start auto-refresh background task"""
        if self._auto_refresh_task is None or self._auto_refresh_task.done():
            self._auto_refresh_task = asyncio.create_task(self._auto_refresh_loop())
            logger.info("✅ Auto-refresh started")
    
    def stop_auto_refresh(self):
        """Stop auto-refresh background task"""
        if self._auto_refresh_task and not self._auto_refresh_task.done():
            self._auto_refresh_task.cancel()
            logger.info("Auto-refresh stopped")


# ═══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCE & HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

_unified_service: Optional[UnifiedDataService] = None


def get_unified_service() -> UnifiedDataService:
    """Get singleton instance of UnifiedDataService"""
    global _unified_service
    if _unified_service is None:
        _unified_service = UnifiedDataService()
    return _unified_service


async def get_unified_data():
    """FastAPI dependency for UnifiedDataService"""
    return get_unified_service()


# ═══════════════════════════════════════════════════════════════════════════════
# CONVENIENCE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_stock_price(symbol: str) -> Optional[Dict]:
    """Quick helper to fetch single stock price"""
    service = get_unified_service()
    
    # Check cache first
    stock = service.get_stock(symbol)
    if stock:
        return stock
    
    # Fetch if not in cache
    await service.fetch_all_stocks([symbol])
    return service.get_stock(symbol)


async def fetch_multiple_prices(symbols: List[str]) -> Dict[str, Dict]:
    """Quick helper to fetch multiple stock prices"""
    service = get_unified_service()
    await service.fetch_all_stocks(symbols)
    
    result = {}
    for symbol in symbols:
        stock = service.get_stock(symbol)
        if stock:
            result[symbol] = stock
    
    return result


async def get_option_chain(symbol: str) -> Dict[str, Any]:
    """Quick helper to get option chain from NSE India"""
    service = get_unified_service()
    
    # Try to fetch from NSE India
    chain = await service.fetch_option_chain_from_nse(symbol)
    if chain:
        return chain
    
    # Return cached if available
    return service.get_option_chain(symbol) or {}
