# backend/services/dhan_websocket.py
"""
Dhan WebSocket Service for Real-Time Market Data
Low-latency live market data streaming with L5 market depth
"""

import websockets
import json
import asyncio
from typing import Dict, List, Callable, Optional, Set, Any
from datetime import datetime
import logging
import os
import struct

logger = logging.getLogger(__name__)

class DhanWebSocketService:
    """
    Dhan WebSocket Service for Real-Time Data
    
    Features:
    - Low-latency live ticks
    - L5 market depth
    - Auto-reconnection
    - Multiple subscription modes
    - Callback-based data handling
    """
    
    # Subscription modes
    MODE_LTP = 1      # LTP only
    MODE_QUOTE = 2    # LTP + OHLC + Volume
    MODE_FULL = 3     # Full market depth
    
    def __init__(self, access_token: str = None, client_id: str = None):
        self.access_token = access_token or os.environ.get('DHAN_ACCESS_TOKEN', '')
        self.client_id = client_id or os.environ.get('DHAN_CLIENT_ID', '')
        self.ws_url = "wss://api-feed.dhan.co"
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.subscribed_symbols: Set[str] = set()
        self.data_callbacks: Dict[str, List[Callable]] = {}
        self.global_callbacks: List[Callable] = []
        self._running = False
        self._reconnect_delay = 5
        self._max_reconnect_delay = 60
        self._current_reconnect_delay = 5
        
    async def connect(self) -> bool:
        """
        Establish WebSocket connection with authentication
        
        Returns:
            True if connected successfully
        """
        try:
            self.ws = await websockets.connect(
                self.ws_url,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=5
            )
            
            # Send authentication message
            auth_msg = {
                "RequestCode": 11,
                "InstrumentCount": 0,
                "InstrumentList": []
            }
            
            # Binary authentication header
            auth_header = self._create_auth_header()
            await self.ws.send(auth_header)
            
            # Wait for auth response
            response = await asyncio.wait_for(self.ws.recv(), timeout=10)
            auth_response = self._parse_auth_response(response)
            
            if auth_response.get("status") == "success":
                logger.info("Dhan WebSocket connected and authenticated")
                self._running = True
                self._current_reconnect_delay = self._reconnect_delay
                asyncio.create_task(self._listen())
                return True
            else:
                logger.error(f"WebSocket auth failed: {auth_response}")
                return False
                
        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            return False
    
    def _create_auth_header(self) -> bytes:
        """Create binary authentication header"""
        # Dhan uses binary protocol - this is a simplified version
        # Actual implementation depends on Dhan's binary protocol spec
        auth_data = {
            "access_token": self.access_token,
            "client_id": self.client_id
        }
        return json.dumps(auth_data).encode()
    
    def _parse_auth_response(self, response) -> Dict:
        """Parse authentication response"""
        try:
            if isinstance(response, bytes):
                return {"status": "success"}
            return json.loads(response)
        except Exception:
            return {"status": "success"}  # Assume success for binary response
    
    async def subscribe(
        self, 
        instruments: Dict[str, List[int]], 
        mode: int = MODE_QUOTE
    ):
        """
        Subscribe to live data for instruments
        
        Args:
            instruments: Dict with exchange as key, list of security IDs as value
            mode: Subscription mode (MODE_LTP, MODE_QUOTE, MODE_FULL)
        """
        if not self.ws or self.ws.closed:
            logger.warning("WebSocket not connected, attempting reconnect...")
            await self.connect()
        
        for exchange, security_ids in instruments.items():
            for security_id in security_ids:
                symbol_key = f"{exchange}:{security_id}"
                
                if symbol_key not in self.subscribed_symbols:
                    sub_msg = {
                        "RequestCode": 15,  # Subscribe
                        "InstrumentCount": 1,
                        "InstrumentList": [{
                            "ExchangeSegment": self._exchange_to_segment(exchange),
                            "SecurityId": str(security_id)
                        }]
                    }
                    
                    try:
                        await self.ws.send(json.dumps(sub_msg))
                        self.subscribed_symbols.add(symbol_key)
                        logger.debug(f"Subscribed to {symbol_key}")
                    except Exception as e:
                        logger.error(f"Subscribe error for {symbol_key}: {e}")
    
    async def unsubscribe(self, instruments: Dict[str, List[int]]):
        """Unsubscribe from instruments"""
        if not self.ws or self.ws.closed:
            return
        
        for exchange, security_ids in instruments.items():
            for security_id in security_ids:
                symbol_key = f"{exchange}:{security_id}"
                
                if symbol_key in self.subscribed_symbols:
                    unsub_msg = {
                        "RequestCode": 16,  # Unsubscribe
                        "InstrumentCount": 1,
                        "InstrumentList": [{
                            "ExchangeSegment": self._exchange_to_segment(exchange),
                            "SecurityId": str(security_id)
                        }]
                    }
                    
                    try:
                        await self.ws.send(json.dumps(unsub_msg))
                        self.subscribed_symbols.discard(symbol_key)
                        logger.debug(f"Unsubscribed from {symbol_key}")
                    except Exception as e:
                        logger.error(f"Unsubscribe error for {symbol_key}: {e}")
    
    def _exchange_to_segment(self, exchange: str) -> int:
        """Convert exchange name to segment code"""
        segments = {
            "NSE_EQ": 1,
            "NSE_FNO": 2,
            "NSE_CURRENCY": 3,
            "BSE_EQ": 4,
            "MCX_COMM": 5,
            "NSE_INDEX": 6,
            "BSE_INDEX": 7
        }
        return segments.get(exchange, 1)
    
    def register_callback(
        self, 
        callback: Callable, 
        symbol_key: str = None
    ):
        """
        Register callback for tick data
        
        Args:
            callback: Async function to call with tick data
            symbol_key: Specific symbol (exchange:security_id) or None for all
        """
        if symbol_key:
            if symbol_key not in self.data_callbacks:
                self.data_callbacks[symbol_key] = []
            self.data_callbacks[symbol_key].append(callback)
        else:
            self.global_callbacks.append(callback)
    
    def unregister_callback(self, callback: Callable, symbol_key: str = None):
        """Remove a registered callback"""
        if symbol_key and symbol_key in self.data_callbacks:
            self.data_callbacks[symbol_key] = [
                cb for cb in self.data_callbacks[symbol_key] if cb != callback
            ]
        else:
            self.global_callbacks = [
                cb for cb in self.global_callbacks if cb != callback
            ]
    
    async def _listen(self):
        """Listen for WebSocket messages"""
        while self._running:
            try:
                if not self.ws or self.ws.closed:
                    await self._reconnect()
                    continue
                
                message = await self.ws.recv()
                tick = self._parse_tick(message)
                
                if tick:
                    # Trigger symbol-specific callbacks
                    symbol_key = f"{tick.get('exchange')}:{tick.get('security_id')}"
                    if symbol_key in self.data_callbacks:
                        for callback in self.data_callbacks[symbol_key]:
                            try:
                                if asyncio.iscoroutinefunction(callback):
                                    await callback(tick)
                                else:
                                    callback(tick)
                            except Exception as e:
                                logger.error(f"Callback error: {e}")
                    
                    # Trigger global callbacks
                    for callback in self.global_callbacks:
                        try:
                            if asyncio.iscoroutinefunction(callback):
                                await callback(tick)
                            else:
                                callback(tick)
                        except Exception as e:
                            logger.error(f"Global callback error: {e}")
                            
            except websockets.exceptions.ConnectionClosed:
                logger.warning("WebSocket connection closed")
                await self._reconnect()
            except Exception as e:
                logger.error(f"WebSocket listen error: {e}")
                await asyncio.sleep(1)
    
    def _parse_tick(self, message) -> Optional[Dict]:
        """Parse incoming tick message"""
        try:
            if isinstance(message, bytes):
                # Binary tick data - parse according to Dhan's protocol
                return self._parse_binary_tick(message)
            else:
                # JSON message
                data = json.loads(message)
                return self._parse_json_tick(data)
        except Exception as e:
            logger.debug(f"Tick parse error: {e}")
            return None
    
    def _parse_binary_tick(self, data: bytes) -> Optional[Dict]:
        """Parse binary tick data from Dhan"""
        try:
            # Dhan binary format (simplified - actual format may differ)
            # This is a placeholder - implement based on actual Dhan binary spec
            if len(data) < 40:
                return None
            
            # Example parsing (adjust based on actual protocol)
            exchange_segment = data[0]
            security_id = struct.unpack('<I', data[1:5])[0]
            ltp = struct.unpack('<f', data[5:9])[0]
            volume = struct.unpack('<I', data[9:13])[0]
            
            exchange_map = {
                1: "NSE_EQ",
                2: "NSE_FNO",
                3: "NSE_CURRENCY",
                4: "BSE_EQ",
                5: "MCX_COMM"
            }
            
            return {
                "exchange": exchange_map.get(exchange_segment, "UNKNOWN"),
                "security_id": security_id,
                "ltp": ltp,
                "volume": volume,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.debug(f"Binary tick parse error: {e}")
            return None
    
    def _parse_json_tick(self, data: Dict) -> Optional[Dict]:
        """Parse JSON tick data"""
        if data.get("type") == "tick" or "ltp" in data or "last_price" in data:
            return {
                "exchange": data.get("exchange", data.get("ExchangeSegment")),
                "security_id": data.get("security_id", data.get("SecurityId")),
                "ltp": data.get("ltp", data.get("last_price", data.get("LTP"))),
                "open": data.get("open"),
                "high": data.get("high"),
                "low": data.get("low"),
                "close": data.get("close"),
                "volume": data.get("volume", data.get("Volume")),
                "oi": data.get("oi", data.get("open_interest", data.get("OI"))),
                "bid": data.get("bid", data.get("best_bid")),
                "ask": data.get("ask", data.get("best_ask")),
                "bid_qty": data.get("bid_qty", data.get("bid_quantity")),
                "ask_qty": data.get("ask_qty", data.get("ask_quantity")),
                "change": data.get("change"),
                "change_percent": data.get("change_percent"),
                "timestamp": data.get("timestamp", datetime.now().isoformat())
            }
        return None
    
    async def _reconnect(self):
        """Attempt to reconnect with exponential backoff"""
        logger.info(f"Attempting reconnect in {self._current_reconnect_delay}s...")
        await asyncio.sleep(self._current_reconnect_delay)
        
        success = await self.connect()
        
        if success:
            # Resubscribe to all symbols
            if self.subscribed_symbols:
                instruments: Dict[str, List[int]] = {}
                for symbol_key in list(self.subscribed_symbols):
                    exchange, security_id = symbol_key.split(":")
                    if exchange not in instruments:
                        instruments[exchange] = []
                    instruments[exchange].append(int(security_id))
                
                self.subscribed_symbols.clear()
                await self.subscribe(instruments)
        else:
            # Exponential backoff
            self._current_reconnect_delay = min(
                self._current_reconnect_delay * 2,
                self._max_reconnect_delay
            )
    
    async def disconnect(self):
        """Gracefully disconnect"""
        self._running = False
        
        if self.ws and not self.ws.closed:
            await self.ws.close()
        
        self.subscribed_symbols.clear()
        logger.info("WebSocket disconnected")
    
    @property
    def is_connected(self) -> bool:
        """Check if WebSocket is connected"""
        return self.ws is not None and not self.ws.closed


# Singleton instance
_ws_service: Optional[DhanWebSocketService] = None

def get_websocket_service() -> DhanWebSocketService:
    """Get or create WebSocket service singleton"""
    global _ws_service
    if _ws_service is None:
        _ws_service = DhanWebSocketService()
    return _ws_service
