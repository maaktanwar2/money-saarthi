import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { fetchAPI, isMarketHours } from '../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE FINDER — Full Advanced Page
// 5 Tabs: Strategy Finder | OI Sentiment | Option Clock | OI Blocks | Swing Spectrum
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'strategy',  label: '🎯 Strategy Finder',  desc: 'OI-backed trade suggestions' },
  { id: 'sentiment', label: '📊 OI Sentiment',      desc: 'PCR, ΔOI, Support/Resistance' },
  { id: 'clock',     label: '🕐 Option Clock',      desc: 'Time-slice OI targets' },
  { id: 'blocks',    label: '🧱 OI Blocks',         desc: 'Candle-wise momentum' },
  { id: 'swing',     label: '📈 Swing Spectrum',    desc: 'Breakout & NR7 scanners' },
];

const ChartTooltipStyle = {
  backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px',
  color: '#e5e7eb', fontSize: '12px',
};

// ─── Small reusable cards ───────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'primary', icon }) => (
  <div className={`p-3 rounded-lg bg-${color}-500/10 border border-${color}-500/20`}>
    <div className="text-xs text-foreground-muted">{icon} {label}</div>
    <div className={`font-bold text-sm text-${color}-400 mt-0.5`}>{value}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function TradeFinder() {
  const [activeTab, setActiveTab] = useState('strategy');
  const [selectedIndex, setSelectedIndex] = useState('NIFTY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);

  // ── Inputs ──
  const [riskAppetite, setRiskAppetite] = useState('moderate');
  const [marketOutlook, setMarketOutlook] = useState('neutral');

  // ── Data from backend ──
  const [analysis, setAnalysis] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [clockData, setClockData] = useState(null);
  const [blocksData, setBlocksData] = useState(null);
  const [swingData, setSwingData] = useState(null);
  const [spotPrice, setSpotPrice] = useState(0);
  const [spotChange, setSpotChange] = useState(0);

  // ════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ════════════════════════════════════════════════════════════════════════
  const fetchData = useCallback(async (index) => {
    const symbol = index || selectedIndex;
    setLoading(true);
    setError(null);
    try {
      const [analyzeRes, sentimentRes, clockRes, blocksRes, swingRes, tickerRes] = await Promise.allSettled([
        fetchAPI(`/tradefinder/analyze/${symbol}?outlook=${marketOutlook}&risk=${riskAppetite}`),
        fetchAPI(`/tradefinder/oi-sentiment/${symbol}`),
        fetchAPI(`/tradefinder/option-clock/${symbol}`),
        fetchAPI(`/tradefinder/oi-blocks/${symbol}`),
        fetchAPI(`/tradefinder/swing-scan/${symbol}`),
        fetchAPI('/ticker-data'),
      ]);

      if (analyzeRes.status === 'fulfilled' && analyzeRes.value) {
        setAnalysis(analyzeRes.value);
        if (analyzeRes.value.spot > 0) setSpotPrice(analyzeRes.value.spot);
      }
      if (sentimentRes.status === 'fulfilled') setSentiment(sentimentRes.value);
      if (clockRes.status === 'fulfilled') setClockData(clockRes.value);
      if (blocksRes.status === 'fulfilled') setBlocksData(blocksRes.value);
      if (swingRes.status === 'fulfilled') setSwingData(swingRes.value);

      if (tickerRes.status === 'fulfilled' && Array.isArray(tickerRes.value)) {
        const t = tickerRes.value.find(x => x.symbol === symbol) || tickerRes.value.find(x => x.symbol === 'NIFTY');
        if (t) setSpotChange(t.change || 0);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('TradeFinder fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedIndex, marketOutlook, riskAppetite]);

  useEffect(() => { fetchData(); return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); }; }, [selectedIndex]); // eslint-disable-line
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => { if (isMarketHours()) fetchData(); }, 30000);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh, fetchData]);

  // Re-fetch strategies when outlook/risk changes
  useEffect(() => {
    if (spotPrice > 0) {
      fetchAPI(`/tradefinder/analyze/${selectedIndex}?outlook=${marketOutlook}&risk=${riskAppetite}`)
        .then(r => { if (r) setAnalysis(r); })
        .catch(() => {});
    }
  }, [marketOutlook, riskAppetite]); // eslint-disable-line

  // Derived
  const strategies = analysis?.strategies || [];
  const pcr = analysis?.pcr || {};
  const sr = analysis?.support_resistance || {};

  // OI change chart data
  const oiChangeChart = useMemo(() => {
    if (!sentiment?.oi_changes_top10) return [];
    return sentiment.oi_changes_top10.map(r => ({
      strike: r.strike,
      'Call OI Chg': Math.round((r.call_oi_change || 0) / 1000),
      'Put OI Chg': Math.round((r.put_oi_change || 0) / 1000),
    }));
  }, [sentiment]);

  // OI Blocks chart data
  const blocksChart = useMemo(() => {
    if (!blocksData?.blocks) return [];
    return blocksData.blocks.map(b => ({
      time: b.time,
      change: Math.round(b.price_change * 100) / 100,
      type: b.type,
    }));
  }, [blocksData]);

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <PageLayout>
      <PageHeader title="Trade Finder Pro" subtitle="OI Sentiment • Strategy Suggestions • Option Clock • OI Blocks • Swing Scanners" />

      {/* ── Status Bar ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isMarketHours() ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-foreground-muted">{isMarketHours() ? 'Market Open' : 'Market Closed'}</span>
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
        {lastUpdated && <span className="text-xs text-foreground-muted">Updated: {lastUpdated.toLocaleTimeString()}</span>}
        <div className="flex items-center gap-2 ml-auto">
          {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(idx => (
            <button key={idx} onClick={() => setSelectedIndex(idx)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${selectedIndex === idx ? 'bg-primary text-white' : 'bg-card border border-border text-foreground-muted hover:border-primary/50'}`}
            >{idx}</button>
          ))}
          <button onClick={() => fetchData()} disabled={loading}
            className="px-3 py-1 rounded-lg text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-50">
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button onClick={() => setAutoRefresh(p => !p)}
            className={`px-3 py-1 rounded-lg text-xs ${autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-card border border-border text-foreground-muted'}`}>
            {autoRefresh ? '🟢 Auto' : '⚪ Manual'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">❌ {error}</div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-4 mb-4 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-card border border-border text-foreground-muted hover:border-primary/50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <Section>
        <AnimatePresence mode="wait">

          {/* ═══════ TAB 1: STRATEGY FINDER ═══════ */}
          {activeTab === 'strategy' && (
            <motion.div key="strategy" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Controls */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-foreground-muted block mb-2">Market Outlook</label>
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
                              : 'bg-card border border-border text-foreground-muted'
                          }`}>{o.label}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-foreground-muted block mb-2">Risk Appetite</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'conservative', label: '🛡️ Safe' },
                        { id: 'moderate', label: '⚖️ Moderate' },
                        { id: 'aggressive', label: '🔥 Aggressive' },
                      ].map(r => (
                        <button key={r.id} onClick={() => setRiskAppetite(r.id)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            riskAppetite === r.id ? 'bg-primary text-white' : 'bg-card border border-border text-foreground-muted'
                          }`}>{r.label}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <label className="text-sm text-foreground-muted block mb-2">{selectedIndex} Spot</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg bg-background border border-border px-3 py-2.5 text-sm font-bold text-primary">
                        {spotPrice > 0 ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : 'Loading...'}
                      </div>
                      <Badge className={spotChange >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {spotChange >= 0 ? '▲' : '▼'} {Math.abs(spotChange).toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-foreground-muted mt-1">
                      Support: {sr.support || '—'} | Resistance: {sr.resistance || '—'} | PCR: {pcr.pcr_oi || '—'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* OI Interpretation Banner */}
              {analysis?.oi_interpretation && (
                <div className={`p-3 rounded-lg border text-sm flex items-center gap-3 ${
                  analysis.oi_interpretation.signal === 'Bullish' ? 'bg-green-500/10 border-green-500/30 text-green-300' :
                  analysis.oi_interpretation.signal === 'Bearish' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}>
                  <span className="text-xl">{analysis.oi_interpretation.icon}</span>
                  <div>
                    <span className="font-bold">{analysis.oi_interpretation.label}</span>
                    <span className="text-xs ml-2 opacity-80">{analysis.oi_interpretation.explanation}</span>
                  </div>
                </div>
              )}

              {/* Strategy cards */}
              <div className="space-y-4">
                {strategies.length === 0 && !loading && (
                  <Card className="glass-card p-8 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-foreground-muted">{spotPrice === 0 ? 'Loading market data...' : 'Adjust outlook & risk to see strategies'}</p>
                  </Card>
                )}
                {strategies.map((trade, idx) => (
                  <motion.div key={trade.name + idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
                    <Card className="glass-card hover:ring-1 hover:ring-primary/30 transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">{idx + 1}</div>
                            <div>
                              <h3 className="font-bold text-lg">{trade.name}</h3>
                              <div className="text-xs text-foreground-muted">{trade.timeframe} • {trade.risk} risk</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 rounded-full bg-card border border-border overflow-hidden">
                                <div className={`h-full rounded-full ${trade.confidence >= 70 ? 'bg-green-500' : trade.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${trade.confidence}%` }} />
                              </div>
                              <span className="text-xs font-bold">{trade.confidence}%</span>
                            </div>
                            <div className="text-xs text-foreground-muted">Confidence</div>
                          </div>
                        </div>
                        <div className="mb-4 space-y-2">
                          {trade.legs?.map((leg, li) => (
                            <div key={li} className={`flex items-center gap-3 p-2.5 rounded-lg ${leg.type === 'Buy' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                              <Badge className={leg.type === 'Buy' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}>{leg.type}</Badge>
                              <span className={`font-bold ${leg.option === 'CE' ? 'text-green-400' : 'text-red-400'}`}>{leg.strike} {leg.option}</span>
                              <span className="text-xs text-foreground-muted ml-auto">{leg.action}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                          <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                            <div className="text-foreground-muted">Max Profit</div>
                            <div className="font-bold text-green-400">{trade.maxProfit}</div>
                          </div>
                          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                            <div className="text-foreground-muted">Max Loss</div>
                            <div className="font-bold text-red-400">{trade.maxLoss}</div>
                          </div>
                          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                            <div className="text-foreground-muted">Win Rate</div>
                            <div className="font-bold text-blue-400">{trade.winRate}</div>
                          </div>
                          <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                            <div className="text-foreground-muted">Risk</div>
                            <div className="font-bold text-purple-400">{trade.risk}</div>
                          </div>
                        </div>
                        {trade.tags?.length > 0 && (
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {trade.tags.map(t => <Badge key={t} className="bg-primary/10 text-primary text-[10px]">{t}</Badge>)}
                          </div>
                        )}
                        <div className="p-2.5 rounded-lg bg-card border border-border text-xs text-foreground-muted">
                          <span className="text-primary font-semibold">📊 Reasoning:</span> {trade.reasoning}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">
                ⚠️ Strategies are based on live OI data. NOT financial advice. Use proper risk management.
              </div>
            </motion.div>
          )}

          {/* ═══════ TAB 2: OI SENTIMENT ═══════ */}
          {activeTab === 'sentiment' && (
            <motion.div key="sentiment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="PCR (OI)" value={sentiment?.pcr?.pcr_oi ?? '—'} color="blue" icon="📊" />
                <StatCard label="PCR (Volume)" value={sentiment?.pcr?.pcr_vol ?? '—'} color="purple" icon="📈" />
                <StatCard label="Sentiment" value={sentiment?.pcr?.sentiment ?? '—'} color={
                  sentiment?.pcr?.sentiment?.includes('Bullish') ? 'green' : sentiment?.pcr?.sentiment?.includes('Bearish') ? 'red' : 'blue'
                } icon="🎯" />
                <StatCard label="Interpretation" value={sentiment?.interpretation?.label ?? '—'} color={
                  sentiment?.interpretation?.signal === 'Bullish' ? 'green' : sentiment?.interpretation?.signal === 'Bearish' ? 'red' : 'yellow'
                } icon={sentiment?.interpretation?.icon ?? '⚪'} />
              </div>

              {/* Support / Resistance */}
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">OI-Based Support & Resistance</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs text-foreground-muted mb-2">🟢 Top 3 Support (Max Put OI)</h4>
                      {sentiment?.support_resistance?.top3_support?.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-2 mb-1 rounded bg-green-500/10 border border-green-500/20 text-sm">
                          <span className="font-bold text-green-400">{s.strike}</span>
                          <span className="text-xs text-foreground-muted">OI: {(s.put_oi / 100000).toFixed(1)}L</span>
                          <span className={`text-xs ${s.put_oi_chg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Δ {(s.put_oi_chg / 1000).toFixed(0)}K
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-xs text-foreground-muted mb-2">🔴 Top 3 Resistance (Max Call OI)</h4>
                      {sentiment?.support_resistance?.top3_resistance?.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-2 mb-1 rounded bg-red-500/10 border border-red-500/20 text-sm">
                          <span className="font-bold text-red-400">{s.strike}</span>
                          <span className="text-xs text-foreground-muted">OI: {(s.call_oi / 100000).toFixed(1)}L</span>
                          <span className={`text-xs ${s.call_oi_chg >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            Δ {(s.call_oi_chg / 1000).toFixed(0)}K
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* OI Change Chart */}
              {oiChangeChart.length > 0 && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-sm">Top OI Changes by Strike (in '000s)</CardTitle></CardHeader>
                  <CardContent>
                    <div style={{ minHeight: 288 }}>
                      <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={0}>
                        <BarChart data={oiChangeChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="strike" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                          <Tooltip contentStyle={ChartTooltipStyle} />
                          <Bar dataKey="Call OI Chg" fill="#ef4444" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Put OI Chg" fill="#22c55e" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* OI Interpretation matrix */}
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">📘 OI + Price Interpretation Matrix</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: 'Price ↑ + Call OI ↑', signal: '🟢 Long Build-Up', color: 'green' },
                      { label: 'Price ↑ + Put OI ↓', signal: '🟢 Short Covering', color: 'green' },
                      { label: 'Price ↓ + Put OI ↑', signal: '🔴 Short Build-Up', color: 'red' },
                      { label: 'Price ↓ + Call OI ↓', signal: '🔴 Long Unwinding', color: 'red' },
                      { label: 'PCR < 0.7', signal: '⚠️ Call Heavy (Bearish)', color: 'yellow' },
                      { label: 'PCR > 1.3', signal: '🟢 Put Heavy (Bullish)', color: 'green' },
                    ].map((item, i) => (
                      <div key={i} className={`p-2.5 rounded-lg bg-${item.color}-500/10 border border-${item.color}-500/20`}>
                        <div className="text-foreground-muted">{item.label}</div>
                        <div className={`font-bold text-${item.color}-400 mt-0.5`}>{item.signal}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ═══════ TAB 3: OPTION CLOCK ═══════ */}
          {activeTab === 'clock' && (
            <motion.div key="clock" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
                <StatCard label="Intraday Support" value={clockData?.targets?.intraday_support || '—'} color="green" icon="🛡️" />
                <StatCard label="Intraday Resistance" value={clockData?.targets?.intraday_resistance || '—'} color="red" icon="🧱" />
                <StatCard label="Max Put OI" value={clockData?.targets?.max_put_oi ? `${(clockData.targets.max_put_oi / 100000).toFixed(1)}L` : '—'} color="green" icon="📊" />
                <StatCard label="Max Call OI" value={clockData?.targets?.max_call_oi ? `${(clockData.targets.max_call_oi / 100000).toFixed(1)}L` : '—'} color="red" icon="📊" />
              </div>

              {clockData?.targets?.resistance_shifted && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">
                  ⚠️ Resistance shifted from {clockData.targets.first_resistance} → {clockData.targets.intraday_resistance} during the day
                </div>
              )}
              {clockData?.targets?.support_shifted && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">
                  ⚠️ Support shifted from {clockData.targets.first_support} → {clockData.targets.intraday_support} during the day
                </div>
              )}

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">🕐 OI Snapshots Timeline ({clockData?.snapshots_count || 0} stored)</CardTitle></CardHeader>
                <CardContent>
                  {clockData?.snapshots?.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {[...clockData.snapshots].reverse().map((snap, i) => {
                        const maxCe = snap.strikes?.reduce((a, b) => b.ce_oi > a.ce_oi ? b : a, { ce_oi: 0 });
                        const maxPe = snap.strikes?.reduce((a, b) => b.pe_oi > a.pe_oi ? b : a, { pe_oi: 0 });
                        return (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border text-sm">
                            <span className="font-mono font-bold text-primary w-14">{snap.time}</span>
                            <span className="text-foreground-muted">Spot: {snap.spot?.toLocaleString('en-IN')}</span>
                            <span className="text-green-400 text-xs">🛡️ {maxPe?.strike || '—'}</span>
                            <span className="text-red-400 text-xs">🧱 {maxCe?.strike || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-foreground-muted text-sm">
                      <div className="text-3xl mb-2">🕐</div>
                      No snapshots yet. Data builds as you refresh during market hours.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">📘 How Option Clock Works</CardTitle></CardHeader>
                <CardContent className="text-xs text-foreground-muted space-y-2">
                  <p>• Every refresh stores a time-slice snapshot of strike-wise CE & PE OI</p>
                  <p>• <strong className="text-primary">Intraday Support</strong> = strike with maximum Put OI at that time</p>
                  <p>• <strong className="text-primary">Intraday Resistance</strong> = strike with maximum Call OI at that time</p>
                  <p>• If max OI strike <strong className="text-yellow-400">shifts</strong> during the day → level broke, new target formed</p>
                  <p>• Price approaching MaxCallStrike from below → intraday resistance/target</p>
                  <p>• Price approaching MaxPutStrike from above → intraday support/target</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ═══════ TAB 4: OI BLOCKS ═══════ */}
          {activeTab === 'blocks' && (
            <motion.div key="blocks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {blocksData?.momentum && (
                <div className={`p-4 rounded-lg border text-sm flex items-center gap-4 ${
                  blocksData.momentum.momentum === 'bullish' ? 'bg-green-500/10 border-green-500/30' :
                  blocksData.momentum.momentum === 'bearish' ? 'bg-red-500/10 border-red-500/30' :
                  'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <span className="text-2xl">{
                    blocksData.momentum.momentum === 'bullish' ? '🟢' :
                    blocksData.momentum.momentum === 'bearish' ? '🔴' : '⚪'
                  }</span>
                  <div>
                    <div className="font-bold">{blocksData.momentum.signal}</div>
                    <div className="text-xs text-foreground-muted mt-0.5">
                      Bullish: {blocksData.momentum.total_bullish} | Bearish: {blocksData.momentum.total_bearish} | Neutral: {blocksData.momentum.total_neutral}
                    </div>
                  </div>
                </div>
              )}

              {blocksChart.length > 0 && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-sm">Candle-wise Price Change (OI Block coloring)</CardTitle></CardHeader>
                  <CardContent>
                    <div style={{ minHeight: 320 }}>
                      <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={0}>
                        <BarChart data={blocksChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                          <Tooltip contentStyle={ChartTooltipStyle} />
                          <ReferenceLine y={0} stroke="#6b7280" />
                          <Bar dataKey="change" radius={[2, 2, 0, 0]}>
                            {blocksChart.map((entry, i) => (
                              <Cell key={i} fill={entry.type === 'bullish' ? '#22c55e' : entry.type === 'bearish' ? '#ef4444' : '#6b7280'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Recent OI Blocks ({blocksData?.blocks?.length || 0} candles)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {blocksData?.blocks?.slice(-20).reverse().map((b, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2 rounded text-xs ${
                        b.type === 'bullish' ? 'bg-green-500/10' : b.type === 'bearish' ? 'bg-red-500/10' : 'bg-gray-500/5'
                      }`}>
                        <span className="font-mono w-12">{b.time}</span>
                        <span className={`font-bold w-20 ${b.type === 'bullish' ? 'text-green-400' : b.type === 'bearish' ? 'text-red-400' : 'text-gray-400'}`}>
                          {b.type === 'bullish' ? '🟢' : b.type === 'bearish' ? '🔴' : '⚪'} {b.type}
                        </span>
                        <span className="text-foreground-muted">Δ Price: {b.price_change > 0 ? '+' : ''}{b.price_change}</span>
                        <span className="text-foreground-muted ml-auto">CE: {b.ce_oi_change > 0 ? '+' : ''}{b.ce_oi_change}</span>
                        <span className="text-foreground-muted">PE: {b.pe_oi_change > 0 ? '+' : ''}{b.pe_oi_change}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">📘 OI Block Logic (Apex-style)</CardTitle></CardHeader>
                <CardContent className="text-xs text-foreground-muted space-y-2">
                  <p>• <strong className="text-green-400">Bullish Block</strong>: Price ↑ AND (Call OI ↑ OR Put OI ↓)</p>
                  <p>• <strong className="text-red-400">Bearish Block</strong>: Price ↓ AND (Put OI ↑ OR Call OI ↓)</p>
                  <p>• 3+ consecutive same-direction blocks → <strong className="text-primary">Momentum Signal</strong></p>
                  <p>• 3–4 bullish blocks + price above VWAP → Call buy or Put sell setup</p>
                  <p>• 3–4 bearish blocks + price below VWAP → Put buy or Call sell setup</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ═══════ TAB 5: SWING SPECTRUM ═══════ */}
          {activeTab === 'swing' && (
            <motion.div key="swing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {swingData?.scanners && Object.entries(swingData.scanners).map(([key, scan]) => {
                const isActive = scan.breakout || scan.is_nr7 || scan.reversal;
                const color = isActive ? (
                  (scan.breakout === 'bullish' || scan.reversal === 'bullish') ? 'green' :
                  (scan.breakout === 'bearish' || scan.reversal === 'bearish') ? 'red' : 'yellow'
                ) : 'gray';
                const labels = {
                  breakout_10d: '10-Day Breakout',
                  breakout_50d: '50-Day Breakout',
                  channel_breakout: 'Channel Breakout (20D)',
                  nr7: 'NR7 (Narrow Range 7)',
                  reversal_radar: 'Reversal Radar',
                };
                return (
                  <Card key={key} className={`glass-card ${isActive ? `ring-1 ring-${color}-500/40` : ''}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isActive ? `bg-${color}-500 animate-pulse` : 'bg-gray-600'}`} />
                          <h3 className="font-bold text-sm">{labels[key] || key}</h3>
                        </div>
                        <Badge className={`bg-${color}-500/20 text-${color}-400`}>
                          {isActive ? (scan.signal || 'Active') : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground-muted mb-3">{scan.description || 'No signal detected'}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {scan.close != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Close</div>
                            <div className="font-bold">{typeof scan.close === 'number' ? scan.close.toLocaleString('en-IN') : scan.close}</div>
                          </div>
                        )}
                        {scan.prev_high != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">{scan.n}D High</div>
                            <div className="font-bold">{scan.prev_high?.toLocaleString('en-IN')}</div>
                          </div>
                        )}
                        {scan.prev_low != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">{scan.n}D Low</div>
                            <div className="font-bold">{scan.prev_low?.toLocaleString('en-IN')}</div>
                          </div>
                        )}
                        {scan.channel_high != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Ch. High</div>
                            <div className="font-bold">{scan.channel_high?.toLocaleString('en-IN')}</div>
                          </div>
                        )}
                        {scan.channel_low != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Ch. Low</div>
                            <div className="font-bold">{scan.channel_low?.toLocaleString('en-IN')}</div>
                          </div>
                        )}
                        {scan.today_range != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Today Range</div>
                            <div className="font-bold">₹{scan.today_range}</div>
                          </div>
                        )}
                        {scan.avg_range_7d != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">7D Avg Range</div>
                            <div className="font-bold">₹{scan.avg_range_7d}</div>
                          </div>
                        )}
                        {scan.range_contraction_pct != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Contraction</div>
                            <div className="font-bold">{scan.range_contraction_pct}%</div>
                          </div>
                        )}
                        {scan.volume != null && scan.avg_volume != null && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Vol Ratio</div>
                            <div className="font-bold">{(scan.volume / Math.max(scan.avg_volume, 1)).toFixed(1)}x</div>
                          </div>
                        )}
                        {scan.pattern && (
                          <div className="p-2 rounded bg-card border border-border">
                            <div className="text-foreground-muted">Pattern</div>
                            <div className="font-bold">{scan.pattern}</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {!swingData?.scanners && !loading && (
                <Card className="glass-card p-8 text-center">
                  <div className="text-4xl mb-3">📈</div>
                  <p className="text-foreground-muted">Loading swing scanner data...</p>
                </Card>
              )}

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">📘 Scanner Formulas</CardTitle></CardHeader>
                <CardContent className="text-xs text-foreground-muted space-y-2">
                  <p>• <strong className="text-primary">10/50D Breakout</strong>: Close &gt; highest high of N previous days + volume surge (1.2x avg)</p>
                  <p>• <strong className="text-primary">Channel Breakout</strong>: Close breaks above/below N-day high-low channel with 1% buffer</p>
                  <p>• <strong className="text-primary">NR7</strong>: Today's range (H-L) is smallest in 7 days → volatility expansion expected</p>
                  <p>• <strong className="text-primary">Reversal Radar</strong>: Hammer/Shooting star near OI-based S/R + 1.5x volume spike</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </Section>
    </PageLayout>
  );
}

