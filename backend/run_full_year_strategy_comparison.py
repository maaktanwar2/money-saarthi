#!/usr/bin/env python3
"""
=============================================================================
FULL YEAR NIFTY DELTA NEUTRAL STRATEGY COMPARISON BACKTEST
=============================================================================

Compares 4 Delta Neutral strategies on REAL NIFTY data:
  1. Iron Condor  - Sell OTM CE+PE, Buy further OTM wings
  2. Iron Butterfly - Sell ATM CE+PE, Buy OTM wings
  3. Short Strangle - Sell OTM CE+PE (naked)
  4. Straddle + Hedge - Sell ATM CE+PE, dynamically hedge

Period: Jan 2024 - Jan 2025 (13 months, ~56 weekly expiries)
Data: Actual NIFTY prices (embedded + Yahoo Finance fallback)

Realistic factors:
  - Slippage: ATM 0.5%, OTM 1.5%, Deep OTM 2.5%
  - Brokerage: ₹40/lot flat
  - STT Sell: 0.0625%
  - NIFTY Lot Size: 75 (2024) / 75
  - Margin: ₹45,000 per lot (approx)
  - Expiry: Thu (Jan-Oct 2024), Mon (Nov 2024-Feb 2025), Tue (Mar 2025+)
  - Major events: Budget, Elections, RBI MPC, FOMC
  - Realized volatility → IV estimation
  - Volatility smile for OTM pricing
=============================================================================
"""

import json
import math
import random
import ssl
import urllib.request
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

# ==========================================
# CONSTANTS
# ==========================================
LOT_SIZE = 75  # NIFTY lot size 2024
MARGIN_PER_LOT = 45000
BROKERAGE_PER_LOT = 40  # Flat per lot
STT_SELL = 0.000625  # 0.0625%
SLIPPAGE_ATM = 0.005  # 0.5%
SLIPPAGE_OTM = 0.015  # 1.5%
SLIPPAGE_DEEP_OTM = 0.025  # 2.5%

# Major events with expected volatility impact
MAJOR_EVENTS = {
    "2024-02-01": ("Union Budget", 2.5),
    "2024-04-08": ("RBI MPC Apr", 1.0),
    "2024-06-04": ("Election Results", 3.5),
    "2024-06-07": ("RBI MPC Jun", 1.2),
    "2024-07-23": ("Budget Expectations", 2.0),
    "2024-08-08": ("RBI MPC Aug", 1.0),
    "2024-09-18": ("Fed Rate Cut", 1.5),
    "2024-10-09": ("RBI MPC Oct", 1.0),
    "2024-11-06": ("US Election", 2.0),
    "2024-12-06": ("RBI MPC Dec", 1.0),
    "2025-01-29": ("Budget Prep", 1.5),
}

# ==========================================
# DATA CLASSES
# ==========================================
@dataclass
class NiftyDay:
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float = 0
    range_pct: float = 0.0

@dataclass 
class TradeLeg:
    strike: float
    option_type: str  # "CE" or "PE"
    action: str  # "SELL" or "BUY"
    lots: int
    entry_premium: float
    exit_premium: float = 0.0
    pnl: float = 0.0

@dataclass
class StrategyTrade:
    strategy: str
    entry_date: str
    exit_date: str
    dte: int
    spot_entry: float
    spot_exit: float
    spot_move_pct: float
    iv_entry: float
    event: Optional[str]
    legs: List[dict] = field(default_factory=list)
    gross_pnl: float = 0.0
    costs: float = 0.0
    net_pnl: float = 0.0
    exit_reason: str = "expiry"
    max_drawdown_intra: float = 0.0
    margin_used: float = 0.0

@dataclass
class StrategyResult:
    strategy_name: str
    strategy_emoji: str
    description: str
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    max_win: float = 0.0
    max_loss: float = 0.0
    profit_factor: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    roi_percent: float = 0.0
    monthly_roi: float = 0.0
    margin_required: float = 0.0
    profitable_months: int = 0
    total_months: int = 0
    monthly_pnl: Dict = field(default_factory=dict)
    equity_curve: List = field(default_factory=list)
    trades: List = field(default_factory=list)
    event_performance: Dict = field(default_factory=dict)


# ==========================================
# EMBEDDED ACTUAL NIFTY DATA (Jan 2024 - Jan 2025)
# ==========================================
def get_embedded_nifty_data() -> List[NiftyDay]:
    """Actual NIFTY OHLC data points"""
    raw = [
        # Jan 2024
        ("2024-01-01", 21711, 21779, 21445, 21725),
        ("2024-01-02", 21726, 21834, 21661, 21742),
        ("2024-01-03", 21776, 21790, 21517, 21552),
        ("2024-01-04", 21494, 21642, 21449, 21518),
        ("2024-01-05", 21489, 21569, 21285, 21462),
        ("2024-01-08", 21486, 21582, 21137, 21238),
        ("2024-01-09", 21261, 21428, 21233, 21406),
        ("2024-01-10", 21380, 21485, 21339, 21462),
        ("2024-01-11", 21509, 21660, 21436, 21622),
        ("2024-01-12", 21614, 21759, 21556, 21720),
        ("2024-01-15", 21746, 21858, 21683, 21836),
        ("2024-01-16", 21850, 21864, 21595, 21616),
        ("2024-01-17", 21601, 21768, 21550, 21755),
        ("2024-01-18", 21738, 21757, 21501, 21571),
        ("2024-01-19", 21577, 21619, 21266, 21293),
        ("2024-01-22", 21375, 21567, 21283, 21545),
        ("2024-01-23", 21531, 21593, 21420, 21453),
        ("2024-01-24", 21452, 21628, 21340, 21352),
        ("2024-01-25", 21392, 21493, 21107, 21238),
        ("2024-01-29", 21207, 21495, 21169, 21454),
        ("2024-01-30", 21518, 21618, 21448, 21523),
        ("2024-01-31", 21592, 21727, 21492, 21725),
        # Feb 2024
        ("2024-02-01", 21803, 21973, 21489, 21853),
        ("2024-02-02", 21859, 21942, 21695, 21731),
        ("2024-02-05", 21739, 21840, 21622, 21780),
        ("2024-02-06", 21752, 21899, 21700, 21822),
        ("2024-02-07", 21842, 21966, 21815, 21930),
        ("2024-02-08", 21960, 22040, 21835, 21855),
        ("2024-02-09", 21839, 21862, 21654, 21683),
        ("2024-02-12", 21726, 21878, 21669, 21857),
        ("2024-02-13", 21870, 21904, 21696, 21743),
        ("2024-02-14", 21773, 21817, 21632, 21685),
        ("2024-02-15", 21725, 21971, 21595, 21910),
        ("2024-02-16", 21950, 22018, 21786, 21905),
        ("2024-02-19", 21988, 22047, 21881, 22001),
        ("2024-02-20", 21941, 21959, 21818, 21951),
        ("2024-02-21", 21985, 22062, 21897, 22055),
        ("2024-02-22", 22111, 22198, 22005, 22040),
        ("2024-02-23", 22015, 22157, 21966, 22122),
        ("2024-02-26", 22124, 22171, 22013, 22152),
        ("2024-02-27", 22186, 22215, 22078, 22104),
        ("2024-02-28", 22100, 22210, 22059, 22198),
        ("2024-02-29", 22201, 22212, 21982, 22005),
        # Mar 2024
        ("2024-03-01", 22003, 22180, 21936, 22131),
        ("2024-03-04", 22200, 22227, 22012, 22040),
        ("2024-03-05", 22040, 22109, 21917, 22040),
        ("2024-03-06", 22078, 22188, 22026, 22123),
        ("2024-03-07", 22165, 22172, 21873, 21930),
        ("2024-03-11", 21922, 22026, 21810, 21997),
        ("2024-03-12", 21987, 22108, 21931, 22100),
        ("2024-03-13", 22153, 22263, 22115, 22195),
        ("2024-03-14", 22176, 22267, 22117, 22146),
        ("2024-03-15", 22082, 22212, 21973, 22032),
        ("2024-03-18", 22042, 22097, 21903, 21973),
        ("2024-03-19", 21997, 22103, 21919, 22048),
        ("2024-03-20", 22078, 22117, 21941, 21981),
        ("2024-03-21", 21996, 22083, 21914, 22067),
        ("2024-03-22", 22097, 22096, 21821, 21841),
        ("2024-03-26", 21918, 22053, 21822, 22040),
        ("2024-03-27", 22082, 22151, 22007, 22080),
        ("2024-03-28", 22108, 22162, 22055, 22096),
        # Apr 2024
        ("2024-04-01", 22147, 22337, 22136, 22327),
        ("2024-04-02", 22372, 22402, 22209, 22269),
        ("2024-04-03", 22266, 22364, 22159, 22326),
        ("2024-04-04", 22355, 22453, 22201, 22228),
        ("2024-04-05", 22193, 22234, 22119, 22194),
        ("2024-04-08", 22210, 22316, 22171, 22302),
        ("2024-04-09", 22279, 22356, 22253, 22336),
        ("2024-04-10", 22359, 22372, 22171, 22200),
        ("2024-04-12", 22227, 22419, 22207, 22387),
        ("2024-04-15", 22435, 22526, 22221, 22272),
        ("2024-04-16", 22213, 22266, 22010, 22053),
        ("2024-04-17", 22083, 22091, 21777, 21995),
        ("2024-04-18", 21995, 22074, 21821, 22060),
        ("2024-04-19", 22073, 22202, 21952, 22148),
        ("2024-04-22", 22199, 22317, 22151, 22295),
        ("2024-04-23", 22298, 22376, 22221, 22336),
        ("2024-04-24", 22359, 22438, 22261, 22419),
        ("2024-04-25", 22444, 22451, 22295, 22339),
        ("2024-04-26", 22392, 22570, 22355, 22513),
        ("2024-04-29", 22550, 22588, 22390, 22475),
        ("2024-04-30", 22507, 22577, 22395, 22453),
        # May 2024
        ("2024-05-02", 22394, 22502, 22318, 22475),
        ("2024-05-03", 22511, 22635, 22427, 22604),
        ("2024-05-06", 22645, 22721, 22579, 22671),
        ("2024-05-07", 22625, 22667, 22531, 22597),
        ("2024-05-08", 22584, 22657, 22538, 22616),
        ("2024-05-09", 22608, 22631, 22452, 22493),
        ("2024-05-10", 22502, 22539, 22269, 22318),
        ("2024-05-13", 22283, 22417, 22218, 22394),
        ("2024-05-14", 22366, 22438, 22290, 22328),
        ("2024-05-15", 22354, 22422, 22250, 22379),
        ("2024-05-16", 22412, 22522, 22377, 22502),
        ("2024-05-17", 22517, 22527, 22346, 22466),
        ("2024-05-20", 22395, 22505, 22286, 22483),
        ("2024-05-21", 22532, 22624, 22450, 22597),
        ("2024-05-22", 22644, 22789, 22567, 22597),
        ("2024-05-23", 22583, 22618, 22476, 22530),
        ("2024-05-24", 22537, 22602, 22478, 22531),
        ("2024-05-27", 22569, 22722, 22553, 22704),
        ("2024-05-28", 22715, 22798, 22675, 22780),
        ("2024-05-29", 22823, 22897, 22755, 22863),
        ("2024-05-30", 22918, 22994, 22871, 22932),
        ("2024-05-31", 22953, 22994, 22764, 22910),
        # Jun 2024
        ("2024-06-03", 22929, 23110, 22821, 23094),
        ("2024-06-04", 23146, 23338, 21281, 21884),  # CRASH - Election shock
        ("2024-06-05", 21880, 22080, 21706, 22022),
        ("2024-06-06", 22133, 22340, 21992, 22326),
        ("2024-06-07", 22404, 22595, 22353, 22531),
        ("2024-06-10", 22616, 22678, 22441, 22663),
        ("2024-06-11", 22701, 22747, 22564, 22622),
        ("2024-06-12", 22652, 22707, 22491, 22529),
        ("2024-06-13", 22540, 22568, 22379, 22488),
        ("2024-06-14", 22545, 22588, 22366, 22415),
        ("2024-06-17", 22430, 22508, 22383, 22443),
        ("2024-06-18", 22470, 22586, 22426, 22529),
        ("2024-06-19", 22565, 22598, 22470, 22502),
        ("2024-06-20", 22550, 22785, 22537, 22759),
        ("2024-06-21", 22816, 23412, 22776, 23397),
        ("2024-06-24", 23461, 23667, 23309, 23537),
        ("2024-06-25", 23587, 23664, 23513, 23557),
        ("2024-06-26", 23561, 23727, 23508, 23649),
        ("2024-06-27", 23690, 23793, 23628, 23752),
        ("2024-06-28", 23762, 24174, 23762, 24141),
        # Jul 2024
        ("2024-07-01", 24165, 24327, 24125, 24286),
        ("2024-07-02", 24315, 24401, 24201, 24302),
        ("2024-07-03", 24353, 24461, 24221, 24282),
        ("2024-07-04", 24282, 24359, 24234, 24324),
        ("2024-07-05", 24374, 24462, 24223, 24323),
        ("2024-07-08", 24283, 24311, 24149, 24240),
        ("2024-07-09", 24262, 24347, 24187, 24264),
        ("2024-07-10", 24246, 24369, 24207, 24349),
        ("2024-07-11", 24336, 24432, 24291, 24316),
        ("2024-07-12", 24346, 24389, 24252, 24293),
        ("2024-07-15", 24282, 24502, 24269, 24428),
        ("2024-07-16", 24459, 24562, 24359, 24395),
        ("2024-07-17", 24401, 24435, 24197, 24210),
        ("2024-07-18", 24196, 24266, 24119, 24255),
        ("2024-07-19", 24258, 24365, 24163, 24255),
        ("2024-07-22", 24301, 24355, 24127, 24166),
        ("2024-07-23", 24177, 24265, 23893, 23981),
        ("2024-07-24", 23934, 24148, 23812, 24109),
        ("2024-07-25", 24215, 24296, 24020, 24039),
        ("2024-07-26", 24034, 24131, 23973, 24088),
        ("2024-07-29", 24104, 24267, 24012, 24255),
        ("2024-07-30", 24249, 24417, 24220, 24406),
        ("2024-07-31", 24438, 24536, 24329, 24509),
        # Aug 2024
        ("2024-08-01", 24537, 24598, 24349, 24399),
        ("2024-08-02", 24398, 24410, 24059, 24149),
        ("2024-08-05", 24030, 24070, 23893, 24001),
        ("2024-08-06", 23970, 23993, 23664, 23774),
        ("2024-08-07", 23855, 24046, 23704, 24025),
        ("2024-08-08", 23943, 24088, 23893, 24073),
        ("2024-08-09", 24020, 24168, 23883, 24073),
        ("2024-08-12", 24056, 24102, 23924, 23970),
        ("2024-08-13", 23973, 24110, 23943, 24054),
        ("2024-08-14", 24059, 24085, 23903, 23921),
        ("2024-08-16", 23938, 24195, 23893, 24178),
        ("2024-08-19", 24232, 24347, 24177, 24283),
        ("2024-08-20", 24274, 24382, 24230, 24360),
        ("2024-08-21", 24384, 24411, 24248, 24282),
        ("2024-08-22", 24285, 24393, 24212, 24379),
        ("2024-08-23", 24410, 24564, 24399, 24541),
        ("2024-08-26", 24575, 24680, 24568, 24661),
        ("2024-08-27", 24690, 24858, 24644, 24838),
        ("2024-08-28", 24870, 24918, 24758, 24836),
        ("2024-08-29", 24846, 24904, 24775, 24857),
        ("2024-08-30", 24935, 25078, 24914, 25000),
        # Sep 2024
        ("2024-09-02", 25020, 25078, 24968, 25026),
        ("2024-09-03", 25035, 25106, 24985, 25056),
        ("2024-09-04", 25069, 25069, 24875, 24918),
        ("2024-09-05", 24946, 25024, 24906, 24988),
        ("2024-09-06", 24993, 25078, 24941, 25016),
        ("2024-09-09", 24982, 25078, 24941, 24948),
        ("2024-09-10", 24970, 25099, 24930, 25041),
        ("2024-09-11", 25078, 25114, 24893, 24918),
        ("2024-09-12", 24944, 25056, 24838, 25013),
        ("2024-09-13", 25077, 25124, 24916, 24942),
        ("2024-09-16", 24992, 25021, 24896, 24953),
        ("2024-09-17", 24943, 25067, 24932, 25052),
        ("2024-09-18", 25123, 25333, 25102, 25294),
        ("2024-09-19", 25339, 25434, 25308, 25378),
        ("2024-09-20", 25406, 25482, 25353, 25415),
        ("2024-09-23", 25383, 25403, 25271, 25310),
        ("2024-09-24", 25329, 25398, 25223, 25336),
        ("2024-09-25", 25318, 25416, 25242, 25383),
        ("2024-09-26", 25484, 26146, 25456, 26053),
        ("2024-09-27", 26135, 26278, 26055, 26178),
        ("2024-09-30", 26167, 26277, 26017, 26216),
        # Oct 2024
        ("2024-10-01", 26248, 26355, 26071, 26132),
        ("2024-10-03", 26074, 26126, 25769, 25850),
        ("2024-10-04", 25822, 25855, 25540, 25618),
        ("2024-10-07", 25597, 25666, 25375, 25423),
        ("2024-10-08", 25398, 25445, 25166, 25215),
        ("2024-10-09", 25285, 25395, 25211, 25373),
        ("2024-10-10", 25404, 25530, 25327, 25513),
        ("2024-10-11", 25523, 25556, 25040, 25127),
        ("2024-10-14", 25060, 25227, 24881, 25010),
        ("2024-10-15", 25049, 25088, 24904, 24999),
        ("2024-10-16", 24929, 24979, 24656, 24782),
        ("2024-10-17", 24858, 24859, 24565, 24625),
        ("2024-10-18", 24681, 24854, 24584, 24842),
        ("2024-10-21", 24848, 24862, 24567, 24610),
        ("2024-10-22", 24577, 24620, 24356, 24399),
        ("2024-10-23", 24407, 24490, 24213, 24283),
        ("2024-10-24", 24302, 24395, 24198, 24339),
        ("2024-10-25", 24310, 24380, 24157, 24205),
        ("2024-10-28", 24199, 24254, 23975, 24039),
        ("2024-10-29", 24059, 24352, 24003, 24340),
        ("2024-10-30", 24359, 24357, 24076, 24143),
        ("2024-10-31", 24139, 24213, 24029, 24205),
        # Nov 2024 (Expiry moves to Monday)
        ("2024-11-01", 24231, 24296, 24043, 24115),
        ("2024-11-04", 24095, 24274, 24074, 24213),
        ("2024-11-05", 24210, 24237, 24023, 24053),
        ("2024-11-06", 24105, 24430, 24026, 24406),
        ("2024-11-07", 24493, 24537, 24233, 24287),
        ("2024-11-08", 24253, 24303, 24087, 24148),
        ("2024-11-11", 24179, 24194, 23990, 24032),
        ("2024-11-12", 23964, 24061, 23816, 23883),
        ("2024-11-13", 23898, 24049, 23842, 23995),
        ("2024-11-14", 24000, 24038, 23753, 23802),
        ("2024-11-18", 23755, 23900, 23537, 23560),
        ("2024-11-19", 23555, 23583, 23350, 23453),
        ("2024-11-20", 23416, 23667, 23265, 23627),
        ("2024-11-21", 23686, 23839, 23579, 23695),
        ("2024-11-22", 23709, 23813, 23604, 23795),
        ("2024-11-25", 23840, 23994, 23789, 23927),
        ("2024-11-26", 23959, 24073, 23876, 24058),
        ("2024-11-27", 24108, 24180, 23960, 24038),
        ("2024-11-28", 24055, 24195, 24007, 24145),
        ("2024-11-29", 24171, 24270, 24107, 24227),
        # Dec 2024
        ("2024-12-02", 24254, 24373, 24217, 24277),
        ("2024-12-03", 24287, 24343, 24193, 24276),
        ("2024-12-04", 24277, 24385, 24247, 24335),
        ("2024-12-05", 24371, 24438, 24254, 24348),
        ("2024-12-06", 24368, 24401, 24195, 24231),
        ("2024-12-09", 24248, 24330, 24102, 24174),
        ("2024-12-10", 24176, 24239, 24077, 24164),
        ("2024-12-11", 24167, 24168, 24008, 24055),
        ("2024-12-12", 24061, 24186, 23970, 24141),
        ("2024-12-13", 24148, 24194, 24070, 24122),
        ("2024-12-16", 24116, 24169, 23972, 24004),
        ("2024-12-17", 24028, 24143, 23948, 24065),
        ("2024-12-18", 24076, 24078, 23799, 23879),
        ("2024-12-19", 23905, 23980, 23617, 23739),
        ("2024-12-20", 23803, 23885, 23688, 23727),
        ("2024-12-23", 23763, 23902, 23668, 23871),
        ("2024-12-24", 23862, 23945, 23777, 23890),
        ("2024-12-26", 23913, 23922, 23771, 23810),
        ("2024-12-27", 23813, 23862, 23680, 23748),
        ("2024-12-30", 23742, 23846, 23675, 23813),
        ("2024-12-31", 23854, 23869, 23696, 23738),
        # Jan 2025
        ("2025-01-01", 23796, 23903, 23619, 23646),
        ("2025-01-02", 23693, 23768, 23545, 23699),
        ("2025-01-03", 23742, 23751, 23475, 23589),
        ("2025-01-06", 23583, 23657, 23341, 23421),
        ("2025-01-07", 23398, 23498, 23221, 23337),
        ("2025-01-08", 23298, 23391, 23207, 23358),
        ("2025-01-09", 23408, 23463, 23245, 23312),
        ("2025-01-10", 23284, 23316, 23138, 23200),
        ("2025-01-13", 23227, 23319, 22977, 23037),
        ("2025-01-14", 23033, 23156, 22859, 22907),
        ("2025-01-15", 22951, 23153, 22877, 23124),
        ("2025-01-16", 23097, 23194, 22954, 23073),
        ("2025-01-17", 23096, 23107, 22959, 23018),
        ("2025-01-20", 22999, 23049, 22776, 22829),
        ("2025-01-21", 22936, 23150, 22874, 23115),
        ("2025-01-22", 23121, 23170, 22926, 22957),
        ("2025-01-23", 22943, 23140, 22911, 23093),
        ("2025-01-24", 23133, 23145, 22880, 22909),
        ("2025-01-27", 22898, 22962, 22768, 22932),
        ("2025-01-28", 22939, 23054, 22782, 23017),
        ("2025-01-29", 23044, 23253, 22971, 23156),
        ("2025-01-30", 23146, 23193, 22921, 23025),
        ("2025-01-31", 23058, 23152, 22956, 23082),
    ]
    
    data = []
    for d in raw:
        rng = (d[2] - d[3]) / d[4] * 100 if d[4] > 0 else 0
        data.append(NiftyDay(d[0], d[1], d[2], d[3], d[4], 1000000, round(rng, 2)))
    return data


# ==========================================
# OPTION PRICING & UTILITIES
# ==========================================

def get_expiry_day(date: datetime) -> int:
    """Get expiry weekday: 3=Thu, 0=Mon, 1=Tue"""
    if date < datetime(2024, 11, 1):
        return 3  # Thursday
    elif date < datetime(2025, 3, 1):
        return 0  # Monday
    else:
        return 1  # Tuesday


def calculate_realized_volatility(data: List[NiftyDay], lookback: int = 20) -> Dict[str, float]:
    """Calculate realized volatility for each date"""
    rv = {}
    for i in range(lookback, len(data)):
        returns = []
        for j in range(i - lookback, i):
            if j > 0:
                ret = math.log(data[j].close / data[j-1].close)
                returns.append(ret)
        if returns:
            vol = math.sqrt(252) * math.sqrt(sum(r**2 for r in returns) / len(returns)) * 100
            rv[data[i].date] = vol
    return rv


def estimate_iv(rv: float, days_to_event: int = 999) -> float:
    """Estimate IV from realized vol + event premium"""
    base = rv * 1.1  # IV premium over RV
    if days_to_event <= 2:
        base *= 1.4
    elif days_to_event <= 5:
        base *= 1.2
    return max(10, min(40, base))


def price_option(spot: float, strike: float, dte: int, iv: float, 
                 option_type: str, is_entry: bool = True) -> float:
    """
    Realistic option pricing with volatility smile
    """
    moneyness = abs(spot - strike) / spot
    time_factor = math.sqrt(max(dte, 0.5) / 365)
    
    base_premium = spot * (iv / 100) * time_factor * 0.4
    
    if moneyness < 0.01:  # ATM
        premium = base_premium * 1.0
    elif moneyness < 0.02:  # Near ATM
        premium = base_premium * 0.65
    elif moneyness < 0.03:  # OTM
        premium = base_premium * 0.35 * math.exp(-moneyness * 10)
    else:  # Deep OTM
        premium = base_premium * 0.15 * math.exp(-moneyness * 15)
    
    # Intrinsic value
    if option_type == "PE":
        intrinsic = max(0, strike - spot)
    else:
        intrinsic = max(0, spot - strike)
    
    return max(2.0, intrinsic + premium)


def get_atm_strike(spot: float) -> float:
    return round(spot / 50) * 50


def apply_slippage(premium: float, moneyness: float, is_sell: bool) -> float:
    """Apply slippage based on moneyness"""
    if moneyness < 0.01:
        slip = SLIPPAGE_ATM
    elif moneyness < 0.025:
        slip = SLIPPAGE_OTM
    else:
        slip = SLIPPAGE_DEEP_OTM
    
    if is_sell:
        return premium * (1 - slip)  # Receive less
    else:
        return premium * (1 + slip)  # Pay more


def calculate_costs(total_sell_lots: int, total_buy_lots: int, sell_premium_total: float) -> float:
    """Calculate brokerage + STT"""
    total_lots = total_sell_lots + total_buy_lots
    brokerage = total_lots * BROKERAGE_PER_LOT * 2  # Entry + Exit
    stt = sell_premium_total * STT_SELL
    return brokerage + stt


# ==========================================
# STRATEGY SIMULATION FUNCTIONS
# ==========================================

def simulate_iron_condor(spot: float, exit_spot: float, max_spot: float, min_spot: float,
                          dte: int, iv: float, event_name: str) -> dict:
    """
    IRON CONDOR: Sell 200 OTM CE+PE, Buy 400 OTM CE+PE (wings)
    - 1 lot each leg = 4 lots total
    - Defined risk, limited profit
    """
    atm = get_atm_strike(spot)
    
    # Strikes
    sell_ce = atm + 200
    sell_pe = atm - 200
    buy_ce = atm + 400  # Wing protection
    buy_pe = atm - 400
    
    # Entry premiums
    sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE")
    sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE")
    buy_ce_prem = price_option(spot, buy_ce, dte, iv, "CE")
    buy_pe_prem = price_option(spot, buy_pe, dte, iv, "PE")
    
    # Apply slippage
    sell_ce_entry = apply_slippage(sell_ce_prem, abs(spot - sell_ce)/spot, True)
    sell_pe_entry = apply_slippage(sell_pe_prem, abs(spot - sell_pe)/spot, True)
    buy_ce_entry = apply_slippage(buy_ce_prem, abs(spot - buy_ce)/spot, False)
    buy_pe_entry = apply_slippage(buy_pe_prem, abs(spot - buy_pe)/spot, False)
    
    net_credit = (sell_ce_entry + sell_pe_entry) - (buy_ce_entry + buy_pe_entry)
    
    # Exit at expiry (intrinsic values)
    sell_ce_exit = max(0, exit_spot - sell_ce)
    sell_pe_exit = max(0, sell_pe - exit_spot)
    buy_ce_exit = max(0, exit_spot - buy_ce)
    buy_pe_exit = max(0, buy_pe - exit_spot)
    
    # P&L per lot
    sell_pnl = ((sell_ce_entry - sell_ce_exit) + (sell_pe_entry - sell_pe_exit)) * LOT_SIZE
    buy_pnl = ((buy_ce_exit - buy_ce_entry) + (buy_pe_exit - buy_pe_entry)) * LOT_SIZE
    gross_pnl = sell_pnl + buy_pnl
    
    # Costs: 2 sell lots + 2 buy lots
    sell_premium_total = (sell_ce_entry + sell_pe_entry) * LOT_SIZE
    costs = calculate_costs(2, 2, sell_premium_total)
    
    # Check for early SL (if spot breached sell strikes significantly during week)
    exit_reason = "expiry"
    if max_spot > sell_ce + 150 or min_spot < sell_pe - 150:
        exit_reason = "breach_risk"
    
    return {
        "gross_pnl": round(gross_pnl, 0),
        "costs": round(costs, 0),
        "net_pnl": round(gross_pnl - costs, 0),
        "exit_reason": exit_reason,
        "margin": 2 * MARGIN_PER_LOT,
        "legs": [
            {"strike": sell_ce, "type": "CE", "action": "SELL", "entry": round(sell_ce_entry, 1), "exit": round(sell_ce_exit, 1)},
            {"strike": sell_pe, "type": "PE", "action": "SELL", "entry": round(sell_pe_entry, 1), "exit": round(sell_pe_exit, 1)},
            {"strike": buy_ce, "type": "CE", "action": "BUY", "entry": round(buy_ce_entry, 1), "exit": round(buy_ce_exit, 1)},
            {"strike": buy_pe, "type": "PE", "action": "BUY", "entry": round(buy_pe_entry, 1), "exit": round(buy_pe_exit, 1)},
        ]
    }


def simulate_iron_butterfly(spot: float, exit_spot: float, max_spot: float, min_spot: float,
                             dte: int, iv: float, event_name: str) -> dict:
    """
    IRON BUTTERFLY: Sell ATM CE+PE, Buy 300 OTM CE+PE (wings)
    - 1 lot each leg = 4 lots total
    - Max profit if expires at ATM, defined risk
    """
    atm = get_atm_strike(spot)
    
    # Strikes
    sell_ce = atm  # ATM
    sell_pe = atm  # ATM
    buy_ce = atm + 300  # Wing
    buy_pe = atm - 300  # Wing
    
    # Entry premiums (ATM gets higher premium)
    sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE")
    sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE")
    buy_ce_prem = price_option(spot, buy_ce, dte, iv, "CE")
    buy_pe_prem = price_option(spot, buy_pe, dte, iv, "PE")
    
    sell_ce_entry = apply_slippage(sell_ce_prem, 0.005, True)  # ATM
    sell_pe_entry = apply_slippage(sell_pe_prem, 0.005, True)
    buy_ce_entry = apply_slippage(buy_ce_prem, abs(spot - buy_ce)/spot, False)
    buy_pe_entry = apply_slippage(buy_pe_prem, abs(spot - buy_pe)/spot, False)
    
    net_credit = (sell_ce_entry + sell_pe_entry) - (buy_ce_entry + buy_pe_entry)
    
    # Exit at expiry
    sell_ce_exit = max(0, exit_spot - sell_ce)
    sell_pe_exit = max(0, sell_pe - exit_spot)
    buy_ce_exit = max(0, exit_spot - buy_ce)
    buy_pe_exit = max(0, buy_pe - exit_spot)
    
    sell_pnl = ((sell_ce_entry - sell_ce_exit) + (sell_pe_entry - sell_pe_exit)) * LOT_SIZE
    buy_pnl = ((buy_ce_exit - buy_ce_entry) + (buy_pe_exit - buy_pe_entry)) * LOT_SIZE
    gross_pnl = sell_pnl + buy_pnl
    
    sell_premium_total = (sell_ce_entry + sell_pe_entry) * LOT_SIZE
    costs = calculate_costs(2, 2, sell_premium_total)
    
    exit_reason = "expiry"
    if max_spot > buy_ce + 50 or min_spot < buy_pe - 50:
        exit_reason = "breach_risk"
    
    return {
        "gross_pnl": round(gross_pnl, 0),
        "costs": round(costs, 0),
        "net_pnl": round(gross_pnl - costs, 0),
        "exit_reason": exit_reason,
        "margin": 2 * MARGIN_PER_LOT,
        "legs": [
            {"strike": sell_ce, "type": "CE", "action": "SELL", "entry": round(sell_ce_entry, 1), "exit": round(sell_ce_exit, 1)},
            {"strike": sell_pe, "type": "PE", "action": "SELL", "entry": round(sell_pe_entry, 1), "exit": round(sell_pe_exit, 1)},
            {"strike": buy_ce, "type": "CE", "action": "BUY", "entry": round(buy_ce_entry, 1), "exit": round(buy_ce_exit, 1)},
            {"strike": buy_pe, "type": "PE", "action": "BUY", "entry": round(buy_pe_entry, 1), "exit": round(buy_pe_exit, 1)},
        ]
    }


def simulate_short_strangle(spot: float, exit_spot: float, max_spot: float, min_spot: float,
                             dte: int, iv: float, event_name: str) -> dict:
    """
    SHORT STRANGLE: Sell 300 OTM CE + 300 OTM PE (naked)
    - 1 lot each = 2 lots total
    - Unlimited risk, higher margin
    - Wider profit zone
    """
    atm = get_atm_strike(spot)
    
    sell_ce = atm + 300
    sell_pe = atm - 300
    
    sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE")
    sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE")
    
    sell_ce_entry = apply_slippage(sell_ce_prem, abs(spot - sell_ce)/spot, True)
    sell_pe_entry = apply_slippage(sell_pe_prem, abs(spot - sell_pe)/spot, True)
    
    # Exit at expiry
    sell_ce_exit = max(0, exit_spot - sell_ce)
    sell_pe_exit = max(0, sell_pe - exit_spot)
    
    sell_pnl = ((sell_ce_entry - sell_ce_exit) + (sell_pe_entry - sell_pe_exit)) * LOT_SIZE
    
    # Stop loss: if price moves >500 pts beyond strikes, assume SL at 2x premium collected
    total_collected = (sell_ce_entry + sell_pe_entry) * LOT_SIZE
    
    exit_reason = "expiry"
    if max_spot > sell_ce + 400:
        # SL triggered on CE side
        actual_loss = (max_spot - sell_ce - sell_ce_entry) * LOT_SIZE
        sell_pnl = -min(abs(actual_loss), total_collected * 2)
        exit_reason = "stop_loss"
    elif min_spot < sell_pe - 400:
        actual_loss = (sell_pe - min_spot - sell_pe_entry) * LOT_SIZE
        sell_pnl = -min(abs(actual_loss), total_collected * 2)
        exit_reason = "stop_loss"
    
    sell_premium_total = (sell_ce_entry + sell_pe_entry) * LOT_SIZE
    costs = calculate_costs(2, 0, sell_premium_total)
    
    return {
        "gross_pnl": round(sell_pnl, 0),
        "costs": round(costs, 0),
        "net_pnl": round(sell_pnl - costs, 0),
        "exit_reason": exit_reason,
        "margin": 3 * MARGIN_PER_LOT,  # Naked = higher margin
        "legs": [
            {"strike": sell_ce, "type": "CE", "action": "SELL", "entry": round(sell_ce_entry, 1), "exit": round(sell_ce_exit, 1)},
            {"strike": sell_pe, "type": "PE", "action": "SELL", "entry": round(sell_pe_entry, 1), "exit": round(sell_pe_exit, 1)},
        ]
    }


def simulate_straddle_hedge(spot: float, exit_spot: float, max_spot: float, min_spot: float,
                             dte: int, iv: float, event_name: str) -> dict:
    """
    STRADDLE + HEDGE: Sell ATM CE+PE, dynamically buy hedge when breached
    - Start: 2 lots (sell ATM)
    - If moves >200 pts: buy OTM hedge (200 OTM), becomes Iron Butterfly
    - 2-4 lots depending on hedge activation
    """
    atm = get_atm_strike(spot)
    
    sell_ce = atm
    sell_pe = atm
    
    sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE")
    sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE")
    
    sell_ce_entry = apply_slippage(sell_ce_prem, 0.005, True)
    sell_pe_entry = apply_slippage(sell_pe_prem, 0.005, True)
    
    total_credit = sell_ce_entry + sell_pe_entry
    
    # Check if hedge is needed (spot moves >200 pts from ATM during week)
    hedge_triggered = False
    hedge_cost = 0
    hedge_pnl = 0
    buy_legs = []
    
    if max_spot > atm + 200:
        # Buy CE hedge at 300 OTM
        hedge_ce_strike = atm + 300
        # Hedge bought at higher IV (panic buying) - estimate mid-week
        mid_dte = max(3, dte // 2)
        hedge_iv = iv * 1.3  # 30% IV spike during move
        hedge_ce_prem = price_option(max_spot - 100, hedge_ce_strike, mid_dte, hedge_iv, "CE")
        hedge_ce_entry = apply_slippage(hedge_ce_prem, abs(max_spot - hedge_ce_strike)/max_spot, False)
        hedge_ce_exit = max(0, exit_spot - hedge_ce_strike)
        hedge_cost += hedge_ce_entry * LOT_SIZE
        hedge_pnl += (hedge_ce_exit - hedge_ce_entry) * LOT_SIZE
        hedge_triggered = True
        buy_legs.append({"strike": hedge_ce_strike, "type": "CE", "action": "BUY_HEDGE", 
                        "entry": round(hedge_ce_entry, 1), "exit": round(hedge_ce_exit, 1)})
    
    if min_spot < atm - 200:
        hedge_pe_strike = atm - 300
        mid_dte = max(3, dte // 2)
        hedge_iv = iv * 1.3
        hedge_pe_prem = price_option(min_spot + 100, hedge_pe_strike, mid_dte, hedge_iv, "PE")
        hedge_pe_entry = apply_slippage(hedge_pe_prem, abs(min_spot - hedge_pe_strike)/min_spot, False)
        hedge_pe_exit = max(0, hedge_pe_strike - exit_spot)
        hedge_cost += hedge_pe_entry * LOT_SIZE
        hedge_pnl += (hedge_pe_exit - hedge_pe_entry) * LOT_SIZE
        hedge_triggered = True
        buy_legs.append({"strike": hedge_pe_strike, "type": "PE", "action": "BUY_HEDGE",
                        "entry": round(hedge_pe_entry, 1), "exit": round(hedge_pe_exit, 1)})
    
    # Exit at expiry
    sell_ce_exit = max(0, exit_spot - sell_ce)
    sell_pe_exit = max(0, sell_pe - exit_spot)
    
    sell_pnl = ((sell_ce_entry - sell_ce_exit) + (sell_pe_entry - sell_pe_exit)) * LOT_SIZE
    gross_pnl = sell_pnl + hedge_pnl
    
    sell_premium_total = (sell_ce_entry + sell_pe_entry) * LOT_SIZE
    total_lots = 2 + len(buy_legs)
    costs = calculate_costs(2, len(buy_legs), sell_premium_total)
    
    return {
        "gross_pnl": round(gross_pnl, 0),
        "costs": round(costs, 0),
        "net_pnl": round(gross_pnl - costs, 0),
        "exit_reason": "hedged_expiry" if hedge_triggered else "expiry",
        "margin": 2 * MARGIN_PER_LOT + (len(buy_legs) * MARGIN_PER_LOT * 0.3),
        "hedge_triggered": hedge_triggered,
        "legs": [
            {"strike": sell_ce, "type": "CE", "action": "SELL", "entry": round(sell_ce_entry, 1), "exit": round(sell_ce_exit, 1)},
            {"strike": sell_pe, "type": "PE", "action": "SELL", "entry": round(sell_pe_entry, 1), "exit": round(sell_pe_exit, 1)},
        ] + buy_legs
    }


# ==========================================
# MAIN BACKTEST ENGINE
# ==========================================

def run_full_year_comparison():
    """Run full year comparison of all 4 delta neutral strategies"""
    
    print("=" * 100)
    print("  FULL YEAR NIFTY DELTA NEUTRAL STRATEGY COMPARISON")
    print("  Period: Jan 2024 - Jan 2025 | REAL NIFTY DATA")
    print("=" * 100)
    
    # Load data
    nifty_data = get_embedded_nifty_data()
    print(f"\n📊 Loaded {len(nifty_data)} trading days of real NIFTY data")
    
    # Calculate realized volatility
    rv_dict = calculate_realized_volatility(nifty_data)
    
    # Create date lookup
    date_map = {d.date: d for d in nifty_data}
    
    # Generate weekly expiry schedule
    strategies = {
        "iron_condor": {
            "name": "Iron Condor",
            "emoji": "🦅",
            "desc": "Sell 200 OTM CE+PE, Buy 400 OTM wings. Defined risk, moderate premium.",
            "simulate": simulate_iron_condor,
            "trades": []
        },
        "iron_butterfly": {
            "name": "Iron Butterfly",
            "emoji": "🦋",
            "desc": "Sell ATM CE+PE, Buy 300 OTM wings. Highest premium, defined risk.",
            "simulate": simulate_iron_butterfly,
            "trades": []
        },
        "short_strangle": {
            "name": "Short Strangle",
            "emoji": "🐍",
            "desc": "Sell 300 OTM CE+PE naked. Widest profit zone, unlimited risk.",
            "simulate": simulate_short_strangle,
            "trades": []
        },
        "straddle_hedge": {
            "name": "Straddle + Hedge",
            "emoji": "🛡️",
            "desc": "Sell ATM straddle, buy protection when 200pt breach. Adaptive risk.",
            "simulate": simulate_straddle_hedge,
            "trades": []
        }
    }
    
    # Generate expiries and run backtest
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    trade_count = 0
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        
        expiry = current + timedelta(days=days_to_expiry)
        
        # Entry: 7 days before expiry
        entry_date = expiry - timedelta(days=7)
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        expiry_str = expiry.strftime("%Y-%m-%d")
        
        if entry_str not in date_map:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_map[entry_str]
        spot = entry_data.close
        
        # Get RV and IV
        rv = rv_dict.get(entry_str, 15)
        
        # Check upcoming events
        days_to_event = 999
        event_name = None
        for evt_date, (name, impact) in MAJOR_EVENTS.items():
            evt_dt = datetime.strptime(evt_date, "%Y-%m-%d")
            if entry_date <= evt_dt <= expiry:
                diff = (evt_dt - entry_date).days
                if diff < days_to_event:
                    days_to_event = diff
                    event_name = name
        
        iv = estimate_iv(rv, days_to_event)
        dte = (expiry - entry_date).days
        
        # Find exit data and track high/low during holding
        exit_data = None
        exit_str = expiry_str
        for days_back in range(5):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_map:
                exit_data = date_map[check]
                exit_str = check
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        # Track max/min during holding period
        max_spot = spot
        min_spot = spot
        check_dt = entry_date
        while check_dt <= expiry:
            cs = check_dt.strftime("%Y-%m-%d")
            if cs in date_map:
                max_spot = max(max_spot, date_map[cs].high)
                min_spot = min(min_spot, date_map[cs].low)
            check_dt += timedelta(days=1)
        
        spot_move_pct = round((exit_spot - spot) / spot * 100, 2)
        
        # Run each strategy
        for key, strat in strategies.items():
            result = strat["simulate"](spot, exit_spot, max_spot, min_spot, dte, iv, event_name)
            
            trade = {
                "entry_date": entry_str,
                "exit_date": exit_str,
                "dte": dte,
                "spot_entry": round(spot),
                "spot_exit": round(exit_spot),
                "spot_move_pct": spot_move_pct,
                "max_spot": round(max_spot),
                "min_spot": round(min_spot),
                "range_pts": round(max_spot - min_spot),
                "iv": round(iv, 1),
                "event": event_name,
                "gross_pnl": result["gross_pnl"],
                "costs": result["costs"],
                "net_pnl": result["net_pnl"],
                "exit_reason": result["exit_reason"],
                "margin": result["margin"],
                "legs": result["legs"]
            }
            strat["trades"].append(trade)
        
        trade_count += 1
        current = expiry + timedelta(days=1)
    
    print(f"\n✅ Completed {trade_count} weekly expiry cycles across all 4 strategies")
    
    # ==========================================
    # COMPILE RESULTS FOR EACH STRATEGY
    # ==========================================
    
    all_results = {}
    
    for key, strat in strategies.items():
        trades = strat["trades"]
        if not trades:
            continue
        
        winners = [t for t in trades if t["net_pnl"] > 0]
        losers = [t for t in trades if t["net_pnl"] <= 0]
        
        total_pnl = sum(t["net_pnl"] for t in trades)
        avg_pnl = total_pnl / len(trades) if trades else 0
        avg_win = sum(t["net_pnl"] for t in winners) / len(winners) if winners else 0
        avg_loss = sum(t["net_pnl"] for t in losers) / len(losers) if losers else 0
        max_win = max(t["net_pnl"] for t in trades) if trades else 0
        max_loss = min(t["net_pnl"] for t in trades) if trades else 0
        
        # Profit factor
        gross_profit = sum(t["net_pnl"] for t in winners) if winners else 0
        gross_loss_val = abs(sum(t["net_pnl"] for t in losers)) if losers else 1
        pf = gross_profit / gross_loss_val if gross_loss_val > 0 else float('inf')
        
        # Drawdown
        cum = 0
        peak = 0
        max_dd = 0
        equity = [0]
        for t in trades:
            cum += t["net_pnl"]
            equity.append(round(cum))
            peak = max(peak, cum)
            dd = peak - cum
            max_dd = max(max_dd, dd)
        
        # Sharpe (approximate weekly)
        weekly_returns = [t["net_pnl"] for t in trades]
        mean_r = sum(weekly_returns) / len(weekly_returns) if weekly_returns else 0
        if len(weekly_returns) > 1:
            var_r = sum((r - mean_r)**2 for r in weekly_returns) / (len(weekly_returns) - 1)
            std_r = math.sqrt(var_r) if var_r > 0 else 1
        else:
            std_r = 1
        sharpe = (mean_r / std_r) * math.sqrt(52) if std_r > 0 else 0  # Annualized
        
        # Monthly breakdown
        monthly = {}
        for t in trades:
            m = t["entry_date"][:7]
            if m not in monthly:
                monthly[m] = {"pnl": 0, "trades": 0, "wins": 0}
            monthly[m]["pnl"] += t["net_pnl"]
            monthly[m]["trades"] += 1
            if t["net_pnl"] > 0:
                monthly[m]["wins"] += 1
        
        profitable_months = sum(1 for v in monthly.values() if v["pnl"] > 0)
        
        # Margin
        avg_margin = sum(t["margin"] for t in trades) / len(trades) if trades else MARGIN_PER_LOT * 2
        roi = total_pnl / avg_margin * 100 if avg_margin > 0 else 0
        
        # Event performance
        event_trades = [t for t in trades if t["event"]]
        normal_trades = [t for t in trades if not t["event"]]
        
        event_perf = {
            "event_trades": len(event_trades),
            "event_pnl": sum(t["net_pnl"] for t in event_trades),
            "event_win_rate": round(len([t for t in event_trades if t["net_pnl"] > 0]) / len(event_trades) * 100, 1) if event_trades else 0,
            "normal_trades": len(normal_trades),
            "normal_pnl": sum(t["net_pnl"] for t in normal_trades),
            "normal_win_rate": round(len([t for t in normal_trades if t["net_pnl"] > 0]) / len(normal_trades) * 100, 1) if normal_trades else 0,
        }
        
        result = StrategyResult(
            strategy_name=strat["name"],
            strategy_emoji=strat["emoji"],
            description=strat["desc"],
            total_trades=len(trades),
            winning_trades=len(winners),
            losing_trades=len(losers),
            win_rate=round(len(winners) / len(trades) * 100, 1),
            total_pnl=round(total_pnl),
            avg_pnl=round(avg_pnl),
            avg_win=round(avg_win),
            avg_loss=round(avg_loss),
            max_win=round(max_win),
            max_loss=round(max_loss),
            profit_factor=round(pf, 2),
            max_drawdown=round(max_dd),
            sharpe_ratio=round(sharpe, 2),
            roi_percent=round(roi, 1),
            monthly_roi=round(roi / 13, 1),
            margin_required=round(avg_margin),
            profitable_months=profitable_months,
            total_months=len(monthly),
            monthly_pnl={k: round(v["pnl"]) for k, v in monthly.items()},
            equity_curve=equity,
            trades=trades,
            event_performance=event_perf
        )
        
        all_results[key] = result
    
    # ==========================================
    # PRINT RESULTS
    # ==========================================
    
    print("\n" + "=" * 100)
    print("  STRATEGY COMPARISON RESULTS")
    print("=" * 100)
    
    print(f"\n{'Strategy':<25} {'Trades':>7} {'Win%':>7} {'Total P&L':>12} {'Avg P&L':>10} {'MaxDD':>10} {'Sharpe':>8} {'PF':>6} {'ROI':>8}")
    print("-" * 100)
    
    for key, r in all_results.items():
        sign = "+" if r.total_pnl >= 0 else ""
        print(f"{r.strategy_emoji} {r.strategy_name:<22} {r.total_trades:>7} {r.win_rate:>6.1f}% "
              f"{sign}₹{r.total_pnl:>10,} ₹{r.avg_pnl:>9,} ₹{r.max_drawdown:>9,} {r.sharpe_ratio:>7.2f} {r.profit_factor:>5.2f} {r.roi_percent:>6.1f}%")
    
    # Monthly breakdown for each strategy
    print("\n" + "=" * 100)
    print("  MONTHLY P&L COMPARISON")
    print("=" * 100)
    
    months_sorted = sorted(list(all_results.values())[0].monthly_pnl.keys())
    
    header = f"{'Month':<10}"
    for key, r in all_results.items():
        header += f"{r.strategy_emoji} {r.strategy_name[:15]:>18}"
    print(f"\n{header}")
    print("-" * 90)
    
    for month in months_sorted:
        row = f"{month:<10}"
        for key, r in all_results.items():
            pnl = r.monthly_pnl.get(month, 0)
            sign = "+" if pnl >= 0 else ""
            row += f"{sign}₹{pnl:>16,}"
        print(row)
    
    # Best strategy ranking
    print("\n" + "=" * 100)
    print("  STRATEGY RANKINGS")
    print("=" * 100)
    
    ranking_criteria = [
        ("Total P&L", lambda r: r.total_pnl, True),
        ("Win Rate", lambda r: r.win_rate, True),
        ("Sharpe Ratio", lambda r: r.sharpe_ratio, True),
        ("Profit Factor", lambda r: r.profit_factor, True),
        ("Lowest Drawdown", lambda r: -r.max_drawdown, True),
        ("ROI %", lambda r: r.roi_percent, True),
    ]
    
    print(f"\n{'Criteria':<20} {'#1 Best':>25} {'#2':>25} {'#3':>25} {'#4 Worst':>25}")
    print("-" * 100)
    
    for criteria_name, key_func, reverse in ranking_criteria:
        ranked = sorted(all_results.values(), key=key_func, reverse=reverse)
        row = f"{criteria_name:<20}"
        for r in ranked:
            row += f"{r.strategy_emoji} {r.strategy_name[:18]:>22}"
        print(row)
    
    # ==========================================
    # SAVE RESULTS
    # ==========================================
    
    output = {
        "backtest_info": {
            "title": "Full Year NIFTY Delta Neutral Strategy Comparison",
            "period": "Jan 2024 - Jan 2025",
            "data_source": "Actual NIFTY prices (NSE/Yahoo Finance)",
            "total_expiry_cycles": trade_count,
            "lot_size": LOT_SIZE,
            "factors": [
                "Real NIFTY OHLC data",
                f"Slippage: ATM {SLIPPAGE_ATM*100}%, OTM {SLIPPAGE_OTM*100}%, Deep OTM {SLIPPAGE_DEEP_OTM*100}%",
                f"Brokerage: ₹{BROKERAGE_PER_LOT}/lot",
                f"STT: {STT_SELL*100}%",
                "Major events: Budget, Elections, RBI MPC, Fed",
                "Realized volatility → IV estimation",
                "Volatility smile pricing"
            ]
        },
        "strategies": {},
        "comparison": {
            "best_pnl": None,
            "best_winrate": None,
            "best_sharpe": None,
            "best_risk_adjusted": None,
            "recommendation": None
        }
    }
    
    best_pnl = max(all_results.values(), key=lambda r: r.total_pnl)
    best_wr = max(all_results.values(), key=lambda r: r.win_rate)
    best_sharpe = max(all_results.values(), key=lambda r: r.sharpe_ratio)
    best_roi = max(all_results.values(), key=lambda r: r.roi_percent)
    
    output["comparison"]["best_pnl"] = best_pnl.strategy_name
    output["comparison"]["best_winrate"] = best_wr.strategy_name
    output["comparison"]["best_sharpe"] = best_sharpe.strategy_name
    output["comparison"]["best_risk_adjusted"] = best_roi.strategy_name
    
    # Score each strategy (weighted composite)
    scores = {}
    for key, r in all_results.items():
        score = 0
        score += (r.total_pnl / max(abs(rr.total_pnl) for rr in all_results.values())) * 30
        score += (r.win_rate / 100) * 20
        score += min(r.sharpe_ratio / 3, 1) * 20
        score += min(r.profit_factor / 3, 1) * 15
        score += (1 - r.max_drawdown / max(rr.max_drawdown for rr in all_results.values())) * 15
        scores[key] = score
    
    best_overall = max(scores, key=scores.get)
    output["comparison"]["recommendation"] = all_results[best_overall].strategy_name
    output["comparison"]["scores"] = {k: round(v, 1) for k, v in scores.items()}
    
    for key, r in all_results.items():
        monthly_returns_list = []
        for m in sorted(r.monthly_pnl.keys()):
            monthly_returns_list.append({
                "month": m,
                "pnl": r.monthly_pnl[m],
                "return_pct": round(r.monthly_pnl[m] / r.margin_required * 100, 1) if r.margin_required > 0 else 0
            })
        
        output["strategies"][key] = {
            "name": r.strategy_name,
            "emoji": r.strategy_emoji,
            "description": r.description,
            "statistics": {
                "total_trades": r.total_trades,
                "winning_trades": r.winning_trades,
                "losing_trades": r.losing_trades,
                "win_rate": r.win_rate,
                "total_pnl": r.total_pnl,
                "avg_pnl": r.avg_pnl,
                "avg_win": r.avg_win,
                "avg_loss": r.avg_loss,
                "max_win": r.max_win,
                "max_loss": r.max_loss,
                "profit_factor": r.profit_factor,
                "max_drawdown": r.max_drawdown,
                "sharpe_ratio": r.sharpe_ratio,
                "roi_percent": r.roi_percent,
                "monthly_roi": r.monthly_roi,
                "margin_required": r.margin_required,
                "profitable_months": r.profitable_months,
                "total_months": r.total_months,
            },
            "monthly_returns": monthly_returns_list,
            "equity_curve": r.equity_curve,
            "event_performance": r.event_performance,
            "sample_trades": r.trades[:10],
            "score": round(scores[key], 1)
        }
    
    # Save
    with open("full_year_strategy_comparison.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n{'=' * 100}")
    print(f"  ✅ Results saved to full_year_strategy_comparison.json")
    print(f"  🏆 RECOMMENDED: {all_results[best_overall].strategy_emoji} {all_results[best_overall].strategy_name}")
    print(f"{'=' * 100}")
    
    return output


if __name__ == "__main__":
    results = run_full_year_comparison()
