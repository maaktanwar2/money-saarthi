// AI Agent — Active Positions panel
import { STRATEGY_INFO } from './constants';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { cn, formatINR } from '../../lib/utils';

const PositionsPanel = ({ positions }) => (
  <Card className="bg-slate-800/60 border-slate-700/50">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        Active Positions ({positions.length})
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      {positions.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No active positions</p>
      ) : (
        <div className="space-y-2">
          {positions.map((pos, i) => {
            const stratInfo = STRATEGY_INFO[pos.strategy] || STRATEGY_INFO.no_trade;
            const pnl = pos.current_pnl || 0;
            return (
              <div key={pos.id || i} className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/30">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span>{stratInfo.icon}</span>
                    <span className="text-xs font-medium text-white">{stratInfo.name}</span>
                    <span className="text-[10px] text-slate-500">{pos.id}</span>
                  </div>
                  <span className={cn("text-sm font-bold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                  </span>
                </div>
                {/* Legs */}
                <div className="flex flex-wrap gap-1.5">
                  {(pos.legs || []).map((leg, j) => (
                    <span key={j} className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      leg.type?.includes('SELL') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                    )}>
                      {leg.type} {leg.strike} @ ₹{leg.premium?.toFixed(1)}
                    </span>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span>SL: {formatINR(pos.stoploss_pnl || 0)}</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", pnl >= 0 ? "bg-emerald-500" : "bg-red-500")}
                      style={{ width: `${Math.min(100, Math.abs(pnl / (pos.target_pnl || 1)) * 100)}%` }}
                    />
                  </div>
                  <span>Target: {formatINR(pos.target_pnl || 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);

export default PositionsPanel;
