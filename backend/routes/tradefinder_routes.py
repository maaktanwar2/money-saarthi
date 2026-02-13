"""
TradeFinder API Routes
=======================
Advanced OI analysis, swing scanners, option clock, OI blocks.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.tradefinder_engine import (
    OISentimentEngine,
    SwingSpectrumScanner,
    OptionClock,
    OIBlockEngine,
    AdvancedStrategySuggester,
    run_full_tradefinder_analysis,
    generate_simulated_ohlcv,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tradefinder", tags=["Trade Finder"])


# ════════════════════════════════════════════════════════════════════════
# HELPERS — fetch option chain (reuse server's function)
# ════════════════════════════════════════════════════════════════════════

async def _get_chain_and_spot(symbol: str):
    """Fetch option chain data, falling back to simulated."""
    # Import lazily to avoid circular imports
    try:
        from server import NSEIndia, _generate_simulated_option_chain
    except ImportError:
        # If running standalone, generate simulated data
        NSEIndia = None
        _generate_simulated_option_chain = None

    chain = []
    spot = 0
    source = "simulated"

    if NSEIndia:
        try:
            data = await NSEIndia.get_option_chain(symbol)
            if data and data.get("records"):
                records = data["records"]
                filtered = data.get("filtered", {})
                spot = records.get("underlyingValue", 0)
                chain = filtered.get("data", [])[:50]
                source = "nse_live"
        except Exception as e:
            logger.warning(f"NSE unavailable for {symbol}: {e}")

    if not chain and _generate_simulated_option_chain:
        try:
            sim = await _generate_simulated_option_chain(symbol)
            spot = sim.get("underlying_value", 0)
            chain = sim.get("data", [])
            source = sim.get("source", "simulated")
        except Exception as e:
            logger.error(f"Simulated chain failed for {symbol}: {e}")

    if not chain or spot == 0:
        raise HTTPException(status_code=503, detail="No option chain data available")

    return chain, spot, source


# ════════════════════════════════════════════════════════════════════════
# 1. FULL ANALYSIS (one-shot endpoint — powers the TradeFinder UI)
# ════════════════════════════════════════════════════════════════════════

@router.get("/analyze/{symbol}")
async def analyze_full(
    symbol: str = "NIFTY",
    outlook: str = Query("neutral", regex="^(bullish|neutral|bearish)$"),
    risk: str = Query("moderate", regex="^(conservative|moderate|aggressive)$"),
):
    """
    Full TradeFinder analysis for a symbol:
    - OI sentiment (PCR, support/resistance, interpretation)
    - Strategy suggestions (OI-backed with confidence)
    - Option Clock snapshot + intraday targets
    - OI Blocks + momentum
    - Swing scanners (10D/50D BO, Channel, NR7, Reversal)
    """
    try:
        symbol = symbol.upper()
        chain, spot, source = await _get_chain_and_spot(symbol)

        result = await run_full_tradefinder_analysis(
            symbol=symbol,
            chain=chain,
            spot=spot,
            market_outlook=outlook,
            risk_appetite=risk,
        )
        result["data_source"] = source
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TradeFinder analyze error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════
# 2. OI SENTIMENT ONLY
# ════════════════════════════════════════════════════════════════════════

@router.get("/oi-sentiment/{symbol}")
async def get_oi_sentiment(symbol: str = "NIFTY"):
    """Get PCR, OI change analysis, support/resistance for a symbol."""
    try:
        symbol = symbol.upper()
        chain, spot, source = await _get_chain_and_spot(symbol)

        pcr = OISentimentEngine.compute_pcr(chain)
        oi_changes = OISentimentEngine.compute_oi_change(chain)
        sr = OISentimentEngine.find_support_resistance(chain)

        total_ce_chg = sum(r.get("CE", {}).get("changeinOpenInterest", 0) or 0 for r in chain)
        total_pe_chg = sum(r.get("PE", {}).get("changeinOpenInterest", 0) or 0 for r in chain)
        interpretation = OISentimentEngine.interpret_oi_price(0, total_ce_chg, total_pe_chg)

        return {
            "symbol": symbol,
            "spot": spot,
            "pcr": pcr,
            "support_resistance": sr,
            "oi_changes_top10": oi_changes[:10],
            "interpretation": interpretation,
            "source": source,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OI sentiment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════
# 3. OPTION CLOCK
# ════════════════════════════════════════════════════════════════════════

@router.get("/option-clock/{symbol}")
async def get_option_clock(symbol: str = "NIFTY", time: Optional[str] = None):
    """
    Get Option Clock data — all OI snapshots for today + intraday targets.
    Optional: pass ?time=10:30 to get snapshot closest to that time.
    """
    try:
        symbol = symbol.upper()

        # Store a fresh snapshot
        chain, spot, source = await _get_chain_and_spot(symbol)
        OptionClock.store_snapshot(symbol, chain, spot)

        targets = OptionClock.compute_intraday_targets(symbol)
        snapshots = OptionClock.get_snapshots(symbol)

        result = {
            "symbol": symbol,
            "spot": spot,
            "targets": targets,
            "snapshots_count": len(snapshots),
            "snapshots": snapshots[-20:],  # last 20
            "source": source,
        }

        if time:
            specific = OptionClock.get_snapshot_at(symbol, time)
            result["requested_snapshot"] = specific

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Option clock error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════
# 4. OI BLOCKS / APEX
# ════════════════════════════════════════════════════════════════════════

@router.get("/oi-blocks/{symbol}")
async def get_oi_blocks(symbol: str = "NIFTY"):
    """
    Get OI Block analysis — candle-wise OI delta with momentum detection.
    Uses simulated data when live intraday OI not available.
    """
    try:
        symbol = symbol.upper()
        chain, spot, source = await _get_chain_and_spot(symbol)

        raw = OIBlockEngine.generate_simulated_blocks(spot, symbol)
        blocks = OIBlockEngine.detect_oi_blocks(raw)
        momentum = OIBlockEngine.detect_momentum(blocks)

        return {
            "symbol": symbol,
            "spot": spot,
            "blocks": blocks[-30:],  # last 30 candles
            "momentum": momentum,
            "total_blocks": len(blocks),
            "source": "simulated_intraday",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OI blocks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════
# 5. SWING SPECTRUM SCANNERS
# ════════════════════════════════════════════════════════════════════════

@router.get("/swing-scan/{symbol}")
async def get_swing_scanners(symbol: str = "NIFTY"):
    """
    Run all swing spectrum scanners:
    - 10-Day Breakout
    - 50-Day Breakout
    - Channel Breakout (20D)
    - NR7
    - Reversal Radar
    """
    try:
        symbol = symbol.upper()
        chain, spot, source = await _get_chain_and_spot(symbol)

        sr = OISentimentEngine.find_support_resistance(chain)
        ohlcv = generate_simulated_ohlcv(symbol, spot, days=60)

        return {
            "symbol": symbol,
            "spot": spot,
            "scanners": {
                "breakout_10d": SwingSpectrumScanner.scan_n_day_breakout(ohlcv, n=10),
                "breakout_50d": SwingSpectrumScanner.scan_n_day_breakout(ohlcv, n=50),
                "channel_breakout": SwingSpectrumScanner.scan_channel_breakout(ohlcv, n=20),
                "nr7": SwingSpectrumScanner.scan_nr7(ohlcv),
                "reversal_radar": SwingSpectrumScanner.scan_reversal_radar(
                    ohlcv, support=sr["support"], resistance=sr["resistance"]
                ),
            },
            "ohlcv_last5": ohlcv[-5:],
            "source": source,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Swing scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
