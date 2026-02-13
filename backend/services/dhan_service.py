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

# Common symbols to security ID mapping (Dhan security IDs)
# Full list: https://api.dhan.co/files/SecurityList.csv
SYMBOL_MAP = {
    # Index Options
    "NIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26000"},
    "BANKNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26009"},
    "FINNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26037"},
    "MIDCPNIFTY": {"exchange_segment": "NSE_FNO", "security_id": "26074"},
    # Nifty 50 Stocks (F&O enabled)
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
    "WIPRO": {"exchange_segment": "NSE_EQ", "security_id": "3787"},
    "ASIANPAINT": {"exchange_segment": "NSE_EQ", "security_id": "236"},
    "MARUTI": {"exchange_segment": "NSE_EQ", "security_id": "10999"},
    "TITAN": {"exchange_segment": "NSE_EQ", "security_id": "3506"},
    "BAJFINANCE": {"exchange_segment": "NSE_EQ", "security_id": "317"},
    "HCLTECH": {"exchange_segment": "NSE_EQ", "security_id": "7229"},
    "SUNPHARMA": {"exchange_segment": "NSE_EQ", "security_id": "3351"},
    "TATAMOTORS": {"exchange_segment": "NSE_EQ", "security_id": "3456"},
    "TATASTEEL": {"exchange_segment": "NSE_EQ", "security_id": "3499"},
    "ULTRACEMCO": {"exchange_segment": "NSE_EQ", "security_id": "11532"},
    "NTPC": {"exchange_segment": "NSE_EQ", "security_id": "11630"},
    "POWERGRID": {"exchange_segment": "NSE_EQ", "security_id": "14977"},
    "ONGC": {"exchange_segment": "NSE_EQ", "security_id": "2475"},
    "COALINDIA": {"exchange_segment": "NSE_EQ", "security_id": "20374"},
    "JSWSTEEL": {"exchange_segment": "NSE_EQ", "security_id": "11723"},
    "TECHM": {"exchange_segment": "NSE_EQ", "security_id": "13538"},
    "HINDALCO": {"exchange_segment": "NSE_EQ", "security_id": "1363"},
    "DRREDDY": {"exchange_segment": "NSE_EQ", "security_id": "881"},
    "CIPLA": {"exchange_segment": "NSE_EQ", "security_id": "694"},
    "DIVISLAB": {"exchange_segment": "NSE_EQ", "security_id": "10940"},
    "APOLLOHOSP": {"exchange_segment": "NSE_EQ", "security_id": "157"},
    "EICHERMOT": {"exchange_segment": "NSE_EQ", "security_id": "910"},
    "GRASIM": {"exchange_segment": "NSE_EQ", "security_id": "1232"},
    "BAJAJFINSV": {"exchange_segment": "NSE_EQ", "security_id": "16675"},
    "INDUSINDBK": {"exchange_segment": "NSE_EQ", "security_id": "5258"},
    "HEROMOTOCO": {"exchange_segment": "NSE_EQ", "security_id": "1348"},
    "ADANIENT": {"exchange_segment": "NSE_EQ", "security_id": "25"},
    "ADANIPORTS": {"exchange_segment": "NSE_EQ", "security_id": "15083"},
    "TATACONSUM": {"exchange_segment": "NSE_EQ", "security_id": "3432"},
    "BPCL": {"exchange_segment": "NSE_EQ", "security_id": "526"},
    "BRITANNIA": {"exchange_segment": "NSE_EQ", "security_id": "547"},
    "NESTLEIND": {"exchange_segment": "NSE_EQ", "security_id": "17963"},
    "SBILIFE": {"exchange_segment": "NSE_EQ", "security_id": "21808"},
    "HDFCLIFE": {"exchange_segment": "NSE_EQ", "security_id": "467"},
    "M&M": {"exchange_segment": "NSE_EQ", "security_id": "2031"},
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
                    "ask": strike_data.get("CE_AskPrice", 0),
                    "security_id": strike_data.get("CE_SecurityId") or strike_data.get("CE_SecId") or strike_data.get("CE_Scrip_Id")
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
                    "ask": strike_data.get("PE_AskPrice", 0),
                    "security_id": strike_data.get("PE_SecurityId") or strike_data.get("PE_SecId") or strike_data.get("PE_Scrip_Id")
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
    
    async def get_all_stocks_data(self) -> List[Dict]:
        """
        Get OHLC data for all F&O stocks for VWAP bot scanning
        
        Returns:
            List of stock dicts with symbol, ltp, open, high, low, change_pct, volume_ratio
        """
        try:
            instruments = [
                {"exchange_segment": info["exchange_segment"], "security_id": info["security_id"]}
                for symbol, info in SYMBOL_MAP.items()
                if info["exchange_segment"] == "NSE_EQ"
            ]
            
            if not instruments:
                logger.warning("No equity instruments in SYMBOL_MAP")
                return []
            
            # Get OHLC data from Dhan
            ohlc_data = await self.get_ohlc(instruments)
            
            # Build reverse mapping: security_id -> symbol
            id_to_symbol = {
                info["security_id"]: symbol 
                for symbol, info in SYMBOL_MAP.items() 
                if info["exchange_segment"] == "NSE_EQ"
            }
            
            stocks = []
            for security_id, data in ohlc_data.items():
                symbol = id_to_symbol.get(security_id, security_id)
                ltp = data.get("ltp", 0)
                open_price = data.get("open", ltp)
                prev_close = data.get("close", ltp)  # Previous day close
                
                # Calculate change percent
                change_pct = 0
                if prev_close and prev_close > 0:
                    change_pct = ((ltp - prev_close) / prev_close) * 100
                
                stocks.append({
                    "symbol": symbol,
                    "security_id": security_id,
                    "ltp": ltp,
                    "open": open_price,
                    "high": data.get("high", ltp),
                    "low": data.get("low", ltp),
                    "prev_close": prev_close,
                    "change": data.get("change", 0),
                    "change_pct": round(change_pct, 2),
                    "volume": data.get("volume", 0),
                    "volume_ratio": 1.5,  # Dhan doesn't provide avg volume, assume good volume
                    "data_source": "dhan"
                })
            
            logger.info(f"📊 Dhan: Fetched {len(stocks)} stocks data")
            return stocks
            
        except Exception as e:
            logger.error(f"Error getting all stocks data: {e}")
            return []
    
    async def get_index_option_chain(self, index: str = "NIFTY", expiry: str = None) -> Dict:
        """Convenience method for index option chain"""
        return await self.get_option_chain(index, expiry)
    
    # ========================================
    # ACCOUNT & FUND ENDPOINTS
    # ========================================
    
    async def get_fund_limits(self) -> Dict[str, Any]:
        """
        Get fund limits and margin available
        Dhan API: GET /fundlimit
        
        Returns:
            Fund limits with available margin, utilized, etc.
        Note: Dhan API returns data directly (not in 'data' wrapper)
        Note: Dhan has a typo - 'availabelBalance' not 'availableBalance'
        """
        try:
            result = await self._make_request("GET", "/fundlimit", rate_limit_type="quote")
            logger.info(f"Raw Dhan fundlimit response: {result}")
            
            # Dhan returns data directly without wrapper
            available = result.get("availabelBalance", 0) or 0  # Note: Dhan typo
            utilized = result.get("utilizedAmount", 0) or 0
            collateral = result.get("collateralAmount", 0) or 0
            withdrawable = result.get("withdrawableBalance", 0) or 0
            sod_limit = result.get("sodLimit", 0) or 0
            
            logger.info(f"Fund limits parsed: available={available}, utilized={utilized}, collateral={collateral}")
            
            return {
                "success": True,
                "data": {
                    "available_balance": available,
                    "utilized_amount": utilized,
                    "collateral": collateral,
                    "withdrawable_balance": withdrawable,
                    "sodLimit": sod_limit,
                    "total_available": available + collateral,
                    "client_id": result.get("dhanClientId", ""),
                    "raw": result
                }
            }
        except Exception as e:
            logger.error(f"Error fetching fund limits: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {
                    "available_balance": 0,
                    "utilized_amount": 0,
                    "total_available": 0
                }
            }
    
    async def get_positions(self) -> Dict[str, Any]:
        """
        Get current positions
        Dhan API: GET /positions
        
        Returns:
            List of open positions with P&L
        Note: Dhan API returns array directly, not wrapped in 'data'
        """
        try:
            result = await self._make_request("GET", "/positions", rate_limit_type="quote")
            # Dhan returns array directly
            positions = result if isinstance(result, list) else []
            
            total_pnl = sum(p.get("realizedProfit", 0) + p.get("unrealizedProfit", 0) for p in positions)
            
            logger.info(f"Positions fetched: count={len(positions)}, total_pnl={total_pnl}")
            
            return {
                "success": True,
                "data": {
                    "positions": positions,
                    "total_positions": len(positions),
                    "total_pnl": total_pnl
                }
            }
        except Exception as e:
            logger.error(f"Error fetching positions: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"positions": [], "total_positions": 0, "total_pnl": 0}
            }
    
    async def get_holdings(self) -> Dict[str, Any]:
        """
        Get holdings (stocks in demat)
        Dhan API: GET /holdings
        
        Returns:
            List of holdings with current value
        Note: Dhan API returns array directly, not wrapped in 'data'
        """
        try:
            result = await self._make_request("GET", "/holdings", rate_limit_type="quote")
            # Dhan returns array directly
            holdings = result if isinstance(result, list) else []
            
            total_value = sum(h.get("totalQty", 0) * h.get("lastTradedPrice", 0) for h in holdings)
            total_investment = sum(h.get("totalQty", 0) * h.get("avgCostPrice", 0) for h in holdings)
            total_pnl = total_value - total_investment
            
            logger.info(f"Holdings fetched: count={len(holdings)}, total_value={total_value}")
            
            return {
                "success": True,
                "data": {
                    "holdings": holdings,
                    "total_holdings": len(holdings),
                    "total_value": total_value,
                    "total_investment": total_investment,
                    "total_pnl": total_pnl,
                    "pnl_percent": (total_pnl / total_investment * 100) if total_investment > 0 else 0
                }
            }
        except Exception as e:
            logger.error(f"Error fetching holdings: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"holdings": [], "total_holdings": 0, "total_value": 0}
            }
    
    async def get_account_summary(self) -> Dict[str, Any]:
        """
        Get complete account summary - funds, positions, holdings
        
        Returns:
            Complete account overview
        """
        try:
            # Fetch all data in parallel
            funds, positions, holdings = await asyncio.gather(
                self.get_fund_limits(),
                self.get_positions(),
                self.get_holdings(),
                return_exceptions=True
            )
            
            # Handle exceptions
            if isinstance(funds, Exception):
                funds = {"success": False, "data": {"available_balance": 0}}
            if isinstance(positions, Exception):
                positions = {"success": False, "data": {"positions": [], "total_pnl": 0}}
            if isinstance(holdings, Exception):
                holdings = {"success": False, "data": {"holdings": [], "total_value": 0}}
            
            return {
                "success": True,
                "data": {
                    "funds": funds.get("data", {}),
                    "positions": positions.get("data", {}),
                    "holdings": holdings.get("data", {}),
                    "summary": {
                        "available_margin": funds.get("data", {}).get("available_balance", 0),
                        "utilized_margin": funds.get("data", {}).get("utilized_amount", 0),
                        "holdings_value": holdings.get("data", {}).get("total_value", 0),
                        "positions_pnl": positions.get("data", {}).get("total_pnl", 0),
                        "total_portfolio_value": (
                            funds.get("data", {}).get("available_balance", 0) +
                            holdings.get("data", {}).get("total_value", 0)
                        )
                    }
                }
            }
        except Exception as e:
            logger.error(f"Error fetching account summary: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ========================================
    # ORDER PLACEMENT ENDPOINTS
    # ========================================
    
    async def place_order(
        self,
        security_id: str,
        exchange_segment: str,
        transaction_type: str,  # BUY or SELL
        quantity: int,
        order_type: str = "MARKET",  # MARKET, LIMIT, SL, SL-M
        product_type: str = "INTRADAY",  # INTRADAY, CNC, MARGIN
        price: float = 0,
        trigger_price: float = 0,
        validity: str = "DAY",
        disclosed_quantity: int = 0
    ) -> Dict[str, Any]:
        """
        Place an order via Dhan API
        
        Args:
            security_id: Dhan security ID
            exchange_segment: NSE_EQ, NSE_FNO, BSE_EQ, etc.
            transaction_type: BUY or SELL
            quantity: Number of shares/lots
            order_type: MARKET, LIMIT, SL, SL-M
            product_type: INTRADAY, CNC, MARGIN
            price: Limit price (for LIMIT orders)
            trigger_price: Trigger price (for SL orders)
            validity: DAY or IOC
            disclosed_quantity: Disclosed quantity
        
        Returns:
            Order result with order_id
        """
        await self._ensure_client()
        
        # Build order payload
        order_data = {
            "dhanClientId": "",  # API will auto-fill
            "transactionType": transaction_type.upper(),
            "exchangeSegment": exchange_segment,
            "productType": product_type.upper(),
            "orderType": order_type.upper(),
            "validity": validity.upper(),
            "securityId": str(security_id),
            "quantity": int(quantity),
            "disclosedQuantity": int(disclosed_quantity),
            "price": float(price) if order_type.upper() == "LIMIT" else 0,
            "triggerPrice": float(trigger_price) if order_type.upper() in ["SL", "SL-M"] else 0,
            "afterMarketOrder": False,
            "amoTime": "OPEN",
            "boProfitValue": 0,
            "boStopLossValue": 0
        }
        
        logger.info(f"🔥 Placing order: {transaction_type} {quantity} x {security_id}")
        
        try:
            result = await self._make_request("POST", "/orders", order_data)
            
            if result.get("orderId"):
                logger.info(f"✅ Order placed: {result.get('orderId')}")
                return {
                    "success": True,
                    "order_id": result.get("orderId"),
                    "status": result.get("orderStatus", "PENDING"),
                    "message": "Order placed successfully",
                    "data": result
                }
            else:
                error_msg = result.get("errorMessage") or result.get("message") or "Order failed"
                logger.error(f"❌ Order failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "data": result
                }
        except Exception as e:
            logger.error(f"❌ Order exception: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def modify_order(
        self,
        order_id: str,
        order_type: str = "MARKET",
        quantity: int = None,
        price: float = None,
        trigger_price: float = None,
        validity: str = "DAY",
        disclosed_quantity: int = 0
    ) -> Dict[str, Any]:
        """Modify an existing order"""
        await self._ensure_client()
        
        modify_data = {
            "dhanClientId": "",
            "orderId": order_id,
            "orderType": order_type.upper(),
            "validity": validity.upper(),
            "disclosedQuantity": disclosed_quantity
        }
        
        if quantity:
            modify_data["quantity"] = int(quantity)
        if price:
            modify_data["price"] = float(price)
        if trigger_price:
            modify_data["triggerPrice"] = float(trigger_price)
        
        try:
            result = await self._make_request("PUT", f"/orders/{order_id}", modify_data)
            return {
                "success": True,
                "order_id": order_id,
                "message": "Order modified successfully",
                "data": result
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """Cancel an existing order"""
        await self._ensure_client()
        
        try:
            # Dhan uses DELETE method for order cancellation
            url = f"{self.base_url}/orders/{order_id}"
            response = await self.client.delete(url, headers=self._get_headers())
            
            if response.status_code == 200:
                logger.info(f"✅ Order cancelled: {order_id}")
                return {
                    "success": True,
                    "order_id": order_id,
                    "message": "Order cancelled successfully"
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get status of an order"""
        await self._ensure_client()
        
        try:
            url = f"{self.base_url}/orders/{order_id}"
            response = await self.client.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "order_id": order_id,
                    "status": data.get("orderStatus"),
                    "filled_quantity": data.get("filledQty", 0),
                    "pending_quantity": data.get("pendingQty", 0),
                    "average_price": data.get("averagePrice", 0),
                    "data": data
                }
            else:
                return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_order_list(self) -> Dict[str, Any]:
        """Get list of all orders for today"""
        await self._ensure_client()
        
        try:
            url = f"{self.base_url}/orders"
            response = await self.client.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                data = response.json()
                orders = data if isinstance(data, list) else data.get("data", [])
                return {
                    "success": True,
                    "orders": orders,
                    "count": len(orders)
                }
            else:
                return {"success": False, "error": response.text, "orders": []}
        except Exception as e:
            return {"success": False, "error": str(e), "orders": []}
    
    async def get_trade_history(self) -> Dict[str, Any]:
        """Get executed trades for today"""
        await self._ensure_client()
        
        try:
            url = f"{self.base_url}/trades"
            response = await self.client.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                data = response.json()
                trades = data if isinstance(data, list) else data.get("data", [])
                return {
                    "success": True,
                    "trades": trades,
                    "count": len(trades)
                }
            else:
                return {"success": False, "error": response.text, "trades": []}
        except Exception as e:
            return {"success": False, "error": str(e), "trades": []}

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
