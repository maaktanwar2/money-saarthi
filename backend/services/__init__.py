# Services module for Money Saarthi v2.0
# Contains Dhan API integration, scanners, and caching

from .dhan_market_data import DhanMarketDataService
from .dhan_websocket import DhanWebSocketService
from .scanner_service import ScannerService

# Unified Data Service - Single Source of Truth
from .unified_data_service import (
    UnifiedDataService,
    get_unified_service,
    get_unified_data,
    fetch_stock_price,
    fetch_multiple_prices,
    get_option_chain,
    FNO_STOCKS
)

__all__ = [
    'DhanMarketDataService',
    'DhanWebSocketService', 
    'ScannerService',
    # Unified Data Service
    'UnifiedDataService',
    'get_unified_service',
    'get_unified_data',
    'fetch_stock_price',
    'fetch_multiple_prices',
    'get_option_chain',
    'FNO_STOCKS'
]
