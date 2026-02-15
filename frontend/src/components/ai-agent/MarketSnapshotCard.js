// AI Agent — Market Snapshot sidebar card
import { Waves } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { cn } from '../../lib/utils';

const MarketSnapshotCard = ({ snapshot }) => {
  if (!snapshot) return null;

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Waves className="w-4 h-4 text-blue-400" />
          Market Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">{snapshot.symbol}</span>
            <span className="text-sm font-bold text-white">{snapshot.spot_price?.toLocaleString('en-IN')}</span>
          </div>
          <div className={cn(
            "text-right text-xs font-medium",
            snapshot.day_change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {snapshot.day_change_pct >= 0 ? '+' : ''}{snapshot.day_change_pct?.toFixed(2)}%
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Trend</span>
              <span className={cn("font-medium", 
                snapshot.trend === 'BULLISH' ? 'text-green-400' : 
                snapshot.trend === 'BEARISH' ? 'text-red-400' : 'text-blue-400'
              )}>{snapshot.trend}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VIX</span>
              <span className="text-white font-medium">{snapshot.vix?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VWAP</span>
              <span className="text-white">{snapshot.vwap?.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PCR</span>
              <span className="text-white">{snapshot.pcr?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IV Rank</span>
              <span className="text-white">{snapshot.iv_rank?.toFixed(0)}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Session</span>
              <span className="text-white">{snapshot.session}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Support</span>
              <span className="text-green-400">{snapshot.s1?.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Resistance</span>
              <span className="text-red-400">{snapshot.r1?.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketSnapshotCard;
