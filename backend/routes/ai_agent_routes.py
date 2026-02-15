"""
AI Autonomous Agent API Routes
===============================

Endpoints for:
- Starting/stopping the autonomous AI trading agent
- Getting agent status, decisions, event feed
- Configuring agent parameters
- Viewing agent memory and thought logs
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel, Field
from typing import Dict, Optional, List, Any
from datetime import datetime
import logging
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from middleware.auth import get_current_user
from services.ai_agent_engine import (
    AutonomousAIAgent, AgentConfig, AgentState, RiskLevel,
    get_agent, get_or_create_agent, remove_agent, list_agents
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-agent", tags=["AI Agent"], dependencies=[Depends(get_current_user)])


# ============================================
# REQUEST MODELS
# ============================================

class AgentStartRequest(BaseModel):
    """Request to start the AI agent"""
    user_id: str = Field(default="default", description="User ID")
    underlying: str = Field(default="NIFTY", description="NIFTY, BANKNIFTY, etc.")
    risk_level: str = Field(default="moderate", description="conservative, moderate, aggressive")
    max_capital: float = Field(default=500000, description="Max capital in INR")
    use_mock: bool = Field(default=True, description="Use mock mode (paper trading)")
    auto_enter: bool = Field(default=True, description="Auto-enter trades")
    auto_exit: bool = Field(default=True, description="Auto-exit trades")
    auto_adjust: bool = Field(default=True, description="Auto-adjust positions")
    think_interval: int = Field(default=60, description="Seconds between think cycles")
    min_confidence: float = Field(default=65, description="Min confidence to trade (0-100)")
    num_lots: int = Field(default=1, description="Number of lots per trade")
    max_positions: int = Field(default=3, description="Max concurrent positions")
    adapt_enabled: bool = Field(default=True, description="Allow self-adaptation")
    allowed_strategies: Optional[List[str]] = None


class AgentConfigUpdate(BaseModel):
    """Request to update agent config"""
    think_interval: Optional[int] = None
    min_confidence: Optional[float] = None
    auto_enter: Optional[bool] = None
    auto_exit: Optional[bool] = None
    auto_adjust: Optional[bool] = None
    risk_level: Optional[str] = None
    max_capital: Optional[float] = None
    num_lots: Optional[int] = None
    use_mock: Optional[bool] = None
    adapt_enabled: Optional[bool] = None
    allowed_strategies: Optional[List[str]] = None


# ============================================
# AGENT LIFECYCLE ENDPOINTS
# ============================================

@router.post("/start")
async def start_agent(req: AgentStartRequest):
    """Start the autonomous AI trading agent"""
    try:
        # Build config
        config = AgentConfig(
            user_id=req.user_id,
            underlying=req.underlying,
            risk_level=RiskLevel(req.risk_level),
            max_capital=req.max_capital,
            use_mock=req.use_mock,
            auto_enter=req.auto_enter,
            auto_exit=req.auto_exit,
            auto_adjust=req.auto_adjust,
            think_interval=req.think_interval,
            min_confidence=req.min_confidence,
            num_lots=req.num_lots,
            max_positions=req.max_positions,
            adapt_enabled=req.adapt_enabled,
        )
        
        if req.allowed_strategies:
            config.allowed_strategies = req.allowed_strategies
        
        # Check if agent already running
        existing = get_agent(req.user_id)
        if existing and existing.state not in [AgentState.STOPPED, AgentState.IDLE]:
            return {
                "success": True,
                "message": f"Agent already running in state: {existing.state.value}",
                "data": existing.get_status()
            }
        
        # Create and start agent
        agent = get_or_create_agent(req.user_id, config)
        result = await agent.start()
        
        return {
            "success": True,
            "message": "🚀 Autonomous AI Agent started!",
            "data": agent.get_status()
        }
    except Exception as e:
        logger.error(f"Error starting agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_agent(user_id: str = Query(default="default")):
    """Stop the agent and close all positions"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": False, "message": "No active agent found"}
        
        result = await agent.stop()
        remove_agent(user_id)
        
        return {
            "success": True,
            "message": "Agent stopped successfully",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error stopping agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
async def pause_agent(user_id: str = Query(default="default")):
    """Pause the agent (no new trades, keeps monitoring)"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": False, "message": "No active agent found"}
        
        result = await agent.pause()
        return {"success": True, "message": "Agent paused", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume")
async def resume_agent(user_id: str = Query(default="default")):
    """Resume a paused agent"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": False, "message": "No active agent found"}
        
        result = await agent.resume()
        return {"success": True, "message": "Agent resumed", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# STATUS & DATA ENDPOINTS
# ============================================

@router.get("/status")
async def get_agent_status(user_id: str = Query(default="default")):
    """Get full agent status including performance, positions, decisions"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {
                "success": True,
                "data": {
                    "state": "idle",
                    "message": "No agent running. Start one to begin autonomous trading.",
                    "active": False,
                }
            }
        
        return {
            "success": True,
            "data": {
                **agent.get_status(),
                "active": agent.state not in [AgentState.IDLE, AgentState.STOPPED],
            }
        }
    except Exception as e:
        logger.error(f"Error getting agent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/decisions")
async def get_agent_decisions(
    user_id: str = Query(default="default"),
    limit: int = Query(default=20, ge=1, le=100)
):
    """Get agent's decision history with reasoning"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": True, "data": {"decisions": []}}
        
        decisions = [d.to_dict() for d in list(agent.decisions)[:limit]]
        return {
            "success": True,
            "data": {
                "decisions": decisions,
                "total": len(agent.decisions),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events")
async def get_agent_events(
    user_id: str = Query(default="default"),
    limit: int = Query(default=50, ge=1, le=500)
):
    """Get agent's event feed (live activity log)"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": True, "data": {"events": []}}
        
        events = list(agent.event_feed)[:limit]
        return {
            "success": True,
            "data": {
                "events": events,
                "total": len(agent.event_feed),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thought-log")
async def get_thought_log(
    user_id: str = Query(default="default"),
    limit: int = Query(default=10, ge=1, le=50)
):
    """Get agent's thought log (full reasoning chains)"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": True, "data": {"thoughts": []}}
        
        thoughts = list(agent.thought_log)[:limit]
        return {
            "success": True,
            "data": {
                "thoughts": thoughts,
                "total": len(agent.thought_log),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/performance")
async def get_agent_performance(user_id: str = Query(default="default")):
    """Get detailed performance metrics"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": True, "data": {"performance": {}}}
        
        return {
            "success": True,
            "data": {
                "performance": agent.performance.to_dict(),
                "evolved_params": agent.evolved_params,
                "cycle_count": agent._cycle_count,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions")
async def get_agent_positions(user_id: str = Query(default="default")):
    """Get agent's active positions"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": True, "data": {"positions": []}}
        
        return {
            "success": True,
            "data": {
                "positions": agent.active_positions,
                "count": len(agent.active_positions),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CONFIGURATION ENDPOINTS
# ============================================

@router.put("/config")
async def update_agent_config(
    user_id: str = Query(default="default"),
    updates: AgentConfigUpdate = Body(...)
):
    """Update agent configuration while running"""
    try:
        agent = get_agent(user_id)
        if not agent:
            return {"success": False, "message": "No active agent found"}
        
        update_dict = {k: v for k, v in updates.dict().items() if v is not None}
        result = agent.update_config(update_dict)
        
        return {
            "success": True,
            "message": "Configuration updated",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ADMIN / MULTI-AGENT
# ============================================

@router.get("/all-agents")
async def get_all_agents():
    """List all active agent instances (admin)"""
    try:
        agents = list_agents()
        return {
            "success": True,
            "data": {
                "agents": {uid: {"state": s.get("state"), "cycle": s.get("cycle_count")} 
                          for uid, s in agents.items()},
                "total": len(agents),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market-snapshot")
async def get_market_snapshot(user_id: str = Query(default="default")):
    """Get the latest market snapshot from the agent's observation"""
    try:
        agent = get_agent(user_id)
        if not agent or not agent.market_snapshots:
            return {"success": True, "data": {"snapshot": None}}
        
        return {
            "success": True,
            "data": {
                "snapshot": agent.market_snapshots[0].to_dict(),
                "history_count": len(agent.market_snapshots),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
