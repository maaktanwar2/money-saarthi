// Dashboard — Market Overview (Index Cards)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui';
import { cn, formatNumber, fetchAPI } from '../../lib/utils';

const MarketOverview = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/indices');
        const indicesArray = response?.all_indices || response?.data || [];
        if (indicesArray && indicesArray.length > 0) {
          const keySymbols = ['NIFTY 50', 'NIFTY BANK', 'NIFTY MIDCAP 50', 'NIFTY FIN SERVICE', 'INDIA VIX', 'SENSEX'];
          const keyIndices = keySymbols.map(sym =>
            indicesArray.find(idx => idx.symbol === sym || idx.name === sym)
          ).filter(Boolean);
          setIndices(keyIndices.length > 0 ? keyIndices : indicesArray.slice(0, 6));
        }
      } catch (error) {
        console.error('Market Overview fetch error:', error);
        setIndices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 skeleton rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {indices.map((index, i) => {
        const isPositive = (index.pChange || 0) >= 0;
        const price = index.last || index.lastPrice || 0;
        const change = index.change || 0;
        const pChange = index.pChange || 0;

        return (
          <motion.div
            key={index.symbol || index.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={cn(
              "p-4 h-full transition-all duration-200 cursor-pointer",
              "hover:shadow-lg hover:border-primary/40",
              isPositive ? "hover:bg-bullish/5" : "hover:bg-bearish/5"
            )}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide truncate max-w-[80%]">
                  {index.symbol || index.name}
                </span>
                <span className={cn(
                  'p-1 rounded-full',
                  isPositive ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'
                )}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                </span>
              </div>
              <div className="text-2xl font-bold mb-1">
                {price >= 1000 ? formatNumber(price, { decimals: 0 }) : price.toFixed(2)}
              </div>
              <div className={cn(
                'text-sm font-semibold flex items-center gap-1',
                isPositive ? 'text-bullish' : 'text-bearish'
              )}>
                <span>{isPositive ? '▲' : '▼'}</span>
                <span>{Math.abs(change).toFixed(change >= 100 ? 0 : 2)}</span>
                <span className="text-xs">({isPositive ? '+' : ''}{pChange.toFixed(2)}%)</span>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export default MarketOverview;
