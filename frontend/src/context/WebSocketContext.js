import React, { createContext, useContext, useMemo } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

// Create the context
const WebSocketContext = createContext(null);

/**
 * WebSocket Provider component
 * Provides real-time price data throughout the app
 */
export function WebSocketProvider({ children, autoConnect = true }) {
  const ws = useWebSocket({ autoConnect });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ws, [
    ws.status,
    ws.prices,
    ws.subscribedSymbols,
    ws.lastUpdate,
    ws.error,
    ws.isConnected
  ]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access WebSocket context
 * @returns {Object} WebSocket state and methods
 */
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return a safe default instead of throwing
    console.warn('useWebSocketContext: WebSocketProvider not found, using fallback');
    return {
      status: 'disconnected',
      prices: {},
      subscribedSymbols: new Set(),
      lastUpdate: null,
      error: null,
      isConnected: false,
      subscribe: () => {},
      unsubscribe: () => {},
      connect: () => {},
      disconnect: () => {}
    };
  }
  return context;
}

/**
 * Hook to subscribe to a symbol and get its real-time price
 * @param {string} symbol - Stock symbol
 * @returns {Object} Price data and subscription status
 */
export function useLivePrice(symbol) {
  const { prices, subscribe, unsubscribe, isConnected } = useWebSocketContext();
  
  React.useEffect(() => {
    if (isConnected && symbol) {
      subscribe(symbol);
      
      return () => {
        unsubscribe(symbol);
      };
    }
  }, [symbol, isConnected, subscribe, unsubscribe]);

  const normalizedSymbol = symbol?.toUpperCase().replace('.NS', '');
  const price = prices[normalizedSymbol] || null;

  return {
    price,
    isLive: isConnected && price !== null,
    symbol: normalizedSymbol
  };
}

/**
 * Hook to subscribe to multiple symbols
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Object} Prices map and subscription status
 */
export function useLivePrices(symbols) {
  const { prices, subscribe, unsubscribe, isConnected } = useWebSocketContext();
  
  const symbolsKey = symbols?.join(',') || '';
  
  React.useEffect(() => {
    if (isConnected && symbols?.length > 0) {
      subscribe(symbols);
      
      return () => {
        unsubscribe(symbols);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, isConnected]);

  const normalizedPrices = {};
  symbols?.forEach(s => {
    const normalized = s.toUpperCase().replace('.NS', '');
    if (prices[normalized]) {
      normalizedPrices[normalized] = prices[normalized];
    }
  });

  return {
    prices: normalizedPrices,
    isLive: isConnected,
    subscribedCount: Object.keys(normalizedPrices).length
  };
}

export default WebSocketProvider;
