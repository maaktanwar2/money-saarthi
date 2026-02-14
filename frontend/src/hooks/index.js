/**
 * Hooks Index - Export all hooks
 */

// Scanner Data Hooks (Enhanced with Zustand sync)
export {
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
} from './useScannerDataEnhanced';

// WebSocket Hooks
export { useWebSocket, ConnectionStatus } from './useWebSocket';

// Toast Hook
export { useToast, toast } from './use-toast';
