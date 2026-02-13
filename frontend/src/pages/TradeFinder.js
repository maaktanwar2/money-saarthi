import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardContent, Badge } from '../components/ui';
import { fetchAPI } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE FINDER — Standalone Page
// Auto strategy suggestions based on live OI data, market outlook & risk appetite
// ═══════════════════════════════════════════════════════════════════════════════

/** Check if current time is during Indian market hours (9:15–15:30 IST, weekdays) */
const isMarketHours = () => {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const t = ist.getHours() * 60 + ist.getMinutes();
  return t >= 555 && t <= 930;
};

export default function TradeFinder() {
  // ── State ──
  const [selectedIndex, setSelectedIndex] = useState('NIFTY');
  const [spotPrice, setSpotPrice] = useState(0);
  const [spotChange, setSpotChange] = useState(0);
  const [maxOI, setMaxOI] = useState({ callStrike: 0, putStrike: 0, maxCallOI: 0, maxPutOI: 0 });
  const [pcrOI, setPcrOI] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);

  // ── Trade Finder inputs ──
  const [riskAppetite, setRiskAppetite] = useState('moderate');
  const [marketOutlook, setMarketOutlook] = useState('neutral');

  // ════════════════════════════════════════════════
  // DATA FETCHING
  // ════════════════════════════════════════════════
  const fetchData = useCallback(async (index) => {
    const symbol = index || selectedIndex;
    setLoading(true);
    setError(null);
    try {
      const [chainRes, tickerRes] = await Promise.allSettled([
        fetchAPI(`/nse/option-chain/${symbol}`),
        fetchAPI('/ticker-data'),
      ]);

      // Spot change %
      if (tickerRes.status === 'fulfilled' && Array.isArray(tickerRes.value)) {
        const tickerMap = {};
        tickerRes.value.forEach(t => { tickerMap[t.symbol] = t; });
        const idx = tickerMap[symbol] || tickerMap['NIFTY'];
        if (idx) setSpotChange(idx.change || 0);
      }

      // Option chain → spot, maxOI, PCR
      if (chainRes.status === 'fulfilled' && chainRes.value) {
        const raw = chainRes.value;
        const spot = raw.underlying_value || 0;
        if (spot > 0) setSpotPrice(spot);
        setPcrOI(raw.pcr_oi || 0);

        // Compute maxOI from chain data
        if (raw.data?.length) {
          let maxCallOI = 0, maxPutOI = 0, callStrike = 0, putStrike = 0;
          raw.data.forEach(item => {
            const coi = item.CE?.openInterest || 0;
            const poi = item.PE?.openInterest || 0;
            if (coi > maxCallOI) { maxCallOI = coi; callStrike = item.strikePrice; }
            if (poi > maxPutOI) { maxPutOI = poi; putStrike = item.strikePrice; }
          });
          setMaxOI({ callStrike, putStrike, maxCallOI, maxPutOI });
        }
        setLastUpdated(new Date());
      } else {
        throw new Error(chainRes.reason?.message || 'Failed to fetch option chain');
      }
    } catch (err) {
      console.error('Trade Finder fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedIndex]);

  // Initial fetch
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
  // TRADE SUGGESTIONS
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
        title="Trade Finder"
        subtitle="AI-powered strategy suggestions based on live OI data & market outlook"
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
        {lastUpdated && <span className="text-xs text-muted-foreground ml-auto">Updated: {lastUpdated.toLocaleTimeString()}</span>}
        <div className="flex items-center gap-2">
          {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(idx => (
            <button key={idx} onClick={() => setSelectedIndex(idx)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${selectedIndex === idx ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'}`}
            >{idx}</button>
          ))}
        </div>
        <button onClick={() => fetchData()} disabled={loading}
          className="px-3 py-1 rounded-lg text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-50">
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
        <button onClick={() => setAutoRefresh(p => !p)}
          className={`px-3 py-1 rounded-lg text-xs transition-all ${autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-card border border-border text-muted-foreground'}`}>
          {autoRefresh ? '🟢 Auto' : '⚪ Manual'}
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      <Section>
        <AnimatePresence mode="wait">
          <motion.div key="trade-finder" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Outlook + Risk + Spot */}
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

            {/* Strategy Cards */}
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

            {/* Disclaimer */}
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">
              ⚠️ Strategy suggestions are based on live OI data analysis and market outlook inputs. They are NOT financial advice. Always do your own analysis and use proper risk management.
            </div>
          </motion.div>
        </AnimatePresence>
      </Section>
    </PageLayout>
  );
}
