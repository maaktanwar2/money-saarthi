# Central Data Store Architecture

## Performance Optimization Plan for Money Saarthi

### Current Architecture Analysis

#### Problems Identified:

1. **Scattered API Calls**: Each page/tool makes independent API calls
   - Dashboard.js makes 15+ API calls on mount
   - Every scanner page fetches its own data
   - Tools like OICompass, GammaExposure fetch independently

2. **Data Duplication**: Same data fetched multiple times
   - Market stats fetched in Dashboard, Scanners, Tools
   - NIFTY/BANKNIFTY data fetched by 20+ components
   - FNO stocks list fetched repeatedly

3. **No Data Sharing**: Components don't share fetched data
   - Switching from DayGainers to DayLosers refetches everything
   - Option chain data not shared with payoff analyzer

4. **Inefficient Polling**: 
   - Multiple 30-second intervals running simultaneously
   - No visibility-based pause (wastes API calls when tab hidden)
   - No deduplication of refresh requests

5. **Heavy DOM**: 
   - Stock lists render 500+ items without virtualization
   - All scanner results in DOM at once

---

### New Architecture: Central Data Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                     CENTRAL DATA ENGINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Market     │    │   Scanner    │    │   Options    │     │
│  │   Store      │    │   Store      │    │   Store      │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                   │                   │              │
│         └───────────────────┼───────────────────┘              │
│                             │                                   │
│                    ┌────────▼────────┐                         │
│                    │   Zustand +     │                         │
│                    │   Immer Store   │                         │
│                    └────────┬────────┘                         │
│                             │                                   │
│              ┌──────────────┼──────────────┐                   │
│              │              │              │                    │
│      ┌───────▼───────┐ ┌────▼────┐ ┌──────▼──────┐           │
│      │  Web Worker   │ │ SWR     │ │ Visibility  │           │
│      │  Processing   │ │ Cache   │ │ Manager     │           │
│      └───────────────┘ └─────────┘ └─────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAZY-LOADED MODULES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │Screeners│ │ Options │ │ Tools   │ │Strategy │ │ Charts  │ │
│  │ Module  │ │ Module  │ │ Module  │ │ Module  │ │ Module  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │
│       │           │           │           │           │       │
│       └───────────┴───────────┴───────────┴───────────┘       │
│                           │                                     │
│                    useDataStore()                               │
│                  (Subscribe to slices)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Implementation Order (Priority-Based)

#### Phase 1: Core Infrastructure (Week 1)
1. **Zustand Store Setup** - Central state management
2. **Data Fetcher Service** - Unified API layer
3. **Visibility Manager** - Pause polling when tab hidden
4. **Skeleton Components** - Perceived performance

#### Phase 2: Data Stores (Week 2)
1. **Market Data Store** - Indices, market stats, status
2. **Scanner Data Store** - All scanner results
3. **Options Data Store** - Option chains, OI data
4. **User Data Store** - Watchlist, alerts, preferences

#### Phase 3: Component Migration (Week 3-4)
1. Dashboard.js - Highest impact, most API calls
2. Scanner Pages - DayGainers, DayLosers, etc.
3. Options Pages - OptionChain, OIAnalytics
4. Tools Pages - All 40+ tools

#### Phase 4: Performance Optimizations (Week 5)
1. Web Worker for heavy calculations
2. Virtual Lists for large datasets
3. Request deduplication
4. Intelligent prefetching

---

### Files to Create:

```
src/
├── store/
│   ├── index.js              # Store exports
│   ├── useDataStore.js       # Main Zustand store
│   ├── slices/
│   │   ├── marketSlice.js    # Market data
│   │   ├── scannerSlice.js   # Scanner results
│   │   ├── optionsSlice.js   # Options data
│   │   └── userSlice.js      # User preferences
│   └── middleware/
│       ├── persistMiddleware.js
│       └── devtoolsMiddleware.js
├── services/
│   ├── DataFetcher.js        # Centralized API calls
│   ├── CacheManager.js       # Local caching
│   └── VisibilityManager.js  # Tab visibility
├── workers/
│   └── dataProcessor.worker.js
└── components/
    └── skeletons/
        ├── TableSkeleton.jsx
        ├── CardSkeleton.jsx
        └── ChartSkeleton.jsx
```

---

### Store Schema

```javascript
{
  // Market Data (shared across all pages)
  market: {
    indices: { NIFTY: {...}, BANKNIFTY: {...}, ... },
    stats: { advancers, decliners, unchanged, ... },
    status: { isOpen, nextOpen, ... },
    sectors: [...],
    lastUpdated: timestamp
  },

  // Scanner Results (computed from market data)
  scanners: {
    dayGainers: { data: [], lastUpdated, isLoading, error },
    dayLosers: { data: [], lastUpdated, isLoading, error },
    swingSetups: { data: [], lastUpdated, isLoading, error },
    highVolume: { data: [], lastUpdated, isLoading, error },
    // ... all 7 scanners
  },

  // Options Data
  options: {
    chains: { NIFTY: {...}, BANKNIFTY: {...} },
    oiData: { ... },
    ivData: { ... },
    greeks: { ... }
  },

  // User Data
  user: {
    watchlist: [...],
    alerts: [...],
    preferences: { ... }
  },

  // UI State
  ui: {
    autoRefresh: true,
    refreshInterval: 30000,
    isTabVisible: true,
    activeFilters: { ... }
  }
}
```
