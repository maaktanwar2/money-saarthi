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

# AI Delta Strangle Bot instances (per user)
_ai_delta_strangle_bots: Dict[str, Any] = {}

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


# ============================================
# DELTA NEUTRAL BOT ENDPOINTS
# ============================================

class DeltaNeutralStartRequest(BaseModel):
    """Request to start Delta Neutral bot"""
    access_token: Optional[str] = Field(default=None, description="Broker access token (not required in mock mode)")
    broker: str = Field(default="dhan", description="dhan or upstox")
    underlying: str = Field(default="NIFTY")
    max_delta_drift: float = Field(default=0.1, ge=0.01, le=0.5)
    lot_size: int = Field(default=50)
    auto_adjust: bool = Field(default=True)
    adjustment_interval: int = Field(default=60, ge=10, le=300)
    stop_loss_percent: float = Field(default=2.0)
    target_profit_percent: float = Field(default=1.0)
    mock_mode: Optional[bool] = Field(default=False, description="Enable mock mode for testing")


class DeltaNeutralStopRequest(BaseModel):
    """Request to stop Delta Neutral bot"""
    user_id: str = Field(default="default")


@router.post("/delta-neutral/start")
async def start_delta_neutral_bot(request: DeltaNeutralStartRequest):
    """
    Start Delta Neutral auto-adjustment bot
    
    The bot will:
    - Monitor portfolio delta continuously
    - Auto-adjust when delta drifts beyond threshold
    - Place hedge orders to maintain neutrality
    
    Use mock_mode=true for testing without real broker connection.
    """
    try:
        from services.algo_trading_engine import (
            get_or_create_bot, DeltaNeutralConfig, AlgoTradingEngine
        )
        
        # In mock mode, we don't need real broker service
        broker_service = None
        if not request.mock_mode:
            if not request.access_token:
                raise HTTPException(status_code=400, detail="access_token required (or use mock_mode=true)")
            # Create broker service based on broker type
            if request.broker == "upstox":
                from services.upstox_service import UpstoxService
                broker_service = UpstoxService(access_token=request.access_token)
            else:
                from services.dhan_service import DhanService
                broker_service = DhanService(access_token=request.access_token)
        
        # Create bot config
        config = DeltaNeutralConfig(
            underlying=request.underlying,
            max_delta_drift=request.max_delta_drift,
            lot_size=request.lot_size,
            auto_adjust=request.auto_adjust,
            adjustment_interval_seconds=request.adjustment_interval,
            stop_loss_percent=request.stop_loss_percent,
            target_profit_percent=request.target_profit_percent
        )
        
        # Get or create bot
        bot = get_or_create_bot(
            user_id="default",
            broker_service=broker_service,
            access_token=request.access_token or "mock_token",
            broker=request.broker
        )
        
        # Start bot (with mock mode if requested)
        result = await bot.start(config, mock_mode=request.mock_mode)
        
        return {
            "status": "success" if result.get("success") else "error",
            "message": result.get("message", result.get("error")),
            "mock_mode": request.mock_mode,
            "config": result.get("config"),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting Delta Neutral bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delta-neutral/stop")
async def stop_delta_neutral_bot(request: DeltaNeutralStopRequest = Body(default={"user_id": "default"})):
    """
    Stop Delta Neutral auto-adjustment bot
    """
    try:
        from services.algo_trading_engine import get_bot
        
        bot = get_bot(request.user_id)
        if not bot:
            return {
                "status": "error",
                "message": "No active bot found",
                "timestamp": datetime.now().isoformat()
            }
        
        result = await bot.stop()
        
        return {
            "status": "success" if result.get("success") else "error",
            "message": result.get("message", result.get("error")),
            "final_pnl": result.get("final_pnl"),
            "trades_today": result.get("trades_today"),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error stopping Delta Neutral bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/delta-neutral/status")
async def get_delta_neutral_status(user_id: str = Query(default="default")):
    """
    Get Delta Neutral bot status
    """
    try:
        from services.algo_trading_engine import get_bot
        
        bot = get_bot(user_id)
        if not bot:
            return {
                "status": "inactive",
                "message": "No active bot",
                "is_running": False,
                "timestamp": datetime.now().isoformat()
            }
        
        status = bot.get_status()
        
        return {
            "status": "active" if status.get("is_running") else "stopped",
            **status,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting Delta Neutral status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delta-neutral/adjust")
async def manual_delta_adjustment(
    access_token: str = Body(..., embed=True),
    broker: str = Body(default="dhan", embed=True)
):
    """
    Manually trigger delta check and adjustment
    """
    try:
        from services.algo_trading_engine import get_bot, get_or_create_bot
        
        bot = get_bot("default")
        
        if not bot:
            # Create temporary bot for one-time check
            if broker == "upstox":
                from services.upstox_service import UpstoxService
                broker_service = UpstoxService(access_token=access_token)
            else:
                from services.dhan_service import DhanService
                broker_service = DhanService(access_token=access_token)
            
            bot = get_or_create_bot("default", broker_service, access_token, broker)
        
        result = await bot.check_and_adjust_delta()
        
        return {
            "status": "success" if result.get("success") else "error",
            "delta": result.get("delta"),
            "adjusted": result.get("adjusted"),
            "message": result.get("message", result.get("error")),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in manual delta adjustment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# AI STRANGLE BOT ENDPOINTS
# ============================================

class AIStrangleStartRequest(BaseModel):
    """Request to start AI Strangle bot"""
    access_token: Optional[str] = Field(default=None, description="Broker access token (not required in mock mode)")
    broker: str = Field(default="dhan", description="dhan or upstox")
    underlying: str = Field(default="NIFTY")
    otm_offset: int = Field(default=250, ge=100, le=500)
    num_lots: int = Field(default=2, ge=1, le=10)
    min_range_prob: int = Field(default=65, ge=50, le=80)
    stop_loss_pct: float = Field(default=50.0)
    target_profit_pct: float = Field(default=50.0)
    auto_enter: bool = Field(default=True)
    entry_time: str = Field(default="09:30")
    exit_time: str = Field(default="15:15")
    mock_mode: Optional[bool] = Field(default=False, description="Enable mock mode for testing")
    scenario: Optional[str] = Field(default="random", description="Mock scenario: bullish, bearish, range, volatile, random")


class AIStrangleStopRequest(BaseModel):
    """Request to stop AI Strangle bot"""
    user_id: str = Field(default="default")


@router.post("/ai-strangle/start")
async def start_ai_strangle_bot(request: AIStrangleStartRequest):
    """
    Start AI Non-Directional OTM 250 Strangle Bot
    
    The bot will:
    - Analyze market using 5-factor AI regime detection
    - Auto-enter OTM 250 strangle when Range Prob >= 65%
    - Auto-exit at target (50%) or stop loss (50%)
    - Time-based exit at 3:15 PM
    
    Historical Win Rate: 96.8% with selective trading
    
    Use mock_mode=true for testing without real broker connection.
    Mock scenarios: bullish, bearish, range, volatile, random
    """
    try:
        from services.ai_strangle_bot import (
            get_or_create_ai_strangle_bot, AIStrangleConfig
        )
        
        # In mock mode, we don't need real broker service
        broker_service = None
        if not request.mock_mode:
            if not request.access_token:
                raise HTTPException(status_code=400, detail="access_token required (or use mock_mode=true)")
            # Create broker service based on broker type
            if request.broker == "upstox":
                from services.upstox_service import UpstoxService
                broker_service = UpstoxService(access_token=request.access_token)
            else:
                from services.dhan_service import DhanService
                broker_service = DhanService(access_token=request.access_token)
        
        # Enforce correct lot size based on underlying (CANNOT be overridden)
        LOT_SIZES = {
            "NIFTY": 65,
            "BANKNIFTY": 15,
            "FINNIFTY": 25,
            "MIDCPNIFTY": 75
        }
        underlying = request.underlying.upper()
        if underlying not in LOT_SIZES:
            raise HTTPException(status_code=400, detail=f"Invalid underlying. Valid: {list(LOT_SIZES.keys())}")
        
        enforced_lot_size = LOT_SIZES[underlying]
        
        # Create bot config with enforced lot size
        config = AIStrangleConfig(
            underlying=underlying,
            otm_offset=request.otm_offset,
            num_lots=request.num_lots,
            lot_size=enforced_lot_size,  # ENFORCED - user cannot change
            min_range_prob=request.min_range_prob,
            stop_loss_pct=request.stop_loss_pct,
            target_profit_pct=request.target_profit_pct,
            auto_enter=request.auto_enter,
            entry_time=request.entry_time,
            exit_time=request.exit_time
        )
        
        logger.info(f"🔧 Bot config: {underlying}, lot_size={enforced_lot_size}, num_lots={request.num_lots}, total_qty={enforced_lot_size * request.num_lots}")
        
        # Get or create bot
        bot = get_or_create_ai_strangle_bot(
            user_id="default",
            broker_service=broker_service,
            access_token=request.access_token or "mock_token",
            broker=request.broker
        )
        
        # Start bot (with mock mode if requested)
        result = await bot.start(
            config, 
            mock_mode=request.mock_mode,
            scenario=request.scenario or "random"
        )
        
        return {
            "status": "success" if result.get("success") else "error",
            "message": result.get("message", result.get("error")),
            "mock_mode": request.mock_mode,
            "scenario": request.scenario if request.mock_mode else None,
            "initial_scan": result.get("initial_scan"),
            "position": result.get("position"),
            "config": result.get("config"),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting AI Strangle bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-strangle/stop")
async def stop_ai_strangle_bot(request: AIStrangleStopRequest = Body(default={"user_id": "default"})):
    """
    Stop AI Strangle bot and close any open positions
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot
        
        bot = get_ai_strangle_bot(request.user_id)
        if not bot:
            return {
                "status": "error",
                "message": "No active AI Strangle bot found",
                "timestamp": datetime.now().isoformat()
            }
        
        result = await bot.stop()
        
        return {
            "status": "success" if result.get("success") else "error",
            "message": result.get("message", result.get("error")),
            "daily_pnl": result.get("daily_pnl"),
            "trades_today": result.get("trades_today"),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error stopping AI Strangle bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-strangle/status")
async def get_ai_strangle_status(user_id: str = Query(default="default")):
    """
    Get AI Strangle bot status including:
    - Current AI regime score
    - Active position details
    - Daily P&L
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot
        
        bot = get_ai_strangle_bot(user_id)
        if not bot:
            return {
                "status": "inactive",
                "message": "No active AI Strangle bot",
                "is_running": False,
                "timestamp": datetime.now().isoformat()
            }
        
        status = bot.get_status()
        
        return {
            "status": "active" if status.get("is_running") else "stopped",
            **status,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting AI Strangle status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AIStrangleConfigUpdateRequest(BaseModel):
    """Request to update AI Strangle bot configuration"""
    user_id: str = Field(default="default")
    underlying: Optional[str] = Field(default=None, description="NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY")
    otm_offset: Optional[int] = Field(default=None, ge=50, le=500, description="Points OTM (50-500)")
    num_lots: Optional[int] = Field(default=None, ge=1, le=20, description="Number of lots (1-20)")
    min_range_prob: Optional[int] = Field(default=None, ge=50, le=90, description="Min range probability % (50-90)")
    auto_enter: Optional[bool] = Field(default=None, description="Auto-enter strangle when conditions met")
    entry_time: Optional[str] = Field(default=None, description="Entry time HH:MM (IST)")
    exit_time: Optional[str] = Field(default=None, description="Exit time HH:MM (IST)")
    stop_loss_pct: Optional[float] = Field(default=None, ge=10, le=100, description="Stop loss % of premium (10-100)")
    target_profit_pct: Optional[float] = Field(default=None, ge=10, le=100, description="Target profit % of premium (10-100)")
    # Auto Adjustment Settings
    auto_adjust: Optional[bool] = Field(default=None, description="Enable auto adjustment when spot breaches strike")
    breach_buffer: Optional[int] = Field(default=None, ge=25, le=200, description="Points before strike to trigger adjustment (25-200)")
    roll_points: Optional[int] = Field(default=None, ge=50, le=300, description="Points to roll leg when adjusting (50-300)")
    max_adjustments: Optional[int] = Field(default=None, ge=0, le=5, description="Max adjustments per day (0-5)")


@router.post("/ai-strangle/config")
async def update_ai_strangle_config(request: AIStrangleConfigUpdateRequest):
    """
    Update AI Strangle bot configuration while running
    
    **Note:** Lot size is auto-enforced based on underlying:
    - NIFTY: 65
    - BANKNIFTY: 15
    - FINNIFTY: 25
    - MIDCPNIFTY: 75
    
    **Auto Adjustment:**
    When enabled, bot automatically rolls the breached leg:
    - If spot drops near PE strike → Roll PE down by roll_points
    - If spot rises near CE strike → Roll CE up by roll_points
    
    Example:
    ```json
    {
        "num_lots": 3,
        "auto_adjust": true,
        "breach_buffer": 50,
        "roll_points": 100
    }
    ```
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot
        
        bot = get_ai_strangle_bot(request.user_id)
        if not bot:
            raise HTTPException(status_code=404, detail="No active AI Strangle bot. Start bot first.")
        
        # Build update dict from non-None values
        updates = {}
        for field in ['underlying', 'otm_offset', 'num_lots', 'min_range_prob', 
                      'auto_enter', 'entry_time', 'exit_time', 'stop_loss_pct', 'target_profit_pct',
                      'auto_adjust', 'breach_buffer', 'roll_points', 'max_adjustments']:
            value = getattr(request, field)
            if value is not None:
                updates[field] = value
        
        if not updates:
            return {
                "status": "no_changes",
                "message": "No configuration updates provided",
                "current_config": bot.get_status().get("config"),
                "timestamp": datetime.now().isoformat()
            }
        
        result = bot.update_config(updates)
        
        return {
            "status": "success",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating AI Strangle config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-strangle/scan")
async def trigger_ai_strangle_scan(user_id: str = Query(default="default")):
    """
    Manually trigger one AI Strangle scan iteration.
    
    Use this to test trading in serverless environments where background loops don't run.
    Call this endpoint every 30-60 seconds to simulate continuous scanning.
    
    Returns AI score, market regime analysis, and any trades executed.
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot
        
        bot = get_ai_strangle_bot(user_id)
        if not bot:
            raise HTTPException(status_code=404, detail="No active AI Strangle bot. Start bot first.")
        
        if not bot._running:
            raise HTTPException(status_code=400, detail="Bot not running. Start bot first.")
        
        result = await bot.scan_once()
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI Strangle scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-strangle/analyze")
async def analyze_market_regime(
    access_token: str = Body(..., embed=True),
    broker: str = Body(default="dhan", embed=True)
):
    """
    Manually trigger AI market regime analysis
    
    Returns:
    - AI score (0-100%)
    - Individual factor scores (VIX, IV/RV, PCR, ATR, Events)
    - Recommended action (SELL or SKIP)
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot, get_or_create_ai_strangle_bot
        
        bot = get_ai_strangle_bot("default")
        
        if not bot:
            # Create temporary bot for analysis
            if broker == "upstox":
                from services.upstox_service import UpstoxService
                broker_service = UpstoxService(access_token=access_token)
            else:
                from services.dhan_service import DhanService
                broker_service = DhanService(access_token=access_token)
            
            bot = get_or_create_ai_strangle_bot("default", broker_service, access_token, broker)
        
        result = await bot.analyze_now()
        
        return {
            "status": "success" if result.get("success") else "error",
            "score": result.get("score"),
            "market_data": result.get("market_data"),
            "recommendation": result.get("recommendation"),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in AI analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-strangle/enter")
async def manual_enter_strangle(
    access_token: str = Body(..., embed=True),
    broker: str = Body(default="dhan", embed=True)
):
    """
    Manually enter OTM 250 strangle position (overrides AI decision)
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot
        
        bot = get_ai_strangle_bot("default")
        if not bot or not bot.state.is_running:
            return {
                "status": "error",
                "message": "Bot not running. Start the bot first.",
                "timestamp": datetime.now().isoformat()
            }
        
        # Get spot price and enter
        market_data = await bot.fetch_market_data()
        spot = market_data.get("spot", 24000)
        
        result = await bot.enter_strangle(spot)
        
        return {
            "status": "success" if result.get("success") else "error",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error entering strangle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-strangle/exit")
async def manual_exit_strangle(
    access_token: str = Body(..., embed=True),
    broker: str = Body(default="dhan", embed=True)
):
    """
    Manually exit current strangle position
    """
    try:
        from services.ai_strangle_bot import get_ai_strangle_bot
        
        bot = get_ai_strangle_bot("default")
        if not bot:
            return {
                "status": "error",
                "message": "No active bot found",
                "timestamp": datetime.now().isoformat()
            }
        
        result = await bot.exit_strangle("manual")
        
        return {
            "status": "success" if result.get("success") else "error",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error exiting strangle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/order/place")
async def place_order(
    access_token: str = Body(...),
    broker: str = Body(default="dhan"),
    symbol: str = Body(...),
    security_id: str = Body(...),
    transaction_type: str = Body(..., description="BUY or SELL"),
    quantity: int = Body(...),
    order_type: str = Body(default="MARKET"),
    price: float = Body(default=0),
    product_type: str = Body(default="INTRADAY")
):
    """
    Place an order via broker API
    
    Supports both Dhan and Upstox
    """
    try:
        from services.algo_trading_engine import (
            AlgoTradingEngine, TransactionType, OrderType, ProductType
        )
        
        # Create broker service
        if broker == "upstox":
            from services.upstox_service import UpstoxService
            broker_service = UpstoxService(access_token=access_token)
        else:
            from services.dhan_service import DhanService
            broker_service = DhanService(access_token=access_token)
        
        # Create engine for order placement
        engine = AlgoTradingEngine(broker_service, access_token, broker)
        
        # Place order
        result = await engine.place_order(
            symbol=symbol,
            security_id=security_id,
            transaction_type=TransactionType[transaction_type.upper()],
            quantity=quantity,
            order_type=OrderType[order_type.upper()],
            price=price,
            product_type=ProductType[product_type.upper()]
        )
        
        # Close broker service
        await broker_service.close()
        
        return {
            "status": "success" if result.get("success") else "error",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error placing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# GENERIC BOT START/STOP ENDPOINTS
# ============================================

class BotStartRequest(BaseModel):
    """Request to start any bot strategy"""
    bot_id: str = Field(..., description="Bot ID from frontend")
    strategy: str = Field(..., description="Strategy type")
    access_token: str = Field(..., description="Broker access token")
    broker: str = Field(default="dhan", description="dhan or upstox")
    config: Dict[str, Any] = Field(default_factory=dict, description="Bot configuration")


class BotStopRequest(BaseModel):
    """Request to stop a bot"""
    bot_id: str = Field(..., description="Bot ID")
    access_token: str = Field(...)
    broker: str = Field(default="dhan")


# In-memory storage for active bots (use Redis in production)
active_trading_bots: Dict[str, Dict[str, Any]] = {}
# Trading engines for each bot
trading_engines: Dict[str, Any] = {}


@router.post("/bot/start")
async def start_trading_bot(request: BotStartRequest):
    """
    Start a trading bot with specified strategy
    
    This ACTUALLY executes trades via the TradingEngine!
    
    Supported strategies:
    - DELTA_NEUTRAL_STRADDLE, DELTA_NEUTRAL_STRANGLE
    - IRON_CONDOR, IRON_BUTTERFLY
    - MOMENTUM_SCALP, SUPERTREND, EMA_CROSSOVER
    - MEAN_REVERSION, VWAP, ORB
    - PREMIUM_SELLING, COVERED_STRANGLE
    - BREAKOUT, VOL_EXPANSION
    - AI_ADAPTIVE, ML_PATTERN
    - PAIRS_TRADING, CALENDAR_SPREAD
    """
    try:
        logger.info(f"🚀 Starting bot: {request.bot_id} with strategy: {request.strategy}")
        
        # Create broker service
        if request.broker == "upstox":
            from services.upstox_service import UpstoxService
            broker_service = UpstoxService(access_token=request.access_token)
        else:
            from services.dhan_service import DhanService
            broker_service = DhanService(access_token=request.access_token)
        
        # Validate broker connection
        try:
            funds = await broker_service.get_fund_limits()
            if not funds.get("success"):
                return {
                    "success": False,
                    "error": "Failed to connect to broker. Please check your access token.",
                    "timestamp": datetime.now().isoformat()
                }
            available_balance = funds.get("data", {}).get("available_balance", 0)
            logger.info(f"✅ Broker connected. Available balance: ₹{available_balance}")
        except Exception as e:
            return {
                "success": False,
                "error": f"Broker connection failed: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
        
        # Import and create Trading Engine
        from services.trading_engine import TradingEngine
        
        # Create trading engine with config
        engine = TradingEngine(broker_service, request.config)
        trading_engines[request.bot_id] = engine
        
        # Start the bot (this starts the trading loop!)
        await engine.start_bot(request.bot_id, request.strategy)
        
        # Store bot info
        bot_info = {
            "bot_id": request.bot_id,
            "strategy": request.strategy,
            "broker": request.broker,
            "config": request.config,
            "started_at": datetime.now().isoformat(),
            "status": "running",
            "trades": [],
            "pnl": 0,
            "broker_service": broker_service,
            "engine": engine
        }
        
        active_trading_bots[request.bot_id] = bot_info
        
        # Handle strategy-specific initialization
        strategy_message = _get_strategy_init_message(request.strategy, request.config)
        
        logger.info(f"✅ Bot {request.bot_id} TRADING ENGINE STARTED!")
        
        return {
            "success": True,
            "message": f"Bot started: {request.bot_id}",
            "strategy": request.strategy,
            "strategy_info": strategy_message,
            "available_balance": available_balance,
            "config": request.config,
            "trading_active": True,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error starting bot: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.post("/bot/stop")
async def stop_trading_bot(request: BotStopRequest):
    """
    Stop a running trading bot - stops the trading engine
    """
    try:
        logger.info(f"🛑 Stopping bot: {request.bot_id}")
        
        if request.bot_id not in active_trading_bots:
            return {
                "success": True,
                "message": f"Bot {request.bot_id} was not running",
                "timestamp": datetime.now().isoformat()
            }
        
        bot_info = active_trading_bots.pop(request.bot_id)
        
        # Stop the trading engine
        if request.bot_id in trading_engines:
            engine = trading_engines.pop(request.bot_id)
            await engine.stop_bot(request.bot_id)
            logger.info(f"🛑 Trading engine stopped for {request.bot_id}")
        
        # Close broker service
        if "broker_service" in bot_info:
            try:
                await bot_info["broker_service"].close()
            except:
                pass
        
        return {
            "success": True,
            "message": f"Bot {request.bot_id} stopped",
            "runtime": _calculate_runtime(bot_info.get("started_at")),
            "trades": len(bot_info.get("trades", [])),
            "pnl": bot_info.get("pnl", 0),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error stopping bot: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.get("/bot/status")
async def get_bot_status(bot_id: str = Query(...)):
    """
    Get status of a specific bot
    """
    if bot_id not in active_trading_bots:
        return {
            "success": False,
            "running": False,
            "message": f"Bot {bot_id} not found",
            "timestamp": datetime.now().isoformat()
        }
    
    bot_info = active_trading_bots[bot_id]
    # Get logs from trading engine
    logs = []
    if bot_id in trading_engines:
        engine = trading_engines[bot_id]
        if bot_id in engine.bot_states:
            logs = engine.bot_states[bot_id].logs[-20:]  # Last 20 logs
    
    return {
        "success": True,
        "running": True,
        "bot_id": bot_id,
        "strategy": bot_info.get("strategy"),
        "started_at": bot_info.get("started_at"),
        "runtime": _calculate_runtime(bot_info.get("started_at")),
        "trades": len(bot_info.get("trades", [])),
        "pnl": bot_info.get("pnl", 0),
        "status": bot_info.get("status"),
        "logs": logs,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/bot/logs")
async def get_bot_logs(bot_id: str = Query(...)):
    """
    Get logs for a specific bot
    """
    if bot_id not in active_trading_bots:
        return {
            "success": False,
            "error": f"Bot {bot_id} not found",
            "logs": []
        }
    
    logs = []
    if bot_id in trading_engines:
        engine = trading_engines[bot_id]
        if bot_id in engine.bot_states:
            logs = engine.bot_states[bot_id].logs
    
    return {
        "success": True,
        "bot_id": bot_id,
        "logs": logs,
        "count": len(logs),
        "timestamp": datetime.now().isoformat()
    }


@router.get("/bot/list")
async def list_active_bots():
    """
    Get list of all active bots
    """
    bots = []
    for bot_id, info in active_trading_bots.items():
        # Get logs from trading engine
        logs = []
        if bot_id in trading_engines:
            engine = trading_engines[bot_id]
            if bot_id in engine.bot_states:
                logs = engine.bot_states[bot_id].logs[-5:]  # Last 5 logs
        
        bots.append({
            "bot_id": bot_id,
            "strategy": info.get("strategy"),
            "broker": info.get("broker"),
            "started_at": info.get("started_at"),
            "runtime": _calculate_runtime(info.get("started_at")),
            "trades": len(info.get("trades", [])),
            "pnl": info.get("pnl", 0),
            "status": info.get("status"),
            "recent_logs": logs
        })
    
    return {
        "success": True,
        "count": len(bots),
        "bots": bots,
        "timestamp": datetime.now().isoformat()
    }


def _get_strategy_init_message(strategy: str, config: Dict) -> str:
    """Get initialization message for strategy"""
    messages = {
        "DELTA_NEUTRAL_STRADDLE": "Monitoring delta for ATM straddle positions. Will auto-hedge when delta drifts.",
        "DELTA_NEUTRAL_STRANGLE": "Selling OTM strangle with gamma scalping. Auto-adjustments enabled.",
        "IRON_CONDOR": "Iron Condor positions will be opened at optimal strikes based on IV rank.",
        "IRON_BUTTERFLY": "ATM Butterfly strategy active. Best for expiry day pin risk plays.",
        "MOMENTUM_SCALP": "Scanning for momentum setups using RSI divergence and MACD.",
        "SUPERTREND": "SuperTrend indicator signals will trigger entries and exits.",
        "EMA_CROSSOVER": "9/21 EMA crossover strategy active. Waiting for signals.",
        "MEAN_REVERSION": "Watching Bollinger Bands for mean reversion opportunities.",
        "VWAP": "VWAP trader active. Will trade pullbacks to VWAP.",
        "ORB": "Opening Range Breakout strategy. Will capture first 30-min range breakout.",
        "PREMIUM_SELLING": "Options premium selling active. Looking for high IV opportunities.",
        "BREAKOUT": "Breakout hunter scanning for volume-confirmed breakouts.",
        "VOL_EXPANSION": "Volatility expansion strategy. Watching for BB + Keltner squeeze.",
        "AI_ADAPTIVE": "Claude 4.5 AI analyzing market conditions and adapting strategy.",
        "ML_PATTERN": "ML pattern recognition scanning historical setups.",
        "PAIRS_TRADING": "Statistical arbitrage active. Monitoring pair spread z-scores.",
        "CALENDAR_SPREAD": "Calendar spread strategy. Managing time decay differential."
    }
    return messages.get(strategy, f"Strategy {strategy} initialized with config: {config}")


def _calculate_runtime(started_at: str) -> str:
    """Calculate runtime from started_at timestamp"""
    if not started_at:
        return "0m"
    try:
        start = datetime.fromisoformat(started_at)
        delta = datetime.now() - start
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, _ = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"
    except:
        return "N/A"


@router.get("/debug/time")
async def debug_time():
    """Debug endpoint to check server time vs IST"""
    from datetime import timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    
    now_utc = datetime.now(timezone.utc)
    now_ist = datetime.now(IST)
    
    market_open = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
    
    is_market_open = market_open.time() <= now_ist.time() <= market_close.time()
    is_weekday = now_ist.weekday() < 5
    
    return {
        "utc_time": now_utc.isoformat(),
        "ist_time": now_ist.isoformat(),
        "ist_date": now_ist.strftime("%Y-%m-%d"),
        "ist_time_only": now_ist.strftime("%H:%M:%S"),
        "day_of_week": now_ist.strftime("%A"),
        "is_weekday": is_weekday,
        "market_open": "09:15",
        "market_close": "15:30",
        "is_market_open": is_market_open and is_weekday,
        "trading_possible": is_market_open and is_weekday
    }


# ═══════════════════════════════════════════════════════════════════════════════
# VWAP MOMENTUM AUTO TRADING BOT
# ═══════════════════════════════════════════════════════════════════════════════

# Import VWAP bot
try:
    from services.vwap_trading_bot import get_vwap_bot, VWAPTradingBot
    from services.unified_data_service import get_unified_service
    _vwap_bot = None
except ImportError as e:
    logger.warning(f"VWAP bot import error: {e}")
    _vwap_bot = None


def get_vwap_bot_instance():
    """Get VWAP bot with unified service"""
    global _vwap_bot
    if _vwap_bot is None:
        try:
            unified = get_unified_service()
            _vwap_bot = get_vwap_bot(unified_service=unified)
        except Exception as e:
            logger.error(f"Failed to init VWAP bot: {e}")
            return None
    return _vwap_bot


class VWAPBotConfig(BaseModel):
    """VWAP Bot configuration"""
    capital: Optional[float] = Field(default=100000, description="Total capital")
    risk_per_trade: Optional[float] = Field(default=2.0, description="Risk % per trade")
    max_positions: Optional[int] = Field(default=3, description="Max concurrent positions")
    min_score: Optional[int] = Field(default=70, description="Minimum VWAP score")
    min_volume_ratio: Optional[float] = Field(default=1.5, description="Minimum volume multiplier")
    mode: Optional[str] = Field(default="both", description="bullish, bearish, or both")
    scan_interval: Optional[int] = Field(default=60, description="Scan interval in seconds")
    market_start: Optional[str] = Field(default="09:20", description="Start time HH:MM")
    market_end: Optional[str] = Field(default="15:00", description="End time HH:MM")
    allowed_stocks: Optional[List[str]] = Field(default=[], description="Allowed stocks (empty=all)")
    blocked_stocks: Optional[List[str]] = Field(default=[], description="Blocked stocks")
    # 10-minute candle config
    candle_interval: Optional[int] = Field(default=10, description="Candle timeframe in minutes (10 default)")
    # Stoploss config
    stoploss_type: Optional[str] = Field(default="prev_candle", description="prev_candle (uses previous candle low/high) or percent")
    stop_loss_percent: Optional[float] = Field(default=1.0, description="Stop loss % (only if stoploss_type=percent)")
    # Target config
    target_type: Optional[str] = Field(default="risk_reward", description="risk_reward or percent")
    target_rr_ratio: Optional[float] = Field(default=2.0, description="Risk-Reward ratio (2.0 = 2:1)")
    target_percent: Optional[float] = Field(default=2.0, description="Target % (only if target_type=percent)")


class VWAPStartRequest(BaseModel):
    """VWAP bot start request"""
    broker: Optional[str] = Field(default="dhan", description="Broker: 'dhan' or 'upstox'")
    broker_token: Optional[str] = Field(default=None, description="Broker access token (not required in mock mode)")
    user_id: Optional[str] = Field(default="default", description="User ID")
    config: Optional[VWAPBotConfig] = None
    mock_mode: Optional[bool] = Field(default=False, description="Enable mock mode for testing")
    scenario: Optional[str] = Field(default="random", description="Mock scenario: bullish, bearish, range, volatile, random")


class VWAPManualTradeRequest(BaseModel):
    """Manual trade entry request"""
    symbol: str = Field(..., description="Stock symbol")
    direction: str = Field(..., description="LONG or SHORT")
    quantity: Optional[int] = Field(default=None, description="Override quantity")


@router.post("/vwap-bot/start")
async def start_vwap_bot(request: VWAPStartRequest):
    """
    Start VWAP Momentum Auto Trading Bot
    
    The bot will:
    1. Scan for VWAP momentum signals every minute
    2. Auto-enter trades with score >= 70 and volume >= 1.5x
    3. Manage positions with auto SL/Target
    4. Square off at 15:15
    
    Use mock_mode=true for testing without real broker connection.
    Mock scenarios: bullish, bearish, range, volatile, random
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        # Apply config if provided
        if request.config:
            bot.configure(request.config.dict(exclude_none=True))
        
        # Initialize broker service for live trading
        if not request.mock_mode and request.broker_token:
            try:
                broker_type = (request.broker or "dhan").lower()
                
                if broker_type == "upstox":
                    from services.upstox_service import UpstoxService
                    broker_service = UpstoxService(access_token=request.broker_token)
                    logger.info("🔗 Upstox broker service connected for live trading")
                else:
                    from services.dhan_service import DhanService
                    broker_service = DhanService(access_token=request.broker_token)
                    logger.info("🔗 Dhan broker service connected for live trading")
                
                bot.broker_service = broker_service
                bot.broker_type = broker_type  # Store broker type for order params
                logger.info(f"📊 Bot will use {broker_type.upper()} for market data and trading")
                
            except Exception as broker_err:
                logger.error(f"Failed to initialize broker: {broker_err}")
                raise HTTPException(status_code=400, detail=f"Broker connection failed: {broker_err}")
        
        # Start the bot (with mock mode if requested)
        result = await bot.start(
            broker_token=request.broker_token,
            user_id=request.user_id,
            mock_mode=request.mock_mode,
            scenario=request.scenario or "random"
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return {
            "status": "success",
            "message": f"VWAP Momentum Bot started{' [MOCK MODE]' if request.mock_mode else ''}",
            "mock_mode": request.mock_mode,
            "scenario": request.scenario if request.mock_mode else None,
            "bot_status": bot.get_status(),
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VWAP bot start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/stop")
async def stop_vwap_bot():
    """
    Stop VWAP Momentum Bot
    
    Stops scanning but keeps open positions.
    Use square-off to close all positions.
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        result = await bot.stop()
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VWAP bot stop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vwap-bot/status")
async def get_vwap_bot_status():
    """
    Get VWAP Bot status, positions, and stats
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            return {
                "status": "unavailable",
                "message": "VWAP bot not initialized",
                "is_running": False
            }
        
        return bot.get_status()
        
    except Exception as e:
        logger.error(f"VWAP bot status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/scan")
async def trigger_vwap_scan():
    """
    Manually trigger one VWAP scan iteration.
    
    Use this to test trading in serverless environments where background loops don't run.
    Call this endpoint every 30-60 seconds to simulate continuous scanning.
    
    Returns signals found and trades executed.
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        if not bot.is_running:
            raise HTTPException(status_code=400, detail="Bot not running. Start bot first.")
        
        result = await bot.scan_once()
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VWAP scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/configure")
async def configure_vwap_bot(config: VWAPBotConfig):
    """
    Update VWAP Bot configuration
    
    Can be updated while bot is running.
    New config applies from next scan.
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        result = bot.configure(config.dict(exclude_none=True))
        
        return {
            "status": "success",
            "message": "Configuration updated",
            "config": result["config"]
        }
        
    except Exception as e:
        logger.error(f"VWAP bot config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/pause")
async def pause_vwap_bot():
    """Pause bot - no new entries but manages existing positions"""
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        return bot.pause()
        
    except Exception as e:
        logger.error(f"VWAP bot pause error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/resume")
async def resume_vwap_bot():
    """Resume bot scanning and entries"""
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        return bot.resume()
        
    except Exception as e:
        logger.error(f"VWAP bot resume error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/manual-entry")
async def vwap_manual_entry(request: VWAPManualTradeRequest):
    """
    Manually enter a trade through the bot
    
    Use this to enter trades that don't meet auto-entry criteria
    but look good to you.
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        result = await bot.manual_entry(
            symbol=request.symbol.upper(),
            direction=request.direction.upper(),
            quantity=request.quantity
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VWAP manual entry error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/manual-exit")
async def vwap_manual_exit(symbol: str):
    """
    Manually exit a position
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        result = await bot.manual_exit(symbol.upper())
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VWAP manual exit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vwap-bot/square-off")
async def vwap_square_off():
    """
    Square off all positions immediately
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        await bot._square_off_all()
        
        return {
            "status": "success",
            "message": "All positions squared off",
            "final_stats": bot._calculate_session_stats()
        }
        
    except Exception as e:
        logger.error(f"VWAP square off error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vwap-bot/trades")
async def get_vwap_trades(limit: int = 50):
    """
    Get trade history
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        trades = bot.trades[-limit:] if bot.trades else []
        
        return {
            "status": "success",
            "total_trades": len(bot.trades),
            "trades": trades,
            "stats": bot._calculate_session_stats()
        }
        
    except Exception as e:
        logger.error(f"VWAP trades error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class VWAPBacktestRequest(BaseModel):
    """VWAP Backtest request"""
    symbol: str = Field(..., description="Stock symbol (RELIANCE, TCS, NIFTY, BANKNIFTY)")
    from_date: str = Field(..., description="Start date YYYY-MM-DD")
    to_date: str = Field(..., description="End date YYYY-MM-DD")
    capital: Optional[float] = Field(default=100000, description="Starting capital")
    risk_per_trade: Optional[float] = Field(default=2.0, description="Risk % per trade")
    target_rr: Optional[float] = Field(default=2.0, description="Target Risk-Reward ratio (2.0 = 2:1)")


@router.post("/vwap-bot/backtest")
async def backtest_vwap_strategy(request: VWAPBacktestRequest):
    """
    🔥 BACKTEST VWAP STRATEGY WITH REAL DHAN DATA
    
    Runs the ChartInk VWAP momentum strategy on historical data:
    
    Strategy Rules:
    ═══════════════════════════════════════════════════════════════
    
    BULLISH Entry (LONG):
    1. [-1] 10min Close > [-1] 10min VWAP
    2. [-2] 10min Close > [-2] 10min VWAP
    3. [-2] 10min Close > [-1] 10min High
    → STOP LOSS = Previous candle LOW
    → TARGET = 2:1 Risk-Reward (configurable)
    
    BEARISH Entry (SHORT):
    1. [-1] 10min Close < [-1] 10min VWAP
    2. [-2] 10min Close < [-2] 10min VWAP
    3. [-2] 10min Close < [-1] 10min Low
    → STOP LOSS = Previous candle HIGH
    → TARGET = 2:1 Risk-Reward (configurable)
    
    ═══════════════════════════════════════════════════════════════
    
    Returns detailed backtest results including:
    - Win rate, profit factor, max drawdown
    - All trades with entry/exit details
    - Equity curve
    - Exit analysis (SL/Target/Time exits)
    """
    try:
        bot = get_vwap_bot_instance()
        if not bot:
            raise HTTPException(status_code=500, detail="VWAP bot not available")
        
        result = await bot.backtest_vwap_strategy(
            symbol=request.symbol.upper(),
            from_date=request.from_date,
            to_date=request.to_date,
            capital=request.capital,
            risk_per_trade=request.risk_per_trade,
            target_rr=request.target_rr
        )
        
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message", "Backtest failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VWAP backtest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/bots")
async def debug_bots():
    """Debug endpoint to check all bot states"""
    debug_info = {
        "active_bots_count": len(active_trading_bots),
        "trading_engines_count": len(trading_engines),
        "bots": {}
    }
    
    for bot_id, info in active_trading_bots.items():
        bot_debug = {
            "strategy": info.get("strategy"),
            "status": info.get("status"),
            "started_at": info.get("started_at"),
            "broker": info.get("broker"),
            "has_engine": bot_id in trading_engines
        }
        
        if bot_id in trading_engines:
            engine = trading_engines[bot_id]
            if bot_id in engine.bot_states:
                state = engine.bot_states[bot_id]
                bot_debug["engine_status"] = state.status
                bot_debug["trades_today"] = state.trades_today
                bot_debug["pnl_today"] = state.pnl_today
                bot_debug["error_count"] = state.error_count
                bot_debug["logs"] = state.logs[-10:]
        
        debug_info["bots"][bot_id] = bot_debug
    
    return debug_info


# ============================================
# AI DELTA STRANGLE BOT (QuantStrangle AI)
# ============================================

class DeltaStrangleStartRequest(BaseModel):
    """Request to start AI Delta Strangle bot"""
    user_id: str = Field(default="default")
    broker: str = Field(default="dhan", description="dhan or upstox")
    access_token: str = Field(..., description="Broker access token")
    underlying: str = Field(default="NIFTY", description="NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY")
    num_lots: int = Field(default=1, ge=1, le=20)
    entry_delta: int = Field(default=15, ge=10, le=25, description="Target delta for entry (10-25)")
    adjustment_trigger_delta: int = Field(default=30, ge=25, le=50, description="Delta to trigger adjustment (25-50)")
    roll_target_delta: int = Field(default=15, ge=10, le=20, description="Target delta after rolling (10-20)")
    profit_target_pct: int = Field(default=50, ge=20, le=80, description="Profit target % of premium (20-80)")
    max_loss_multiplier: float = Field(default=2.0, ge=1.0, le=5.0, description="Max loss as multiple of credit")
    use_ai: bool = Field(default=True, description="Enable Claude AI decisions")
    ai_confidence_threshold: int = Field(default=70, ge=50, le=100, description="Min AI confidence to act (50-100)")
    claude_api_key: Optional[str] = Field(default=None, description="Claude API key for AI decisions")
    entry_time: str = Field(default="09:20", description="Entry window start (HH:MM IST)")
    exit_time: str = Field(default="15:15", description="Exit window end (HH:MM IST)")
    max_adjustments_per_day: int = Field(default=3, ge=0, le=10, description="Max adjustments per day (0-10)")


class DeltaStrangleStopRequest(BaseModel):
    """Request to stop AI Delta Strangle bot"""
    user_id: str = Field(default="default")
    close_positions: bool = Field(default=True, description="Close all open positions before stopping")


class DeltaStrangleScanRequest(BaseModel):
    """Request for a single scan"""
    user_id: str = Field(default="default")


class DeltaStrangleConfigRequest(BaseModel):
    """Request to update bot config"""
    user_id: str = Field(default="default")
    underlying: Optional[str] = None
    num_lots: Optional[int] = Field(default=None, ge=1, le=20)
    entry_delta: Optional[int] = Field(default=None, ge=10, le=25)
    adjustment_trigger_delta: Optional[int] = Field(default=None, ge=25, le=50)
    roll_target_delta: Optional[int] = Field(default=None, ge=10, le=20)
    profit_target_pct: Optional[int] = Field(default=None, ge=20, le=80)
    max_loss_multiplier: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    use_ai: Optional[bool] = None
    ai_confidence_threshold: Optional[int] = Field(default=None, ge=50, le=100)


@router.post("/ai-delta-strangle/start")
async def start_ai_delta_strangle(request: DeltaStrangleStartRequest):
    """
    Start the QuantStrangle AI Bot (Claude-powered delta-neutral strangle)
    
    **Strategy:**
    - Entry: Sells OTM Call & Put at 15δ (0.15 delta)
    - Adjustment: When any leg reaches 30δ, roll to 15δ
    - Profit Target: 50% of premium collected
    - Stop Loss: 2x credit received
    
    **AI Features:**
    - Claude 4.5 Sonnet analyzes market conditions
    - Recommends entry timing, adjustments, exits
    - Considers IV, OI, Greeks, support/resistance
    
    **Lot Sizes (auto-enforced):**
    - NIFTY: 65, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 75
    """
    try:
        from services.ai_delta_strangle_bot import AIDeltaStrangleBot, DeltaStrangleConfig
        from services.dhan_service import DhanService
        from services.upstox_service import UpstoxService
        
        user_id = request.user_id
        
        # Check if already running
        if user_id in _ai_delta_strangle_bots:
            existing = _ai_delta_strangle_bots[user_id]
            if existing.status.value == "running":
                return {
                    "status": "already_running",
                    "message": "AI Delta Strangle bot is already running",
                    "bot_status": existing.status.value,
                    "position": existing._get_position_summary()
                }
        
        # Create broker service
        if request.broker.lower() == "upstox":
            broker_service = UpstoxService(request.access_token)
        else:
            broker_service = DhanService(request.access_token)
        
        # Create config
        config = DeltaStrangleConfig(
            underlying=request.underlying.upper(),
            num_lots=request.num_lots,
            entry_delta=request.entry_delta,
            adjustment_trigger_delta=request.adjustment_trigger_delta,
            roll_target_delta=request.roll_target_delta,
            profit_target_pct=request.profit_target_pct,
            max_loss_multiplier=request.max_loss_multiplier,
            use_ai_decisions=request.use_ai,
            ai_confidence_threshold=request.ai_confidence_threshold,
            entry_time=request.entry_time,
            exit_time=request.exit_time,
            max_adjustments_per_day=request.max_adjustments_per_day
        )
        
        # Create and start bot
        bot = AIDeltaStrangleBot(
            broker_service=broker_service,
            access_token=request.access_token,
            broker=request.broker.lower(),
            claude_api_key=request.claude_api_key
        )
        
        result = await bot.start(config)
        
        # Store bot instance
        _ai_delta_strangle_bots[user_id] = bot
        
        return {
            "status": "success",
            "message": f"QuantStrangle AI Bot started for {request.underlying}",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to start AI Delta Strangle bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-delta-strangle/stop")
async def stop_ai_delta_strangle(request: DeltaStrangleStopRequest):
    """Stop the QuantStrangle AI Bot"""
    try:
        user_id = request.user_id
        
        if user_id not in _ai_delta_strangle_bots:
            raise HTTPException(status_code=404, detail="No active AI Delta Strangle bot found")
        
        bot = _ai_delta_strangle_bots[user_id]
        result = await bot.stop(close_positions=request.close_positions)
        
        # Remove from active bots
        del _ai_delta_strangle_bots[user_id]
        
        return {
            "status": "success",
            "message": "QuantStrangle AI Bot stopped",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop AI Delta Strangle bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-delta-strangle/status")
async def get_ai_delta_strangle_status(user_id: str = Query(default="default")):
    """Get current status of QuantStrangle AI Bot"""
    try:
        if user_id not in _ai_delta_strangle_bots:
            return {
                "status": "not_running",
                "message": "No active AI Delta Strangle bot",
                "timestamp": datetime.now().isoformat()
            }
        
        bot = _ai_delta_strangle_bots[user_id]
        
        return {
            "status": "success",
            "bot_status": bot.status.value,
            "config": {
                "underlying": bot.config.underlying,
                "num_lots": bot.config.num_lots,
                "lot_size": bot.config.lot_size,
                "entry_delta": bot.config.entry_delta,
                "adjustment_trigger_delta": bot.config.adjustment_trigger_delta,
                "use_ai": bot.config.use_ai_decisions
            },
            "position": bot._get_position_summary(),
            "last_scan_time": bot.last_scan_time.isoformat() if bot.last_scan_time else None,
            "last_ai_decision": bot.last_ai_decision,
            "logs": bot.logs[-20:],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get AI Delta Strangle status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-delta-strangle/scan")
async def scan_ai_delta_strangle(request: DeltaStrangleScanRequest):
    """
    Perform a single scan with the QuantStrangle AI Bot
    
    Returns live option chain, position Greeks, AI decision
    """
    try:
        user_id = request.user_id
        
        if user_id not in _ai_delta_strangle_bots:
            raise HTTPException(status_code=404, detail="No active AI Delta Strangle bot. Start bot first.")
        
        bot = _ai_delta_strangle_bots[user_id]
        result = await bot.scan_once()
        
        return {
            "status": "success",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI Delta Strangle scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-delta-strangle/option-chain")
async def get_delta_strangle_option_chain(
    user_id: str = Query(default="default"),
    underlying: str = Query(default="NIFTY")
):
    """Get live option chain for the bot"""
    try:
        if user_id not in _ai_delta_strangle_bots:
            raise HTTPException(status_code=404, detail="No active AI Delta Strangle bot. Start bot first.")
        
        bot = _ai_delta_strangle_bots[user_id]
        option_chain = await bot.fetch_option_chain(underlying)
        
        return {
            "status": "success",
            "option_chain": option_chain,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching option chain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-delta-strangle/enter")
async def enter_delta_strangle_position(user_id: str = Body(default="default")):
    """Manually enter a strangle position"""
    try:
        if user_id not in _ai_delta_strangle_bots:
            raise HTTPException(status_code=404, detail="No active AI Delta Strangle bot. Start bot first.")
        
        bot = _ai_delta_strangle_bots[user_id]
        option_chain = await bot.fetch_option_chain()
        result = await bot.enter_strangle(option_chain)
        
        return {
            "status": "success" if result.get("success") else "error",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error entering strangle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-delta-strangle/close")
async def close_delta_strangle_position(user_id: str = Body(default="default")):
    """Manually close all strangle positions"""
    try:
        if user_id not in _ai_delta_strangle_bots:
            raise HTTPException(status_code=404, detail="No active AI Delta Strangle bot. Start bot first.")
        
        bot = _ai_delta_strangle_bots[user_id]
        result = await bot.close_position()
        
        return {
            "status": "success" if result.get("success") else "error",
            **result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing strangle: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-delta-strangle/config")
async def update_delta_strangle_config(request: DeltaStrangleConfigRequest):
    """Update QuantStrangle AI Bot configuration"""
    try:
        user_id = request.user_id
        
        if user_id not in _ai_delta_strangle_bots:
            raise HTTPException(status_code=404, detail="No active AI Delta Strangle bot. Start bot first.")
        
        bot = _ai_delta_strangle_bots[user_id]
        
        # Update config fields
        if request.underlying:
            bot.config.underlying = request.underlying.upper()
            from services.ai_delta_strangle_bot import LOT_SIZES
            bot.config.lot_size = LOT_SIZES.get(bot.config.underlying, 65)
        if request.num_lots is not None:
            bot.config.num_lots = request.num_lots
        if request.entry_delta is not None:
            bot.config.entry_delta = request.entry_delta
        if request.adjustment_trigger_delta is not None:
            bot.config.adjustment_trigger_delta = request.adjustment_trigger_delta
        if request.roll_target_delta is not None:
            bot.config.roll_target_delta = request.roll_target_delta
        if request.profit_target_pct is not None:
            bot.config.profit_target_pct = request.profit_target_pct
        if request.max_loss_multiplier is not None:
            bot.config.max_loss_multiplier = request.max_loss_multiplier
        if request.use_ai is not None:
            bot.config.use_ai_decisions = request.use_ai
        if request.ai_confidence_threshold is not None:
            bot.config.ai_confidence_threshold = request.ai_confidence_threshold
        
        return {
            "status": "success",
            "message": "Configuration updated",
            "config": {
                "underlying": bot.config.underlying,
                "lot_size": bot.config.lot_size,
                "num_lots": bot.config.num_lots,
                "entry_delta": bot.config.entry_delta,
                "adjustment_trigger_delta": bot.config.adjustment_trigger_delta,
                "roll_target_delta": bot.config.roll_target_delta,
                "profit_target_pct": bot.config.profit_target_pct,
                "max_loss_multiplier": bot.config.max_loss_multiplier,
                "use_ai": bot.config.use_ai_decisions,
                "ai_confidence_threshold": bot.config.ai_confidence_threshold
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-delta-strangle/decisions")
async def get_delta_strangle_decisions(
    user_id: str = Query(default="default"),
    limit: int = Query(default=20, ge=1, le=100)
):
    """Get AI decision history"""
    try:
        if user_id not in _ai_delta_strangle_bots:
            return {
                "status": "not_running",
                "decisions": [],
                "timestamp": datetime.now().isoformat()
            }
        
        bot = _ai_delta_strangle_bots[user_id]
        decisions = bot.decision_history[-limit:] if hasattr(bot, 'decision_history') else []
        
        return {
            "status": "success",
            "decisions": decisions,
            "total_decisions": len(bot.decision_history) if hasattr(bot, 'decision_history') else 0,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting decisions: {e}")
        raise HTTPException(status_code=500, detail=str(e))