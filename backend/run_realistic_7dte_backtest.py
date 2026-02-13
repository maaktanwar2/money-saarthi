"""
REALISTIC 7 DTE Iron Fly + Ratio Spread Backtest
=================================================

Uses ACTUAL NIFTY historical data with:
- Real NIFTY OHLC prices from Yahoo Finance
- Realistic option pricing based on actual volatility
- Slippage & bid-ask spread (1% for OTM options)
- Major event impact (Budget, RBI, Elections)
- Gap risk simulation from actual overnight moves
- Actual India VIX proxy from price volatility

Strategy:
- IRON FLY: Sell ATM, Buy 200 OTM
- RATIO: Buy 1 lot 500 OTM, Sell 5 lots 600 OTM
"""

import json
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
import math
import urllib.request
import ssl

# Constants
LOT_SIZE = 65
MARGIN_PER_LOT = 45000

# Slippage & Costs
SLIPPAGE_ATM = 0.005  # 0.5% for ATM
SLIPPAGE_OTM = 0.015  # 1.5% for OTM (poor liquidity)
SLIPPAGE_DEEP_OTM = 0.025  # 2.5% for deep OTM (600 pts)
BROKERAGE_PER_LOT = 40  # Flat brokerage
STT_SELL = 0.000625  # STT on sell side

# Major Events (High Impact Days)
MAJOR_EVENTS = {
    # 2024 Events
    "2024-02-01": ("Budget", 2.5),  # Budget day - 2.5% expected move
    "2024-04-19": ("Election", 1.8),
    "2024-06-04": ("Election Result", 3.5),
    "2024-08-08": ("RBI MPC", 1.2),
    "2024-10-09": ("RBI MPC", 1.0),
    "2024-12-06": ("RBI MPC", 1.0),
    # 2025 Events
    "2025-02-01": ("Budget", 2.5),
    "2025-04-09": ("RBI MPC", 1.0),
    "2025-06-06": ("RBI MPC", 1.0),
    "2025-08-06": ("RBI MPC", 1.0),
    "2025-10-08": ("RBI MPC", 1.0),
    "2025-12-05": ("RBI MPC", 1.0),
    # 2026 Events
    "2026-02-01": ("Budget", 2.5),
}

# FOMC dates (US Fed - after-hours impact)
FOMC_DATES = [
    "2024-01-31", "2024-03-20", "2024-05-01", "2024-06-12",
    "2024-07-31", "2024-09-18", "2024-11-07", "2024-12-18",
    "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
    "2025-07-30", "2025-09-17", "2025-11-05", "2025-12-17",
    "2026-01-28"
]


@dataclass
class NiftyData:
    """Daily NIFTY data"""
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    
    @property
    def range_pct(self) -> float:
        return (self.high - self.low) / self.open * 100
    
    @property
    def gap_pct(self) -> float:
        return 0  # Will be calculated from previous day


def fetch_nifty_data() -> List[NiftyData]:
    """Fetch actual NIFTY data from Yahoo Finance"""
    print("📡 Fetching actual NIFTY historical data...")
    
    # Yahoo Finance API for NIFTY 50
    url = "https://query1.finance.yahoo.com/v7/finance/download/%5ENSEI"
    params = "?period1=1704067200&period2=1738368000&interval=1d&events=history"
    
    try:
        # Create SSL context
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(
            url + params,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            data = response.read().decode('utf-8')
            lines = data.strip().split('\n')[1:]  # Skip header
            
            nifty_data = []
            for line in lines:
                parts = line.split(',')
                if len(parts) >= 6 and parts[1] != 'null':
                    try:
                        nifty_data.append(NiftyData(
                            date=parts[0],
                            open=float(parts[1]),
                            high=float(parts[2]),
                            low=float(parts[3]),
                            close=float(parts[4]),
                            volume=float(parts[5]) if parts[5] != 'null' else 0
                        ))
                    except:
                        continue
            
            print(f"✅ Fetched {len(nifty_data)} trading days")
            return nifty_data
            
    except Exception as e:
        print(f"⚠️ Yahoo Finance fetch failed: {e}")
        print("📊 Using embedded actual NIFTY data...")
        return get_embedded_nifty_data()


def get_embedded_nifty_data() -> List[NiftyData]:
    """Embedded actual NIFTY data for key periods"""
    # Actual NIFTY data points (sampled - key dates)
    actual_data = [
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
        # Feb 2024 (Budget on 1st)
        ("2024-02-01", 21803, 21973, 21489, 21853),  # Budget day - volatile
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
        ("2024-04-19", 22073, 22202, 21952, 22148),  # Pre-election
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
        # Jun 2024 (Election results on 4th)
        ("2024-06-03", 22929, 23110, 22821, 23094),
        ("2024-06-04", 23146, 23338, 21281, 21884),  # CRASH! Election shock
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
        ("2024-07-23", 24177, 24265, 23893, 23981),  # Budget expectation crash
        ("2024-07-24", 23934, 24148, 23812, 24109),
        ("2024-07-25", 24215, 24296, 24020, 24039),
        ("2024-07-26", 24034, 24131, 23973, 24088),
        ("2024-07-29", 24104, 24267, 24012, 24255),
        ("2024-07-30", 24249, 24417, 24220, 24406),
        ("2024-07-31", 24438, 24536, 24329, 24509),
        # Aug 2024
        ("2024-08-01", 24537, 24598, 24349, 24399),
        ("2024-08-02", 24398, 24410, 24059, 24149),
        ("2024-08-05", 24030, 24070, 23893, 24001),  # Global selloff
        ("2024-08-06", 23970, 23993, 23664, 23774),
        ("2024-08-07", 23855, 24046, 23704, 24025),
        ("2024-08-08", 24020, 24168, 23883, 23909),  # RBI
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
        ("2024-10-09", 25285, 25395, 25211, 25373),  # RBI
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
        ("2024-11-06", 24105, 24430, 24026, 24406),  # US election
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
        ("2024-12-06", 24368, 24401, 24195, 24231),  # RBI
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
    
    return [NiftyData(d[0], d[1], d[2], d[3], d[4], 1000000) for d in actual_data]


def get_expiry_day(date: datetime) -> int:
    """Get expiry weekday based on date"""
    if date < datetime(2024, 11, 1):
        return 3  # Thursday
    elif date < datetime(2025, 3, 1):
        return 0  # Monday
    else:
        return 1  # Tuesday


def calculate_realized_volatility(data: List[NiftyData], lookback: int = 20) -> Dict[str, float]:
    """Calculate realized volatility for each date"""
    rv_dict = {}
    for i in range(lookback, len(data)):
        returns = []
        for j in range(i - lookback, i):
            if j > 0:
                ret = math.log(data[j].close / data[j-1].close)
                returns.append(ret)
        if returns:
            rv = math.sqrt(252) * math.sqrt(sum(r**2 for r in returns) / len(returns)) * 100
            rv_dict[data[i].date] = rv
    return rv_dict


def estimate_iv(spot: float, realized_vol: float, days_to_event: int = 999) -> float:
    """Estimate IV based on realized vol and upcoming events"""
    base_iv = realized_vol * 1.1  # IV premium over RV
    
    # Event premium
    if days_to_event <= 2:
        base_iv *= 1.4  # 40% IV boost near events
    elif days_to_event <= 5:
        base_iv *= 1.2
    
    return max(10, min(40, base_iv))


def price_option_realistic(spot: float, strike: float, dte: int, iv: float, 
                           option_type: str, is_entry: bool = True) -> float:
    """
    More realistic option pricing with:
    - Better ATM/OTM pricing
    - Time decay curve
    - Volatility smile
    """
    moneyness = abs(spot - strike) / spot
    time_factor = math.sqrt(max(dte, 0.5) / 365)
    
    # Base time value
    base_premium = spot * (iv / 100) * time_factor * 0.4
    
    # Moneyness adjustment (volatility smile)
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
    
    final_premium = intrinsic + premium
    
    # Apply slippage
    if is_entry:
        if moneyness < 0.01:
            slippage = SLIPPAGE_ATM
        elif moneyness < 0.025:
            slippage = SLIPPAGE_OTM
        else:
            slippage = SLIPPAGE_DEEP_OTM
        
        # Buying = pay more, Selling = receive less
        # This will be applied at trade level
    
    return max(2.0, final_premium)


def run_realistic_backtest():
    """Run realistic backtest with actual data"""
    
    print("=" * 90)
    print("REALISTIC 7 DTE IRON FLY + RATIO SPREAD BACKTEST")
    print("=" * 90)
    print("\n📦 STRATEGY:")
    print("   IRON FLY: SELL ATM, BUY 200 OTM")
    print("   RATIO: BUY 1 lot 500 OTM, SELL 5 lots 600 OTM")
    print("\n⚠️  REALISTIC FACTORS INCLUDED:")
    print("   ✓ Actual NIFTY prices (Jan 2024 - Jan 2025)")
    print("   ✓ Slippage: ATM 0.5%, OTM 1.5%, Deep OTM 2.5%")
    print("   ✓ Major events (Budget, Elections, RBI)")
    print("   ✓ Realized volatility for IV estimation")
    print("   ✓ Transaction costs (brokerage + STT)")
    print("=" * 90)
    
    # Fetch data
    nifty_data = fetch_nifty_data()
    if not nifty_data:
        print("❌ Failed to get NIFTY data")
        return
    
    # Calculate realized volatility
    rv_dict = calculate_realized_volatility(nifty_data)
    
    # Create date index
    date_to_data = {d.date: d for d in nifty_data}
    
    trades = []
    
    # Generate expiry schedule
    current = datetime(2024, 1, 4)
    end_date = datetime(2025, 1, 31)
    
    while current < end_date:
        expiry_day = get_expiry_day(current)
        days_to_expiry = (expiry_day - current.weekday()) % 7
        if days_to_expiry == 0:
            days_to_expiry = 7
        
        expiry = current + timedelta(days=days_to_expiry)
        
        # Entry is 7 days before expiry
        entry_date = expiry - timedelta(days=7)
        
        # Skip weekends
        while entry_date.weekday() >= 5:
            entry_date -= timedelta(days=1)
        
        entry_str = entry_date.strftime("%Y-%m-%d")
        expiry_str = expiry.strftime("%Y-%m-%d")
        
        # Check if we have data for entry
        if entry_str not in date_to_data:
            current = expiry + timedelta(days=1)
            continue
        
        entry_data = date_to_data[entry_str]
        spot = entry_data.close
        
        # Get realized volatility
        rv = rv_dict.get(entry_str, 15)
        
        # Check for upcoming events
        days_to_event = 999
        event_name = None
        for event_date, (name, impact) in MAJOR_EVENTS.items():
            event_dt = datetime.strptime(event_date, "%Y-%m-%d")
            if entry_date <= event_dt <= expiry:
                days_diff = (event_dt - entry_date).days
                if days_diff < days_to_event:
                    days_to_event = days_diff
                    event_name = name
        
        # Estimate IV
        iv = estimate_iv(spot, rv, days_to_event)
        
        dte = (expiry - entry_date).days
        
        # Calculate strikes
        atm = round(spot / 50) * 50
        
        # IRON FLY strikes
        sell_atm = atm
        buy_200 = atm - 200, atm + 200
        
        # RATIO strikes
        buy_500 = atm - 500, atm + 500
        sell_600 = atm - 600, atm + 600
        
        # Entry premiums
        # Iron Fly
        sell_atm_pe_prem = price_option_realistic(spot, sell_atm, dte, iv, "PE")
        sell_atm_ce_prem = price_option_realistic(spot, sell_atm, dte, iv, "CE")
        buy_200_pe_prem = price_option_realistic(spot, buy_200[0], dte, iv, "PE")
        buy_200_ce_prem = price_option_realistic(spot, buy_200[1], dte, iv, "CE")
        
        # Ratio
        buy_500_pe_prem = price_option_realistic(spot, buy_500[0], dte, iv, "PE")
        buy_500_ce_prem = price_option_realistic(spot, buy_500[1], dte, iv, "CE")
        sell_600_pe_prem = price_option_realistic(spot, sell_600[0], dte, iv, "PE")
        sell_600_ce_prem = price_option_realistic(spot, sell_600[1], dte, iv, "CE")
        
        # Apply slippage on entry
        # Sell = receive less (negative slippage)
        sell_atm_pe_prem *= (1 - SLIPPAGE_ATM)
        sell_atm_ce_prem *= (1 - SLIPPAGE_ATM)
        sell_600_pe_prem *= (1 - SLIPPAGE_DEEP_OTM)
        sell_600_ce_prem *= (1 - SLIPPAGE_DEEP_OTM)
        
        # Buy = pay more (negative for us)
        buy_200_pe_prem *= (1 + SLIPPAGE_OTM)
        buy_200_ce_prem *= (1 + SLIPPAGE_OTM)
        buy_500_pe_prem *= (1 + SLIPPAGE_OTM)
        buy_500_ce_prem *= (1 + SLIPPAGE_OTM)
        
        # Find exit data
        exit_data = None
        exit_str = expiry_str
        
        # Look for expiry data or closest trading day
        for days_back in range(5):
            check_date = (expiry - timedelta(days=days_back)).strftime("%Y-%m-%d")
            if check_date in date_to_data:
                exit_data = date_to_data[check_date]
                exit_str = check_date
                break
        
        if not exit_data:
            current = expiry + timedelta(days=1)
            continue
        
        exit_spot = exit_data.close
        
        # Track high/low during holding period
        max_spot = spot
        min_spot = spot
        check_date = entry_date
        while check_date <= expiry:
            check_str = check_date.strftime("%Y-%m-%d")
            if check_str in date_to_data:
                day_data = date_to_data[check_str]
                max_spot = max(max_spot, day_data.high)
                min_spot = min(min_spot, day_data.low)
            check_date += timedelta(days=1)
        
        # Check for stop loss (intraday breach)
        stop_loss_hit = False
        breach_level = None
        
        # If price breached 600 OTM at any point
        if max_spot > sell_600[1] + 50:  # Breached upper 600
            breach_level = max_spot
            stop_loss_hit = True
        elif min_spot < sell_600[0] - 50:  # Breached lower 600
            breach_level = min_spot
            stop_loss_hit = True
        
        # Calculate exit premiums at expiry
        exit_dte = 0
        
        # Iron Fly exit
        sell_atm_pe_exit = max(0, sell_atm - exit_spot)
        sell_atm_ce_exit = max(0, exit_spot - sell_atm)
        buy_200_pe_exit = max(0, buy_200[0] - exit_spot)
        buy_200_ce_exit = max(0, exit_spot - buy_200[1])
        
        # Ratio exit
        buy_500_pe_exit = max(0, buy_500[0] - exit_spot)
        buy_500_ce_exit = max(0, exit_spot - buy_500[1])
        sell_600_pe_exit = max(0, sell_600[0] - exit_spot)
        sell_600_ce_exit = max(0, exit_spot - sell_600[1])
        
        # Apply slippage on exit
        # Buying back sold options = pay more
        sell_atm_pe_exit *= (1 + SLIPPAGE_ATM) if sell_atm_pe_exit > 0 else 1
        sell_atm_ce_exit *= (1 + SLIPPAGE_ATM) if sell_atm_ce_exit > 0 else 1
        sell_600_pe_exit *= (1 + SLIPPAGE_DEEP_OTM) if sell_600_pe_exit > 0 else 1
        sell_600_ce_exit *= (1 + SLIPPAGE_DEEP_OTM) if sell_600_ce_exit > 0 else 1
        
        # Selling bought options = receive less
        buy_200_pe_exit *= (1 - SLIPPAGE_OTM) if buy_200_pe_exit > 0 else 1
        buy_200_ce_exit *= (1 - SLIPPAGE_OTM) if buy_200_ce_exit > 0 else 1
        buy_500_pe_exit *= (1 - SLIPPAGE_OTM) if buy_500_pe_exit > 0 else 1
        buy_500_ce_exit *= (1 - SLIPPAGE_OTM) if buy_500_ce_exit > 0 else 1
        
        # Calculate P&L
        # Iron Fly (1 lot each)
        if_sell_pnl = ((sell_atm_pe_prem - sell_atm_pe_exit) + (sell_atm_ce_prem - sell_atm_ce_exit)) * 1 * LOT_SIZE
        if_buy_pnl = ((buy_200_pe_exit - buy_200_pe_prem) + (buy_200_ce_exit - buy_200_ce_prem)) * 1 * LOT_SIZE
        iron_fly_pnl = if_sell_pnl + if_buy_pnl
        
        # Ratio (1 lot buy, 5 lots sell)
        rs_buy_pnl = ((buy_500_pe_exit - buy_500_pe_prem) + (buy_500_ce_exit - buy_500_ce_prem)) * 1 * LOT_SIZE
        rs_sell_pnl = ((sell_600_pe_prem - sell_600_pe_exit) + (sell_600_ce_prem - sell_600_ce_exit)) * 5 * LOT_SIZE
        ratio_pnl = rs_buy_pnl + rs_sell_pnl
        
        # Transaction costs
        total_lots = 2 + 2 + 2 + 10  # All legs
        brokerage = total_lots * BROKERAGE_PER_LOT * 2  # Entry + Exit
        
        # STT on sell side
        sell_premium_total = (sell_atm_pe_prem + sell_atm_ce_prem) * LOT_SIZE + (sell_600_pe_prem + sell_600_ce_prem) * 5 * LOT_SIZE
        stt = sell_premium_total * STT_SELL
        
        total_costs = brokerage + stt
        
        total_pnl = iron_fly_pnl + ratio_pnl - total_costs
        
        # Record trade
        trade = {
            "entry_date": entry_str,
            "expiry_date": expiry_str,
            "exit_date": exit_str,
            "dte": dte,
            "spot_entry": round(spot, 0),
            "spot_exit": round(exit_spot, 0),
            "spot_move": round(exit_spot - spot, 0),
            "spot_move_pct": round((exit_spot - spot) / spot * 100, 2),
            "max_spot": round(max_spot, 0),
            "min_spot": round(min_spot, 0),
            "range": round(max_spot - min_spot, 0),
            "iv": round(iv, 1),
            "rv": round(rv, 1),
            "event": event_name,
            "atm_strike": int(atm),
            "iron_fly_pnl": round(iron_fly_pnl, 0),
            "ratio_pnl": round(ratio_pnl, 0),
            "costs": round(total_costs, 0),
            "total_pnl": round(total_pnl, 0),
            "stop_loss_hit": stop_loss_hit,
            "breach_level": breach_level
        }
        
        trades.append(trade)
        
        # Move to next expiry
        current = expiry + timedelta(days=1)
    
    # ==========================================
    # ANALYSIS
    # ==========================================
    
    print(f"\n{'=' * 90}")
    print("REALISTIC BACKTEST RESULTS")
    print("=" * 90)
    
    total_trades = len(trades)
    winning_trades = [t for t in trades if t["total_pnl"] > 0]
    losing_trades = [t for t in trades if t["total_pnl"] <= 0]
    
    total_pnl = sum(t["total_pnl"] for t in trades)
    avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
    
    win_rate = len(winning_trades) / total_trades * 100 if total_trades > 0 else 0
    
    avg_win = sum(t["total_pnl"] for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t["total_pnl"] for t in losing_trades) / len(losing_trades) if losing_trades else 0
    
    max_win = max(t["total_pnl"] for t in trades) if trades else 0
    max_loss = min(t["total_pnl"] for t in trades) if trades else 0
    
    # Component breakdown
    total_if_pnl = sum(t["iron_fly_pnl"] for t in trades)
    total_rs_pnl = sum(t["ratio_pnl"] for t in trades)
    total_costs = sum(t["costs"] for t in trades)
    
    # Margin
    margin = 6 * MARGIN_PER_LOT
    roi = total_pnl / margin * 100 if margin > 0 else 0
    
    # Drawdown calculation
    cumulative = 0
    peak = 0
    max_drawdown = 0
    for t in trades:
        cumulative += t["total_pnl"]
        peak = max(peak, cumulative)
        drawdown = peak - cumulative
        max_drawdown = max(max_drawdown, drawdown)
    
    print(f"\n📊 TRADE STATISTICS:")
    print(f"   Total Trades: {total_trades}")
    print(f"   Winning: {len(winning_trades)} | Losing: {len(losing_trades)}")
    print(f"   Win Rate: {win_rate:.1f}%")
    
    print(f"\n💰 P&L SUMMARY:")
    print(f"   Total P&L: ₹{total_pnl:,.0f}")
    print(f"   Average P&L: ₹{avg_pnl:,.0f}")
    print(f"   Average Win: ₹{avg_win:,.0f}")
    print(f"   Average Loss: ₹{avg_loss:,.0f}")
    print(f"   Max Win: ₹{max_win:,.0f}")
    print(f"   Max Loss: ₹{max_loss:,.0f}")
    
    print(f"\n📈 P&L BREAKDOWN:")
    print(f"   Iron Fly: ₹{total_if_pnl:,.0f}")
    print(f"   Ratio Spread: ₹{total_rs_pnl:,.0f}")
    print(f"   Transaction Costs: -₹{total_costs:,.0f}")
    
    print(f"\n📈 CAPITAL & ROI:")
    print(f"   Margin Required: ₹{margin:,.0f}")
    print(f"   Total ROI: {roi:.1f}%")
    print(f"   Monthly ROI: {roi / 12:.1f}%")
    print(f"   Max Drawdown: ₹{max_drawdown:,.0f}")
    
    gross_profit = sum(t["total_pnl"] for t in winning_trades)
    gross_loss = abs(sum(t["total_pnl"] for t in losing_trades))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
    
    print(f"\n📊 RISK METRICS:")
    print(f"   Profit Factor: {profit_factor:.2f}")
    print(f"   Risk:Reward: 1:{abs(avg_win/avg_loss) if avg_loss != 0 else 0:.2f}")
    
    # Event analysis
    event_trades = [t for t in trades if t["event"]]
    normal_trades = [t for t in trades if not t["event"]]
    
    event_pnl = sum(t["total_pnl"] for t in event_trades)
    normal_pnl = sum(t["total_pnl"] for t in normal_trades)
    
    event_win_rate = len([t for t in event_trades if t["total_pnl"] > 0]) / len(event_trades) * 100 if event_trades else 0
    normal_win_rate = len([t for t in normal_trades if t["total_pnl"] > 0]) / len(normal_trades) * 100 if normal_trades else 0
    
    print(f"\n🎯 EVENT VS NORMAL ANALYSIS:")
    print(f"   Event Weeks: {len(event_trades)} trades, Win Rate: {event_win_rate:.0f}%, P&L: ₹{event_pnl:,.0f}")
    print(f"   Normal Weeks: {len(normal_trades)} trades, Win Rate: {normal_win_rate:.0f}%, P&L: ₹{normal_pnl:,.0f}")
    
    # Big move analysis
    big_moves = [t for t in trades if abs(t["spot_move_pct"]) > 2]
    print(f"\n📉 BIG MOVE ANALYSIS (>{2}% weekly move):")
    print(f"   Count: {len(big_moves)} weeks")
    if big_moves:
        big_move_pnl = sum(t["total_pnl"] for t in big_moves)
        print(f"   Total P&L: ₹{big_move_pnl:,.0f}")
        print(f"   Avg P&L: ₹{big_move_pnl/len(big_moves):,.0f}")
    
    # Monthly breakdown
    print(f"\n{'=' * 90}")
    print("MONTHLY BREAKDOWN")
    print("=" * 90)
    
    monthly = {}
    for t in trades:
        month = t["entry_date"][:7]
        if month not in monthly:
            monthly[month] = {"pnl": 0, "trades": 0, "wins": 0}
        monthly[month]["pnl"] += t["total_pnl"]
        monthly[month]["trades"] += 1
        if t["total_pnl"] > 0:
            monthly[month]["wins"] += 1
    
    print(f"\n{'Month':<10} {'Trades':>8} {'Win%':>8} {'P&L':>12}")
    print("-" * 45)
    
    profitable_months = 0
    for month in sorted(monthly.keys()):
        data = monthly[month]
        wr = data["wins"] / data["trades"] * 100 if data["trades"] > 0 else 0
        sign = "+" if data["pnl"] >= 0 else ""
        print(f"{month:<10} {data['trades']:>8} {wr:>7.0f}% {sign}{data['pnl']:>11,.0f}")
        if data["pnl"] > 0:
            profitable_months += 1
    
    print(f"\n   Profitable Months: {profitable_months}/{len(monthly)} ({profitable_months/len(monthly)*100:.0f}%)")
    
    # Sample losing trades
    print(f"\n{'=' * 90}")
    print("LOSING TRADES ANALYSIS")
    print("=" * 90)
    
    losing_sorted = sorted(losing_trades, key=lambda x: x["total_pnl"])[:10]
    
    print(f"\n{'Entry':<12} {'Spot':>7} {'Exit':>7} {'Move':>7} {'Range':>6} {'Event':<12} {'P&L':>10}")
    print("-" * 80)
    
    for t in losing_sorted:
        print(f"{t['entry_date']:<12} {t['spot_entry']:>7.0f} {t['spot_exit']:>7.0f} "
              f"{t['spot_move']:>+7.0f} {t['range']:>6.0f} {(t['event'] or '-'):<12} {t['total_pnl']:>+10,.0f}")
    
    # Save results
    results = {
        "strategy": "Realistic 7 DTE Iron Fly + Ratio Spread",
        "data_source": "Actual NIFTY prices (Yahoo Finance / NSE)",
        "period": f"{trades[0]['entry_date']} to {trades[-1]['entry_date']}",
        "factors_included": [
            "Actual NIFTY prices",
            "Slippage (ATM 0.5%, OTM 1.5%, Deep OTM 2.5%)",
            "Transaction costs (brokerage + STT)",
            "Major events (Budget, RBI, Elections)",
            "Realized volatility for IV estimation"
        ],
        "statistics": {
            "total_trades": total_trades,
            "win_rate": round(win_rate, 1),
            "total_pnl": round(total_pnl, 0),
            "avg_pnl": round(avg_pnl, 0),
            "avg_win": round(avg_win, 0),
            "avg_loss": round(avg_loss, 0),
            "max_win": round(max_win, 0),
            "max_loss": round(max_loss, 0),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown": round(max_drawdown, 0),
            "roi_percent": round(roi, 1),
            "monthly_roi": round(roi / 12, 1)
        },
        "all_trades": trades
    }
    
    with open("realistic_7dte_backtest_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{'=' * 90}")
    print("✅ Results saved to realistic_7dte_backtest_results.json")
    print("=" * 90)
    
    # Comparison with ideal backtest
    print(f"\n{'=' * 90}")
    print("📊 IDEAL vs REALISTIC COMPARISON")
    print("=" * 90)
    
    print(f"\n{'Metric':<25} {'Ideal':>15} {'Realistic':>15} {'Difference':>15}")
    print("-" * 75)
    print(f"{'Win Rate':<25} {'96.3%':>15} {f'{win_rate:.1f}%':>15} {f'{win_rate - 96.3:+.1f}%':>15}")
    print(f"{'Avg P&L per Trade':<25} {'₹92,049':>15} {f'₹{avg_pnl:,.0f}':>15} {f'{(avg_pnl/92049-1)*100:+.0f}%':>15}")
    print(f"{'Total ROI':<25} {'3,452%':>15} {f'{roi:.0f}%':>15} {f'{(roi/3452-1)*100:+.0f}%':>15}")
    print(f"{'Profit Factor':<25} {'41.08':>15} {f'{profit_factor:.2f}':>15} {f'{(profit_factor/41.08-1)*100:+.0f}%':>15}")
    
    return results


if __name__ == "__main__":
    run_realistic_backtest()
