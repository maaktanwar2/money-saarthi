/**
 * Enhanced Scanner Hooks - Integrated with Central Zustand Store
 * 
 * These hooks bridge React Query's caching with Zustand's global state,
 * enabling cross-page data sharing and visibility-aware refreshing.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo } from 'react';
import useDataStore from '../store/useDataStore';
import { visibilityManager } from '../services/VisibilityManager';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// ============================================
// ENHANCED FETCH WITH STORE SYNC
// ============================================

const fetchWithError = async (url, options = {}) => {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Create a scanner hook that syncs with Zustand store
 */
const createScannerHook = (scannerName, endpoint, defaultOptions = {}) => {
  return (filters = {}) => {
    const queryClient = useQueryClient();
    const setScannerData = useDataStore((state) => state.setScannerData);
    const setScannerLoading = useDataStore((state) => state.setScannerLoading);
    const setScannerError = useDataStore((state) => state.setScannerError);
    const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
    const storedData = useDataStore((state) => state.scanners[scannerName]);

    // Determine if we should fetch (visibility-aware)
    const shouldRefetch = isTabVisible && filters.autoRefresh;

    const query = useQuery({
      queryKey: ['scanners', scannerName, filters],
      queryFn: async () => {
        setScannerLoading(scannerName, true);
        try {
          const data = await fetchWithError(endpoint, {
            method: 'POST',
            body: JSON.stringify({
              filters: {
                min_score: filters.minScore || defaultOptions.minScore || 60,
                limit: filters.limit || 50,
                sectors: filters.sectors || null,
                min_price: filters.minPrice || null,
                max_price: filters.maxPrice || null,
                fno_only: filters.fnoOnly || false,
              },
              ...defaultOptions.extraParams,
              ...(filters.extraParams || {}),
            }),
          });
          
          // Sync to Zustand store
          setScannerData(scannerName, data?.data || data);
          return data;
        } catch (error) {
          setScannerError(scannerName, error.message);
          throw error;
        }
      },
      staleTime: defaultOptions.staleTime || 30000,
      cacheTime: defaultOptions.cacheTime || 5 * 60 * 1000,
      refetchInterval: shouldRefetch ? (defaultOptions.refetchInterval || 30000) : false,
      retry: 2,
      enabled: filters.enabled !== false,
      // Use stored data as placeholder while fetching
      placeholderData: storedData?.data ? { data: storedData.data } : undefined,
    });

    // Pause refetching when tab is hidden
    useEffect(() => {
      if (!isTabVisible && query.isFetching) {
        queryClient.cancelQueries({ queryKey: ['scanners', scannerName] });
      }
    }, [isTabVisible, query.isFetching, queryClient]);

    return {
      ...query,
      // Convenience accessors
      stocks: query.data?.data || storedData?.data || [],
      count: query.data?.count || query.data?.data?.length || 0,
      timestamp: query.data?.timestamp || storedData?.lastUpdated,
      cached: query.isPlaceholderData || query.data?.cached,
    };
  };
};

// ============================================
// SCANNER HOOKS (Integrated with Store)
// ============================================

export const useDayGainersScanner = createScannerHook(
  'dayGainers',
  '/api/v2/scanners/day-gainers',
  { minScore: 75, staleTime: 30000 }
);

export const useDayLosersScanner = createScannerHook(
  'dayLosers', 
  '/api/v2/scanners/day-losers',
  { minScore: 65, staleTime: 30000 }
);

export const useSwingScanner = createScannerHook(
  'swingSetups',
  '/api/v2/scanners/swing',
  { minScore: 65, staleTime: 60000 }
);

export const useMoneyFlowScanner = createScannerHook(
  'moneyFlow',
  '/api/v2/scanners/money-flow',
  { minScore: 60, staleTime: 30000 }
);

export const useHighVolumeScanner = createScannerHook(
  'highVolume',
  '/api/v2/scanners/high-volume',
  { minScore: 60, staleTime: 30000 }
);

// ============================================
// ADDITIONAL DASHBOARD HOOKS
// ============================================

/**
 * Market Stats hook - fetches market-wide stats (VIX, PCR, etc.)
 */
export const useMarketStats = (options = {}) => {
  const setMarketStats = useDataStore((state) => state.setMarketStats);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['market', 'stats'],
    queryFn: async () => {
      const data = await fetchWithError('/api/market-stats');
      setMarketStats(data);
      return data;
    },
    staleTime: 15000,
    cacheTime: 60000,
    refetchInterval: shouldRefetch ? 15000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

/**
 * FNO Stocks list hook
 */
export const useFnoStocks = (options = {}) => {
  const setFnoStocks = useDataStore((state) => state.setFnoStocks);
  
  return useQuery({
    queryKey: ['market', 'fno-stocks'],
    queryFn: async () => {
      const data = await fetchWithError('/api/scanners/fno-stocks');
      setFnoStocks(data);
      return data;
    },
    staleTime: 5 * 60 * 1000, // FNO list doesn't change often
    cacheTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

/**
 * Sector Insights hook
 */
export const useSectorInsights = (options = {}) => {
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['market', 'sector-insights'],
    queryFn: async () => {
      return fetchWithError('/api/sector-insights');
    },
    staleTime: 60000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: shouldRefetch ? 60000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

/**
 * Positional Buildups hook with dynamic buildup type
 */
export const usePositionalBuildups = (buildupType = 'long_buildup', options = {}) => {
  const setScannerData = useDataStore((state) => state.setScannerData);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['scanners', 'positional-buildups', buildupType],
    queryFn: async () => {
      const data = await fetchWithError(`/api/scanners/positional-buildups?buildup_type=${buildupType}`);
      setScannerData('positionalBuildups', data);
      return data;
    },
    staleTime: 30000,
    cacheTime: 2 * 60 * 1000,
    refetchInterval: shouldRefetch ? 30000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

/**
 * Option Apex hook - Top options by OI change
 */
export const useOptionApex = (options = {}) => {
  const setScannerData = useDataStore((state) => state.setScannerData);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['scanners', 'option-apex'],
    queryFn: async () => {
      const data = await fetchWithError('/api/scanners/option-apex');
      setScannerData('optionApex', data);
      return data;
    },
    staleTime: 30000,
    cacheTime: 2 * 60 * 1000,
    refetchInterval: shouldRefetch ? 30000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

/**
 * Sector Rotation hook
 */
export const useSectorRotation = (options = {}) => {
  const setScannerData = useDataStore((state) => state.setScannerData);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['scanners', 'sector-rotation'],
    queryFn: async () => {
      const data = await fetchWithError('/api/scanners/sector-rotation');
      setScannerData('sectorRotation', data);
      return data;
    },
    staleTime: 60000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: shouldRefetch ? 60000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

// ============================================
// OI COMPASS - Special handling for options data
// ============================================

export const useOICompass = (options = {}) => {
  const setOIData = useDataStore((state) => state.setOIData);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['tools', 'oi-compass', options.symbol, options.expiry],
    queryFn: async () => {
      // Build query params for GET request
      const params = new URLSearchParams();
      params.append('symbol', options.symbol || 'NIFTY');
      if (options.expiry) params.append('expiry', options.expiry);
      
      const data = await fetchWithError(`/api/tools/oi-compass?${params.toString()}`);
      
      // Sync OI data to store
      setOIData({ [options.symbol?.toLowerCase() || 'nifty']: data });
      return data;
    },
    staleTime: 10000,
    cacheTime: 60000,
    refetchInterval: shouldRefetch ? 10000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

// ============================================
// TRADE SIGNALS
// ============================================

export const useTradeSignals = (options = {}) => {
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['tools', 'trade-signals', options.symbol, options.expiry],
    queryFn: async () => {
      // Build query params for GET request
      const params = new URLSearchParams();
      if (options.symbol) params.append('symbol', options.symbol);
      if (options.expiry) params.append('expiry', options.expiry);
      
      return fetchWithError(`/api/tools/trade-signals?${params.toString()}`);
    },
    staleTime: 30000,
    cacheTime: 2 * 60 * 1000,
    refetchInterval: shouldRefetch ? 30000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

// ============================================
// MARKET QUOTES (Real-time with WebSocket fallback)
// ============================================

export const useMarketQuote = (instruments, options = {}) => {
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['dhan', 'quote', instruments],
    queryFn: async () => {
      return fetchWithError('/api/v2/dhan/quote', {
        method: 'POST',
        body: JSON.stringify({ instruments }),
      });
    },
    staleTime: 5000,
    cacheTime: 30000,
    refetchInterval: shouldRefetch ? 5000 : false,
    retry: 1,
    enabled: options.enabled !== false && Object.keys(instruments || {}).length > 0,
  });
};

// ============================================
// OPTION CHAIN
// ============================================

export const useOptionChain = (underlyingId, expiryDate, options = {}) => {
  const setOptionChain = useDataStore((state) => state.setOptionChain);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  const shouldRefetch = isTabVisible && options.autoRefresh;

  return useQuery({
    queryKey: ['dhan', 'option-chain', underlyingId, expiryDate],
    queryFn: async () => {
      const data = await fetchWithError('/api/v2/dhan/option-chain', {
        method: 'POST',
        body: JSON.stringify({
          underlying_id: underlyingId,
          expiry_date: expiryDate,
          exchange: 'NSE_FNO',
        }),
      });
      
      // Sync to store
      if (underlyingId) {
        setOptionChain(underlyingId, data);
      }
      return data;
    },
    staleTime: 10000,
    cacheTime: 60000,
    refetchInterval: shouldRefetch ? 10000 : false,
    retry: 2,
    enabled: options.enabled !== false && !!underlyingId && !!expiryDate,
  });
};

// ============================================
// HISTORICAL DATA
// ============================================

export const useHistoricalData = (securityId, exchange, fromDate, toDate, interval = 'D', options = {}) => {
  return useQuery({
    queryKey: ['dhan', 'historical', securityId, exchange, fromDate, toDate, interval],
    queryFn: async () => {
      return fetchWithError('/api/v2/dhan/historical', {
        method: 'POST',
        body: JSON.stringify({
          security_id: securityId,
          exchange,
          from_date: fromDate,
          to_date: toDate,
          interval,
        }),
      });
    },
    staleTime: interval === 'D' ? 5 * 60 * 1000 : 60000,
    cacheTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options.enabled !== false && !!securityId,
  });
};

// ============================================
// CACHE MANAGEMENT
// ============================================

export const useCacheStats = () => {
  return useQuery({
    queryKey: ['scanners', 'cache', 'stats'],
    queryFn: async () => {
      return fetchWithError('/api/v2/scanners/cache/stats');
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
};

export const useClearCache = () => {
  const queryClient = useQueryClient();
  const resetScanners = useDataStore((state) => state.resetScanners);

  return useMutation({
    mutationFn: async (cacheType = null) => {
      const url = cacheType
        ? `/api/v2/scanners/cache/clear?cache_type=${cacheType}`
        : '/api/v2/scanners/cache/clear';
      return fetchWithError(url, { method: 'POST' });
    },
    onSuccess: () => {
      // Clear React Query cache
      queryClient.invalidateQueries({ queryKey: ['scanners'] });
      // Clear Zustand store
      resetScanners();
    },
  });
};

// ============================================
// COMBINED SCANNER HOOK (Dashboard)
// ============================================

export const useAllScannersQuery = (commonFilters = {}) => {
  const setMultipleScanners = useDataStore((state) => state.setMultipleScanners);
  const isTabVisible = useDataStore((state) => state.ui.isTabVisible);
  
  // Base filters for all scanners
  const baseFilters = {
    autoRefresh: commonFilters.autoRefresh !== false && isTabVisible,
    enabled: commonFilters.enabled !== false,
  };
  
  const dayGainers = useDayGainersScanner({
    ...baseFilters,
    enabled: baseFilters.enabled && commonFilters.enableDayGainers !== false,
  });

  const dayLosers = useDayLosersScanner({
    ...baseFilters,
    enabled: baseFilters.enabled && commonFilters.enableDayLosers !== false,
  });

  const swing = useSwingScanner({
    ...baseFilters,
    enabled: baseFilters.enabled && commonFilters.enableSwing !== false,
  });

  const highVolume = useHighVolumeScanner({
    ...baseFilters,
    enabled: baseFilters.enabled && commonFilters.enableHighVolume !== false,
  });
  
  const optionApex = useOptionApex({
    ...baseFilters,
    enabled: baseFilters.enabled && commonFilters.enableOptionApex !== false,
  });
  
  const sectorRotation = useSectorRotation({
    ...baseFilters,
    enabled: baseFilters.enabled && commonFilters.enableSectorRotation !== false,
  });

  // Sync all data to store when loaded
  useEffect(() => {
    const data = {};
    if (dayGainers.data?.data) data.dayGainers = dayGainers.data.data;
    if (dayLosers.data?.data) data.dayLosers = dayLosers.data.data;
    if (swing.data?.data) data.swingSetups = swing.data.data;
    if (highVolume.data?.data) data.highVolume = highVolume.data.data;
    if (optionApex.data) data.optionApex = Array.isArray(optionApex.data) ? optionApex.data : [];
    if (sectorRotation.data) data.sectorRotation = Array.isArray(sectorRotation.data) ? sectorRotation.data : [];
    
    if (Object.keys(data).length > 0) {
      setMultipleScanners(data);
    }
  }, [
    dayGainers.data, dayLosers.data, swing.data, 
    highVolume.data, optionApex.data, sectorRotation.data,
    setMultipleScanners
  ]);

  const isLoading = dayGainers.isLoading || dayLosers.isLoading || 
                    swing.isLoading || highVolume.isLoading;
  
  const isFetching = dayGainers.isFetching || dayLosers.isFetching || 
                     swing.isFetching || highVolume.isFetching ||
                     optionApex.isFetching || sectorRotation.isFetching;

  return {
    // Raw data for Dashboard cards (normalize array access)
    dayGainers: dayGainers.stocks || [],
    dayLosers: dayLosers.stocks || [],
    swingScanner: swing.stocks || [],
    highVolume: highVolume.stocks || [],
    optionApex: optionApex.data || [],
    sectorRotation: sectorRotation.data || [],
    
    // Loading states
    isLoading,
    isFetching,
    isError: dayGainers.isError || dayLosers.isError || swing.isError || highVolume.isError,
    
    // Refetch all scanners
    refetchAll: () => {
      dayGainers.refetch();
      dayLosers.refetch();
      swing.refetch();
      highVolume.refetch();
      optionApex.refetch();
      sectorRotation.refetch();
    },
  };
};

// ============================================
// HOOK TO READ FROM STORE (No fetch, just cached)
// ============================================

export const useCachedScannerData = (scannerName) => {
  const scanner = useDataStore((state) => state.scanners[scannerName]);
  const isScannerStale = useDataStore((state) => state.isScannerStale);
  
  return {
    data: scanner?.data || [],
    lastUpdated: scanner?.lastUpdated,
    isLoading: scanner?.isLoading || false,
    error: scanner?.error,
    isStale: isScannerStale(scannerName),
  };
};

export default {
  useDayGainersScanner,
  useDayLosersScanner,
  useSwingScanner,
  useMoneyFlowScanner,
  useHighVolumeScanner,
  useMarketStats,
  useFnoStocks,
  useSectorInsights,
  usePositionalBuildups,
  useOptionApex,
  useSectorRotation,
  useOICompass,
  useTradeSignals,
  useMarketQuote,
  useOptionChain,
  useHistoricalData,
  useCacheStats,
  useClearCache,
  useAllScannersQuery,
  useCachedScannerData,
};
