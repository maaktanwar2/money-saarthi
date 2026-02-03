"""
Advanced Intraday Strategy Backtesting
======================================
Run backtests using 5-minute candles for better intraday strategy evaluation.
Tests strategies that work better with intraday data like ORB, 9:20, CPR, etc.
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


def fetch_intraday_data(period: str = "1mo", interval: str = "5m") -> pd.DataFrame:
    """Fetch intraday Nifty 50 data from Yahoo Finance"""
    logger.info(f"Fetching NIFTY 50 intraday data: period={period}, interval={interval}")
    
    try:
        ticker = yf.Ticker("^NSEI")
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            logger.warning("Yahoo Finance returned empty data, trying alternative ticker")
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
        
        logger.info(f"Fetched {len(df)} intraday candles")
        return df
        
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        return pd.DataFrame()


def run_intraday_backtests(df: pd.DataFrame, capital: float = 100000, lot_size: int = 50):
    """Run backtests on intraday data"""
    
    if len(df) < 100:
        logger.error("Insufficient data for backtesting")
        return {}
    
    # Initialize
    strategy_engine = NiftyTradingStrategies(symbol="NIFTY")
    backtester = StrategyBacktester(strategy_engine)
    
    # Run all backtests
    logger.info("Running intraday backtests on all strategies...")
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


def print_intraday_results(data: dict, candle_count: int):
    """Print formatted intraday backtest results"""
    
    results = data.get('results', {})
    report = data.get('report', {})
    
    print("\n" + "="*80)
    print("      NIFTY INTRADAY STRATEGIES - 5-MINUTE CANDLE BACKTEST REPORT")
    print("="*80)
    print(f"\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Capital: ₹1,00,000 | Lot Size: 50 | Data: {candle_count} x 5-min candles")
    print("\n" + "-"*80)
    
    # Strategy Results Table
    print(f"\n{'Strategy':<25} {'Trades':>8} {'Win%':>8} {'P&L':>12} {'P.Factor':>10} {'Sharpe':>8}")
    print("-"*80)
    
    sorted_results = sorted(results.items(), key=lambda x: x[1].total_pnl, reverse=True)
    
    for name, result in sorted_results:
        pnl_str = format_currency(result.total_pnl)
        pf = f"{result.profit_factor:.2f}" if result.profit_factor != float('inf') else "∞"
        print(f"{name:<25} {result.total_trades:>8} {result.win_rate:>7.1f}% {pnl_str:>12} {pf:>10} {result.sharpe_ratio:>8.2f}")
    
    print("-"*80)
    
    # Summary
    print(f"\n📊 INTRADAY SUMMARY:")
    print(f"   Total Combined P&L: {format_currency(report.get('total_combined_pnl', 0))}")
    print(f"   Average Win Rate: {report.get('average_win_rate', 0):.1f}%")
    print(f"   Best Strategy: {report.get('best_strategy', 'N/A')}")
    
    # Top 3 Strategies
    top_3 = sorted_results[:3]
    print(f"\n🏆 TOP 3 PERFORMING STRATEGIES:")
    for i, (name, result) in enumerate(top_3, 1):
        pf = f"{result.profit_factor:.2f}" if result.profit_factor != float('inf') else "∞"
        print(f"   {i}. {name} - P&L: {format_currency(result.total_pnl)} | Win Rate: {result.win_rate:.1f}% | Profit Factor: {pf}")
    
    # Recommendations
    recommendations = report.get('recommendations', [])
    print("\n" + "-"*80)
    print("📝 RECOMMENDATIONS:")
    for rec in recommendations[:5]:
        print(f"   • {rec}")
    
    print("\n" + "="*80)


def main():
    """Main function to run intraday backtests"""
    
    print("\n🚀 Starting Intraday Strategy Backtesting...")
    print("=" * 50)
    
    # Fetch intraday data (1 month of 5-min candles)
    df = fetch_intraday_data(period="1mo", interval="5m")
    
    if df.empty:
        logger.error("Failed to fetch market data. Exiting.")
        return
    
    print(f"✅ Loaded {len(df)} intraday candles (5-min timeframe)")
    print(f"   From: {df['timestamp'].iloc[0]}")
    print(f"   To:   {df['timestamp'].iloc[-1]}")
    
    # Run backtests
    print("\n⏳ Running intraday backtests on all 10 strategies...")
    backtest_data = run_intraday_backtests(df, capital=100000, lot_size=50)
    
    if not backtest_data:
        logger.error("Backtest failed. Exiting.")
        return
    
    # Print results
    print_intraday_results(backtest_data, len(df))
    
    # Save results
    output = {
        'generated_at': datetime.now().isoformat(),
        'timeframe': '5m',
        'period': '1mo',
        'candles': len(df),
        'capital': 100000,
        'lot_size': 50,
        'results': {},
        'summary': backtest_data.get('report', {})
    }
    
    for name, result in backtest_data.get('results', {}).items():
        output['results'][name] = {
            'total_trades': result.total_trades,
            'winning_trades': result.winning_trades,
            'losing_trades': result.losing_trades,
            'win_rate': result.win_rate,
            'total_pnl': result.total_pnl,
            'profit_factor': result.profit_factor if result.profit_factor != float('inf') else 999,
            'sharpe_ratio': result.sharpe_ratio,
            'max_drawdown': result.max_drawdown
        }
    
    filepath = Path(__file__).parent / "intraday_backtest_results.json"
    with open(filepath, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n📁 Results saved to: {filepath}")
    print("\n✅ Intraday backtesting complete!")


if __name__ == "__main__":
    main()
