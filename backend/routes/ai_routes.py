"""
AI Advisor Routes
API endpoints for AI trading analysis, scalping bots, and token management
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from services.token_service import token_service

# Try to import advanced AI service, fallback to basic
try:
    from services.advanced_ai_service import advanced_ai_advisor as ai_advisor
    logger_msg = "Using advanced AI service"
except ImportError:
    from services.ai_advisor_service import ai_advisor
    logger_msg = "Using basic AI service"

logger = logging.getLogger(__name__)
logger.info(logger_msg)
router = APIRouter(prefix="/ai", tags=["AI Advisor"])


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class BrokerCredentials(BaseModel):
    broker: str = "dhan"
    access_token: str
    client_id: Optional[str] = None

class TokenRechargeRequest(BaseModel):
    package_id: str
    transaction_id: Optional[str] = None

class TokenUseRequest(BaseModel):
    action: str
    count: int = 1

class PositionAnalysisRequest(BaseModel):
    position: Dict[str, Any]

class DateRangeRequest(BaseModel):
    from_date: Optional[str] = None
    to_date: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# TOKEN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/tokens/balance")
async def get_token_balance(x_user_id: str = Header(..., alias="X-User-Id")):
    """Get user's current token balance"""
    try:
        balance = await token_service.get_balance(x_user_id)
        return {"success": True, **balance}
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tokens/packages")
async def get_token_packages():
    """Get available token packages for purchase"""
    packages = token_service.get_packages()
    costs = token_service.get_action_costs()
    return {
        "success": True,
        "packages": packages,
        "action_costs": costs
    }


@router.post("/tokens/recharge")
async def recharge_tokens(
    request: TokenRechargeRequest,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """Add tokens after successful payment"""
    try:
        result = await token_service.add_tokens(
            x_user_id, 
            request.package_id, 
            request.transaction_id
        )
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recharging tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tokens/history")
async def get_token_history(
    x_user_id: str = Header(..., alias="X-User-Id"),
    limit: int = 50
):
    """Get user's token usage history"""
    try:
        history = await token_service.get_usage_history(x_user_id, limit)
        return {"success": True, "history": history}
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tokens/check/{action}")
async def check_can_use_tokens(
    action: str,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """Check if user has enough tokens for an action"""
    result = await token_service.check_can_use(x_user_id, action)
    return {"success": True, **result}


@router.post("/tokens/use")
async def use_tokens(
    request: TokenUseRequest,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """Use/deduct tokens for an action (e.g. bot_start)"""
    try:
        result = await token_service.use_tokens(x_user_id, request.action, request.count)
        return result
    except Exception as e:
        logger.error(f"Error using tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# AI ANALYSIS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/analyze/trades")
async def analyze_user_trades(
    credentials: BrokerCredentials,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """
    Fetch trades from broker and analyze with AI
    Consumes 20 tokens for full portfolio analysis
    """
    # Check token balance first
    can_use = await token_service.check_can_use(x_user_id, "portfolio_review")
    if not can_use["can_use"]:
        return {
            "success": False,
            "error": "Insufficient tokens",
            "required": can_use["cost"],
            "balance": can_use["balance"],
            "recharge_needed": True
        }
    
    try:
        # Fetch trades from broker
        trades_data = await ai_advisor.fetch_user_trades(credentials.access_token)
        
        if not trades_data["success"]:
            raise HTTPException(status_code=400, detail=trades_data.get("error", "Failed to fetch trades"))
        
        # Analyze trades with AI
        analysis_result = await ai_advisor.analyze_trades(trades_data)
        
        # Consume tokens on success
        token_result = await token_service.use_tokens(x_user_id, "portfolio_review")
        
        return {
            "success": True,
            "trades": {
                "orders_count": len(trades_data.get("orders", [])),
                "positions_count": len(trades_data.get("positions", [])),
                "holdings_count": len(trades_data.get("holdings", [])),
            },
            "analysis": analysis_result.get("analysis", {}),
            "tokens_used": token_result.get("tokens_used", 0),
            "remaining_balance": token_result.get("remaining_balance", 0),
            "analyzed_at": analysis_result.get("analyzed_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/position")
async def analyze_single_position(
    request: PositionAnalysisRequest,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """
    Get AI suggestion for a specific position
    Consumes 10 tokens
    """
    # Check token balance
    can_use = await token_service.check_can_use(x_user_id, "strategy_suggestion")
    if not can_use["can_use"]:
        return {
            "success": False,
            "error": "Insufficient tokens",
            "required": can_use["cost"],
            "balance": can_use["balance"],
            "recharge_needed": True
        }
    
    try:
        # Get AI suggestion
        suggestion_result = await ai_advisor.get_strategy_suggestion(request.position)
        
        if suggestion_result["success"]:
            # Consume tokens
            token_result = await token_service.use_tokens(x_user_id, "strategy_suggestion")
            
            return {
                "success": True,
                "suggestion": suggestion_result.get("suggestion", {}),
                "tokens_used": token_result.get("tokens_used", 0),
                "remaining_balance": token_result.get("remaining_balance", 0)
            }
        else:
            return suggestion_result
            
    except Exception as e:
        logger.error(f"Error analyzing position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fetch/trades")
async def fetch_broker_trades(
    credentials: BrokerCredentials,
    date_range: Optional[DateRangeRequest] = None
):
    """
    Fetch trades from broker without AI analysis
    Does not consume tokens
    """
    try:
        from_date = date_range.from_date if date_range else None
        to_date = date_range.to_date if date_range else None
        
        trades_data = await ai_advisor.fetch_user_trades(
            credentials.access_token, 
            from_date, 
            to_date
        )
        
        return trades_data
        
    except Exception as e:
        logger.error(f"Error fetching trades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_ai_status():
    """Check AI service status - Powered by Claude 4.5 Opus"""
    import os
    anthropic_configured = bool(os.getenv("ANTHROPIC_API_KEY", ""))
    
    return {
        "success": True,
        "ai_available": anthropic_configured,
        "model": "Claude 4.5 Opus" if anthropic_configured else None,
        "provider": "Anthropic",
        "supported_brokers": ["dhan"],
        "actions": token_service.get_action_costs(),
        "features": [
            "deep_portfolio_analysis",
            "scalping_strategies", 
            "position_advice", 
            "real_time_signals",
            "algo_bot_trading"
        ],
        "powered_by": "Claude AI - The Most Intelligent Trading Analysis"
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SCALPING BOT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class ScalpingStrategyRequest(BaseModel):
    instruments: str = "NIFTY, BANKNIFTY Options"
    capital: float = 100000
    risk_per_trade: float = 1.0

@router.post("/scalping/strategy")
async def generate_scalping_strategy(
    request: ScalpingStrategyRequest,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """
    Generate AI-powered scalping strategy
    Consumes 10 tokens
    """
    can_use = await token_service.check_can_use(x_user_id, "strategy_suggestion")
    if not can_use["can_use"]:
        return {
            "success": False,
            "error": "Insufficient tokens",
            "required": can_use["cost"],
            "balance": can_use["balance"],
            "recharge_needed": True
        }
    
    try:
        # Check if advanced AI service is available
        if hasattr(ai_advisor, 'generate_scalping_strategy'):
            result = await ai_advisor.generate_scalping_strategy(
                instruments=request.instruments,
                capital=request.capital,
                risk_per_trade=request.risk_per_trade
            )
        else:
            result = {
                "success": True,
                "strategy": {
                    "name": "Basic Momentum Scalper",
                    "note": "Enable advanced AI service for custom strategies"
                }
            }
        
        if result["success"]:
            token_result = await token_service.use_tokens(x_user_id, "strategy_suggestion")
            result["tokens_used"] = token_result.get("tokens_used", 0)
            result["remaining_balance"] = token_result.get("remaining_balance", 0)
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RealTimeSignalRequest(BaseModel):
    symbol: str
    current_price: float
    position_data: Optional[Dict[str, Any]] = None

@router.post("/signal/generate")
async def generate_trading_signal(
    request: RealTimeSignalRequest,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """
    Generate real-time trading signal
    Consumes 5 tokens
    """
    can_use = await token_service.check_can_use(x_user_id, "trade_analysis")
    if not can_use["can_use"]:
        return {
            "success": False,
            "error": "Insufficient tokens",
            "required": can_use["cost"],
            "balance": can_use["balance"],
            "recharge_needed": True
        }
    
    try:
        if hasattr(ai_advisor, 'get_real_time_signal'):
            result = await ai_advisor.get_real_time_signal(
                symbol=request.symbol,
                current_price=request.current_price,
                position_data=request.position_data
            )
        else:
            result = {
                "success": False,
                "error": "Real-time signals require advanced AI service"
            }
        
        if result.get("success"):
            token_result = await token_service.use_tokens(x_user_id, "trade_analysis")
            result["tokens_used"] = token_result.get("tokens_used", 0)
            result["remaining_balance"] = token_result.get("remaining_balance", 0)
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/deep")
async def deep_portfolio_analysis(
    credentials: BrokerCredentials,
    x_user_id: str = Header(..., alias="X-User-Id")
):
    """
    Perform deep AI analysis on portfolio
    Uses advanced prompts for comprehensive insights
    Consumes 20 tokens
    """
    can_use = await token_service.check_can_use(x_user_id, "portfolio_review")
    if not can_use["can_use"]:
        return {
            "success": False,
            "error": "Insufficient tokens",
            "required": can_use["cost"],
            "balance": can_use["balance"],
            "recharge_needed": True
        }
    
    try:
        # Fetch trades
        trades_data = await ai_advisor.fetch_user_trades(credentials.access_token)
        
        if not trades_data["success"]:
            raise HTTPException(status_code=400, detail=trades_data.get("error", "Failed to fetch trades"))
        
        # Use deep analysis if available
        if hasattr(ai_advisor, 'deep_portfolio_analysis'):
            analysis_result = await ai_advisor.deep_portfolio_analysis(trades_data)
        else:
            analysis_result = await ai_advisor.analyze_trades(trades_data)
        
        # Consume tokens
        token_result = await token_service.use_tokens(x_user_id, "portfolio_review")
        
        return {
            "success": True,
            "trades": {
                "orders_count": len(trades_data.get("orders", [])),
                "positions_count": len(trades_data.get("positions", [])),
                "holdings_count": len(trades_data.get("holdings", [])),
            },
            "analysis": analysis_result.get("analysis", {}),
            "analysis_type": analysis_result.get("analysis_type", "standard"),
            "tokens_used": token_result.get("tokens_used", 0),
            "remaining_balance": token_result.get("remaining_balance", 0),
            "analyzed_at": analysis_result.get("analyzed_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in deep analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))
