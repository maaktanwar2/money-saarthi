/**
 * Data Provider - Orchestrates all data fetching and updates store
 * 
 * This component wraps the app and:
 * - Fetches initial data
 * - Sets up auto-refresh
 * - Manages visibility-aware polling
 * - Syncs with Zustand store
 */

import React, { useEffect, useCallback, useRef } from 'react';
import useDataStore from '../store/useDataStore';
import { useVisibility, useSmartRefresh } from '../services/VisibilityManager';
import * as DataFetcher from '../services/DataFetcher';

// Re-export store hooks for convenience
export { default as useDataStore } from '../store/useDataStore';
export * from '../store/useDataStore';

/**
 * DataProvider component - Place at app root
 */
export function DataProvider({ children }) {
  // Initialize visibility tracking
  useVisibility();
  
  return <>{children}</>;
}

/**
 * Hook: Use market data with auto-refresh
 */
export function useMarketData() {
  const market = useDataStore((state) => state.market);
  const setMarketData = useDataStore((state) => state.setMarketData);
  const setMarketLoading = useDataStore((state) => state.setMarketLoading);
  const setMarketError = useDataStore((state) => state.setMarketError);
  const isMarketStale = useDataStore((state) => state.isMarketStale);

  const fetchData = useCallback(async () => {
    setMarketLoading(true);
    try {
      const data = await DataFetcher.fetchAllMarketData();
      setMarketData(data);
    } catch (error) {
      setMarketError(error.message);
    }
  }, [setMarketData, setMarketLoading, setMarketError]);

  // Set up auto-refresh
  useSmartRefresh(fetchData, 30000);

  return {
    ...market,
    isStale: isMarketStale(),
    refresh: fetchData,
  };
}

/**
 * Hook: Use scanner data with on-demand fetching
 */
export function useScannerData(scannerName) {
  const scanner = useDataStore((state) => state.scanners[scannerName]);
  const setScannerData = useDataStore((state) => state.setScannerData);
  const setScannerLoading = useDataStore((state) => state.setScannerLoading);
  const setScannerError = useDataStore((state) => state.setScannerError);
  const isScannerStale = useDataStore((state) => state.isScannerStale);
  
  const fetchFnMap = React.useMemo(() => ({
    dayGainers: DataFetcher.fetchDayGainers,
    dayLosers: DataFetcher.fetchDayLosers,
    swingSetups: DataFetcher.fetchSwingSetups,
    optionApex: DataFetcher.fetchOptionApex,
    highVolume: DataFetcher.fetchHighVolume,
    sectorRotation: DataFetcher.fetchSectorRotation,
    positionalBuildups: DataFetcher.fetchPositionalBuildups,
    weeklyBreakouts: DataFetcher.fetchWeeklyBreakouts,
    oiGainers: DataFetcher.fetchOIGainers,
    oiLosers: DataFetcher.fetchOILosers,
  }), []);

  const fetchData = useCallback(async (filters = {}) => {
    setScannerLoading(scannerName, true);
    try {
      const fetchFn = fetchFnMap[scannerName];
      if (!fetchFn) throw new Error(`Unknown scanner: ${scannerName}`);
      
      const data = await fetchFn(filters);
      setScannerData(scannerName, data);
      return data;
    } catch (error) {
      setScannerError(scannerName, error.message);
      return [];
    }
  }, [scannerName, setScannerData, setScannerLoading, setScannerError, fetchFnMap]);

  // Auto-fetch if stale
  useEffect(() => {
    if (isScannerStale(scannerName)) {
      fetchData();
    }
  }, [scannerName, isScannerStale, fetchData]);

  return {
    data: scanner?.data || [],
    isLoading: scanner?.isLoading || false,
    error: scanner?.error || null,
    lastUpdated: scanner?.lastUpdated,
    isStale: isScannerStale(scannerName),
    refresh: fetchData,
  };
}

/**
 * Hook: Use multiple scanners at once (for Dashboard)
 */
export function useAllScanners() {
  const scanners = useDataStore((state) => state.scanners);
  const setMultipleScanners = useDataStore((state) => state.setMultipleScanners);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const loadingRef = useRef(false);

  const fetchAllScanners = useCallback(async (filters = {}) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    try {
      const data = await DataFetcher.fetchAllScanners(filters);
      setMultipleScanners(data);
    } catch (error) {
      console.error('Error fetching all scanners:', error);
    } finally {
      loadingRef.current = false;
    }
  }, [setMultipleScanners]);

  // Smart refresh
  useSmartRefresh(fetchAllScanners, 30000);

  return {
    scanners,
    isLoading: loadingRef.current,
    refresh: fetchAllScanners,
  };
}

/**
 * Hook: Use option chain data
 */
export function useOptionChain(symbol) {
  const chain = useDataStore((state) => state.options.chains[symbol]);
  const setOptionChain = useDataStore((state) => state.setOptionChain);
  const setOIData = useDataStore((state) => state.setOIData);
  
  const fetchData = useCallback(async (expiry = null) => {
    try {
      const data = await DataFetcher.fetchOptionChain(symbol, expiry);
      setOptionChain(symbol, data);
      
      // Also aggregate OI data
      if (data?.data) {
        const aggregated = await DataFetcher.fetchOIAnalysis(symbol);
        setOIData({ [symbol.toLowerCase()]: aggregated });
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching option chain:', error);
      return null;
    }
  }, [symbol, setOptionChain, setOIData]);

  // Fetch on mount if no data
  useEffect(() => {
    if (!chain && symbol) {
      fetchData();
    }
  }, [symbol, chain, fetchData]);

  return {
    chain: chain?.data || null,
    lastUpdated: chain?.lastUpdated,
    refresh: fetchData,
  };
}

/**
 * Hook: Use watchlist
 */
export function useWatchlist() {
  const watchlist = useDataStore((state) => state.user.watchlist);
  const setWatchlist = useDataStore((state) => state.setWatchlist);
  const addToWatchlist = useDataStore((state) => state.addToWatchlist);
  const removeFromWatchlist = useDataStore((state) => state.removeFromWatchlist);

  const fetchWatchlist = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const data = await DataFetcher.fetchWatchlist(token);
      setWatchlist(data);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  }, [setWatchlist]);

  const addSymbol = useCallback(async (symbol) => {
    try {
      const token = localStorage.getItem('token');
      await DataFetcher.updateWatchlist(token, [...watchlist, symbol]);
      addToWatchlist(symbol);
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }, [watchlist, addToWatchlist]);

  const removeSymbol = useCallback(async (symbol) => {
    try {
      const token = localStorage.getItem('token');
      const newWatchlist = watchlist.filter(s => s !== symbol);
      await DataFetcher.updateWatchlist(token, newWatchlist);
      removeFromWatchlist(symbol);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  }, [watchlist, removeFromWatchlist]);

  return {
    watchlist,
    addSymbol,
    removeSymbol,
    refresh: fetchWatchlist,
  };
}

/**
 * Hook: Use FNO stocks list
 */
export function useFnoStocks() {
  const fnoStocks = useDataStore((state) => state.market.fnoStocks);
  const setMarketData = useDataStore((state) => state.setMarketData);

  const fetchData = useCallback(async () => {
    try {
      const stocks = await DataFetcher.fetchFnoStocks();
      setMarketData({ fnoStocks: stocks });
      return stocks;
    } catch (error) {
      console.error('Error fetching FNO stocks:', error);
      return [];
    }
  }, [setMarketData]);

  useEffect(() => {
    if (!fnoStocks || fnoStocks.length === 0) {
      fetchData();
    }
  }, [fnoStocks, fetchData]);

  return {
    stocks: fnoStocks || [],
    refresh: fetchData,
  };
}

/**
 * Hook: Use specific tool data (generic)
 */
export function useToolData(toolName, fetchFn, cacheKey) {
  const [data, setData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchData = useCallback(async (...args) => {
    setIsLoading(true);
    try {
      const result = await fetchFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
}

export default DataProvider;
