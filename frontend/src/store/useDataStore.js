/**
 * Central Data Store - Single Source of Truth
 * Uses Zustand with Immer for immutable updates
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Initial state slices
const initialMarketState = {
  indices: {
    NIFTY: { ltp: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 },
    BANKNIFTY: { ltp: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 },
    FINNIFTY: { ltp: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 },
    MIDCPNIFTY: { ltp: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 },
    SENSEX: { ltp: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 },
  },
  stats: {
    advancers: 0,
    decliners: 0,
    unchanged: 0,
    totalVolume: 0,
    totalTurnover: 0,
  },
  marketStatus: {
    isOpen: false,
    nextOpenTime: null,
    lastUpdated: null,
  },
  sectors: [],
  fnoStocks: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
};

const initialScannerState = {
  dayGainers: { data: [], lastUpdated: null, isLoading: false, error: null },
  dayLosers: { data: [], lastUpdated: null, isLoading: false, error: null },
  swingSetups: { data: [], lastUpdated: null, isLoading: false, error: null },
  optionApex: { data: [], lastUpdated: null, isLoading: false, error: null },
  highVolume: { data: [], lastUpdated: null, isLoading: false, error: null },
  sectorRotation: { data: [], lastUpdated: null, isLoading: false, error: null },
  positionalBuildups: { data: [], lastUpdated: null, isLoading: false, error: null },
  weeklyBreakouts: { data: [], lastUpdated: null, isLoading: false, error: null },
  oiGainers: { data: [], lastUpdated: null, isLoading: false, error: null },
  oiLosers: { data: [], lastUpdated: null, isLoading: false, error: null },
};

const initialOptionsState = {
  chains: {},
  oiData: {
    nifty: null,
    banknifty: null,
    lastUpdated: null,
  },
  greeks: {},
  ivData: {},
  gammaExposure: null,
  maxPain: {},
  isLoading: false,
  error: null,
};

const initialUserState = {
  watchlist: [],
  alerts: [],
  recentSearches: [],
  preferences: {
    autoRefresh: true,
    refreshInterval: 30000,
    theme: 'dark',
    defaultScanner: 'dayGainers',
  },
};

const initialUIState = {
  isTabVisible: true,
  isPaused: false,
  activeScanner: null,
  activeTool: null,
  globalFilters: {
    index: 'all',
    sector: 'all',
    minPrice: 0,
    maxPrice: Infinity,
  },
  lastInteraction: Date.now(),
};

// Create the store
const useDataStore = create(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // State slices
        market: initialMarketState,
        scanners: initialScannerState,
        options: initialOptionsState,
        user: initialUserState,
        ui: initialUIState,

        // ========== MARKET ACTIONS ==========
        setMarketData: (data) =>
          set((state) => {
            if (data.indices) state.market.indices = { ...state.market.indices, ...data.indices };
            if (data.stats) state.market.stats = data.stats;
            if (data.sectors) state.market.sectors = data.sectors;
            if (data.fnoStocks) state.market.fnoStocks = data.fnoStocks;
            state.market.lastUpdated = Date.now();
            state.market.isLoading = false;
            state.market.error = null;
          }),

        setMarketLoading: (isLoading) =>
          set((state) => {
            state.market.isLoading = isLoading;
          }),

        setMarketError: (error) =>
          set((state) => {
            state.market.error = error;
            state.market.isLoading = false;
          }),

        setMarketStats: (stats) =>
          set((state) => {
            state.market.stats = { ...state.market.stats, ...stats };
            state.market.lastUpdated = Date.now();
          }),

        setFnoStocks: (stocks) =>
          set((state) => {
            state.market.fnoStocks = stocks;
            state.market.lastUpdated = Date.now();
          }),

        updateIndex: (symbol, data) =>
          set((state) => {
            if (state.market.indices[symbol]) {
              state.market.indices[symbol] = { ...state.market.indices[symbol], ...data };
            }
          }),

        // ========== SCANNER ACTIONS ==========
        setScannerData: (scannerName, data) =>
          set((state) => {
            if (state.scanners[scannerName]) {
              state.scanners[scannerName].data = data;
              state.scanners[scannerName].lastUpdated = Date.now();
              state.scanners[scannerName].isLoading = false;
              state.scanners[scannerName].error = null;
            }
          }),

        setScannerLoading: (scannerName, isLoading) =>
          set((state) => {
            if (state.scanners[scannerName]) {
              state.scanners[scannerName].isLoading = isLoading;
            }
          }),

        setScannerError: (scannerName, error) =>
          set((state) => {
            if (state.scanners[scannerName]) {
              state.scanners[scannerName].error = error;
              state.scanners[scannerName].isLoading = false;
            }
          }),

        // Batch update multiple scanners
        setMultipleScanners: (scannersData) =>
          set((state) => {
            Object.entries(scannersData).forEach(([name, data]) => {
              if (state.scanners[name]) {
                state.scanners[name].data = data;
                state.scanners[name].lastUpdated = Date.now();
                state.scanners[name].isLoading = false;
              }
            });
          }),

        // ========== OPTIONS ACTIONS ==========
        setOptionChain: (symbol, chain) =>
          set((state) => {
            state.options.chains[symbol] = {
              data: chain,
              lastUpdated: Date.now(),
            };
          }),

        setOIData: (data) =>
          set((state) => {
            state.options.oiData = {
              ...state.options.oiData,
              ...data,
              lastUpdated: Date.now(),
            };
          }),

        setGreeks: (symbol, greeks) =>
          set((state) => {
            state.options.greeks[symbol] = greeks;
          }),

        setGammaExposure: (data) =>
          set((state) => {
            state.options.gammaExposure = data;
          }),

        setMaxPain: (symbol, value) =>
          set((state) => {
            state.options.maxPain[symbol] = value;
          }),

        // ========== USER ACTIONS ==========
        setWatchlist: (watchlist) =>
          set((state) => {
            state.user.watchlist = watchlist;
          }),

        addToWatchlist: (symbol) =>
          set((state) => {
            if (!state.user.watchlist.includes(symbol)) {
              state.user.watchlist.push(symbol);
            }
          }),

        removeFromWatchlist: (symbol) =>
          set((state) => {
            state.user.watchlist = state.user.watchlist.filter((s) => s !== symbol);
          }),

        setAlerts: (alerts) =>
          set((state) => {
            state.user.alerts = alerts;
          }),

        addAlert: (alert) =>
          set((state) => {
            state.user.alerts.push(alert);
          }),

        removeAlert: (alertId) =>
          set((state) => {
            state.user.alerts = state.user.alerts.filter((a) => a.id !== alertId);
          }),

        addRecentSearch: (symbol) =>
          set((state) => {
            const filtered = state.user.recentSearches.filter((s) => s !== symbol);
            state.user.recentSearches = [symbol, ...filtered].slice(0, 10);
          }),

        setPreferences: (preferences) =>
          set((state) => {
            state.user.preferences = { ...state.user.preferences, ...preferences };
          }),

        // ========== UI ACTIONS ==========
        setTabVisible: (isVisible) =>
          set((state) => {
            state.ui.isTabVisible = isVisible;
          }),

        setPaused: (isPaused) =>
          set((state) => {
            state.ui.isPaused = isPaused;
          }),

        setActiveScanner: (scanner) =>
          set((state) => {
            state.ui.activeScanner = scanner;
          }),

        setActiveTool: (tool) =>
          set((state) => {
            state.ui.activeTool = tool;
          }),

        setGlobalFilters: (filters) =>
          set((state) => {
            state.ui.globalFilters = { ...state.ui.globalFilters, ...filters };
          }),

        updateLastInteraction: () =>
          set((state) => {
            state.ui.lastInteraction = Date.now();
          }),

        // ========== SELECTORS (Computed) ==========
        
        // Check if scanner data is stale (older than 30s)
        isScannerStale: (scannerName) => {
          const scanner = get().scanners[scannerName];
          if (!scanner?.lastUpdated) return true;
          return Date.now() - scanner.lastUpdated > 30000;
        },

        // Check if market data is stale
        isMarketStale: () => {
          const { lastUpdated } = get().market;
          if (!lastUpdated) return true;
          return Date.now() - lastUpdated > 30000;
        },

        // Get filtered scanner data
        getFilteredScannerData: (scannerName) => {
          const scanner = get().scanners[scannerName];
          const filters = get().ui.globalFilters;
          
          if (!scanner?.data) return [];
          
          return scanner.data.filter((stock) => {
            if (filters.index !== 'all' && stock.index !== filters.index) return false;
            if (filters.sector !== 'all' && stock.sector !== filters.sector) return false;
            if (stock.ltp < filters.minPrice || stock.ltp > filters.maxPrice) return false;
            return true;
          });
        },

        // Should auto-refresh (tab visible and not paused)
        shouldAutoRefresh: () => {
          const { ui, user } = get();
          return ui.isTabVisible && !ui.isPaused && user.preferences.autoRefresh;
        },

        // ========== BULK ACTIONS ==========
        
        // Reset all scanner data
        resetScanners: () =>
          set((state) => {
            state.scanners = initialScannerState;
          }),

        // Clear all errors
        clearAllErrors: () =>
          set((state) => {
            state.market.error = null;
            Object.keys(state.scanners).forEach((key) => {
              state.scanners[key].error = null;
            });
            state.options.error = null;
          }),

        // Hydrate store from persisted data
        hydrate: (persistedState) =>
          set((state) => {
            if (persistedState.user) {
              state.user = { ...state.user, ...persistedState.user };
            }
          }),
      }))
    ),
    { name: 'MoneySaarthi-Store' }
  )
);

// Export selectors for better performance (avoid re-renders)
export const selectMarket = (state) => state.market;
export const selectIndices = (state) => state.market.indices;
export const selectMarketStats = (state) => state.market.stats;
export const selectFnoStocks = (state) => state.market.fnoStocks;

export const selectScanners = (state) => state.scanners;
export const selectScanner = (scannerName) => (state) => state.scanners[scannerName];

export const selectOptions = (state) => state.options;
export const selectOptionChain = (symbol) => (state) => state.options.chains[symbol];

export const selectUser = (state) => state.user;
export const selectWatchlist = (state) => state.user.watchlist;
export const selectAlerts = (state) => state.user.alerts;

export const selectUI = (state) => state.ui;
export const selectIsTabVisible = (state) => state.ui.isTabVisible;

export default useDataStore;
