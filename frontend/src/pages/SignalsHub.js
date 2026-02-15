// Stock Scanner Hub - Real scanner data from NSE
import { useState, useEffect, useMemo } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, TrendingUp, TrendingDown, Target, Clock,
  RefreshCw, AlertCircle, ExternalLink,
  BarChart3, Info
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, Button, Badge, Select,
} from '../components/ui';
import { cn, formatINR, formatPercent, fetchAPI, getChangeColor } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// SCANNER CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
const SCANNER_TYPES = [
  { id: 'all', label: 'All Stocks', icon: Zap },
  { id: 'buy', label: 'Gainers', icon: TrendingUp },
  { id: 'sell', label: 'Losers', icon: TrendingDown },
  { id: 'swing', label: 'Swing Setups', icon: Target },
];

const TIMEFRAMES = [
  { value: 'intraday', label: 'Intraday' },
  { value: 'swing', label: 'Swing (2-5 days)' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK CARD COMPONENT — shows real scanner data only
// ═══════════════════════════════════════════════════════════════════════════════
const StockCard = ({ stock, onView }) => {
  const isBuy = stock.type === 'BUY';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Card 
        className={cn(
          'p-4 cursor-pointer transition-all duration-200 border-l-4',
          isBuy ? 'border-l-bullish hover:border-bullish/50' : 'border-l-bearish hover:border-bearish/50'
        )}
        onClick={() => onView(stock)}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg font-bold">{stock.symbol}</span>
              <Badge variant={isBuy ? 'success' : 'destructive'} className="text-xs">
                {isBuy ? 'GAINER' : 'LOSER'}
              </Badge>
              <Badge variant="outline" className="text-xs">{stock.category}</Badge>
            </div>
            <p className="text-xs text-foreground-muted">{stock.strategy}</p>
          </div>
          <div className="text-right">
            <div className={cn('text-xl font-bold', getChangeColor(stock.changePercent))}>
              {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </div>
            <p className="text-xs text-foreground-muted">Day Change</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <p className="text-xs text-foreground-muted">LTP</p>
            <p className="font-medium">{formatINR(stock.ltp)}</p>
          </div>
          {stock.target ? (
            <div>
              <p className="text-xs text-foreground-muted">Target</p>
              <p className="font-medium text-bullish">{formatINR(stock.target)}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-foreground-muted">Volume</p>
              <p className="font-medium">{stock.volume ? stock.volume.toLocaleString('en-IN') : '—'}</p>
            </div>
          )}
          {stock.stopLoss ? (
            <div>
              <p className="text-xs text-foreground-muted">Stop Loss</p>
              <p className="font-medium text-bearish">{formatINR(stock.stopLoss)}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-foreground-muted">Scanner Score</p>
              <p className={cn('font-medium', stock.score >= 70 ? 'text-bullish' : stock.score >= 50 ? 'text-amber-500' : 'text-foreground-muted')}>
                {stock.score || '—'}/100
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-foreground-muted" />
            <span className="text-foreground-muted">{stock.timeframe}</span>
          </div>
          <a 
            href={`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            Chart <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {stock.reason && (
          <p className="text-xs text-foreground-muted mt-3 line-clamp-2">{stock.reason}</p>
        )}
      </Card>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK DETAIL MODAL — shows real data only, no fabricated metrics
// ═══════════════════════════════════════════════════════════════════════════════
const StockDetailModal = ({ stock, onClose }) => {
  if (!stock) return null;

  const isBuy = stock.type === 'BUY';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface-2 border border-border rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className={cn(
          'p-6 border-b border-border',
          isBuy ? 'bg-bullish/10' : 'bg-bearish/10'
        )}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold">{stock.symbol}</span>
                <Badge variant={isBuy ? 'success' : 'destructive'} className="text-sm">
                  {isBuy ? 'GAINER' : 'LOSER'}
                </Badge>
                <Badge variant="outline">{stock.timeframe}</Badge>
              </div>
              <p className="text-foreground-muted">{stock.strategy} — {stock.category}</p>
            </div>
            <div className="text-right">
              <div className={cn('text-3xl font-bold', getChangeColor(stock.changePercent))}>
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </div>
              <p className="text-sm text-foreground-muted">Day Change</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Price Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <p className="text-xs text-foreground-muted mb-1">LTP</p>
              <p className="text-xl font-bold">{formatINR(stock.ltp)}</p>
            </Card>
            {stock.target && (
              <Card className="p-4 text-center border-bullish/30">
                <p className="text-xs text-foreground-muted mb-1">Target</p>
                <p className="text-xl font-bold text-bullish">{formatINR(stock.target)}</p>
              </Card>
            )}
            {stock.stopLoss && (
              <Card className="p-4 text-center border-bearish/30">
                <p className="text-xs text-foreground-muted mb-1">Stop Loss</p>
                <p className="text-xl font-bold text-bearish">{formatINR(stock.stopLoss)}</p>
              </Card>
            )}
            {stock.score && (
              <Card className="p-4 text-center">
                <p className="text-xs text-foreground-muted mb-1">Scanner Score</p>
                <p className={cn('text-xl font-bold', stock.score >= 70 ? 'text-bullish' : 'text-amber-500')}>
                  {stock.score}/100
                </p>
              </Card>
            )}
          </div>

          {/* Extra details if available */}
          {stock.volume && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-surface-1">
                <p className="text-xs text-foreground-muted">Volume</p>
                <p className="text-lg font-bold">{stock.volume.toLocaleString('en-IN')}</p>
              </div>
              {stock.riskReward && (
                <div className="p-3 rounded-xl bg-surface-1">
                  <p className="text-xs text-foreground-muted">Risk:Reward</p>
                  <p className={cn('text-lg font-bold', stock.riskReward >= 2 ? 'text-bullish' : 'text-amber-500')}>
                    1:{stock.riskReward}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Scanner Reasoning */}
          {stock.reason && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Scanner Notes
              </h4>
              <p className="text-sm text-foreground-muted">{stock.reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <a
              href={`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="gradient" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Chart
              </Button>
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCANNER SUMMARY — real derived stats, no fabricated accuracy
// ═══════════════════════════════════════════════════════════════════════════════
const ScannerSummary = ({ stocks = [] }) => {
  const totalStocks = stocks.length;
  const avgScore = totalStocks > 0 ? Math.round(stocks.reduce((sum, s) => sum + (s.score || 0), 0) / totalStocks) : 0;
  const buyCount = stocks.filter(s => s.type === 'BUY').length;
  const avgChange = totalStocks > 0 ? (stocks.reduce((sum, s) => sum + (s.changePercent || 0), 0) / totalStocks).toFixed(2) : '0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="p-4">
        <div className="text-xs text-foreground-muted mb-1">Stocks Found</div>
        <div className="text-2xl font-bold">{totalStocks}</div>
        <div className="text-xs text-foreground-muted">From scanners</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-foreground-muted mb-1">Avg Scanner Score</div>
        <div className={cn('text-2xl font-bold', avgScore >= 70 ? 'text-bullish' : 'text-amber-500')}>{avgScore}/100</div>
        <div className="text-xs text-foreground-muted">Technical score</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-foreground-muted mb-1">Gainers</div>
        <div className="text-2xl font-bold text-bullish">{buyCount}</div>
        <div className="text-xs text-foreground-muted">Stocks up today</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-foreground-muted mb-1">Avg Change</div>
        <div className={cn('text-2xl font-bold', getChangeColor(parseFloat(avgChange)))}>{avgChange}%</div>
        <div className="text-xs text-foreground-muted">Across scanned stocks</div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN STOCK SCANNER COMPONENT — real data, no synthetic dressing
// ═══════════════════════════════════════════════════════════════════════════════
const SignalsHub = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [timeframe, setTimeframe] = useState('all');
  const [selectedStock, setSelectedStock] = useState(null);

  useEffect(() => {
    const fetchScannerData = async () => {
      setLoading(true);
      try {
        const [gainers, losers, swing] = await Promise.all([
          fetchAPI('/scanners/day-gainers?limit=8').catch(() => ({ data: [] })),
          fetchAPI('/scanners/day-losers?limit=8').catch(() => ({ data: [] })),
          fetchAPI('/scanners/swing?limit=8').catch(() => ({ data: [] }))
        ]);
        
        const scannedStocks = [];
        
        // Gainers — show real data only
        (gainers?.data || []).forEach((s, i) => {
          scannedStocks.push({
            id: `gainer-${i}`,
            symbol: s.symbol,
            type: 'BUY',
            category: 'Day Gainer',
            strategy: 'Momentum',
            ltp: s.ltp || s.entry || 0,
            changePercent: s.change_percent || 0,
            target: s.target_1 || null,       // only if scanner provides it
            stopLoss: s.stop_loss || null,     // only if scanner provides it
            score: s.score || null,
            volume: s.volume || null,
            timeframe: 'Intraday',
            riskReward: (s.target_1 && s.stop_loss && s.ltp)
              ? (((s.target_1 - s.ltp) / (s.ltp - s.stop_loss)).toFixed(1))
              : null,
            reason: s.signal || (s.change_percent > 3
              ? `Up ${s.change_percent.toFixed(1)}% today with momentum.`
              : `Moderate gain of ${(s.change_percent || 0).toFixed(1)}%.`),
          });
        });
        
        // Losers — show real data only
        (losers?.data || []).forEach((s, i) => {
          scannedStocks.push({
            id: `loser-${i}`,
            symbol: s.symbol,
            type: 'SELL',
            category: 'Day Loser',
            strategy: 'Breakdown',
            ltp: s.ltp || s.entry || 0,
            changePercent: s.change_percent || 0,
            target: s.target_1 || null,
            stopLoss: s.stop_loss || null,
            score: s.score || null,
            volume: s.volume || null,
            timeframe: 'Intraday',
            riskReward: (s.target_1 && s.stop_loss && s.ltp)
              ? (((s.ltp - s.target_1) / (s.stop_loss - s.ltp)).toFixed(1))
              : null,
            reason: s.signal || `Down ${Math.abs(s.change_percent || 0).toFixed(1)}% today.`,
          });
        });
        
        // Swing setups — show real data only
        (swing?.data || []).forEach((s, i) => {
          scannedStocks.push({
            id: `swing-${i}`,
            symbol: s.symbol,
            type: s.signal === 'SELL' ? 'SELL' : 'BUY',
            category: 'Swing Setup',
            strategy: 'Swing Trade',
            ltp: s.ltp || s.entry || 0,
            changePercent: s.change_percent || 0,
            target: s.target_1 || null,
            stopLoss: s.stop_loss || null,
            score: s.score || null,
            volume: s.volume || null,
            timeframe: 'Swing',
            riskReward: (s.target_1 && s.stop_loss && s.ltp)
              ? (Math.abs((s.target_1 - s.ltp) / (s.ltp - s.stop_loss)).toFixed(1))
              : null,
            reason: s.reason || s.signal || 'Swing setup detected by scanner.',
          });
        });
        
        setStocks(scannedStocks);
      } catch (error) {
        console.error('Error fetching scanner data:', error);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchScannerData();
    const interval = setInterval(() => { if (!document.hidden) fetchScannerData(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
      if (activeType === 'buy' && stock.type !== 'BUY') return false;
      if (activeType === 'sell' && stock.type !== 'SELL') return false;
      if (activeType === 'swing' && stock.category !== 'Swing Setup') return false;
      if (timeframe !== 'all' && stock.timeframe.toLowerCase() !== timeframe) return false;
      return true;
    });
  }, [stocks, activeType, timeframe]);

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/signals')} path="/signals" />
      <PageHeader
        title="Stock Scanner"
        description="Real-time scanner results from NSE — gainers, losers & swing setups"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Scanner' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Scanner Summary */}
      <ScannerSummary stocks={stocks} />

      {/* Filters */}
      <Section className="mb-6">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex gap-1">
              {SCANNER_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    activeType === type.id
                      ? 'bg-primary text-white'
                      : 'text-foreground-muted hover:text-foreground hover:bg-surface-1'
                  )}
                >
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-foreground-muted">Timeframe:</span>
              <Select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-40"
              >
                <option value="all">All</option>
                {TIMEFRAMES.map((tf) => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      </Section>

      {/* Stocks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 skeleton rounded-2xl" />
          ))}
        </div>
      ) : filteredStocks.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Stocks Found</h3>
          <p className="text-foreground-muted">
            No stocks match your current filters. Try adjusting the timeframe or category.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStocks.map((stock) => (
            <StockCard 
              key={stock.id} 
              stock={stock} 
              onView={setSelectedStock}
            />
          ))}
        </div>
      )}

      {/* Disclaimer — honest about data source */}
      <Card className="mt-8 p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">About Scanner Data</h4>
            <p className="text-sm text-foreground-muted">
              This page shows real-time results from our NSE stock scanners. Gainers and losers
              are based on live market data. Swing setups use technical indicators (EMA, RSI, VWAP).
              Scanner scores reflect technical alignment — they are not predictions. Always do your
              own analysis and use proper risk management.
            </p>
          </div>
        </div>
      </Card>

      {/* Stock Detail Modal */}
      <AnimatePresence>
        {selectedStock && (
          <StockDetailModal 
            stock={selectedStock} 
            onClose={() => setSelectedStock(null)} 
          />
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default SignalsHub;

