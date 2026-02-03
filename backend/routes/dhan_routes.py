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
