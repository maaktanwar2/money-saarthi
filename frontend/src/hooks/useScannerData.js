// frontend/src/hooks/useScannerData.js
/**
 * React Query hooks for all 7 scanners
 * Provides caching, auto-refresh, and error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// ============================================
// API FUNCTIONS
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

// ============================================
// 1. DAY GAINERS SCANNER - 70%+ Win Rate
// ============================================

export const useDayGainersScanner = (filters = {}) => {
  return useQuery({
    queryKey: ['scanners', 'day-gainers', filters],
    queryFn: async () => {
      // Try v2 endpoint first
      try {
        const response = await fetchWithError('/api/v2/scanners/day-gainers', {
          method: 'POST',
          body: JSON.stringify({
            filters: {
              min_score: filters.minScore || 35,
              limit: filters.limit || 50,
              sectors: filters.sectors || null,
              min_price: filters.minPrice || null,
              max_price: filters.maxPrice || null,
              fno_only: filters.fnoOnly || false,
            },
            nifty_change: filters.niftyChange || 0,
          }),
        });
        // v2 endpoint returns {status, scanner, count, timestamp, data, cached}
        const data = response?.data || response;
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } catch (e) {
        // v2 failed, try v1
      }
      
      // Fallback to v1 GET endpoint
      const v1Response = await fetchWithError('/api/scanners/day-gainers');
      return Array.isArray(v1Response) ? v1Response : (v1Response?.stocks || v1Response?.all_gainers || []);
    },
    staleTime: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: filters.autoRefresh ? 30000 : false,
    retry: 2,
    enabled: filters.enabled !== false,
  });
};

// ============================================
// 2. DAY LOSERS SCANNER - 65%+ Win Rate
// ============================================

export const useDayLosersScanner = (filters = {}) => {
  return useQuery({
    queryKey: ['scanners', 'day-losers', filters],
    queryFn: async () => {
      // Try v2 endpoint first
      try {
        const response = await fetchWithError('/api/v2/scanners/day-losers', {
          method: 'POST',
          body: JSON.stringify({
            filters: {
              min_score: filters.minScore || 35,
              limit: filters.limit || 50,
              sectors: filters.sectors || null,
              fno_only: filters.fnoOnly || false,
            },
            mode: filters.mode || 'both', // 'short', 'bounce', 'both'
            nifty_change: filters.niftyChange || 0,
          }),
        });
        // v2 endpoint returns {status, scanner, count, timestamp, data, cached}
        const data = response?.data || response;
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } catch (e) {
        // v2 failed, try v1
      }
      
      // Fallback to v1 GET endpoint
      const v1Response = await fetchWithError('/api/scanners/day-losers');
      return Array.isArray(v1Response) ? v1Response : (v1Response?.stocks || v1Response?.all_losers || []);
    },
    staleTime: 30000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: filters.autoRefresh ? 30000 : false,
    retry: 2,
    enabled: filters.enabled !== false,
  });
};

// ============================================
// 3. SWING SCANNER - 65%+ Win Rate
// ============================================

export const useSwingScanner = (filters = {}) => {
  return useQuery({
    queryKey: ['scanners', 'swing', filters],
    queryFn: async () => {
      // Try v2 endpoint first
      try {
        const response = await fetchWithError('/api/v2/scanners/swing', {
          method: 'POST',
          body: JSON.stringify({
            filters: {
              min_score: filters.minScore || 35,
              limit: filters.limit || 50,
              sectors: filters.sectors || null,
              fno_only: filters.fnoOnly || false,
            },
            direction: filters.direction || 'bullish',
          }),
        });
        // v2 endpoint returns {status, scanner, count, timestamp, data, cached}
        const data = response?.data || response;
        // If v2 returns data, use it
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } catch (e) {
        // v2 failed, try v1
      }
      
      // Fallback to v1 GET endpoint which fetches live data
      const v1Response = await fetchWithError('/api/scanners/swing');
      return Array.isArray(v1Response) ? v1Response : (v1Response?.stocks || []);
    },
    staleTime: 60000, // 1 minute for swing trades
    cacheTime: 10 * 60 * 1000,
    refetchInterval: filters.autoRefresh ? 60000 : false,
    retry: 2,
    enabled: filters.enabled !== false,
  });
};

// ============================================
// 4. MONEY FLOW TOOL - 72%+ Win Rate
// ============================================

export const useMoneyFlowScanner = (filters = {}) => {
  return useQuery({
    queryKey: ['scanners', 'money-flow', filters],
    queryFn: async () => {
      // Try v2 endpoint first
      try {
        const response = await fetchWithError('/api/v2/scanners/money-flow', {
          method: 'POST',
          body: JSON.stringify({
            filters: {
              min_score: filters.minScore || 35,
              limit: filters.limit || 50,
              sectors: filters.sectors || null,
              fno_only: filters.fnoOnly || false,
            },
            min_confidence: filters.minConfidence || 40,
          }),
        });
        // v2 endpoint returns {status, scanner, count, timestamp, data, cached}
        const data = response?.data || response;
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } catch (e) {
        // v2 failed, try v1
      }
      
      // Fallback to v1 GET endpoint
      const v1Response = await fetchWithError('/api/scanners/money-flow');
      return Array.isArray(v1Response) ? v1Response : (v1Response?.stocks || v1Response?.all_money_flow || []);
    },
    staleTime: 30000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: filters.autoRefresh ? 30000 : false,
    retry: 2,
    enabled: filters.enabled !== false,
  });
};

// ============================================
// 5. HIGH VOLUME SCANNER - 68%+ Win Rate
// ============================================

export const useHighVolumeScanner = (filters = {}) => {
  return useQuery({
    queryKey: ['scanners', 'high-volume', filters],
    queryFn: async () => {
      // Try v2 endpoint first
      try {
        const response = await fetchWithError('/api/v2/scanners/high-volume', {
          method: 'POST',
          body: JSON.stringify({
            filters: {
              min_score: filters.minScore || 35,
              limit: filters.limit || 50,
              sectors: filters.sectors || null,
              fno_only: filters.fnoOnly || false,
            },
            min_volume_ratio: filters.minVolumeRatio || 1.2,
          }),
        });
        // v2 endpoint returns {status, scanner, count, timestamp, data, cached}
        const data = response?.data || response;
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } catch (e) {
        // v2 failed, try v1
      }
      
      // Fallback to v1 GET endpoint
      const v1Response = await fetchWithError('/api/scanners/high-volume');
      return Array.isArray(v1Response) ? v1Response : (v1Response?.stocks || v1Response?.all_high_volume || []);
    },
    staleTime: 30000,
    cacheTime: 5 * 60 * 1000,
    refetchInterval: filters.autoRefresh ? 30000 : false,
    retry: 2,
    enabled: filters.enabled !== false,
  });
};

// ============================================
// 6. OI COMPASS - 70%+ Win Rate
// ============================================

export const useOICompass = (options = {}) => {
  return useQuery({
    queryKey: ['tools', 'oi-compass', options.symbol, options.expiry],
    queryFn: async () => {
      // Build query params for GET request
      const params = new URLSearchParams();
      params.append('symbol', options.symbol || 'NIFTY');
      if (options.expiry) params.append('expiry', options.expiry);
      
      const response = await fetchWithError(`/api/tools/oi-compass?${params.toString()}`);
      return response;
    },
    staleTime: 10000, // 10 seconds for options data
    cacheTime: 60000,
    refetchInterval: options.autoRefresh ? 10000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

// ============================================
// 7. TRADE SIGNALS GENERATOR - 72%+ Win Rate
// ============================================

export const useTradeSignals = (options = {}) => {
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
    refetchInterval: options.autoRefresh ? 30000 : false,
    retry: 2,
    enabled: options.enabled !== false,
  });
};

// ============================================
// DHAN API HOOKS
// ============================================

export const useMarketQuote = (instruments, options = {}) => {
  return useQuery({
    queryKey: ['dhan', 'quote', instruments],
    queryFn: async () => {
      return fetchWithError('/api/v2/dhan/quote', {
        method: 'POST',
        body: JSON.stringify({ instruments }),
      });
    },
    staleTime: 5000, // 5 seconds for real-time quotes
    cacheTime: 30000,
    refetchInterval: options.autoRefresh ? 5000 : false,
    retry: 1,
    enabled: options.enabled !== false && Object.keys(instruments || {}).length > 0,
  });
};

export const useOptionChain = (underlyingId, expiryDate, options = {}) => {
  return useQuery({
    queryKey: ['dhan', 'option-chain', underlyingId, expiryDate],
    queryFn: async () => {
      return fetchWithError('/api/v2/dhan/option-chain', {
        method: 'POST',
        body: JSON.stringify({
          underlying_id: underlyingId,
          expiry_date: expiryDate,
          exchange: 'NSE_FNO',
        }),
      });
    },
    staleTime: 10000,
    cacheTime: 60000,
    refetchInterval: options.autoRefresh ? 10000 : false,
    retry: 2,
    enabled: options.enabled !== false && !!underlyingId && !!expiryDate,
  });
};

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

  return useMutation({
    mutationFn: async (cacheType = null) => {
      const url = cacheType
        ? `/api/v2/scanners/cache/clear?cache_type=${cacheType}`
        : '/api/v2/scanners/cache/clear';
      return fetchWithError(url, { method: 'POST' });
    },
    onSuccess: () => {
      // Invalidate all scanner queries
      queryClient.invalidateQueries({ queryKey: ['scanners'] });
    },
  });
};

// ============================================
// COMBINED SCANNER HOOK
// ============================================

export const useAllScanners = (commonFilters = {}) => {
  const dayGainers = useDayGainersScanner({
    ...commonFilters,
    enabled: commonFilters.enableDayGainers !== false,
  });

  const dayLosers = useDayLosersScanner({
    ...commonFilters,
    enabled: commonFilters.enableDayLosers !== false,
  });

  const swing = useSwingScanner({
    ...commonFilters,
    enabled: commonFilters.enableSwing !== false,
  });

  const moneyFlow = useMoneyFlowScanner({
    ...commonFilters,
    enabled: commonFilters.enableMoneyFlow !== false,
  });

  const highVolume = useHighVolumeScanner({
    ...commonFilters,
    enabled: commonFilters.enableHighVolume !== false,
  });

  return {
    dayGainers,
    dayLosers,
    swing,
    moneyFlow,
    highVolume,
    isLoading:
      dayGainers.isLoading ||
      dayLosers.isLoading ||
      swing.isLoading ||
      moneyFlow.isLoading ||
      highVolume.isLoading,
    isError:
      dayGainers.isError ||
      dayLosers.isError ||
      swing.isError ||
      moneyFlow.isError ||
      highVolume.isError,
  };
};

export default {
  useDayGainersScanner,
  useDayLosersScanner,
  useSwingScanner,
  useMoneyFlowScanner,
  useHighVolumeScanner,
  useOICompass,
  useTradeSignals,
  useMarketQuote,
  useOptionChain,
  useHistoricalData,
  useCacheStats,
  useClearCache,
  useAllScanners,
};
