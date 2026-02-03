"""
Comprehensive Trading Configuration for Options Algo Strategies
Based on NSE F&O specifications and industry-standard risk management
Updated: January 2026
"""

# =============================================================================
# INDEX OPTIONS LOT SIZES (NSE Official - Revised Jan 2026)
# =============================================================================
INDEX_LOT_SIZES = {
    # Nifty 50 Index Options (Reduced from 75 to 65 in Jan 2026)
    "NIFTY": 65,           # 65 units per lot
    "NIFTY50": 65,
    
    # Bank Nifty Index Options (Updated to 30 in Jan 2026)
    "BANKNIFTY": 30,       # 30 units per lot
    "NIFTYBANK": 30,
    
    # Fin Nifty / Nifty Financial Services (Updated to 60 in Jan 2026)
    "FINNIFTY": 60,        # 60 units per lot
    "NIFTYFINSERVICE": 60,
    
    # Sensex Options (BSE)
    "SENSEX": 10,          # 10 units per lot
    "SENSEX50": 10,
    
    # Nifty Midcap Select Index (Updated to 120 in Jan 2026)
    "MIDCPNIFTY": 120,     # 120 units per lot
    
    # India VIX
    "INDIAVIX": 550,       # 550 units per lot
}

# =============================================================================
# F&O STOCK LOT SIZES (Top 50 Most Traded - Updated Jan 2026)
# =============================================================================
STOCK_LOT_SIZES = {
    # Banking & Finance
    "HDFCBANK": 550,
    "ICICIBANK": 700,
    "AXISBANK": 625,
    "SBIN": 750,
    "KOTAKBANK": 400,
    "INDUSINDBK": 400,
    "BAJFINANCE": 75,
    "BAJAJFINSV": 50,
    "HDFC": 300,          # Merged with HDFCBANK but contracts may exist
    "PNB": 4000,
    "BANDHANBNK": 900,
    "IDFCFIRSTB": 7500,
    "FEDERALBNK": 5000,
    "AUBANK": 500,
    
    # IT & Tech
    "TCS": 150,
    "INFY": 400,
    "WIPRO": 1500,
    "HCLTECH": 350,
    "TECHM": 600,
    "LTIM": 150,          # LTI Mindtree
    "COFORGE": 175,
    "MPHASIS": 275,
    "PERSISTENT": 100,
    
    # Reliance & Conglomerate
    "RELIANCE": 250,
    "ADANIENT": 500,
    "ADANIPORTS": 625,
    "ADANIGREEN": 500,
    
    # Auto & Manufacturing
    "TATAMOTORS": 575,
    "MARUTI": 50,
    "M&M": 350,
    "BAJAJ-AUTO": 125,
    "EICHERMOT": 150,
    "HEROMOTOCO": 200,
    "TVSMOTOR": 200,
    "ASHOKLEY": 4500,
    "MOTHERSON": 5500,
    
    # Metals & Mining
    "TATASTEEL": 425,
    "JSWSTEEL": 675,
    "HINDALCO": 1400,
    "VEDL": 2200,
    "COALINDIA": 2100,
    "NMDC": 3200,
    "SAIL": 4750,
    
    # Pharma & Healthcare
    "SUNPHARMA": 350,
    "DRREDDY": 100,
    "CIPLA": 500,
    "DIVISLAB": 100,
    "APOLLOHOSP": 125,
    "MAXHEALTH": 550,
    "LALPATHLAB": 250,
    "BIOCON": 1800,
    "AUROPHARMA": 500,
    
    # FMCG & Consumer
    "HINDUNILVR": 300,
    "ITC": 1600,
    "NESTLEIND": 25,
    "BRITANNIA": 100,
    "TATACONSUM": 550,
    "DABUR": 1250,
    "MARICO": 1200,
    "COLPAL": 325,
    "GODREJCP": 500,
    "VBL": 250,           # Varun Beverages
    "PIDILITIND": 250,
    
    # Energy & Power
    "NTPC": 2850,
    "POWERGRID": 2700,
    "ONGC": 3850,
    "BPCL": 1800,
    "GAIL": 2750,
    "IOC": 4300,
    "TATAPOWER": 2250,
    "ADANIPOWER": 1800,
    "TORNTPOWER": 750,
    
    # Infrastructure & Construction
    "LT": 150,
    "LTTS": 125,
    "GRASIM": 275,
    "ULTRACEMCO": 100,
    "SHREECEM": 25,
    "AMBUJACEM": 1000,
    "ACC": 250,
    "DLF": 825,
    "GODREJPROP": 325,
    "OBEROIRLTY": 350,
    "LODHA": 600,
    
    # Telecom & Media
    "BHARTIARTL": 475,
    "ZOMATO": 5000,
    "PAYTM": 600,
    "NYKAA": 2075,
    
    # Insurance
    "SBILIFE": 450,
    "HDFCLIFE": 700,
    "ICICIPRULI": 1500,
    "LICI": 1000,
    
    # Miscellaneous High Volume
    "TITAN": 175,
    "ASIANPAINT": 200,
    "HAVELLS": 400,
    "VOLTAS": 300,
    "POLYCAB": 100,
    "INDIGO": 175,
    "ABB": 100,
    "SIEMENS": 100,
    "DIXON": 75,
    "IRCTC": 525,
    "ZYDUSLIFE": 700,
    "CANBK": 2700,
    "BANKBARODA": 2925,
    "IDBI": 6000,
    "RECLTD": 1250,
    "PFC": 1500,
    "HAL": 150,
    "BEL": 2750,
    "TRENT": 100,
    "JUBLFOOD": 200,
}

# =============================================================================
# STRATEGY-SPECIFIC SETTINGS
# =============================================================================

# Delta Neutral Strategy Settings (Straddle/Strangle Selling)
DELTA_NEUTRAL_SETTINGS = {
    # Position Settings
    "default_delta": 0.20,           # 15-20 delta options (OTM)
    "delta_range": (0.15, 0.25),     # Acceptable delta range
    "max_position_size": 3,          # Max lots per position
    
    # Risk Management
    "stop_loss_pct": 50,             # Exit if premium doubles (50% of max profit lost)
    "profit_target_pct": 50,         # Take profit at 50% of premium collected
    "max_loss_per_trade_pct": 2,     # Max 2% of capital per trade
    "max_daily_loss_pct": 5,         # Stop trading if daily loss exceeds 5%
    
    # Adjustment Rules
    "adjustment_delta_threshold": 0.30,  # Adjust if delta > 0.30
    "roll_when_days_left": 3,        # Roll position 3 days before expiry
    "roll_strike_distance": 1,       # Roll to next strike (1 ATM strike away)
    
    # Target Returns
    "monthly_target_pct": 3.5,       # 3-4% monthly target
    "weekly_target_pct": 0.8,        # ~0.8% weekly target
    
    # Margin Requirements (approximate)
    "margin_buffer_pct": 30,         # Keep 30% extra margin buffer
}

# Theta Decay Strategy Settings (Weekly Option Selling)
THETA_DECAY_SETTINGS = {
    # Time-based Settings
    "entry_days_to_expiry": 7,       # Enter 7 days before weekly expiry
    "exit_days_to_expiry": 1,        # Exit 1 day before expiry
    "optimal_theta_days": (3, 7),    # Best theta decay window
    
    # Strike Selection
    "strike_selection": "strangle",  # straddle or strangle
    "strangle_width_pct": 3,         # 3% OTM for strangle
    "target_delta": 0.20,            # 20 delta options
    
    # Risk Management
    "stop_loss_multiplier": 2.0,     # SL when premium doubles
    "profit_target_pct": 65,         # Take profit at 65% of premium
    "max_weekly_trades": 2,          # Max 2 trades per week
    
    # Target Returns
    "weekly_target_pct": 2.5,        # 2-3% weekly target
    "monthly_target_pct": 10,        # 10% monthly (compound weekly)
}

# Iron Condor Strategy Settings
IRON_CONDOR_SETTINGS = {
    # Wing Settings
    "short_put_delta": 0.16,         # 16 delta for short put
    "short_call_delta": 0.16,        # 16 delta for short call
    "wing_width": 100,               # Points between short and long strikes (NIFTY)
    "wing_width_pct": 2,             # Or 2% of underlying price
    
    # Risk-Reward
    "min_credit_pct": 33,            # Minimum 33% of wing width as credit
    "max_risk_reward_ratio": 2.5,    # Max risk 2.5x the reward
    "profit_target_pct": 50,         # Take profit at 50% of max profit
    "stop_loss_pct": 100,            # Exit at 100% loss of credit received
    
    # Adjustment Rules
    "adjustment_trigger_pct": 30,    # Adjust when trade down 30%
    "roll_untested_side": True,      # Roll the untested side closer
    "days_to_expiry_min": 21,        # Enter with 21+ DTE
    "days_to_expiry_exit": 7,        # Exit with 7 DTE if not profitable
    
    # Target Returns
    "monthly_target_pct": 6,         # 5-8% monthly target
}

# Momentum Options Strategy Settings (Option Buying)
MOMENTUM_SETTINGS = {
    # Entry Criteria
    "min_price_change_pct": 1.5,     # Min 1.5% move to trigger
    "min_volume_surge": 2.0,         # 2x average volume
    "rsi_oversold": 30,              # RSI < 30 for bullish reversal
    "rsi_overbought": 70,            # RSI > 70 for bearish reversal
    
    # Strike Selection
    "strike_type": "ATM",            # ATM options for momentum plays
    "max_days_to_expiry": 14,        # Use near-term options
    "min_days_to_expiry": 3,         # Avoid last 3 days
    
    # Risk Management
    "stop_loss_pct": 30,             # Exit at 30% loss
    "profit_target_pct": 50,         # Target 50% profit minimum
    "trailing_stop_pct": 20,         # 20% trailing stop
    "max_trades_per_day": 3,         # Max 3 trades per day
    
    # Position Sizing
    "risk_per_trade_pct": 2,         # Risk 2% per trade
    "max_position_pct": 10,          # Max 10% of capital per position
    
    # Target Returns
    "per_trade_target_pct": 30,      # 20-50% per trade target
}

# Wheel Strategy Settings (Cash-Secured Puts + Covered Calls)
WHEEL_SETTINGS = {
    # Put Selling Phase
    "put_delta": 0.30,               # 30 delta puts (70% OTM probability)
    "put_dte_target": 30,            # 30 days to expiry for puts
    "put_premium_min_pct": 1.5,      # Minimum 1.5% premium
    
    # Call Selling Phase (after assignment)
    "call_delta": 0.30,              # 30 delta calls
    "call_strike_above_cost": 2,     # Sell calls 2% above cost basis
    "call_dte_target": 30,           # 30 days to expiry for calls
    
    # Roll Rules
    "roll_when_dte": 5,              # Roll with 5 DTE
    "roll_for_credit_only": True,    # Only roll if net credit
    "max_rolls": 3,                  # Max 3 rolls before accepting assignment
    
    # Risk Management
    "max_positions": 5,              # Max 5 wheel positions
    "diversify_sectors": True,       # Don't concentrate in one sector
    
    # Target Returns
    "monthly_yield_target_pct": 3,   # 2-4% monthly yield target
    "annual_target_pct": 30,         # 30% annual return target
}

# Stock Options Scanner Settings
STOCK_SCANNER_SETTINGS = {
    # IV Criteria
    "high_iv_percentile": 70,        # IV > 70th percentile = high IV
    "iv_rank_min": 50,               # IV Rank > 50 for selling
    "iv_rank_max": 30,               # IV Rank < 30 for buying
    
    # OI Analysis
    "oi_change_threshold_pct": 5,    # 5% OI change significant
    "pcr_bullish_threshold": 1.2,    # PCR > 1.2 = bullish
    "pcr_bearish_threshold": 0.8,    # PCR < 0.8 = bearish
    
    # Volume Criteria
    "min_option_volume": 1000,       # Min 1000 contracts volume
    "volume_oi_ratio_alert": 0.5,    # Vol/OI > 0.5 = unusual activity
    
    # Price Action
    "breakout_threshold_pct": 2,     # 2% breakout level
    "support_resistance_buffer": 0.5, # 0.5% buffer for S/R levels
}

# =============================================================================
# PROFIT FACTOR & WIN RATE TARGETS
# =============================================================================
STRATEGY_METRICS = {
    "delta_neutral": {
        "expected_win_rate": 70,      # 70% win rate
        "profit_factor_target": 1.5,  # Profit/Loss ratio
        "avg_win_pct": 35,            # Average winning trade
        "avg_loss_pct": 50,           # Average losing trade
        "risk_reward_ratio": 0.7,     # Risk less to win more often
    },
    "theta_decay": {
        "expected_win_rate": 75,      # 75% win rate
        "profit_factor_target": 1.8,
        "avg_win_pct": 40,
        "avg_loss_pct": 60,
        "risk_reward_ratio": 0.67,
    },
    "iron_condor": {
        "expected_win_rate": 70,      # 70% win rate
        "profit_factor_target": 1.4,
        "avg_win_pct": 50,            # Keep 50% of max profit
        "avg_loss_pct": 100,          # Full credit loss on adjustment
        "risk_reward_ratio": 0.5,     # 2:1 risk to reward typical
    },
    "momentum": {
        "expected_win_rate": 45,      # 45% win rate (lower but big winners)
        "profit_factor_target": 2.0,
        "avg_win_pct": 50,
        "avg_loss_pct": 30,
        "risk_reward_ratio": 1.7,     # Need big winners
    },
    "wheel": {
        "expected_win_rate": 80,      # 80% win rate (puts usually expire OTM)
        "profit_factor_target": 2.5,
        "avg_win_pct": 100,           # Keep full premium
        "avg_loss_pct": 50,           # Stock usually recovers
        "risk_reward_ratio": 0.5,     # Undefined risk with stock ownership
    }
}

# =============================================================================
# MARGIN REQUIREMENTS (Approximate - Broker may vary)
# =============================================================================
MARGIN_CONFIG = {
    # Index Options (per lot approximate)
    "NIFTY_MARGIN_PER_LOT": 150000,      # ~1.5L per lot
    "BANKNIFTY_MARGIN_PER_LOT": 100000,  # ~1L per lot
    "FINNIFTY_MARGIN_PER_LOT": 80000,    # ~80K per lot
    
    # Stock Options (as % of contract value)
    "stock_option_margin_pct": 20,        # ~20% of contract value
    
    # Strategy-specific margins
    "straddle_margin_benefit_pct": 30,    # 30% margin benefit for hedged positions
    "spread_margin_benefit_pct": 50,      # 50% margin benefit for spreads
    
    # Buffer
    "min_margin_buffer_pct": 25,          # Keep 25% extra margin
}

# =============================================================================
# TRADING HOURS & EXPIRY
# =============================================================================
TRADING_CONFIG = {
    # Market Hours (IST)
    "market_open": "09:15",
    "market_close": "15:30",
    "pre_market_start": "09:00",
    "post_market_end": "16:00",
    
    # Expiry Days
    "nifty_expiry_day": "Thursday",
    "banknifty_expiry_day": "Wednesday",
    "finnifty_expiry_day": "Tuesday",
    "stock_expiry_day": "Thursday",       # Last Thursday of month
    
    # Special Expiry Rules
    "monthly_expiry_week": -1,            # Last week of month
    "avoid_trading_on_expiry": True,      # Avoid new positions on expiry day
    "expiry_rollover_days_before": 2,     # Roll 2 days before expiry
    
    # Holiday handling
    "skip_trading_near_holidays": 1,      # Skip 1 day before major holidays
}

# =============================================================================
# BROKER SPECIFIC SETTINGS
# =============================================================================
BROKER_CONFIG = {
    "dhan": {
        "order_type_intraday": "INTRADAY",
        "order_type_delivery": "CNC",
        "product_type_option": "OPTSTK",  
        "product_type_future": "FUT",
        "exchange_nse_fo": "NSE_FNO",
        "exchange_bse_fo": "BSE_FO",
        "max_order_qty_per_call": 1800,   # Dhan max qty per API call
    },
    "upstox": {
        "order_type_intraday": "I",
        "order_type_delivery": "D",
        "product_type": "D",              # Delivery
        "exchange_nse_fo": "NSE_FO",
        "segment": "FO",
        "max_order_qty_per_call": 1800,
    }
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_lot_size(symbol: str) -> int:
    """Get lot size for a symbol (index or stock)"""
    symbol_upper = symbol.upper().replace(" ", "")
    
    # Check index first
    if symbol_upper in INDEX_LOT_SIZES:
        return INDEX_LOT_SIZES[symbol_upper]
    
    # Check stocks
    if symbol_upper in STOCK_LOT_SIZES:
        return STOCK_LOT_SIZES[symbol_upper]
    
    # Default for unknown symbols
    return 100


def get_strategy_settings(strategy_name: str) -> dict:
    """Get settings for a specific strategy"""
    settings_map = {
        "delta_neutral": DELTA_NEUTRAL_SETTINGS,
        "theta_decay": THETA_DECAY_SETTINGS,
        "iron_condor": IRON_CONDOR_SETTINGS,
        "momentum": MOMENTUM_SETTINGS,
        "wheel": WHEEL_SETTINGS,
    }
    return settings_map.get(strategy_name, {})


def calculate_position_size(capital: float, risk_pct: float, stop_loss_pct: float, 
                           premium: float, lot_size: int) -> int:
    """
    Calculate optimal position size based on risk management rules
    
    Args:
        capital: Total trading capital
        risk_pct: Max risk per trade as percentage
        stop_loss_pct: Stop loss percentage
        premium: Option premium per unit
        lot_size: Lot size for the instrument
        
    Returns:
        Number of lots to trade
    """
    max_risk = capital * (risk_pct / 100)
    risk_per_lot = premium * lot_size * (stop_loss_pct / 100)
    
    if risk_per_lot <= 0:
        return 0
    
    lots = int(max_risk / risk_per_lot)
    return max(1, lots)  # At least 1 lot


def calculate_margin_required(symbol: str, lots: int, premium: float, 
                             is_selling: bool = True) -> float:
    """
    Calculate approximate margin required for a position
    
    Args:
        symbol: Trading symbol
        lots: Number of lots
        premium: Option premium
        is_selling: True if selling options
        
    Returns:
        Approximate margin required
    """
    lot_size = get_lot_size(symbol)
    symbol_upper = symbol.upper()
    
    if is_selling:
        # Option selling requires SPAN margin
        if symbol_upper in ["NIFTY", "NIFTY50"]:
            base_margin = MARGIN_CONFIG["NIFTY_MARGIN_PER_LOT"]
        elif symbol_upper in ["BANKNIFTY", "NIFTYBANK"]:
            base_margin = MARGIN_CONFIG["BANKNIFTY_MARGIN_PER_LOT"]
        elif symbol_upper in ["FINNIFTY", "NIFTYFINSERVICE"]:
            base_margin = MARGIN_CONFIG["FINNIFTY_MARGIN_PER_LOT"]
        else:
            # Stock options - approximate based on premium
            contract_value = premium * lot_size
            base_margin = contract_value * (MARGIN_CONFIG["stock_option_margin_pct"] / 100)
        
        return base_margin * lots
    else:
        # Option buying requires full premium
        return premium * lot_size * lots


def validate_trade(symbol: str, lots: int, capital: float, 
                   current_margin_used: float = 0) -> tuple:
    """
    Validate if a trade meets risk management criteria
    
    Returns:
        (is_valid, message)
    """
    lot_size = get_lot_size(symbol)
    
    # Check if lot size is known
    if lot_size == 100 and symbol.upper() not in STOCK_LOT_SIZES:
        return False, f"Unknown symbol: {symbol}. Please verify lot size."
    
    # Check capital limits
    margin_required = calculate_margin_required(symbol, lots, 100, True)  # Assume 100 premium
    total_margin = current_margin_used + margin_required
    
    if total_margin > capital * 0.8:  # Don't use more than 80% of capital
        return False, f"Insufficient margin. Required: {margin_required}, Available: {capital * 0.8 - current_margin_used}"
    
    return True, "Trade validated successfully"


# =============================================================================
# EXPORT ALL CONFIGURATIONS
# =============================================================================
ALL_CONFIG = {
    "index_lot_sizes": INDEX_LOT_SIZES,
    "stock_lot_sizes": STOCK_LOT_SIZES,
    "delta_neutral": DELTA_NEUTRAL_SETTINGS,
    "theta_decay": THETA_DECAY_SETTINGS,
    "iron_condor": IRON_CONDOR_SETTINGS,
    "momentum": MOMENTUM_SETTINGS,
    "wheel": WHEEL_SETTINGS,
    "scanner": STOCK_SCANNER_SETTINGS,
    "metrics": STRATEGY_METRICS,
    "margin": MARGIN_CONFIG,
    "trading": TRADING_CONFIG,
    "broker": BROKER_CONFIG,
}
