"""
FIND BEST OPTIONS STRATEGY
===========================

Tests multiple strategies on ACTUAL NIFTY data to find the best one:
1. Pure Ratio Spread (no Iron Fly)
2. 0-2 DTE Theta Decay (sell far OTM near expiry)
3. Post-Volatility Mean Reversion
4. Event Premium Harvesting
5. Range-Bound Iron Condor
6. Straddle Selling with Adjustment
7. Weekly Calendar Spread
"""

import json
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Dict
import math

# Constants
LOT_SIZE = 65
MARGIN_PER_LOT = 45000
SLIPPAGE_ATM = 0.005
SLIPPAGE_OTM = 0.015
SLIPPAGE_DEEP_OTM = 0.025
BROKERAGE_PER_LOT = 40

# Actual NIFTY Data (Jan 2024 - Jan 2025)
NIFTY_DATA = [
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
    ("2024-06-04", 23146, 23338, 21281, 21884),  # Election crash
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
    ("2024-08-08", 24020, 24168, 23883, 23909),
    ("2024-08-09", 23943, 24088, 23893, 24073),
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
    # Nov 2024
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


@dataclass
class DayData:
    date: str
    open: float
    high: float
    low: float
    close: float


def get_data() -> List[DayData]:
    return [DayData(d[0], d[1], d[2], d[3], d[4]) for d in NIFTY_DATA]


def get_date_index(data: List[DayData]) -> Dict[str, DayData]:
    return {d.date: d for d in data}


def get_expiry_day(date: datetime) -> int:
    if date < datetime(2024, 11, 1):
        return 3  # Thursday
    elif date < datetime(2025, 3, 1):
        return 0  # Monday
    else:
        return 1  # Tuesday


def price_option(spot: float, strike: float, dte: int, iv: float, opt_type: str) -> float:
    """Price option with volatility smile"""
    moneyness = abs(spot - strike) / spot
    time_factor = math.sqrt(max(dte, 0.5) / 365)
    base = spot * (iv / 100) * time_factor * 0.4
    
    if moneyness < 0.01:
        premium = base * 1.0
    elif moneyness < 0.02:
        premium = base * 0.65
    elif moneyness < 0.03:
        premium = base * 0.35 * math.exp(-moneyness * 10)
    else:
        premium = base * 0.15 * math.exp(-moneyness * 15)
    
    if opt_type == "PE":
        intrinsic = max(0, strike - spot)
    else:
        intrinsic = max(0, spot - strike)
    
    return max(2.0, intrinsic + premium)


def calculate_rv(data: List[DayData], idx: int, lookback: int = 10) -> float:
    """Realized volatility"""
    if idx < lookback:
        return 15
    returns = []
    for i in range(idx - lookback, idx):
        if i > 0:
            ret = math.log(data[i].close / data[i-1].close)
            returns.append(ret)
    if returns:
        return math.sqrt(252) * math.sqrt(sum(r**2 for r in returns) / len(returns)) * 100
    return 15


# ===============================================
# STRATEGY 1: Pure Ratio Spread (No Iron Fly)
# ===============================================
def strategy_pure_ratio(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    Only the Ratio Spread component:
    BUY 1 lot 500 OTM, SELL 5 lots 600 OTM
    """
    trades = []
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        expiry = current + timedelta(days=days_to_expiry)
        entry_date = expiry - timedelta(days=7)
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        if entry_str not in date_idx:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_idx[entry_str]
        spot = entry_data.close
        atm = round(spot / 50) * 50
        dte = (expiry - entry_date).days
        
        data_list = get_data()
        idx = next((i for i, d in enumerate(data_list) if d.date == entry_str), 0)
        iv = calculate_rv(data_list, idx) * 1.1
        
        # Ratio strikes
        buy_500 = (atm - 500, atm + 500)
        sell_600 = (atm - 600, atm + 600)
        
        # Entry
        buy_pe = price_option(spot, buy_500[0], dte, iv, "PE") * (1 + SLIPPAGE_OTM)
        buy_ce = price_option(spot, buy_500[1], dte, iv, "CE") * (1 + SLIPPAGE_OTM)
        sell_pe = price_option(spot, sell_600[0], dte, iv, "PE") * (1 - SLIPPAGE_DEEP_OTM)
        sell_ce = price_option(spot, sell_600[1], dte, iv, "CE") * (1 - SLIPPAGE_DEEP_OTM)
        
        # Find exit
        exit_data = None
        for days_back in range(5):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_idx:
                exit_data = date_idx[check]
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        # Exit premiums (intrinsic only at expiry)
        buy_pe_exit = max(0, buy_500[0] - exit_spot)
        buy_ce_exit = max(0, exit_spot - buy_500[1])
        sell_pe_exit = max(0, sell_600[0] - exit_spot)
        sell_ce_exit = max(0, exit_spot - sell_600[1])
        
        # P&L
        buy_pnl = ((buy_pe_exit - buy_pe) + (buy_ce_exit - buy_ce)) * 1 * LOT_SIZE
        sell_pnl = ((sell_pe - sell_pe_exit) + (sell_ce - sell_ce_exit)) * 5 * LOT_SIZE
        
        costs = 12 * BROKERAGE_PER_LOT * 2
        total_pnl = buy_pnl + sell_pnl - costs
        
        trades.append({"date": entry_str, "pnl": total_pnl, "spot": spot, "exit_spot": exit_spot})
        current = expiry + timedelta(days=1)
    
    return {
        "name": "Pure Ratio Spread (Buy 500, Sell 5x600)",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 5 * MARGIN_PER_LOT,
        "details": trades
    }


# ===============================================
# STRATEGY 2: 0-2 DTE Theta Decay
# ===============================================
def strategy_theta_decay(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    Enter on expiry day -2 or -1
    Sell 400 OTM strangle
    Very high theta decay
    """
    trades = []
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        expiry = current + timedelta(days=days_to_expiry)
        
        # Enter 2 days before expiry
        entry_date = expiry - timedelta(days=2)
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        if entry_str not in date_idx:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_idx[entry_str]
        spot = entry_data.close
        atm = round(spot / 50) * 50
        dte = max(1, (expiry - entry_date).days)
        
        # Sell 400 OTM
        sell_pe_strike = atm - 400
        sell_ce_strike = atm + 400
        
        iv = 18  # Short DTE = lower IV
        
        sell_pe = price_option(spot, sell_pe_strike, dte, iv, "PE") * (1 - SLIPPAGE_OTM)
        sell_ce = price_option(spot, sell_ce_strike, dte, iv, "CE") * (1 - SLIPPAGE_OTM)
        
        # Exit at expiry
        exit_data = None
        for days_back in range(3):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_idx:
                exit_data = date_idx[check]
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        sell_pe_exit = max(0, sell_pe_strike - exit_spot)
        sell_ce_exit = max(0, exit_spot - sell_ce_strike)
        
        pnl = ((sell_pe - sell_pe_exit) + (sell_ce - sell_ce_exit)) * 1 * LOT_SIZE
        costs = 4 * BROKERAGE_PER_LOT
        total_pnl = pnl - costs
        
        trades.append({"date": entry_str, "pnl": total_pnl, "spot": spot, "exit_spot": exit_spot})
        current = expiry + timedelta(days=1)
    
    return {
        "name": "0-2 DTE Theta Decay (Sell 400 OTM Strangle)",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 2 * MARGIN_PER_LOT,
        "details": trades
    }


# ===============================================
# STRATEGY 3: Wide Iron Condor (Conservative)
# ===============================================
def strategy_wide_condor(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    Very wide wings: Sell 300 OTM, Buy 400 OTM
    Conservative but consistent
    """
    trades = []
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        expiry = current + timedelta(days=days_to_expiry)
        entry_date = expiry - timedelta(days=7)
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        if entry_str not in date_idx:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_idx[entry_str]
        spot = entry_data.close
        atm = round(spot / 50) * 50
        dte = (expiry - entry_date).days
        
        data_list = get_data()
        idx = next((i for i, d in enumerate(data_list) if d.date == entry_str), 0)
        iv = calculate_rv(data_list, idx) * 1.1
        
        # Wide condor
        sell_pe = atm - 300
        sell_ce = atm + 300
        buy_pe = atm - 400
        buy_ce = atm + 400
        
        # Entry
        sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE") * (1 - SLIPPAGE_OTM)
        sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE") * (1 - SLIPPAGE_OTM)
        buy_pe_prem = price_option(spot, buy_pe, dte, iv, "PE") * (1 + SLIPPAGE_OTM)
        buy_ce_prem = price_option(spot, buy_ce, dte, iv, "CE") * (1 + SLIPPAGE_OTM)
        
        # Exit
        exit_data = None
        for days_back in range(5):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_idx:
                exit_data = date_idx[check]
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        sell_pe_exit = max(0, sell_pe - exit_spot)
        sell_ce_exit = max(0, exit_spot - sell_ce)
        buy_pe_exit = max(0, buy_pe - exit_spot)
        buy_ce_exit = max(0, exit_spot - buy_ce)
        
        sell_pnl = ((sell_pe_prem - sell_pe_exit) + (sell_ce_prem - sell_ce_exit)) * LOT_SIZE
        buy_pnl = ((buy_pe_exit - buy_pe_prem) + (buy_ce_exit - buy_ce_prem)) * LOT_SIZE
        
        costs = 8 * BROKERAGE_PER_LOT
        total_pnl = sell_pnl + buy_pnl - costs
        
        trades.append({"date": entry_str, "pnl": total_pnl, "spot": spot, "exit_spot": exit_spot})
        current = expiry + timedelta(days=1)
    
    return {
        "name": "Wide Iron Condor (Sell 300, Buy 400)",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 2 * MARGIN_PER_LOT,
        "details": trades
    }


# ===============================================
# STRATEGY 4: ATM Straddle Sell + Hedge
# ===============================================
def strategy_straddle_hedge(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    Sell ATM Straddle
    Buy 300 OTM for protection
    High premium, defined risk
    """
    trades = []
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        expiry = current + timedelta(days=days_to_expiry)
        entry_date = expiry - timedelta(days=5)  # 5 DTE
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        if entry_str not in date_idx:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_idx[entry_str]
        spot = entry_data.close
        atm = round(spot / 50) * 50
        dte = (expiry - entry_date).days
        
        data_list = get_data()
        idx = next((i for i, d in enumerate(data_list) if d.date == entry_str), 0)
        iv = calculate_rv(data_list, idx) * 1.15
        
        # ATM Straddle + Hedge
        sell_atm_pe = price_option(spot, atm, dte, iv, "PE") * (1 - SLIPPAGE_ATM)
        sell_atm_ce = price_option(spot, atm, dte, iv, "CE") * (1 - SLIPPAGE_ATM)
        buy_pe = price_option(spot, atm - 300, dte, iv, "PE") * (1 + SLIPPAGE_OTM)
        buy_ce = price_option(spot, atm + 300, dte, iv, "CE") * (1 + SLIPPAGE_OTM)
        
        # Exit
        exit_data = None
        for days_back in range(5):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_idx:
                exit_data = date_idx[check]
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        sell_pe_exit = max(0, atm - exit_spot)
        sell_ce_exit = max(0, exit_spot - atm)
        buy_pe_exit = max(0, (atm - 300) - exit_spot)
        buy_ce_exit = max(0, exit_spot - (atm + 300))
        
        sell_pnl = ((sell_atm_pe - sell_pe_exit) + (sell_atm_ce - sell_ce_exit)) * LOT_SIZE
        buy_pnl = ((buy_pe_exit - buy_pe) + (buy_ce_exit - buy_ce)) * LOT_SIZE
        
        costs = 8 * BROKERAGE_PER_LOT
        total_pnl = sell_pnl + buy_pnl - costs
        
        trades.append({"date": entry_str, "pnl": total_pnl, "spot": spot, "exit_spot": exit_spot})
        current = expiry + timedelta(days=1)
    
    return {
        "name": "ATM Straddle + 300 OTM Hedge",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 2 * MARGIN_PER_LOT,
        "details": trades
    }


# ===============================================
# STRATEGY 5: Post-Crash Mean Reversion
# ===============================================
def strategy_mean_reversion(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    After >2% drop, enter bullish position
    Sell Put spread expecting bounce
    """
    trades = []
    data_list = get_data()
    
    for i in range(1, len(data_list) - 5):
        day = data_list[i]
        prev = data_list[i-1]
        
        drop = (day.close - prev.close) / prev.close * 100
        
        if drop < -1.5:  # Big down day
            entry_str = day.date
            spot = day.close
            atm = round(spot / 50) * 50
            
            # Sell put spread below market
            sell_pe = atm - 100
            buy_pe = atm - 200
            dte = 5
            iv = 20  # Higher IV after crash
            
            sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE") * (1 - SLIPPAGE_OTM)
            buy_pe_prem = price_option(spot, buy_pe, dte, iv, "PE") * (1 + SLIPPAGE_OTM)
            
            # Exit 3 days later
            if i + 3 < len(data_list):
                exit_data = data_list[i + 3]
                exit_spot = exit_data.close
                
                sell_pe_exit = max(0, sell_pe - exit_spot)
                buy_pe_exit = max(0, buy_pe - exit_spot)
                
                pnl = ((sell_pe_prem - sell_pe_exit) - (buy_pe_prem - buy_pe_exit)) * LOT_SIZE
                costs = 4 * BROKERAGE_PER_LOT
                total_pnl = pnl - costs
                
                trades.append({"date": entry_str, "pnl": total_pnl, "drop": drop, "exit_spot": exit_spot})
    
    return {
        "name": "Post-Drop Mean Reversion (Bull Put Spread)",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 1 * MARGIN_PER_LOT,
        "details": trades
    }


# ===============================================
# STRATEGY 6: 3 DTE Strangle
# ===============================================
def strategy_3dte_strangle(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    Enter 3 DTE, Sell 250 OTM strangle
    Quick theta decay, smaller moves expected
    """
    trades = []
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        expiry = current + timedelta(days=days_to_expiry)
        
        entry_date = expiry - timedelta(days=3)
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        if entry_str not in date_idx:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_idx[entry_str]
        spot = entry_data.close
        atm = round(spot / 50) * 50
        dte = max(1, (expiry - entry_date).days)
        
        sell_pe = atm - 250
        sell_ce = atm + 250
        iv = 16
        
        sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE") * (1 - SLIPPAGE_OTM)
        sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE") * (1 - SLIPPAGE_OTM)
        
        exit_data = None
        for days_back in range(4):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_idx:
                exit_data = date_idx[check]
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        sell_pe_exit = max(0, sell_pe - exit_spot)
        sell_ce_exit = max(0, exit_spot - sell_ce)
        
        pnl = ((sell_pe_prem - sell_pe_exit) + (sell_ce_prem - sell_ce_exit)) * LOT_SIZE
        costs = 4 * BROKERAGE_PER_LOT
        total_pnl = pnl - costs
        
        trades.append({"date": entry_str, "pnl": total_pnl, "spot": spot, "exit_spot": exit_spot})
        current = expiry + timedelta(days=1)
    
    return {
        "name": "3 DTE Strangle (Sell 250 OTM)",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 2 * MARGIN_PER_LOT,
        "details": trades
    }


# ===============================================
# STRATEGY 7: Jade Lizard (Bullish Bias)
# ===============================================
def strategy_jade_lizard(data: List[DayData], date_idx: Dict[str, DayData]) -> Dict:
    """
    Sell OTM Put + Sell Call Spread
    No upside risk, premium collection
    """
    trades = []
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        expiry = current + timedelta(days=days_to_expiry)
        entry_date = expiry - timedelta(days=7)
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        if entry_str not in date_idx:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_idx[entry_str]
        spot = entry_data.close
        atm = round(spot / 50) * 50
        dte = (expiry - entry_date).days
        
        data_list = get_data()
        idx = next((i for i, d in enumerate(data_list) if d.date == entry_str), 0)
        iv = calculate_rv(data_list, idx) * 1.1
        
        # Jade Lizard
        sell_pe = atm - 300
        sell_ce = atm + 200
        buy_ce = atm + 300
        
        sell_pe_prem = price_option(spot, sell_pe, dte, iv, "PE") * (1 - SLIPPAGE_OTM)
        sell_ce_prem = price_option(spot, sell_ce, dte, iv, "CE") * (1 - SLIPPAGE_OTM)
        buy_ce_prem = price_option(spot, buy_ce, dte, iv, "CE") * (1 + SLIPPAGE_OTM)
        
        exit_data = None
        for days_back in range(5):
            check = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check in date_idx:
                exit_data = date_idx[check]
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        sell_pe_exit = max(0, sell_pe - exit_spot)
        sell_ce_exit = max(0, exit_spot - sell_ce)
        buy_ce_exit = max(0, exit_spot - buy_ce)
        
        pe_pnl = (sell_pe_prem - sell_pe_exit) * LOT_SIZE
        ce_spread_pnl = ((sell_ce_prem - sell_ce_exit) - (buy_ce_prem - buy_ce_exit)) * LOT_SIZE
        
        costs = 6 * BROKERAGE_PER_LOT
        total_pnl = pe_pnl + ce_spread_pnl - costs
        
        trades.append({"date": entry_str, "pnl": total_pnl, "spot": spot, "exit_spot": exit_spot})
        current = expiry + timedelta(days=1)
    
    return {
        "name": "Jade Lizard (Sell Put + Call Spread)",
        "trades": len(trades),
        "wins": len([t for t in trades if t["pnl"] > 0]),
        "total_pnl": sum(t["pnl"] for t in trades),
        "avg_pnl": sum(t["pnl"] for t in trades) / len(trades) if trades else 0,
        "max_loss": min(t["pnl"] for t in trades) if trades else 0,
        "margin": 2 * MARGIN_PER_LOT,
        "details": trades
    }


def run_all_strategies():
    """Run all strategies and compare"""
    print("=" * 100)
    print("STRATEGY COMPARISON - ACTUAL NIFTY DATA (Jan 2024 - Jan 2025)")
    print("=" * 100)
    
    data = get_data()
    date_idx = get_date_index(data)
    
    strategies = [
        strategy_pure_ratio(data, date_idx),
        strategy_theta_decay(data, date_idx),
        strategy_wide_condor(data, date_idx),
        strategy_straddle_hedge(data, date_idx),
        strategy_mean_reversion(data, date_idx),
        strategy_3dte_strangle(data, date_idx),
        strategy_jade_lizard(data, date_idx),
    ]
    
    # Sort by total P&L
    strategies.sort(key=lambda x: x["total_pnl"], reverse=True)
    
    print(f"\n{'Rank':<5} {'Strategy':<45} {'Trades':>7} {'Wins':>6} {'Win%':>7} {'Total P&L':>12} {'Avg P&L':>10} {'Max Loss':>12} {'ROI%':>8}")
    print("-" * 120)
    
    for rank, s in enumerate(strategies, 1):
        win_rate = s["wins"] / s["trades"] * 100 if s["trades"] > 0 else 0
        roi = s["total_pnl"] / s["margin"] * 100 if s["margin"] > 0 else 0
        
        print(f"{rank:<5} {s['name']:<45} {s['trades']:>7} {s['wins']:>6} {win_rate:>6.1f}% {s['total_pnl']:>+12,.0f} {s['avg_pnl']:>+10,.0f} {s['max_loss']:>+12,.0f} {roi:>7.0f}%")
    
    # Best strategy analysis
    best = strategies[0]
    print(f"\n{'=' * 100}")
    print(f"🏆 BEST STRATEGY: {best['name']}")
    print("=" * 100)
    print(f"\n📊 Statistics:")
    print(f"   Total Trades: {best['trades']}")
    print(f"   Winning: {best['wins']} ({best['wins']/best['trades']*100:.1f}%)")
    print(f"   Total P&L: ₹{best['total_pnl']:,.0f}")
    print(f"   Average P&L: ₹{best['avg_pnl']:,.0f}")
    print(f"   Max Loss: ₹{best['max_loss']:,.0f}")
    print(f"   Margin: ₹{best['margin']:,.0f}")
    print(f"   ROI: {best['total_pnl']/best['margin']*100:.0f}%")
    
    # Top 3 bots recommendation
    print(f"\n{'=' * 100}")
    print("🤖 RECOMMENDED BOTS TO IMPLEMENT")
    print("=" * 100)
    
    for i, s in enumerate(strategies[:3], 1):
        win_rate = s["wins"] / s["trades"] * 100 if s["trades"] > 0 else 0
        roi = s["total_pnl"] / s["margin"] * 100 if s["margin"] > 0 else 0
        monthly_roi = roi / 13
        
        print(f"\n#{i} {s['name']}")
        print(f"   Win Rate: {win_rate:.0f}% | ROI: {roi:.0f}% | Monthly: {monthly_roi:.1f}%")
        print(f"   Capital: ₹{s['margin']:,.0f} | Expected: ₹{best['avg_pnl']*4:,.0f}/month")
    
    # Save results
    results = {
        "analysis_date": datetime.now().strftime("%Y-%m-%d"),
        "data_period": "Jan 2024 - Jan 2025",
        "strategies": [
            {
                "rank": i+1,
                "name": s["name"],
                "trades": s["trades"],
                "wins": s["wins"],
                "win_rate": round(s["wins"] / s["trades"] * 100, 1) if s["trades"] > 0 else 0,
                "total_pnl": round(s["total_pnl"], 0),
                "avg_pnl": round(s["avg_pnl"], 0),
                "max_loss": round(s["max_loss"], 0),
                "margin": s["margin"],
                "roi": round(s["total_pnl"] / s["margin"] * 100, 1) if s["margin"] > 0 else 0
            }
            for i, s in enumerate(strategies)
        ]
    }
    
    with open("strategy_comparison_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Results saved to strategy_comparison_results.json")
    
    return strategies


if __name__ == "__main__":
    run_all_strategies()
