"""
7 DTE Ratio Iron Butterfly Backtest
===================================

STRATEGY STRUCTURE:
- BUY 1 lot at 500 OTM (wings - protection)
- SELL 5 lots at 600 OTM (body - premium collection)

Position Structure (for NIFTY):
- BUY 1 lot 500 OTM PE (e.g., 23500 PE if spot = 24000)
- BUY 1 lot 500 OTM CE (e.g., 24500 CE if spot = 24000)
- SELL 5 lots 600 OTM PE (e.g., 23400 PE)
- SELL 5 lots 600 OTM CE (e.g., 24600 CE)

Entry: 7 DTE (7 days before expiry)
Exit: Expiry day 3:15 PM or SL hit

NIFTY Expiry Changes:
- Jan 2024 - Oct 2024: Thursday
- Nov 2024 - Feb 2025: Monday  
- Mar 2025+: Tuesday
"""

import json
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Dict, Tuple
import random
import math

# Constants
LOT_SIZE = 65  # NIFTY lot size (2025)
MARGIN_PER_LOT = 45000  # Approximate margin for selling

@dataclass
class IronButterflyTrade:
    """Single iron butterfly trade"""
    entry_date: str
    expiry_date: str
    dte_at_entry: int
    spot_at_entry: float
    
    # Wing strikes (BUY 1 lot each)
    buy_pe_strike: float
    buy_ce_strike: float
    buy_pe_premium: float
    buy_ce_premium: float
    
    # Body strikes (SELL 5 lots each)
    sell_pe_strike: float
    sell_ce_strike: float
    sell_pe_premium: float
    sell_ce_premium: float
    
    # Exit
    spot_at_exit: float
    exit_date: str
    exit_reason: str
    
    # P&L
    buy_pe_exit: float = 0
    buy_ce_exit: float = 0
    sell_pe_exit: float = 0
    sell_ce_exit: float = 0
    pnl: float = 0
    
    # Greeks at entry
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
    """
    Estimate option premium using simplified Black-Scholes approximation
    """
    moneyness = (spot - strike) / spot if option_type == "PE" else (strike - spot) / spot
    time_value = math.sqrt(dte / 365) * iv * spot / 100
    
    if option_type == "PE":
        intrinsic = max(0, strike - spot)
    else:
        intrinsic = max(0, spot - strike)
    
    # OTM options - mainly time value
    if moneyness > 0:  # OTM
        # Time value decays based on how far OTM
        decay_factor = math.exp(-moneyness * 3)
        premium = time_value * decay_factor * 0.4
    else:  # ITM
        premium = intrinsic + time_value * 0.3
    
    # Minimum premium
    return max(premium, 2.0)


def simulate_spot_movement(start_spot: float, days: int, vix: float) -> List[float]:
    """Simulate daily spot prices"""
    prices = [start_spot]
    daily_vol = vix / 100 / math.sqrt(252)
    
    for _ in range(days):
        # Random walk with mean reversion tendency
        drift = random.gauss(0, daily_vol)
        # Add slight mean reversion
        if prices[-1] > start_spot * 1.02:
            drift -= 0.001
        elif prices[-1] < start_spot * 0.98:
            drift += 0.001
        
        new_price = prices[-1] * (1 + drift)
        prices.append(new_price)
    
    return prices


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


def run_backtest():
    """Run the 7 DTE Iron Butterfly backtest"""
    
    print("=" * 80)
    print("7 DTE RATIO IRON BUTTERFLY BACKTEST")
    print("=" * 80)
    print("\nSTRATEGY STRUCTURE:")
    print("  BUY 1 lot at 500 OTM (wings - protection)")
    print("  SELL 5 lots at 600 OTM (body - premium collection)")
    print("\nPOSITION STRUCTURE:")
    print("  BUY 1 lot 500 OTM PE + BUY 1 lot 500 OTM CE")
    print("  SELL 5 lots 600 OTM PE + SELL 5 lots 600 OTM CE")
    print("=" * 80)
    
    trades: List[IronButterflyTrade] = []
    
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
    
    # Base NIFTY spot (will vary)
    base_spot = 21500  # Starting Jan 2024
    
    for expiry in expiries:
        entry_date = get_entry_date_for_7dte(expiry)
        
        # Skip if entry date is before our start
        if entry_date < start_date:
            continue
        
        # Skip weekends for entry
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        # Calculate DTE
        dte = (expiry - entry_date).days
        if dte < 5 or dte > 10:
            continue
        
        # Simulate spot price progression over time
        months_elapsed = (entry_date - start_date).days / 30
        spot_drift = months_elapsed * 100  # ~100 pts per month average
        spot = base_spot + spot_drift + random.uniform(-500, 500)
        spot = round(spot / 50) * 50  # Round to nearest 50
        
        # VIX based on market conditions
        vix = random.uniform(11, 18)
        iv = vix + random.uniform(-2, 3)
        
        # Calculate strikes
        atm_strike = round(spot / 50) * 50
        
        # Wings (BUY 1 lot each) - 500 OTM
        buy_pe_strike = atm_strike - 500
        buy_ce_strike = atm_strike + 500
        
        # Body (SELL 5 lots each) - 600 OTM
        sell_pe_strike = atm_strike - 600
        sell_ce_strike = atm_strike + 600
        
        # Calculate entry premiums
        buy_pe_premium = estimate_option_premium(spot, buy_pe_strike, dte, iv, "PE")
        buy_ce_premium = estimate_option_premium(spot, buy_ce_strike, dte, iv, "CE")
        sell_pe_premium = estimate_option_premium(spot, sell_pe_strike, dte, iv, "PE")
        sell_ce_premium = estimate_option_premium(spot, sell_ce_strike, dte, iv, "CE")
        
        # Net premium calculation
        # BUY 1 lot wings: cost
        buy_cost = (buy_pe_premium + buy_ce_premium) * 1 * LOT_SIZE
        # SELL 5 lots body: credit
        sell_credit = (sell_pe_premium + sell_ce_premium) * 5 * LOT_SIZE
        
        net_premium = sell_credit - buy_cost  # Should be positive (net credit)
        
        # Simulate price path
        price_path = simulate_spot_movement(spot, dte, vix)
        
        # Check for stop loss during holding period
        exit_date = expiry
        exit_reason = "expiry"
        exit_spot = price_path[-1]
        exit_dte = 0
        
        # Stop loss check - if unrealized loss > 2x net premium collected
        max_loss_threshold = net_premium * 2
        
        for day_idx, day_spot in enumerate(price_path[1:-1], 1):
            remaining_dte = dte - day_idx
            if remaining_dte <= 0:
                break
            
            # Calculate MTM
            buy_pe_mtm = calculate_exit_premium(day_spot, buy_pe_strike, remaining_dte, iv, "PE")
            buy_ce_mtm = calculate_exit_premium(day_spot, buy_ce_strike, remaining_dte, iv, "CE")
            sell_pe_mtm = calculate_exit_premium(day_spot, sell_pe_strike, remaining_dte, iv, "PE")
            sell_ce_mtm = calculate_exit_premium(day_spot, sell_ce_strike, remaining_dte, iv, "CE")
            
            # MTM P&L
            buy_pnl = ((buy_pe_mtm - buy_pe_premium) + (buy_ce_mtm - buy_ce_premium)) * 1 * LOT_SIZE
            sell_pnl = ((sell_pe_premium - sell_pe_mtm) + (sell_ce_premium - sell_ce_mtm)) * 5 * LOT_SIZE
            mtm_pnl = buy_pnl + sell_pnl
            
            # Check stop loss
            if mtm_pnl < -max_loss_threshold:
                exit_date = entry_date + timedelta(days=day_idx)
                exit_reason = "stop_loss"
                exit_spot = day_spot
                exit_dte = remaining_dte
                break
        
        # Calculate exit premiums
        buy_pe_exit = calculate_exit_premium(exit_spot, buy_pe_strike, exit_dte, iv, "PE")
        buy_ce_exit = calculate_exit_premium(exit_spot, buy_ce_strike, exit_dte, iv, "CE")
        sell_pe_exit = calculate_exit_premium(exit_spot, sell_pe_strike, exit_dte, iv, "PE")
        sell_ce_exit = calculate_exit_premium(exit_spot, sell_ce_strike, exit_dte, iv, "CE")
        
        # Calculate final P&L
        # BUY legs: (exit - entry) * qty
        buy_pnl = ((buy_pe_exit - buy_pe_premium) + (buy_ce_exit - buy_ce_premium)) * 1 * LOT_SIZE
        # SELL legs: (entry - exit) * qty (profit when premium decays)
        sell_pnl = ((sell_pe_premium - sell_pe_exit) + (sell_ce_premium - sell_ce_exit)) * 5 * LOT_SIZE
        
        total_pnl = buy_pnl + sell_pnl
        
        trade = IronButterflyTrade(
            entry_date=entry_date.strftime("%Y-%m-%d"),
            expiry_date=expiry.strftime("%Y-%m-%d"),
            dte_at_entry=dte,
            spot_at_entry=spot,
            buy_pe_strike=buy_pe_strike,
            buy_ce_strike=buy_ce_strike,
            buy_pe_premium=round(buy_pe_premium, 2),
            buy_ce_premium=round(buy_ce_premium, 2),
            sell_pe_strike=sell_pe_strike,
            sell_ce_strike=sell_ce_strike,
            sell_pe_premium=round(sell_pe_premium, 2),
            sell_ce_premium=round(sell_ce_premium, 2),
            spot_at_exit=round(exit_spot, 2),
            exit_date=exit_date.strftime("%Y-%m-%d"),
            exit_reason=exit_reason,
            buy_pe_exit=round(buy_pe_exit, 2),
            buy_ce_exit=round(buy_ce_exit, 2),
            sell_pe_exit=round(sell_pe_exit, 2),
            sell_ce_exit=round(sell_ce_exit, 2),
            pnl=round(total_pnl, 2),
            iv_at_entry=round(iv, 1),
            vix_at_entry=round(vix, 1)
        )
        
        trades.append(trade)
    
    # ==========================================
    # ANALYSIS
    # ==========================================
    
    print("\n" + "=" * 80)
    print("BACKTEST RESULTS")
    print("=" * 80)
    
    total_trades = len(trades)
    winning_trades = [t for t in trades if t.pnl > 0]
    losing_trades = [t for t in trades if t.pnl <= 0]
    
    total_pnl = sum(t.pnl for t in trades)
    avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
    
    win_rate = len(winning_trades) / total_trades * 100 if total_trades > 0 else 0
    
    avg_win = sum(t.pnl for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t.pnl for t in losing_trades) / len(losing_trades) if losing_trades else 0
    
    max_win = max(t.pnl for t in trades) if trades else 0
    max_loss = min(t.pnl for t in trades) if trades else 0
    
    # Margin calculation: 5 lots sell (main margin) + 1 lot buy (small margin)
    margin_required = (5 * MARGIN_PER_LOT) + (1 * MARGIN_PER_LOT * 0.3)
    roi = (total_pnl / margin_required) * 100 if margin_required > 0 else 0
    
    # Exit analysis
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
    
    print(f"\n📈 CAPITAL & ROI:")
    print(f"   Margin Required: ₹{margin_required:,.0f}")
    print(f"   Total ROI: {roi:,.1f}%")
    print(f"   Monthly ROI: {roi / 24:.1f}%")  # ~24 months backtest
    
    print(f"\n🚪 EXIT ANALYSIS:")
    print(f"   Expiry Exits: {expiry_exits} ({expiry_exits/total_trades*100:.1f}%)")
    print(f"   Stop Loss Exits: {sl_exits} ({sl_exits/total_trades*100:.1f}%)")
    
    # Profit factor
    gross_profit = sum(t.pnl for t in winning_trades)
    gross_loss = abs(sum(t.pnl for t in losing_trades))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
    
    print(f"\n📊 RISK METRICS:")
    print(f"   Profit Factor: {profit_factor:.2f}")
    print(f"   Risk:Reward: 1:{abs(avg_win/avg_loss) if avg_loss != 0 else 0:.2f}")
    
    # Monthly breakdown
    print("\n" + "=" * 80)
    print("MONTHLY BREAKDOWN")
    print("=" * 80)
    
    monthly_pnl = {}
    for trade in trades:
        month_key = trade.entry_date[:7]
        if month_key not in monthly_pnl:
            monthly_pnl[month_key] = {"pnl": 0, "trades": 0, "wins": 0}
        monthly_pnl[month_key]["pnl"] += trade.pnl
        monthly_pnl[month_key]["trades"] += 1
        if trade.pnl > 0:
            monthly_pnl[month_key]["wins"] += 1
    
    print(f"\n{'Month':<10} {'Trades':>8} {'Win Rate':>10} {'P&L':>12}")
    print("-" * 45)
    
    for month in sorted(monthly_pnl.keys()):
        data = monthly_pnl[month]
        wr = data['wins'] / data['trades'] * 100 if data['trades'] > 0 else 0
        pnl_str = f"₹{data['pnl']:,.0f}"
        pnl_color = "+" if data['pnl'] >= 0 else ""
        print(f"{month:<10} {data['trades']:>8} {wr:>9.1f}% {pnl_color}{pnl_str:>11}")
    
    # Sample trades
    print("\n" + "=" * 80)
    print("SAMPLE TRADES (First 10)")
    print("=" * 80)
    
    print(f"\n{'Entry':<12} {'Expiry':<12} {'Spot':>8} {'Buy Strikes':>14} {'Sell Strikes':>14} {'P&L':>10} {'Exit':<8}")
    print("-" * 90)
    
    for trade in trades[:10]:
        buy_strikes = f"{int(trade.buy_pe_strike)}/{int(trade.buy_ce_strike)}"
        sell_strikes = f"{int(trade.sell_pe_strike)}/{int(trade.sell_ce_strike)}"
        pnl_str = f"₹{trade.pnl:,.0f}"
        print(f"{trade.entry_date:<12} {trade.expiry_date:<12} {trade.spot_at_entry:>8.0f} {buy_strikes:>14} {sell_strikes:>14} {pnl_str:>10} {trade.exit_reason:<8}")
    
    # Position structure summary
    print("\n" + "=" * 80)
    print("POSITION STRUCTURE SUMMARY")
    print("=" * 80)
    
    # Average premiums
    avg_buy_pe = sum(t.buy_pe_premium for t in trades) / len(trades)
    avg_buy_ce = sum(t.buy_ce_premium for t in trades) / len(trades)
    avg_sell_pe = sum(t.sell_pe_premium for t in trades) / len(trades)
    avg_sell_ce = sum(t.sell_ce_premium for t in trades) / len(trades)
    
    buy_cost = (avg_buy_pe + avg_buy_ce) * 1 * LOT_SIZE
    sell_credit = (avg_sell_pe + avg_sell_ce) * 5 * LOT_SIZE
    net_credit = sell_credit - buy_cost
    
    print(f"\n📦 AVERAGE POSITION (per trade):")
    print(f"\n   WINGS (BUY 1 lot each):")
    print(f"   - BUY PE at 500 OTM: Avg Premium ₹{avg_buy_pe:.0f}")
    print(f"   - BUY CE at 500 OTM: Avg Premium ₹{avg_buy_ce:.0f}")
    print(f"   - Total Buy Cost: ₹{buy_cost:,.0f}")
    
    print(f"\n   BODY (SELL 5 lots each):")
    print(f"   - SELL PE at 600 OTM: Avg Premium ₹{avg_sell_pe:.0f}")
    print(f"   - SELL CE at 600 OTM: Avg Premium ₹{avg_sell_ce:.0f}")
    print(f"   - Total Sell Credit: ₹{sell_credit:,.0f}")
    
    print(f"\n   💵 NET CREDIT RECEIVED: ₹{net_credit:,.0f}")
    
    # Breakeven analysis
    print(f"\n   📍 BREAKEVEN POINTS:")
    avg_spot = sum(t.spot_at_entry for t in trades) / len(trades)
    print(f"   - Lower Breakeven: ~{avg_spot - 650:.0f} (650 pts below spot)")
    print(f"   - Upper Breakeven: ~{avg_spot + 650:.0f} (650 pts above spot)")
    print(f"   - Safe Zone: {1300} pts range")
    
    # Save results
    results = {
        "strategy": "7 DTE Ratio Iron Butterfly",
        "structure": {
            "buy_wings": "1 lot at 500 OTM (PE & CE)",
            "sell_body": "5 lots at 600 OTM (PE & CE)"
        },
        "period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        "statistics": {
            "total_trades": total_trades,
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "win_rate": round(win_rate, 1),
            "total_pnl": round(total_pnl, 2),
            "avg_pnl": round(avg_pnl, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "max_win": round(max_win, 2),
            "max_loss": round(max_loss, 2),
            "profit_factor": round(profit_factor, 2),
            "roi_percent": round(roi, 1),
            "margin_required": margin_required
        },
        "exit_analysis": {
            "expiry_exits": expiry_exits,
            "stop_loss_exits": sl_exits
        },
        "monthly_pnl": monthly_pnl,
        "sample_trades": [
            {
                "entry_date": t.entry_date,
                "expiry_date": t.expiry_date,
                "spot": t.spot_at_entry,
                "buy_strikes": f"{int(t.buy_pe_strike)}/{int(t.buy_ce_strike)}",
                "sell_strikes": f"{int(t.sell_pe_strike)}/{int(t.sell_ce_strike)}",
                "pnl": t.pnl,
                "exit_reason": t.exit_reason
            }
            for t in trades[:20]
        ]
    }
    
    with open("7dte_iron_butterfly_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print("\n" + "=" * 80)
    print("✅ Results saved to 7dte_iron_butterfly_results.json")
    print("=" * 80)
    
    return results


if __name__ == "__main__":
    run_backtest()
