# backend/services/upstox_service.py
"""
Upstox API Service
OAuth authentication and trading account data
"""

import httpx
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Upstox API Configuration
UPSTOX_BASE_URL = "https://api.upstox.com/v2"
UPSTOX_AUTH_URL = "https://api.upstox.com/v2/login/authorization/dialog"
UPSTOX_TOKEN_URL = "https://api.upstox.com/v2/login/authorization/token"

# Get from environment (user needs to set these)
UPSTOX_API_KEY = os.getenv("UPSTOX_API_KEY", "")
UPSTOX_API_SECRET = os.getenv("UPSTOX_API_SECRET", "")
UPSTOX_REDIRECT_URI = os.getenv("UPSTOX_REDIRECT_URI", "https://moneysaarthi.in/auth/upstox/callback")


class UpstoxAPIError(Exception):
    """Custom exception for Upstox API errors"""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class UpstoxService:
    """
    Upstox API Service for fetching account and market data
    """
    
    def __init__(self, access_token: str = None):
        self.access_token = access_token
        self.base_url = UPSTOX_BASE_URL
        self.client = None
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API request headers"""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }
    
    async def _ensure_client(self):
        """Ensure HTTP client is initialized"""
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=30.0)
    
    async def _make_request(self, method: str, endpoint: str, data: dict = None) -> Dict[str, Any]:
        """Make API request with error handling"""
        await self._ensure_client()
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == "GET":
                response = await self.client.get(url, headers=self._get_headers())
            else:
                response = await self.client.post(url, headers=self._get_headers(), json=data)
            
            result = response.json()
            
            if response.status_code == 200:
                return result
            else:
                raise UpstoxAPIError(
                    f"API request failed: {result.get('message', response.text)}",
                    status_code=response.status_code,
                    response=result
                )
        except httpx.RequestError as e:
            raise UpstoxAPIError(f"Network error: {str(e)}")
    
    # ========================================
    # OAUTH AUTHENTICATION
    # ========================================
    
    @staticmethod
    def get_auth_url(api_key: str = None, redirect_uri: str = None) -> str:
        """
        Get Upstox OAuth authorization URL
        User needs to visit this URL to login and authorize
        """
        key = api_key or UPSTOX_API_KEY
        redirect = redirect_uri or UPSTOX_REDIRECT_URI
        
        if not key:
            raise UpstoxAPIError("UPSTOX_API_KEY not configured")
        
        return (
            f"{UPSTOX_AUTH_URL}"
            f"?client_id={key}"
            f"&redirect_uri={redirect}"
            f"&response_type=code"
        )
    
    @staticmethod
    async def exchange_code_for_token(
        auth_code: str,
        api_key: str = None,
        api_secret: str = None,
        redirect_uri: str = None
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        """
        key = api_key or UPSTOX_API_KEY
        secret = api_secret or UPSTOX_API_SECRET
        redirect = redirect_uri or UPSTOX_REDIRECT_URI
        
        if not key or not secret:
            raise UpstoxAPIError("UPSTOX_API_KEY or UPSTOX_API_SECRET not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                UPSTOX_TOKEN_URL,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                data={
                    "code": auth_code,
                    "client_id": key,
                    "client_secret": secret,
                    "redirect_uri": redirect,
                    "grant_type": "authorization_code"
                }
            )
            
            result = response.json()
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "access_token": result.get("access_token"),
                    "expires_in": result.get("expires_in"),
                    "token_type": result.get("token_type"),
                    "user_id": result.get("user_id"),
                    "user_name": result.get("user_name"),
                    "email": result.get("email")
                }
            else:
                return {
                    "success": False,
                    "error": result.get("message", "Token exchange failed"),
                    "details": result
                }
    
    # ========================================
    # USER PROFILE
    # ========================================
    
    async def get_profile(self) -> Dict[str, Any]:
        """
        Get user profile details
        """
        try:
            result = await self._make_request("GET", "/user/profile")
            data = result.get("data", {})
            
            return {
                "success": True,
                "data": {
                    "user_id": data.get("user_id"),
                    "user_name": data.get("user_name"),
                    "email": data.get("email"),
                    "broker": data.get("broker"),
                    "exchanges": data.get("exchanges", []),
                    "products": data.get("products", []),
                    "order_types": data.get("order_types", [])
                }
            }
        except Exception as e:
            logger.error(f"Error fetching profile: {e}")
            return {"success": False, "error": str(e)}
    
    # ========================================
    # ACCOUNT & FUND ENDPOINTS
    # ========================================
    
    async def get_fund_limits(self) -> Dict[str, Any]:
        """
        Get fund limits and margin available
        Upstox API: GET /user/get-funds-and-margin
        """
        try:
            result = await self._make_request("GET", "/user/get-funds-and-margin")
            data = result.get("data", {})
            
            # Upstox returns equity and commodity separately
            equity = data.get("equity", {})
            commodity = data.get("commodity", {})
            
            available = float(equity.get("available_margin", 0) or 0)
            utilized = float(equity.get("used_margin", 0) or 0)
            collateral = float(equity.get("collateral", 0) or 0)
            
            logger.info(f"Upstox funds: available={available}, utilized={utilized}")
            
            return {
                "success": True,
                "data": {
                    "available_balance": available,
                    "utilized_amount": utilized,
                    "collateral": collateral,
                    "total_available": available + collateral,
                    "equity": equity,
                    "commodity": commodity,
                    "raw": data
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
        Upstox API: GET /portfolio/short-term-positions
        """
        try:
            result = await self._make_request("GET", "/portfolio/short-term-positions")
            positions = result.get("data", []) or []
            
            total_pnl = sum(float(p.get("pnl", 0) or 0) for p in positions)
            
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
        Upstox API: GET /portfolio/long-term-holdings
        """
        try:
            result = await self._make_request("GET", "/portfolio/long-term-holdings")
            holdings = result.get("data", []) or []
            
            total_value = sum(
                float(h.get("quantity", 0) or 0) * float(h.get("last_price", 0) or 0) 
                for h in holdings
            )
            total_investment = sum(
                float(h.get("quantity", 0) or 0) * float(h.get("average_price", 0) or 0) 
                for h in holdings
            )
            total_pnl = total_value - total_investment
            
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
        """
        try:
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
            return {"success": False, "error": str(e)}
    
    # ========================================
    # ORDER ENDPOINTS
    # ========================================
    
    async def get_orders(self) -> Dict[str, Any]:
        """
        Get today's orders
        Upstox API: GET /order/retrieve-all
        """
        try:
            result = await self._make_request("GET", "/order/retrieve-all")
            orders = result.get("data", []) or []
            
            return {
                "success": True,
                "data": {
                    "orders": orders,
                    "total_orders": len(orders)
                }
            }
        except Exception as e:
            logger.error(f"Error fetching orders: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"orders": [], "total_orders": 0}
            }
    
    async def get_trades(self) -> Dict[str, Any]:
        """
        Get today's trades
        Upstox API: GET /order/trades/get-trades-for-day
        """
        try:
            result = await self._make_request("GET", "/order/trades/get-trades-for-day")
            trades = result.get("data", []) or []
            
            return {
                "success": True,
                "data": {
                    "trades": trades,
                    "total_trades": len(trades)
                }
            }
        except Exception as e:
            logger.error(f"Error fetching trades: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"trades": [], "total_trades": 0}
            }

    # ========================================
    # ORDER PLACEMENT - ACTUAL TRADING!
    # ========================================
    
    async def place_order(
        self,
        instrument_token: str,
        transaction_type: str,  # BUY or SELL
        quantity: int,
        order_type: str = "MARKET",  # MARKET, LIMIT, SL, SL-M
        product: str = "I",  # I=Intraday, D=Delivery, CO, OCO
        price: float = 0,
        trigger_price: float = 0,
        validity: str = "DAY",
        disclosed_quantity: int = 0,
        is_amo: bool = False
    ) -> Dict[str, Any]:
        """
        Place an order via Upstox API
        
        Upstox Order API: https://upstox.com/developer/api-documentation/place-order
        
        Args:
            instrument_token: Trading symbol (e.g., "NSE_FO|NIFTY24FEB24500CE")
            transaction_type: "BUY" or "SELL"
            quantity: Number of shares/lots
            order_type: "MARKET", "LIMIT", "SL", "SL-M"
            product: "I" (Intraday), "D" (Delivery), "CO", "OCO"
            price: Limit price (for LIMIT orders)
            trigger_price: Trigger price (for SL orders)
            validity: "DAY" or "IOC"
            disclosed_quantity: Disclosed quantity
            is_amo: After market order
            
        Returns:
            Order response with order_id
        """
        logger.info(f"🔥 UPSTOX PLACE ORDER: {transaction_type} {quantity} x {instrument_token}")
        
        try:
            order_data = {
                "quantity": quantity,
                "product": product,
                "validity": validity,
                "price": price,
                "tag": "MoneySaarthi",
                "instrument_token": instrument_token,
                "order_type": order_type,
                "transaction_type": transaction_type,
                "disclosed_quantity": disclosed_quantity,
                "trigger_price": trigger_price,
                "is_amo": is_amo
            }
            
            logger.info(f"📤 Order payload: {order_data}")
            
            await self._ensure_client()
            
            response = await self.client.post(
                f"{self.base_url}/order/place",
                headers=self._get_headers(),
                json=order_data
            )
            
            result = response.json()
            logger.info(f"📥 Upstox response: {result}")
            
            if response.status_code == 200 and result.get("status") == "success":
                order_id = result.get("data", {}).get("order_id", "")
                logger.info(f"✅ ORDER PLACED: {order_id}")
                return {
                    "success": True,
                    "data": {
                        "order_id": order_id,
                        "status": "PENDING",
                        "message": result.get("data", {}).get("message", "Order placed")
                    }
                }
            else:
                error_msg = result.get("message", result.get("errors", [{}])[0].get("message", "Order failed"))
                logger.error(f"❌ ORDER FAILED: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "data": result
                }
                
        except Exception as e:
            logger.error(f"❌ Order placement error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def modify_order(
        self,
        order_id: str,
        quantity: int = None,
        order_type: str = None,
        price: float = None,
        trigger_price: float = None,
        validity: str = "DAY"
    ) -> Dict[str, Any]:
        """
        Modify an existing order
        
        Args:
            order_id: Order ID to modify
            quantity: New quantity (optional)
            order_type: New order type (optional)
            price: New price (optional)
            trigger_price: New trigger price (optional)
            validity: Order validity
            
        Returns:
            Modification result
        """
        logger.info(f"✏️ MODIFY ORDER: {order_id}")
        
        try:
            modify_data = {
                "order_id": order_id,
                "validity": validity
            }
            
            if quantity:
                modify_data["quantity"] = quantity
            if order_type:
                modify_data["order_type"] = order_type
            if price:
                modify_data["price"] = price
            if trigger_price:
                modify_data["trigger_price"] = trigger_price
            
            await self._ensure_client()
            
            response = await self.client.put(
                f"{self.base_url}/order/modify",
                headers=self._get_headers(),
                json=modify_data
            )
            
            result = response.json()
            
            if response.status_code == 200 and result.get("status") == "success":
                logger.info(f"✅ ORDER MODIFIED: {order_id}")
                return {
                    "success": True,
                    "data": result.get("data", {})
                }
            else:
                error_msg = result.get("message", "Modify failed")
                logger.error(f"❌ MODIFY FAILED: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except Exception as e:
            logger.error(f"❌ Modify error: {e}")
            return {"success": False, "error": str(e)}
    
    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """
        Cancel an existing order
        
        Args:
            order_id: Order ID to cancel
            
        Returns:
            Cancellation result
        """
        logger.info(f"🚫 CANCEL ORDER: {order_id}")
        
        try:
            await self._ensure_client()
            
            response = await self.client.delete(
                f"{self.base_url}/order/cancel",
                headers=self._get_headers(),
                params={"order_id": order_id}
            )
            
            result = response.json()
            
            if response.status_code == 200 and result.get("status") == "success":
                logger.info(f"✅ ORDER CANCELLED: {order_id}")
                return {
                    "success": True,
                    "data": {"order_id": order_id, "status": "CANCELLED"}
                }
            else:
                error_msg = result.get("message", "Cancel failed")
                logger.error(f"❌ CANCEL FAILED: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except Exception as e:
            logger.error(f"❌ Cancel error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """
        Get status of a specific order
        
        Args:
            order_id: Order ID to check
            
        Returns:
            Order details and status
        """
        try:
            await self._ensure_client()
            
            response = await self.client.get(
                f"{self.base_url}/order/details",
                headers=self._get_headers(),
                params={"order_id": order_id}
            )
            
            result = response.json()
            
            if response.status_code == 200 and result.get("status") == "success":
                return {
                    "success": True,
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "error": result.get("message", "Status check failed")
                }
                
        except Exception as e:
            logger.error(f"❌ Order status error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_order_book(self) -> Dict[str, Any]:
        """
        Get all orders for today (order book)
        
        Returns:
            List of all orders
        """
        try:
            await self._ensure_client()
            
            response = await self.client.get(
                f"{self.base_url}/order/retrieve-all",
                headers=self._get_headers()
            )
            
            result = response.json()
            
            if response.status_code == 200:
                orders = result.get("data", [])
                return {
                    "success": True,
                    "data": {
                        "orders": orders,
                        "total_orders": len(orders)
                    }
                }
            else:
                return {
                    "success": False,
                    "error": result.get("message", "Failed to fetch orders"),
                    "data": {"orders": [], "total_orders": 0}
                }
                
        except Exception as e:
            logger.error(f"Error fetching order book: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"orders": [], "total_orders": 0}
            }
    
    async def get_trade_book(self) -> Dict[str, Any]:
        """
        Get all executed trades for today
        
        Returns:
            List of all trades
        """
        try:
            await self._ensure_client()
            
            response = await self.client.get(
                f"{self.base_url}/order/trades/get-trades-for-day",
                headers=self._get_headers()
            )
            
            result = response.json()
            
            if response.status_code == 200:
                trades = result.get("data", [])
                return {
                    "success": True,
                    "data": {
                        "trades": trades,
                        "total_trades": len(trades)
                    }
                }
            else:
                return {
                    "success": False,
                    "error": result.get("message", "Failed to fetch trades"),
                    "data": {"trades": [], "total_trades": 0}
                }
                
        except Exception as e:
            logger.error(f"Error fetching trade book: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {"trades": [], "total_trades": 0}
            }
    
    async def get_market_quote(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Get market quotes for symbols
        
        Args:
            symbols: List of instrument tokens
            
        Returns:
            Market quotes with LTP, OHLC, etc.
        """
        try:
            await self._ensure_client()
            
            # Upstox requires symbols as comma-separated string
            symbol_str = ",".join(symbols)
            
            response = await self.client.get(
                f"{self.base_url}/market-quote/quotes",
                headers=self._get_headers(),
                params={"symbol": symbol_str}
            )
            
            result = response.json()
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "data": result.get("data", {})
                }
            else:
                return {
                    "success": False,
                    "error": result.get("message", "Quote fetch failed")
                }
                
        except Exception as e:
            logger.error(f"Error fetching market quote: {e}")
            return {"success": False, "error": str(e)}

    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()
            self.client = None


# Singleton instance
_upstox_service: Optional[UpstoxService] = None

def get_upstox_service() -> UpstoxService:
    """Get singleton Upstox service instance"""
    global _upstox_service
    if _upstox_service is None:
        _upstox_service = UpstoxService()
    return _upstox_service
