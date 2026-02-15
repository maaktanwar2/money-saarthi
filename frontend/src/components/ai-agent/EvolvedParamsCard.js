// AI Agent — Self-Evolved Parameters + Strategy Performance
import { RotateCw } from 'lucide-react';
import { STRATEGY_INFO } from './constants';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { cn, formatINR } from '../../lib/utils';

const EvolvedParamsCard = ({ params, performance }) => {
  if (!params) return null;

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <RotateCw className="w-4 h-4 text-cyan-400" />
          Self-Evolved Parameters
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">ADAPTIVE</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Confidence Threshold</div>
            <div className="text-lg font-bold text-purple-400">{params.confidence_threshold?.toFixed(0)}%</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Vol Comfort</div>
            <div className="text-lg font-bold text-amber-400 capitalize">{params.volatility_comfort || 'medium'}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Time Preference</div>
            <div className="text-lg font-bold text-blue-400 capitalize">{params.time_preference || 'any'}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-500 mb-1">Drawdown</div>
            <div className="text-lg font-bold text-red-400">{formatINR(performance?.drawdown || 0)}</div>
          </div>
        </div>

        {/* Strategy Performance */}
        {performance?.strategy_stats && Object.keys(performance.strategy_stats).length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Strategy Performance</p>
            <div className="space-y-1.5">
              {Object.entries(performance.strategy_stats).map(([strat, stats]) => {
                const wr = stats.trades > 0 ? (stats.wins / stats.trades * 100) : 0;
                const info = STRATEGY_INFO[strat] || { icon: '📊', name: strat };
                return (
                  <div key={strat} className="flex items-center gap-3 text-xs">
                    <span className="w-5 text-center">{info.icon}</span>
                    <span className="text-slate-300 flex-1">{info.name}</span>
                    <span className="text-slate-500">{stats.trades} trades</span>
                    <span className={cn("font-medium w-12 text-right", wr >= 50 ? "text-emerald-400" : "text-red-400")}>
                      {wr.toFixed(0)}% WR
                    </span>
                    <span className={cn("font-medium w-16 text-right", stats.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {formatINR(stats.pnl)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EvolvedParamsCard;
