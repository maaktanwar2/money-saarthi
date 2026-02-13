# backend/routes/dhan_routes.py
"""
Dhan API Routes
Market data, option chain, and real-time data endpoints
"""

from fastapi import APIRouter, HTTPException, Query, Body, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
import asyncio
import os
import sys

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.dhan_market_data import get_dhan_service
from services.dhan_websocket import get_websocket_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/dhan", tags=["Dhan API"])


# ============================================
# REQUEST MODELS
# ============================================

class QuoteRequest(BaseModel):
    """Market quote request"""
    instruments: Dict[str, List[int]] = Field(
        ...,
        description="Dict with exchange as key, list of security IDs as value",
        example={"NSE_EQ": [1333, 11536], "NSE_FNO": [52973]}
    )


class BatchQuoteRequest(BaseModel):
    """Batch quote request"""
    symbols: List[Dict[str, Any]] = Field(
        ...,
        description="List of symbols with exchange and security_id"
    )
    batch_size: int = Field(default=500, ge=1, le=1000)


class OptionChainRequest(BaseModel):
    """Option chain request"""
    underlying_id: int = Field(..., description="Security ID of underlying")
    expiry_date: str = Field(..., description="Expiry date YYYY-MM-DD")
    exchange: str = Field(default="NSE_FNO")


class LiveOptionChainRequest(BaseModel):
    """Simple option chain request using symbol name"""
    symbol: str = Field(default="NIFTY", description="Symbol name: NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY")
    expiry: Optional[str] = Field(default=None, description="Expiry date YYYY-MM-DD (uses nearest if not provided)")


class HistoricalDataRequest(BaseModel):
    """Historical data request"""
    security_id: int
    exchange: str = Field(default="NSE_EQ")
    from_date: str = Field(..., description="Start date YYYY-MM-DD")
    to_date: str = Field(..., description="End date YYYY-MM-DD")
    interval: str = Field(default="D", description="1, 5, 15, 25, 60, D")


class SubscribeRequest(BaseModel):
    """WebSocket subscription request"""
    instruments: Dict[str, List[int]]
    mode: int = Field(default=2, description="1=LTP, 2=Quote, 3=Full")


# ============================================
# MARKET DATA ENDPOINTS
# ============================================

@router.post("/quote")
async def get_market_quote(request: QuoteRequest):
    """
    Get real-time market quotes for up to 1000 instruments
    
    Returns LTP, OHLC, volume, OI, bid/ask for each instrument
    """
    try:
        dhan = get_dhan_service()
        
        # Fetch directly from API
        result = await dhan.get_market_quote(request.instruments)
        
        if result.get("status") == "success":
            data = result.get("data", {})
            return {
                "status": "success",
                "count": len(data),
                "data": data,
                "timestamp": datetime.now().isoformat()
            }
        
        return {
            "status": result.get("status", "error"),
            "message": result.get("message", "Failed to fetch quotes"),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Quote fetch error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quote/batch")
async def get_batch_quotes(request: BatchQuoteRequest):
    """
    Fetch quotes in batches (handles rate limiting)
    
    Automatically batches requests and respects 1 req/sec rate limit
    """
    try:
        dhan = get_dhan_service()
        
        result = await dhan.batch_quote_fetch(
            symbol_list=request.symbols,
            batch_size=request.batch_size
        )
        
        return {
            "status": "success",
            "count": len(result.get("data", {})),
            "data": result.get("data", {}),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch quote error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/option-chain")
async def get_option_chain(request: OptionChainRequest):
    """
    Get complete option chain with Greeks
    
    Returns strikes, premiums, OI, IV, and Greeks (delta, theta, gamma, vega)
    """
    try:
        dhan = get_dhan_service()
        
        # Fetch directly from API
        result = await dhan.get_option_chain(
            underlying_id=request.underlying_id,
            expiry_date=request.expiry_date,
            exchange=request.exchange
        )
        
        return {
            "status": result.get("status", "error"),
            "data": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Option chain error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/live-option-chain")
async def get_live_option_chain(request: LiveOptionChainRequest):
    """
    Get live option chain with full Greeks - Easy API using symbol name
    
    **Supported Symbols:** NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY
    
    Returns:
    - Underlying spot price
    - All strikes with CE and PE data
    - Greeks: Delta, Gamma, Theta, Vega
    - IV (Implied Volatility)
    - OI (Open Interest) and OI Change
    - Volume
    - Bid/Ask prices
    - PCR (Put-Call Ratio)
    - Max Pain
    
    **Lot Sizes:**
    - NIFTY: 65
    - BANKNIFTY: 15
    - FINNIFTY: 25
    - MIDCPNIFTY: 75
    """
    try:
        from services.dhan_service import DhanService, DhanAPIError
        
        access_token = os.environ.get("DHAN_ACCESS_TOKEN")
        if not access_token:
            raise HTTPException(status_code=500, detail="DHAN_ACCESS_TOKEN not configured")
        
        # Lot sizes for validation
        LOT_SIZES = {
            "NIFTY": 65,
            "BANKNIFTY": 15,
            "FINNIFTY": 25,
            "MIDCPNIFTY": 75
        }
        
        symbol = request.symbol.upper()
        if symbol not in LOT_SIZES:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid symbol. Valid: {list(LOT_SIZES.keys())}"
            )
        
        # Create service and get option chain
        dhan = DhanService(access_token=access_token)
        
        try:
            result = await dhan.get_option_chain(symbol, request.expiry)
        except DhanAPIError as e:
            raise HTTPException(status_code=500, detail=str(e))
        
        # Add lot size info
        result["lot_size"] = LOT_SIZES[symbol]
        result["lot_sizes"] = LOT_SIZES
        
        return {
            "status": "success",
            "symbol": symbol,
            "expiry": result.get("expiry"),
            "spot_price": result.get("underlying_price", 0),
            "lot_size": LOT_SIZES[symbol],
            "strikes": result.get("strikes", []),
            "summary": result.get("summary", {}),
            "timestamp": result.get("timestamp")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Live option chain error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/live-option-chain/{symbol}")
async def get_live_option_chain_simple(
    symbol: str,
    expiry: Optional[str] = Query(default=None, description="Expiry date YYYY-MM-DD")
):
    """
    GET endpoint for live option chain - Easy to test in browser
    
    Example: GET /v2/dhan/live-option-chain/NIFTY
    """
    request = LiveOptionChainRequest(symbol=symbol, expiry=expiry)
    return await get_live_option_chain(request)


@router.get("/expiry-list/{symbol}")
async def get_expiry_list(symbol: str):
    """
    Get available expiry dates for a symbol
    
    Example: GET /v2/dhan/expiry-list/NIFTY
    """
    try:
        from services.dhan_service import DhanService, DhanAPIError
        
        access_token = os.environ.get("DHAN_ACCESS_TOKEN")
        if not access_token:
            raise HTTPException(status_code=500, detail="DHAN_ACCESS_TOKEN not configured")
        
        dhan = DhanService(access_token=access_token)
        
        try:
            expiries = await dhan.get_expiry_list(symbol.upper())
        except DhanAPIError as e:
            raise HTTPException(status_code=500, detail=str(e))
        
        return {
            "status": "success",
            "symbol": symbol.upper(),
            "expiries": expiries,
            "nearest_expiry": expiries[0] if expiries else None,
            "count": len(expiries),
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Expiry list error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/historical")
async def get_historical_data(request: HistoricalDataRequest):
    """
    Get historical OHLCV data
    
    Supports intraday (1, 5, 15, 25, 60 min) and daily candles
    """
    try:
        dhan = get_dhan_service()
        
        result = await dhan.get_historical_data(
            security_id=request.security_id,
            exchange=request.exchange,
            from_date=request.from_date,
            to_date=request.to_date,
            interval=request.interval
        )
        
        return {
            "status": result.get("status", "error"),
            "candles": result.get("candles", []),
            "count": len(result.get("candles", [])),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Historical data error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# WEBSOCKET ENDPOINT
# ============================================

@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time market data streaming
    
    Connect, then send subscribe messages to start receiving ticks
    """
    await websocket.accept()
    ws_service = get_websocket_service()
    
    # Callback to forward ticks to client
    async def forward_tick(tick: Dict):
        try:
            await websocket.send_json(tick)
        except Exception:
            pass
    
    try:
        # Connect to Dhan WebSocket
        connected = await ws_service.connect()
        
        if not connected:
            await websocket.send_json({
                "status": "error",
                "message": "Failed to connect to market data feed"
            })
            await websocket.close()
            return
        
        # Register callback
        ws_service.register_callback(forward_tick)
        
        await websocket.send_json({
            "status": "connected",
            "message": "Connected to market data feed"
        })
        
        # Listen for client messages
        while True:
            try:
                message = await websocket.receive_json()
                
                if message.get("action") == "subscribe":
                    instruments = message.get("instruments", {})
                    mode = message.get("mode", 2)
                    await ws_service.subscribe(instruments, mode)
                    await websocket.send_json({
                        "status": "subscribed",
                        "instruments": instruments
                    })
                    
                elif message.get("action") == "unsubscribe":
                    instruments = message.get("instruments", {})
                    await ws_service.unsubscribe(instruments)
                    await websocket.send_json({
                        "status": "unsubscribed",
                        "instruments": instruments
                    })
                    
                elif message.get("action") == "ping":
                    await websocket.send_json({"status": "pong"})
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
                
    except WebSocketDisconnect:
        logger.info("Client disconnected from WebSocket")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_service.unregister_callback(forward_tick)


# ============================================
# SERVICE STATUS
# ============================================

@router.get("/status")
async def get_service_status():
    """Get Dhan API service status"""
    dhan = get_dhan_service()
    ws_service = get_websocket_service()
    
    return {
        "status": "success",
        "services": {
            "market_data": "configured" if dhan.access_token else "not_configured",
            "websocket": "connected" if ws_service.is_connected else "disconnected"
        },
        "subscribed_symbols": len(ws_service.subscribed_symbols),
        "timestamp": datetime.now().isoformat()
    }


# ============================================
# ACCOUNT & FUNDS ENDPOINTS
# ============================================

class AccountAccessRequest(BaseModel):
    """Request with user's access token"""
    access_token: str = Field(..., description="User's Dhan access token")


@router.post("/account/funds")
async def get_fund_limits(request: AccountAccessRequest):
    """
    Get fund limits and available margin
    
    Returns available balance, utilized amount, collateral
    """
    try:
        from services.dhan_service import DhanService
        logger.info(f"Fetching funds with token: {request.access_token[:10]}...")
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_fund_limits()
        await dhan.close()
        logger.info(f"Fund limits result: {result}")
        return result
    except Exception as e:
        logger.error(f"Error fetching fund limits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/positions")
async def get_positions(request: AccountAccessRequest):
    """
    Get current positions with P&L
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_positions()
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/holdings")
async def get_holdings(request: AccountAccessRequest):
    """
    Get holdings (stocks in demat)
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_holdings()
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching holdings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/account/summary")
async def get_account_summary(request: AccountAccessRequest):
    """
    Get complete account summary - funds, positions, holdings
    
    Returns:
        Complete account overview with portfolio value
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_account_summary()
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching account summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ORDER PLACEMENT ENDPOINTS
# ============================================

class OrderRequest(BaseModel):
    """Order placement request"""
    access_token: str
    security_id: str
    exchange_segment: str = Field(default="NSE_FNO", description="NSE_EQ, NSE_FNO, BSE_EQ")
    transaction_type: str = Field(..., description="BUY or SELL")
    quantity: int = Field(..., gt=0)
    order_type: str = Field(default="MARKET", description="MARKET, LIMIT, SL, SL-M")
    product_type: str = Field(default="INTRADAY", description="INTRADAY, CNC, MARGIN")
    price: float = Field(default=0, description="Price for LIMIT orders")
    trigger_price: float = Field(default=0, description="Trigger price for SL orders")
    validity: str = Field(default="DAY", description="DAY or IOC")


class ModifyOrderRequest(BaseModel):
    """Order modification request"""
    access_token: str
    order_id: str
    order_type: str = Field(default="MARKET")
    quantity: Optional[int] = None
    price: Optional[float] = None
    trigger_price: Optional[float] = None
    validity: str = Field(default="DAY")


class CancelOrderRequest(BaseModel):
    """Order cancellation request"""
    access_token: str
    order_id: str


@router.post("/orders/place")
async def place_order(request: OrderRequest):
    """
    Place a new order via Dhan API
    
    Returns:
        Order ID and status
    """
    try:
        from services.dhan_service import DhanService
        logger.info(f"🔥 Order request: {request.transaction_type} {request.quantity} x {request.security_id}")
        
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.place_order(
            security_id=request.security_id,
            exchange_segment=request.exchange_segment,
            transaction_type=request.transaction_type,
            quantity=request.quantity,
            order_type=request.order_type,
            product_type=request.product_type,
            price=request.price,
            trigger_price=request.trigger_price,
            validity=request.validity
        )
        await dhan.close()
        
        logger.info(f"Order result: {result}")
        return result
    except Exception as e:
        logger.error(f"❌ Order placement error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/orders/modify")
async def modify_order(request: ModifyOrderRequest):
    """
    Modify an existing order
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.modify_order(
            order_id=request.order_id,
            order_type=request.order_type,
            quantity=request.quantity,
            price=request.price,
            trigger_price=request.trigger_price,
            validity=request.validity
        )
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Order modification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/cancel")
async def cancel_order(request: CancelOrderRequest):
    """
    Cancel an existing order
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.cancel_order(order_id=request.order_id)
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Order cancellation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/list")
async def get_orders(request: AccountAccessRequest):
    """
    Get list of all orders for today
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_order_list()
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/orders/status")
async def get_order_status(
    request: AccountAccessRequest,
    order_id: str = Query(..., description="Order ID to check")
):
    """
    Get status of a specific order
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_order_status(order_id=order_id)
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching order status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trades")
async def get_trades(request: AccountAccessRequest):
    """
    Get executed trades for today
    """
    try:
        from services.dhan_service import DhanService
        dhan = DhanService(access_token=request.access_token)
        result = await dhan.get_trade_history()
        await dhan.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# AUTHENTICATION ENDPOINTS (OAuth Flow)
# ============================================

@router.get("/auth/status")
async def get_auth_status():
    """
    Get current authentication status
    
    Shows if token is valid, when it expires, and if OAuth is configured
    """
    try:
        from services.dhan_auth_service import get_dhan_auth_service
        auth = get_dhan_auth_service()
        
        status = auth.get_status()
        
        # Check if current token is valid
        validity = await auth.check_token_validity()
        
        return {
            "status": "success",
            **status,
            "token_valid": validity.get("valid", False),
            "validity_details": validity,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Auth status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/generate-login-url")
async def generate_login_url():
    """
    Generate Dhan OAuth login URL
    
    Step 1 of OAuth flow:
    1. Generate consent ID
    2. Return login URL for user to open in browser
    3. After login, user gets redirected with tokenId
    """
    try:
        from services.dhan_auth_service import get_dhan_auth_service
        auth = get_dhan_auth_service()
        
        if not auth.app_id or not auth.app_secret:
            raise HTTPException(
                status_code=400, 
                detail="OAuth not configured. Set DHAN_APP_ID and DHAN_APP_SECRET"
            )
        
        consent_id = await auth.generate_consent()
        
        if not consent_id:
            raise HTTPException(status_code=500, detail="Failed to generate consent")
        
        login_url = auth.get_login_url(consent_id)
        
        return {
            "status": "success",
            "consent_id": consent_id,
            "login_url": login_url,
            "instructions": [
                "1. Open the login_url in your browser",
                "2. Login with your Dhan credentials",
                "3. After login, you'll be redirected to your callback URL with tokenId",
                "4. Use that tokenId in the /auth/exchange-token endpoint"
            ],
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate login URL error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ExchangeTokenRequest(BaseModel):
    """Token exchange request"""
    token_id: str = Field(..., description="Token ID from OAuth redirect")


@router.post("/auth/exchange-token")
async def exchange_token(request: ExchangeTokenRequest):
    """
    Exchange tokenId for access token
    
    Step 2 of OAuth flow:
    After user logs in via browser and gets tokenId from redirect,
    exchange it for an access token (valid 24 hours)
    """
    try:
        from services.dhan_auth_service import get_dhan_auth_service
        auth = get_dhan_auth_service()
        
        result = await auth.consume_consent(request.token_id)
        
        if not result:
            raise HTTPException(status_code=400, detail="Failed to exchange token")
        
        return {
            "status": "success",
            "client_id": result.get("dhanClientId"),
            "client_name": result.get("dhanClientName"),
            "access_token": result.get("accessToken"),
            "expiry_time": result.get("expiryTime"),
            "message": "Token obtained successfully! Save the access_token for API calls.",
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Exchange token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/renew-token")
async def renew_access_token():
    """
    Renew current access token for another 24 hours
    
    Only works if current token is still valid (not expired)
    """
    try:
        from services.dhan_auth_service import get_dhan_auth_service
        auth = get_dhan_auth_service()
        
        if not auth.access_token:
            raise HTTPException(status_code=400, detail="No access token configured")
        
        success = await auth.renew_token()
        
        if success:
            return {
                "status": "success",
                "message": "Token renewed for another 24 hours",
                "new_expiry": auth.token_expiry.isoformat() if auth.token_expiry else None,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail="Token renewal failed. Token may be expired - use OAuth flow to get new token."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Renew token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/auto-generate-token")
async def auto_generate_token():
    """
    🔥 AUTO-GENERATE ACCESS TOKEN using TOTP
    
    This is FULLY AUTOMATED - no browser login needed!
    Uses TOTP (Time-based One-Time Password) to generate fresh token.
    
    Requirements:
    - DHAN_CLIENT_ID must be set
    - DHAN_PIN must be set (6-digit login PIN)
    - DHAN_TOTP_SECRET must be set (from Authenticator app setup)
    
    Returns new access token valid for 24 hours.
    """
    try:
        from services.dhan_auth_service import get_dhan_auth_service
        auth = get_dhan_auth_service()
        
        if not auth.totp_secret or not auth.pin:
            raise HTTPException(
                status_code=400,
                detail="TOTP auto-login not configured. Need DHAN_PIN and DHAN_TOTP_SECRET environment variables."
            )
        
        result = await auth.auto_generate_token()
        
        if result and result.get("success"):
            return {
                "status": "success",
                "client_id": result.get("dhanClientId"),
                "client_name": result.get("dhanClientName"),
                "access_token": result.get("accessToken"),
                "expiry_time": result.get("expiryTime"),
                "message": "🎉 Token auto-generated successfully via TOTP! Valid for 24 hours.",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="TOTP token generation failed. Check PIN and TOTP secret."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auto generate token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


