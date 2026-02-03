import { useState, useEffect, useCallback, useRef } from 'react';

// Derive WebSocket URL from backend URL
const getWebSocketUrl = () => {
  // First check for explicit WS URL
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  
  // Derive from backend URL
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';
  // Convert http(s):// to ws(s)://
  return backendUrl.replace(/^http/, 'ws');
};

const BASE_WS_URL = getWebSocketUrl();
const WS_URL = `${BASE_WS_URL}/ws/prices`;

// Debug log for production troubleshooting
if (process.env.NODE_ENV === 'production') {
  console.log('WebSocket URL:', WS_URL);
}

export const ConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

/**
 * Custom hook for WebSocket connection to receive real-time price updates
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Auto connect on mount (default: true)
 * @param {number} options.reconnectInterval - Reconnection interval in ms (default: 5000)
 * @param {number} options.maxReconnectAttempts - Max reconnection attempts (default: 10)
 * @returns {Object} WebSocket state and methods
 */
export function useWebSocket(options = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10
  } = options;

  const [status, setStatus] = useState(ConnectionStatus.DISCONNECTED);
  const [prices, setPrices] = useState({});
  const [subscribedSymbols, setSubscribedSymbols] = useState(new Set());
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const pendingSubscriptions = useRef(new Set());
  const isManualDisconnect = useRef(false);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isManualDisconnect.current = false;
    setStatus(reconnectAttempts.current > 0 ? ConnectionStatus.RECONNECTING : ConnectionStatus.CONNECTING);
    setError(null);

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus(ConnectionStatus.CONNECTED);
        reconnectAttempts.current = 0;
        setError(null);

        // Resubscribe to any pending subscriptions
        if (pendingSubscriptions.current.size > 0) {
          const symbols = Array.from(pendingSubscriptions.current);
          ws.send(JSON.stringify({
            action: 'subscribe',
            symbols: symbols
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'price_update':
              setPrices(prev => ({
                ...prev,
                [data.data.symbol]: {
                  ...data.data,
                  receivedAt: new Date().toISOString()
                }
              }));
              setLastUpdate(new Date());
              break;
            
            case 'subscribed':
              setSubscribedSymbols(prev => {
                const newSet = new Set(prev);
                data.symbols.forEach(s => newSet.add(s.replace('.NS', '')));
                return newSet;
              });
              break;
            
            case 'unsubscribed':
              setSubscribedSymbols(prev => {
                const newSet = new Set(prev);
                data.symbols.forEach(s => newSet.delete(s.replace('.NS', '')));
                return newSet;
              });
              break;
            
            case 'market_status':
              // Handle market status updates
              break;
            
            case 'pong':
              // Heartbeat response
              break;
            
            case 'stats':
              console.log('WebSocket stats:', data.data);
              break;
            
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error occurred');
        setStatus(ConnectionStatus.ERROR);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setStatus(ConnectionStatus.DISCONNECTED);

        // Attempt reconnection if not manually disconnected
        if (!isManualDisconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          console.log(`Reconnecting... Attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setError('Failed to connect');
      setStatus(ConnectionStatus.ERROR);
    }
  }, [reconnectInterval, maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus(ConnectionStatus.DISCONNECTED);
    reconnectAttempts.current = 0;
  }, []);

  // Subscribe to symbols
  const subscribe = useCallback((symbols) => {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    const normalizedSymbols = symbolArray.map(s => s.toUpperCase().replace('.NS', ''));
    
    // Add to pending subscriptions
    normalizedSymbols.forEach(s => pendingSubscriptions.current.add(s));
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        symbols: normalizedSymbols
      }));
    }
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols) => {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    const normalizedSymbols = symbolArray.map(s => s.toUpperCase().replace('.NS', ''));
    
    // Remove from pending subscriptions
    normalizedSymbols.forEach(s => pendingSubscriptions.current.delete(s));
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        symbols: normalizedSymbols
      }));
    }

    // Remove from local prices
    setPrices(prev => {
      const newPrices = { ...prev };
      normalizedSymbols.forEach(s => delete newPrices[s]);
      return newPrices;
    });
  }, []);

  // Send ping/heartbeat
  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'ping' }));
    }
  }, []);

  // Get connection stats
  const getStats = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'get_stats' }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Periodic heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === ConnectionStatus.CONNECTED) {
        ping();
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  }, [status, ping]);

  return {
    // State
    status,
    prices,
    subscribedSymbols: Array.from(subscribedSymbols),
    lastUpdate,
    error,
    isConnected: status === ConnectionStatus.CONNECTED,

    // Methods
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    ping,
    getStats
  };
}

/**
 * Hook to get real-time price for a specific symbol
 * @param {string} symbol - Stock symbol
 * @param {Object} wsContext - WebSocket context from useWebSocket
 * @returns {Object} Price data for the symbol
 */
export function useSymbolPrice(symbol, wsContext) {
  const { prices, subscribe, unsubscribe, isConnected } = wsContext;

  useEffect(() => {
    if (isConnected && symbol) {
      subscribe(symbol);
      
      return () => {
        unsubscribe(symbol);
      };
    }
  }, [symbol, isConnected, subscribe, unsubscribe]);

  return prices[symbol?.toUpperCase().replace('.NS', '')] || null;
}

export default useWebSocket;
