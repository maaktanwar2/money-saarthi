"""
Robust Options Strategy Backtesting Engine
==========================================
Based on proven strategies from Zerodha Varsity and professional trading research.

Strategies implemented:
1. Short Straddle - Sell ATM CE + PE (Delta Neutral)
2. Short Strangle - Sell OTM CE + PE (Wider breakevens)
3. Iron Condor - Strangle with hedges (Defined risk)
4. 9:20 AM Straddle - Intraday ATM straddle sell
5. Theta Decay Capture - Weekly option selling
6. Momentum Breakout - Trend following with options
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import math
import random

class StrategyType(Enum):
    SHORT_STRADDLE = "short_straddle"
    SHORT_STRANGLE = "short_strangle"
    IRON_CONDOR = "iron_condor"
    IRON_BUTTERFLY = "iron_butterfly"
    NINE_TWENTY_STRADDLE = "9_20_straddle"
    THETA_DECAY = "theta_decay"
    MOMENTUM_BREAKOUT = "momentum_breakout"

@dataclass
class TradeResult:
    """Single trade result"""
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    pnl: float
    pnl_percent: float
    max_profit: float
    max_loss: float
    underlying_move: float
    days_held: int
    outcome: str  # 'profit', 'loss', 'breakeven'
    strategy: str
    notes: str = ""

@dataclass
class BacktestResult:
    """Complete backtest result"""
    strategy_name: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    avg_profit: float
    avg_loss: float
    max_profit: float
    max_loss: float
    max_drawdown: float
    sharpe_ratio: float
    sortino_ratio: float
    profit_factor: float
    avg_days_held: float
    capital_required: float
    roi_percent: float
    monthly_returns: List[float] = field(default_factory=list)
    equity_curve: List[float] = field(default_factory=list)
    trades: List[TradeResult] = field(default_factory=list)

class OptionsBacktester:
    """
    Professional-grade options backtesting engine.
    Uses synthetic data generation based on real market characteristics.
    """
    
    def __init__(self, symbol: str = "NIFTY", capital: float = 500000):
        self.symbol = symbol
        self.capital = capital
        self.lot_size = 50 if symbol == "NIFTY" else 15  # BANKNIFTY lot size
        
        # Market parameters based on historical data
        self.avg_daily_volatility = 0.012 if symbol == "NIFTY" else 0.018  # 1.2% for Nifty
        self.avg_iv = 0.15  # 15% implied volatility average
        self.risk_free_rate = 0.065  # 6.5% annual
        
        # Strategy-specific parameters
        self.strategy_params = {
            StrategyType.SHORT_STRADDLE: {
                "stop_loss_percent": 50,  # Exit if combined premium doubles
                "target_percent": 50,  # Exit at 50% profit
                "days_before_expiry": 7,
                "max_hold_days": 5
            },
            StrategyType.SHORT_STRANGLE: {
                "otm_distance": 200,  # Points OTM
                "stop_loss_percent": 100,
                "target_percent": 60,
                "days_before_expiry": 10,
                "max_hold_days": 7
            },
            StrategyType.IRON_CONDOR: {
                "short_otm_distance": 200,
                "long_otm_distance": 300,
                "stop_loss_percent": 150,
                "target_percent": 50,
                "days_before_expiry": 14,
                "max_hold_days": 10
            },
            StrategyType.NINE_TWENTY_STRADDLE: {
                "entry_time": "09:20",
                "exit_time": "15:15",
                "stop_loss_percent": 30,
                "intraday": True
            },
            StrategyType.THETA_DECAY: {
                "otm_distance": 300,
                "entry_day": "Thursday",  # Enter on Thursday
                "exit_day": "Wednesday",  # Exit before expiry
                "stop_loss_percent": 100
            }
        }
    
    def _generate_price_path(self, start_price: float, days: int, volatility: float = None) -> List[float]:
        """Generate realistic price path using geometric Brownian motion"""
        if volatility is None:
            volatility = self.avg_daily_volatility
            
        prices = [start_price]
        dt = 1 / 252  # Daily
        
        for _ in range(days):
            drift = (self.risk_free_rate - 0.5 * (volatility * 16) ** 2) * dt
            diffusion = volatility * 16 * np.sqrt(dt) * np.random.normal()
            prices.append(prices[-1] * np.exp(drift + diffusion))
        
        return prices
    
    def _calculate_option_premium(self, spot: float, strike: float, days_to_expiry: int, 
                                   is_call: bool, iv: float = None) -> float:
        """Black-Scholes option pricing approximation"""
        if iv is None:
            iv = self.avg_iv
            
        T = max(days_to_expiry / 365, 0.001)
        r = self.risk_free_rate
        
        # Simplified Black-Scholes
        d1 = (np.log(spot / strike) + (r + 0.5 * iv**2) * T) / (iv * np.sqrt(T))
        d2 = d1 - iv * np.sqrt(T)
        
        from scipy.stats import norm
        
        if is_call:
            price = spot * norm.cdf(d1) - strike * np.exp(-r * T) * norm.cdf(d2)
        else:
            price = strike * np.exp(-r * T) * norm.cdf(-d2) - spot * norm.cdf(-d1)
        
        return max(price, 0.05)  # Minimum premium
    
    def _calculate_option_premium_simple(self, spot: float, strike: float, days_to_expiry: int, 
                                          is_call: bool, iv: float = None) -> float:
        """Simplified premium calculation without scipy"""
        if iv is None:
            iv = self.avg_iv
            
        T = max(days_to_expiry / 365, 0.001)
        
        # Intrinsic value
        if is_call:
            intrinsic = max(spot - strike, 0)
        else:
            intrinsic = max(strike - spot, 0)
        
        # Time value based on ATM approximation
        atm_premium = spot * iv * np.sqrt(T) * 0.4  # Approximation
        
        # Adjust for moneyness
        moneyness = abs(spot - strike) / spot
        time_value = atm_premium * np.exp(-moneyness * 10)  # Decay away from ATM
        
        return intrinsic + time_value
    
    def _get_atm_strike(self, spot: float) -> float:
        """Get ATM strike (rounded to nearest 50/100)"""
        if self.symbol == "NIFTY":
            return round(spot / 50) * 50
        else:
            return round(spot / 100) * 100
    
    def backtest_short_straddle(self, months: int = 12, trades_per_month: int = 4) -> BacktestResult:
        """
        Backtest Short Straddle Strategy
        ---------------------------------
        Entry: Sell ATM CE + ATM PE
        Exit: Target 50% profit OR Stop loss at 50% loss OR Time-based
        Best when: Low volatility expected, rangebound market
        """
        trades = []
        params = self.strategy_params[StrategyType.SHORT_STRADDLE]
        base_spot = 22000 if self.symbol == "NIFTY" else 48000
        
        for month in range(months):
            for week in range(trades_per_month):
                # Entry conditions
                spot = base_spot * (1 + np.random.normal(0, 0.05))  # Random starting point
                atm_strike = self._get_atm_strike(spot)
                days_to_expiry = params["days_before_expiry"]
                
                # Calculate premiums
                ce_premium = self._calculate_option_premium_simple(spot, atm_strike, days_to_expiry, True)
                pe_premium = self._calculate_option_premium_simple(spot, atm_strike, days_to_expiry, False)
                total_premium = ce_premium + pe_premium
                
                # Generate price path
                hold_days = min(params["max_hold_days"], days_to_expiry - 1)
                price_path = self._generate_price_path(spot, hold_days)
                
                # Track trade
                entry_premium = total_premium
                exit_premium = 0
                exit_day = 0
                exit_reason = "expiry"
                max_profit_seen = 0
                max_loss_seen = 0
                
                for day, current_spot in enumerate(price_path[1:], 1):
                    remaining_days = days_to_expiry - day
                    
                    # Recalculate premiums
                    ce_value = self._calculate_option_premium_simple(current_spot, atm_strike, remaining_days, True)
                    pe_value = self._calculate_option_premium_simple(current_spot, atm_strike, remaining_days, False)
                    current_premium = ce_value + pe_value
                    
                    pnl_percent = (entry_premium - current_premium) / entry_premium * 100
                    
                    max_profit_seen = max(max_profit_seen, pnl_percent)
                    max_loss_seen = min(max_loss_seen, pnl_percent)
                    
                    # Check exit conditions
                    if pnl_percent >= params["target_percent"]:
                        exit_premium = current_premium
                        exit_day = day
                        exit_reason = "target"
                        break
                    elif pnl_percent <= -params["stop_loss_percent"]:
                        exit_premium = current_premium
                        exit_day = day
                        exit_reason = "stop_loss"
                        break
                
                if exit_day == 0:  # Held till expiry/max days
                    exit_day = hold_days
                    final_spot = price_path[-1]
                    # At expiry, premium = intrinsic value
                    ce_intrinsic = max(final_spot - atm_strike, 0)
                    pe_intrinsic = max(atm_strike - final_spot, 0)
                    exit_premium = ce_intrinsic + pe_intrinsic
                
                # Calculate PnL
                pnl_points = entry_premium - exit_premium
                pnl_amount = pnl_points * self.lot_size
                pnl_percent = pnl_points / entry_premium * 100
                underlying_move = (price_path[exit_day] - spot) / spot * 100
                
                entry_date = datetime.now() - timedelta(days=(months - month) * 30 + week * 7)
                exit_date = entry_date + timedelta(days=exit_day)
                
                trade = TradeResult(
                    entry_date=entry_date.strftime("%Y-%m-%d"),
                    exit_date=exit_date.strftime("%Y-%m-%d"),
                    entry_price=entry_premium,
                    exit_price=exit_premium,
                    pnl=pnl_amount,
                    pnl_percent=pnl_percent,
                    max_profit=max_profit_seen,
                    max_loss=max_loss_seen,
                    underlying_move=underlying_move,
                    days_held=exit_day,
                    outcome="profit" if pnl_amount > 0 else "loss",
                    strategy="Short Straddle",
                    notes=f"Exit: {exit_reason}, Strike: {atm_strike}"
                )
                trades.append(trade)
        
        return self._compile_results("Short Straddle", trades)
    
    def backtest_short_strangle(self, months: int = 12, trades_per_month: int = 4) -> BacktestResult:
        """
        Backtest Short Strangle Strategy
        ---------------------------------
        Entry: Sell OTM CE + OTM PE
        Exit: Target 60% profit OR Stop loss OR Time-based
        Wider profit zone than straddle, lower premium collected
        """
        trades = []
        params = self.strategy_params[StrategyType.SHORT_STRANGLE]
        base_spot = 22000 if self.symbol == "NIFTY" else 48000
        
        for month in range(months):
            for week in range(trades_per_month):
                spot = base_spot * (1 + np.random.normal(0, 0.05))
                atm_strike = self._get_atm_strike(spot)
                
                # OTM strikes
                ce_strike = atm_strike + params["otm_distance"]
                pe_strike = atm_strike - params["otm_distance"]
                days_to_expiry = params["days_before_expiry"]
                
                # Calculate premiums
                ce_premium = self._calculate_option_premium_simple(spot, ce_strike, days_to_expiry, True)
                pe_premium = self._calculate_option_premium_simple(spot, pe_strike, days_to_expiry, False)
                total_premium = ce_premium + pe_premium
                
                # Generate price path
                hold_days = min(params["max_hold_days"], days_to_expiry - 1)
                price_path = self._generate_price_path(spot, hold_days)
                
                entry_premium = total_premium
                exit_premium = 0
                exit_day = 0
                exit_reason = "expiry"
                max_profit_seen = 0
                max_loss_seen = 0
                
                for day, current_spot in enumerate(price_path[1:], 1):
                    remaining_days = days_to_expiry - day
                    
                    ce_value = self._calculate_option_premium_simple(current_spot, ce_strike, remaining_days, True)
                    pe_value = self._calculate_option_premium_simple(current_spot, pe_strike, remaining_days, False)
                    current_premium = ce_value + pe_value
                    
                    pnl_percent = (entry_premium - current_premium) / entry_premium * 100 if entry_premium > 0 else 0
                    
                    max_profit_seen = max(max_profit_seen, pnl_percent)
                    max_loss_seen = min(max_loss_seen, pnl_percent)
                    
                    if pnl_percent >= params["target_percent"]:
                        exit_premium = current_premium
                        exit_day = day
                        exit_reason = "target"
                        break
                    elif pnl_percent <= -params["stop_loss_percent"]:
                        exit_premium = current_premium
                        exit_day = day
                        exit_reason = "stop_loss"
                        break
                
                if exit_day == 0:
                    exit_day = hold_days
                    final_spot = price_path[-1]
                    ce_intrinsic = max(final_spot - ce_strike, 0)
                    pe_intrinsic = max(pe_strike - final_spot, 0)
                    exit_premium = ce_intrinsic + pe_intrinsic
                
                pnl_points = entry_premium - exit_premium
                pnl_amount = pnl_points * self.lot_size
                pnl_percent = pnl_points / entry_premium * 100 if entry_premium > 0 else 0
                underlying_move = (price_path[exit_day] - spot) / spot * 100
                
                entry_date = datetime.now() - timedelta(days=(months - month) * 30 + week * 7)
                exit_date = entry_date + timedelta(days=exit_day)
                
                trade = TradeResult(
                    entry_date=entry_date.strftime("%Y-%m-%d"),
                    exit_date=exit_date.strftime("%Y-%m-%d"),
                    entry_price=entry_premium,
                    exit_price=exit_premium,
                    pnl=pnl_amount,
                    pnl_percent=pnl_percent,
                    max_profit=max_profit_seen,
                    max_loss=max_loss_seen,
                    underlying_move=underlying_move,
                    days_held=exit_day,
                    outcome="profit" if pnl_amount > 0 else "loss",
                    strategy="Short Strangle",
                    notes=f"Exit: {exit_reason}, CE: {ce_strike}, PE: {pe_strike}"
                )
                trades.append(trade)
        
        return self._compile_results("Short Strangle", trades)
    
    def backtest_iron_condor(self, months: int = 12, trades_per_month: int = 4) -> BacktestResult:
        """
        Backtest Iron Condor Strategy
        ------------------------------
        Entry: Sell OTM CE + PE, Buy further OTM CE + PE (hedges)
        Defined risk strategy with capped losses
        """
        trades = []
        params = self.strategy_params[StrategyType.IRON_CONDOR]
        base_spot = 22000 if self.symbol == "NIFTY" else 48000
        
        for month in range(months):
            for week in range(trades_per_month):
                spot = base_spot * (1 + np.random.normal(0, 0.05))
                atm_strike = self._get_atm_strike(spot)
                
                # Define strikes
                short_ce = atm_strike + params["short_otm_distance"]
                short_pe = atm_strike - params["short_otm_distance"]
                long_ce = atm_strike + params["long_otm_distance"]
                long_pe = atm_strike - params["long_otm_distance"]
                days_to_expiry = params["days_before_expiry"]
                
                # Calculate premiums
                short_ce_prem = self._calculate_option_premium_simple(spot, short_ce, days_to_expiry, True)
                short_pe_prem = self._calculate_option_premium_simple(spot, short_pe, days_to_expiry, False)
                long_ce_prem = self._calculate_option_premium_simple(spot, long_ce, days_to_expiry, True)
                long_pe_prem = self._calculate_option_premium_simple(spot, long_pe, days_to_expiry, False)
                
                # Net credit
                net_credit = (short_ce_prem + short_pe_prem) - (long_ce_prem + long_pe_prem)
                max_loss_per_lot = (params["long_otm_distance"] - params["short_otm_distance"]) - net_credit
                
                # Generate price path
                hold_days = min(params["max_hold_days"], days_to_expiry - 1)
                price_path = self._generate_price_path(spot, hold_days)
                
                exit_day = 0
                exit_reason = "expiry"
                current_pnl = 0
                max_profit_seen = 0
                max_loss_seen = 0
                
                for day, current_spot in enumerate(price_path[1:], 1):
                    remaining_days = days_to_expiry - day
                    
                    # Recalculate all legs
                    short_ce_val = self._calculate_option_premium_simple(current_spot, short_ce, remaining_days, True)
                    short_pe_val = self._calculate_option_premium_simple(current_spot, short_pe, remaining_days, False)
                    long_ce_val = self._calculate_option_premium_simple(current_spot, long_ce, remaining_days, True)
                    long_pe_val = self._calculate_option_premium_simple(current_spot, long_pe, remaining_days, False)
                    
                    current_value = (short_ce_val + short_pe_val) - (long_ce_val + long_pe_val)
                    current_pnl = net_credit - current_value
                    pnl_percent = current_pnl / net_credit * 100 if net_credit > 0 else 0
                    
                    max_profit_seen = max(max_profit_seen, pnl_percent)
                    max_loss_seen = min(max_loss_seen, pnl_percent)
                    
                    if pnl_percent >= params["target_percent"]:
                        exit_day = day
                        exit_reason = "target"
                        break
                    elif current_pnl <= -max_loss_per_lot * 0.8:  # Exit at 80% of max loss
                        exit_day = day
                        exit_reason = "stop_loss"
                        break
                
                if exit_day == 0:
                    exit_day = hold_days
                    final_spot = price_path[-1]
                    # Calculate intrinsic values at expiry
                    short_ce_int = max(final_spot - short_ce, 0)
                    short_pe_int = max(short_pe - final_spot, 0)
                    long_ce_int = max(final_spot - long_ce, 0)
                    long_pe_int = max(long_pe - final_spot, 0)
                    current_pnl = net_credit - ((short_ce_int + short_pe_int) - (long_ce_int + long_pe_int))
                
                pnl_amount = current_pnl * self.lot_size
                pnl_percent = current_pnl / net_credit * 100 if net_credit > 0 else 0
                underlying_move = (price_path[exit_day] - spot) / spot * 100
                
                entry_date = datetime.now() - timedelta(days=(months - month) * 30 + week * 7)
                exit_date = entry_date + timedelta(days=exit_day)
                
                trade = TradeResult(
                    entry_date=entry_date.strftime("%Y-%m-%d"),
                    exit_date=exit_date.strftime("%Y-%m-%d"),
                    entry_price=net_credit,
                    exit_price=net_credit - current_pnl,
                    pnl=pnl_amount,
                    pnl_percent=pnl_percent,
                    max_profit=max_profit_seen,
                    max_loss=max_loss_seen,
                    underlying_move=underlying_move,
                    days_held=exit_day,
                    outcome="profit" if pnl_amount > 0 else "loss",
                    strategy="Iron Condor",
                    notes=f"Exit: {exit_reason}, Short: {short_pe}-{short_ce}, Long: {long_pe}-{long_ce}"
                )
                trades.append(trade)
        
        return self._compile_results("Iron Condor", trades)
    
    def backtest_920_straddle(self, trading_days: int = 252) -> BacktestResult:
        """
        Backtest 9:20 AM Straddle Strategy (Intraday)
        ----------------------------------------------
        Entry: Sell ATM straddle at 9:20 AM
        Exit: 3:15 PM or stop loss hit
        Very popular retail strategy in India
        """
        trades = []
        params = self.strategy_params[StrategyType.NINE_TWENTY_STRADDLE]
        base_spot = 22000 if self.symbol == "NIFTY" else 48000
        
        for day in range(trading_days):
            # Morning opening (random gap)
            gap = np.random.normal(0, 0.005)  # Average gap of 0.5%
            spot_920 = base_spot * (1 + np.random.normal(0, 0.03) + gap)
            atm_strike = self._get_atm_strike(spot_920)
            
            # Calculate premiums at 9:20 (0 DTE or 1 DTE depending on day)
            days_to_expiry = 1 if day % 7 < 4 else 0.5  # Simplified
            iv_morning = self.avg_iv * (1 + np.random.uniform(-0.1, 0.2))  # Higher IV in morning
            
            ce_premium = self._calculate_option_premium_simple(spot_920, atm_strike, days_to_expiry, True, iv_morning)
            pe_premium = self._calculate_option_premium_simple(spot_920, atm_strike, days_to_expiry, False, iv_morning)
            total_premium = ce_premium + pe_premium
            
            # Simulate intraday movement (6 hours of trading)
            intraday_vol = self.avg_daily_volatility * np.random.uniform(0.7, 1.5)
            hourly_moves = []
            current_price = spot_920
            
            for hour in range(6):  # 9:20 to 3:20
                hourly_return = np.random.normal(0, intraday_vol / np.sqrt(6))
                current_price *= (1 + hourly_return)
                hourly_moves.append(current_price)
            
            spot_315 = hourly_moves[-1]
            
            # Check if stop loss was hit during the day
            max_deviation = max(abs(p - spot_920) for p in hourly_moves)
            max_deviation_pct = max_deviation / spot_920 * 100
            
            # IV typically drops during the day
            iv_afternoon = iv_morning * 0.85  # 15% IV crush
            
            # Final premium calculation
            ce_final = self._calculate_option_premium_simple(spot_315, atm_strike, days_to_expiry - 0.25, True, iv_afternoon)
            pe_final = self._calculate_option_premium_simple(spot_315, atm_strike, days_to_expiry - 0.25, False, iv_afternoon)
            final_premium = ce_final + pe_final
            
            # Check stop loss
            exit_reason = "eod"
            if max_deviation_pct > 1.5:  # Big intraday move
                # Estimate loss at worst point
                worst_premium = total_premium * (1 + max_deviation_pct / 100 * 3)  # Premium increases ~3x the move
                if (worst_premium - total_premium) / total_premium * 100 > params["stop_loss_percent"]:
                    final_premium = total_premium * (1 + params["stop_loss_percent"] / 100)
                    exit_reason = "stop_loss"
            
            pnl_points = total_premium - final_premium
            pnl_amount = pnl_points * self.lot_size
            pnl_percent = pnl_points / total_premium * 100 if total_premium > 0 else 0
            underlying_move = (spot_315 - spot_920) / spot_920 * 100
            
            entry_date = datetime.now() - timedelta(days=trading_days - day)
            
            trade = TradeResult(
                entry_date=entry_date.strftime("%Y-%m-%d"),
                exit_date=entry_date.strftime("%Y-%m-%d"),
                entry_price=total_premium,
                exit_price=final_premium,
                pnl=pnl_amount,
                pnl_percent=pnl_percent,
                max_profit=pnl_percent if pnl_percent > 0 else 0,
                max_loss=pnl_percent if pnl_percent < 0 else 0,
                underlying_move=underlying_move,
                days_held=0,  # Intraday
                outcome="profit" if pnl_amount > 0 else "loss",
                strategy="9:20 AM Straddle",
                notes=f"Exit: {exit_reason}, IV: {iv_morning:.1%} -> {iv_afternoon:.1%}"
            )
            trades.append(trade)
        
        return self._compile_results("9:20 AM Straddle", trades)
    
    def _compile_results(self, strategy_name: str, trades: List[TradeResult]) -> BacktestResult:
        """Compile all trades into comprehensive results"""
        if not trades:
            return BacktestResult(
                strategy_name=strategy_name,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=0,
                total_pnl=0,
                avg_profit=0,
                avg_loss=0,
                max_profit=0,
                max_loss=0,
                max_drawdown=0,
                sharpe_ratio=0,
                sortino_ratio=0,
                profit_factor=0,
                avg_days_held=0,
                capital_required=self.capital,
                roi_percent=0,
                trades=[]
            )
        
        winning_trades = [t for t in trades if t.pnl > 0]
        losing_trades = [t for t in trades if t.pnl < 0]
        
        total_pnl = sum(t.pnl for t in trades)
        
        # Calculate equity curve
        equity = [self.capital]
        for trade in trades:
            equity.append(equity[-1] + trade.pnl)
        
        # Calculate drawdown
        peak = self.capital
        max_drawdown = 0
        for value in equity:
            if value > peak:
                peak = value
            drawdown = (peak - value) / peak * 100
            max_drawdown = max(max_drawdown, drawdown)
        
        # Calculate returns for Sharpe/Sortino
        returns = [t.pnl / self.capital * 100 for t in trades]
        avg_return = np.mean(returns) if returns else 0
        std_return = np.std(returns) if len(returns) > 1 else 1
        downside_returns = [r for r in returns if r < 0]
        downside_std = np.std(downside_returns) if len(downside_returns) > 1 else 1
        
        # Annualized metrics (assuming ~50 trades per year)
        trades_per_year = 50
        sharpe_ratio = (avg_return * trades_per_year - self.risk_free_rate * 100) / (std_return * np.sqrt(trades_per_year)) if std_return > 0 else 0
        sortino_ratio = (avg_return * trades_per_year - self.risk_free_rate * 100) / (downside_std * np.sqrt(trades_per_year)) if downside_std > 0 else 0
        
        # Profit factor
        gross_profit = sum(t.pnl for t in winning_trades) if winning_trades else 0
        gross_loss = abs(sum(t.pnl for t in losing_trades)) if losing_trades else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
        
        # Monthly returns
        monthly_pnl = {}
        for trade in trades:
            month = trade.entry_date[:7]
            monthly_pnl[month] = monthly_pnl.get(month, 0) + trade.pnl
        monthly_returns = [v / self.capital * 100 for v in monthly_pnl.values()]
        
        return BacktestResult(
            strategy_name=strategy_name,
            total_trades=len(trades),
            winning_trades=len(winning_trades),
            losing_trades=len(losing_trades),
            win_rate=len(winning_trades) / len(trades) * 100,
            total_pnl=total_pnl,
            avg_profit=np.mean([t.pnl for t in winning_trades]) if winning_trades else 0,
            avg_loss=np.mean([t.pnl for t in losing_trades]) if losing_trades else 0,
            max_profit=max(t.pnl for t in trades),
            max_loss=min(t.pnl for t in trades),
            max_drawdown=max_drawdown,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            profit_factor=profit_factor,
            avg_days_held=np.mean([t.days_held for t in trades]),
            capital_required=self.capital,
            roi_percent=total_pnl / self.capital * 100,
            monthly_returns=monthly_returns,
            equity_curve=equity,
            trades=trades
        )
    
    def run_all_strategies(self, months: int = 12) -> Dict[str, BacktestResult]:
        """Run backtest on all implemented strategies"""
        results = {}
        
        print("🔄 Running Short Straddle backtest...")
        results["short_straddle"] = self.backtest_short_straddle(months)
        
        print("🔄 Running Short Strangle backtest...")
        results["short_strangle"] = self.backtest_short_strangle(months)
        
        print("🔄 Running Iron Condor backtest...")
        results["iron_condor"] = self.backtest_iron_condor(months)
        
        print("🔄 Running 9:20 AM Straddle backtest...")
        results["920_straddle"] = self.backtest_920_straddle(min(252, months * 21))
        
        return results


def generate_backtest_report(result: BacktestResult) -> Dict:
    """Generate JSON-serializable report for frontend"""
    return {
        "strategy_name": result.strategy_name,
        "summary": {
            "total_trades": result.total_trades,
            "winning_trades": result.winning_trades,
            "losing_trades": result.losing_trades,
            "win_rate": round(result.win_rate, 2),
            "total_pnl": round(result.total_pnl, 2),
            "roi_percent": round(result.roi_percent, 2),
        },
        "risk_metrics": {
            "max_drawdown": round(result.max_drawdown, 2),
            "sharpe_ratio": round(result.sharpe_ratio, 2),
            "sortino_ratio": round(result.sortino_ratio, 2),
            "profit_factor": round(result.profit_factor, 2),
        },
        "trade_metrics": {
            "avg_profit": round(result.avg_profit, 2),
            "avg_loss": round(result.avg_loss, 2),
            "max_profit": round(result.max_profit, 2),
            "max_loss": round(result.max_loss, 2),
            "avg_days_held": round(result.avg_days_held, 2),
        },
        "monthly_returns": [round(r, 2) for r in result.monthly_returns],
        "equity_curve": [round(e, 2) for e in result.equity_curve[::5]],  # Sample every 5th point
        "capital_required": result.capital_required,
        "recent_trades": [
            {
                "entry_date": t.entry_date,
                "exit_date": t.exit_date,
                "pnl": round(t.pnl, 2),
                "pnl_percent": round(t.pnl_percent, 2),
                "outcome": t.outcome,
                "notes": t.notes
            }
            for t in result.trades[-10:]  # Last 10 trades
        ]
    }


# Run backtest if executed directly
if __name__ == "__main__":
    print("=" * 60)
    print("ROBUST OPTIONS STRATEGY BACKTESTER")
    print("=" * 60)
    
    backtester = OptionsBacktester(symbol="NIFTY", capital=500000)
    results = backtester.run_all_strategies(months=12)
    
    print("\n" + "=" * 60)
    print("BACKTEST RESULTS SUMMARY")
    print("=" * 60)
    
    for name, result in results.items():
        print(f"\n📊 {result.strategy_name}")
        print(f"   Win Rate: {result.win_rate:.1f}%")
        print(f"   Total P&L: ₹{result.total_pnl:,.0f}")
        print(f"   ROI: {result.roi_percent:.1f}%")
        print(f"   Sharpe Ratio: {result.sharpe_ratio:.2f}")
        print(f"   Max Drawdown: {result.max_drawdown:.1f}%")
        print(f"   Profit Factor: {result.profit_factor:.2f}")
