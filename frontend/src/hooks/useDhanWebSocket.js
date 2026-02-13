// frontend/src/hooks/useDhanWebSocket.js
/**
 * WebSocket hook for real-time market data from Dhan API
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';
const WS_URL = API_BASE.replace('http', 'ws') + '/api/v2/dhan/stream';

export const useDhanWebSocket = (options = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastTick, setLastTick] = useState(null);
  const [ticks, setTicks] = useState({});
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = options.maxReconnectAttempts || 5;
  const reconnectDelay = options.reconnectDelay || 5000;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'heartbeat') {
            return;
          }

          if (data.security_id) {
            setLastTick(data);
            setTicks((prev) => ({
              ...prev,
              [data.security_id]: data,
            }));
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);

        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current - 1);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Max reconnection attempts reached');
        }
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
      setError(e.message);
    }
  }, [maxReconnectAttempts, reconnectDelay]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Subscribe to instruments
  const subscribe = useCallback((instruments, mode = 2) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        instruments,
        mode, // 1=LTP, 2=Quote, 3=Full
      }));
    } else {
      console.warn('WebSocket not connected, cannot subscribe');
    }
  }, []);

  // Unsubscribe from instruments
  const unsubscribe = useCallback((instruments) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        instruments,
      }));
    }
  }, []);

  // Send ping
  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'ping' }));
    }
  }, []);

  // Get tick for specific security
  const getTick = useCallback((securityId) => {
    return ticks[securityId] || null;
  }, [ticks]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, options.autoConnect]);

  // Heartbeat
  useEffect(() => {
    if (!isConnected) return;

    const heartbeatInterval = setInterval(() => {
      ping();
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, [isConnected, ping]);

  return {
    isConnected,
    lastTick,
    ticks,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    getTick,
    ping,
  };
};

export default useDhanWebSocket;
