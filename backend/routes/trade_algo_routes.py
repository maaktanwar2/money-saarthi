"""
Trade Algo API Routes
=====================

Endpoints for:
- Auto-fetch trades from Dhan & Upstox
- Performance analytics
- AI trade suggestions
- Position & fund tracking
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.trade_algo_service import get_trade_algo_service, TradeAlgoService
from middleware.error_handler import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trade-algo", tags=["Trade Algo"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class BrokerCredentials(BaseModel):
    """Broker API credentials"""
    broker: str = Field(..., description="dhan or upstox")
    client_id: Optional[str] = None
    access_token: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None


class SuggestionRequest(BaseModel):
    """Trade suggestion request"""
    max_suggestions: int = Field(default=5, ge=1, le=20)
    risk_per_trade: float = Field(default=10000, ge=1000, le=100000)
    preferred_timeframe: str = Field(default="INTRADAY", description="INTRADAY, SWING, POSITIONAL")
    include_scanner_data: bool = Field(default=True)


class TradeAlgoResponse(BaseModel):
    """Standard response"""
    status: str
    data: Any
    timestamp: str


# ============================================
# ENDPOINTS
# ============================================

@router.get("/status")
async def get_algo_status():
    """
    Get Trade Algo service status
    
    Returns broker connection status and service health
    """
    service = get_trade_algo_service()
    
    # Get detailed broker status
    broker_status = service._get_broker_status()
    
    # Add more details for debugging
    broker_status["upstox"]["has_access_token"] = bool(service.upstox_fetcher.access_token)
    broker_status["upstox"]["has_api_key"] = bool(service.upstox_fetcher.api_key)
    broker_status["dhan"]["has_access_token"] = bool(service.dhan_fetcher.access_token)
    broker_status["dhan"]["has_client_id"] = bool(service.dhan_fetcher.client_id)
    
    return {
        "status": "active",
        "service": "Trade Algo Service v1.0",
        "features": [
            "Auto-fetch trades from Dhan & Upstox",
            "Performance analytics & metrics",
            "AI-powered trade suggestions",
            "Position & fund tracking"
        ],
        "brokers": broker_status,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/test-upstox")
async def test_upstox_connection():
    """
    Test Upstox API connection and return raw response
    
    For debugging Upstox connectivity issues
    """
    import aiohttp
    
    service = get_trade_algo_service()
    upstox = service.upstox_fetcher
    
    result = {
        "configured": upstox.is_configured(),
        "has_access_token": bool(upstox.access_token),
        "has_api_key": bool(upstox.api_key),
        "token_preview": upstox.access_token[:20] + "..." if upstox.access_token else None
    }
    
    if upstox.is_configured():
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {upstox.access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                
                # Test profile endpoint
                async with session.get(
                    "https://api.upstox.com/v2/user/profile",
                    headers=headers
                ) as response:
                    data = await response.json()
                    result["profile_response"] = {
                        "status": response.status,
                        "data": data
                    }
                    
                # Test funds endpoint
                async with session.get(
                    "https://api.upstox.com/v2/user/get-funds-and-margin",
                    headers=headers
                ) as response:
                    data = await response.json()
                    result["funds_response"] = {
                        "status": response.status,
                        "data": data
                    }
        except Exception as e:
            result["error"] = str(e)
    
    return result


@router.get("/trades")
async def get_trades(
    force_refresh: bool = Query(default=False, description="Force refresh from brokers"),
    broker: Optional[str] = Query(default=None, description="Filter by broker: dhan, upstox")
):
    """
    Fetch all trades from connected brokers
    
    Auto-fetches from Dhan and Upstox based on configured credentials.
    Results are cached for 5 minutes unless force_refresh is True.
    """
    try:
        service = get_trade_algo_service()
        result = await service.fetch_all_trades(force_refresh=force_refresh)
        
        # Filter by broker if specified
        if broker and result.get("trades"):
            result["trades"] = [t for t in result["trades"] if t.get("broker") == broker]
            result["total_count"] = len(result["trades"])
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions")
async def get_positions():
    """
    Fetch current positions from all brokers
    
    Returns combined positions with total PnL
    """
    try:
        service = get_trade_algo_service()
        result = await service.fetch_all_positions()
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/funds")
async def get_funds():
    """
    Fetch fund/margin details from all brokers
    
    Returns available balance, utilized amount, etc.
    """
    try:
        service = get_trade_algo_service()
        result = await service.fetch_funds()
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error fetching funds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders")
async def get_orders(
    broker: Optional[str] = Query(default=None, description="Filter by broker: dhan, upstox")
):
    """
    Fetch today's orders from all brokers
    
    Returns order details including status, quantity, price
    """
    try:
        service = get_trade_algo_service()
        result = await service.fetch_orders()
        
        # Filter by broker if specified
        if broker and result.get("orders"):
            result["orders"] = [o for o in result["orders"] if o.get("broker") == broker]
            result["total_count"] = len(result["orders"])
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
async def get_analytics(
    force_refresh: bool = Query(default=False, description="Refresh trades before analysis")
):
    """
    Get comprehensive trading analytics
    
    Metrics include:
    - Win rate
    - Average profit/loss
    - Risk/reward ratio
    - Max drawdown
    - Best/worst trades
    - Segment breakdown
    - Time-based analysis
    """
    try:
        service = get_trade_algo_service()
        result = await service.analyze_performance(force_refresh=force_refresh)
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error analyzing performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggestions")
async def get_trade_suggestions(request: SuggestionRequest = Body(default=SuggestionRequest())):
    """
    Get AI-powered trade suggestions
    
    Generates personalized suggestions based on:
    - User's trading history & win rate
    - Current scanner results (gainers, losers, swing setups)
    - Risk management rules
    
    Request Body:
    - max_suggestions: Number of suggestions (1-20)
    - risk_per_trade: Max risk in INR per trade
    - preferred_timeframe: INTRADAY, SWING, or POSITIONAL
    - include_scanner_data: Use scanner results for suggestions
    """
    try:
        service = get_trade_algo_service()
        
        # Optionally fetch scanner data
        scanner_data = {}
        if request.include_scanner_data:
            try:
                from services.scanner_service import get_scanner_service
                scanner_service = get_scanner_service()
                
                # Get scanner results
                gainers = await scanner_service.get_day_gainers({})
                losers = await scanner_service.get_day_losers({})
                swing = await scanner_service.get_swing_setups({"direction": "bullish"})
                
                scanner_data = {
                    "day_gainers": gainers,
                    "day_losers": losers,
                    "swing": swing
                }
            except Exception as e:
                logger.warning(f"Could not fetch scanner data: {e}")
        
        result = await service.get_trade_suggestions(
            scanner_data=scanner_data,
            max_suggestions=request.max_suggestions,
            risk_per_trade=request.risk_per_trade
        )
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suggestions/quick")
async def get_quick_suggestions():
    """
    Get quick trade suggestions without detailed analysis
    
    Returns top 3 high-confidence suggestions based on current scanners
    """
    try:
        service = get_trade_algo_service()
        
        # Use minimal scanner data
        scanner_data = {}
        try:
            from services.scanner_service import get_scanner_service
            scanner_service = get_scanner_service()
            gainers = await scanner_service.get_day_gainers({"min_score": 80})
            scanner_data = {"day_gainers": gainers}
        except Exception:
            pass
        
        result = await service.get_trade_suggestions(
            scanner_data=scanner_data,
            max_suggestions=3,
            risk_per_trade=5000
        )
        
        return {
            "status": "success",
            **result
        }
        
    except Exception as e:
        logger.error(f"Error getting quick suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configure-broker")
async def configure_broker(credentials: BrokerCredentials):
    """
    Configure broker credentials
    
    Credentials are saved to Firestore for persistence across restarts.
    """
    try:
        from services.firestore_db import get_firestore_client
        
        service = get_trade_algo_service()
        db = get_firestore_client()
        
        if credentials.broker.lower() == "dhan":
            # Update service in memory
            service.dhan_fetcher.client_id = credentials.client_id or ""
            service.dhan_fetcher.access_token = credentials.access_token
            
            # Save to Firestore for persistence
            db.collection("broker_credentials").document("dhan").set({
                "broker": "dhan",
                "client_id": credentials.client_id or "",
                "access_token": credentials.access_token,
                "updated_at": datetime.now().isoformat()
            })
            
            return {
                "status": "success",
                "message": "Dhan credentials configured and saved",
                "broker": "dhan",
                "configured": service.dhan_fetcher.is_configured()
            }
            
        elif credentials.broker.lower() == "upstox":
            # Update service in memory
            service.upstox_fetcher.api_key = credentials.api_key or ""
            service.upstox_fetcher.api_secret = credentials.api_secret or ""
            service.upstox_fetcher.access_token = credentials.access_token
            
            # Save to Firestore for persistence
            db.collection("broker_credentials").document("upstox").set({
                "broker": "upstox",
                "api_key": credentials.api_key or "",
                "api_secret": credentials.api_secret or "",
                "access_token": credentials.access_token,
                "updated_at": datetime.now().isoformat()
            })
            
            return {
                "status": "success",
                "message": "Upstox credentials configured and saved",
                "broker": "upstox",
                "configured": service.upstox_fetcher.is_configured()
            }
        else:
            return error_response(
                status_code=400,
                message="Invalid broker. Use 'dhan' or 'upstox'",
                error_code="INVALID_BROKER",
                details={"valid_brokers": ["dhan", "upstox"]}
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error configuring broker: {e}")
        return error_response(
            status_code=500,
            message="Failed to configure broker",
            error_code="BROKER_CONFIG_ERROR",
            details={"error": str(e)}
        )


@router.get("/dashboard")
async def get_algo_dashboard():
    """
    Get complete algo trading dashboard data
    
    Returns:
    - Broker status
    - Today's trades
    - Current positions
    - Available funds
    - Performance metrics
    - Top suggestions
    """
    try:
        service = get_trade_algo_service()
        
        # Fetch all data in parallel
        import asyncio
        
        trades_task = service.fetch_all_trades()
        positions_task = service.fetch_all_positions()
        funds_task = service.fetch_funds()
        
        trades, positions, funds = await asyncio.gather(
            trades_task, positions_task, funds_task,
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(trades, Exception):
            trades = {"trades": [], "error": str(trades)}
        if isinstance(positions, Exception):
            positions = {"positions": [], "error": str(positions)}
        if isinstance(funds, Exception):
            funds = {"brokers": {}, "error": str(funds)}
        
        # Get analytics
        analytics = await service.analyze_performance()
        
        # Get quick suggestions
        suggestions = await service.get_trade_suggestions(max_suggestions=3)
        
        return {
            "status": "success",
            "dashboard": {
                "brokers": service._get_broker_status(),
                "trades_today": {
                    "count": trades.get("total_count", 0),
                    "recent": trades.get("trades", [])[:5]
                },
                "positions": {
                    "count": positions.get("total_count", 0),
                    "total_pnl": positions.get("total_pnl", 0),
                    "open": positions.get("positions", [])
                },
                "funds": funds,
                "analytics": analytics.get("summary", {}),
                "suggestions": suggestions.get("suggestions", [])[:3],
                "win_rate": analytics.get("summary", {}).get("win_rate", 0),
                "recent_streak": analytics.get("recent_streak", {})
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/upstox/oauth-url")
async def get_upstox_oauth_url(
    api_key: str = Query(..., description="Upstox API Key"),
    redirect_uri: str = Query(default="https://moneysaarthi.in/trade-algo/callback", description="OAuth redirect URI")
):
    """
    Generate Upstox OAuth login URL
    
    User needs to open this URL in browser, login to Upstox,
    and will be redirected back with authorization code.
    """
    oauth_url = (
        f"https://api.upstox.com/v2/login/authorization/dialog"
        f"?client_id={api_key}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
    )
    
    return {
        "status": "success",
        "oauth_url": oauth_url,
        "instructions": [
            "1. Click the URL to open Upstox login",
            "2. Login with your Upstox credentials",
            "3. Authorize the app",
            "4. You'll be redirected with a 'code' parameter",
            "5. Use that code to exchange for access token"
        ]
    }


@router.post("/upstox/exchange-token")
async def exchange_upstox_token(
    api_key: str = Body(..., description="Upstox API Key"),
    api_secret: str = Body(..., description="Upstox API Secret"),
    code: str = Body(..., description="Authorization code from OAuth redirect"),
    redirect_uri: str = Body(default="https://moneysaarthi.in/trade-algo/callback", description="Same redirect URI used in OAuth")
):
    """
    Exchange Upstox authorization code for access token
    
    After OAuth redirect, use the 'code' parameter to get the access token.
    """
    import aiohttp
    
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "code": code,
                "client_id": api_key,
                "client_secret": api_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }
            
            async with session.post(
                "https://api.upstox.com/v2/login/authorization/token",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            ) as response:
                data = await response.json()
                
                if response.status == 200 and data.get("access_token"):
                    # Auto-save the credentials
                    from services.firestore_db import get_firestore_client
                    
                    service = get_trade_algo_service()
                    db = get_firestore_client()
                    
                    access_token = data["access_token"]
                    
                    # Update service in memory
                    service.upstox_fetcher.api_key = api_key
                    service.upstox_fetcher.api_secret = api_secret
                    service.upstox_fetcher.access_token = access_token
                    
                    # Save to Firestore
                    db.collection("broker_credentials").document("upstox").set({
                        "broker": "upstox",
                        "api_key": api_key,
                        "api_secret": api_secret,
                        "access_token": access_token,
                        "updated_at": datetime.now().isoformat()
                    })
                    
                    return {
                        "status": "success",
                        "message": "Access token generated and saved!",
                        "access_token": access_token,
                        "expires_in": data.get("expires_in"),
                        "token_type": data.get("token_type")
                    }
                else:
                    return {
                        "status": "error",
                        "message": "Failed to get access token",
                        "error": data
                    }
                    
    except Exception as e:
        logger.error(f"Error exchanging Upstox token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
async def oauth_callback(code: str = Query(None), error: str = Query(None)):
    """
    OAuth callback handler for Upstox
    
    This handles the redirect from Upstox OAuth.
    Returns a simple page showing the authorization code.
    """
    if error:
        return {
            "status": "error",
            "message": f"OAuth failed: {error}"
        }
    
    if code:
        return {
            "status": "success",
            "message": "Authorization successful! Copy this code:",
            "code": code,
            "next_steps": [
                "Copy the code above",
                "Go back to Trade Algo page",
                "Paste it in 'Authorization Code' field",
                "Click 'Get Access Token'"
            ]
        }
    
    return {"status": "error", "message": "No code received"}