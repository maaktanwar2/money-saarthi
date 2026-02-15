// Dashboard — Top Gainers & Losers (Strong Movers Only)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { cn, formatINR, fetchAPI } from '../../lib/utils';

const refineMovers = (stocks) => {
  if (!Array.isArray(stocks)) return [];
  return stocks.filter(stock => {
    const changePct = Math.abs(stock.change_pct ?? stock.pChange ?? 0);
    const volumeRatio = stock.volume_ratio ?? 1;
    const score = stock.score ?? stock.day_trading_score ?? 0;
    return changePct >= 2 || volumeRatio >= 1.3 || score >= 50;
  }).slice(0, 5);
};

const StockList = ({ stocks, type }) => (
  <div className="space-y-2">
    {stocks.slice(0, 5).map((stock, i) => {
      const changePct = stock.change_pct ?? stock.pChange ?? 0;
      const priceValue = stock.price || stock.lastPrice || stock.ltp || 0;
      const volumeRatio = stock.volume_ratio ?? 1;
      const score = stock.score ?? stock.day_trading_score ?? 0;
      const isStrong = volumeRatio >= 1.5 || score >= 60;

      return (
        <motion.div
          key={stock.symbol}
          initial={{ opacity: 0, x: type === 'gainer' ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
          className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full",
              type === 'gainer' ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"
            )}>
              {i + 1}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium group-hover:text-primary transition-colors">{stock.symbol}</p>
                {isStrong && (
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    type === 'gainer' ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"
                  )}>
                    🔥
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatINR(priceValue)}
                {volumeRatio > 1.3 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">Vol {volumeRatio.toFixed(1)}×</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={cn(
              'text-sm font-bold px-2 py-1 rounded-lg',
              type === 'gainer'
                ? 'text-bullish-light bg-bullish/10'
                : 'text-bearish-light bg-bearish/10'
            )}>
              {changePct >= 0 ? '+' : ''}{Number(changePct).toFixed(2)}%
            </span>
          </div>
        </motion.div>
      );
    })}
  </div>
);

const TopMovers = () => {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gainersData, losersData] = await Promise.all([
          fetchAPI('/scanners/day-gainers?limit=15'),
          fetchAPI('/scanners/day-losers?limit=15'),
        ]);

        const rawGainers = gainersData?.data || gainersData || [];
        const rawLosers = losersData?.data || losersData || [];

        setGainers(refineMovers(rawGainers));
        setLosers(refineMovers(rawLosers));
      } catch (error) {
        setGainers([]);
        setLosers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => { if (!document.hidden) fetchData(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Gainers Card */}
      <Card className="h-full border-bullish/20 bg-gradient-to-br from-bullish/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-bullish/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-bullish" />
              </div>
              <CardTitle className="text-lg text-bullish">Top Gainers</CardTitle>
            </div>
            <Badge variant="outline" className="bg-bullish/10 text-bullish border-bullish/30 text-xs">
              🔥 Strong Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-lg" />
              ))}
            </div>
          ) : (
            <StockList stocks={gainers} type="gainer" />
          )}
          <Link
            to="/scanners?tab=gainers"
            className="flex items-center justify-center gap-1 text-sm text-bullish mt-4 hover:underline font-medium"
          >
            View All Gainers
            <ChevronRight className="w-4 h-4" />
          </Link>
        </CardContent>
      </Card>

      {/* Top Losers Card */}
      <Card className="h-full border-bearish/20 bg-gradient-to-br from-bearish/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-bearish/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-bearish" />
              </div>
              <CardTitle className="text-lg text-bearish">Top Losers</CardTitle>
            </div>
            <Badge variant="outline" className="bg-bearish/15 text-bearish-light border-bearish/30 text-xs">
              🔥 Strong Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-lg" />
              ))}
            </div>
          ) : (
            <StockList stocks={losers} type="loser" />
          )}
          <Link
            to="/scanners?tab=losers"
            className="flex items-center justify-center gap-1 text-sm text-bearish mt-4 hover:underline font-medium"
          >
            View All Losers
            <ChevronRight className="w-4 h-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default TopMovers;
