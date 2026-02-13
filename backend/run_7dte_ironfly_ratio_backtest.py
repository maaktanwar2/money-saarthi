"""
7 DTE Iron Fly + Ratio Spread Backtest
======================================

STRATEGY STRUCTURE (Multi-Leg):

INNER IRON FLY:
- SELL 1 lot ATM PE (e.g., 24000 PE if spot = 24000)
- SELL 1 lot ATM CE (e.g., 24000 CE)
- BUY 1 lot 200 OTM PE (e.g., 23800 PE)
- BUY 1 lot 200 OTM CE (e.g., 24200 CE)

OUTER RATIO SPREAD:
- BUY 1 lot 500 OTM PE (e.g., 23500 PE)
- BUY 1 lot 500 OTM CE (e.g., 24500 CE)
- SELL 5 lots 600 OTM PE (e.g., 23400 PE)
- SELL 5 lots 600 OTM CE (e.g., 24600 CE)

Entry: 7 DTE (7 days before expiry)
Exit: Expiry day 3:15 PM or SL hit

Total Position:
- SELL: 1 lot ATM + 5 lots 600 OTM (each side)
- BUY: 1 lot 200 OTM + 1 lot 500 OTM (each side)
"""

import json
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Dict
import random
import math

# Constants
LOT_SIZE = 65  # NIFTY lot size (2025)
MARGIN_PER_LOT = 45000

@dataclass
class CombinedTrade:
    """Combined Iron Fly + Ratio Spread trade"""
    entry_date: str
    expiry_date: str
    dte_at_entry: int
    spot_at_entry: float
    
    # IRON FLY (Inner)
    # Sell ATM
    sell_atm_pe_strike: float
    sell_atm_ce_strike: float
    sell_atm_pe_premium: float
    sell_atm_ce_premium: float
    # Buy 200 OTM
    buy_200_pe_strike: float
    buy_200_ce_strike: float
    buy_200_pe_premium: float
    buy_200_ce_premium: float
    
    # RATIO SPREAD (Outer)
    # Buy 500 OTM (1 lot)
    buy_500_pe_strike: float
    buy_500_ce_strike: float
    buy_500_pe_premium: float
    buy_500_ce_premium: float
    # Sell 600 OTM (5 lots)
    sell_600_pe_strike: float
    sell_600_ce_strike: float
    sell_600_pe_premium: float
    sell_600_ce_premium: float
    
    # Exit
    spot_at_exit: float
    exit_date: str
    exit_reason: str
    
    # Exit premiums (all legs)
    sell_atm_pe_exit: float = 0
    sell_atm_ce_exit: float = 0
    buy_200_pe_exit: float = 0
    buy_200_ce_exit: float = 0
    buy_500_pe_exit: float = 0
    buy_500_ce_exit: float = 0
    sell_600_pe_exit: float = 0
    sell_600_ce_exit: float = 0
    
    # P&L breakdown
    iron_fly_pnl: float = 0
    ratio_spread_pnl: float = 0
    total_pnl: float = 0
    
    iv_at_entry: float = 0
    vix_at_entry: float = 0


def get_expiry_day(date: datetime) -> int:
    """Get expiry weekday based on date"""
    if date < datetime(2024, 11, 1):
        return 3  # Thursday
    elif date < datetime(2025, 3, 1):
        return 0  # Monday
    else:
        return 1  # Tuesday


def get_next_expiry(from_date: datetime) -> datetime:
    """Get next expiry date from given date"""
    expiry_day = get_expiry_day(from_date)
    days_until_expiry = (expiry_day - from_date.weekday()) % 7
    if days_until_expiry == 0:
        days_until_expiry = 7
    return from_date + timedelta(days=days_until_expiry)


def get_entry_date_for_7dte(expiry: datetime) -> datetime:
    """Get entry date that is 7 DTE from expiry"""
    return expiry - timedelta(days=7)


def estimate_option_premium(spot: float, strike: float, dte: int, iv: float, option_type: str) -> float:
    """Estimate option premium using simplified model"""
    moneyness = (spot - strike) / spot if option_type == "PE" else (strike - spot) / spot
    time_value = math.sqrt(dte / 365) * iv * spot / 100
    
    if option_type == "PE":
        intrinsic = max(0, strike - spot)
    else:
        intrinsic = max(0, spot - strike)
    
    # ATM options have highest time value
    if abs(strike - spot) < 50:  # ATM
        premium = time_value * 0.8 + intrinsic
    elif moneyness > 0:  # OTM
        decay_factor = math.exp(-moneyness * 3)
        premium = time_value * decay_factor * 0.4
    else:  # ITM
        premium = intrinsic + time_value * 0.3
    
    return max(premium, 2.0)


def calculate_exit_premium(spot: float, strike: float, dte: int, iv: float, option_type: str) -> float:
    """Calculate premium at exit"""
    if dte <= 0:
        # At expiry - only intrinsic value
        if option_type == "PE":
            return max(0, strike - spot)
        else:
            return max(0, spot - strike)
    else:
        return estimate_option_premium(spot, strike, dte, iv, option_type)


def simulate_spot_movement(start_spot: float, days: int, vix: float) -> List[float]:
    """Simulate daily spot prices"""
    prices = [start_spot]
    daily_vol = vix / 100 / math.sqrt(252)
    
    for _ in range(days):
        drift = random.gauss(0, daily_vol)
        if prices[-1] > start_spot * 1.02:
            drift -= 0.001
        elif prices[-1] < start_spot * 0.98:
            drift += 0.001
        
        new_price = prices[-1] * (1 + drift)
        prices.append(new_price)
    
    return prices


def run_backtest():
    """Run the combined Iron Fly + Ratio Spread backtest"""
    
    print("=" * 90)
    print("7 DTE IRON FLY + RATIO SPREAD BACKTEST")
    print("=" * 90)
    print("\n📦 STRATEGY STRUCTURE:")
    print("\n   INNER IRON FLY:")
    print("   ├── SELL 1 lot ATM PE")
    print("   ├── SELL 1 lot ATM CE")
    print("   ├── BUY 1 lot 200 OTM PE")
    print("   └── BUY 1 lot 200 OTM CE")
    print("\n   OUTER RATIO SPREAD:")
    print("   ├── BUY 1 lot 500 OTM PE")
    print("   ├── BUY 1 lot 500 OTM CE")
    print("   ├── SELL 5 lots 600 OTM PE")
    print("   └── SELL 5 lots 600 OTM CE")
    print("=" * 90)
    
    trades: List[CombinedTrade] = []
    
    # Simulation parameters
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2026, 2, 1)
    
    # Generate all expiry dates
    current_date = start_date
    expiries = []
    while current_date < end_date:
        expiry = get_next_expiry(current_date)
        if expiry not in expiries and expiry < end_date:
            expiries.append(expiry)
        current_date = expiry + timedelta(days=1)
    
    print(f"\nTotal expiries to backtest: {len(expiries)}")
    print(f"Period: {start_date.strftime('%b %Y')} to {end_date.strftime('%b %Y')}")
    
    base_spot = 21500
    
    for expiry in expiries:
        entry_date = get_entry_date_for_7dte(expiry)
        
        if entry_date < start_date:
            continue
        
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        dte = (expiry - entry_date).days
        if dte < 5 or dte > 10:
            continue
        
        months_elapsed = (entry_date - start_date).days / 30
        spot_drift = months_elapsed * 100
        spot = base_spot + spot_drift + random.uniform(-500, 500)
        spot = round(spot / 50) * 50
        
        vix = random.uniform(11, 18)
        iv = vix + random.uniform(-2, 3)
        
        atm_strike = round(spot / 50) * 50
        
        # IRON FLY strikes
        sell_atm_pe_strike = atm_strike
        sell_atm_ce_strike = atm_strike
        buy_200_pe_strike = atm_strike - 200
        buy_200_ce_strike = atm_strike + 200
        
        # RATIO SPREAD strikes
        buy_500_pe_strike = atm_strike - 500
        buy_500_ce_strike = atm_strike + 500
        sell_600_pe_strike = atm_strike - 600
        sell_600_ce_strike = atm_strike + 600
        
        # Entry premiums - IRON FLY
        sell_atm_pe_premium = estimate_option_premium(spot, sell_atm_pe_strike, dte, iv, "PE")
        sell_atm_ce_premium = estimate_option_premium(spot, sell_atm_ce_strike, dte, iv, "CE")
        buy_200_pe_premium = estimate_option_premium(spot, buy_200_pe_strike, dte, iv, "PE")
        buy_200_ce_premium = estimate_option_premium(spot, buy_200_ce_strike, dte, iv, "CE")
        
        # Entry premiums - RATIO SPREAD
        buy_500_pe_premium = estimate_option_premium(spot, buy_500_pe_strike, dte, iv, "PE")
        buy_500_ce_premium = estimate_option_premium(spot, buy_500_ce_strike, dte, iv, "CE")
        sell_600_pe_premium = estimate_option_premium(spot, sell_600_pe_strike, dte, iv, "PE")
        sell_600_ce_premium = estimate_option_premium(spot, sell_600_ce_strike, dte, iv, "CE")
        
        # Net premium calculation
        # Iron Fly: Sell ATM (credit) - Buy 200 OTM (debit)
        iron_fly_credit = (sell_atm_pe_premium + sell_atm_ce_premium) * 1 * LOT_SIZE
        iron_fly_debit = (buy_200_pe_premium + buy_200_ce_premium) * 1 * LOT_SIZE
        iron_fly_net = iron_fly_credit - iron_fly_debit
        
        # Ratio Spread: Sell 600 (5 lots credit) - Buy 500 (1 lot debit)
        ratio_credit = (sell_600_pe_premium + sell_600_ce_premium) * 5 * LOT_SIZE
        ratio_debit = (buy_500_pe_premium + buy_500_ce_premium) * 1 * LOT_SIZE
        ratio_net = ratio_credit - ratio_debit
        
        total_net_credit = iron_fly_net + ratio_net
        
        # Simulate price path
        price_path = simulate_spot_movement(spot, dte, vix)
        
        exit_date = expiry
        exit_reason = "expiry"
        exit_spot = price_path[-1]
        exit_dte = 0
        
        # Stop loss check
        max_loss_threshold = total_net_credit * 1.5  # 1.5x net credit
        
        for day_idx, day_spot in enumerate(price_path[1:-1], 1):
            remaining_dte = dte - day_idx
            if remaining_dte <= 0:
                break
            
            # Calculate MTM for all legs
            # Iron Fly
            atm_pe_mtm = calculate_exit_premium(day_spot, sell_atm_pe_strike, remaining_dte, iv, "PE")
            atm_ce_mtm = calculate_exit_premium(day_spot, sell_atm_ce_strike, remaining_dte, iv, "CE")
            otm_200_pe_mtm = calculate_exit_premium(day_spot, buy_200_pe_strike, remaining_dte, iv, "PE")
            otm_200_ce_mtm = calculate_exit_premium(day_spot, buy_200_ce_strike, remaining_dte, iv, "CE")
            
            # Ratio Spread
            otm_500_pe_mtm = calculate_exit_premium(day_spot, buy_500_pe_strike, remaining_dte, iv, "PE")
            otm_500_ce_mtm = calculate_exit_premium(day_spot, buy_500_ce_strike, remaining_dte, iv, "CE")
            otm_600_pe_mtm = calculate_exit_premium(day_spot, sell_600_pe_strike, remaining_dte, iv, "PE")
            otm_600_ce_mtm = calculate_exit_premium(day_spot, sell_600_ce_strike, remaining_dte, iv, "CE")
            
            # Iron Fly MTM P&L
            if_sell_pnl = ((sell_atm_pe_premium - atm_pe_mtm) + (sell_atm_ce_premium - atm_ce_mtm)) * 1 * LOT_SIZE
            if_buy_pnl = ((otm_200_pe_mtm - buy_200_pe_premium) + (otm_200_ce_mtm - buy_200_ce_premium)) * 1 * LOT_SIZE
            
            # Ratio Spread MTM P&L
            rs_sell_pnl = ((sell_600_pe_premium - otm_600_pe_mtm) + (sell_600_ce_premium - otm_600_ce_mtm)) * 5 * LOT_SIZE
            rs_buy_pnl = ((otm_500_pe_mtm - buy_500_pe_premium) + (otm_500_ce_mtm - buy_500_ce_premium)) * 1 * LOT_SIZE
            
            mtm_pnl = if_sell_pnl + if_buy_pnl + rs_sell_pnl + rs_buy_pnl
            
            if mtm_pnl < -max_loss_threshold:
                exit_date = entry_date + timedelta(days=day_idx)
                exit_reason = "stop_loss"
                exit_spot = day_spot
                exit_dte = remaining_dte
                break
        
        # Calculate exit premiums
        sell_atm_pe_exit = calculate_exit_premium(exit_spot, sell_atm_pe_strike, exit_dte, iv, "PE")
        sell_atm_ce_exit = calculate_exit_premium(exit_spot, sell_atm_ce_strike, exit_dte, iv, "CE")
        buy_200_pe_exit = calculate_exit_premium(exit_spot, buy_200_pe_strike, exit_dte, iv, "PE")
        buy_200_ce_exit = calculate_exit_premium(exit_spot, buy_200_ce_strike, exit_dte, iv, "CE")
        buy_500_pe_exit = calculate_exit_premium(exit_spot, buy_500_pe_strike, exit_dte, iv, "PE")
        buy_500_ce_exit = calculate_exit_premium(exit_spot, buy_500_ce_strike, exit_dte, iv, "CE")
        sell_600_pe_exit = calculate_exit_premium(exit_spot, sell_600_pe_strike, exit_dte, iv, "PE")
        sell_600_ce_exit = calculate_exit_premium(exit_spot, sell_600_ce_strike, exit_dte, iv, "CE")
        
        # Calculate final P&L
        # Iron Fly P&L
        if_sell_pnl = ((sell_atm_pe_premium - sell_atm_pe_exit) + (sell_atm_ce_premium - sell_atm_ce_exit)) * 1 * LOT_SIZE
        if_buy_pnl = ((buy_200_pe_exit - buy_200_pe_premium) + (buy_200_ce_exit - buy_200_ce_premium)) * 1 * LOT_SIZE
        iron_fly_pnl = if_sell_pnl + if_buy_pnl
        
        # Ratio Spread P&L
        rs_sell_pnl = ((sell_600_pe_premium - sell_600_pe_exit) + (sell_600_ce_premium - sell_600_ce_exit)) * 5 * LOT_SIZE
        rs_buy_pnl = ((buy_500_pe_exit - buy_500_pe_premium) + (buy_500_ce_exit - buy_500_ce_premium)) * 1 * LOT_SIZE
        ratio_spread_pnl = rs_sell_pnl + rs_buy_pnl
        
        total_pnl = iron_fly_pnl + ratio_spread_pnl
        
        trade = CombinedTrade(
            entry_date=entry_date.strftime("%Y-%m-%d"),
            expiry_date=expiry.strftime("%Y-%m-%d"),
            dte_at_entry=dte,
            spot_at_entry=spot,
            
            # Iron Fly
            sell_atm_pe_strike=sell_atm_pe_strike,
            sell_atm_ce_strike=sell_atm_ce_strike,
            sell_atm_pe_premium=round(sell_atm_pe_premium, 2),
            sell_atm_ce_premium=round(sell_atm_ce_premium, 2),
            buy_200_pe_strike=buy_200_pe_strike,
            buy_200_ce_strike=buy_200_ce_strike,
            buy_200_pe_premium=round(buy_200_pe_premium, 2),
            buy_200_ce_premium=round(buy_200_ce_premium, 2),
            
            # Ratio Spread
            buy_500_pe_strike=buy_500_pe_strike,
            buy_500_ce_strike=buy_500_ce_strike,
            buy_500_pe_premium=round(buy_500_pe_premium, 2),
            buy_500_ce_premium=round(buy_500_ce_premium, 2),
            sell_600_pe_strike=sell_600_pe_strike,
            sell_600_ce_strike=sell_600_ce_strike,
            sell_600_pe_premium=round(sell_600_pe_premium, 2),
            sell_600_ce_premium=round(sell_600_ce_premium, 2),
            
            spot_at_exit=round(exit_spot, 2),
            exit_date=exit_date.strftime("%Y-%m-%d"),
            exit_reason=exit_reason,
            
            sell_atm_pe_exit=round(sell_atm_pe_exit, 2),
            sell_atm_ce_exit=round(sell_atm_ce_exit, 2),
            buy_200_pe_exit=round(buy_200_pe_exit, 2),
            buy_200_ce_exit=round(buy_200_ce_exit, 2),
            buy_500_pe_exit=round(buy_500_pe_exit, 2),
            buy_500_ce_exit=round(buy_500_ce_exit, 2),
            sell_600_pe_exit=round(sell_600_pe_exit, 2),
            sell_600_ce_exit=round(sell_600_ce_exit, 2),
            
            iron_fly_pnl=round(iron_fly_pnl, 2),
            ratio_spread_pnl=round(ratio_spread_pnl, 2),
            total_pnl=round(total_pnl, 2),
            
            iv_at_entry=round(iv, 1),
            vix_at_entry=round(vix, 1)
        )
        
        trades.append(trade)
    
    # ==========================================
    # ANALYSIS
    # ==========================================
    
    print("\n" + "=" * 90)
    print("BACKTEST RESULTS")
    print("=" * 90)
    
    total_trades = len(trades)
    winning_trades = [t for t in trades if t.total_pnl > 0]
    losing_trades = [t for t in trades if t.total_pnl <= 0]
    
    total_pnl = sum(t.total_pnl for t in trades)
    avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
    
    win_rate = len(winning_trades) / total_trades * 100 if total_trades > 0 else 0
    
    avg_win = sum(t.total_pnl for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t.total_pnl for t in losing_trades) / len(losing_trades) if losing_trades else 0
    
    max_win = max(t.total_pnl for t in trades) if trades else 0
    max_loss = min(t.total_pnl for t in trades) if trades else 0
    
    # Iron Fly breakdown
    total_if_pnl = sum(t.iron_fly_pnl for t in trades)
    total_rs_pnl = sum(t.ratio_spread_pnl for t in trades)
    
    # Margin: ATM sell (1 lot) + 600 OTM sell (5 lots) - wings are protective
    margin_required = (1 * MARGIN_PER_LOT) + (5 * MARGIN_PER_LOT) + (2 * MARGIN_PER_LOT * 0.2)
    roi = (total_pnl / margin_required) * 100 if margin_required > 0 else 0
    
    expiry_exits = len([t for t in trades if t.exit_reason == "expiry"])
    sl_exits = len([t for t in trades if t.exit_reason == "stop_loss"])
    
    print(f"\n📊 TRADE STATISTICS:")
    print(f"   Total Trades: {total_trades}")
    print(f"   Winning Trades: {len(winning_trades)}")
    print(f"   Losing Trades: {len(losing_trades)}")
    print(f"   Win Rate: {win_rate:.1f}%")
    
    print(f"\n💰 P&L SUMMARY:")
    print(f"   Total P&L: ₹{total_pnl:,.0f}")
    print(f"   Average P&L per Trade: ₹{avg_pnl:,.0f}")
    print(f"   Average Win: ₹{avg_win:,.0f}")
    print(f"   Average Loss: ₹{avg_loss:,.0f}")
    print(f"   Max Win: ₹{max_win:,.0f}")
    print(f"   Max Loss: ₹{max_loss:,.0f}")
    
    print(f"\n📈 P&L BREAKDOWN BY STRATEGY:")
    print(f"   Iron Fly P&L: ₹{total_if_pnl:,.0f} ({total_if_pnl/total_pnl*100:.1f}% of total)")
    print(f"   Ratio Spread P&L: ₹{total_rs_pnl:,.0f} ({total_rs_pnl/total_pnl*100:.1f}% of total)")
    
    print(f"\n📈 CAPITAL & ROI:")
    print(f"   Margin Required: ₹{margin_required:,.0f}")
    print(f"   Total ROI: {roi:,.1f}%")
    print(f"   Monthly ROI: {roi / 24:.1f}%")
    
    print(f"\n🚪 EXIT ANALYSIS:")
    print(f"   Expiry Exits: {expiry_exits} ({expiry_exits/total_trades*100:.1f}%)")
    print(f"   Stop Loss Exits: {sl_exits} ({sl_exits/total_trades*100:.1f}%)")
    
    gross_profit = sum(t.total_pnl for t in winning_trades)
    gross_loss = abs(sum(t.total_pnl for t in losing_trades))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
    
    print(f"\n📊 RISK METRICS:")
    print(f"   Profit Factor: {profit_factor:.2f}")
    print(f"   Risk:Reward: 1:{abs(avg_win/avg_loss) if avg_loss != 0 else 0:.2f}")
    
    # Monthly breakdown
    print("\n" + "=" * 90)
    print("MONTHLY BREAKDOWN")
    print("=" * 90)
    
    monthly_pnl = {}
    for trade in trades:
        month_key = trade.entry_date[:7]
        if month_key not in monthly_pnl:
            monthly_pnl[month_key] = {"pnl": 0, "trades": 0, "wins": 0, "if_pnl": 0, "rs_pnl": 0}
        monthly_pnl[month_key]["pnl"] += trade.total_pnl
        monthly_pnl[month_key]["if_pnl"] += trade.iron_fly_pnl
        monthly_pnl[month_key]["rs_pnl"] += trade.ratio_spread_pnl
        monthly_pnl[month_key]["trades"] += 1
        if trade.total_pnl > 0:
            monthly_pnl[month_key]["wins"] += 1
    
    print(f"\n{'Month':<10} {'Trades':>8} {'Win%':>8} {'Iron Fly':>12} {'Ratio':>12} {'Total P&L':>12}")
    print("-" * 70)
    
    for month in sorted(monthly_pnl.keys()):
        data = monthly_pnl[month]
        wr = data['wins'] / data['trades'] * 100 if data['trades'] > 0 else 0
        print(f"{month:<10} {data['trades']:>8} {wr:>7.0f}% {data['if_pnl']:>+11,.0f} {data['rs_pnl']:>+11,.0f} {data['pnl']:>+11,.0f}")
    
    # Sample trades
    print("\n" + "=" * 90)
    print("SAMPLE TRADES (First 10)")
    print("=" * 90)
    
    print(f"\n{'Entry':<12} {'Spot':>7} {'ATM':>6} {'200OTM':>8} {'500OTM':>8} {'600OTM':>8} {'IF P&L':>10} {'RS P&L':>10} {'Total':>10}")
    print("-" * 100)
    
    for trade in trades[:10]:
        print(f"{trade.entry_date:<12} {trade.spot_at_entry:>7.0f} {int(trade.sell_atm_pe_strike):>6} "
              f"{int(trade.buy_200_pe_strike):>8} {int(trade.buy_500_pe_strike):>8} {int(trade.sell_600_pe_strike):>8} "
              f"{trade.iron_fly_pnl:>+10,.0f} {trade.ratio_spread_pnl:>+10,.0f} {trade.total_pnl:>+10,.0f}")
    
    # Position structure
    print("\n" + "=" * 90)
    print("POSITION STRUCTURE SUMMARY")
    print("=" * 90)
    
    # Average premiums
    avg_atm_pe = sum(t.sell_atm_pe_premium for t in trades) / len(trades)
    avg_atm_ce = sum(t.sell_atm_ce_premium for t in trades) / len(trades)
    avg_200_pe = sum(t.buy_200_pe_premium for t in trades) / len(trades)
    avg_200_ce = sum(t.buy_200_ce_premium for t in trades) / len(trades)
    avg_500_pe = sum(t.buy_500_pe_premium for t in trades) / len(trades)
    avg_500_ce = sum(t.buy_500_ce_premium for t in trades) / len(trades)
    avg_600_pe = sum(t.sell_600_pe_premium for t in trades) / len(trades)
    avg_600_ce = sum(t.sell_600_ce_premium for t in trades) / len(trades)
    
    if_credit = (avg_atm_pe + avg_atm_ce) * 1 * LOT_SIZE
    if_debit = (avg_200_pe + avg_200_ce) * 1 * LOT_SIZE
    if_net = if_credit - if_debit
    
    rs_credit = (avg_600_pe + avg_600_ce) * 5 * LOT_SIZE
    rs_debit = (avg_500_pe + avg_500_ce) * 1 * LOT_SIZE
    rs_net = rs_credit - rs_debit
    
    total_net = if_net + rs_net
    
    print(f"\n📦 IRON FLY (Inner Structure):")
    print(f"   SELL ATM Straddle: ₹{avg_atm_pe:.0f} PE + ₹{avg_atm_ce:.0f} CE = ₹{if_credit:,.0f} credit")
    print(f"   BUY 200 OTM Wings: ₹{avg_200_pe:.0f} PE + ₹{avg_200_ce:.0f} CE = ₹{if_debit:,.0f} debit")
    print(f"   Iron Fly Net Credit: ₹{if_net:,.0f}")
    
    print(f"\n📦 RATIO SPREAD (Outer Structure):")
    print(f"   BUY 1 lot 500 OTM: ₹{avg_500_pe:.0f} PE + ₹{avg_500_ce:.0f} CE = ₹{rs_debit:,.0f} debit")
    print(f"   SELL 5 lots 600 OTM: ₹{avg_600_pe:.0f} PE + ₹{avg_600_ce:.0f} CE = ₹{rs_credit:,.0f} credit")
    print(f"   Ratio Spread Net Credit: ₹{rs_net:,.0f}")
    
    print(f"\n💵 TOTAL NET CREDIT: ₹{total_net:,.0f}")
    
    avg_spot = sum(t.spot_at_entry for t in trades) / len(trades)
    print(f"\n📍 PAYOFF ZONES (at expiry):")
    print(f"   Max Profit Zone: Spot stays at ATM ({avg_spot:.0f})")
    print(f"   Breakeven 1: ~{avg_spot - 200:.0f} to ~{avg_spot + 200:.0f} (±200 pts)")
    print(f"   Danger Zone: Beyond ±500 pts from ATM")
    print(f"   Protected by: 500 OTM long wings")
    print(f"   Risk Zone: 600 OTM short legs (5x exposure)")
    
    # Save results
    results = {
        "strategy": "7 DTE Iron Fly + Ratio Spread",
        "structure": {
            "iron_fly": {
                "sell": "1 lot ATM PE + CE",
                "buy": "1 lot 200 OTM PE + CE"
            },
            "ratio_spread": {
                "buy": "1 lot 500 OTM PE + CE",
                "sell": "5 lots 600 OTM PE + CE"
            }
        },
        "period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        "statistics": {
            "total_trades": total_trades,
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate": round(win_rate, 1),
            "total_pnl": round(total_pnl, 2),
            "iron_fly_pnl": round(total_if_pnl, 2),
            "ratio_spread_pnl": round(total_rs_pnl, 2),
            "avg_pnl": round(avg_pnl, 2),
            "profit_factor": round(profit_factor, 2),
            "roi_percent": round(roi, 1),
            "margin_required": margin_required
        },
        "monthly_pnl": monthly_pnl
    }
    
    with open("7dte_ironfly_ratio_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("\n" + "=" * 90)
    print("✅ Results saved to 7dte_ironfly_ratio_results.json")
    print("=" * 90)
    
    return results


if __name__ == "__main__":
    run_backtest()
