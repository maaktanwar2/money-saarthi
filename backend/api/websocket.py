"""
WebSocket Real-Time Market Data Streaming for Money Saarthi

Features:
- Connection management for multiple clients
- Real-time tick data from Upstox/Dhan WebSocket feeds
- Redis cache updates on every tick
- Auto-reconnection handling
- Sub-100ms latency target
- Token-based authentication
"""

import os
import json
import asyncio
import logging
from typing import Dict, Set, Optional, Any, List
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from enum import Enum
import websockets
from websockets.exceptions import ConnectionClosed

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

# Import Redis manager
try:
    from config.redis_config import redis_manager
except ImportError:
    redis_manager = None
    logger.warning("Redis not available for WebSocket cache")

# Import Firestore for session validation
try:
    from services.firestore_db import get_db
    _db = None
    async def get_firestore_db():
        global _db
        if _db is None:
            _db = await get_db()
        return _db
except ImportError:
    get_firestore_db = None
    logger.warning("Firestore not available for WebSocket auth")


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════════════════

async def validate_ws_token(token: str) -> Optional[dict]:
    """
    Validate a session token and return user info if valid.
    
    Args:
        token: Session token from client
        
    Returns:
        User dict with user_id, email, tier if valid, None otherwise
    """
    if not token or not get_firestore_db:
        return None
    
    try:
        db = await get_firestore_db()
        
        # Find session by token
        session_doc = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if not session_doc:
            logger.warning(f"WebSocket auth: Invalid session token")
            return None
        
        # Check expiration
        expires_at = session_doc.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            logger.warning(f"WebSocket auth: Session expired")
            return None
        
        # Get user info
        user_id = session_doc.get("user_id")
        user_doc = await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0, "user_id": 1, "email": 1, "subscription_tier": 1, "is_blocked": 1}
        )
        
        if not user_doc:
            logger.warning(f"WebSocket auth: User not found for session")
            return None
        
        if user_doc.get("is_blocked"):
            logger.warning(f"WebSocket auth: User is blocked")
            return None
        
        logger.info(f"WebSocket auth: User {user_id} authenticated")
        return {
            "user_id": user_id,
            "email": user_doc.get("email"),
            "tier": user_doc.get("subscription_tier", "free")
        }
        
    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class TickType(str, Enum):
    LTP = "ltp"
    QUOTE = "quote"
    FULL = "full"


@dataclass
class MarketTick:
    """Real-time market tick data"""
    symbol: str
    exchange: str
    ltp: float
    timestamp: str
    change: float = 0.0
    change_pct: float = 0.0
    volume: int = 0
    bid: float = 0.0
    ask: float = 0.0
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    oi: int = 0
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())


@dataclass
class WebSocketMessage:
    """Outgoing WebSocket message format"""
    type: str
    data: Any
    timestamp: str = None
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat() + "Z"
    
    def to_json(self) -> str:
        return json.dumps({
            "type": self.type,
            "data": self.data,
            "timestamp": self.timestamp
        })


# ═══════════════════════════════════════════════════════════════════════════════
# CONNECTION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    """
    Manages WebSocket connections for multiple clients
    
    Features:
    - Track active connections per user
    - Symbol subscription management
    - Broadcast to specific symbol subscribers
    - Connection health monitoring
    """
    
    def __init__(self):
        # Map of connection_id -> WebSocket
        self._connections: Dict[str, WebSocket] = {}
        
        # Map of symbol -> set of connection_ids subscribed to it
        self._subscriptions: Dict[str, Set[str]] = {}
        
        # Map of connection_id -> set of subscribed symbols
        self._client_subscriptions: Dict[str, Set[str]] = {}
        
        # Map of connection_id -> user_id (if authenticated)
        self._user_connections: Dict[str, Optional[str]] = {}
        
        # Connection counter
        self._connection_counter = 0
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None) -> str:
        """Accept a new WebSocket connection"""
        await websocket.accept()
        
        async with self._lock:
            self._connection_counter += 1
            connection_id = f"conn_{self._connection_counter}_{datetime.utcnow().timestamp()}"
            
            self._connections[connection_id] = websocket
            self._client_subscriptions[connection_id] = set()
            self._user_connections[connection_id] = user_id
        
        logger.info(f"WebSocket connected: {connection_id} (user: {user_id})")
        
        # Send welcome message
        await self._send_to_connection(connection_id, WebSocketMessage(
            type="connected",
            data={"connection_id": connection_id, "user_id": user_id}
        ))
        
        return connection_id
    
    async def disconnect(self, connection_id: str):
        """Handle client disconnection"""
        async with self._lock:
            # Remove from all symbol subscriptions
            if connection_id in self._client_subscriptions:
                for symbol in self._client_subscriptions[connection_id]:
                    if symbol in self._subscriptions:
                        self._subscriptions[symbol].discard(connection_id)
                        if not self._subscriptions[symbol]:
                            del self._subscriptions[symbol]
                
                del self._client_subscriptions[connection_id]
            
            # Remove connection
            if connection_id in self._connections:
                del self._connections[connection_id]
            
            if connection_id in self._user_connections:
                del self._user_connections[connection_id]
        
        logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def subscribe(self, connection_id: str, symbols: List[str]):
        """Subscribe a client to symbol updates"""
        async with self._lock:
            for symbol in symbols:
                symbol = symbol.upper()
                
                # Add to symbol subscriptions
                if symbol not in self._subscriptions:
                    self._subscriptions[symbol] = set()
                self._subscriptions[symbol].add(connection_id)
                
                # Track client subscriptions
                if connection_id in self._client_subscriptions:
                    self._client_subscriptions[connection_id].add(symbol)
        
        logger.debug(f"Client {connection_id} subscribed to: {symbols}")
        
        # Confirm subscription
        await self._send_to_connection(connection_id, WebSocketMessage(
            type="subscribed",
            data={"symbols": symbols}
        ))
    
    async def unsubscribe(self, connection_id: str, symbols: List[str]):
        """Unsubscribe a client from symbol updates"""
        async with self._lock:
            for symbol in symbols:
                symbol = symbol.upper()
                
                if symbol in self._subscriptions:
                    self._subscriptions[symbol].discard(connection_id)
                    if not self._subscriptions[symbol]:
                        del self._subscriptions[symbol]
                
                if connection_id in self._client_subscriptions:
                    self._client_subscriptions[connection_id].discard(symbol)
        
        # Confirm unsubscription
        await self._send_to_connection(connection_id, WebSocketMessage(
            type="unsubscribed",
            data={"symbols": symbols}
        ))
    
    async def broadcast_tick(self, tick: MarketTick):
        """Broadcast tick data to all subscribers of the symbol"""
        symbol = tick.symbol.upper()
        
        if symbol not in self._subscriptions:
            return
        
        message = WebSocketMessage(type="tick", data=tick.to_dict())
        
        # Get subscribers (copy to avoid modification during iteration)
        async with self._lock:
            subscribers = list(self._subscriptions.get(symbol, set()))
        
        # Broadcast to all subscribers
        tasks = [
            self._send_to_connection(conn_id, message)
            for conn_id in subscribers
        ]
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Update Redis cache
        if redis_manager:
            try:
                await redis_manager.cache_stock_price(symbol, tick.to_dict(), ttl=1)
            except Exception as e:
                logger.error(f"Redis cache update failed: {e}")
    
    async def broadcast_all(self, message: WebSocketMessage):
        """Broadcast message to all connected clients"""
        async with self._lock:
            connection_ids = list(self._connections.keys())
        
        tasks = [
            self._send_to_connection(conn_id, message)
            for conn_id in connection_ids
        ]
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_to_connection(self, connection_id: str, message: WebSocketMessage):
        """Send message to a specific connection"""
        if connection_id not in self._connections:
            return
        
        websocket = self._connections[connection_id]
        
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(message.to_json())
        except Exception as e:
            logger.error(f"Failed to send to {connection_id}: {e}")
            # Mark for cleanup
            await self.disconnect(connection_id)
    
    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self._connections),
            "total_subscriptions": sum(len(s) for s in self._subscriptions.values()),
            "unique_symbols": len(self._subscriptions),
            "subscribed_symbols": list(self._subscriptions.keys())
        }


# Global connection manager
connection_manager = ConnectionManager()


# ═══════════════════════════════════════════════════════════════════════════════
# BROKER WEBSOCKET CLIENTS
# ═══════════════════════════════════════════════════════════════════════════════

class BrokerWebSocketClient:
    """Base class for broker WebSocket connections"""
    
    def __init__(self, name: str):
        self.name = name
        self._ws = None
        self._running = False
        self._reconnect_delay = 5
        self._max_reconnect_delay = 60
    
    async def connect(self):
        """Connect to broker WebSocket"""
        raise NotImplementedError
    
    async def disconnect(self):
        """Disconnect from broker WebSocket"""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
    
    async def subscribe_symbols(self, symbols: List[str]):
        """Subscribe to symbols on broker feed"""
        raise NotImplementedError
    
    async def _handle_message(self, message: str):
        """Handle incoming message from broker"""
        raise NotImplementedError
    
    async def _reconnect_loop(self):
        """Auto-reconnection loop"""
        delay = self._reconnect_delay
        
        while self._running:
            try:
                await self.connect()
                delay = self._reconnect_delay  # Reset delay on successful connect
                
                # Message receive loop
                async for message in self._ws:
                    await self._handle_message(message)
                    
            except ConnectionClosed:
                logger.warning(f"{self.name} WebSocket closed, reconnecting in {delay}s...")
            except Exception as e:
                logger.error(f"{self.name} WebSocket error: {e}")
            
            if self._running:
                await asyncio.sleep(delay)
                delay = min(delay * 2, self._max_reconnect_delay)


class UpstoxWebSocketClient(BrokerWebSocketClient):
    """Upstox WebSocket client for real-time market data"""
    
    WEBSOCKET_URL = "wss://api-v2.upstox.com/feed/market-data-feed"
    
    def __init__(self, access_token: str):
        super().__init__("Upstox")
        self._access_token = access_token
        self._subscribed_symbols = set()
    
    async def connect(self):
        """Connect to Upstox WebSocket"""
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Accept": "application/octet-stream"
        }
        
        self._ws = await websockets.connect(
            self.WEBSOCKET_URL,
            extra_headers=headers
        )
        self._running = True
        logger.info("✅ Upstox WebSocket connected")
    
    async def subscribe_symbols(self, symbols: List[str]):
        """Subscribe to symbols for real-time updates"""
        if not self._ws:
            return
        
        # Convert symbols to Upstox format (NSE_EQ|RELIANCE)
        instrument_keys = [f"NSE_EQ|{s}" for s in symbols]
        
        subscription_message = {
            "guid": "market-data-feed",
            "method": "sub",
            "data": {
                "mode": "full",
                "instrumentKeys": instrument_keys
            }
        }
        
        await self._ws.send(json.dumps(subscription_message))
        self._subscribed_symbols.update(symbols)
        logger.info(f"Upstox subscribed to: {symbols}")
    
    async def _handle_message(self, message: str):
        """Handle Upstox WebSocket message"""
        try:
            data = json.loads(message)
            
            # Parse Upstox feed format
            if "feeds" in data:
                for key, feed in data["feeds"].items():
                    # Extract symbol from key (NSE_EQ|RELIANCE -> RELIANCE)
                    symbol = key.split("|")[-1] if "|" in key else key
                    
                    ff = feed.get("ff", {}).get("marketFF", {})
                    ltpc = ff.get("ltpc", {})
                    
                    tick = MarketTick(
                        symbol=symbol,
                        exchange="NSE",
                        ltp=ltpc.get("ltp", 0),
                        timestamp=datetime.utcnow().isoformat() + "Z",
                        change=ltpc.get("cp", 0) - ltpc.get("ltp", 0) if ltpc.get("cp") else 0,
                        change_pct=((ltpc.get("ltp", 0) - ltpc.get("cp", ltpc.get("ltp", 1))) / ltpc.get("cp", 1) * 100) if ltpc.get("cp") else 0,
                        volume=ff.get("marketOHLC", {}).get("ohlc", [{}])[0].get("vol", 0),
                        bid=ff.get("marketLevel", {}).get("bidAskQuote", [{}])[0].get("bp", 0) if ff.get("marketLevel") else 0,
                        ask=ff.get("marketLevel", {}).get("bidAskQuote", [{}])[0].get("ap", 0) if ff.get("marketLevel") else 0,
                        open=ff.get("marketOHLC", {}).get("ohlc", [{}])[0].get("open", 0),
                        high=ff.get("marketOHLC", {}).get("ohlc", [{}])[0].get("high", 0),
                        low=ff.get("marketOHLC", {}).get("ohlc", [{}])[0].get("low", 0),
                        close=ltpc.get("cp", 0)
                    )
                    
                    # Broadcast to subscribers
                    await connection_manager.broadcast_tick(tick)
                    
        except Exception as e:
            logger.error(f"Error processing Upstox message: {e}")


class DhanWebSocketClient(BrokerWebSocketClient):
    """Dhan WebSocket client (placeholder - implement based on Dhan WebSocket API)"""
    
    def __init__(self, client_id: str, access_token: str):
        super().__init__("Dhan")
        self._client_id = client_id
        self._access_token = access_token
    
    async def connect(self):
        """Connect to Dhan WebSocket"""
        # Dhan WebSocket implementation
        # Note: Dhan uses binary protocol, implement accordingly
        logger.info("Dhan WebSocket client initialized (implement based on Dhan API docs)")
    
    async def subscribe_symbols(self, symbols: List[str]):
        pass
    
    async def _handle_message(self, message: str):
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# FASTAPI ROUTER
# ═══════════════════════════════════════════════════════════════════════════════

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/market-feed")
async def market_feed_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time market data
    
    Authentication:
    - Pass session token as query param: /ws/market-feed?token=your_session_token
    - Token is validated against user_sessions collection
    - Anonymous connections allowed but with limited features
    
    Message format:
    - Subscribe: {"action": "subscribe", "symbols": ["RELIANCE", "TCS"]}
    - Unsubscribe: {"action": "unsubscribe", "symbols": ["RELIANCE"]}
    
    Tick format:
    {
        "type": "tick",
        "data": {
            "symbol": "RELIANCE",
            "ltp": 2500.50,
            "change": 15.25,
            "change_pct": 0.61,
            ...
        },
        "timestamp": "2024-01-15T10:30:00.123Z"
    }
    """
    # Validate token and get user info
    user_info = None
    user_id = None
    
    if token:
        user_info = await validate_ws_token(token)
        if user_info:
            user_id = user_info.get("user_id")
            logger.info(f"WebSocket authenticated: user={user_id}, tier={user_info.get('tier')}")
        else:
            logger.warning("WebSocket connection with invalid token - allowing anonymous")
    
    connection_id = await connection_manager.connect(websocket, user_id)
    
    # Send auth status to client
    await websocket.send_text(WebSocketMessage(
        type="auth_status",
        data={
            "authenticated": user_info is not None,
            "user_id": user_id,
            "tier": user_info.get("tier") if user_info else "anonymous"
        }
    ).to_json())
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "subscribe":
                    symbols = message.get("symbols", [])
                    await connection_manager.subscribe(connection_id, symbols)
                    
                elif action == "unsubscribe":
                    symbols = message.get("symbols", [])
                    await connection_manager.unsubscribe(connection_id, symbols)
                    
                elif action == "ping":
                    await websocket.send_text(WebSocketMessage(
                        type="pong",
                        data={}
                    ).to_json())
                
                else:
                    await websocket.send_text(WebSocketMessage(
                        type="error",
                        data={"message": f"Unknown action: {action}"}
                    ).to_json())
                    
            except json.JSONDecodeError:
                await websocket.send_text(WebSocketMessage(
                    type="error",
                    data={"message": "Invalid JSON"}
                ).to_json())
                
    except WebSocketDisconnect:
        await connection_manager.disconnect(connection_id)


@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics"""
    return connection_manager.get_stats()


# ═══════════════════════════════════════════════════════════════════════════════
# BACKGROUND TASK FOR SIMULATED MARKET DATA (for testing)
# ═══════════════════════════════════════════════════════════════════════════════

async def simulate_market_data():
    """Simulate market data for testing (remove in production)"""
    import random
    
    symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"]
    base_prices = {
        "RELIANCE": 2500,
        "TCS": 3800,
        "INFY": 1500,
        "HDFCBANK": 1600,
        "ICICIBANK": 1000
    }
    
    while True:
        for symbol in symbols:
            # Generate random tick
            price = base_prices[symbol] * (1 + random.uniform(-0.02, 0.02))
            change = price - base_prices[symbol]
            
            tick = MarketTick(
                symbol=symbol,
                exchange="NSE",
                ltp=round(price, 2),
                timestamp=datetime.utcnow().isoformat() + "Z",
                change=round(change, 2),
                change_pct=round((change / base_prices[symbol]) * 100, 2),
                volume=random.randint(100000, 1000000)
            )
            
            await connection_manager.broadcast_tick(tick)
        
        await asyncio.sleep(1)  # Update every second
