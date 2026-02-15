// Market Hub - Comprehensive NSE Market Data Dashboard
import { useState, useEffect } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion } from 'framer-motion';
import {
  Activity, Users, TrendingUp, TrendingDown,
  PieChart, Layers, RefreshCw,
  Info, Building2, Globe, Flame,
  Award, AlertTriangle,
  ArrowUp, ArrowDown, Volume2, Crown
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../components/ui';
import { cn, formatNumber, formatPercent, fetchAPI, getChangeColor } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE INDICES TICKER
// ═══════════════════════════════════════════════════════════════════════════════
const LiveIndicesTicker = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await fetchAPI('/nse/indices');
        const allIndices = data?.all_indices || data?.data || [];
        const keyIndices = ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FIN', 'MIDCAP', 'INDIA VIX'];
        const filtered = allIndices.filter(idx => 
          keyIndices.some(k => (idx.symbol || idx.name || '').toUpperCase().includes(k.replace(' ', '')))
        ).slice(0, 8);
        setIndices(filtered.length > 0 ? filtered : allIndices.slice(0, 8));
      } catch {
        setIndices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchIndices();
    const interval = setInterval(fetchIndices, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="overflow-x-auto pb-2 -mx-2 px-2">
      <div className="flex gap-3 min-w-max">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="w-36 h-20 skeleton rounded-xl" />)
        ) : (
          indices.map((idx, i) => {
            const change = idx.pChange || idx.percentChange || 0;
            const isPositive = change >= 0;
            return (
              <motion.div
                key={idx.name || idx.symbol || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'min-w-[140px] p-3 rounded-xl border transition-all',
                  isPositive ? 'bg-bullish/5 border-bullish/20' : 'bg-bearish/5 border-bearish/20'
                )}
              >
                <p className="text-xs text-foreground-muted truncate mb-1">
                  {(idx.name || idx.symbol || '').replace('NIFTY ', '')}
                </p>
                <p className="text-lg font-bold">{formatNumber(idx.last || idx.lastPrice, { decimals: idx.last < 100 ? 2 : 0 })}</p>
                <p className={cn('text-sm font-medium', isPositive ? 'text-bullish' : 'text-bearish')}>
                  {isPositive ? '+' : ''}{formatPercent(change)}
                </p>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FII DII SECTION
// ═══════════════════════════════════════════════════════════════════════════════
const FIIDIISection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Pass timeframe to API
        const timeframe = view === 'today' ? 'week' : view;
        const response = await fetchAPI(`/fii-dii-data?timeframe=${timeframe}`);
        // API returns an array, get first element
        const cashData = Array.isArray(response) ? response[0] : response;
        setData({
          cash: {
            fii_buy: Number(cashData?.fii_buy) || 0,
            fii_sell: Number(cashData?.fii_sell) || 0,
            fii_net: Number(cashData?.fii_net) || 0,
            dii_buy: Number(cashData?.dii_buy) || 0,
            dii_sell: Number(cashData?.dii_sell) || 0,
            dii_net: Number(cashData?.dii_net) || 0,
          },
        });
      } catch (err) {
        console.error('FII/DII fetch error:', err);
        setData({
          cash: { fii_buy: 0, fii_sell: 0, fii_net: 0, dii_buy: 0, dii_sell: 0, dii_net: 0 },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view]);

  if (loading) return <div className="h-[400px] skeleton rounded-2xl" />;


  const cash = data?.cash || {};
  const fiiNet = cash.fii_net || 0;
  const diiNet = cash.dii_net || 0;
  const totalNet = fiiNet + diiNet;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Institutional Activity
            </CardTitle>
            <CardDescription>FII/DII cash market flows (₹ Crores)</CardDescription>
          </div>
          <div className="flex gap-1">
            {['today', 'week', 'month'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                  view === v ? 'bg-primary text-white' : 'text-foreground-muted hover:bg-surface-1'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* FII Card */}
          <div className={cn(
            'p-4 rounded-xl border relative overflow-hidden',
            fiiNet >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
          )}>
            <div className="absolute -right-4 -top-4 opacity-10">
              <Globe className="w-24 h-24" />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  FII/FPI
                </span>
                <Badge variant={fiiNet >= 0 ? 'success' : 'destructive'}>
                  {fiiNet >= 0 ? '↑ Buying' : '↓ Selling'}
                </Badge>
              </div>
              <p className={cn('text-3xl font-bold mb-2', fiiNet >= 0 ? 'text-bullish' : 'text-bearish')}>
                {fiiNet >= 0 ? '+' : ''}{formatNumber(fiiNet, { decimals: 0 })} Cr
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-foreground-muted">Buy</p>
                  <p className="font-semibold text-bullish">{formatNumber(cash.fii_buy || 0, { decimals: 0 })} Cr</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-foreground-muted">Sell</p>
                  <p className="font-semibold text-bearish">{formatNumber(cash.fii_sell || 0, { decimals: 0 })} Cr</p>
                </div>
              </div>
            </div>
          </div>

          {/* DII Card */}
          <div className={cn(
            'p-4 rounded-xl border relative overflow-hidden',
            diiNet >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
          )}>
            <div className="absolute -right-4 -top-4 opacity-10">
              <Building2 className="w-24 h-24" />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  DII
                </span>
                <Badge variant={diiNet >= 0 ? 'success' : 'destructive'}>
                  {diiNet >= 0 ? '↑ Buying' : '↓ Selling'}
                </Badge>
              </div>
              <p className={cn('text-3xl font-bold mb-2', diiNet >= 0 ? 'text-bullish' : 'text-bearish')}>
                {diiNet >= 0 ? '+' : ''}{formatNumber(diiNet, { decimals: 0 })} Cr
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-foreground-muted">Buy</p>
                  <p className="font-semibold text-bullish">{formatNumber(cash.dii_buy || 0, { decimals: 0 })} Cr</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <p className="text-foreground-muted">Sell</p>
                  <p className="font-semibold text-bearish">{formatNumber(cash.dii_sell || 0, { decimals: 0 })} Cr</p>
                </div>
              </div>
            </div>
          </div>

          {/* Net Flow */}
          <div className={cn(
            'p-4 rounded-xl border relative overflow-hidden',
            totalNet >= 0 ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30'
          )}>
            <div className="absolute -right-4 -top-4 opacity-10">
              <Layers className="w-24 h-24" />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Net Flow
                </span>
                <Badge variant={totalNet >= 0 ? 'success' : 'destructive'} className="text-xs">
                  {totalNet >= 0 ? 'BULLISH' : 'BEARISH'}
                </Badge>
              </div>
              <p className={cn('text-3xl font-bold mb-2', totalNet >= 0 ? 'text-bullish' : 'text-bearish')}>
                {totalNet >= 0 ? '+' : ''}{formatNumber(totalNet, { decimals: 0 })} Cr
              </p>
              <p className="text-xs text-foreground-muted">
                {totalNet >= 0 ? '🟢 Institutions net buying' : '🔴 Institutions net selling'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
          <p className="font-medium mb-1">📊 Market Insight</p>
          <p className="text-foreground-muted">
            {fiiNet >= 0 && diiNet >= 0 && 'Both FII & DII buying - Strong bullish signal'}
            {fiiNet >= 0 && diiNet < 0 && 'FII buying, DII profit booking - Selective approach'}
            {fiiNet < 0 && diiNet >= 0 && 'DII support while FII exit - Domestic support'}
            {fiiNet < 0 && diiNet < 0 && 'Both selling - Defensive stance recommended'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTOR HEATMAP WITH STOCKS - F&O SECTORS
// ═══════════════════════════════════════════════════════════════════════════════
// Sector name mapping for API
const SECTOR_API_MAP = {
  'BANK': 'Banking & Financial Services',
  'PSU BANK': 'Banking & Financial Services',
  'PVT BANK': 'Banking & Financial Services',
  'FIN SERVICE': 'Banking & Financial Services',
  'IT': 'Information Technology',
  'PHARMA': 'Healthcare & Pharmaceuticals',
  'HEALTHCARE': 'Healthcare & Pharmaceuticals',
  'AUTO': 'Automobile & Auto Components',
  'FMCG': 'FMCG & Consumer',
  'METAL': 'Metals & Mining',
  'ENERGY': 'Oil, Gas & Energy',
  'OIL AND GAS': 'Oil, Gas & Energy',
  'INFRA': 'Infrastructure & Construction',
  'REALTY': 'Infrastructure & Construction',
};

// Short display names for all 12 F&O sectors
const SECTOR_SHORT_NAMES = {
  'Financial Services': 'FINANCE',
  'Information Technology': 'IT',
  'Healthcare & Pharmaceuticals': 'PHARMA',
  'Automobile & Auto Components': 'AUTO',
  'FMCG & Consumer': 'FMCG',
  'Metals & Mining': 'METAL',
  'Oil, Gas & Energy': 'ENERGY',
  'Infrastructure & Construction': 'INFRA',
  'Telecom & Media': 'TELECOM',
  'Capital Goods & Industrials': 'CAPITAL',
  'Chemicals & Fertilizers': 'CHEMICAL',
};

const SectorHeatmap = () => {
  const [sectorData, setSectorData] = useState({});
  const [selectedSector, setSelectedSector] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all 12 F&O sectors data with live prices
        const data = await fetchAPI('/scanners/fno-by-sector');
        setSectorData(data || {});
      } catch {
        setSectorData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSectorClick = (sectorName) => {
    if (selectedSector === sectorName) {
      setSelectedSector(null);
    } else {
      setSelectedSector(sectorName);
    }
  };

  // Convert to array and sort by performance
  const sectors = Object.entries(sectorData).map(([name, data]) => ({
    name,
    pChange: data.avg_change || 0,
    trend: data.trend,
    stocks: data.stocks || []
  })).sort((a, b) => b.pChange - a.pChange);

  const maxChange = Math.max(...sectors.map(s => Math.abs(s.pChange)), 0.1);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-primary" />
          F&O Sectors
        </CardTitle>
        <CardDescription className="text-xs">Click to view F&O stocks</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-6 skeleton rounded" />)}
          </div>
        ) : (
          <div className="space-y-0.5">
            {sectors.map((sector, i) => {
              const pctChange = sector.pChange || 0;
              const isPositive = pctChange >= 0;
              const barWidth = Math.min((Math.abs(pctChange) / maxChange) * 100, 100);
              const displayName = SECTOR_SHORT_NAMES[sector.name] || sector.name;
              const isSelected = selectedSector === sector.name;
              
              return (
                <div key={sector.name}>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => handleSectorClick(sector.name)}
                    className={cn(
                      "flex items-center gap-2 h-7 rounded px-1 cursor-pointer transition-all",
                      isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-surface-1"
                    )}
                  >
                    {/* Sector Name */}
                    <div className={cn(
                      "w-20 text-right text-xs font-medium truncate transition-colors",
                      isSelected ? "text-primary" : "text-foreground-muted"
                    )}>
                      {displayName}
                    </div>
                    
                    {/* Bar Container */}
                    <div className="flex-1 h-5 relative flex items-center">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                      <div className="w-full h-full flex items-center" style={{ 
                        justifyContent: isPositive ? 'flex-start' : 'flex-end', 
                        paddingLeft: isPositive ? '50%' : 0, 
                        paddingRight: isPositive ? 0 : '50%' 
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.4 }}
                          className={cn(
                            'h-4 rounded-sm flex items-center min-w-[28px]',
                            isPositive ? 'bg-bullish justify-end pr-1' : 'bg-bearish justify-start pl-1'
                          )}
                        >
                          <span className="text-[10px] font-bold text-white whitespace-nowrap">
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Expanded Stocks View */}
                  {isSelected && sector.stocks.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-2 mr-1 my-1 p-2 rounded-lg bg-surface-1 border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[10px] text-foreground-muted">
                          {sector.stocks.length} F&O Stocks
                        </span>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          sector.trend === 'Bullish' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                        )}>
                          {sector.trend}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {sector.stocks.slice(0, 10).map((stock) => (
                          <div 
                            key={stock.symbol}
                            className="flex items-center justify-between py-1 px-2 rounded hover:bg-surface-1 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                stock.change >= 0 ? "bg-bullish" : "bg-bearish"
                              )} />
                              <span className="font-medium">{stock.symbol}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-foreground-muted">₹{stock.price?.toFixed(1)}</span>
                              <span className={cn(
                                "font-semibold w-14 text-right",
                                stock.change >= 0 ? "text-bullish" : "text-bearish"
                              )}>
                                {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {sector.stocks.length > 10 && (
                        <p className="text-[10px] text-foreground-muted text-center mt-2">
                          +{sector.stocks.length - 10} more stocks
                        </p>
                      )}
                    </motion.div>
                  )}
                  
                  {isSelected && sector.stocks.length === 0 && (
                    <div className="ml-2 my-1 p-2 rounded bg-secondary/20 text-xs text-foreground-muted text-center">
                      No stocks data available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET BREADTH
// ═══════════════════════════════════════════════════════════════════════════════
const MarketBreadth = () => {
  const [breadth, setBreadth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreadth = async () => {
      try {
        const breadthData = await fetchAPI('/nse/market-breadth');
        setBreadth(breadthData);
      } catch {
        setBreadth({ advances: 0, declines: 0, unchanged: 0, advanceDeclineRatio: 0, newHighs: 0, newLows: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchBreadth();
  }, []);

  if (loading) return <div className="h-64 skeleton rounded-2xl" />;

  const total = (breadth?.advances || 0) + (breadth?.declines || 0) + (breadth?.unchanged || 0);
  const advancePercent = total > 0 ? ((breadth?.advances || 0) / total * 100) : 50;
  const adRatio = breadth?.advanceDeclineRatio || (breadth?.advances / Math.max(breadth?.declines, 1));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Market Breadth
        </CardTitle>
        <CardDescription>NSE advance/decline analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-bullish" />
              <span className="text-bullish font-semibold">{breadth?.advances}</span>
              <span className="text-xs text-foreground-muted">Advances</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted">Declines</span>
              <span className="text-bearish font-semibold">{breadth?.declines}</span>
              <ArrowDown className="w-4 h-4 text-bearish" />
            </div>
          </div>
          
          <div className="h-6 rounded-full bg-bearish/20 overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${advancePercent}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-bullish to-emerald-400 rounded-full relative"
            >
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                {advancePercent.toFixed(0)}%
              </span>
            </motion.div>
          </div>
          <p className="text-center text-xs text-foreground-muted mt-1">{breadth?.unchanged} Unchanged</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-surface-1 text-center">
            <p className="text-[10px] text-foreground-muted mb-1">A/D Ratio</p>
            <p className={cn('text-xl font-bold', adRatio > 1 ? 'text-bullish' : 'text-bearish')}>
              {adRatio?.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-surface-1 text-center">
            <p className="text-[10px] text-foreground-muted mb-1">52W Highs</p>
            <p className="text-xl font-bold text-bullish">{breadth?.newHighs || 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-1 text-center">
            <p className="text-[10px] text-foreground-muted mb-1">52W Lows</p>
            <p className="text-xl font-bold text-bearish">{breadth?.newLows || 0}</p>
          </div>
        </div>

        <div className={cn(
          'mt-4 p-3 rounded-xl border text-center',
          adRatio > 1.5 ? 'bg-bullish/10 border-bullish/30' :
          adRatio < 0.7 ? 'bg-bearish/10 border-bearish/30' : 'bg-amber-500/10 border-amber-500/30'
        )}>
          <p className={cn(
            'font-bold text-lg',
            adRatio > 1.5 ? 'text-bullish' : adRatio < 0.7 ? 'text-bearish' : 'text-amber-500'
          )}>
            {adRatio > 1.5 ? '🚀 STRONG BULLISH' : adRatio > 1.2 ? '📈 BULLISH' :
             adRatio > 0.8 ? '⚖️ NEUTRAL' : adRatio > 0.5 ? '📉 BEARISH' : '🔻 STRONG BEARISH'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INDIA VIX
// ═══════════════════════════════════════════════════════════════════════════════
const IndiaVIX = () => {
  const [vix, setVix] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVIX = async () => {
      try {
        const data = await fetchAPI('/nse/india-vix');
        setVix(data);
      } catch {
        setVix({ value: 0, change: 0, pChange: 0, high: 0, low: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchVIX();
  }, []);

  if (loading) return <div className="h-64 skeleton rounded-2xl" />;

  const vixValue = vix?.value || vix?.last || 15;
  
  const getVIXLevel = (value) => {
    if (value < 13) return { label: 'Very Low', emoji: '😎', color: 'text-emerald-400', bg: 'bg-emerald-500/20', desc: 'Extreme complacency' };
    if (value < 16) return { label: 'Low', emoji: '😊', color: 'text-bullish', bg: 'bg-bullish/20', desc: 'Low fear - good for option sellers' };
    if (value < 20) return { label: 'Normal', emoji: '😐', color: 'text-amber-400', bg: 'bg-amber-500/20', desc: 'Average volatility' };
    if (value < 25) return { label: 'Elevated', emoji: '😟', color: 'text-orange-500', bg: 'bg-orange-500/20', desc: 'Increased uncertainty' };
    if (value < 35) return { label: 'High', emoji: '😰', color: 'text-red-400', bg: 'bg-red-500/20', desc: 'High fear' };
    return { label: 'Extreme Fear', emoji: '😱', color: 'text-red-500', bg: 'bg-red-500/30', desc: 'Panic selling' };
  };

  const level = getVIXLevel(vixValue);
  const vixPosition = Math.min(100, (vixValue / 40) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          India VIX
        </CardTitle>
        <CardDescription>Fear & Greed Index</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <span className="text-5xl">{level.emoji}</span>
          <p className={cn('text-4xl font-bold mt-2', level.color)}>{vixValue.toFixed(2)}</p>
          <p className={cn('text-sm font-medium', getChangeColor(vix?.change || vix?.pChange || 0))}>
            {(vix?.change || 0) >= 0 ? '+' : ''}{(vix?.change || 0).toFixed(2)} ({formatPercent(vix?.pChange || 0)})
          </p>
        </div>

        <div className="mb-4">
          <div className="h-4 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 relative overflow-visible">
            <motion.div
              initial={{ left: '20%' }}
              animate={{ left: `${vixPosition}%` }}
              className="absolute top-1/2 -translate-y-1/2 -ml-3 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-primary flex items-center justify-center"
            >
              <div className="w-2 h-2 bg-primary rounded-full" />
            </motion.div>
          </div>
          <div className="flex justify-between text-[10px] text-foreground-muted mt-2">
            <span>😎 Greed</span>
            <span>😐 Neutral</span>
            <span>😱 Fear</span>
          </div>
        </div>

        <div className={cn('p-3 rounded-xl text-center', level.bg)}>
          <p className={cn('font-bold text-lg', level.color)}>{level.label}</p>
          <p className="text-xs text-foreground-muted mt-1">{level.desc}</p>
        </div>

        <div className="flex justify-between text-sm mt-4 pt-4 border-t border-white/10">
          <div className="text-center">
            <p className="text-xs text-foreground-muted">Day Low</p>
            <p className="font-semibold text-bullish">{(vix?.low || vixValue * 0.97).toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-foreground-muted">Day High</p>
            <p className="font-semibold text-bearish">{(vix?.high || vixValue * 1.03).toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP GAINERS & LOSERS
// ═══════════════════════════════════════════════════════════════════════════════
const TopMovers = () => {
  const [data, setData] = useState({ gainers: [], losers: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('gainers');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/gainers-losers');
        setData({
          gainers: response?.gainers?.slice(0, 5) || [],
          losers: response?.losers?.slice(0, 5) || []
        });
      } catch {
        setData({ gainers: [], losers: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stocks = view === 'gainers' ? data.gainers : data.losers;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            Top Movers
          </CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setView('gainers')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                view === 'gainers' ? 'bg-bullish text-white' : 'text-foreground-muted hover:bg-surface-1'
              )}
            >
              🚀 Gainers
            </button>
            <button
              onClick={() => setView('losers')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                view === 'losers' ? 'bg-bearish text-white' : 'text-foreground-muted hover:bg-surface-1'
              )}
            >
              📉 Losers
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {stocks.map((stock, i) => {
              const change = stock.pChange || 0;
              const isPositive = change >= 0;
              return (
                <motion.div
                  key={stock.symbol}
                  initial={{ opacity: 0, x: isPositive ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.02]',
                    isPositive ? 'bg-bullish/5 border-bullish/20' : 'bg-bearish/5 border-bearish/20'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                      isPositive ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                    )}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium">{stock.symbol}</p>
                      <p className="text-xs text-foreground-muted">
                        ₹{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    'text-right px-3 py-1 rounded-lg font-semibold',
                    isPositive ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                  )}>
                    {isPositive ? '+' : ''}{formatPercent(change)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP DELIVERIES - Shows stocks with high delivery percentage
// ═══════════════════════════════════════════════════════════════════════════════
const TopDeliveries = () => {
  const [data, setData] = useState({ high: [], low: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('high');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/market/delivery-data');
        setData({
          high: response?.high_delivery || response?.all_stocks?.slice(0, 15) || [],
          low: response?.low_delivery || []
        });
      } catch {
        setData({ high: [], low: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getSignalColor = (signal) => {
    if (signal?.includes('Strong Accumulation')) return 'text-bullish bg-bullish/10';
    if (signal?.includes('Accumulation')) return 'text-emerald-400 bg-emerald-500/10';
    if (signal?.includes('Distribution')) return 'text-bearish bg-bearish/10';
    if (signal?.includes('Selling')) return 'text-orange-400 bg-orange-500/10';
    if (signal?.includes('Intraday')) return 'text-purple-400 bg-purple-500/10';
    return 'text-amber-400 bg-amber-500/10';
  };

  const formatVolume = (vol) => {
    if (vol >= 10000000) return (vol / 10000000).toFixed(2) + ' Cr';
    if (vol >= 100000) return (vol / 100000).toFixed(2) + ' L';
    return vol?.toLocaleString();
  };

  const displayData = activeTab === 'high' ? data.high : data.low;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Top Deliveries
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={activeTab === 'high' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('high')}
              className="text-xs h-7 px-2"
            >
              High ({data.high?.length || 0})
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'low' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('low')}
              className="text-xs h-7 px-2"
            >
              Low ({data.low?.length || 0})
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          {activeTab === 'high' ? '🟢 High delivery % = genuine investor interest' : '🟣 Low delivery % = intraday speculation'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-1 text-[10px] text-foreground-muted px-2 py-1 border-b border-white/10">
              <div className="col-span-3">Stock</div>
              <div className="col-span-2 text-right">LTP</div>
              <div className="col-span-2 text-right">Chg%</div>
              <div className="col-span-2 text-right">Traded</div>
              <div className="col-span-3 text-right">Del%</div>
            </div>
            {displayData.slice(0, 8).map((stock, i) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, x: activeTab === 'high' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-12 gap-1 items-center p-2 rounded-lg bg-secondary/20 hover:bg-surface-1 transition-colors text-xs"
              >
                <div className="col-span-3 font-medium truncate">{stock.symbol}</div>
                <div className="col-span-2 text-right">₹{stock.price?.toFixed(0)}</div>
                <div className={cn('col-span-2 text-right font-medium', getChangeColor(stock.change_pct))}>
                  {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct?.toFixed(2)}%
                </div>
                <div className="col-span-2 text-right text-foreground-muted">
                  {formatVolume(stock.traded_volume)}
                </div>
                <div className="col-span-3 text-right">
                  <span className={cn(
                    'font-bold px-1.5 py-0.5 rounded text-[11px]',
                    activeTab === 'high' 
                      ? (stock.change_pct >= 0 ? 'bg-bullish/20 text-bullish' : 'bg-orange-500/20 text-orange-400')
                      : 'bg-purple-500/20 text-purple-400'
                  )}>
                    {stock.delivery_pct?.toFixed(1)}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[10px] text-foreground-muted text-center">
            {activeTab === 'high' 
              ? '💡 Del% > 60% with price ↑ = Strong Accumulation' 
              : '💡 Del% < 35% = Heavy intraday trading, no conviction'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 52 WEEK HIGH/LOW
// ═══════════════════════════════════════════════════════════════════════════════
const Week52HighLow = () => {
  const [data, setData] = useState({ highs: [], lows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/52week-high-low');
        setData({
          highs: response?.near_52_week_high?.slice(0, 5) || response?.highs?.slice(0, 5) || [],
          lows: response?.near_52_week_low?.slice(0, 5) || response?.lows?.slice(0, 5) || []
        });
      } catch {
        setData({ highs: [], lows: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          52-Week Extremes
        </CardTitle>
        <CardDescription>Stocks at yearly highs & lows</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-bullish">52W Highs ({data.highs.length})</span>
              </div>
              <div className="space-y-2">
                {data.highs.slice(0, 3).map((stock, i) => (
                  <div key={i} className="p-2 rounded-lg bg-bullish/10 border border-bullish/20">
                    <p className="font-medium text-sm truncate">{stock.symbol}</p>
                    <p className="text-xs text-bullish">₹{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-bearish" />
                <span className="text-sm font-medium text-bearish">52W Lows ({data.lows.length})</span>
              </div>
              <div className="space-y-2">
                {data.lows.slice(0, 3).map((stock, i) => (
                  <div key={i} className="p-2 rounded-lg bg-bearish/10 border border-bearish/20">
                    <p className="font-medium text-sm truncate">{stock.symbol}</p>
                    <p className="text-xs text-bearish">₹{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME SHOCKERS
// ═══════════════════════════════════════════════════════════════════════════════
const VolumeShockers = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/volume-shockers');
        setStocks(response?.data?.slice(0, 5) || response?.slice(0, 5) || []);
      } catch {
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          Volume Shockers
        </CardTitle>
        <CardDescription>Unusual volume activity</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {stocks.map((stock, i) => {
              const change = stock.pChange || 0;
              const volRatio = stock.volumeRatio || stock.volume_ratio || 2;
              return (
                <div
                  key={stock.symbol || i}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-1 hover:bg-surface-1 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Volume2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{stock.symbol}</p>
                      <p className="text-xs text-foreground-muted">
                        ₹{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-semibold', getChangeColor(change))}>
                      {change >= 0 ? '+' : ''}{formatPercent(change)}
                    </p>
                    <p className="text-xs text-amber-400 font-medium">{volRatio.toFixed(1)}x Vol</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const MarketHub = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/market')} path="/market" />
      <PageHeader
        title="Market Pulse"
        description="Live NSE market data, institutional flows, sector performance & volatility"
        breadcrumbs={[{ label: 'Dashboard', link: '/' }, { label: 'Market Pulse' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(p => p + 1)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <Section key={`ticker-${refreshKey}`}>
        <LiveIndicesTicker />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6" key={`main-${refreshKey}`}>
        <FIIDIISection />
        <SectorHeatmap />
        <MarketBreadth />
        <IndiaVIX />
        <TopMovers />
        <TopDeliveries />
        <Week52HighLow />
        <VolumeShockers />
      </div>

      <Card className="mt-8 p-5 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Info className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold mb-3">📚 Market Intelligence Guide</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-foreground-muted">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="font-medium text-foreground mb-1">FII/DII Flows</p>
                <p>FII+DII buying = Strong Rally. FII selling + DII buying = Support.</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="font-medium text-foreground mb-1">VIX Signals</p>
                <p>VIX &lt; 13: Complacent. VIX &gt; 20: Fear. Spike above 25 = bottoms.</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="font-medium text-foreground mb-1">A/D Ratio</p>
                <p>A/D &gt; 1.5: Strong breadth. A/D &lt; 0.7: Weak. Divergences = reversals.</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="font-medium text-foreground mb-1">Sector Rotation</p>
                <p>IT/Pharma = Defensive. Metal/Auto = Risk-on. Track the flow!</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </PageLayout>
  );
};

export default MarketHub;

