import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge } from '../components/ui';
import { formatINR, fetchAPI } from '../lib/utils';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════════
// LTP CALCULATOR - Advanced P&L Calculator + Live Option Chain + COA + Trade Finder
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'calculator', label: '🧮 P&L Calculator', desc: 'Position P&L & Breakeven' },
  { id: 'optionchain', label: '📊 Option Chain', desc: 'Live OI Analysis & Charts' },
  { id: 'coa', label: '📈 COA Analysis', desc: '9 Scenario Framework' },
  { id: 'strategy', label: '🎯 Trade Finder', desc: 'Auto Strategy Suggestions' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Transform backend option chain API response to frontend table format */
const transformOptionChainData = (apiData, spot) => {
  if (!apiData?.data?.length) return [];
  const strikeStep = apiData.symbol === 'BANKNIFTY' ? 100 : 50;
  return apiData.data.map(item => {
    const strike = item.strikePrice;
    const dist = Math.abs(strike - spot);
    return {
      strike,
      isATM: dist < strikeStep / 2,
      isITMCall: strike < spot,
      isITMPut: strike > spot,
      call: {
        oi: item.CE?.openInterest || 0,
        oiChange: item.CE?.changeinOpenInterest || 0,
        volume: item.CE?.totalTradedVolume || 0,
        iv: (item.CE?.impliedVolatility || 0).toFixed(1),
        ltp: (item.CE?.lastPrice || 0).toFixed(2),
        change: (item.CE?.change || 0).toFixed(2),
      },
      put: {
        oi: item.PE?.openInterest || 0,
        oiChange: item.PE?.changeinOpenInterest || 0,
        volume: item.PE?.totalTradedVolume || 0,
        iv: (item.PE?.impliedVolatility || 0).toFixed(1),
        ltp: (item.PE?.lastPrice || 0).toFixed(2),
        change: (item.PE?.change || 0).toFixed(2),
      },
    };
  });
};

/** Check if current time is during Indian market hours (9:15–15:30 IST, weekdays) */
const isMarketHours = () => {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const t = ist.getHours() * 60 + ist.getMinutes();
  return t >= 555 && t <= 930; // 9:15=555, 15:30=930
};

// ═══════════════════════════════════════════════════════════════════════════════
// COA 1.0 - 9 SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════
const COA_SCENARIOS = [
  { id: 1, name: 'Both Strong', support: 'Strong', resistance: 'Strong', type: 'ideal', color: 'green', tradable: true, top: 'EOR', bottom: 'EOS', bias: 'Neutral (Range-Bound)', action: 'EOS पर Buy CE / Sell PE | EOR पर Sell CE / Buy PE', description: 'Most ideal scenario. Market oscillates between strong support and resistance. First hit on either level is safest.', riskLevel: 'Low' },
  { id: 2, name: 'Sup Strong, Res WTB', support: 'Strong', resistance: 'WTB', type: 'bearish', color: 'red', tradable: true, top: 'EOR', bottom: 'EOS-1', bias: 'Bearish', action: 'Avoid buying calls near resistance. Support may break → EOS-1 target.', description: 'Resistance is weak towards bottom — bearish pressure building. Support may breakdown eventually.', riskLevel: 'Medium' },
  { id: 3, name: 'Sup Strong, Res WTT', support: 'Strong', resistance: 'WTT', type: 'bullish', color: 'green', tradable: true, top: 'WTT-1', bottom: 'EOS', bias: 'Bullish', action: 'Resistance will break. Buy CE on dips. Target WTT-1 (next diversion above resistance).', description: 'Resistance is weak towards top — bullish breakout expected. Strong support gives confidence for longs.', riskLevel: 'Medium' },
  { id: 4, name: 'Sup WTB, Res Strong', support: 'WTB', resistance: 'Strong', type: 'bearish', color: 'red', tradable: true, top: 'EOR', bottom: 'WTB+1', bias: 'Bearish', action: 'Support will break. Sell CE / Buy PE near resistance. Target WTB+1.', description: 'Support is weak towards bottom — will likely breakdown. Strong resistance caps upside.', riskLevel: 'Medium' },
  { id: 5, name: 'Sup WTT, Res Strong', support: 'WTT', resistance: 'Strong', type: 'bullish', color: 'green', tradable: true, top: 'EOR+1', bottom: 'EOS', bias: 'Bullish', action: 'Bullish pressure near resistance. Resistance will break → target EOR+1.', description: 'Support has bullish pressure (WTT) pushing market up. Resistance will eventually break.', riskLevel: 'Medium' },
  { id: 6, name: 'Both WTB (Blood Bath)', support: 'WTB', resistance: 'WTB', type: 'crash', color: 'red', tradable: true, top: 'EOR', bottom: 'N/A (unpredictable)', bias: 'Highly Bearish', action: '🚨 NEVER take bullish trades. Only sell CE or buy deep PE. Stop loss mandatory.', description: 'Double bearish pressure — blood bath scenario. No bottom predictable. Only bearish trades allowed.', riskLevel: 'Very High' },
  { id: 7, name: 'Both WTT (Bull Run)', support: 'WTT', resistance: 'WTT', type: 'rally', color: 'green', tradable: true, top: 'N/A (unpredictable)', bottom: 'EOS', bias: 'Highly Bullish', action: '🚀 NEVER take bearish trades. Only buy CE or sell PE. Ride the momentum.', description: 'Double bullish pressure — bull run scenario. No top predictable. Only bullish trades allowed.', riskLevel: 'Very High' },
  { id: 8, name: 'Sup WTB, Res WTT', support: 'WTB', resistance: 'WTT', type: 'avoid', color: 'gray', tradable: false, top: 'N/A', bottom: 'N/A', bias: 'Non-Tradable', action: '⛔ DO NOT TRADE. Premature situation. Wait for clarity.', description: 'Conflicting signals — support weak downward, resistance weak upward. Completely avoid trading.', riskLevel: 'Extreme' },
  { id: 9, name: 'Sup WTT, Res WTB', support: 'WTT', resistance: 'WTB', type: 'avoid', color: 'gray', tradable: false, top: 'N/A', bottom: 'N/A', bias: 'Non-Tradable', action: '⛔ DO NOT TRADE. Premature situation. Wait for clarity.', description: 'Conflicting signals — support weak upward, resistance weak downward. Completely avoid trading.', riskLevel: 'Extreme' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COA 2.0 - OI BASED 9 SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════
const COA2_SCENARIOS = [
  { callOI: 'Stable', putOI: 'Stable', signal: 'Range-Bound', action: 'Sell Straddle/Strangle', color: 'yellow', icon: '⚖️' },
  { callOI: 'Stable', putOI: 'Decreasing', signal: 'Bearish Breakout', action: 'Buy PE / Sell CE', color: 'red', icon: '📉' },
  { callOI: 'Stable', putOI: 'Increasing', signal: 'Strong Support', action: 'Buy CE at support', color: 'green', icon: '🛡️' },
  { callOI: 'Decreasing', putOI: 'Stable', signal: 'Bullish Breakout', action: 'Buy CE / Sell PE', color: 'green', icon: '📈' },
  { callOI: 'Decreasing', putOI: 'Decreasing', signal: 'Unwinding (No Direction)', action: 'Avoid trading', color: 'gray', icon: '⏸️' },
  { callOI: 'Decreasing', putOI: 'Increasing', signal: 'Strong Bullish', action: 'Aggressive CE Buy', color: 'green', icon: '🚀' },
  { callOI: 'Increasing', putOI: 'Stable', signal: 'Strong Resistance', action: 'Buy PE at resistance', color: 'red', icon: '🧱' },
  { callOI: 'Increasing', putOI: 'Decreasing', signal: 'Strong Bearish', action: 'Aggressive PE Buy', color: 'red', icon: '💀' },
  { callOI: 'Increasing', putOI: 'Increasing', signal: 'High Volatility Expected', action: 'Buy Straddle/Strangle', color: 'purple', icon: '🌪️' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CHART THEME
// ═══════════════════════════════════════════════════════════════════════════════
const CHART_COLORS = {
  callOI: '#ef4444', putOI: '#22c55e', callIV: '#f59e0b', putIV: '#8b5cf6',
  grid: '#374151', text: '#9ca3af', spot: '#f97316',
};
const ChartTooltipStyle = {
  backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LTPCalculator() {
  const [activeTab, setActiveTab] = useState('calculator');

  // ── P&L Calculator State ──
  const [calcType, setCalcType] = useState('long');
  const [segment, setSegment] = useState('equity');
  const [entryPrice, setEntryPrice] = useState('');
  const [currentLTP, setCurrentLTP] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lotSize, setLotSize] = useState('75');

  // ── Option Chain State (LIVE) ──
  const [spotPrice, setSpotPrice] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState('NIFTY');
  const [optionChainData, setOptionChainData] = useState([]);
  const [apiRawData, setApiRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataSource, setDataSource] = useState('');
  const [pcrOI, setPcrOI] = useState(0);
  const [pcrVolume, setPcrVolume] = useState(0);
  const [totalCallOI, setTotalCallOI] = useState(0);
  const [totalPutOI, setTotalPutOI] = useState(0);
  const [expiryDates, setExpiryDates] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);
  const [spotChange, setSpotChange] = useState(0);
  const [ltpLevels, setLtpLevels] = useState(null);
  const [levelsLoading, setLevelsLoading] = useState(false);

  // ── COA State ──
  const [supportStrength, setSupportStrength] = useState('Strong');
  const [resistanceStrength, setResistanceStrength] = useState('Strong');
  const [supportLevel, setSupportLevel] = useState('');
  const [resistanceLevel, setResistanceLevel] = useState('');

  // ── COA 2.0 State ──
  const [callOITrend, setCallOITrend] = useState('Stable');
  const [putOITrend, setPutOITrend] = useState('Stable');

  // ── Trade Finder State ──
  const [riskAppetite, setRiskAppetite] = useState('moderate');
  const [marketOutlook, setMarketOutlook] = useState('neutral');

  // ════════════════════════════════════════════════
  // DATA FETCHING — Live Option Chain + Spot Prices
  // ════════════════════════════════════════════════
  const fetchData = useCallback(async (index) => {
    const symbol = index || selectedIndex;
    setLoading(true);
    setError(null);
    try {
      const [chainRes, tickerRes, levelsRes] = await Promise.allSettled([
        fetchAPI(`/nse/option-chain/${symbol}`),
        fetchAPI('/ticker-data'),
        fetchAPI(`/ltp/levels/${symbol}`),
      ]);

      // Process ticker data for spot change %
      if (tickerRes.status === 'fulfilled' && Array.isArray(tickerRes.value)) {
        const tickerMap = {};
        tickerRes.value.forEach(t => { tickerMap[t.symbol] = t; });
        const idx = tickerMap[symbol] || tickerMap['NIFTY'];
        if (idx) setSpotChange(idx.change || 0);
      }

      // Process option chain
      if (chainRes.status === 'fulfilled' && chainRes.value) {
        const raw = chainRes.value;
        setApiRawData(raw);
        const spot = raw.underlying_value || 0;
        if (spot > 0) setSpotPrice(spot);
        setDataSource(raw.source || 'unknown');
        setPcrOI(raw.pcr_oi || 0);
        setPcrVolume(raw.pcr_volume || 0);
        setTotalCallOI(raw.total_call_oi || 0);
        setTotalPutOI(raw.total_put_oi || 0);
        if (raw.expiryDates?.length) {
          setExpiryDates(raw.expiryDates);
          if (!selectedExpiry) setSelectedExpiry(raw.expiryDates[0]);
        }
        const transformed = transformOptionChainData(raw, spot || spotPrice);
        setOptionChainData(transformed);
        setLastUpdated(new Date());
      } else {
        throw new Error(chainRes.reason?.message || 'Failed to fetch option chain');
      }

      // Process LTP levels from backend (real OI-based EOS/EOR/Diversions)
      if (levelsRes.status === 'fulfilled' && levelsRes.value) {
        const lv = levelsRes.value;
        setLtpLevels(lv);
        // Auto-fill COA inputs from real OI data
        if (lv.EOS) setSupportLevel(String(lv.EOS));
        if (lv.EOR) setResistanceLevel(String(lv.EOR));
      }
    } catch (err) {
      console.error('Option chain fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedIndex, spotPrice, selectedExpiry]);

  // Initial fetch on mount and when index changes
  useEffect(() => {
    fetchData();
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  // Auto-refresh every 30s during market hours
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        if (isMarketHours()) fetchData();
      }, 30000);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh, fetchData]);

  // ════════════════════════════════════════════════
  // DERIVED DATA
  // ════════════════════════════════════════════════
  const maxOI = useMemo(() => {
    if (!optionChainData.length) return { callStrike: 0, putStrike: 0, maxCallOI: 0, maxPutOI: 0 };
    let maxCallOI = 0, maxPutOI = 0, callStrike = 0, putStrike = 0;
    optionChainData.forEach(row => {
      if (row.call.oi > maxCallOI) { maxCallOI = row.call.oi; callStrike = row.strike; }
      if (row.put.oi > maxPutOI) { maxPutOI = row.put.oi; putStrike = row.strike; }
    });
    return { callStrike, putStrike, maxCallOI, maxPutOI };
  }, [optionChainData]);

  // Auto-fill COA support/resistance from maxOI when API levels not available
  useEffect(() => {
    if (!ltpLevels) {
      if (maxOI.putStrike && !supportLevel) setSupportLevel(String(maxOI.putStrike));
      if (maxOI.callStrike && !resistanceLevel) setResistanceLevel(String(maxOI.callStrike));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxOI.putStrike, maxOI.callStrike, ltpLevels]);

  const oiChartData = useMemo(() => {
    return optionChainData.map(row => ({
      strike: row.strike,
      'Call OI': Math.round(row.call.oi / 1000),
      'Put OI': Math.round(row.put.oi / 1000),
      'Call OI Chg': Math.round(row.call.oiChange / 1000),
      'Put OI Chg': Math.round(row.put.oiChange / 1000),
    }));
  }, [optionChainData]);

  const ivChartData = useMemo(() => {
    return optionChainData.map(row => ({
      strike: row.strike,
      'Call IV': parseFloat(row.call.iv) || 0,
      'Put IV': parseFloat(row.put.iv) || 0,
    }));
  }, [optionChainData]);

  // ════════════════════════════════════════════════
  // P&L CALCULATIONS
  // ════════════════════════════════════════════════
  const pnlResults = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const ltp = parseFloat(currentLTP);
    const qty = parseInt(quantity) || 0;
    const lots = parseInt(lotSize) || 75;
    if (!entry || !ltp || !qty) return null;
    const effectiveQty = segment === 'equity' ? qty : qty * lots;
    const isShort = calcType === 'short';
    const change = isShort ? entry - ltp : ltp - entry;
    const changePct = (change / entry) * 100;
    const positionValue = ltp * effectiveQty;
    const entryValue = entry * effectiveQty;
    const pnl = change * effectiveQty;
    const pnlPct = (pnl / entryValue) * 100;
    const breakeven = entry;
    const brokerage = segment === 'equity' ? Math.min(20, entry * effectiveQty * 0.0003) * 2 : 40;
    const stt = segment === 'equity' ? ltp * effectiveQty * 0.001 : ltp * effectiveQty * 0.000625;
    const exchangeCharges = positionValue * 0.0000345 * 2;
    const gst = (brokerage + exchangeCharges) * 0.18;
    const sebiCharges = positionValue * 0.000001 * 2;
    const stampDuty = entryValue * 0.00015;
    const totalCharges = brokerage + stt + exchangeCharges + gst + sebiCharges + stampDuty;
    const netPnl = pnl - totalCharges;
    return {
      entry, ltp, effectiveQty,
      change: change.toFixed(2), changePct: changePct.toFixed(2),
      positionValue: positionValue.toFixed(0), entryValue: entryValue.toFixed(0),
      pnl: pnl.toFixed(0), pnlPct: pnlPct.toFixed(2), breakeven: breakeven.toFixed(2),
      brokerage: brokerage.toFixed(2), stt: stt.toFixed(2),
      exchangeCharges: exchangeCharges.toFixed(2), gst: gst.toFixed(2),
      sebiCharges: sebiCharges.toFixed(2), stampDuty: stampDuty.toFixed(2),
      totalCharges: totalCharges.toFixed(2), netPnl: netPnl.toFixed(0),
      isProfit: pnl > 0,
    };
  }, [entryPrice, currentLTP, quantity, lotSize, calcType, segment]);

  // ════════════════════════════════════════════════
  // COA MATCHING
  // ════════════════════════════════════════════════
  const matchedScenario = useMemo(() => {
    return COA_SCENARIOS.find(s => s.support === supportStrength && s.resistance === resistanceStrength);
  }, [supportStrength, resistanceStrength]);

  const matchedCOA2 = useMemo(() => {
    return COA2_SCENARIOS.find(s => s.callOI === callOITrend && s.putOI === putOITrend);
  }, [callOITrend, putOITrend]);

  // ════════════════════════════════════════════════
  // COA LEVEL LINES (EOS / EOR / Diversions / CMP)
  // ════════════════════════════════════════════════
  const strikeStep = useMemo(
    () => (selectedIndex === 'BANKNIFTY' ? 100 : 50),
    [selectedIndex]
  );

  const coaLevels = useMemo(() => {
    const s = Number(supportLevel);
    const r = Number(resistanceLevel);
    if (!s || !r || !spotPrice) return null;

    const EOS = s;
    const EOR = r;
    const min = Math.min(EOS, EOR);
    const max = Math.max(EOS, EOR);

    // Build diversion lines between EOS & EOR at strike-step intervals
    const rawStrikes = [];
    for (let k = min + strikeStep; k < max; k += strikeStep) {
      rawStrikes.push(k);
    }

    const diversions = [];
    if (rawStrikes.length === 0) {
      diversions.push((EOS + EOR) / 2);
    } else {
      // Place diversions at each raw strike between support & resistance
      rawStrikes.forEach(v => diversions.push(v));
    }

    return {
      EOS,
      EOR,
      diversions,
      priceMin: min - 3 * strikeStep,
      priceMax: max + 3 * strikeStep,
    };
  }, [supportLevel, resistanceLevel, spotPrice, strikeStep]);

  // Effective levels: prefer backend API levels, fallback to frontend coaLevels
  const effectiveLevels = useMemo(() => {
    if (ltpLevels && ltpLevels.EOS && ltpLevels.EOR) {
      return {
        EOS: ltpLevels.EOS,
        EOR: ltpLevels.EOR,
        diversions: ltpLevels.diversions || [],
        priceMin: ltpLevels.price_min || Math.min(ltpLevels.EOS, ltpLevels.EOR) - 300,
        priceMax: ltpLevels.price_max || Math.max(ltpLevels.EOS, ltpLevels.EOR) + 300,
        eosExt: ltpLevels.eos_ext,
        eorExt: ltpLevels.eor_ext,
        maxCallOI: ltpLevels.max_call_oi,
        maxPutOI: ltpLevels.max_put_oi,
        source: ltpLevels.source === 'nse_live' ? 'api' : 'simulated',
      };
    }
    if (coaLevels) return { ...coaLevels, source: 'manual' };
    return null;
  }, [ltpLevels, coaLevels]);

  // ════════════════════════════════════════════════
  // TRADE FINDER
  // ════════════════════════════════════════════════
  const tradeSuggestions = useMemo(() => {
    if (!spotPrice) return [];
    const suggestions = [];
    const spot = spotPrice;
    const atmStrike = Math.round(spot / 50) * 50;
    const resistance = maxOI.callStrike || atmStrike + 300;
    const support = maxOI.putStrike || atmStrike - 300;

    if (marketOutlook === 'bullish') {
      if (riskAppetite === 'conservative') {
        suggestions.push({
          name: 'Bull Put Spread',
          legs: [
            { type: 'Sell', option: 'PE', strike: atmStrike - 100, action: 'Sell OTM Put' },
            { type: 'Buy', option: 'PE', strike: atmStrike - 250, action: 'Buy Deep OTM Put (hedge)' },
          ],
          maxProfit: '₹3,000-5,000/lot', maxLoss: '₹7,500-10,000/lot', winRate: '65-70%',
          risk: 'Low-Medium', timeframe: 'Weekly expiry',
          reasoning: 'Max OI Put support at ' + support + '. Sell spread below support for premium collection.',
          confidence: 75,
        });
      }
      if (riskAppetite !== 'conservative') {
        suggestions.push({
          name: 'Long Call (OTM)',
          legs: [{ type: 'Buy', option: 'CE', strike: atmStrike + 100, action: 'Buy OTM Call' }],
          maxProfit: 'Unlimited', maxLoss: 'Premium paid (~₹150-300)', winRate: '40-50%',
          risk: 'Medium', timeframe: '2-5 days',
          reasoning: 'Bullish momentum expected. Resistance at ' + resistance + '. Target: break above ATM.',
          confidence: 60,
        });
      }
      if (riskAppetite === 'aggressive') {
        suggestions.push({
          name: 'Naked Put Sell (ATM)',
          legs: [{ type: 'Sell', option: 'PE', strike: atmStrike, action: 'Sell ATM Put' }],
          maxProfit: 'Premium collected (~₹200-400)', maxLoss: 'Unlimited (use SL)', winRate: '55-60%',
          risk: 'Very High', timeframe: 'Weekly expiry',
          reasoning: 'Aggressive bullish bet. High premium collection if market stays above ' + atmStrike + '.',
          confidence: 50,
        });
      }
    }

    if (marketOutlook === 'bearish') {
      if (riskAppetite === 'conservative') {
        suggestions.push({
          name: 'Bear Call Spread',
          legs: [
            { type: 'Sell', option: 'CE', strike: atmStrike + 100, action: 'Sell OTM Call' },
            { type: 'Buy', option: 'CE', strike: atmStrike + 250, action: 'Buy Deep OTM Call (hedge)' },
          ],
          maxProfit: '₹3,000-5,000/lot', maxLoss: '₹7,500-10,000/lot', winRate: '65-70%',
          risk: 'Low-Medium', timeframe: 'Weekly expiry',
          reasoning: 'Max OI Call resistance at ' + resistance + '. Sell spread above resistance for premium.',
          confidence: 75,
        });
      }
      if (riskAppetite !== 'conservative') {
        suggestions.push({
          name: 'Long Put (OTM)',
          legs: [{ type: 'Buy', option: 'PE', strike: atmStrike - 100, action: 'Buy OTM Put' }],
          maxProfit: 'Unlimited', maxLoss: 'Premium paid (~₹150-300)', winRate: '40-50%',
          risk: 'Medium', timeframe: '2-5 days',
          reasoning: 'Bearish momentum. Support at ' + support + '. Target: break below support.',
          confidence: 60,
        });
      }
    }

    if (marketOutlook === 'neutral') {
      suggestions.push({
        name: 'Short Strangle',
        legs: [
          { type: 'Sell', option: 'CE', strike: resistance, action: 'Sell OTM Call at max OI resistance' },
          { type: 'Sell', option: 'PE', strike: support, action: 'Sell OTM Put at max OI support' },
        ],
        maxProfit: 'Combined premium (~₹300-600)', maxLoss: 'Unlimited (hedge recommended)',
        winRate: '70-80%', risk: riskAppetite === 'aggressive' ? 'High' : 'Very High',
        timeframe: 'Weekly expiry',
        reasoning: `Range ${support}-${resistance}. Sell outside max OI levels. High probability of both expiring worthless.`,
        confidence: 80,
      });
      if (riskAppetite === 'conservative') {
        suggestions.push({
          name: 'Iron Condor',
          legs: [
            { type: 'Sell', option: 'CE', strike: resistance, action: 'Sell OTM Call' },
            { type: 'Buy', option: 'CE', strike: resistance + 150, action: 'Buy hedge Call' },
            { type: 'Sell', option: 'PE', strike: support, action: 'Sell OTM Put' },
            { type: 'Buy', option: 'PE', strike: support - 150, action: 'Buy hedge Put' },
          ],
          maxProfit: '₹4,000-8,000/lot', maxLoss: '₹7,000-11,000/lot', winRate: '60-70%',
          risk: 'Low (Defined Risk)', timeframe: 'Weekly expiry',
          reasoning: `Defined risk between ${support - 150} and ${resistance + 150}. Best for range-bound markets.`,
          confidence: 75,
        });
      }
      suggestions.push({
        name: 'Iron Butterfly',
        legs: [
          { type: 'Sell', option: 'CE', strike: atmStrike, action: 'Sell ATM Call' },
          { type: 'Sell', option: 'PE', strike: atmStrike, action: 'Sell ATM Put' },
          { type: 'Buy', option: 'CE', strike: atmStrike + 200, action: 'Buy OTM Call hedge' },
          { type: 'Buy', option: 'PE', strike: atmStrike - 200, action: 'Buy OTM Put hedge' },
        ],
        maxProfit: 'ATM premium minus hedge cost', maxLoss: '₹10,000-15,000/lot', winRate: '35-45%',
        risk: 'Medium (Defined)', timeframe: 'Weekly expiry',
        reasoning: `ATM=${atmStrike}. High premium collection if market stays near ATM. Tight range needed.`,
        confidence: 55,
      });
    }

    return suggestions;
  }, [spotPrice, marketOutlook, riskAppetite, maxOI]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <PageLayout>
      <PageHeader
        title="LTP Calculator & Trade Finder"
        subtitle="P&L Calculator • Live Option Chain • COA Framework • Auto Strategy Suggestions"
      />

      {/* ── Live Status Bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isMarketHours() ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-muted-foreground">{isMarketHours() ? 'Market Open' : 'Market Closed'}</span>
        </div>
        {spotPrice > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">{selectedIndex}</span>
            <span className="text-sm font-bold">{spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className={`text-xs font-medium ${spotChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {spotChange >= 0 ? '▲' : '▼'} {Math.abs(spotChange).toFixed(2)}%
            </span>
          </div>
        )}
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">Updated: {lastUpdated.toLocaleTimeString('en-IN')}</span>
        )}
        {dataSource && (
          <Badge className={`text-[10px] ${dataSource === 'nse_live' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
            {dataSource === 'nse_live' ? '🟢 NSE Live' : dataSource === 'cached' ? '📦 Cached' : '🔧 Calculated'}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
              autoRefresh ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-card border-border text-muted-foreground'
            }`}>
            {autoRefresh ? '🔄 Auto (30s)' : '⏸ Paused'}
          </button>
          <button onClick={() => fetchData()} disabled={loading}
            className="text-[10px] px-2 py-1 rounded-md bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 disabled:opacity-50">
            {loading ? '⏳ Loading...' : '🔁 Refresh'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 px-4 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}>
            <span>{tab.label}</span>
            <span className="text-xs opacity-70 hidden sm:inline">({tab.desc})</span>
          </button>
        ))}
      </div>

      <Section>
        <AnimatePresence mode="wait">

          {/* ═══════ TAB 1: P&L CALCULATOR ═══════ */}
          {activeTab === 'calculator' && (
            <motion.div key="calc" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <Card className="glass-card">
                    <CardHeader><CardTitle>Position Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Trade Type</label>
                        <div className="flex gap-2">
                          {[{ id: 'long', label: '📈 Long (Buy)' }, { id: 'short', label: '📉 Short (Sell)' }].map(t => (
                            <button key={t.id} onClick={() => setCalcType(t.id)}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                calcType === t.id
                                  ? t.id === 'long' ? 'bg-green-500/20 border-2 border-green-500 text-green-400' : 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                  : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
                              }`}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Segment</label>
                        <div className="flex gap-2">
                          {[{ id: 'equity', label: 'Equity' }, { id: 'futures', label: 'Futures' }, { id: 'options', label: 'Options' }].map(s => (
                            <button key={s.id} onClick={() => setSegment(s.id)}
                              className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                                segment === s.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground'
                              }`}>{s.label}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">{calcType === 'long' ? 'Buy Price (Entry)' : 'Sell Price (Entry)'}</label>
                        <Input type="number" placeholder="e.g., 21500" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Current LTP (Market Price)</label>
                        <Input type="number" placeholder="e.g., 21750" value={currentLTP} onChange={e => setCurrentLTP(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">{segment === 'equity' ? 'Quantity (Shares)' : 'Number of Lots'}</label>
                        <Input type="number" placeholder={segment === 'equity' ? 'e.g., 100' : 'e.g., 1'} value={quantity} onChange={e => setQuantity(e.target.value)} />
                      </div>
                      {segment !== 'equity' && (
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Lot Size</label>
                          <select className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-sm" value={lotSize} onChange={e => setLotSize(e.target.value)}>
                            <option value="75">NIFTY (75)</option>
                            <option value="30">BANKNIFTY (30)</option>
                            <option value="40">FINNIFTY (40)</option>
                            <option value="50">MIDCPNIFTY (50)</option>
                            <option value="10">SENSEX (10)</option>
                          </select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-3 space-y-4">
                  {!pnlResults ? (
                    <Card className="glass-card flex items-center justify-center min-h-[400px]">
                      <div className="text-center text-muted-foreground">
                        <div className="text-5xl mb-4">🧮</div>
                        <p className="text-lg font-medium">Enter your position details</p>
                        <p className="text-sm mt-1">Fill in entry price, LTP, and quantity to see P&L</p>
                      </div>
                    </Card>
                  ) : (
                    <>
                      <Card className={`glass-card border-2 ${pnlResults.isProfit ? 'border-green-500/30' : 'border-red-500/30'}`}>
                        <CardContent className="p-6">
                          <div className="text-center mb-4"><span className="text-5xl">{pnlResults.isProfit ? '🟢' : '🔴'}</span></div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center p-3 rounded-lg bg-card border border-border">
                              <div className={`text-2xl font-bold ${pnlResults.isProfit ? 'text-green-400' : 'text-red-400'}`}>{formatINR(parseFloat(pnlResults.pnl))}</div>
                              <div className="text-xs text-muted-foreground">Gross P&L</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-card border border-border">
                              <div className={`text-2xl font-bold ${pnlResults.isProfit ? 'text-green-400' : 'text-red-400'}`}>{pnlResults.pnlPct}%</div>
                              <div className="text-xs text-muted-foreground">P&L %</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-card border border-border">
                              <div className={`text-2xl font-bold ${parseFloat(pnlResults.netPnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatINR(parseFloat(pnlResults.netPnl))}</div>
                              <div className="text-xs text-muted-foreground">Net P&L (after charges)</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <div className="grid md:grid-cols-2 gap-4">
                        <Card className="glass-card">
                          <CardHeader><CardTitle className="text-sm">Position Info</CardTitle></CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            {[
                              { label: 'Change vs Entry', value: `₹${pnlResults.change}`, color: pnlResults.isProfit ? 'text-green-400' : 'text-red-400' },
                              { label: 'Change %', value: `${pnlResults.changePct}%`, color: pnlResults.isProfit ? 'text-green-400' : 'text-red-400' },
                              { label: 'Entry Value', value: formatINR(parseFloat(pnlResults.entryValue)) },
                              { label: 'Current Value', value: formatINR(parseFloat(pnlResults.positionValue)) },
                              { label: 'Effective Qty', value: pnlResults.effectiveQty.toLocaleString() },
                              { label: 'Breakeven', value: `₹${pnlResults.breakeven}` },
                            ].map(r => (
                              <div key={r.label} className="flex justify-between">
                                <span className="text-muted-foreground">{r.label}</span>
                                <span className={`font-medium ${r.color || ''}`}>{r.value}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                        <Card className="glass-card">
                          <CardHeader><CardTitle className="text-sm">Charges Breakdown</CardTitle></CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            {[
                              { label: 'Brokerage', value: `₹${pnlResults.brokerage}` },
                              { label: 'STT', value: `₹${pnlResults.stt}` },
                              { label: 'Exchange Charges', value: `₹${pnlResults.exchangeCharges}` },
                              { label: 'GST', value: `₹${pnlResults.gst}` },
                              { label: 'SEBI Charges', value: `₹${pnlResults.sebiCharges}` },
                              { label: 'Stamp Duty', value: `₹${pnlResults.stampDuty}` },
                            ].map(r => (
                              <div key={r.label} className="flex justify-between">
                                <span className="text-muted-foreground">{r.label}</span>
                                <span className="font-medium text-yellow-400">{r.value}</span>
                              </div>
                            ))}
                            <div className="pt-2 mt-2 border-t border-border flex justify-between font-bold">
                              <span>Total Charges</span>
                              <span className="text-red-400">₹{pnlResults.totalCharges}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ TAB 2: OPTION CHAIN (LIVE + CHARTS) ═══════ */}
          {activeTab === 'optionchain' && (
            <motion.div key="oc" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                  {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(idx => (
                    <button key={idx} onClick={() => setSelectedIndex(idx)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedIndex === idx ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground'
                      }`}>{idx}</button>
                  ))}
                </div>
                {expiryDates.length > 0 && (
                  <select className="rounded-lg bg-background border border-border px-3 py-2 text-xs" value={selectedExpiry} onChange={e => setSelectedExpiry(e.target.value)}>
                    {expiryDates.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Spot:</span>
                  {loading && !spotPrice ? (
                    <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
                  ) : (
                    <span className="font-bold text-primary text-lg">{spotPrice > 0 ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</span>
                  )}
                </div>
                <div className="ml-auto flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500/30" /> Max Call OI: <span className="font-bold">{maxOI.callStrike || '—'}</span> (Resistance)
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500/30" /> Max Put OI: <span className="font-bold">{maxOI.putStrike || '—'}</span> (Support)
                  </div>
                </div>
              </div>

              {/* PCR & Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card className="glass-card p-3 text-center">
                  <div className="text-xs text-muted-foreground">PCR (OI)</div>
                  <div className={`text-lg font-bold ${pcrOI > 1 ? 'text-green-400' : pcrOI < 0.7 ? 'text-red-400' : 'text-yellow-400'}`}>{pcrOI || '—'}</div>
                </Card>
                <Card className="glass-card p-3 text-center">
                  <div className="text-xs text-muted-foreground">PCR (Vol)</div>
                  <div className={`text-lg font-bold ${pcrVolume > 1 ? 'text-green-400' : pcrVolume < 0.7 ? 'text-red-400' : 'text-yellow-400'}`}>{pcrVolume || '—'}</div>
                </Card>
                <Card className="glass-card p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Call OI</div>
                  <div className="text-sm font-bold text-red-400">{totalCallOI ? (totalCallOI / 100000).toFixed(1) + 'L' : '—'}</div>
                </Card>
                <Card className="glass-card p-3 text-center">
                  <div className="text-xs text-muted-foreground">Total Put OI</div>
                  <div className="text-sm font-bold text-green-400">{totalPutOI ? (totalPutOI / 100000).toFixed(1) + 'L' : '—'}</div>
                </Card>
                <Card className="glass-card p-3 text-center border-green-500/30">
                  <div className="text-xs text-muted-foreground">Support</div>
                  <div className="text-sm font-bold text-green-400">{maxOI.putStrike || '—'}</div>
                </Card>
                <Card className="glass-card p-3 text-center border-red-500/30">
                  <div className="text-xs text-muted-foreground">Resistance</div>
                  <div className="text-sm font-bold text-red-400">{maxOI.callStrike || '—'}</div>
                </Card>
              </div>

              {/* Error banner */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                  <span>⚠️ {error}</span>
                  <button onClick={() => fetchData()} className="ml-auto text-xs bg-red-500/20 px-2 py-1 rounded hover:bg-red-500/30">Retry</button>
                </div>
              )}

              {/* Loading state */}
              {loading && optionChainData.length === 0 && (
                <Card className="glass-card p-12 text-center">
                  <div className="text-4xl mb-3 animate-spin">⏳</div>
                  <p className="text-muted-foreground">Fetching live option chain from NSE...</p>
                </Card>
              )}

              {/* ── OI Distribution Chart ── */}
              {oiChartData.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      📊 Open Interest Distribution
                      <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Call OI vs Put OI (in '000s)</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={0}>
                      <BarChart data={oiChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                        <XAxis dataKey="strike" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} interval={Math.max(0, Math.floor(oiChartData.length / 12))} />
                        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
                        <Tooltip contentStyle={ChartTooltipStyle} />
                        {spotPrice > 0 && <ReferenceLine x={Math.round(spotPrice / 50) * 50} stroke={CHART_COLORS.spot} strokeDasharray="5 5" label={{ value: 'SPOT', fill: CHART_COLORS.spot, fontSize: 10 }} />}
                        <Bar dataKey="Call OI" fill={CHART_COLORS.callOI} opacity={0.8} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Put OI" fill={CHART_COLORS.putOI} opacity={0.8} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: CHART_COLORS.callOI }} /> Call OI (Resistance)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: CHART_COLORS.putOI }} /> Put OI (Support)</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── OI Change Chart ── */}
              {oiChartData.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      📈 OI Change Distribution
                      <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">Call vs Put OI Change (in '000s)</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
                      <BarChart data={oiChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                        <XAxis dataKey="strike" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} interval={Math.max(0, Math.floor(oiChartData.length / 12))} />
                        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
                        <Tooltip contentStyle={ChartTooltipStyle} />
                        <Bar dataKey="Call OI Chg" fill="#f87171" opacity={0.7} radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Put OI Chg" fill="#4ade80" opacity={0.7} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Call OI Change</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Put OI Change</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── IV Smile/Skew Chart ── */}
              {ivChartData.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      📉 IV Smile / Skew
                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Implied Volatility across Strikes</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
                      <LineChart data={ivChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                        <XAxis dataKey="strike" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} interval={Math.max(0, Math.floor(ivChartData.length / 12))} />
                        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={ChartTooltipStyle} />
                        {spotPrice > 0 && <ReferenceLine x={Math.round(spotPrice / 50) * 50} stroke={CHART_COLORS.spot} strokeDasharray="5 5" />}
                        <Line type="monotone" dataKey="Call IV" stroke={CHART_COLORS.callIV} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Put IV" stroke={CHART_COLORS.putIV} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: CHART_COLORS.callIV }} /> Call IV</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: CHART_COLORS.putIV }} /> Put IV</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Option Chain Table */}
              {optionChainData.length > 0 && (
                <Card className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-card/80">
                          <th colSpan="6" className="text-center py-2 text-green-400 border-b border-border font-semibold">📞 CALLS</th>
                          <th className="bg-primary/20 border-b border-border"></th>
                          <th colSpan="6" className="text-center py-2 text-red-400 border-b border-border font-semibold">📞 PUTS</th>
                        </tr>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-2 px-2">OI Chg</th>
                          <th className="py-2 px-2">OI</th>
                          <th className="py-2 px-2">Vol</th>
                          <th className="py-2 px-2">IV</th>
                          <th className="py-2 px-2">Chg</th>
                          <th className="py-2 px-2">LTP</th>
                          <th className="py-2 px-3 bg-primary/20 font-bold text-foreground">STRIKE</th>
                          <th className="py-2 px-2">LTP</th>
                          <th className="py-2 px-2">Chg</th>
                          <th className="py-2 px-2">IV</th>
                          <th className="py-2 px-2">Vol</th>
                          <th className="py-2 px-2">OI</th>
                          <th className="py-2 px-2">OI Chg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionChainData.map(row => {
                          const isMaxCallOI = row.strike === maxOI.callStrike;
                          const isMaxPutOI = row.strike === maxOI.putStrike;
                          return (
                            <tr key={row.strike}
                              className={`border-b border-border/30 transition-colors ${
                                row.isATM ? 'bg-orange-500/10' : row.isITMCall ? 'bg-green-500/5' : ''
                              } hover:bg-card/50`}>
                              <td className={`py-1.5 px-2 text-right ${row.call.oiChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{(row.call.oiChange / 1000).toFixed(0)}K</td>
                              <td className={`py-1.5 px-2 text-right font-medium ${isMaxCallOI ? 'text-red-400 font-bold bg-red-500/10' : ''}`}>{(row.call.oi / 1000).toFixed(0)}K</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{(row.call.volume / 1000).toFixed(0)}K</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{row.call.iv}%</td>
                              <td className={`py-1.5 px-2 text-right ${parseFloat(row.call.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{row.call.change}</td>
                              <td className="py-1.5 px-2 text-right font-medium">{row.call.ltp}</td>
                              <td className={`py-1.5 px-3 text-center font-bold bg-primary/10 ${row.isATM ? 'bg-orange-500/30 text-orange-300' : ''}`}>{row.strike}</td>
                              <td className="py-1.5 px-2 text-left font-medium">{row.put.ltp}</td>
                              <td className={`py-1.5 px-2 text-left ${parseFloat(row.put.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{row.put.change}</td>
                              <td className="py-1.5 px-2 text-left text-muted-foreground">{row.put.iv}%</td>
                              <td className="py-1.5 px-2 text-left text-muted-foreground">{(row.put.volume / 1000).toFixed(0)}K</td>
                              <td className={`py-1.5 px-2 text-left font-medium ${isMaxPutOI ? 'text-green-400 font-bold bg-green-500/10' : ''}`}>{(row.put.oi / 1000).toFixed(0)}K</td>
                              <td className={`py-1.5 px-2 text-left ${row.put.oiChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{(row.put.oiChange / 1000).toFixed(0)}K</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Key Levels Summary */}
              <div className="grid md:grid-cols-4 gap-4">
                <Card className="glass-card p-4 text-center border-green-500/30">
                  <div className="text-2xl mb-1">🟢</div>
                  <div className="text-lg font-bold text-green-400">{maxOI.putStrike || '—'}</div>
                  <div className="text-xs text-muted-foreground">Max Put OI (Support)</div>
                  <div className="text-xs text-green-400/70">{maxOI.maxPutOI ? (maxOI.maxPutOI / 100000).toFixed(1) + 'L OI' : '—'}</div>
                </Card>
                <Card className="glass-card p-4 text-center border-orange-500/30">
                  <div className="text-2xl mb-1">🟠</div>
                  <div className="text-lg font-bold text-orange-400">{spotPrice ? Math.round(spotPrice / 50) * 50 : '—'}</div>
                  <div className="text-xs text-muted-foreground">ATM Strike</div>
                  <div className="text-xs text-orange-400/70">Spot: {spotPrice ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</div>
                </Card>
                <Card className="glass-card p-4 text-center border-red-500/30">
                  <div className="text-2xl mb-1">🔴</div>
                  <div className="text-lg font-bold text-red-400">{maxOI.callStrike || '—'}</div>
                  <div className="text-xs text-muted-foreground">Max Call OI (Resistance)</div>
                  <div className="text-xs text-red-400/70">{maxOI.maxCallOI ? (maxOI.maxCallOI / 100000).toFixed(1) + 'L OI' : '—'}</div>
                </Card>
                <Card className="glass-card p-4 text-center border-blue-500/30">
                  <div className="text-2xl mb-1">📏</div>
                  <div className="text-lg font-bold text-blue-400">{maxOI.callStrike && maxOI.putStrike ? (maxOI.callStrike - maxOI.putStrike) + ' pts' : '—'}</div>
                  <div className="text-xs text-muted-foreground">Range Width</div>
                  <div className="text-xs text-blue-400/70">Support to Resistance</div>
                </Card>
              </div>

              {/* Live LTP Levels in Option Chain tab */}
              {effectiveLevels && (
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      📍 OI-Based Level Map
                      <Badge className="bg-orange-500/20 text-orange-400">Max OI Support / Resistance / CMP</Badge>
                      {effectiveLevels.source === 'api' && <Badge className="bg-green-500/20 text-green-400 text-[10px]">🟢 Live</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                        <div className="text-[10px] text-green-400/70">Support (Max Put OI)</div>
                        <div className="text-sm font-bold text-green-400">{effectiveLevels.EOS.toLocaleString()}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                        <div className="text-[10px] text-red-400/70">Resistance (Max Call OI)</div>
                        <div className="text-sm font-bold text-red-400">{effectiveLevels.EOR.toLocaleString()}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
                        <div className="text-[10px] text-orange-400/70">CMP</div>
                        <div className="text-sm font-bold text-orange-400">{spotPrice.toLocaleString()}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                        <div className="text-[10px] text-yellow-400/70">Diversions</div>
                        <div className="text-sm font-bold text-yellow-400">{effectiveLevels.diversions.length} levels</div>
                      </div>
                    </div>
                    <div style={{ minHeight: 256 }}>
                      <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
                        <LineChart data={[
                          { idx: 0, price: effectiveLevels.priceMin },
                          { idx: 1, price: effectiveLevels.priceMax },
                        ]}>
                          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                          <XAxis dataKey="idx" hide />
                          <YAxis domain={[effectiveLevels.priceMin, effectiveLevels.priceMax]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickFormatter={(v) => v.toFixed(0)} width={55} />
                          <ReferenceLine y={spotPrice} stroke={CHART_COLORS.spot} strokeWidth={2.5} strokeDasharray="6 3" label={{ value: `CMP ${spotPrice.toFixed(0)}`, position: 'right', fill: CHART_COLORS.spot, fontSize: 11, fontWeight: 700 }} />
                          <ReferenceLine y={effectiveLevels.EOS} stroke="#22c55e" strokeWidth={2} label={{ value: `EOS ${effectiveLevels.EOS}`, position: 'right', fill: '#22c55e', fontSize: 11, fontWeight: 600 }} />
                          <ReferenceLine y={effectiveLevels.EOR} stroke="#ef4444" strokeWidth={2} label={{ value: `EOR ${effectiveLevels.EOR}`, position: 'right', fill: '#ef4444', fontSize: 11, fontWeight: 600 }} />
                          {effectiveLevels.diversions.map((level, idx) => (
                            <ReferenceLine key={idx} y={level} stroke="#eab308" strokeDasharray="4 4" strokeWidth={1.2} label={{ value: `D${idx + 1} ${Math.round(level)}`, position: 'right', fill: '#eab308', fontSize: 10 }} />
                          ))}
                          <Line type="monotone" dataKey="price" stroke="transparent" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* ═══════ TAB 3: COA ANALYSIS ═══════ */}
          {activeTab === 'coa' && (
            <motion.div key="coa" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        📊 Chart of Accuracy 1.0
                        <Badge className="bg-blue-500/20 text-blue-400">Support/Resistance</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">Select the strength of Support and Resistance to identify the current market scenario and get trading direction.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Support Strength</label>
                          <div className="space-y-2">
                            {['Strong', 'WTB', 'WTT'].map(s => (
                              <button key={s} onClick={() => setSupportStrength(s)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  supportStrength === s
                                    ? s === 'Strong' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                      : s === 'WTB' ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                      : 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}>{s === 'Strong' ? '💪 Strong' : s === 'WTB' ? '📉 Weak → Bottom' : '📈 Weak → Top'}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Resistance Strength</label>
                          <div className="space-y-2">
                            {['Strong', 'WTB', 'WTT'].map(r => (
                              <button key={r} onClick={() => setResistanceStrength(r)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  resistanceStrength === r
                                    ? r === 'Strong' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                      : r === 'WTB' ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                      : 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}>{r === 'Strong' ? '💪 Strong' : r === 'WTB' ? '📉 Weak → Bottom' : '📈 Weak → Top'}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-1">Support Level</label>
                          <Input placeholder="e.g., 23000" value={supportLevel} onChange={e => setSupportLevel(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-1">Resistance Level</label>
                          <Input placeholder="e.g., 23500" value={resistanceLevel} onChange={e => setResistanceLevel(e.target.value)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {matchedScenario && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className={`glass-card border-2 ${
                        matchedScenario.type === 'ideal' || matchedScenario.type === 'bullish' || matchedScenario.type === 'rally' ? 'border-green-500/40' :
                        matchedScenario.type === 'bearish' || matchedScenario.type === 'crash' ? 'border-red-500/40' : 'border-gray-500/40'
                      }`}>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">
                              {matchedScenario.type === 'ideal' ? '⚖️' : matchedScenario.type === 'bullish' ? '🟢' :
                               matchedScenario.type === 'rally' ? '🚀' : matchedScenario.type === 'bearish' ? '🔴' :
                               matchedScenario.type === 'crash' ? '💀' : '⛔'}
                            </span>
                            <div>
                              <h3 className="font-bold text-lg">Scenario #{matchedScenario.id}: {matchedScenario.name}</h3>
                              <Badge className={matchedScenario.tradable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                                {matchedScenario.tradable ? '✅ Tradable' : '❌ Non-Tradable'}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{matchedScenario.description}</p>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                            <div className="p-3 rounded-lg bg-card border border-border">
                              <div className="text-xs text-muted-foreground">Market Bias</div>
                              <div className={`font-bold ${matchedScenario.bias.includes('Bullish') ? 'text-green-400' : matchedScenario.bias.includes('Bearish') ? 'text-red-400' : 'text-blue-400'}`}>{matchedScenario.bias}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-card border border-border">
                              <div className="text-xs text-muted-foreground">Risk Level</div>
                              <div className={`font-bold ${matchedScenario.riskLevel === 'Low' ? 'text-green-400' : matchedScenario.riskLevel === 'Medium' ? 'text-yellow-400' : 'text-red-400'}`}>{matchedScenario.riskLevel}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                              <div className="text-xs text-muted-foreground">Day's Bottom at</div>
                              <div className="font-bold text-green-400">{matchedScenario.bottom}</div>
                              {supportLevel && <div className="text-xs text-green-300/70">{supportLevel}</div>}
                            </div>
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                              <div className="text-xs text-muted-foreground">Day's Top at</div>
                              <div className="font-bold text-red-400">{matchedScenario.top}</div>
                              {resistanceLevel && <div className="text-xs text-red-300/70">{resistanceLevel}</div>}
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                            <div className="text-xs text-primary mb-1 font-semibold">💡 Trading Action</div>
                            <div className="text-sm font-medium">{matchedScenario.action}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        📈 Chart of Accuracy 2.0
                        <Badge className="bg-purple-500/20 text-purple-400">OI Based</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">Analyze Open Interest trends to predict breakout/rejection at specific strike prices. Use at diversion levels only, never at extensions.</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Call Side OI Trend</label>
                          <div className="space-y-2">
                            {['Stable', 'Decreasing', 'Increasing'].map(t => (
                              <button key={t} onClick={() => setCallOITrend(t)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  callOITrend === t
                                    ? t === 'Stable' ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                                      : t === 'Decreasing' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                      : 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}>{t === 'Stable' ? '⚖️ Stable' : t === 'Decreasing' ? '📉 Decreasing' : '📈 Increasing'}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Put Side OI Trend</label>
                          <div className="space-y-2">
                            {['Stable', 'Decreasing', 'Increasing'].map(t => (
                              <button key={t} onClick={() => setPutOITrend(t)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  putOITrend === t
                                    ? t === 'Stable' ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                                      : t === 'Decreasing' ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                      : 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}>{t === 'Stable' ? '⚖️ Stable' : t === 'Decreasing' ? '📉 Decreasing' : '📈 Increasing'}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {matchedCOA2 && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className={`glass-card border-2 ${
                        matchedCOA2.color === 'green' ? 'border-green-500/40' : matchedCOA2.color === 'red' ? 'border-red-500/40' :
                        matchedCOA2.color === 'purple' ? 'border-purple-500/40' : matchedCOA2.color === 'yellow' ? 'border-yellow-500/40' : 'border-gray-500/40'
                      }`}>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{matchedCOA2.icon}</span>
                            <div>
                              <h3 className="font-bold text-lg">{matchedCOA2.signal}</h3>
                              <div className="text-xs text-muted-foreground">Call OI: {matchedCOA2.callOI} | Put OI: {matchedCOA2.putOI}</div>
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                            <div className="text-xs text-primary mb-1 font-semibold">💡 Suggested Action</div>
                            <div className="text-sm font-medium">{matchedCOA2.action}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  <Card className="glass-card">
                    <CardHeader><CardTitle className="text-sm">COA 2.0 — All 9 Combinations</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {COA2_SCENARIOS.map((s, i) => (
                          <button key={i} onClick={() => { setCallOITrend(s.callOI); setPutOITrend(s.putOI); }}
                            className={`p-2 rounded-lg text-center text-xs transition-all border ${
                              callOITrend === s.callOI && putOITrend === s.putOI
                                ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-card/50 hover:border-primary/30'
                            }`}>
                            <div className="text-lg mb-0.5">{s.icon}</div>
                            <div className="font-medium text-[10px] leading-tight">{s.signal}</div>
                            <div className="text-muted-foreground text-[9px] mt-0.5">C:{s.callOI.charAt(0)} P:{s.putOI.charAt(0)}</div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* ── Live LTP Levels Chart ── */}
              {effectiveLevels && (
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      📍 Live LTP Levels
                      <Badge className="bg-orange-500/20 text-orange-400">EOS / EOR / Diversions / CMP</Badge>
                      {effectiveLevels.source === 'api' && <Badge className="bg-green-500/20 text-green-400 text-[10px]">🟢 NSE Live OI</Badge>}
                      {effectiveLevels.source === 'simulated' && <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">🔵 Simulated</Badge>}
                      {effectiveLevels.source === 'manual' && <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Manual</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {/* OI-based level summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                        <div className="text-[10px] text-green-400/70">EOS (Support)</div>
                        <div className="text-sm font-bold text-green-400">{effectiveLevels.EOS.toLocaleString()}</div>
                        {effectiveLevels.maxPutOI && <div className="text-[9px] text-green-400/50">Put OI: {(effectiveLevels.maxPutOI / 100000).toFixed(1)}L</div>}
                      </div>
                      <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                        <div className="text-[10px] text-red-400/70">EOR (Resistance)</div>
                        <div className="text-sm font-bold text-red-400">{effectiveLevels.EOR.toLocaleString()}</div>
                        {effectiveLevels.maxCallOI && <div className="text-[9px] text-red-400/50">Call OI: {(effectiveLevels.maxCallOI / 100000).toFixed(1)}L</div>}
                      </div>
                      <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
                        <div className="text-[10px] text-orange-400/70">CMP (Spot)</div>
                        <div className="text-sm font-bold text-orange-400">{spotPrice.toLocaleString()}</div>
                        <div className="text-[9px] text-orange-400/50">{spotPrice > effectiveLevels.EOS && spotPrice < effectiveLevels.EOR ? 'In Range ✅' : spotPrice >= effectiveLevels.EOR ? 'Near Resistance ⚠️' : 'Near Support ⚠️'}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                        <div className="text-[10px] text-yellow-400/70">Diversions</div>
                        <div className="text-sm font-bold text-yellow-400">{effectiveLevels.diversions.length}</div>
                        <div className="text-[9px] text-yellow-400/50">D1–D{effectiveLevels.diversions.length}</div>
                      </div>
                    </div>
                    <div style={{ minHeight: 288 }}>
                      <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={0}>
                        <LineChart data={[
                          { idx: 0, price: effectiveLevels.priceMin },
                          { idx: 1, price: effectiveLevels.priceMax },
                        ]}>
                          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
                          <XAxis dataKey="idx" hide />
                          <YAxis
                            domain={[effectiveLevels.priceMin, effectiveLevels.priceMax]}
                            tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                            tickFormatter={(v) => v.toFixed(0)}
                            width={55}
                          />

                          {/* EOS Extended */}
                          {effectiveLevels.eosExt && (
                            <ReferenceLine
                              y={effectiveLevels.eosExt}
                              stroke="#22c55e"
                              strokeDasharray="8 4"
                              strokeWidth={1}
                              strokeOpacity={0.5}
                              label={{ value: `EOS-1 ${effectiveLevels.eosExt}`, position: 'left', fill: '#22c55e', fontSize: 9, fillOpacity: 0.6 }}
                            />
                          )}

                          {/* EOR Extended */}
                          {effectiveLevels.eorExt && (
                            <ReferenceLine
                              y={effectiveLevels.eorExt}
                              stroke="#ef4444"
                              strokeDasharray="8 4"
                              strokeWidth={1}
                              strokeOpacity={0.5}
                              label={{ value: `EOR+1 ${effectiveLevels.eorExt}`, position: 'left', fill: '#ef4444', fontSize: 9, fillOpacity: 0.6 }}
                            />
                          )}

                          {/* CMP (Current Market Price) */}
                          <ReferenceLine
                            y={spotPrice}
                            stroke={CHART_COLORS.spot}
                            strokeWidth={2.5}
                            strokeDasharray="6 3"
                            label={{ value: `CMP ${spotPrice.toFixed(0)}`, position: 'right', fill: CHART_COLORS.spot, fontSize: 11, fontWeight: 700 }}
                          />

                          {/* EOS (Support) */}
                          <ReferenceLine
                            y={effectiveLevels.EOS}
                            stroke="#22c55e"
                            strokeWidth={2}
                            label={{ value: `EOS ${effectiveLevels.EOS}`, position: 'right', fill: '#22c55e', fontSize: 11, fontWeight: 600 }}
                          />

                          {/* EOR (Resistance) */}
                          <ReferenceLine
                            y={effectiveLevels.EOR}
                            stroke="#ef4444"
                            strokeWidth={2}
                            label={{ value: `EOR ${effectiveLevels.EOR}`, position: 'right', fill: '#ef4444', fontSize: 11, fontWeight: 600 }}
                          />

                          {/* Diversions: D1, D2, D3... */}
                          {effectiveLevels.diversions.map((level, idx) => (
                            <ReferenceLine
                              key={idx}
                              y={level}
                              stroke="#eab308"
                              strokeDasharray="4 4"
                              strokeWidth={1.2}
                              label={{ value: `D${idx + 1} ${Math.round(level)}`, position: 'right', fill: '#eab308', fontSize: 10 }}
                            />
                          ))}

                          <Tooltip contentStyle={ChartTooltipStyle} formatter={(value) => [`${value.toFixed(0)}`, 'Price']} />
                          <Line type="monotone" dataKey="price" stroke="transparent" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Level legend */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 bg-green-500 rounded" />
                        <span className="text-green-400">EOS (Support)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 bg-red-500 rounded" />
                        <span className="text-red-400">EOR (Resistance)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 bg-yellow-500 rounded" style={{ borderTop: '1px dashed #eab308' }} />
                        <span className="text-yellow-400">Diversions (D1, D2…)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-0.5 bg-orange-500 rounded" style={{ borderTop: '2px dashed #f97316' }} />
                        <span className="text-orange-400">CMP (Spot)</span>
                      </div>
                      {effectiveLevels.eosExt && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-0.5 bg-green-500/40 rounded" />
                          <span className="text-green-400/60">EOS-1 / EOR+1 (Extensions)</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">COA 1.0 — All 9 Scenarios Quick Reference</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-2 px-2 text-left">#</th>
                          <th className="py-2 px-2 text-left">Scenario</th>
                          <th className="py-2 px-2 text-center">Support</th>
                          <th className="py-2 px-2 text-center">Resistance</th>
                          <th className="py-2 px-2 text-center">Bias</th>
                          <th className="py-2 px-2 text-center">Top</th>
                          <th className="py-2 px-2 text-center">Bottom</th>
                          <th className="py-2 px-2 text-center">Tradable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {COA_SCENARIOS.map(s => (
                          <tr key={s.id} onClick={() => { setSupportStrength(s.support); setResistanceStrength(s.resistance); }}
                            className={`border-b border-border/30 cursor-pointer hover:bg-card/50 ${
                              supportStrength === s.support && resistanceStrength === s.resistance ? 'bg-primary/10' : ''
                            }`}>
                            <td className="py-1.5 px-2 font-bold">{s.id}</td>
                            <td className="py-1.5 px-2 font-medium">{s.name}</td>
                            <td className={`py-1.5 px-2 text-center ${s.support === 'Strong' ? 'text-green-400' : s.support === 'WTB' ? 'text-red-400' : 'text-blue-400'}`}>{s.support}</td>
                            <td className={`py-1.5 px-2 text-center ${s.resistance === 'Strong' ? 'text-green-400' : s.resistance === 'WTB' ? 'text-red-400' : 'text-blue-400'}`}>{s.resistance}</td>
                            <td className={`py-1.5 px-2 text-center font-medium ${s.bias.includes('Bullish') ? 'text-green-400' : s.bias.includes('Bearish') ? 'text-red-400' : s.bias.includes('Non') ? 'text-gray-400' : 'text-blue-400'}`}>{s.bias}</td>
                            <td className="py-1.5 px-2 text-center text-red-400">{s.top}</td>
                            <td className="py-1.5 px-2 text-center text-green-400">{s.bottom}</td>
                            <td className="py-1.5 px-2 text-center">{s.tradable ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ═══════ TAB 4: TRADE FINDER ═══════ */}
          {activeTab === 'strategy' && (
            <motion.div key="strategy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-muted-foreground block mb-2">Market Outlook</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'bullish', label: '🟢 Bullish', color: 'green' },
                        { id: 'neutral', label: '⚖️ Neutral', color: 'blue' },
                        { id: 'bearish', label: '🔴 Bearish', color: 'red' },
                      ].map(o => (
                        <button key={o.id} onClick={() => setMarketOutlook(o.id)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            marketOutlook === o.id
                              ? `bg-${o.color}-500/20 border-2 border-${o.color}-500 text-${o.color}-400`
                              : 'bg-card border border-border text-muted-foreground'
                          }`}>{o.label}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-muted-foreground block mb-2">Risk Appetite</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'conservative', label: '🛡️ Safe' },
                        { id: 'moderate', label: '⚖️ Moderate' },
                        { id: 'aggressive', label: '🔥 Aggressive' },
                      ].map(r => (
                        <button key={r.id} onClick={() => setRiskAppetite(r.id)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            riskAppetite === r.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground'
                          }`}>{r.label}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-muted-foreground block mb-2">{selectedIndex} Spot Price</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-background border border-border px-3 py-2.5 text-sm font-bold text-primary">
                        {spotPrice > 0 ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : 'Loading...'}
                      </div>
                      <Badge className={spotChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {spotChange >= 0 ? '▲' : '▼'} {Math.abs(spotChange).toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Support: {maxOI.putStrike || '—'} | Resistance: {maxOI.callStrike || '—'} | PCR: {pcrOI || '—'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {tradeSuggestions.length === 0 && (
                  <Card className="glass-card p-8 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-muted-foreground">{spotPrice === 0 ? 'Loading market data...' : 'Adjust your outlook and risk settings to see strategy suggestions'}</p>
                  </Card>
                )}

                {tradeSuggestions.map((trade, idx) => (
                  <motion.div key={trade.name + idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                    <Card className="glass-card hover:ring-1 hover:ring-primary/30 transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">{idx + 1}</div>
                            <div>
                              <h3 className="font-bold text-lg">{trade.name}</h3>
                              <div className="text-xs text-muted-foreground">{trade.timeframe} • {trade.risk} risk</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 rounded-full bg-card border border-border overflow-hidden">
                                <div className={`h-full rounded-full ${trade.confidence >= 70 ? 'bg-green-500' : trade.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${trade.confidence}%` }} />
                              </div>
                              <span className="text-xs font-bold">{trade.confidence}%</span>
                            </div>
                            <div className="text-xs text-muted-foreground">Confidence</div>
                          </div>
                        </div>
                        <div className="mb-4 space-y-2">
                          {trade.legs.map((leg, li) => (
                            <div key={li} className={`flex items-center gap-3 p-2.5 rounded-lg ${leg.type === 'Buy' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                              <Badge className={leg.type === 'Buy' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}>{leg.type}</Badge>
                              <span className={`font-bold ${leg.option === 'CE' ? 'text-green-400' : 'text-red-400'}`}>{leg.strike} {leg.option}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{leg.action}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                          <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                            <div className="text-muted-foreground">Max Profit</div>
                            <div className="font-bold text-green-400">{trade.maxProfit}</div>
                          </div>
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                            <div className="text-muted-foreground">Max Loss</div>
                            <div className="font-bold text-red-400">{trade.maxLoss}</div>
                          </div>
                          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                            <div className="text-muted-foreground">Win Rate</div>
                            <div className="font-bold text-blue-400">{trade.winRate}</div>
                          </div>
                          <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                            <div className="text-muted-foreground">Risk Level</div>
                            <div className="font-bold text-purple-400">{trade.risk}</div>
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-card border border-border text-xs text-muted-foreground">
                          <span className="text-primary font-semibold">📊 Reasoning:</span> {trade.reasoning}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">
                ⚠️ Strategy suggestions are based on live OI data analysis and market outlook inputs. They are NOT financial advice. Always do your own analysis and use proper risk management.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>
    </PageLayout>
  );
}
