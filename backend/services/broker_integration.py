"""
Broker Trading API Integration
Supports: Dhan and Upstox

This module provides unified trading API for:
- Order placement (Buy/Sell)
- Order modification
- Order cancellation
- Position tracking
- Portfolio/Holdings
- Real-time quotes
- Option chain data
"""

import aiohttp
import asyncio
import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

logger = logging.getLogger(__name__)


class OrderType(Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL = "SL"
    SL_M = "SL-M"


class TransactionType(Enum):
    BUY = "BUY"
    SELL = "SELL"


class ProductType(Enum):
    CNC = "CNC"  # Cash & Carry (Delivery)
    INTRADAY = "INTRADAY"  # MIS
    MARGIN = "MARGIN"  # NRML for F&O


class Exchange(Enum):
    NSE = "NSE"
    BSE = "BSE"
    NFO = "NFO"
    MCX = "MCX"


@dataclass
class OrderRequest:
    """Unified order request structure"""
    symbol: str
    exchange: str
    transaction_type: str  # BUY or SELL
    quantity: int
    order_type: str = "LIMIT"  # MARKET, LIMIT, SL, SL-M
    product_type: str = "MARGIN"  # CNC, INTRADAY, MARGIN
    price: float = 0.0
    trigger_price: float = 0.0
    disclosed_qty: int = 0
    validity: str = "DAY"
    tag: str = ""
    
    def to_dict(self):
        return {
            "symbol": self.symbol,
            "exchange": self.exchange,
            "transaction_type": self.transaction_type,
            "quantity": self.quantity,
            "order_type": self.order_type,
            "product_type": self.product_type,
            "price": self.price,
            "trigger_price": self.trigger_price,
            "disclosed_qty": self.disclosed_qty,
            "validity": self.validity,
            "tag": self.tag
        }


@dataclass
class OrderResponse:
    """Unified order response"""
    success: bool
    order_id: str = ""
    message: str = ""
    status: str = ""
    broker: str = ""
    raw_response: Dict = field(default_factory=dict)


class BaseBroker:
    """Base class for broker implementations"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self._rate_limit_delay = 0.5
        self._last_request_time = 0
        
    async def init_session(self):
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session
    
    async def close_session(self):
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def _rate_limit(self):
        import time
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        if elapsed < self._rate_limit_delay:
            await asyncio.sleep(self._rate_limit_delay - elapsed)
        self._last_request_time = time.time()
    
    async def place_order(self, order: OrderRequest) -> OrderResponse:
        raise NotImplementedError
    
    async def modify_order(self, order_id: str, **kwargs) -> OrderResponse:
        raise NotImplementedError
    
    async def cancel_order(self, order_id: str) -> OrderResponse:
        raise NotImplementedError
    
    async def get_order_status(self, order_id: str) -> Dict:
        raise NotImplementedError
    
    async def get_positions(self) -> List[Dict]:
        raise NotImplementedError
    
    async def get_holdings(self) -> List[Dict]:
        raise NotImplementedError
    
    async def get_funds(self) -> Dict:
        raise NotImplementedError


class DhanBroker(BaseBroker):
    """
    Dhan Trading API Integration
    
    API Documentation: https://dhanhq.co/docs/v2/
    
    Setup Instructions:
    1. Login to Dhan (https://web.dhan.co)
    2. Go to Profile > API Access
    3. Generate API Key (Access Token)
    4. Note down Client ID and Access Token
    5. Store in environment variables:
       - DHAN_CLIENT_ID
       - DHAN_ACCESS_TOKEN
    
    Rate Limits:
    - 25 orders per second
    - 1000 data API calls per second
    
    Segments:
    - NSE_EQ: Equity
    - NSE_FNO: F&O
    - BSE_EQ: BSE Equity
    - MCX_COMM: Commodities
    """
    
    BASE_URL = "https://api.dhan.co/v2"
    
    # Exchange segment mapping
    EXCHANGE_MAP = {
        "NSE": "NSE_EQ",
        "BSE": "BSE_EQ",
        "NFO": "NSE_FNO",
        "MCX": "MCX_COMM"
    }
    
    # Product type mapping
    PRODUCT_MAP = {
        "CNC": "CNC",
        "INTRADAY": "INTRADAY",
        "MARGIN": "MARGIN"
    }
    
    # Order type mapping
    ORDER_TYPE_MAP = {
        "MARKET": "MARKET",
        "LIMIT": "LIMIT",
        "SL": "SL",
        "SL-M": "SL-M"
    }
    
    def __init__(self, client_id: str = None, access_token: str = None):
        super().__init__()
        self.client_id = client_id or os.environ.get('DHAN_CLIENT_ID', '')
        self.access_token = access_token or os.environ.get('DHAN_ACCESS_TOKEN', '')
        self._rate_limit_delay = 0.04  # 25 orders/sec
        
    def is_configured(self) -> bool:
        return bool(self.client_id and self.access_token)
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def place_order(self, order: OrderRequest) -> OrderResponse:
        """
        Place order on Dhan
        
        API: POST /orders
        """
        if not self.is_configured():
            return OrderResponse(
                success=False,
                message="Dhan API credentials not configured"
            )
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            payload = {
                "dhanClientId": self.client_id,
                "transactionType": order.transaction_type,
                "exchangeSegment": self.EXCHANGE_MAP.get(order.exchange, "NSE_FNO"),
                "productType": self.PRODUCT_MAP.get(order.product_type, "MARGIN"),
                "orderType": self.ORDER_TYPE_MAP.get(order.order_type, "LIMIT"),
                "validity": order.validity,
                "tradingSymbol": order.symbol,
                "securityId": order.symbol,  # Would need to map symbol to security ID
                "quantity": order.quantity,
                "price": order.price,
                "triggerPrice": order.trigger_price,
                "disclosedQuantity": order.disclosed_qty,
                "afterMarketOrder": False,
                "amoTime": "",
                "boProfitValue": 0,
                "boStopLossValue": 0,
                "correlationId": order.tag or f"DN_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            }
            
            async with self.session.post(
                f"{self.BASE_URL}/orders",
                json=payload,
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if response.status == 200 and data.get("status") == "success":
                    return OrderResponse(
                        success=True,
                        order_id=data.get("data", {}).get("orderId", ""),
                        message="Order placed successfully",
                        status="PLACED",
                        broker="dhan",
                        raw_response=data
                    )
                else:
                    return OrderResponse(
                        success=False,
                        message=data.get("message", f"Order failed: {response.status}"),
                        broker="dhan",
                        raw_response=data
                    )
                    
        except Exception as e:
            logger.error(f"Dhan order placement error: {e}")
            return OrderResponse(
                success=False,
                message=str(e),
                broker="dhan"
            )
    
    async def modify_order(
        self, 
        order_id: str, 
        quantity: int = None,
        price: float = None,
        trigger_price: float = None,
        order_type: str = None,
        validity: str = None
    ) -> OrderResponse:
        """Modify existing order on Dhan"""
        if not self.is_configured():
            return OrderResponse(success=False, message="Not configured")
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            payload = {
                "dhanClientId": self.client_id,
                "orderId": order_id
            }
            
            if quantity is not None:
                payload["quantity"] = quantity
            if price is not None:
                payload["price"] = price
            if trigger_price is not None:
                payload["triggerPrice"] = trigger_price
            if order_type is not None:
                payload["orderType"] = self.ORDER_TYPE_MAP.get(order_type, order_type)
            if validity is not None:
                payload["validity"] = validity
            
            async with self.session.put(
                f"{self.BASE_URL}/orders/{order_id}",
                json=payload,
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                return OrderResponse(
                    success=response.status == 200,
                    order_id=order_id,
                    message=data.get("message", "Order modified"),
                    broker="dhan",
                    raw_response=data
                )
                
        except Exception as e:
            logger.error(f"Dhan order modify error: {e}")
            return OrderResponse(success=False, message=str(e), broker="dhan")
    
    async def cancel_order(self, order_id: str) -> OrderResponse:
        """Cancel order on Dhan"""
        if not self.is_configured():
            return OrderResponse(success=False, message="Not configured")
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.delete(
                f"{self.BASE_URL}/orders/{order_id}",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                return OrderResponse(
                    success=response.status == 200,
                    order_id=order_id,
                    message=data.get("message", "Order cancelled"),
                    broker="dhan",
                    raw_response=data
                )
                
        except Exception as e:
            logger.error(f"Dhan order cancel error: {e}")
            return OrderResponse(success=False, message=str(e), broker="dhan")
    
    async def get_order_status(self, order_id: str) -> Dict:
        """Get order status from Dhan"""
        if not self.is_configured():
            return {"status": "error", "message": "Not configured"}
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/orders/{order_id}",
                headers=self._get_headers()
            ) as response:
                return await response.json()
                
        except Exception as e:
            logger.error(f"Dhan order status error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_positions(self) -> List[Dict]:
        """Get all positions from Dhan"""
        if not self.is_configured():
            return []
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/positions",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                return data.get("data", []) if data.get("status") == "success" else []
                
        except Exception as e:
            logger.error(f"Dhan positions error: {e}")
            return []
    
    async def get_holdings(self) -> List[Dict]:
        """Get holdings from Dhan"""
        if not self.is_configured():
            return []
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/holdings",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                return data.get("data", []) if data.get("status") == "success" else []
                
        except Exception as e:
            logger.error(f"Dhan holdings error: {e}")
            return []
    
    async def get_funds(self) -> Dict:
        """Get fund/margin details from Dhan"""
        if not self.is_configured():
            return {"available": 0, "used": 0}
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/fundlimit",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if data.get("status") == "success":
                    fund_data = data.get("data", {})
                    return {
                        "available": fund_data.get("availabelBalance", 0),
                        "used": fund_data.get("utilizedAmount", 0),
                        "total": fund_data.get("sodLimit", 0),
                        "collateral": fund_data.get("collateralAmount", 0),
                        "raw": fund_data
                    }
                return {"available": 0, "used": 0}
                
        except Exception as e:
            logger.error(f"Dhan funds error: {e}")
            return {"available": 0, "used": 0}
    
    async def get_ltp(self, instruments: Dict[str, List[int]]) -> Dict:
        """Get LTP for instruments"""
        if not self.is_configured():
            return {"status": "error", "message": "Not configured"}
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.post(
                f"{self.BASE_URL}/marketfeed/ltp",
                json=instruments,
                headers=self._get_headers()
            ) as response:
                return await response.json()
                
        except Exception as e:
            logger.error(f"Dhan LTP error: {e}")
            return {"status": "error", "message": str(e)}


class UpstoxBroker(BaseBroker):
    """
    Upstox Trading API Integration
    
    API Documentation: https://upstox.com/developer/api-documentation/
    
    Setup Instructions:
    1. Login to Upstox Developer Portal (https://developer.upstox.com)
    2. Create a new app to get API Key and Secret
    3. Setup redirect URL for OAuth authentication
    4. Generate access token via OAuth flow
    5. Store in environment variables:
       - UPSTOX_API_KEY
       - UPSTOX_API_SECRET
       - UPSTOX_ACCESS_TOKEN
       - UPSTOX_REDIRECT_URI
    
    OAuth Flow:
    1. User clicks login button -> redirects to Upstox login page
    2. User authorizes app -> redirected back with auth code
    3. Exchange auth code for access token
    4. Token is valid for 1 day (refresh daily)
    
    Rate Limits:
    - 10 orders per second
    - 25 requests per second for data APIs
    """
    
    BASE_URL = "https://api.upstox.com/v2"
    AUTH_URL = "https://api.upstox.com/v2/login/authorization/dialog"
    TOKEN_URL = "https://api.upstox.com/v2/login/authorization/token"
    
    # Exchange mapping
    EXCHANGE_MAP = {
        "NSE": "NSE_EQ",
        "BSE": "BSE_EQ",
        "NFO": "NSE_FO",
        "MCX": "MCX_FO"
    }
    
    # Product type mapping
    PRODUCT_MAP = {
        "CNC": "D",      # Delivery
        "INTRADAY": "I", # Intraday
        "MARGIN": "D"    # F&O uses D (Delivery)
    }
    
    # Order type mapping
    ORDER_TYPE_MAP = {
        "MARKET": "MARKET",
        "LIMIT": "LIMIT",
        "SL": "SL",
        "SL-M": "SL-M"
    }
    
    def __init__(
        self, 
        api_key: str = None, 
        api_secret: str = None,
        access_token: str = None,
        redirect_uri: str = None
    ):
        super().__init__()
        self.api_key = api_key or os.environ.get('UPSTOX_API_KEY', '')
        self.api_secret = api_secret or os.environ.get('UPSTOX_API_SECRET', '')
        self.access_token = access_token or os.environ.get('UPSTOX_ACCESS_TOKEN', '')
        self.redirect_uri = redirect_uri or os.environ.get('UPSTOX_REDIRECT_URI', '')
        self._rate_limit_delay = 0.1  # 10 orders/sec
        
    def is_configured(self) -> bool:
        return bool(self.api_key and self.access_token)
    
    def get_login_url(self) -> str:
        """Get OAuth login URL for user authorization"""
        return (
            f"{self.AUTH_URL}?"
            f"client_id={self.api_key}&"
            f"redirect_uri={self.redirect_uri}&"
            f"response_type=code"
        )
    
    async def exchange_code_for_token(self, auth_code: str) -> Dict:
        """Exchange authorization code for access token"""
        await self.init_session()
        
        try:
            payload = {
                "code": auth_code,
                "client_id": self.api_key,
                "client_secret": self.api_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code"
            }
            
            async with self.session.post(
                self.TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            ) as response:
                data = await response.json()
                
                if response.status == 200:
                    self.access_token = data.get("access_token", "")
                    return {
                        "success": True,
                        "access_token": self.access_token,
                        "expires_in": data.get("expires_in")
                    }
                else:
                    return {
                        "success": False,
                        "message": data.get("message", "Token exchange failed")
                    }
                    
        except Exception as e:
            logger.error(f"Upstox token exchange error: {e}")
            return {"success": False, "message": str(e)}
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def place_order(self, order: OrderRequest) -> OrderResponse:
        """
        Place order on Upstox
        
        API: POST /order/place
        """
        if not self.is_configured():
            return OrderResponse(
                success=False,
                message="Upstox API credentials not configured. Complete OAuth login first."
            )
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            # Construct instrument key (e.g., NSE_FO|NIFTY24JAN25000CE)
            instrument_key = f"{self.EXCHANGE_MAP.get(order.exchange, 'NSE_FO')}|{order.symbol}"
            
            payload = {
                "quantity": order.quantity,
                "product": self.PRODUCT_MAP.get(order.product_type, "D"),
                "validity": order.validity,
                "price": order.price,
                "tag": order.tag or f"DN_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "instrument_token": instrument_key,
                "order_type": self.ORDER_TYPE_MAP.get(order.order_type, "LIMIT"),
                "transaction_type": order.transaction_type,
                "disclosed_quantity": order.disclosed_qty,
                "trigger_price": order.trigger_price,
                "is_amo": False
            }
            
            async with self.session.post(
                f"{self.BASE_URL}/order/place",
                json=payload,
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if response.status == 200 and data.get("status") == "success":
                    return OrderResponse(
                        success=True,
                        order_id=data.get("data", {}).get("order_id", ""),
                        message="Order placed successfully",
                        status="PLACED",
                        broker="upstox",
                        raw_response=data
                    )
                else:
                    return OrderResponse(
                        success=False,
                        message=data.get("message", f"Order failed: {response.status}"),
                        broker="upstox",
                        raw_response=data
                    )
                    
        except Exception as e:
            logger.error(f"Upstox order placement error: {e}")
            return OrderResponse(
                success=False,
                message=str(e),
                broker="upstox"
            )
    
    async def modify_order(
        self, 
        order_id: str, 
        quantity: int = None,
        price: float = None,
        trigger_price: float = None,
        order_type: str = None,
        validity: str = None
    ) -> OrderResponse:
        """Modify existing order on Upstox"""
        if not self.is_configured():
            return OrderResponse(success=False, message="Not configured")
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            payload = {"order_id": order_id}
            
            if quantity is not None:
                payload["quantity"] = quantity
            if price is not None:
                payload["price"] = price
            if trigger_price is not None:
                payload["trigger_price"] = trigger_price
            if order_type is not None:
                payload["order_type"] = self.ORDER_TYPE_MAP.get(order_type, order_type)
            if validity is not None:
                payload["validity"] = validity
            
            async with self.session.put(
                f"{self.BASE_URL}/order/modify",
                json=payload,
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                return OrderResponse(
                    success=response.status == 200,
                    order_id=order_id,
                    message=data.get("message", "Order modified"),
                    broker="upstox",
                    raw_response=data
                )
                
        except Exception as e:
            logger.error(f"Upstox order modify error: {e}")
            return OrderResponse(success=False, message=str(e), broker="upstox")
    
    async def cancel_order(self, order_id: str) -> OrderResponse:
        """Cancel order on Upstox"""
        if not self.is_configured():
            return OrderResponse(success=False, message="Not configured")
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.delete(
                f"{self.BASE_URL}/order/cancel?order_id={order_id}",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                return OrderResponse(
                    success=response.status == 200,
                    order_id=order_id,
                    message=data.get("message", "Order cancelled"),
                    broker="upstox",
                    raw_response=data
                )
                
        except Exception as e:
            logger.error(f"Upstox order cancel error: {e}")
            return OrderResponse(success=False, message=str(e), broker="upstox")
    
    async def get_order_status(self, order_id: str) -> Dict:
        """Get order details from Upstox"""
        if not self.is_configured():
            return {"status": "error", "message": "Not configured"}
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/order/details?order_id={order_id}",
                headers=self._get_headers()
            ) as response:
                return await response.json()
                
        except Exception as e:
            logger.error(f"Upstox order status error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_positions(self) -> List[Dict]:
        """Get positions from Upstox"""
        if not self.is_configured():
            return []
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/portfolio/short-term-positions",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                return data.get("data", []) if data.get("status") == "success" else []
                
        except Exception as e:
            logger.error(f"Upstox positions error: {e}")
            return []
    
    async def get_holdings(self) -> List[Dict]:
        """Get holdings from Upstox"""
        if not self.is_configured():
            return []
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/portfolio/long-term-holdings",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                return data.get("data", []) if data.get("status") == "success" else []
                
        except Exception as e:
            logger.error(f"Upstox holdings error: {e}")
            return []
    
    async def get_funds(self) -> Dict:
        """Get fund/margin details from Upstox"""
        if not self.is_configured():
            return {"available": 0, "used": 0}
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            async with self.session.get(
                f"{self.BASE_URL}/user/get-funds-and-margin",
                headers=self._get_headers()
            ) as response:
                data = await response.json()
                
                if data.get("status") == "success":
                    equity = data.get("data", {}).get("equity", {})
                    return {
                        "available": equity.get("available_margin", 0),
                        "used": equity.get("used_margin", 0),
                        "total": equity.get("available_margin", 0) + equity.get("used_margin", 0),
                        "collateral": equity.get("collateral", 0),
                        "raw": data.get("data", {})
                    }
                return {"available": 0, "used": 0}
                
        except Exception as e:
            logger.error(f"Upstox funds error: {e}")
            return {"available": 0, "used": 0}
    
    async def get_ltp(self, instruments: List[str]) -> Dict:
        """
        Get LTP for instruments
        
        instruments: List of instrument keys like ["NSE_FO|NIFTY24JAN25000CE"]
        """
        if not self.is_configured():
            return {"status": "error", "message": "Not configured"}
        
        await self.init_session()
        await self._rate_limit()
        
        try:
            instrument_str = ",".join(instruments)
            async with self.session.get(
                f"{self.BASE_URL}/market-quote/ltp?instrument_key={instrument_str}",
                headers=self._get_headers()
            ) as response:
                return await response.json()
                
        except Exception as e:
            logger.error(f"Upstox LTP error: {e}")
            return {"status": "error", "message": str(e)}


class BrokerManager:
    """
    Unified broker management
    Handles broker selection, credential storage, and API calls
    """
    
    def __init__(self):
        self.brokers: Dict[str, BaseBroker] = {}
        self.active_broker: str = "dhan"
        self._credentials: Dict[str, Dict] = {}
        self._load_credentials()
    
    def _load_credentials(self):
        """Load broker credentials from environment or storage"""
        # Dhan
        if os.environ.get('DHAN_CLIENT_ID') and os.environ.get('DHAN_ACCESS_TOKEN'):
            self._credentials["dhan"] = {
                "client_id": os.environ.get('DHAN_CLIENT_ID'),
                "access_token": os.environ.get('DHAN_ACCESS_TOKEN')
            }
            self.brokers["dhan"] = DhanBroker(
                client_id=self._credentials["dhan"]["client_id"],
                access_token=self._credentials["dhan"]["access_token"]
            )
        
        # Upstox
        if os.environ.get('UPSTOX_API_KEY'):
            self._credentials["upstox"] = {
                "api_key": os.environ.get('UPSTOX_API_KEY'),
                "api_secret": os.environ.get('UPSTOX_API_SECRET', ''),
                "access_token": os.environ.get('UPSTOX_ACCESS_TOKEN', ''),
                "redirect_uri": os.environ.get('UPSTOX_REDIRECT_URI', '')
            }
            self.brokers["upstox"] = UpstoxBroker(
                api_key=self._credentials["upstox"]["api_key"],
                api_secret=self._credentials["upstox"]["api_secret"],
                access_token=self._credentials["upstox"]["access_token"],
                redirect_uri=self._credentials["upstox"]["redirect_uri"]
            )
    
    def configure_broker(self, broker: str, credentials: Dict) -> bool:
        """Configure broker with credentials"""
        if broker == "dhan":
            self._credentials["dhan"] = credentials
            self.brokers["dhan"] = DhanBroker(
                client_id=credentials.get("client_id"),
                access_token=credentials.get("access_token")
            )
            return True
        
        elif broker == "upstox":
            self._credentials["upstox"] = credentials
            self.brokers["upstox"] = UpstoxBroker(
                api_key=credentials.get("api_key"),
                api_secret=credentials.get("api_secret"),
                access_token=credentials.get("access_token"),
                redirect_uri=credentials.get("redirect_uri")
            )
            return True
        
        return False
    
    def get_broker(self, broker: str = None) -> Optional[BaseBroker]:
        """Get broker instance"""
        broker_name = broker or self.active_broker
        return self.brokers.get(broker_name)
    
    def set_active_broker(self, broker: str):
        """Set active broker"""
        if broker in self.brokers:
            self.active_broker = broker
    
    def is_broker_configured(self, broker: str) -> bool:
        """Check if broker is configured"""
        return broker in self.brokers and self.brokers[broker].is_configured()
    
    def get_configured_brokers(self) -> List[str]:
        """Get list of configured brokers"""
        return [b for b in self.brokers if self.brokers[b].is_configured()]
    
    def get_broker_status(self) -> Dict:
        """Get status of all brokers"""
        return {
            "active_broker": self.active_broker,
            "brokers": {
                "dhan": {
                    "configured": self.is_broker_configured("dhan"),
                    "has_credentials": "dhan" in self._credentials
                },
                "upstox": {
                    "configured": self.is_broker_configured("upstox"),
                    "has_credentials": "upstox" in self._credentials,
                    "needs_oauth": "upstox" in self._credentials and not self._credentials.get("upstox", {}).get("access_token")
                }
            }
        }


# Singleton instance
_broker_manager: Optional[BrokerManager] = None


def get_broker_manager() -> BrokerManager:
    """Get or create broker manager singleton"""
    global _broker_manager
    if _broker_manager is None:
        _broker_manager = BrokerManager()
    return _broker_manager
