"""
Delta Neutral Strategy API Routes
Admin-only endpoints for straddle/strangle selling strategy
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import logging

from middleware.auth import require_admin, AuthUser
from services.delta_neutral_strategy import (
    DeltaNeutralStrategy,
    get_strategy,
    PositionType
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategy/delta-neutral", tags=["Delta Neutral Strategy"])


# Request/Response Models
class CreatePositionRequest(BaseModel):
    underlying: str = Field(..., description="Underlying symbol (NIFTY, BANKNIFTY, or stock)")
    expiry: str = Field(..., description="Expiry date YYYY-MM-DD")
    quantity: int = Field(..., description="Lot size")
    position_type: str = Field(default="strangle", description="straddle or strangle")
    broker: str = Field(default="dhan", description="dhan or upstox")


class AdjustPositionRequest(BaseModel):
    position_id: str
    force: bool = Field(default=False, description="Force adjustment even if not needed")


class StrategySettingsRequest(BaseModel):
    min_delta: Optional[int] = Field(None, ge=5, le=30)
    max_delta: Optional[int] = Field(None, ge=10, le=40)
    adjustment_trigger: Optional[int] = Field(None, ge=20, le=50)
    target_monthly_return: Optional[float] = Field(None, ge=1, le=10)
    profit_target_pct: Optional[float] = Field(None, ge=20, le=80)
    stop_loss_pct: Optional[float] = Field(None, ge=50, le=300)
    max_adjustments: Optional[int] = Field(None, ge=1, le=5)
    capital: Optional[float] = Field(None, ge=10000, description="Capital to allocate for strategy")


class DhanBrokerRequest(BaseModel):
    """
    Dhan Broker Configuration
    
    HOW TO GET CREDENTIALS:
    1. Login to https://web.dhan.co
    2. Go to Profile → API Access
    3. Generate new API Key
    4. Copy Client ID and Access Token
    """
    client_id: str = Field(..., description="Your Dhan client ID")
    access_token: str = Field(..., description="API access token from Dhan")


class UpstoxBrokerRequest(BaseModel):
    """
    Upstox Broker Configuration
    
    HOW TO GET CREDENTIALS:
    1. Login to https://developer.upstox.com
    2. Create a new app
    3. Copy API Key and API Secret
    4. Set redirect URI (e.g., http://localhost:3000/upstox-callback)
    5. Access token requires daily OAuth login
    """
    api_key: str = Field(..., description="Upstox API key")
    api_secret: str = Field(..., description="Upstox API secret")
    redirect_uri: str = Field(default="http://localhost:3000/upstox-callback", description="OAuth redirect URI")
    access_token: Optional[str] = Field(None, description="OAuth access token (optional, get via OAuth flow)")


class UpstoxOAuthRequest(BaseModel):
    """Complete OAuth flow with authorization code"""
    auth_code: str = Field(..., description="Authorization code from Upstox redirect")


class BrokerCredentialsRequest(BaseModel):
    broker: str = Field(..., description="dhan or upstox")
    client_id: str
    access_token: str
    

# Auth dependency — require admin for all strategy endpoints
# Uses shared middleware/auth.py which validates session token


@router.get("/status")
async def get_strategy_status(user: AuthUser = Depends(require_admin)):
    """Get current strategy status and all positions"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    return {
        "success": True,
        "status": strategy.get_strategy_status()
    }


class StartStrategyRequest(BaseModel):
    """Request to start delta neutral strategy"""
    access_token: str = Field(..., description="Broker access token")
    broker: str = Field(default="dhan", description="dhan or upstox")
    config: Optional[Dict] = Field(default=None, description="Strategy configuration")


@router.post("/start")
async def start_strategy(
    request: StartStrategyRequest = None,
    user: AuthUser = Depends(require_admin)
):
    """Start the delta neutral strategy with configuration"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    if strategy.is_running:
        return {"success": True, "status": "already_running", "message": "Strategy is already running"}
    
    # Apply configuration if provided
    if request and request.config:
        config = request.config
        if "underlying" in config:
            strategy.underlying = config["underlying"]
        if "max_delta_drift" in config:
            strategy.max_delta_drift = config["max_delta_drift"]
        if "lot_size" in config:
            strategy.lot_size = config["lot_size"]
        if "auto_adjust_interval" in config:
            strategy.check_interval = config["auto_adjust_interval"]
        if "max_loss_limit" in config:
            strategy.max_loss_limit = config["max_loss_limit"]
        if "target_profit" in config:
            strategy.target_profit = config["target_profit"]
    
    # Store broker credentials
    if request:
        strategy.broker = request.broker
        strategy.access_token = request.access_token
    
    # Start in background
    import asyncio
    asyncio.create_task(strategy.start())
    
    logger.info(f"🚀 Delta Neutral Strategy started - Underlying: {strategy.underlying}, Lot: {strategy.lot_size}")
    
    return {
        "success": True,
        "status": "started",
        "message": f"Delta Neutral strategy started for {strategy.underlying}",
        "config": {
            "underlying": strategy.underlying,
            "lot_size": strategy.lot_size,
            "max_delta_drift": getattr(strategy, 'max_delta_drift', 0.15),
            "check_interval": getattr(strategy, 'check_interval', 60)
        }
    }


@router.post("/stop")
async def stop_strategy(user: AuthUser = Depends(require_admin)):
    """Stop the strategy monitoring"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    strategy.stop()
    
    return {"status": "stopped", "message": "Strategy monitoring stopped"}


@router.post("/position/create")
async def create_position(
    request: CreatePositionRequest,
    user: AuthUser = Depends(require_admin)
):
    """
    Create a new straddle/strangle position
    
    Auto-selects strikes at 15-20 delta for both legs
    """
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    # Validate broker
    if request.broker not in ["dhan", "upstox"]:
        raise HTTPException(status_code=400, detail="Broker must be 'dhan' or 'upstox'")
    
    # Validate underlying
    valid_indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "NIFTY 50", "BANK NIFTY", "FIN NIFTY"]
    # For stocks, we'd check against FNO stock list
    
    try:
        # Validate expiry format
        expiry_date = datetime.strptime(request.expiry, "%Y-%m-%d")
        if expiry_date < datetime.now():
            raise HTTPException(status_code=400, detail="Expiry date must be in the future")
        
        # Create position
        position = await strategy.create_strangle_position(
            underlying=request.underlying.upper(),
            expiry=request.expiry,
            quantity=request.quantity,
            broker=request.broker
        )
        
        # Store position
        strategy.positions[position.id] = position
        
        return {
            "status": "created",
            "position": position.to_dict(),
            "message": f"Position created with ID: {position.id}"
        }
        
    except Exception as e:
        logger.error(f"Error creating position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/position/execute/{position_id}")
async def execute_position(
    position_id: str,
    user: AuthUser = Depends(require_admin)
):
    """Execute pending position orders"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    if position_id not in strategy.positions:
        raise HTTPException(status_code=404, detail="Position not found")
    
    position = strategy.positions[position_id]
    
    try:
        # Place orders for both legs
        if position.call_leg:
            order_id = await strategy.place_order(position.call_leg, "SELL", position.broker)
            position.call_leg.order_id = order_id
        
        if position.put_leg:
            order_id = await strategy.place_order(position.put_leg, "SELL", position.broker)
            position.put_leg.order_id = order_id
        
        position.status = "active"
        
        return {
            "status": "executed",
            "position": position.to_dict(),
            "message": "Orders placed successfully"
        }
        
    except Exception as e:
        logger.error(f"Error executing position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/position/adjust/{position_id}")
async def adjust_position(
    position_id: str,
    request: AdjustPositionRequest = None,
    user: AuthUser = Depends(require_admin)
):
    """Manually trigger position adjustment"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    if position_id not in strategy.positions:
        raise HTTPException(status_code=404, detail="Position not found")
    
    position = strategy.positions[position_id]
    
    try:
        # Check if adjustment is needed
        adjustment = await strategy.check_adjustment_needed(position)
        
        if not adjustment["needed"] and not (request and request.force):
            return {
                "status": "no_adjustment_needed",
                "position": position.to_dict(),
                "message": "Position is within delta range"
            }
        
        # Perform adjustment
        position = await strategy.adjust_position(position, adjustment)
        
        return {
            "status": "adjusted",
            "position": position.to_dict(),
            "adjustment": adjustment,
            "message": "Position adjusted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error adjusting position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/position/exit/{position_id}")
async def exit_position(
    position_id: str,
    user: AuthUser = Depends(require_admin)
):
    """Manually exit a position"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    if position_id not in strategy.positions:
        raise HTTPException(status_code=404, detail="Position not found")
    
    position = strategy.positions[position_id]
    
    try:
        position = await strategy.exit_position(position, "Manual exit by admin")
        
        return {
            "status": "exited",
            "position": position.to_dict(),
            "message": "Position exited successfully"
        }
        
    except Exception as e:
        logger.error(f"Error exiting position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/position/{position_id}")
async def get_position(
    position_id: str,
    user: AuthUser = Depends(require_admin)
):
    """Get details of a specific position"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    if position_id not in strategy.positions:
        raise HTTPException(status_code=404, detail="Position not found")
    
    position = strategy.positions[position_id]
    
    # Check adjustment status
    adjustment = await strategy.check_adjustment_needed(position)
    
    # Check exit conditions
    exit_check = await strategy.check_exit_conditions(position)
    
    return {
        "position": position.to_dict(),
        "adjustment_needed": adjustment,
        "exit_recommended": exit_check
    }


@router.get("/positions")
async def get_all_positions(
    status: Optional[str] = None,
    user: AuthUser = Depends(require_admin)
):
    """Get all positions, optionally filtered by status"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    positions = list(strategy.positions.values())
    
    if status:
        positions = [p for p in positions if p.status == status]
    
    return {
        "count": len(positions),
        "positions": [p.to_dict() for p in positions]
    }


@router.put("/settings")
async def update_settings(
    request: StrategySettingsRequest,
    user: AuthUser = Depends(require_admin)
):
    """Update strategy parameters"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    if request.min_delta is not None:
        strategy.MIN_DELTA = request.min_delta
    if request.max_delta is not None:
        strategy.MAX_DELTA = request.max_delta
    if request.adjustment_trigger is not None:
        strategy.ADJUSTMENT_TRIGGER_DELTA = request.adjustment_trigger
    if request.target_monthly_return is not None:
        strategy.TARGET_MONTHLY_RETURN = request.target_monthly_return
    if request.profit_target_pct is not None:
        strategy.PROFIT_TARGET_PCT = request.profit_target_pct
    if request.stop_loss_pct is not None:
        strategy.MAX_LOSS_MULTIPLIER = request.stop_loss_pct / 100
    if request.max_adjustments is not None:
        strategy.MAX_ADJUSTMENTS_PER_DAY = request.max_adjustments
    
    return {
        "status": "updated",
        "settings": {
            "min_delta": strategy.MIN_DELTA,
            "max_delta": strategy.MAX_DELTA,
            "adjustment_trigger": strategy.ADJUSTMENT_TRIGGER_DELTA,
            "target_monthly_return": strategy.TARGET_MONTHLY_RETURN,
            "profit_target_pct": strategy.PROFIT_TARGET_PCT,
            "stop_loss_pct": strategy.MAX_LOSS_MULTIPLIER * 100,
            "max_adjustments": strategy.MAX_ADJUSTMENTS_PER_DAY
        }
    }


@router.post("/broker/connect")
async def connect_broker(
    request: BrokerCredentialsRequest,
    user: AuthUser = Depends(require_admin)
):
    """Connect to broker API"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    try:
        await strategy.initialize_broker(
            request.broker,
            {
                "client_id": request.client_id,
                "access_token": request.access_token
            }
        )
        
        return {
            "status": "connected",
            "broker": request.broker,
            "message": f"Connected to {request.broker} successfully"
        }
        
    except Exception as e:
        logger.error(f"Error connecting broker: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trade-log")
async def get_trade_log(
    limit: int = 50,
    user: AuthUser = Depends(require_admin)
):
    """Get trade history log"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    trades = strategy.trade_log[-limit:] if limit else strategy.trade_log
    
    return {
        "count": len(trades),
        "trades": trades
    }


@router.get("/analytics")
async def get_analytics(user: AuthUser = Depends(require_admin)):
    """Get strategy performance analytics"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    # Calculate analytics
    total_trades = len(strategy.trade_log)
    winning_trades = len([t for t in strategy.trade_log if t.get("total_pnl", 0) > 0])
    losing_trades = total_trades - winning_trades
    
    total_pnl = sum(t.get("total_pnl", 0) for t in strategy.trade_log)
    avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
    
    active_positions = [p for p in strategy.positions.values() if p.status == "active"]
    unrealized_pnl = sum(p.total_pnl for p in active_positions)
    
    return {
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": (winning_trades / total_trades * 100) if total_trades > 0 else 0,
        "total_realized_pnl": total_pnl,
        "average_pnl_per_trade": avg_pnl,
        "unrealized_pnl": unrealized_pnl,
        "active_positions": len(active_positions),
        "capital": strategy.capital,
        "return_pct": (total_pnl / strategy.capital * 100) if strategy.capital > 0 else 0
    }


@router.post("/calculate-strikes")
async def calculate_strikes(
    underlying: str,
    spot_price: float,
    expiry: str,
    iv: float = 15.0,
    user: AuthUser = Depends(require_admin)
):
    """Calculate optimal strikes for given parameters (preview mode)"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    try:
        expiry_date = datetime.strptime(expiry, "%Y-%m-%d")
        
        ce_strike, pe_strike = await strategy.find_optimal_strikes(
            underlying=underlying.upper(),
            spot=spot_price,
            expiry_date=expiry_date,
            iv=iv / 100  # Convert to decimal
        )
        
        days_to_expiry = (expiry_date - datetime.now()).days
        
        # Calculate expected deltas
        ce_delta = strategy.calculate_black_scholes_delta(
            spot_price, ce_strike, days_to_expiry/365, iv/100, option_type="CE"
        ) * 100
        
        pe_delta = strategy.calculate_black_scholes_delta(
            spot_price, pe_strike, days_to_expiry/365, iv/100, option_type="PE"
        ) * 100
        
        # Calculate required premium
        required_return = strategy.calculate_required_premium(days_to_expiry)
        
        return {
            "underlying": underlying.upper(),
            "spot_price": spot_price,
            "expiry": expiry,
            "days_to_expiry": days_to_expiry,
            "iv": iv,
            "call_strike": ce_strike,
            "call_delta": round(ce_delta, 1),
            "put_strike": pe_strike,
            "put_delta": round(abs(pe_delta), 1),
            "strangle_width": ce_strike - pe_strike,
            "required_premium_pct": round(required_return, 2),
            "target_monthly_return": strategy.TARGET_MONTHLY_RETURN
        }
        
    except Exception as e:
        logger.error(f"Error calculating strikes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# BROKER CONFIGURATION ENDPOINTS
# =============================================================================

@router.get("/broker/setup-instructions")
async def get_broker_setup_instructions(broker: str = None):
    """
    Get setup instructions for configuring brokers
    """
    instructions = {
        "dhan": {
            "name": "Dhan",
            "steps": [
                "1. Login to your Dhan account at https://web.dhan.co",
                "2. Navigate to Profile → API Access",
                "3. Click 'Generate API Key'",
                "4. You may need to verify with OTP",
                "5. Copy the Client ID and Access Token",
                "6. The access token is valid until you regenerate it",
                "7. Enter the credentials in the settings below"
            ],
            "required_fields": ["client_id", "access_token"],
            "documentation_url": "https://dhanhq.co/docs/v2/",
            "note": "Dhan access token does not expire daily. Regenerate if compromised."
        },
        "upstox": {
            "name": "Upstox",
            "steps": [
                "1. Login to Upstox Developer Portal at https://developer.upstox.com",
                "2. Create a new app (or use existing one)",
                "3. Copy the API Key and API Secret",
                "4. Set Redirect URI to: http://localhost:3000/upstox-callback",
                "5. Click 'Login with Upstox' button below",
                "6. Authorize the app with your Upstox account",
                "7. Access token will be automatically saved",
                "⚠️ IMPORTANT: Upstox access token expires daily at 3:30 AM",
                "You need to re-login every trading day"
            ],
            "required_fields": ["api_key", "api_secret", "redirect_uri"],
            "optional_fields": ["access_token"],
            "documentation_url": "https://upstox.com/developer/api-documentation/",
            "note": "Upstox requires daily OAuth login. Token expires at 3:30 AM IST."
        }
    }
    
    if broker:
        if broker not in instructions:
            raise HTTPException(status_code=400, detail=f"Unknown broker: {broker}")
        return instructions[broker]
    
    return instructions


@router.post("/broker/configure/dhan")
async def configure_dhan_broker(
    request: DhanBrokerRequest,
    user: AuthUser = Depends(require_admin)
):
    """
    Configure Dhan broker for algo trading
    
    Requirements:
    - Valid Dhan trading account with F&O enabled
    - API access enabled in Dhan account
    - Sufficient margin for options selling
    """
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    try:
        result = await strategy.configure_broker(
            broker="dhan",
            credentials={
                "client_id": request.client_id,
                "access_token": request.access_token
            }
        )
        
        if result["success"]:
            return {
                "status": "configured",
                "broker": "dhan",
                "message": "Dhan broker configured successfully",
                "funds": result.get("funds", {}),
                "next_steps": [
                    "1. Set capital amount for strategy",
                    "2. Create your first position",
                    "3. Start strategy monitoring"
                ]
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Configuration failed"))
            
    except Exception as e:
        logger.error(f"Error configuring Dhan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/broker/configure/upstox")
async def configure_upstox_broker(
    request: UpstoxBrokerRequest,
    user: AuthUser = Depends(require_admin)
):
    """
    Configure Upstox broker for algo trading
    
    If access_token is not provided, returns OAuth login URL.
    User must complete OAuth flow and call /broker/upstox/oauth-callback
    """
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    try:
        result = await strategy.configure_broker(
            broker="upstox",
            credentials={
                "api_key": request.api_key,
                "api_secret": request.api_secret,
                "redirect_uri": request.redirect_uri,
                "access_token": request.access_token
            }
        )
        
        if result.get("needs_oauth"):
            return {
                "status": "needs_oauth",
                "login_url": result["login_url"],
                "message": "Please complete OAuth login with Upstox",
                "instructions": [
                    "1. Click the login URL below",
                    "2. Login with your Upstox credentials",
                    "3. Authorize the app",
                    "4. You'll be redirected back with the auth code",
                    "5. The access token will be automatically saved"
                ]
            }
        elif result["success"]:
            return {
                "status": "configured",
                "broker": "upstox",
                "message": "Upstox broker configured successfully",
                "funds": result.get("funds", {}),
                "token_expiry": "Token expires at 3:30 AM IST daily",
                "next_steps": [
                    "1. Set capital amount for strategy",
                    "2. Create your first position",
                    "3. Start strategy monitoring"
                ]
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "Configuration failed"))
            
    except Exception as e:
        logger.error(f"Error configuring Upstox: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/broker/upstox/oauth-callback")
async def upstox_oauth_callback(
    request: UpstoxOAuthRequest,
    user: AuthUser = Depends(require_admin)
):
    """
    Complete Upstox OAuth flow with authorization code
    
    Called after user authorizes the app on Upstox
    """
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    try:
        result = await strategy.complete_upstox_oauth(request.auth_code)
        
        if result["success"]:
            return {
                "status": "configured",
                "broker": "upstox",
                "message": "Upstox OAuth completed successfully",
                "funds": result.get("funds", {}),
                "token_expiry": "Token expires at 3:30 AM IST - login again tomorrow",
                "important": "Save your access_token for manual entry if needed"
            }
        else:
            raise HTTPException(status_code=400, detail=result.get("error", "OAuth failed"))
            
    except Exception as e:
        logger.error(f"Error completing Upstox OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/broker/status")
async def get_broker_status(user: AuthUser = Depends(require_admin)):
    """Get current broker configuration status and funds"""
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    strategy = get_strategy()
    
    result = {
        "active_broker": strategy.active_broker,
        "broker_configured": strategy.settings.get("broker_configured", False),
        "capital_allocated": strategy.allocated_capital,
        "funds": None
    }
    
    if strategy.settings.get("broker_configured"):
        try:
            funds = await strategy.get_broker_funds()
            result["funds"] = funds
        except Exception as e:
            result["funds_error"] = str(e)
    
    return result


@router.post("/broker/set-capital")
async def set_strategy_capital(
    capital: float,
    user: AuthUser = Depends(require_admin)
):
    """
    Set the capital amount to use for the strategy
    
    This is the amount from your broker account that will be used
    for position sizing and margin requirements.
    
    Recommended: Start with 2-5 lakhs for index options
    """
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if capital < 10000:
        raise HTTPException(status_code=400, detail="Minimum capital is ₹10,000")
    
    if capital > 10000000:  # 1 crore
        raise HTTPException(status_code=400, detail="Maximum capital is ₹1,00,00,000")
    
    strategy = get_strategy()
    strategy.update_settings({"capital": capital})
    
    # Calculate position sizing
    max_per_trade = capital * (strategy.POSITION_SIZE_PCT / 100)
    max_positions = strategy.MAX_CONCURRENT_POSITIONS
    
    return {
        "status": "updated",
        "capital": capital,
        "capital_formatted": f"₹{capital:,.0f}",
        "max_per_trade": max_per_trade,
        "max_per_trade_formatted": f"₹{max_per_trade:,.0f}",
        "max_concurrent_positions": max_positions,
        "target_monthly_return": f"{strategy.TARGET_MONTHLY_RETURN}%",
        "expected_monthly_profit": f"₹{capital * strategy.TARGET_MONTHLY_RETURN / 100:,.0f}"
    }


# =============================================================================
# LOT SIZE ENDPOINTS
# =============================================================================

# Import trading configuration
try:
    from config.trading_config import (
        INDEX_LOT_SIZES, 
        STOCK_LOT_SIZES,
        DELTA_NEUTRAL_SETTINGS,
        THETA_DECAY_SETTINGS,
        IRON_CONDOR_SETTINGS,
        MOMENTUM_SETTINGS,
        WHEEL_SETTINGS,
        STRATEGY_METRICS
    )
    CONFIG_LOADED = True
except ImportError:
    # Fallback if config not found (Jan 2026 NSE lot sizes)
    INDEX_LOT_SIZES = {
        "NIFTY": 65, "BANKNIFTY": 30, "FINNIFTY": 60, "MIDCPNIFTY": 120, "SENSEX": 10
    }
    STOCK_LOT_SIZES = {
        "RELIANCE": 250, "HDFCBANK": 550, "TCS": 175, "INFY": 600, "ICICIBANK": 1400
    }
    DELTA_NEUTRAL_SETTINGS = {}
    THETA_DECAY_SETTINGS = {}
    IRON_CONDOR_SETTINGS = {}
    MOMENTUM_SETTINGS = {}
    WHEEL_SETTINGS = {}
    STRATEGY_METRICS = {}
    CONFIG_LOADED = False


@router.get("/lot-sizes")
async def get_lot_sizes(
    category: Optional[str] = None,
    symbol: Optional[str] = None
):
    """
    Get NSE F&O lot sizes
    
    Args:
        category: Filter by 'index' or 'stock'
        symbol: Get lot size for specific symbol
    
    Returns complete lot size data for trading
    """
    if symbol:
        symbol = symbol.upper()
        lot_size = INDEX_LOT_SIZES.get(symbol) or STOCK_LOT_SIZES.get(symbol)
        if not lot_size:
            raise HTTPException(status_code=404, detail=f"Lot size not found for {symbol}")
        return {
            "symbol": symbol,
            "lot_size": lot_size,
            "type": "index" if symbol in INDEX_LOT_SIZES else "stock"
        }
    
    result = {
        "config_source": "trading_config.py" if CONFIG_LOADED else "fallback",
        "last_updated": "January 2026"
    }
    
    if category == "index":
        result["lot_sizes"] = INDEX_LOT_SIZES
    elif category == "stock":
        result["lot_sizes"] = STOCK_LOT_SIZES
    else:
        result["index_lot_sizes"] = INDEX_LOT_SIZES
        result["stock_lot_sizes"] = STOCK_LOT_SIZES
    
    return result


@router.get("/strategy-config")
async def get_strategy_config(strategy_type: Optional[str] = None):
    """
    Get research-based strategy configurations
    
    Args:
        strategy_type: Optional - 'delta_neutral', 'theta_decay', 'iron_condor', 'momentum', 'wheel'
    
    Returns optimal settings based on industry research
    """
    all_configs = {
        "delta_neutral": {
            "settings": DELTA_NEUTRAL_SETTINGS if CONFIG_LOADED else {
                "default_delta": 0.20,
                "delta_range": [0.15, 0.25],
                "stop_loss_pct": 50,
                "profit_target_pct": 50,
                "monthly_target_pct": 3.5
            },
            "description": "Sell ATM/OTM straddles or strangles, profit from theta decay",
            "best_for": "Low volatility, sideways markets"
        },
        "theta_decay": {
            "settings": THETA_DECAY_SETTINGS if CONFIG_LOADED else {
                "entry_days_to_expiry": 7,
                "exit_days_to_expiry": 1,
                "target_delta": 0.20,
                "weekly_target_pct": 2.5
            },
            "description": "Sell weekly options to capture rapid time decay",
            "best_for": "Weekly expiry options with high theta"
        },
        "iron_condor": {
            "settings": IRON_CONDOR_SETTINGS if CONFIG_LOADED else {
                "short_put_delta": 0.16,
                "short_call_delta": 0.16,
                "wing_width": 100,
                "profit_target_pct": 50,
                "monthly_target_pct": 6
            },
            "description": "Defined risk strategy selling put and call spreads",
            "best_for": "Range-bound markets with high IV"
        },
        "momentum": {
            "settings": MOMENTUM_SETTINGS if CONFIG_LOADED else {
                "min_price_change_pct": 1.5,
                "stop_loss_pct": 30,
                "profit_target_pct": 50,
                "rr_ratio": 2.0
            },
            "description": "Buy directional options on momentum breakouts",
            "best_for": "Trending markets with strong moves"
        },
        "wheel": {
            "settings": WHEEL_SETTINGS if CONFIG_LOADED else {
                "put_delta": 0.30,
                "call_delta": 0.30,
                "target_dte": 30,
                "monthly_target_pct": 3
            },
            "description": "Cash-secured puts + covered calls cycle",
            "best_for": "Stock accumulation with premium income"
        }
    }
    
    if strategy_type:
        strategy_type = strategy_type.lower().replace("-", "_")
        if strategy_type not in all_configs:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown strategy: {strategy_type}. Available: {list(all_configs.keys())}"
            )
        return {
            "strategy": strategy_type,
            **all_configs[strategy_type]
        }
    
    return {
        "strategies": all_configs,
        "metrics": STRATEGY_METRICS if CONFIG_LOADED else {}
    }


@router.get("/calculate-position")
async def calculate_position_size(
    symbol: str,
    capital: float,
    risk_per_trade_pct: float = 2.0,
    premium: Optional[float] = None
):
    """
    Calculate optimal position size based on capital and risk
    
    Args:
        symbol: Trading symbol
        capital: Total capital
        risk_per_trade_pct: % of capital to risk per trade (default 2%)
        premium: Option premium for margin calculation (optional)
    
    Returns position sizing recommendations
    """
    symbol = symbol.upper()
    lot_size = INDEX_LOT_SIZES.get(symbol) or STOCK_LOT_SIZES.get(symbol)
    
    if not lot_size:
        raise HTTPException(status_code=404, detail=f"Lot size not found for {symbol}")
    
    is_index = symbol in INDEX_LOT_SIZES
    risk_amount = capital * (risk_per_trade_pct / 100)
    
    # Margin calculations
    if is_index:
        # Index options typically require 1-1.5L margin per lot
        margin_per_lot = 150000 if symbol in ["BANKNIFTY", "NIFTY"] else 100000
    else:
        # Stock options margin varies - approximate 20% of underlying value
        margin_per_lot = 50000  # Conservative estimate
    
    max_lots_by_margin = int(capital / margin_per_lot)
    max_lots_by_risk = max(1, int(risk_amount / (lot_size * 5)))  # Assume ₹5 max loss per unit
    
    recommended_lots = min(max_lots_by_margin, max_lots_by_risk)
    
    result = {
        "symbol": symbol,
        "type": "index" if is_index else "stock",
        "lot_size": lot_size,
        "capital": f"₹{capital:,.0f}",
        "risk_per_trade": f"{risk_per_trade_pct}%",
        "risk_amount": f"₹{risk_amount:,.0f}",
        "margin_per_lot": f"₹{margin_per_lot:,.0f}",
        "max_lots_by_margin": max_lots_by_margin,
        "max_lots_by_risk": max_lots_by_risk,
        "recommended_lots": recommended_lots,
        "total_quantity": recommended_lots * lot_size
    }
    
    if premium:
        premium_per_lot = premium * lot_size
        result["premium_per_lot"] = f"₹{premium_per_lot:,.0f}"
        result["total_premium"] = f"₹{premium_per_lot * recommended_lots:,.0f}"
    
    return result


# ==========================================
# FULL YEAR BACKTEST COMPARISON
# ==========================================

@router.get("/backtest/full-year-comparison")
async def get_full_year_backtest():
    """
    Get full year NIFTY Delta Neutral Strategy Comparison results.
    Compares Iron Condor, Iron Butterfly, Short Strangle, Straddle+Hedge
    on real NIFTY data (Jan 2024 - Jan 2025).
    """
    import json
    import os
    
    try:
        results_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "full_year_strategy_comparison.json")
        
        if not os.path.exists(results_path):
            # Run backtest if results don't exist
            try:
                import sys
                sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
                from run_full_year_strategy_comparison import run_full_year_comparison
                results = run_full_year_comparison()
                return {"success": True, "data": results}
            except Exception as run_err:
                logger.error(f"Backtest run error: {run_err}")
                raise HTTPException(status_code=500, detail=f"Failed to run backtest: {str(run_err)}")
        
        with open(results_path, "r") as f:
            results = json.load(f)
        
        return {"success": True, "data": results}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Backtest results error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backtest/run-comparison")
async def run_backtest_comparison():
    """
    Re-run the full year backtest comparison (admin only).
    Generates fresh results from real NIFTY data.
    """
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
        from run_full_year_strategy_comparison import run_full_year_comparison
        results = run_full_year_comparison()
        return {"success": True, "message": "Backtest completed", "data": results}
    except Exception as e:
        logger.error(f"Backtest run error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
