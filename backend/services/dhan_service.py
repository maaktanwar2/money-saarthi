"""
Dhan API Service
Primary data source for Money Saarthi trading application

Endpoints:
- Option Chain (OI, Greeks, IV, Premium, Volume)
- Market Feed (LTP, OHLC, Quote with depth)
- Historical Data (Daily/Intraday candles)
- Expiry List

Rate Limits:
- 25 requests/sec for orders
- 1 request/sec for quotes
- 1 request/3sec for option chain
"""

import os
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import asyncio
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

# Dhan API Configuration
DHAN_BASE_URL = "https://api.dhan.co/v2"
DHAN_ACCESS_TOKEN = os.getenv("DHAN_ACCESS_TOKEN", "")

# Exchange Segment Codes
EXCHANGE_SEGMENTS = {
    "NSE_EQ": "NSE_EQ",
    "BSE_EQ": "BSE_EQ",
    "NSE_FNO": "NSE_FNO",
    "BSE_FNO": "BSE_FNO",
    "MCX": "MCX_COMM",
    "CDS": "NSE_CURRENCY"
}

# Common symbols to security ID mapping (update with actual IDs)
SYMBOL_MAP = {
    # Index Options
    "NIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26000"},
    "BANKNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26009"},
    "FINNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26037"},
    "MIDCPNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26074"},
    # Equity
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
}

class DhanAPIError(Exception):
    """Custom exception for Dhan API errors"""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class DhanService:
    """
    Dhan API Service for fetching market data
    """
    
    def __init__(self, access_token: str = None):
        self.access_token = access_token or DHAN_ACCESS_TOKEN
        self.base_url = DHAN_BASE_URL
        self.client = None
        self._rate_limit_lock = asyncio.Lock()
        self._last_option_chain_call = 0
        self._last_quote_call = 0
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API request headers"""
        return {
            "Content-Type": "application/json",
            "access-token": self.access_token
        }
    
    async def _ensure_client(self):
        """Ensure HTTP client is initialized"""
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=30.0)
    
    async def _rate_limit(self, endpoint_type: str = "quote"):
        """Enforce rate limits"""
        async with self._rate_limit_lock:
            now = datetime.now().timestamp()
            
            if endpoint_type == "option_chain":
                wait_time = 3 - (now - self._last_option_chain_call)
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
                self._last_option_chain_call = datetime.now().timestamp()
            else:
                wait_time = 1 - (now - self._last_quote_call)
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
                self._last_quote_call = datetime.now().timestamp()
    
    async def _make_request(self, method: str, endpoint: str, data: dict = None, 
                           rate_limit_type: str = "quote") -> Dict[str, Any]:
        """Make API request with error handling"""
        await self._ensure_client()
        await self._rate_limit(rate_limit_type)
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == "GET":
                response = await self.client.get(url, headers=self._get_headers())
            else:
                response = await self.client.post(url, headers=self._get_headers(), json=data)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise DhanAPIError(
                    f"API request failed: {response.text}",
                    status_code=response.status_code,
                    response=response.json() if response.text else None
                )
        except httpx.RequestError as e:
            raise DhanAPIError(f"Network error: {str(e)}")
    
    # ========================================
    # OPTION CHAIN ENDPOINTS
    # ========================================
    
    async def get_expiry_list(self, symbol: str) -> List[str]:
        """
        Get list of available expiry dates for a symbol
        
        Args:
            symbol: Trading symbol (NIFTY, BANKNIFTY, etc.)
        
        Returns:
            List of expiry dates in YYYY-MM-DD format
        """
        symbol_info = SYMBOL_MAP.get(symbol.upper())
        if not symbol_info:
            raise DhanAPIError(f"Unknown symbol: {symbol}")
        
        data = {
            "UnderlyingScrip": int(symbol_info["security_id"]),
            "ExchangeSegment": symbol_info["exchange_segment"]
        }
        
        result = await self._make_request("POST", "/optionchain/expirylist", data, "option_chain")
        return result.get("data", [])
    
    async def get_option_chain(self, symbol: str, expiry: str = None) -> Dict[str, Any]:
        """
        Get full option chain data with Greeks
        
        Args:
            symbol: Trading symbol (NIFTY, BANKNIFTY, etc.)
            expiry: Expiry date in YYYY-MM-DD format (optional, uses nearest if not provided)
        
        Returns:
            Option chain data with strikes, OI, IV, Greeks
        """
        symbol_info = SYMBOL_MAP.get(symbol.upper())
        if not symbol_info:
            raise DhanAPIError(f"Unknown symbol: {symbol}")
        
        # Get expiry list if not provided
        if not expiry:
            expiries = await self.get_expiry_list(symbol)
            if not expiries:
                raise DhanAPIError("No expiry dates available")
            expiry = expiries[0]  # Use nearest expiry
        
        data = {
            "UnderlyingScrip": int(symbol_info["security_id"]),
            "ExchangeSegment": symbol_info["exchange_segment"],
            "Expiry": expiry
        }
        
        result = await self._make_request("POST", "/optionchain", data, "option_chain")
        return self._process_option_chain(result, symbol, expiry)
    
    def _process_option_chain(self, raw_data: dict, symbol: str, expiry: str) -> Dict[str, Any]:
        """Process raw option chain data into a structured format"""
        option_data = raw_data.get("data", {})
        
        processed = {
            "symbol": symbol,
            "expiry": expiry,
            "underlying_price": option_data.get("UnderlyingPrice", 0),
            "timestamp": datetime.now().isoformat(),
            "strikes": [],
            "summary": {
                "total_ce_oi": 0,
                "total_pe_oi": 0,
                "max_ce_oi_strike": 0,
                "max_pe_oi_strike": 0,
                "pcr": 0
            }
        }
        
        chain = option_data.get("Data", [])
        max_ce_oi = 0
        max_pe_oi = 0
        
        for strike_data in chain:
            strike = {
                "strike_price": strike_data.get("StrikePrice", 0),
                "call": {
                    "oi": strike_data.get("CE_OI", 0),
                    "oi_change": strike_data.get("CE_OI_Change", 0),
                    "volume": strike_data.get("CE_Volume", 0),
                    "ltp": strike_data.get("CE_LTP", 0),
                    "iv": strike_data.get("CE_IV", 0),
                    "delta": strike_data.get("CE_Delta", 0),
                    "gamma": strike_data.get("CE_Gamma", 0),
                    "theta": strike_data.get("CE_Theta", 0),
                    "vega": strike_data.get("CE_Vega", 0),
                    "bid": strike_data.get("CE_BidPrice", 0),
                    "ask": strike_data.get("CE_AskPrice", 0)
                },
                "put": {
                    "oi": strike_data.get("PE_OI", 0),
                    "oi_change": strike_data.get("PE_OI_Change", 0),
                    "volume": strike_data.get("PE_Volume", 0),
                    "ltp": strike_data.get("PE_LTP", 0),
                    "iv": strike_data.get("PE_IV", 0),
                    "delta": strike_data.get("PE_Delta", 0),
                    "gamma": strike_data.get("PE_Gamma", 0),
                    "theta": strike_data.get("PE_Theta", 0),
                    "vega": strike_data.get("PE_Vega", 0),
                    "bid": strike_data.get("PE_BidPrice", 0),
                    "ask": strike_data.get("PE_AskPrice", 0)
                }
            }
            
            processed["strikes"].append(strike)
            processed["summary"]["total_ce_oi"] += strike["call"]["oi"]
            processed["summary"]["total_pe_oi"] += strike["put"]["oi"]
            
            if strike["call"]["oi"] > max_ce_oi:
                max_ce_oi = strike["call"]["oi"]
                processed["summary"]["max_ce_oi_strike"] = strike["strike_price"]
            
            if strike["put"]["oi"] > max_pe_oi:
                max_pe_oi = strike["put"]["oi"]
                processed["summary"]["max_pe_oi_strike"] = strike["strike_price"]
        
        if processed["summary"]["total_ce_oi"] > 0:
            processed["summary"]["pcr"] = round(
                processed["summary"]["total_pe_oi"] / processed["summary"]["total_ce_oi"], 2
            )
        
        return processed
    
    # ========================================
    # MARKET FEED ENDPOINTS
    # ========================================
    
    async def get_ltp(self, instruments: List[Dict[str, str]]) -> Dict[str, float]:
        """
        Get Last Traded Price for multiple instruments
        
        Args:
            instruments: List of dicts with exchange_segment and security_id
        
        Returns:
            Dict mapping security_id to LTP
        """
        # Batch into chunks of 1000
        results = {}
        for i in range(0, len(instruments), 1000):
            batch = instruments[i:i+1000]
            data = {
                "NSE_EQ": [int(inst["security_id"]) for inst in batch if inst.get("exchange_segment") == "NSE_EQ"],
                "NSE_FNO": [int(inst["security_id"]) for inst in batch if inst.get("exchange_segment") == "NSE_FNO"],
                "BSE_EQ": [int(inst["security_id"]) for inst in batch if inst.get("exchange_segment") == "BSE_EQ"],
            }
            # Remove empty segments
            data = {k: v for k, v in data.items() if v}
            
            result = await self._make_request("POST", "/marketfeed/ltp", data)
            for segment, prices in result.get("data", {}).items():
                for item in prices:
                    results[str(item.get("security_id"))] = item.get("LTP", 0)
        
        return results
    
    async def get_ohlc(self, instruments: List[Dict[str, str]]) -> Dict[str, Dict]:
        """
        Get OHLC data for multiple instruments
        
        Args:
            instruments: List of dicts with exchange_segment and security_id
        
        Returns:
            Dict mapping security_id to OHLC data
        """
        data = {
            "NSE_EQ": [int(inst["security_id"]) for inst in instruments if inst.get("exchange_segment") == "NSE_EQ"],
            "NSE_FNO": [int(inst["security_id"]) for inst in instruments if inst.get("exchange_segment") == "NSE_FNO"],
        }
        data = {k: v for k, v in data.items() if v}
        
        result = await self._make_request("POST", "/marketfeed/ohlc", data)
        
        processed = {}
        for segment, items in result.get("data", {}).items():
            for item in items:
                processed[str(item.get("security_id"))] = {
                    "open": item.get("Open", 0),
                    "high": item.get("High", 0),
                    "low": item.get("Low", 0),
                    "close": item.get("Close", 0),
                    "ltp": item.get("LTP", 0),
                    "volume": item.get("Volume", 0),
                    "change": item.get("Change", 0),
                    "change_percent": item.get("ChangePercent", 0)
                }
        
        return processed
    
    async def get_quote(self, instruments: List[Dict[str, str]]) -> Dict[str, Dict]:
        """
        Get full quote with market depth for instruments
        
        Args:
            instruments: List of dicts with exchange_segment and security_id
        
        Returns:
            Dict mapping security_id to full quote data
        """
        data = {
            "NSE_EQ": [int(inst["security_id"]) for inst in instruments if inst.get("exchange_segment") == "NSE_EQ"],
            "NSE_FNO": [int(inst["security_id"]) for inst in instruments if inst.get("exchange_segment") == "NSE_FNO"],
        }
        data = {k: v for k, v in data.items() if v}
        
        result = await self._make_request("POST", "/marketfeed/quote", data)
        
        processed = {}
        for segment, items in result.get("data", {}).items():
            for item in items:
                processed[str(item.get("security_id"))] = {
                    "ltp": item.get("LTP", 0),
                    "open": item.get("Open", 0),
                    "high": item.get("High", 0),
                    "low": item.get("Low", 0),
                    "close": item.get("Close", 0),
                    "volume": item.get("Volume", 0),
                    "oi": item.get("OI", 0),
                    "change": item.get("Change", 0),
                    "change_percent": item.get("ChangePercent", 0),
                    "avg_price": item.get("AveragePrice", 0),
                    "bid": item.get("BidPrice", 0),
                    "ask": item.get("AskPrice", 0),
                    "bid_qty": item.get("BidQty", 0),
                    "ask_qty": item.get("AskQty", 0),
                    "total_buy_qty": item.get("TotalBuyQty", 0),
                    "total_sell_qty": item.get("TotalSellQty", 0),
                    "depth": {
                        "buy": item.get("Depth", {}).get("Buy", []),
                        "sell": item.get("Depth", {}).get("Sell", [])
                    }
                }
        
        return processed
    
    # ========================================
    # HISTORICAL DATA ENDPOINTS
    # ========================================
    
    async def get_historical_data(self, symbol: str, from_date: str, to_date: str, 
                                   exchange_segment: str = "NSE_EQ") -> List[Dict]:
        """
        Get historical daily candles
        
        Args:
            symbol: Trading symbol
            from_date: Start date YYYY-MM-DD
            to_date: End date YYYY-MM-DD
            exchange_segment: Exchange segment
        
        Returns:
            List of daily candles
        """
        symbol_info = SYMBOL_MAP.get(symbol.upper())
        if symbol_info:
            security_id = symbol_info["security_id"]
            exchange_segment = symbol_info["exchange_segment"]
        else:
            raise DhanAPIError(f"Unknown symbol: {symbol}")
        
        data = {
            "securityId": security_id,
            "exchangeSegment": exchange_segment,
            "instrument": "EQUITY",
            "fromDate": from_date,
            "toDate": to_date
        }
        
        result = await self._make_request("POST", "/charts/historical", data)
        
        candles = []
        raw_data = result.get("data", {})
        
        # Process parallel arrays
        opens = raw_data.get("open", [])
        highs = raw_data.get("high", [])
        lows = raw_data.get("low", [])
        closes = raw_data.get("close", [])
        volumes = raw_data.get("volume", [])
        timestamps = raw_data.get("start_Time", [])
        
        for i in range(len(timestamps)):
            candles.append({
                "timestamp": timestamps[i],
                "open": opens[i] if i < len(opens) else 0,
                "high": highs[i] if i < len(highs) else 0,
                "low": lows[i] if i < len(lows) else 0,
                "close": closes[i] if i < len(closes) else 0,
                "volume": volumes[i] if i < len(volumes) else 0
            })
        
        return candles
    
    async def get_intraday_data(self, symbol: str, from_date: str, to_date: str,
                                 interval: str = "5", exchange_segment: str = "NSE_EQ") -> List[Dict]:
        """
        Get intraday candles
        
        Args:
            symbol: Trading symbol
            from_date: Start date YYYY-MM-DD
            to_date: End date YYYY-MM-DD
            interval: Candle interval (1, 5, 15, 25, 60 minutes)
            exchange_segment: Exchange segment
        
        Returns:
            List of intraday candles
        """
        symbol_info = SYMBOL_MAP.get(symbol.upper())
        if symbol_info:
            security_id = symbol_info["security_id"]
            exchange_segment = symbol_info["exchange_segment"]
        else:
            raise DhanAPIError(f"Unknown symbol: {symbol}")
        
        data = {
            "securityId": security_id,
            "exchangeSegment": exchange_segment,
            "instrument": "EQUITY",
            "interval": interval,
            "fromDate": from_date,
            "toDate": to_date
        }
        
        result = await self._make_request("POST", "/charts/intraday", data)
        
        candles = []
        raw_data = result.get("data", {})
        
        opens = raw_data.get("open", [])
        highs = raw_data.get("high", [])
        lows = raw_data.get("low", [])
        closes = raw_data.get("close", [])
        volumes = raw_data.get("volume", [])
        timestamps = raw_data.get("start_Time", [])
        
        for i in range(len(timestamps)):
            candles.append({
                "timestamp": timestamps[i],
                "open": opens[i] if i < len(opens) else 0,
                "high": highs[i] if i < len(highs) else 0,
                "low": lows[i] if i < len(lows) else 0,
                "close": closes[i] if i < len(closes) else 0,
                "volume": volumes[i] if i < len(volumes) else 0
            })
        
        return candles
    
    # ========================================
    # HELPER METHODS
    # ========================================
    
    async def get_nifty_stocks_ltp(self) -> Dict[str, Dict]:
        """Get LTP for all Nifty 50 stocks"""
        instruments = [
            {"exchange_segment": info["exchange_segment"], "security_id": info["security_id"]}
            for symbol, info in SYMBOL_MAP.items()
            if info["exchange_segment"] == "NSE_EQ"
        ]
        return await self.get_ohlc(instruments)
    
    async def get_index_option_chain(self, index: str = "NIFTY", expiry: str = None) -> Dict:
        """Convenience method for index option chain"""
        return await self.get_option_chain(index, expiry)
    
    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()
            self.client = None


# Singleton instance
_dhan_service: Optional[DhanService] = None

def get_dhan_service() -> DhanService:
    """Get singleton Dhan service instance"""
    global _dhan_service
    if _dhan_service is None:
        _dhan_service = DhanService()
    return _dhan_service


# FastAPI dependency
async def get_dhan():
    """FastAPI dependency for Dhan service"""
    return get_dhan_service()
