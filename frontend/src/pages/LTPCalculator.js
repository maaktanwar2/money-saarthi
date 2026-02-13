import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge } from '../components/ui';
import { formatINR } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// LTP CALCULATOR - Advanced P&L Calculator + Option Chain Analysis + COA
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'calculator', label: '🧮 P&L Calculator', desc: 'Position P&L & Breakeven' },
  { id: 'optionchain', label: '📊 Option Chain', desc: 'OI Analysis & Levels' },
  { id: 'coa', label: '📈 COA Analysis', desc: '9 Scenario Framework' },
  { id: 'strategy', label: '🎯 Trade Finder', desc: 'Auto Strategy Suggestions' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// NIFTY STRIKES & MOCK OI DATA (simulated for demonstration)
// ═══════════════════════════════════════════════════════════════════════════════
const generateOptionChainData = (spotPrice) => {
  const roundedSpot = Math.round(spotPrice / 50) * 50;
  const strikes = [];
  for (let i = -10; i <= 10; i++) {
    const strike = roundedSpot + i * 50;
    const dist = Math.abs(strike - spotPrice);
    const isITMCall = strike < spotPrice;
    const isITMPut = strike > spotPrice;
    const isATM = dist < 25;

    // Simulated OI data based on distance from ATM
    const baseCallOI = Math.max(50000, 800000 - dist * 2000 + (isITMCall ? -200000 : 100000));
    const basePutOI = Math.max(50000, 800000 - dist * 2000 + (isITMPut ? -200000 : 100000));
    const callOIChange = Math.round((Math.random() - 0.4) * baseCallOI * 0.15);
    const putOIChange = Math.round((Math.random() - 0.4) * basePutOI * 0.15);

    // Simulated LTP
    const callIV = 12 + dist * 0.02 + Math.random() * 2;
    const putIV = 12 + dist * 0.02 + Math.random() * 2;
    const callLTP = isITMCall
      ? Math.max(5, spotPrice - strike + Math.random() * 30)
      : Math.max(1, 200 - dist * 0.8 + Math.random() * 20);
    const putLTP = isITMPut
      ? Math.max(5, strike - spotPrice + Math.random() * 30)
      : Math.max(1, 200 - dist * 0.8 + Math.random() * 20);

    const callVol = Math.round(10000 + Math.random() * 50000 * (isATM ? 3 : 1));
    const putVol = Math.round(10000 + Math.random() * 50000 * (isATM ? 3 : 1));

    strikes.push({
      strike,
      isATM,
      isITMCall,
      isITMPut,
      call: {
        oi: Math.round(baseCallOI / 1000) * 1000,
        oiChange: callOIChange,
        volume: callVol,
        iv: callIV.toFixed(1),
        ltp: callLTP.toFixed(2),
        change: (Math.random() * 40 - 20).toFixed(2),
      },
      put: {
        oi: Math.round(basePutOI / 1000) * 1000,
        oiChange: putOIChange,
        volume: putVol,
        iv: putIV.toFixed(1),
        ltp: putLTP.toFixed(2),
        change: (Math.random() * 40 - 20).toFixed(2),
      },
    });
  }
  return strikes;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COA 1.0 - 9 SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════
const COA_SCENARIOS = [
  {
    id: 1,
    name: 'Both Strong',
    support: 'Strong',
    resistance: 'Strong',
    type: 'ideal',
    color: 'green',
    tradable: true,
    top: 'EOR',
    bottom: 'EOS',
    bias: 'Neutral (Range-Bound)',
    action: 'EOS पर Buy CE / Sell PE | EOR पर Sell CE / Buy PE',
    description: 'Most ideal scenario. Market oscillates between strong support and resistance. First hit on either level is safest.',
    riskLevel: 'Low',
  },
  {
    id: 2,
    name: 'Sup Strong, Res WTB',
    support: 'Strong',
    resistance: 'WTB',
    type: 'bearish',
    color: 'red',
    tradable: true,
    top: 'EOR',
    bottom: 'EOS-1',
    bias: 'Bearish',
    action: 'Avoid buying calls near resistance. Support may break → EOS-1 target.',
    description: 'Resistance is weak towards bottom — bearish pressure building. Support may breakdown eventually.',
    riskLevel: 'Medium',
  },
  {
    id: 3,
    name: 'Sup Strong, Res WTT',
    support: 'Strong',
    resistance: 'WTT',
    type: 'bullish',
    color: 'green',
    tradable: true,
    top: 'WTT-1',
    bottom: 'EOS',
    bias: 'Bullish',
    action: 'Resistance will break. Buy CE on dips. Target WTT-1 (next diversion above resistance).',
    description: 'Resistance is weak towards top — bullish breakout expected. Strong support gives confidence for longs.',
    riskLevel: 'Medium',
  },
  {
    id: 4,
    name: 'Sup WTB, Res Strong',
    support: 'WTB',
    resistance: 'Strong',
    type: 'bearish',
    color: 'red',
    tradable: true,
    top: 'EOR',
    bottom: 'WTB+1',
    bias: 'Bearish',
    action: 'Support will break. Sell CE / Buy PE near resistance. Target WTB+1.',
    description: 'Support is weak towards bottom — will likely breakdown. Strong resistance caps upside.',
    riskLevel: 'Medium',
  },
  {
    id: 5,
    name: 'Sup WTT, Res Strong',
    support: 'WTT',
    resistance: 'Strong',
    type: 'bullish',
    color: 'green',
    tradable: true,
    top: 'EOR+1',
    bottom: 'EOS',
    bias: 'Bullish',
    action: 'Bullish pressure near resistance. Resistance will break → target EOR+1.',
    description: 'Support has bullish pressure (WTT) pushing market up. Resistance will eventually break.',
    riskLevel: 'Medium',
  },
  {
    id: 6,
    name: 'Both WTB (Blood Bath)',
    support: 'WTB',
    resistance: 'WTB',
    type: 'crash',
    color: 'red',
    tradable: true,
    top: 'EOR',
    bottom: 'N/A (unpredictable)',
    bias: 'Highly Bearish',
    action: '🚨 NEVER take bullish trades. Only sell CE or buy deep PE. Stop loss mandatory.',
    description: 'Double bearish pressure — blood bath scenario. No bottom predictable. Only bearish trades allowed.',
    riskLevel: 'Very High',
  },
  {
    id: 7,
    name: 'Both WTT (Bull Run)',
    support: 'WTT',
    resistance: 'WTT',
    type: 'rally',
    color: 'green',
    tradable: true,
    top: 'N/A (unpredictable)',
    bottom: 'EOS',
    bias: 'Highly Bullish',
    action: '🚀 NEVER take bearish trades. Only buy CE or sell PE. Ride the momentum.',
    description: 'Double bullish pressure — bull run scenario. No top predictable. Only bullish trades allowed.',
    riskLevel: 'Very High',
  },
  {
    id: 8,
    name: 'Sup WTB, Res WTT',
    support: 'WTB',
    resistance: 'WTT',
    type: 'avoid',
    color: 'gray',
    tradable: false,
    top: 'N/A',
    bottom: 'N/A',
    bias: 'Non-Tradable',
    action: '⛔ DO NOT TRADE. Premature situation. Wait for clarity.',
    description: 'Conflicting signals — support weak downward, resistance weak upward. Completely avoid trading.',
    riskLevel: 'Extreme',
  },
  {
    id: 9,
    name: 'Sup WTT, Res WTB',
    support: 'WTT',
    resistance: 'WTB',
    type: 'avoid',
    color: 'gray',
    tradable: false,
    top: 'N/A',
    bottom: 'N/A',
    bias: 'Non-Tradable',
    action: '⛔ DO NOT TRADE. Premature situation. Wait for clarity.',
    description: 'Conflicting signals — support weak upward, resistance weak downward. Completely avoid trading.',
    riskLevel: 'Extreme',
  },
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LTPCalculator() {
  const [activeTab, setActiveTab] = useState('calculator');

  // ── P&L Calculator State ──
  const [calcType, setCalcType] = useState('long'); // long/short
  const [segment, setSegment] = useState('equity'); // equity/futures/options
  const [entryPrice, setEntryPrice] = useState('');
  const [currentLTP, setCurrentLTP] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lotSize, setLotSize] = useState('75');

  // ── Option Chain State ──
  const [spotPrice, setSpotPrice] = useState(23200);
  const [selectedIndex, setSelectedIndex] = useState('NIFTY');

  // ── COA State ──
  const [supportStrength, setSupportStrength] = useState('Strong');
  const [resistanceStrength, setResistanceStrength] = useState('Strong');
  const [supportLevel, setSupportLevel] = useState('');
  const [resistanceLevel, setResistanceLevel] = useState('');

  // ── COA 2.0 State ──
  const [callOITrend, setCallOITrend] = useState('Stable');
  const [putOITrend, setPutOITrend] = useState('Stable');

  // ── Trade Finder State ──
  const [riskAppetite, setRiskAppetite] = useState('moderate'); // conservative/moderate/aggressive
  const [marketOutlook, setMarketOutlook] = useState('neutral'); // bullish/bearish/neutral

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
    const changePct = ((change / entry) * 100);
    const positionValue = ltp * effectiveQty;
    const entryValue = entry * effectiveQty;
    const pnl = change * effectiveQty;
    const pnlPct = ((pnl / entryValue) * 100);
    const breakeven = entry; // For simple positions

    // Brokerage estimation (₹20 per side for discount brokers)
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
      change: change.toFixed(2),
      changePct: changePct.toFixed(2),
      positionValue: positionValue.toFixed(0),
      entryValue: entryValue.toFixed(0),
      pnl: pnl.toFixed(0),
      pnlPct: pnlPct.toFixed(2),
      breakeven: breakeven.toFixed(2),
      brokerage: brokerage.toFixed(2),
      stt: stt.toFixed(2),
      exchangeCharges: exchangeCharges.toFixed(2),
      gst: gst.toFixed(2),
      sebiCharges: sebiCharges.toFixed(2),
      stampDuty: stampDuty.toFixed(2),
      totalCharges: totalCharges.toFixed(2),
      netPnl: netPnl.toFixed(0),
      isProfit: pnl > 0,
    };
  }, [entryPrice, currentLTP, quantity, lotSize, calcType, segment]);

  // ════════════════════════════════════════════════
  // OPTION CHAIN DATA
  // ════════════════════════════════════════════════
  const optionChainData = useMemo(() => generateOptionChainData(spotPrice), [spotPrice]);

  const maxOI = useMemo(() => {
    if (!optionChainData.length) return { callStrike: 0, putStrike: 0 };
    let maxCallOI = 0, maxPutOI = 0, callStrike = 0, putStrike = 0;
    optionChainData.forEach(row => {
      if (row.call.oi > maxCallOI) { maxCallOI = row.call.oi; callStrike = row.strike; }
      if (row.put.oi > maxPutOI) { maxPutOI = row.put.oi; putStrike = row.strike; }
    });
    return { callStrike, putStrike, maxCallOI, maxPutOI };
  }, [optionChainData]);

  // ════════════════════════════════════════════════
  // COA 1.0 MATCHING
  // ════════════════════════════════════════════════
  const matchedScenario = useMemo(() => {
    return COA_SCENARIOS.find(
      s => s.support === supportStrength && s.resistance === resistanceStrength
    );
  }, [supportStrength, resistanceStrength]);

  // ════════════════════════════════════════════════
  // COA 2.0 MATCHING
  // ════════════════════════════════════════════════
  const matchedCOA2 = useMemo(() => {
    return COA2_SCENARIOS.find(
      s => s.callOI === callOITrend && s.putOI === putOITrend
    );
  }, [callOITrend, putOITrend]);

  // ════════════════════════════════════════════════
  // TRADE FINDER - Auto Strategy Suggestions
  // ════════════════════════════════════════════════
  const tradeSuggestions = useMemo(() => {
    const suggestions = [];
    const spot = spotPrice;
    const atmStrike = Math.round(spot / 50) * 50;
    const otm1 = atmStrike + (marketOutlook === 'bearish' ? -150 : 150);
    const otm2 = atmStrike + (marketOutlook === 'bearish' ? -300 : 300);
    const resistance = maxOI.callStrike || atmStrike + 300;
    const support = maxOI.putStrike || atmStrike - 300;

    // Based on scenario + risk + outlook
    if (marketOutlook === 'bullish') {
      if (riskAppetite === 'conservative') {
        suggestions.push({
          name: 'Bull Put Spread',
          legs: [
            { type: 'Sell', option: 'PE', strike: atmStrike - 100, action: 'Sell OTM Put' },
            { type: 'Buy', option: 'PE', strike: atmStrike - 250, action: 'Buy Deep OTM Put (hedge)' },
          ],
          maxProfit: '₹3,000-5,000/lot',
          maxLoss: '₹7,500-10,000/lot',
          winRate: '65-70%',
          risk: 'Low-Medium',
          timeframe: 'Weekly expiry',
          reasoning: 'Max OI Put support at ' + support + '. Sell spread below support for premium collection.',
          confidence: 75,
        });
      }
      if (riskAppetite !== 'conservative') {
        suggestions.push({
          name: 'Long Call (OTM)',
          legs: [
            { type: 'Buy', option: 'CE', strike: atmStrike + 100, action: 'Buy OTM Call' },
          ],
          maxProfit: 'Unlimited',
          maxLoss: 'Premium paid (~₹150-300)',
          winRate: '40-50%',
          risk: 'Medium',
          timeframe: '2-5 days',
          reasoning: 'Bullish momentum expected. Resistance at ' + resistance + '. Target: break above ATM.',
          confidence: 60,
        });
      }
      if (riskAppetite === 'aggressive') {
        suggestions.push({
          name: 'Naked Put Sell (ATM)',
          legs: [
            { type: 'Sell', option: 'PE', strike: atmStrike, action: 'Sell ATM Put' },
          ],
          maxProfit: 'Premium collected (~₹200-400)',
          maxLoss: 'Unlimited (use SL)',
          winRate: '55-60%',
          risk: 'Very High',
          timeframe: 'Weekly expiry',
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
          maxProfit: '₹3,000-5,000/lot',
          maxLoss: '₹7,500-10,000/lot',
          winRate: '65-70%',
          risk: 'Low-Medium',
          timeframe: 'Weekly expiry',
          reasoning: 'Max OI Call resistance at ' + resistance + '. Sell spread above resistance for premium.',
          confidence: 75,
        });
      }
      if (riskAppetite !== 'conservative') {
        suggestions.push({
          name: 'Long Put (OTM)',
          legs: [
            { type: 'Buy', option: 'PE', strike: atmStrike - 100, action: 'Buy OTM Put' },
          ],
          maxProfit: 'Unlimited',
          maxLoss: 'Premium paid (~₹150-300)',
          winRate: '40-50%',
          risk: 'Medium',
          timeframe: '2-5 days',
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
        maxProfit: 'Combined premium (~₹300-600)',
        maxLoss: 'Unlimited (hedge recommended)',
        winRate: '70-80%',
        risk: riskAppetite === 'aggressive' ? 'High' : 'Very High',
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
          maxProfit: '₹4,000-8,000/lot',
          maxLoss: '₹7,000-11,000/lot',
          winRate: '60-70%',
          risk: 'Low (Defined Risk)',
          timeframe: 'Weekly expiry',
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
        maxProfit: 'ATM premium minus hedge cost',
        maxLoss: '₹10,000-15,000/lot',
        winRate: '35-45%',
        risk: 'Medium (Defined)',
        timeframe: 'Weekly expiry',
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
        subtitle="P&L Calculator • Option Chain Analysis • COA Framework • Auto Strategy Suggestions"
      />

      {/* Tab Navigation */}
      <div className="flex gap-2 px-4 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-xs opacity-70 hidden sm:inline">({tab.desc})</span>
          </button>
        ))}
      </div>

      <Section>
        <AnimatePresence mode="wait">

          {/* ═══════ TAB 1: P&L CALCULATOR ═══════ */}
          {activeTab === 'calculator' && (
            <motion.div
              key="calc"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid lg:grid-cols-5 gap-6">
                {/* Input Panel */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle>Position Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Trade Type */}
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Trade Type</label>
                        <div className="flex gap-2">
                          {[
                            { id: 'long', label: '📈 Long (Buy)', color: 'green' },
                            { id: 'short', label: '📉 Short (Sell)', color: 'red' },
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setCalcType(t.id)}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                calcType === t.id
                                  ? t.id === 'long' ? 'bg-green-500/20 border-2 border-green-500 text-green-400' : 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                  : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Segment */}
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Segment</label>
                        <div className="flex gap-2">
                          {[
                            { id: 'equity', label: 'Equity' },
                            { id: 'futures', label: 'Futures' },
                            { id: 'options', label: 'Options' },
                          ].map(s => (
                            <button
                              key={s.id}
                              onClick={() => setSegment(s.id)}
                              className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                                segment === s.id
                                  ? 'bg-primary text-white'
                                  : 'bg-card border border-border text-muted-foreground'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Entry Price */}
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">
                          {calcType === 'long' ? 'Buy Price (Entry)' : 'Sell Price (Entry)'}
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g., 21500"
                          value={entryPrice}
                          onChange={e => setEntryPrice(e.target.value)}
                        />
                      </div>

                      {/* Current LTP */}
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Current LTP (Market Price)</label>
                        <Input
                          type="number"
                          placeholder="e.g., 21750"
                          value={currentLTP}
                          onChange={e => setCurrentLTP(e.target.value)}
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">
                          {segment === 'equity' ? 'Quantity (Shares)' : 'Number of Lots'}
                        </label>
                        <Input
                          type="number"
                          placeholder={segment === 'equity' ? 'e.g., 100' : 'e.g., 1'}
                          value={quantity}
                          onChange={e => setQuantity(e.target.value)}
                        />
                      </div>

                      {/* Lot Size */}
                      {segment !== 'equity' && (
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Lot Size</label>
                          <select
                            className="w-full rounded-lg bg-background border border-border px-3 py-2.5 text-sm"
                            value={lotSize}
                            onChange={e => setLotSize(e.target.value)}
                          >
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

                {/* Results Panel */}
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
                      {/* Main P&L Card */}
                      <Card className={`glass-card border-2 ${pnlResults.isProfit ? 'border-green-500/30' : 'border-red-500/30'}`}>
                        <CardContent className="p-6">
                          <div className="text-center mb-4">
                            <span className="text-5xl">{pnlResults.isProfit ? '🟢' : '🔴'}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center p-3 rounded-lg bg-card border border-border">
                              <div className={`text-2xl font-bold ${pnlResults.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                {formatINR(parseFloat(pnlResults.pnl))}
                              </div>
                              <div className="text-xs text-muted-foreground">Gross P&L</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-card border border-border">
                              <div className={`text-2xl font-bold ${pnlResults.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                {pnlResults.pnlPct}%
                              </div>
                              <div className="text-xs text-muted-foreground">P&L %</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-card border border-border">
                              <div className={`text-2xl font-bold ${parseFloat(pnlResults.netPnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatINR(parseFloat(pnlResults.netPnl))}
                              </div>
                              <div className="text-xs text-muted-foreground">Net P&L (after charges)</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Detailed Stats */}
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

          {/* ═══════ TAB 2: OPTION CHAIN ═══════ */}
          {activeTab === 'optionchain' && (
            <motion.div
              key="oc"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                  {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(idx => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedIndex(idx);
                        setSpotPrice(idx === 'NIFTY' ? 23200 : idx === 'BANKNIFTY' ? 49800 : 23650);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        selectedIndex === idx
                          ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground'
                      }`}
                    >
                      {idx}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Spot:</span>
                  <span className="font-bold text-primary">{spotPrice.toLocaleString()}</span>
                </div>
                <div className="ml-auto flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500/30" /> Max Call OI: <span className="font-bold">{maxOI.callStrike}</span> (Resistance)
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500/30" /> Max Put OI: <span className="font-bold">{maxOI.putStrike}</span> (Support)
                  </div>
                </div>
              </div>

              {/* Option Chain Table */}
              <Card className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-card/80">
                        <th colSpan="6" className="text-center py-2 text-green-400 border-b border-border font-semibold">
                          📞 CALLS
                        </th>
                        <th className="bg-primary/20 border-b border-border"></th>
                        <th colSpan="6" className="text-center py-2 text-red-400 border-b border-border font-semibold">
                          📞 PUTS
                        </th>
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
                          <tr
                            key={row.strike}
                            className={`border-b border-border/30 transition-colors ${
                              row.isATM ? 'bg-orange-500/10' :
                              row.isITMCall ? 'bg-green-500/5' : ''
                            } hover:bg-card/50`}
                          >
                            <td className={`py-1.5 px-2 text-right ${row.call.oiChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(row.call.oiChange / 1000).toFixed(0)}K
                            </td>
                            <td className={`py-1.5 px-2 text-right font-medium ${isMaxCallOI ? 'text-red-400 font-bold bg-red-500/10' : ''}`}>
                              {(row.call.oi / 1000).toFixed(0)}K
                            </td>
                            <td className="py-1.5 px-2 text-right text-muted-foreground">
                              {(row.call.volume / 1000).toFixed(0)}K
                            </td>
                            <td className="py-1.5 px-2 text-right text-muted-foreground">{row.call.iv}%</td>
                            <td className={`py-1.5 px-2 text-right ${parseFloat(row.call.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {row.call.change}
                            </td>
                            <td className="py-1.5 px-2 text-right font-medium">{row.call.ltp}</td>
                            <td className={`py-1.5 px-3 text-center font-bold bg-primary/10 ${row.isATM ? 'bg-orange-500/30 text-orange-300' : ''}`}>
                              {row.strike}
                            </td>
                            <td className="py-1.5 px-2 text-left font-medium">{row.put.ltp}</td>
                            <td className={`py-1.5 px-2 text-left ${parseFloat(row.put.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {row.put.change}
                            </td>
                            <td className="py-1.5 px-2 text-left text-muted-foreground">{row.put.iv}%</td>
                            <td className="py-1.5 px-2 text-left text-muted-foreground">
                              {(row.put.volume / 1000).toFixed(0)}K
                            </td>
                            <td className={`py-1.5 px-2 text-left font-medium ${isMaxPutOI ? 'text-green-400 font-bold bg-green-500/10' : ''}`}>
                              {(row.put.oi / 1000).toFixed(0)}K
                            </td>
                            <td className={`py-1.5 px-2 text-left ${row.put.oiChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(row.put.oiChange / 1000).toFixed(0)}K
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Key Levels Summary */}
              <div className="grid md:grid-cols-4 gap-4">
                <Card className="glass-card p-4 text-center border-green-500/30">
                  <div className="text-2xl mb-1">🟢</div>
                  <div className="text-lg font-bold text-green-400">{maxOI.putStrike}</div>
                  <div className="text-xs text-muted-foreground">Max Put OI (Support)</div>
                  <div className="text-xs text-green-400/70">{(maxOI.maxPutOI / 100000).toFixed(1)}L OI</div>
                </Card>
                <Card className="glass-card p-4 text-center border-orange-500/30">
                  <div className="text-2xl mb-1">🟠</div>
                  <div className="text-lg font-bold text-orange-400">{Math.round(spotPrice / 50) * 50}</div>
                  <div className="text-xs text-muted-foreground">ATM Strike</div>
                  <div className="text-xs text-orange-400/70">Spot: {spotPrice}</div>
                </Card>
                <Card className="glass-card p-4 text-center border-red-500/30">
                  <div className="text-2xl mb-1">🔴</div>
                  <div className="text-lg font-bold text-red-400">{maxOI.callStrike}</div>
                  <div className="text-xs text-muted-foreground">Max Call OI (Resistance)</div>
                  <div className="text-xs text-red-400/70">{(maxOI.maxCallOI / 100000).toFixed(1)}L OI</div>
                </Card>
                <Card className="glass-card p-4 text-center border-blue-500/30">
                  <div className="text-2xl mb-1">📏</div>
                  <div className="text-lg font-bold text-blue-400">{maxOI.callStrike - maxOI.putStrike} pts</div>
                  <div className="text-xs text-muted-foreground">Range Width</div>
                  <div className="text-xs text-blue-400/70">Support to Resistance</div>
                </Card>
              </div>
            </motion.div>
          )}

          {/* ═══════ TAB 3: COA ANALYSIS ═══════ */}
          {activeTab === 'coa' && (
            <motion.div
              key="coa"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid lg:grid-cols-2 gap-6">
                {/* COA 1.0 Panel */}
                <div className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        📊 Chart of Accuracy 1.0
                        <Badge className="bg-blue-500/20 text-blue-400">Support/Resistance</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Select the strength of Support and Resistance to identify the current market scenario and get trading direction.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Support Strength</label>
                          <div className="space-y-2">
                            {['Strong', 'WTB', 'WTT'].map(s => (
                              <button
                                key={s}
                                onClick={() => setSupportStrength(s)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  supportStrength === s
                                    ? s === 'Strong' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                      : s === 'WTB' ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                      : 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}
                              >
                                {s === 'Strong' ? '💪 Strong' : s === 'WTB' ? '📉 Weak → Bottom' : '📈 Weak → Top'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Resistance Strength</label>
                          <div className="space-y-2">
                            {['Strong', 'WTB', 'WTT'].map(r => (
                              <button
                                key={r}
                                onClick={() => setResistanceStrength(r)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  resistanceStrength === r
                                    ? r === 'Strong' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                      : r === 'WTB' ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                      : 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}
                              >
                                {r === 'Strong' ? '💪 Strong' : r === 'WTB' ? '📉 Weak → Bottom' : '📈 Weak → Top'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Optional levels */}
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

                  {/* COA 1.0 Result */}
                  {matchedScenario && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className={`glass-card border-2 ${
                        matchedScenario.type === 'ideal' ? 'border-green-500/40' :
                        matchedScenario.type === 'bullish' || matchedScenario.type === 'rally' ? 'border-green-500/40' :
                        matchedScenario.type === 'bearish' || matchedScenario.type === 'crash' ? 'border-red-500/40' :
                        'border-gray-500/40'
                      }`}>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">
                              {matchedScenario.type === 'ideal' ? '⚖️' :
                               matchedScenario.type === 'bullish' ? '🟢' :
                               matchedScenario.type === 'rally' ? '🚀' :
                               matchedScenario.type === 'bearish' ? '🔴' :
                               matchedScenario.type === 'crash' ? '💀' : '⛔'}
                            </span>
                            <div>
                              <h3 className="font-bold text-lg">Scenario #{matchedScenario.id}: {matchedScenario.name}</h3>
                              <Badge className={`${
                                matchedScenario.tradable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {matchedScenario.tradable ? '✅ Tradable' : '❌ Non-Tradable'}
                              </Badge>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-4">{matchedScenario.description}</p>

                          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                            <div className="p-3 rounded-lg bg-card border border-border">
                              <div className="text-xs text-muted-foreground">Market Bias</div>
                              <div className={`font-bold ${
                                matchedScenario.bias.includes('Bullish') ? 'text-green-400' :
                                matchedScenario.bias.includes('Bearish') ? 'text-red-400' : 'text-blue-400'
                              }`}>{matchedScenario.bias}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-card border border-border">
                              <div className="text-xs text-muted-foreground">Risk Level</div>
                              <div className={`font-bold ${
                                matchedScenario.riskLevel === 'Low' ? 'text-green-400' :
                                matchedScenario.riskLevel === 'Medium' ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>{matchedScenario.riskLevel}</div>
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

                {/* COA 2.0 Panel */}
                <div className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        📈 Chart of Accuracy 2.0
                        <Badge className="bg-purple-500/20 text-purple-400">OI Based</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Analyze Open Interest trends to predict breakout/rejection at specific strike prices.
                        Use at diversion levels only, never at extensions.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Call Side OI Trend</label>
                          <div className="space-y-2">
                            {['Stable', 'Decreasing', 'Increasing'].map(t => (
                              <button
                                key={t}
                                onClick={() => setCallOITrend(t)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  callOITrend === t
                                    ? t === 'Stable' ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                                      : t === 'Decreasing' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                      : 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}
                              >
                                {t === 'Stable' ? '⚖️ Stable' : t === 'Decreasing' ? '📉 Decreasing' : '📈 Increasing'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Put Side OI Trend</label>
                          <div className="space-y-2">
                            {['Stable', 'Decreasing', 'Increasing'].map(t => (
                              <button
                                key={t}
                                onClick={() => setPutOITrend(t)}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                                  putOITrend === t
                                    ? t === 'Stable' ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                                      : t === 'Decreasing' ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                      : 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                    : 'bg-card border border-border text-muted-foreground'
                                }`}
                              >
                                {t === 'Stable' ? '⚖️ Stable' : t === 'Decreasing' ? '📉 Decreasing' : '📈 Increasing'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* COA 2.0 Result */}
                  {matchedCOA2 && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className={`glass-card border-2 ${
                        matchedCOA2.color === 'green' ? 'border-green-500/40' :
                        matchedCOA2.color === 'red' ? 'border-red-500/40' :
                        matchedCOA2.color === 'purple' ? 'border-purple-500/40' :
                        matchedCOA2.color === 'yellow' ? 'border-yellow-500/40' :
                        'border-gray-500/40'
                      }`}>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{matchedCOA2.icon}</span>
                            <div>
                              <h3 className="font-bold text-lg">{matchedCOA2.signal}</h3>
                              <div className="text-xs text-muted-foreground">
                                Call OI: {matchedCOA2.callOI} | Put OI: {matchedCOA2.putOI}
                              </div>
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

                  {/* All 9 Scenarios Grid */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm">COA 2.0 — All 9 Combinations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {COA2_SCENARIOS.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => { setCallOITrend(s.callOI); setPutOITrend(s.putOI); }}
                            className={`p-2 rounded-lg text-center text-xs transition-all border ${
                              callOITrend === s.callOI && putOITrend === s.putOI
                                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                                : 'border-border bg-card/50 hover:border-primary/30'
                            }`}
                          >
                            <div className="text-lg mb-0.5">{s.icon}</div>
                            <div className="font-medium text-[10px] leading-tight">{s.signal}</div>
                            <div className="text-muted-foreground text-[9px] mt-0.5">
                              C:{s.callOI.charAt(0)} P:{s.putOI.charAt(0)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* COA 1.0 All Scenarios Reference */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm">COA 1.0 — All 9 Scenarios Quick Reference</CardTitle>
                </CardHeader>
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
                          <tr
                            key={s.id}
                            onClick={() => { setSupportStrength(s.support); setResistanceStrength(s.resistance); }}
                            className={`border-b border-border/30 cursor-pointer hover:bg-card/50 ${
                              supportStrength === s.support && resistanceStrength === s.resistance ? 'bg-primary/10' : ''
                            }`}
                          >
                            <td className="py-1.5 px-2 font-bold">{s.id}</td>
                            <td className="py-1.5 px-2 font-medium">{s.name}</td>
                            <td className={`py-1.5 px-2 text-center ${
                              s.support === 'Strong' ? 'text-green-400' : s.support === 'WTB' ? 'text-red-400' : 'text-blue-400'
                            }`}>{s.support}</td>
                            <td className={`py-1.5 px-2 text-center ${
                              s.resistance === 'Strong' ? 'text-green-400' : s.resistance === 'WTB' ? 'text-red-400' : 'text-blue-400'
                            }`}>{s.resistance}</td>
                            <td className={`py-1.5 px-2 text-center font-medium ${
                              s.bias.includes('Bullish') ? 'text-green-400' :
                              s.bias.includes('Bearish') ? 'text-red-400' :
                              s.bias.includes('Non') ? 'text-gray-400' : 'text-blue-400'
                            }`}>{s.bias}</td>
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
            <motion.div
              key="strategy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Config */}
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
                        <button
                          key={o.id}
                          onClick={() => setMarketOutlook(o.id)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            marketOutlook === o.id
                              ? `bg-${o.color}-500/20 border-2 border-${o.color}-500 text-${o.color}-400`
                              : 'bg-card border border-border text-muted-foreground'
                          }`}
                        >
                          {o.label}
                        </button>
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
                        <button
                          key={r.id}
                          onClick={() => setRiskAppetite(r.id)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            riskAppetite === r.id
                              ? 'bg-primary text-white'
                              : 'bg-card border border-border text-muted-foreground'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-muted-foreground block mb-2">NIFTY Spot Price</label>
                    <Input
                      type="number"
                      value={spotPrice}
                      onChange={e => setSpotPrice(parseInt(e.target.value) || 23200)}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Support: {maxOI.putStrike} | Resistance: {maxOI.callStrike}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trade Suggestions */}
              <div className="space-y-4">
                {tradeSuggestions.length === 0 && (
                  <Card className="glass-card p-8 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-muted-foreground">
                      Adjust your outlook and risk settings to see strategy suggestions
                    </p>
                  </Card>
                )}

                {tradeSuggestions.map((trade, idx) => (
                  <motion.div
                    key={trade.name + idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className="glass-card hover:ring-1 hover:ring-primary/30 transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                              {idx + 1}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{trade.name}</h3>
                              <div className="text-xs text-muted-foreground">{trade.timeframe} • {trade.risk} risk</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 rounded-full bg-card border border-border overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${trade.confidence >= 70 ? 'bg-green-500' : trade.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${trade.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold">{trade.confidence}%</span>
                            </div>
                            <div className="text-xs text-muted-foreground">Confidence</div>
                          </div>
                        </div>

                        {/* Trade Legs */}
                        <div className="mb-4 space-y-2">
                          {trade.legs.map((leg, li) => (
                            <div
                              key={li}
                              className={`flex items-center gap-3 p-2.5 rounded-lg ${
                                leg.type === 'Buy' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                              }`}
                            >
                              <Badge className={`${
                                leg.type === 'Buy' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'
                              }`}>
                                {leg.type}
                              </Badge>
                              <span className={`font-bold ${leg.option === 'CE' ? 'text-green-400' : 'text-red-400'}`}>
                                {leg.strike} {leg.option}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">{leg.action}</span>
                            </div>
                          ))}
                        </div>

                        {/* Stats */}
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

              {/* Disclaimer */}
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">
                ⚠️ Strategy suggestions are based on OI data analysis and market outlook inputs. They are NOT financial advice. Always do your own analysis and use proper risk management. Past performance doesn't guarantee future results.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>
    </PageLayout>
  );
}
