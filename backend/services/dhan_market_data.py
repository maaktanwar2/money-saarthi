# backend/services/dhan_market_data.py
"""
Dhan API Market Data Service
Real-time market quotes with batching and rate limiting
"""

import aiohttp
import asyncio
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
import os

logger = logging.getLogger(__name__)

class DhanMarketDataService:
    """
    Dhan API Market Data Service
    
    Features:
    - Real-time market quotes
    - Batch fetching (up to 1000 instruments per call)
    - Rate limiting (1 req/sec)
    - Complete option chain with Greeks
    - NSE_FNO specialized segment
    """
    
    def __init__(self, access_token: str = None, client_id: str = None):
        self.base_url = "https://api.dhan.co/v2"
        self.access_token = access_token or os.environ.get('DHAN_ACCESS_TOKEN', '')
        self.client_id = client_id or os.environ.get('DHAN_CLIENT_ID', '')
        self.session: Optional[aiohttp.ClientSession] = None
        self._last_request_time = 0
        self._rate_limit_delay = 1.0  # 1 second between requests
        
    async def init_session(self):
        """Initialize aiohttp session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session
    
    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        return {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def _rate_limit(self):
        """Enforce rate limiting (1 req/sec)"""
        import time
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        if elapsed < self._rate_limit_delay:
            await asyncio.sleep(self._rate_limit_delay - elapsed)
        self._last_request_time = time.time()
    
    async def get_market_quote(self, instruments: Dict[str, List[int]]) -> Dict:
        """
        Get real-time market quotes for up to 1000 instruments
        
        Args:
            instruments: Dict with exchange as key, list of security IDs as value
                        e.g., {"NSE_EQ": [1333, 11536], "NSE_FNO": [52973]}
        
        Returns:
            Parsed quote data with LTP, OHLC, volume, OI, bid/ask
        """
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.post(
                f"{self.base_url}/marketfeed/quote",
                json=instruments,
                headers=self._get_headers()
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_quote_response(data)
                else:
                    error_text = await response.text()
                    logger.error(f"Dhan API error {response.status}: {error_text}")
                    return {"status": "error", "message": f"API error: {response.status}"}
                    
        except asyncio.TimeoutError:
            logger.error("Dhan API timeout")
            return {"status": "error", "message": "API timeout"}
        except aiohttp.ClientError as e:
            logger.error(f"Dhan API client error: {e}")
            return {"status": "error", "message": str(e)}
        except Exception as e:
            logger.error(f"Dhan API unexpected error: {e}")
            return {"status": "error", "message": str(e)}
    
    def _parse_quote_response(self, data: Dict) -> Dict:
        """Normalize Dhan API response to standard format"""
        parsed = {"status": "success", "data": {}}
        
        if data.get("status") == "success":
            for exchange, instruments in data.get("data", {}).items():
                for symbol_id, quote in instruments.items():
                    ohlc = quote.get("ohlc", {})
                    depth = quote.get("depth", {})
                    buy_depth = depth.get("buy", [{}])
                    sell_depth = depth.get("sell", [{}])
                    
                    parsed["data"][symbol_id] = {
                        "exchange": exchange,
                        "security_id": symbol_id,
                        "ltp": quote.get("last_price"),
                        "open": ohlc.get("open"),
                        "high": ohlc.get("high"),
                        "low": ohlc.get("low"),
                        "close": ohlc.get("close"),
                        "prev_close": quote.get("prev_close"),
                        "volume": quote.get("volume"),
                        "oi": quote.get("oi"),
                        "oi_change": quote.get("oi_day_change"),
                        "bid_price": buy_depth[0].get("price") if buy_depth else None,
                        "bid_qty": buy_depth[0].get("quantity") if buy_depth else None,
                        "ask_price": sell_depth[0].get("price") if sell_depth else None,
                        "ask_qty": sell_depth[0].get("quantity") if sell_depth else None,
                        "change": quote.get("change"),
                        "change_percent": quote.get("change_percent"),
                        "updated_at": quote.get("last_trade_time"),
                        "timestamp": datetime.now().isoformat()
                    }
        else:
            parsed["status"] = "error"
            parsed["message"] = data.get("message", "Unknown error")
        
        return parsed
    
    async def batch_quote_fetch(
        self, 
        symbol_list: List[Dict], 
        batch_size: int = 500
    ) -> Dict:
        """
        Fetch quotes in batches with rate limiting
        
        Args:
            symbol_list: List of dicts with 'exchange' and 'security_id'
            batch_size: Max instruments per batch (default 500, max 1000)
        
        Returns:
            Combined results from all batches
        """
        # Organize by exchange
        by_exchange: Dict[str, List[int]] = {}
        for item in symbol_list:
            exchange = item.get('exchange', 'NSE_EQ')
            security_id = item.get('security_id')
            if security_id:
                if exchange not in by_exchange:
                    by_exchange[exchange] = []
                by_exchange[exchange].append(security_id)
        
        # Create batches
        all_items = []
        for exchange, ids in by_exchange.items():
            for id in ids:
                all_items.append((exchange, id))
        
        batches = [all_items[i:i+batch_size] for i in range(0, len(all_items), batch_size)]
        
        # Fetch each batch
        results = {"status": "success", "data": {}}
        
        for batch in batches:
            # Reorganize batch by exchange
            batch_instruments: Dict[str, List[int]] = {}
            for exchange, security_id in batch:
                if exchange not in batch_instruments:
                    batch_instruments[exchange] = []
                batch_instruments[exchange].append(security_id)
            
            result = await self.get_market_quote(batch_instruments)
            
            if result.get("status") == "success":
                results["data"].update(result.get("data", {}))
            else:
                logger.warning(f"Batch fetch partial failure: {result.get('message')}")
        
        return results
    
    async def get_option_chain(
        self,
        underlying_id: int,
        expiry_date: str,
        exchange: str = "NSE_FNO"
    ) -> Dict:
        """
        Get option chain for an underlying
        
        Args:
            underlying_id: Security ID of underlying (e.g., NIFTY, BANKNIFTY)
            expiry_date: Expiry date in YYYY-MM-DD format
            exchange: Exchange segment (default NSE_FNO)
        
        Returns:
            Option chain with strikes, premiums, Greeks, OI
        """
        await self.init_session()
        await self._rate_limit()
        
        try:
            payload = {
                "UnderlyingScrip": underlying_id,
                "ExpiryDate": expiry_date
            }
            
            async with self.session.post(
                f"{self.base_url}/optionchain",
                json=payload,
                headers=self._get_headers()
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_option_chain(data)
                else:
                    return {"status": "error", "message": f"API error: {response.status}"}
                    
        except Exception as e:
            logger.error(f"Option chain fetch error: {e}")
            return {"status": "error", "message": str(e)}
    
    def _parse_option_chain(self, data: Dict) -> Dict:
        """Parse option chain response"""
        if data.get("status") != "success":
            return {"status": "error", "message": data.get("message", "Unknown error")}
        
        chain_data = data.get("data", {})
        parsed = {
            "status": "success",
            "underlying": {
                "ltp": chain_data.get("underlyingLTP"),
                "name": chain_data.get("underlyingName")
            },
            "expiries": chain_data.get("expiries", []),
            "strikes": []
        }
        
        for strike in chain_data.get("optionChain", []):
            parsed["strikes"].append({
                "strike_price": strike.get("strikePrice"),
                "call": {
                    "ltp": strike.get("CE", {}).get("ltp"),
                    "oi": strike.get("CE", {}).get("oi"),
                    "oi_change": strike.get("CE", {}).get("oiChange"),
                    "volume": strike.get("CE", {}).get("volume"),
                    "iv": strike.get("CE", {}).get("iv"),
                    "delta": strike.get("CE", {}).get("delta"),
                    "theta": strike.get("CE", {}).get("theta"),
                    "gamma": strike.get("CE", {}).get("gamma"),
                    "vega": strike.get("CE", {}).get("vega"),
                    "bid": strike.get("CE", {}).get("bidPrice"),
                    "ask": strike.get("CE", {}).get("askPrice")
                },
                "put": {
                    "ltp": strike.get("PE", {}).get("ltp"),
                    "oi": strike.get("PE", {}).get("oi"),
                    "oi_change": strike.get("PE", {}).get("oiChange"),
                    "volume": strike.get("PE", {}).get("volume"),
                    "iv": strike.get("PE", {}).get("iv"),
                    "delta": strike.get("PE", {}).get("delta"),
                    "theta": strike.get("PE", {}).get("theta"),
                    "gamma": strike.get("PE", {}).get("gamma"),
                    "vega": strike.get("PE", {}).get("vega"),
                    "bid": strike.get("PE", {}).get("bidPrice"),
                    "ask": strike.get("PE", {}).get("askPrice")
                }
            })
        
        return parsed
    
    async def get_historical_data(
        self,
        security_id: int,
        exchange: str,
        from_date: str,
        to_date: str,
        interval: str = "D"
    ) -> Dict:
        """
        Get historical OHLCV data
        
        Args:
            security_id: Security ID
            exchange: Exchange segment
            from_date: Start date (YYYY-MM-DD)
            to_date: End date (YYYY-MM-DD)
            interval: Candle interval (1, 5, 15, 25, 60, D)
        
        Returns:
            Historical candle data
        """
        await self.init_session()
        await self._rate_limit()
        
        try:
            payload = {
                "securityId": str(security_id),
                "exchangeSegment": exchange,
                "instrument": "EQUITY",
                "fromDate": from_date,
                "toDate": to_date
            }
            
            endpoint = "charts/intraday" if interval != "D" else "charts/historical"
            
            async with self.session.post(
                f"{self.base_url}/{endpoint}",
                json=payload,
                headers=self._get_headers()
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_historical_data(data)
                else:
                    return {"status": "error", "message": f"API error: {response.status}"}
                    
        except Exception as e:
            logger.error(f"Historical data fetch error: {e}")
            return {"status": "error", "message": str(e)}
    
    def _parse_historical_data(self, data: Dict) -> Dict:
        """Parse historical data response"""
        if data.get("status") != "success":
            return {"status": "error", "message": data.get("message", "Unknown error")}
        
        candles = []
        for candle in data.get("data", []):
            candles.append({
                "timestamp": candle.get("start_Time"),
                "open": candle.get("open"),
                "high": candle.get("high"),
                "low": candle.get("low"),
                "close": candle.get("close"),
                "volume": candle.get("volume")
            })
        
        return {"status": "success", "candles": candles}


# Singleton instance
_dhan_service: Optional[DhanMarketDataService] = None

def get_dhan_service() -> DhanMarketDataService:
    """Get or create Dhan service singleton"""
    global _dhan_service
    if _dhan_service is None:
        _dhan_service = DhanMarketDataService()
    return _dhan_service
