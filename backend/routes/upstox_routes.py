# backend/routes/upstox_routes.py
"""
Upstox API Routes
OAuth authentication and account data endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/upstox", tags=["Upstox API"])


# ============================================
# REQUEST MODELS
# ============================================

class UpstoxTokenRequest(BaseModel):
    """Request to exchange auth code for token"""
    auth_code: str = Field(..., description="Authorization code from Upstox OAuth")
    api_key: Optional[str] = Field(None, description="Optional API key override")
    api_secret: Optional[str] = Field(None, description="Optional API secret override")
    redirect_uri: Optional[str] = Field(None, description="Optional redirect URI override")


class UpstoxAccessRequest(BaseModel):
    """Request with user's access token"""
    access_token: str = Field(..., description="User's Upstox access token")


# ============================================
# OAUTH ROUTES
# ============================================

@router.get("/auth/url")
async def get_auth_url(
    api_key: Optional[str] = Query(None, description="Optional API key"),
    redirect_uri: Optional[str] = Query(None, description="Optional redirect URI")
):
    """
    Get Upstox OAuth authorization URL
    User should be redirected to this URL to login
    """
    try:
        from services.upstox_service import UpstoxService
        
        url = UpstoxService.get_auth_url(
            api_key=api_key,
            redirect_uri=redirect_uri
        )
        
        return {
            "success": True,
            "auth_url": url,
            "instructions": "Redirect user to this URL to authenticate with Upstox"
        }
    except Exception as e:
        logger.error(f"Error generating auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/token")
async def exchange_token(request: UpstoxTokenRequest):
    """
    Exchange authorization code for access token
    Call this after user is redirected back with auth code
    """
    try:
        from services.upstox_service import UpstoxService
        
        result = await UpstoxService.exchange_code_for_token(
            auth_code=request.auth_code,
            api_key=request.api_key,
            api_secret=request.api_secret,
            redirect_uri=request.redirect_uri
        )
        
        return result
    except Exception as e:
        logger.error(f"Error exchanging token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ACCOUNT ROUTES
# ============================================

@router.post("/profile")
async def get_profile(request: UpstoxAccessRequest):
    """Get user profile"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_profile()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/funds")
async def get_fund_limits(request: UpstoxAccessRequest):
    """Get fund limits and available margin"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_fund_limits()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching fund limits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/positions")
async def get_positions(request: UpstoxAccessRequest):
    """Get current positions with P&L"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_positions()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/holdings")
async def get_holdings(request: UpstoxAccessRequest):
    """Get holdings (stocks in demat)"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_holdings()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching holdings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/summary")
async def get_account_summary(request: UpstoxAccessRequest):
    """Get complete account summary - funds, positions, holdings"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_account_summary()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching account summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders")
async def get_orders(request: UpstoxAccessRequest):
    """Get today's orders"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_orders()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trades")
async def get_trades(request: UpstoxAccessRequest):
    """Get today's trades"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        result = await upstox.get_trades()
        await upstox.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ORDER PLACEMENT ROUTES - ACTUAL TRADING!
# ============================================

class PlaceOrderRequest(BaseModel):
    """Request to place an order"""
    access_token: str = Field(..., description="Upstox access token")
    instrument_token: str = Field(..., description="Instrument token (e.g., NSE_FO|NIFTY24500CE)")
    transaction_type: str = Field(..., description="BUY or SELL")
    quantity: int = Field(..., description="Order quantity")
    order_type: str = Field(default="MARKET", description="MARKET, LIMIT, SL, SL-M")
    product: str = Field(default="I", description="I=Intraday, D=Delivery")
    price: float = Field(default=0, description="Price for LIMIT orders")
    trigger_price: float = Field(default=0, description="Trigger price for SL orders")
    validity: str = Field(default="DAY", description="DAY or IOC")


class ModifyOrderRequest(BaseModel):
    """Request to modify an order"""
    access_token: str = Field(...)
    order_id: str = Field(..., description="Order ID to modify")
    quantity: Optional[int] = None
    order_type: Optional[str] = None
    price: Optional[float] = None
    trigger_price: Optional[float] = None


class CancelOrderRequest(BaseModel):
    """Request to cancel an order"""
    access_token: str = Field(...)
    order_id: str = Field(..., description="Order ID to cancel")


@router.post("/orders/place")
async def place_order(request: PlaceOrderRequest):
    """
    Place a new order via Upstox
    
    This ACTUALLY places an order with your broker!
    Make sure you understand the risks.
    """
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        result = await upstox.place_order(
            instrument_token=request.instrument_token,
            transaction_type=request.transaction_type,
            quantity=request.quantity,
            order_type=request.order_type,
            product=request.product,
            price=request.price,
            trigger_price=request.trigger_price,
            validity=request.validity
        )
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Order placement error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/orders/modify")
async def modify_order(request: ModifyOrderRequest):
    """Modify an existing order"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        result = await upstox.modify_order(
            order_id=request.order_id,
            quantity=request.quantity,
            order_type=request.order_type,
            price=request.price,
            trigger_price=request.trigger_price
        )
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Order modify error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/cancel")
async def cancel_order(request: CancelOrderRequest):
    """Cancel an existing order"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        result = await upstox.cancel_order(order_id=request.order_id)
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Order cancel error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/status")
async def get_order_status(
    request: UpstoxAccessRequest,
    order_id: str = Query(..., description="Order ID")
):
    """Get status of a specific order"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        result = await upstox.get_order_status(order_id=order_id)
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Order status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/book")
async def get_order_book(request: UpstoxAccessRequest):
    """Get all orders for today"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        result = await upstox.get_order_book()
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Order book error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trades/book")
async def get_trade_book(request: UpstoxAccessRequest):
    """Get all executed trades for today"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        result = await upstox.get_trade_book()
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Trade book error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/market/quote")
async def get_market_quote(
    request: UpstoxAccessRequest,
    symbols: str = Query(..., description="Comma-separated instrument tokens")
):
    """Get market quotes for symbols"""
    try:
        from services.upstox_service import UpstoxService
        upstox = UpstoxService(access_token=request.access_token)
        
        symbol_list = [s.strip() for s in symbols.split(",")]
        result = await upstox.get_market_quote(symbol_list)
        
        await upstox.close()
        return result
        
    except Exception as e:
        logger.error(f"❌ Market quote error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
