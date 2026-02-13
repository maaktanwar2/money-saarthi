"""
TradeFinder Engine — Advanced OI + Price-Action Scanner
=========================================================

Implements the full set of TradeFinder-style formulas:

1. OI Sentiment Engine (PCR, ΔOI, support/resistance, OI interpretation)
2. Swing Spectrum Scanners (10/50 Day BO, Channel BO, NR7, Reversal Radar)
3. Option Clock (time-slice OI snapshots, concentration targets)
4. OI Blocks / Apex (candle-wise OI delta, bullish/bearish blocks)
5. Advanced Strategy Suggester (combines all signals)
"""

import logging
import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

import numpy as np

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 1.  OI SENTIMENT ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class OISentimentEngine:
    """Core OI & sentiment formulas — PCR, ΔOI, support/resistance, interpretation."""

    # PCR thresholds (tunable)
    PCR_BEARISH_LOW = 0.7
    PCR_NEUTRAL_HIGH = 1.3

    @staticmethod
    def compute_pcr(chain: List[Dict]) -> Dict[str, float]:
        """Compute PCR (OI-based and Volume-based) from option chain."""
        total_call_oi = 0
        total_put_oi = 0
        total_call_vol = 0
        total_put_vol = 0
        for row in chain:
            ce = row.get("CE", {})
            pe = row.get("PE", {})
            total_call_oi += ce.get("openInterest", 0) or 0
            total_put_oi += pe.get("openInterest", 0) or 0
            total_call_vol += ce.get("totalTradedVolume", 0) or 0
            total_put_vol += pe.get("totalTradedVolume", 0) or 0

        pcr_oi = round(total_put_oi / max(total_call_oi, 1), 3)
        pcr_vol = round(total_put_vol / max(total_call_vol, 1), 3)

        # Sentiment label
        if pcr_oi < OISentimentEngine.PCR_BEARISH_LOW:
            sentiment = "Bearish (Call Heavy)"
        elif pcr_oi > OISentimentEngine.PCR_NEUTRAL_HIGH:
            sentiment = "Bullish (Put Heavy / Short-Cover potential)"
        else:
            sentiment = "Neutral"

        return {
            "pcr_oi": pcr_oi,
            "pcr_vol": pcr_vol,
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "total_call_vol": total_call_vol,
            "total_put_vol": total_put_vol,
            "sentiment": sentiment,
        }

    @staticmethod
    def compute_oi_change(chain: List[Dict]) -> List[Dict]:
        """Compute ΔOI for each strike and return sorted by significance."""
        results = []
        for row in chain:
            ce = row.get("CE", {})
            pe = row.get("PE", {})
            strike = row.get("strikePrice", 0)
            ce_oi = ce.get("openInterest", 0) or 0
            pe_oi = pe.get("openInterest", 0) or 0
            ce_oi_chg = ce.get("changeinOpenInterest", 0) or 0
            pe_oi_chg = pe.get("changeinOpenInterest", 0) or 0

            ce_oi_pct = round((ce_oi_chg / max(abs(ce_oi - ce_oi_chg), 1)) * 100, 2) if ce_oi else 0
            pe_oi_pct = round((pe_oi_chg / max(abs(pe_oi - pe_oi_chg), 1)) * 100, 2) if pe_oi else 0

            results.append({
                "strike": strike,
                "call_oi": ce_oi,
                "put_oi": pe_oi,
                "call_oi_change": ce_oi_chg,
                "put_oi_change": pe_oi_chg,
                "call_oi_change_pct": ce_oi_pct,
                "put_oi_change_pct": pe_oi_pct,
                "net_oi_change": pe_oi_chg - ce_oi_chg,  # positive → bullish pressure
            })

        # Sort by absolute net change (most significant first)
        results.sort(key=lambda x: abs(x["net_oi_change"]), reverse=True)
        return results

    @staticmethod
    def find_support_resistance(chain: List[Dict]) -> Dict[str, Any]:
        """
        Find OI-based support & resistance.
        Support = max Put OI strike, Resistance = max Call OI strike.
        Also find top-3 support zones and top-3 resistance zones.
        """
        strikes_call = []
        strikes_put = []

        for row in chain:
            ce = row.get("CE", {})
            pe = row.get("PE", {})
            strike = row.get("strikePrice", 0)
            strikes_call.append((strike, ce.get("openInterest", 0) or 0, ce.get("changeinOpenInterest", 0) or 0))
            strikes_put.append((strike, pe.get("openInterest", 0) or 0, pe.get("changeinOpenInterest", 0) or 0))

        strikes_call.sort(key=lambda x: x[1], reverse=True)
        strikes_put.sort(key=lambda x: x[1], reverse=True)

        top3_resistance = [{"strike": s, "call_oi": oi, "call_oi_chg": chg} for s, oi, chg in strikes_call[:3]]
        top3_support = [{"strike": s, "put_oi": oi, "put_oi_chg": chg} for s, oi, chg in strikes_put[:3]]

        resistance = strikes_call[0][0] if strikes_call else 0
        support = strikes_put[0][0] if strikes_put else 0

        return {
            "support": support,
            "resistance": resistance,
            "top3_support": top3_support,
            "top3_resistance": top3_resistance,
        }

    @staticmethod
    def interpret_oi_price(price_change: float, ce_oi_change: float, pe_oi_change: float) -> Dict[str, str]:
        """
        Standard OI + Price interpretation matrix.
        Returns signal and explanation.
        """
        if price_change > 0 and ce_oi_change > 0:
            return {"signal": "Bullish", "icon": "🟢", "label": "Long Build-Up",
                    "explanation": "Price ↑ + Call OI ↑ → Fresh longs being added, bullish continuation"}
        elif price_change > 0 and pe_oi_change < 0:
            return {"signal": "Bullish", "icon": "🟢", "label": "Short Covering",
                    "explanation": "Price ↑ + Put OI ↓ → Put unwinding (shorts closing), bullish"}
        elif price_change < 0 and pe_oi_change > 0:
            return {"signal": "Bearish", "icon": "🔴", "label": "Short Build-Up",
                    "explanation": "Price ↓ + Put OI ↑ → Fresh shorts being built, bearish continuation"}
        elif price_change < 0 and ce_oi_change < 0:
            return {"signal": "Bearish", "icon": "🔴", "label": "Long Unwinding",
                    "explanation": "Price ↓ + Call OI ↓ → Longs exiting, bearish pressure"}
        elif price_change > 0 and ce_oi_change < 0:
            return {"signal": "Weak Bullish", "icon": "🟡", "label": "Call Unwinding + Price Up",
                    "explanation": "Price ↑ but Call OI ↓ → Rally not backed by fresh longs, caution"}
        elif price_change < 0 and pe_oi_change < 0:
            return {"signal": "Weak Bearish", "icon": "🟡", "label": "Put Unwinding + Price Down",
                    "explanation": "Price ↓ but Put OI ↓ → Selling not backed by fresh shorts, support nearby"}
        else:
            return {"signal": "Neutral", "icon": "⚪", "label": "No Clear Signal",
                    "explanation": "No clear OI-price divergence detected"}


# ═══════════════════════════════════════════════════════════════════════════════
# 2.  SWING SPECTRUM SCANNERS
# ═══════════════════════════════════════════════════════════════════════════════

class SwingSpectrumScanner:
    """
    Standard technical scanners:
    - 10-Day / 50-Day Breakout
    - Channel Breakout (N-day)
    - NR7 (Narrowest Range in 7 days)
    - Reversal Radar (support/resistance rejection)
    """

    @staticmethod
    def scan_n_day_breakout(ohlcv: List[Dict], n: int = 10, vol_factor: float = 1.2) -> Dict[str, Any]:
        """
        N-day breakout scanner.
        Bullish: today's close > highest high of previous N days AND volume spike.
        Bearish: today's close < lowest low of previous N days AND volume spike.
        """
        if len(ohlcv) < n + 1:
            return {"breakout": None, "reason": "Insufficient data"}

        today = ohlcv[-1]
        prev = ohlcv[-(n + 1):-1]  # previous N candles

        hh = max(c.get("high", 0) for c in prev)
        ll = min(c.get("low", float("inf")) for c in prev)
        avg_vol = sum(c.get("volume", 0) for c in prev[-20:]) / min(len(prev), 20)
        vol_ok = today.get("volume", 0) > avg_vol * vol_factor

        close = today.get("close", 0)
        result = {
            "n": n,
            "prev_high": round(hh, 2),
            "prev_low": round(ll, 2),
            "close": round(close, 2),
            "volume": today.get("volume", 0),
            "avg_volume": round(avg_vol, 0),
            "volume_ok": vol_ok,
        }

        if close > hh and vol_ok:
            result["breakout"] = "bullish"
            result["signal"] = f"🟢 {n}-Day Bullish Breakout"
            result["description"] = f"Close {close:.0f} > {n}D High {hh:.0f} with volume surge"
        elif close < ll and vol_ok:
            result["breakout"] = "bearish"
            result["signal"] = f"🔴 {n}-Day Bearish Breakdown"
            result["description"] = f"Close {close:.0f} < {n}D Low {ll:.0f} with volume surge"
        else:
            result["breakout"] = None
            result["signal"] = "No breakout"
            result["description"] = f"Price within {n}D range [{ll:.0f} - {hh:.0f}]"

        return result

    @staticmethod
    def scan_channel_breakout(ohlcv: List[Dict], n: int = 20, buffer_pct: float = 1.0) -> Dict[str, Any]:
        """
        Channel breakout: price breaks N-day high/low channel with buffer.
        """
        if len(ohlcv) < n + 1:
            return {"breakout": None, "reason": "Insufficient data"}

        today = ohlcv[-1]
        yesterday = ohlcv[-2]
        channel_data = ohlcv[-(n + 1):-1]

        ch_high = max(c.get("high", 0) for c in channel_data)
        ch_low = min(c.get("low", float("inf")) for c in channel_data)
        buffer = buffer_pct / 100

        close_today = today.get("close", 0)
        close_yest = yesterday.get("close", 0)
        channel_width = ch_high - ch_low
        channel_mid = (ch_high + ch_low) / 2

        result = {
            "n": n,
            "channel_high": round(ch_high, 2),
            "channel_low": round(ch_low, 2),
            "channel_width": round(channel_width, 2),
            "channel_mid": round(channel_mid, 2),
            "close": round(close_today, 2),
        }

        if close_today > ch_high * (1 + buffer) and close_yest <= ch_high:
            result["breakout"] = "bullish"
            result["signal"] = f"🟢 {n}D Channel Breakout UP"
            result["description"] = f"Broke above {ch_high:.0f} channel resistance"
        elif close_today < ch_low * (1 - buffer) and close_yest >= ch_low:
            result["breakout"] = "bearish"
            result["signal"] = f"🔴 {n}D Channel Breakdown"
            result["description"] = f"Broke below {ch_low:.0f} channel support"
        else:
            result["breakout"] = None
            result["signal"] = "Inside Channel"
            result["description"] = f"Trading within [{ch_low:.0f} - {ch_high:.0f}]"

        return result

    @staticmethod
    def scan_nr7(ohlcv: List[Dict]) -> Dict[str, Any]:
        """
        NR7: Today's range (high-low) is the smallest in last 7 days.
        Signals upcoming volatility expansion.
        """
        if len(ohlcv) < 7:
            return {"is_nr7": False, "reason": "Insufficient data"}

        last7 = ohlcv[-7:]
        ranges = [c.get("high", 0) - c.get("low", 0) for c in last7]
        today_range = ranges[-1]
        is_nr7 = today_range == min(ranges) and today_range > 0

        today = ohlcv[-1]
        avg_range = sum(ranges) / len(ranges)

        return {
            "is_nr7": is_nr7,
            "today_range": round(today_range, 2),
            "min_range_7d": round(min(ranges), 2),
            "avg_range_7d": round(avg_range, 2),
            "range_contraction_pct": round((1 - today_range / max(avg_range, 0.01)) * 100, 1),
            "close": round(today.get("close", 0), 2),
            "signal": "🔶 NR7 — Volatility Expansion Expected" if is_nr7 else "No NR7",
            "description": (
                f"Today's range ₹{today_range:.0f} is smallest in 7 days (avg ₹{avg_range:.0f}). "
                "Expect bigger move tomorrow — prepare straddle or directional trade."
                if is_nr7
                else f"Today's range ₹{today_range:.0f} is NOT the smallest in 7 days."
            ),
        }

    @staticmethod
    def scan_reversal_radar(
        ohlcv: List[Dict],
        support: float = 0,
        resistance: float = 0,
        zone_pct: float = 0.5,
        vol_factor: float = 1.5,
    ) -> Dict[str, Any]:
        """
        Reversal Radar: Detects bullish/bearish reversal near key support/resistance.
        Uses candlestick patterns + volume spike + proximity to level.
        """
        if len(ohlcv) < 21:
            return {"reversal": None, "reason": "Insufficient data"}

        today = ohlcv[-1]
        o, h, l, c = today.get("open", 0), today.get("high", 0), today.get("low", 0), today.get("close", 0)
        vol = today.get("volume", 0)
        avg_vol = sum(x.get("volume", 0) for x in ohlcv[-21:-1]) / 20

        body = abs(c - o)
        full_range = h - l if h > l else 0.01
        lower_wick = min(o, c) - l
        upper_wick = h - max(o, c)

        volume_spike = vol > avg_vol * vol_factor
        result = {"reversal": None, "close": round(c, 2), "volume_spike": volume_spike}

        # Bullish reversal near support
        if support > 0:
            near_support = abs(l - support) <= zone_pct / 100 * support
            bullish_candle = c > o and lower_wick >= 0.4 * full_range and body >= 0.3 * full_range
            if near_support and bullish_candle and volume_spike:
                result["reversal"] = "bullish"
                result["signal"] = "🟢 Bullish Reversal near Support"
                result["description"] = (
                    f"Hammer/Bullish candle near support {support:.0f} with {vol/avg_vol:.1f}x volume. "
                    "Potential bounce expected."
                )
                result["support"] = support
                result["pattern"] = "Hammer / Bullish Engulfing"

        # Bearish reversal near resistance
        if resistance > 0 and result["reversal"] is None:
            near_resistance = abs(h - resistance) <= zone_pct / 100 * resistance
            bearish_candle = c < o and upper_wick >= 0.4 * full_range and body >= 0.3 * full_range
            if near_resistance and bearish_candle and volume_spike:
                result["reversal"] = "bearish"
                result["signal"] = "🔴 Bearish Reversal near Resistance"
                result["description"] = (
                    f"Shooting star/Bearish candle near resistance {resistance:.0f} with {vol/avg_vol:.1f}x volume. "
                    "Potential rejection expected."
                )
                result["resistance"] = resistance
                result["pattern"] = "Shooting Star / Bearish Engulfing"

        if result["reversal"] is None:
            result["signal"] = "No reversal pattern"
            result["description"] = "No reversal detected near key levels"

        return result


# ═══════════════════════════════════════════════════════════════════════════════
# 3.  OPTION CLOCK — Time-slice OI snapshots
# ═══════════════════════════════════════════════════════════════════════════════

# In-memory store for OI snapshots (reset daily)
_oi_snapshots: Dict[str, List[Dict]] = defaultdict(list)
_oi_snapshots_date: str = ""


class OptionClock:
    """
    Store per-time OI snapshots and derive intraday targets.
    Each snapshot captures strike-wise CE_OI, PE_OI at a point in time.
    """

    @staticmethod
    def store_snapshot(symbol: str, chain: List[Dict], spot: float, timestamp: str = None) -> Dict:
        """Save a time-slice OI snapshot."""
        global _oi_snapshots, _oi_snapshots_date

        today = datetime.now().strftime("%Y-%m-%d")
        if _oi_snapshots_date != today:
            _oi_snapshots.clear()
            _oi_snapshots_date = today

        ts = timestamp or datetime.now().strftime("%H:%M")

        strikes_data = []
        for row in chain:
            strike = row.get("strikePrice", 0)
            ce_oi = row.get("CE", {}).get("openInterest", 0) or 0
            pe_oi = row.get("PE", {}).get("openInterest", 0) or 0
            ce_chg = row.get("CE", {}).get("changeinOpenInterest", 0) or 0
            pe_chg = row.get("PE", {}).get("changeinOpenInterest", 0) or 0
            strikes_data.append({
                "strike": strike,
                "ce_oi": ce_oi,
                "pe_oi": pe_oi,
                "ce_oi_chg": ce_chg,
                "pe_oi_chg": pe_chg,
                "net": pe_oi - ce_oi,
            })

        snapshot = {
            "time": ts,
            "spot": spot,
            "strikes": strikes_data,
        }

        _oi_snapshots[symbol].append(snapshot)
        return {"stored": True, "time": ts, "strikes_count": len(strikes_data), "total_snapshots": len(_oi_snapshots[symbol])}

    @staticmethod
    def get_snapshots(symbol: str) -> List[Dict]:
        """Get all stored snapshots for today."""
        return _oi_snapshots.get(symbol, [])

    @staticmethod
    def get_snapshot_at(symbol: str, time_str: str) -> Optional[Dict]:
        """Get closest snapshot to requested time."""
        snaps = _oi_snapshots.get(symbol, [])
        if not snaps:
            return None
        # Find closest match
        best = None
        best_diff = float("inf")
        for s in snaps:
            try:
                t = datetime.strptime(s["time"], "%H:%M")
                req = datetime.strptime(time_str, "%H:%M")
                diff = abs((t - req).total_seconds())
                if diff < best_diff:
                    best_diff = diff
                    best = s
            except Exception:
                continue
        return best

    @staticmethod
    def compute_intraday_targets(symbol: str) -> Dict[str, Any]:
        """
        From the latest snapshot, find:
        - MaxPutStrike → intraday support/target
        - MaxCallStrike → intraday resistance/target
        """
        snaps = _oi_snapshots.get(symbol, [])
        if not snaps:
            return {"error": "No snapshots available"}

        latest = snaps[-1]
        strikes = latest.get("strikes", [])

        max_ce = max(strikes, key=lambda x: x["ce_oi"], default=None)
        max_pe = max(strikes, key=lambda x: x["pe_oi"], default=None)

        result = {
            "time": latest["time"],
            "spot": latest["spot"],
            "intraday_resistance": max_ce["strike"] if max_ce else 0,
            "intraday_support": max_pe["strike"] if max_pe else 0,
            "max_call_oi": max_ce["ce_oi"] if max_ce else 0,
            "max_put_oi": max_pe["pe_oi"] if max_pe else 0,
        }

        # Track OI shift across snapshots
        if len(snaps) >= 2:
            first = snaps[0]
            first_ce = max(first.get("strikes", []), key=lambda x: x["ce_oi"], default=None)
            first_pe = max(first.get("strikes", []), key=lambda x: x["pe_oi"], default=None)
            result["resistance_shifted"] = (max_ce["strike"] != first_ce["strike"]) if max_ce and first_ce else False
            result["support_shifted"] = (max_pe["strike"] != first_pe["strike"]) if max_pe and first_pe else False
            result["first_resistance"] = first_ce["strike"] if first_ce else 0
            result["first_support"] = first_pe["strike"] if first_pe else 0

        return result


# ═══════════════════════════════════════════════════════════════════════════════
# 4.  OI BLOCKS / APEX — Candle-wise OI delta
# ═══════════════════════════════════════════════════════════════════════════════

class OIBlockEngine:
    """
    Detect bullish/bearish OI blocks per candle (3/5 min).
    Consecutive same-direction blocks = momentum.
    """

    @staticmethod
    def detect_oi_blocks(candles: List[Dict]) -> List[Dict]:
        """
        Each candle has: open, close, ce_oi_start, ce_oi_end, pe_oi_start, pe_oi_end, time.
        Returns list of blocks with type (bullish/bearish/neutral).
        """
        blocks = []
        for c in candles:
            price_chg = c.get("close", 0) - c.get("open", 0)
            ce_oi_chg = c.get("ce_oi_end", 0) - c.get("ce_oi_start", 0)
            pe_oi_chg = c.get("pe_oi_end", 0) - c.get("pe_oi_start", 0)

            if price_chg > 0 and (ce_oi_chg > 0 or pe_oi_chg < 0):
                block_type = "bullish"
            elif price_chg < 0 and (pe_oi_chg > 0 or ce_oi_chg < 0):
                block_type = "bearish"
            else:
                block_type = "neutral"

            blocks.append({
                "time": c.get("time", ""),
                "open": c.get("open", 0),
                "close": c.get("close", 0),
                "price_change": round(price_chg, 2),
                "ce_oi_change": ce_oi_chg,
                "pe_oi_change": pe_oi_chg,
                "type": block_type,
            })

        return blocks

    @staticmethod
    def detect_momentum(blocks: List[Dict], min_streak: int = 3) -> Dict[str, Any]:
        """
        Find consecutive bullish or bearish blocks (streak).
        Returns current momentum state and streak length.
        """
        if not blocks:
            return {"momentum": "none", "streak": 0}

        streak = 1
        last_type = blocks[-1]["type"]
        for i in range(len(blocks) - 2, -1, -1):
            if blocks[i]["type"] == last_type and last_type != "neutral":
                streak += 1
            else:
                break

        # Count total blocks
        bull_count = sum(1 for b in blocks if b["type"] == "bullish")
        bear_count = sum(1 for b in blocks if b["type"] == "bearish")

        has_momentum = streak >= min_streak and last_type != "neutral"

        return {
            "momentum": last_type if has_momentum else "none",
            "streak": streak if has_momentum else 0,
            "last_block": last_type,
            "total_bullish": bull_count,
            "total_bearish": bear_count,
            "total_neutral": len(blocks) - bull_count - bear_count,
            "signal": (
                f"🟢 {streak} consecutive bullish blocks — BUY signal"
                if has_momentum and last_type == "bullish"
                else f"🔴 {streak} consecutive bearish blocks — SELL signal"
                if has_momentum and last_type == "bearish"
                else "⚪ No clear momentum"
            ),
        }

    @staticmethod
    def generate_simulated_blocks(spot: float, symbol: str = "NIFTY") -> List[Dict]:
        """
        Generate simulated OI block data for demo (when live intraday data unavailable).
        Creates realistic 3-min candle blocks for the trading day.
        """
        from datetime import datetime
        seed_str = f"{symbol}_blocks_{datetime.now().strftime('%Y%m%d_%H')}"
        rng = random.Random(hash(seed_str) % (2**32))

        blocks = []
        price = spot
        start_time = datetime.now().replace(hour=9, minute=15, second=0, microsecond=0)

        for i in range(100):  # ~5 hours of 3-min candles
            t = start_time + timedelta(minutes=i * 3)
            if t.hour >= 15 and t.minute >= 30:
                break

            open_p = price
            move = rng.gauss(0, spot * 0.001)  # ~0.1% per candle
            close_p = open_p + move
            price = close_p

            # OI changes correlated with price move
            bias = 1 if move > 0 else -1
            ce_oi_chg = int(rng.gauss(bias * 5000, 20000))
            pe_oi_chg = int(rng.gauss(-bias * 5000, 20000))

            blocks.append({
                "time": t.strftime("%H:%M"),
                "open": round(open_p, 2),
                "close": round(close_p, 2),
                "ce_oi_start": 0,
                "ce_oi_end": ce_oi_chg,
                "pe_oi_start": 0,
                "pe_oi_end": pe_oi_chg,
            })

        return blocks


# ═══════════════════════════════════════════════════════════════════════════════
# 5.  ADVANCED STRATEGY SUGGESTER (combined signal engine)
# ═══════════════════════════════════════════════════════════════════════════════

class AdvancedStrategySuggester:
    """
    Combines OI analysis + price-action + scanner signals into
    trade suggestions with confidence scores.
    """

    @staticmethod
    def generate_suggestions(
        spot: float,
        chain: List[Dict],
        market_outlook: str = "neutral",
        risk_appetite: str = "moderate",
        symbol: str = "NIFTY",
    ) -> Dict[str, Any]:
        """
        Full analysis pipeline:
        1. OI Sentiment (PCR, support/resistance, interpretation)
        2. OI change analysis (top movers)
        3. Strategy suggestions (based on all signals)
        """
        strike_step = 100 if symbol == "BANKNIFTY" else 50
        atm = round(spot / strike_step) * strike_step

        # Run all analyses
        pcr_data = OISentimentEngine.compute_pcr(chain)
        oi_changes = OISentimentEngine.compute_oi_change(chain)
        sr_data = OISentimentEngine.find_support_resistance(chain)

        support = sr_data["support"]
        resistance = sr_data["resistance"]

        # Calculate overall net OI change for interpretation
        total_ce_chg = sum(r.get("CE", {}).get("changeinOpenInterest", 0) or 0 for r in chain)
        total_pe_chg = sum(r.get("PE", {}).get("changeinOpenInterest", 0) or 0 for r in chain)

        # Derive composite sentiment
        oi_interpretation = OISentimentEngine.interpret_oi_price(
            price_change=0,  # will be overridden by actual spot change
            ce_oi_change=total_ce_chg,
            pe_oi_change=total_pe_chg,
        )

        # Strategy generation logic (enhanced version)
        suggestions = _build_strategies(
            spot=spot,
            atm=atm,
            support=support,
            resistance=resistance,
            pcr=pcr_data["pcr_oi"],
            market_outlook=market_outlook,
            risk_appetite=risk_appetite,
            top_oi_changes=oi_changes[:5],
            symbol=symbol,
            strike_step=strike_step,
        )

        return {
            "symbol": symbol,
            "spot": spot,
            "atm_strike": atm,
            "pcr": pcr_data,
            "support_resistance": sr_data,
            "oi_changes_top5": oi_changes[:5],
            "oi_interpretation": oi_interpretation,
            "strategies": suggestions,
            "timestamp": datetime.now().isoformat(),
        }


def _build_strategies(
    spot, atm, support, resistance, pcr, market_outlook, risk_appetite,
    top_oi_changes, symbol, strike_step
) -> List[Dict]:
    """Build strategies incorporating OI data + outlook + risk."""
    suggestions = []

    # Confidence adjustments based on PCR alignment with outlook
    pcr_boost = 0
    if market_outlook == "bullish" and pcr > 1.0:
        pcr_boost = 10  # PCR supports bullish view
    elif market_outlook == "bearish" and pcr < 0.8:
        pcr_boost = 10
    elif market_outlook == "neutral" and 0.8 <= pcr <= 1.2:
        pcr_boost = 5

    # OI concentration boost — high OI at support/resistance = stronger levels
    oi_strength = 0
    for chg in top_oi_changes:
        if chg["strike"] in (support, resistance):
            oi_strength += 5

    base_conf = pcr_boost + oi_strength

    # === BULLISH ===
    if market_outlook == "bullish":
        if risk_appetite in ("conservative", "moderate"):
            suggestions.append({
                "name": "Bull Put Spread (OI-backed)",
                "legs": [
                    {"type": "Sell", "option": "PE", "strike": atm - strike_step * 2, "action": "Sell OTM Put at strong OI support"},
                    {"type": "Buy", "option": "PE", "strike": atm - strike_step * 5, "action": "Buy deep OTM Put hedge"},
                ],
                "maxProfit": f"₹3,000–5,000/lot", "maxLoss": f"₹7,500–10,000/lot",
                "winRate": "65–72%", "risk": "Low-Medium", "timeframe": "Weekly expiry",
                "reasoning": (
                    f"PCR {pcr:.2f} ({('supports' if pcr > 1 else 'caution')}) • "
                    f"Max Put OI support at {support} • Sell below support for premium."
                ),
                "confidence": min(75 + base_conf, 95),
                "tags": ["OI-backed", "Defined Risk", "Theta Decay"],
            })
        if risk_appetite in ("moderate", "aggressive"):
            suggestions.append({
                "name": "Long Call (Momentum)",
                "legs": [{"type": "Buy", "option": "CE", "strike": atm + strike_step * 2, "action": "Buy OTM Call"}],
                "maxProfit": "Unlimited", "maxLoss": f"Premium paid (~₹150–300)",
                "winRate": "40–52%", "risk": "Medium", "timeframe": "2–5 days",
                "reasoning": (
                    f"Resistance at {resistance} (Call OI wall) • "
                    f"Target: break above {resistance}. Momentum setup."
                ),
                "confidence": min(60 + base_conf, 85),
                "tags": ["Directional", "Momentum"],
            })
        if risk_appetite == "aggressive":
            suggestions.append({
                "name": "Naked Put Sell (ATM)",
                "legs": [{"type": "Sell", "option": "PE", "strike": atm, "action": "Sell ATM Put (naked)"}],
                "maxProfit": f"Premium ₹200–400", "maxLoss": "Unlimited (use strict SL)",
                "winRate": "55–62%", "risk": "Very High", "timeframe": "Weekly expiry",
                "reasoning": f"Aggressive bullish • PCR {pcr:.2f} • Market must stay above {atm}.",
                "confidence": min(50 + base_conf, 75),
                "tags": ["Naked", "High Risk", "Theta"],
            })

    # === BEARISH ===
    if market_outlook == "bearish":
        if risk_appetite in ("conservative", "moderate"):
            suggestions.append({
                "name": "Bear Call Spread (OI-backed)",
                "legs": [
                    {"type": "Sell", "option": "CE", "strike": atm + strike_step * 2, "action": "Sell OTM Call at resistance"},
                    {"type": "Buy", "option": "CE", "strike": atm + strike_step * 5, "action": "Buy deep OTM Call hedge"},
                ],
                "maxProfit": f"₹3,000–5,000/lot", "maxLoss": f"₹7,500–10,000/lot",
                "winRate": "65–72%", "risk": "Low-Medium", "timeframe": "Weekly expiry",
                "reasoning": (
                    f"PCR {pcr:.2f} • Max Call OI resistance at {resistance} • "
                    "Sell above resistance for premium collection."
                ),
                "confidence": min(75 + base_conf, 95),
                "tags": ["OI-backed", "Defined Risk"],
            })
        if risk_appetite in ("moderate", "aggressive"):
            suggestions.append({
                "name": "Long Put (Breakdown)",
                "legs": [{"type": "Buy", "option": "PE", "strike": atm - strike_step * 2, "action": "Buy OTM Put"}],
                "maxProfit": "Unlimited", "maxLoss": f"Premium paid (~₹150–300)",
                "winRate": "40–52%", "risk": "Medium", "timeframe": "2–5 days",
                "reasoning": f"Target: break below support {support} • Bearish momentum.",
                "confidence": min(60 + base_conf, 85),
                "tags": ["Directional", "Momentum"],
            })

    # === NEUTRAL ===
    if market_outlook == "neutral":
        suggestions.append({
            "name": "Short Strangle (OI Walls)",
            "legs": [
                {"type": "Sell", "option": "CE", "strike": resistance, "action": "Sell at max Call OI resistance"},
                {"type": "Sell", "option": "PE", "strike": support, "action": "Sell at max Put OI support"},
            ],
            "maxProfit": f"Combined premium ₹300–600", "maxLoss": "Unlimited (hedge!)",
            "winRate": "70–82%", "risk": "High" if risk_appetite == "aggressive" else "Very High",
            "timeframe": "Weekly expiry",
            "reasoning": (
                f"Range {support}–{resistance} locked by OI walls • PCR {pcr:.2f} neutral • "
                "Both strikes expire worthless with high probability."
            ),
            "confidence": min(80 + base_conf, 95),
            "tags": ["OI Walls", "Theta", "Range-Bound"],
        })
        if risk_appetite in ("conservative", "moderate"):
            suggestions.append({
                "name": "Iron Condor (Defined Risk)",
                "legs": [
                    {"type": "Sell", "option": "CE", "strike": resistance, "action": "Sell OTM Call"},
                    {"type": "Buy", "option": "CE", "strike": resistance + strike_step * 3, "action": "Hedge Call"},
                    {"type": "Sell", "option": "PE", "strike": support, "action": "Sell OTM Put"},
                    {"type": "Buy", "option": "PE", "strike": support - strike_step * 3, "action": "Hedge Put"},
                ],
                "maxProfit": f"₹4,000–8,000/lot", "maxLoss": f"₹7,000–11,000/lot",
                "winRate": "60–72%", "risk": "Low (Defined)",
                "timeframe": "Weekly expiry",
                "reasoning": (
                    f"Fully hedged range trade {support - strike_step*3} to {resistance + strike_step*3} • "
                    "Best when VIX is falling."
                ),
                "confidence": min(75 + base_conf, 92),
                "tags": ["Defined Risk", "Theta", "Iron Condor"],
            })
        suggestions.append({
            "name": "Iron Butterfly (ATM crush)",
            "legs": [
                {"type": "Sell", "option": "CE", "strike": atm, "action": "Sell ATM Call"},
                {"type": "Sell", "option": "PE", "strike": atm, "action": "Sell ATM Put"},
                {"type": "Buy", "option": "CE", "strike": atm + strike_step * 4, "action": "Hedge Call"},
                {"type": "Buy", "option": "PE", "strike": atm - strike_step * 4, "action": "Hedge Put"},
            ],
            "maxProfit": "ATM premium minus hedge cost", "maxLoss": f"₹10,000–15,000/lot",
            "winRate": "35–48%", "risk": "Medium (Defined)",
            "timeframe": "Weekly expiry",
            "reasoning": f"ATM={atm} • High premium if spot stays near ATM. Tight range required.",
            "confidence": min(55 + base_conf, 80),
            "tags": ["ATM Crush", "High Premium"],
        })

    return suggestions


# ═══════════════════════════════════════════════════════════════════════════════
# 6.  STOCK SWING SCANNER (simulated OHLCV for demo)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_simulated_ohlcv(symbol: str, spot: float, days: int = 60) -> List[Dict]:
    """Generate realistic OHLCV data for scanner demos."""
    seed_val = hash(f"{symbol}_ohlcv_{datetime.now().strftime('%Y%m%d')}") % (2**32)
    rng = random.Random(seed_val)

    data = []
    price = spot * (1 - rng.uniform(0.02, 0.10))  # start slightly lower
    base_vol = 5000000 if "NIFTY" in symbol else 2000000

    for i in range(days):
        dt = datetime.now() - timedelta(days=days - i)
        daily_return = rng.gauss(0.0003, 0.012)
        o = price
        c = o * (1 + daily_return)
        h = max(o, c) * (1 + abs(rng.gauss(0, 0.005)))
        l = min(o, c) * (1 - abs(rng.gauss(0, 0.005)))
        vol = int(base_vol * (1 + rng.gauss(0, 0.3)))

        data.append({
            "date": dt.strftime("%Y-%m-%d"),
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": max(vol, 100000),
        })
        price = c

    return data


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC HELPER — run full analysis for a symbol
# ═══════════════════════════════════════════════════════════════════════════════

async def run_full_tradefinder_analysis(
    symbol: str,
    chain: List[Dict],
    spot: float,
    market_outlook: str = "neutral",
    risk_appetite: str = "moderate",
) -> Dict[str, Any]:
    """
    One-shot endpoint: runs all engines and returns combined result.
    """
    # 1. Advanced strategy suggestions with OI analysis
    strategy_result = AdvancedStrategySuggester.generate_suggestions(
        spot=spot,
        chain=chain,
        market_outlook=market_outlook,
        risk_appetite=risk_appetite,
        symbol=symbol,
    )

    # 2. Option Clock — store snapshot & get targets
    OptionClock.store_snapshot(symbol, chain, spot)
    clock_targets = OptionClock.compute_intraday_targets(symbol)
    clock_snapshots = OptionClock.get_snapshots(symbol)

    # 3. OI Blocks — simulated for demo
    raw_blocks = OIBlockEngine.generate_simulated_blocks(spot, symbol)
    blocks = OIBlockEngine.detect_oi_blocks(raw_blocks)
    momentum = OIBlockEngine.detect_momentum(blocks)

    # 4. Swing scanners on simulated OHLCV
    ohlcv = generate_simulated_ohlcv(symbol, spot, days=60)
    scan_10d = SwingSpectrumScanner.scan_n_day_breakout(ohlcv, n=10)
    scan_50d = SwingSpectrumScanner.scan_n_day_breakout(ohlcv, n=50)
    channel = SwingSpectrumScanner.scan_channel_breakout(ohlcv, n=20)
    nr7 = SwingSpectrumScanner.scan_nr7(ohlcv)
    reversal = SwingSpectrumScanner.scan_reversal_radar(
        ohlcv,
        support=strategy_result["support_resistance"]["support"],
        resistance=strategy_result["support_resistance"]["resistance"],
    )

    return {
        **strategy_result,
        "option_clock": {
            "targets": clock_targets,
            "snapshots_count": len(clock_snapshots),
            "snapshots": clock_snapshots[-10:],  # last 10 only
        },
        "oi_blocks": {
            "blocks": blocks[-20:],  # last 20 candles
            "momentum": momentum,
        },
        "swing_scanners": {
            "breakout_10d": scan_10d,
            "breakout_50d": scan_50d,
            "channel_breakout": channel,
            "nr7": nr7,
            "reversal_radar": reversal,
        },
    }
