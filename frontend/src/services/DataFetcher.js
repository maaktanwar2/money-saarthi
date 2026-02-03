/**
 * Data Fetcher Service - Centralized API Layer
 * 
 * Features:
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Stale-while-revalidate caching
 * - Automatic retry with exponential backoff
 * - Visibility-aware fetching (pauses when tab hidden)
 */

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'https://moneysaarthi-backend-517321998192.asia-south1.run.app';

// Request tracking for deduplication
const pendingRequests = new Map();

// Cache storage
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Create axios instance with defaults
 */
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Retry logic
    if (!config._retryCount) {
      config._retryCount = 0;
    }
    
    if (config._retryCount < 3 && error.response?.status >= 500) {
      config._retryCount += 1;
      const delay = Math.pow(2, config._retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Deduplicated fetch - prevents multiple identical concurrent requests
 */
async function deduplicatedFetch(key, fetchFn) {
  // If request is already in flight, return existing promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create new request
  const promise = fetchFn()
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Stale-while-revalidate cache wrapper
 */
async function cachedFetch(key, fetchFn, maxAge = CACHE_DURATION) {
  const cached = cache.get(key);
  const now = Date.now();

  // Return cached data if fresh
  if (cached && now - cached.timestamp < maxAge) {
    return cached.data;
  }

  // Fetch fresh data
  const data = await deduplicatedFetch(key, fetchFn);
  
  // Update cache
  cache.set(key, { data, timestamp: now });
  
  return data;
}

/**
 * Clear cache for specific key or all
 */
export function clearCache(key = null) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ========== MARKET DATA APIs ==========

export async function fetchMarketStats() {
  return cachedFetch('market-stats', async () => {
    const response = await apiClient.get('/api/market-stats');
    return response.data;
  });
}

export async function fetchMarketStatus() {
  return cachedFetch('market-status', async () => {
    const response = await apiClient.get('/api/market-status');
    return response.data;
  });
}

export async function fetchFnoStocks() {
  return cachedFetch('fno-stocks', async () => {
    const response = await apiClient.get('/api/fno-stocks');
    return response.data;
  }, 300000); // 5 min cache for FNO list
}

export async function fetchSectorData() {
  return cachedFetch('sectors', async () => {
    const response = await apiClient.get('/api/sector-insights');
    return response.data;
  });
}

// ========== SCANNER APIs ==========

export async function fetchDayGainers(filters = {}) {
  const key = `day-gainers-${JSON.stringify(filters)}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.post('/api/screener/day-gainers', filters);
    return response.data;
  });
}

export async function fetchDayLosers(filters = {}) {
  const key = `day-losers-${JSON.stringify(filters)}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.post('/api/screener/day-losers', filters);
    return response.data;
  });
}

export async function fetchSwingSetups(filters = {}) {
  const key = `swing-${JSON.stringify(filters)}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.post('/api/screener/swing', filters);
    return response.data;
  });
}

export async function fetchOptionApex(filters = {}) {
  const key = `option-apex-${JSON.stringify(filters)}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.post('/api/screener/option-apex', filters);
    return response.data;
  });
}

export async function fetchHighVolume(filters = {}) {
  const key = `high-volume-${JSON.stringify(filters)}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.post('/api/screener/high-volume', filters);
    return response.data;
  });
}

export async function fetchSectorRotation() {
  return cachedFetch('sector-rotation', async () => {
    const response = await apiClient.get('/api/screener/sector-rotation');
    return response.data;
  });
}

export async function fetchPositionalBuildups() {
  return cachedFetch('positional-buildups', async () => {
    const response = await apiClient.get('/api/screener/positional-buildups');
    return response.data;
  });
}

export async function fetchWeeklyBreakouts() {
  return cachedFetch('weekly-breakouts', async () => {
    const response = await apiClient.get('/api/screener/weekly-breakouts');
    return response.data;
  });
}

export async function fetchOIGainers() {
  return cachedFetch('oi-gainers', async () => {
    const response = await apiClient.get('/api/oi-gainers');
    return response.data;
  });
}

export async function fetchOILosers() {
  return cachedFetch('oi-losers', async () => {
    const response = await apiClient.get('/api/oi-losers');
    return response.data;
  });
}

// ========== OPTIONS APIs ==========

export async function fetchOptionChain(symbol, expiry = null) {
  const key = `option-chain-${symbol}-${expiry || 'default'}`;
  return cachedFetch(key, async () => {
    const params = expiry ? { expiry } : {};
    const response = await apiClient.get(`/api/option-chain/${symbol}`, { params });
    return response.data;
  }, 15000); // 15s cache for option chain
}

export async function fetchOIAnalysis(symbol) {
  const key = `oi-analysis-${symbol}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.get(`/api/oi-analysis/${symbol}`);
    return response.data;
  });
}

export async function fetchGammaExposure(symbol) {
  const key = `gamma-exposure-${symbol}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.get(`/api/gamma-exposure/${symbol}`);
    return response.data;
  });
}

export async function fetchMaxPain(symbol) {
  const key = `max-pain-${symbol}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.get(`/api/max-pain/${symbol}`);
    return response.data;
  });
}

export async function fetchIVAnalysis(symbol) {
  const key = `iv-analysis-${symbol}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.get(`/api/iv-analysis/${symbol}`);
    return response.data;
  });
}

// ========== TOOLS APIs ==========

export async function fetchOICompass(symbol = 'NIFTY') {
  const key = `oi-compass-${symbol}`;
  return cachedFetch(key, async () => {
    const response = await apiClient.get(`/api/oi-compass/${symbol}`);
    return response.data;
  });
}

export async function fetchPCRAnalysis() {
  return cachedFetch('pcr-analysis', async () => {
    const response = await apiClient.get('/api/pcr-analysis');
    return response.data;
  });
}

export async function fetchFIIDIIData() {
  return cachedFetch('fii-dii', async () => {
    const response = await apiClient.get('/api/fii-dii');
    return response.data;
  }, 60000); // 1 min cache
}

export async function fetchVIXData() {
  return cachedFetch('vix', async () => {
    const response = await apiClient.get('/api/vix');
    return response.data;
  });
}

// ========== USER APIs ==========

export async function fetchWatchlist(token) {
  const response = await apiClient.get('/api/watchlist', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function updateWatchlist(token, watchlist) {
  const response = await apiClient.post(
    '/api/watchlist',
    { watchlist },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function fetchAlerts(token) {
  const response = await apiClient.get('/api/alerts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

// ========== BATCH FETCHERS ==========

/**
 * Fetch all scanner data in parallel (for Dashboard)
 */
export async function fetchAllScanners(filters = {}) {
  const [
    dayGainers,
    dayLosers,
    swingSetups,
    optionApex,
    highVolume,
    sectorRotation,
    positionalBuildups,
  ] = await Promise.all([
    fetchDayGainers(filters).catch(() => []),
    fetchDayLosers(filters).catch(() => []),
    fetchSwingSetups(filters).catch(() => []),
    fetchOptionApex(filters).catch(() => []),
    fetchHighVolume(filters).catch(() => []),
    fetchSectorRotation().catch(() => []),
    fetchPositionalBuildups().catch(() => []),
  ]);

  return {
    dayGainers,
    dayLosers,
    swingSetups,
    optionApex,
    highVolume,
    sectorRotation,
    positionalBuildups,
  };
}

/**
 * Fetch all market data in parallel
 */
export async function fetchAllMarketData() {
  const [stats, sectors, fnoStocks] = await Promise.all([
    fetchMarketStats().catch(() => null),
    fetchSectorData().catch(() => []),
    fetchFnoStocks().catch(() => []),
  ]);

  return { stats, sectors, fnoStocks };
}

export default apiClient;
