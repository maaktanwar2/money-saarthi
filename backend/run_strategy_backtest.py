"""
Nifty Strategy Backtesting Script
=================================
Run comprehensive backtests on all 10 trading strategies using historical Nifty data.
Generates detailed performance reports with profit/loss analysis.

Usage:
    python run_strategy_backtest.py
    
Output:
    - Prints detailed backtest results for each strategy
    - Generates JSON report with all metrics
    - Provides combined recommendation based on performance
"""

import sys
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

import yfinance as yf
import pandas as pd
import numpy as np

# Import strategy engine
from services.nifty_strategies import (
    NiftyTradingStrategies,
    StrategyBacktester,
    StrategyName
)


def fetch_nifty_data(period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """Fetch historical Nifty 50 data from Yahoo Finance"""
    logger.info(f"Fetching NIFTY 50 data: period={period}, interval={interval}")
    
    try:
        ticker = yf.Ticker("^NSEI")
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            logger.warning("Yahoo Finance returned empty data, trying alternative ticker")
            # Try alternative
            ticker = yf.Ticker("NIFTY50.NS")
            df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            logger.error("Could not fetch Nifty data from any source")
            return pd.DataFrame()
        
        # Ensure column names are correct
        df = df.rename(columns={
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        })
        
        # Reset index to get date as column
        df = df.reset_index()
        df = df.rename(columns={'Date': 'timestamp', 'Datetime': 'timestamp'})
        
        logger.info(f"Fetched {len(df)} candles from {df['timestamp'].iloc[0]} to {df['timestamp'].iloc[-1]}")
        return df
        
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        return pd.DataFrame()


def run_backtests(df: pd.DataFrame, capital: float = 100000, lot_size: int = 50):
    """Run backtests on all strategies"""
    
    if len(df) < 50:
        logger.error("Insufficient data for backtesting (need at least 50 candles)")
        return {}
    
    # Initialize
    strategy_engine = NiftyTradingStrategies(symbol="NIFTY")
    backtester = StrategyBacktester(strategy_engine)
    
    # Run all backtests
    logger.info("Running backtests on all strategies...")
    results = backtester.run_all_backtests(df, capital, lot_size)
    
    # Generate report
    report = backtester.generate_backtest_report(results)
    
    return {
        'results': results,
        'report': report
    }


def format_currency(amount: float) -> str:
    """Format amount as Indian currency"""
    if amount >= 0:
        return f"₹{amount:,.2f}"
    else:
        return f"-₹{abs(amount):,.2f}"


def print_results(data: dict):
    """Print formatted backtest results"""
    
    results = data.get('results', {})
    report = data.get('report', {})
    
    print("\n" + "="*80)
    print("         NIFTY TRADING STRATEGIES - COMPREHENSIVE BACKTEST REPORT")
    print("="*80)
    print(f"\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Capital: ₹1,00,000 | Lot Size: 50 | Period: 1 Year Daily")
    print("\n" + "-"*80)
    
    # Strategy Results Table
    print(f"\n{'Strategy':<25} {'Trades':>8} {'Win%':>8} {'P&L':>12} {'P.Factor':>10} {'Sharpe':>8}")
    print("-"*80)
    
    for name, result in results.items():
        pnl_str = format_currency(result.total_pnl)
        print(f"{name:<25} {result.total_trades:>8} {result.win_rate:>7.1f}% {pnl_str:>12} {result.profit_factor:>10.2f} {result.sharpe_ratio:>8.2f}")
    
    print("-"*80)
    
    # Summary
    summary = report.get('summary', {})
    print(f"\n📊 SUMMARY:")
    print(f"   Total Combined P&L: {format_currency(report.get('total_combined_pnl', 0))}")
    print(f"   Average Win Rate: {report.get('average_win_rate', 0):.1f}%")
    print(f"   Best Strategy: {report.get('best_strategy', 'N/A')}")
    
    # Individual Strategy Details
    print("\n" + "="*80)
    print("                    INDIVIDUAL STRATEGY ANALYSIS")
    print("="*80)
    
    for name, result in results.items():
        print(f"\n🎯 {name.upper()}")
        print("-"*40)
        print(f"   Total Trades:      {result.total_trades}")
        print(f"   Winning Trades:    {result.winning_trades}")
        print(f"   Losing Trades:     {result.losing_trades}")
        print(f"   Win Rate:          {result.win_rate:.1f}%")
        print(f"   Total P&L:         {format_currency(result.total_pnl)} ({result.total_pnl_percent:+.2f}%)")
        print(f"   Avg Profit:        {format_currency(result.avg_profit)}")
        print(f"   Avg Loss:          {format_currency(result.avg_loss)}")
        print(f"   Max Profit:        {format_currency(result.max_profit)}")
        print(f"   Max Loss:          {format_currency(result.max_loss)}")
        print(f"   Max Drawdown:      {result.max_drawdown:.2f}%")
        print(f"   Profit Factor:     {result.profit_factor:.2f}")
        print(f"   Sharpe Ratio:      {result.sharpe_ratio:.2f}")
        
        # Strategy Rating
        if result.win_rate >= 55 and result.profit_factor >= 1.5:
            rating = "✅ EXCELLENT - Highly Recommended"
        elif result.win_rate >= 50 and result.profit_factor >= 1.2:
            rating = "⚠️ MODERATE - Use with confirmation"
        else:
            rating = "❌ POOR - Needs optimization"
        print(f"   Rating:            {rating}")
    
    # Recommendations
    recommendations = report.get('recommendations', [])
    print("\n" + "="*80)
    print("                         RECOMMENDATIONS")
    print("="*80)
    for i, rec in enumerate(recommendations, 1):
        print(f"\n{i}. {rec}")
    
    # Strategy Type Analysis
    print("\n" + "="*80)
    print("                    STRATEGY TYPE PERFORMANCE")
    print("="*80)
    
    type_performance = {
        'Trend Following': ['supertrend', 'ema_crossover'],
        'Breakout': ['orb_breakout', 'bollinger_squeeze', 'nine_twenty'],
        'Mean Reversion': ['rsi_reversal', 'vwap_strategy'],
        'Support/Resistance': ['cpr_pivot'],
        'Momentum': ['momentum'],
        'Pattern': ['open_high_low']
    }
    
    for strategy_type, strategies in type_performance.items():
        type_pnl = sum(results[s].total_pnl for s in strategies if s in results)
        type_trades = sum(results[s].total_trades for s in strategies if s in results)
        type_wins = sum(results[s].winning_trades for s in strategies if s in results)
        type_win_rate = (type_wins / type_trades * 100) if type_trades > 0 else 0
        
        print(f"\n📈 {strategy_type}:")
        print(f"   Strategies: {', '.join(strategies)}")
        print(f"   Combined P&L: {format_currency(type_pnl)}")
        print(f"   Total Trades: {type_trades}")
        print(f"   Win Rate: {type_win_rate:.1f}%")
    
    print("\n" + "="*80)
    print("                         MARKET CONDITIONS")
    print("="*80)
    print("""
    📊 When to use each strategy type:
    
    1. TRENDING MARKET (ADX > 25):
       → Use: Supertrend, EMA Crossover, Momentum
       → Avoid: RSI Reversal (fails in strong trends)
    
    2. RANGE-BOUND MARKET (ADX < 20):
       → Use: RSI Reversal, VWAP Strategy, CPR Pivot
       → Avoid: Breakout strategies (whipsaws)
    
    3. HIGH VOLATILITY (VIX > 20):
       → Use: Bollinger Squeeze, ORB, 9:20 Candle
       → Avoid: Mean reversion strategies
    
    4. EXPIRY DAY:
       → Use: CPR Pivot, OHL Strategy
       → Focus on: Support/Resistance levels
    
    5. MORNING SESSION (9:15-11:00):
       → Use: ORB, 9:20 Candle, OHL Strategy
       → Best time for intraday setups
    """)
    
    print("="*80)
    print("                          END OF REPORT")
    print("="*80 + "\n")


def save_results_json(data: dict, filename: str = "backtest_results.json"):
    """Save results to JSON file"""
    
    # Convert results to serializable format
    results = data.get('results', {})
    report = data.get('report', {})
    
    serializable_results = {}
    for name, result in results.items():
        serializable_results[name] = {
            'strategy_name': result.strategy_name,
            'total_trades': result.total_trades,
            'winning_trades': result.winning_trades,
            'losing_trades': result.losing_trades,
            'win_rate': result.win_rate,
            'total_pnl': result.total_pnl,
            'total_pnl_percent': result.total_pnl_percent,
            'avg_profit': result.avg_profit,
            'avg_loss': result.avg_loss,
            'max_profit': result.max_profit,
            'max_loss': result.max_loss,
            'max_drawdown': result.max_drawdown,
            'profit_factor': result.profit_factor,
            'sharpe_ratio': result.sharpe_ratio,
            'trades_count': len(result.trades)
        }
    
    output = {
        'generated_at': datetime.now().isoformat(),
        'capital': 100000,
        'lot_size': 50,
        'period': '1y',
        'interval': '1d',
        'strategy_results': serializable_results,
        'summary': report.get('summary', {}),
        'best_strategy': report.get('best_strategy', ''),
        'total_combined_pnl': report.get('total_combined_pnl', 0),
        'average_win_rate': report.get('average_win_rate', 0),
        'recommendations': report.get('recommendations', [])
    }
    
    filepath = Path(__file__).parent / filename
    with open(filepath, 'w') as f:
        json.dump(output, f, indent=2)
    
    logger.info(f"Results saved to {filepath}")
    return filepath


def main():
    """Main function to run backtests"""
    
    print("\n🚀 Starting Nifty Strategy Backtesting...")
    print("=" * 50)
    
    # Fetch data
    df = fetch_nifty_data(period="1y", interval="1d")
    
    if df.empty:
        logger.error("Failed to fetch market data. Exiting.")
        return
    
    print(f"✅ Loaded {len(df)} days of historical data")
    print(f"   From: {df['timestamp'].iloc[0]}")
    print(f"   To:   {df['timestamp'].iloc[-1]}")
    
    # Run backtests
    print("\n⏳ Running backtests on all 10 strategies...")
    backtest_data = run_backtests(df, capital=100000, lot_size=50)
    
    if not backtest_data:
        logger.error("Backtest failed. Exiting.")
        return
    
    # Print results
    print_results(backtest_data)
    
    # Save results
    json_path = save_results_json(backtest_data)
    print(f"\n📁 Results saved to: {json_path}")
    
    print("\n✅ Backtesting complete!")


if __name__ == "__main__":
    main()
