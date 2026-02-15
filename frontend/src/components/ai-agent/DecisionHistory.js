// AI Agent — Decision History timeline
import { STRATEGY_INFO } from './constants';
import { Lightbulb, Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { cn } from '../../lib/utils';

const DecisionHistory = ({ decisions, onShowThoughts }) => (
  <Card className="bg-slate-800/60 border-slate-700/50">
    <CardHeader className="pb-2">
      <div className="flex justify-between items-center">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Decision History ({decisions.length})
        </CardTitle>
        <button onClick={onShowThoughts} className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
          <Terminal className="w-3 h-3" /> Full Thought Log
        </button>
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      {decisions.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No decisions yet</p>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {decisions.map((d, i) => {
            const stratInfo = STRATEGY_INFO[d.strategy] || STRATEGY_INFO.no_trade;
            return (
              <div key={d.id || i} className="flex items-center gap-3 py-1.5 border-b border-slate-700/30 last:border-0">
                <span className="text-[10px] text-slate-500 w-14 flex-shrink-0">
                  {d.timestamp ? new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium w-14 text-center flex-shrink-0",
                  d.action === 'ENTER' ? 'bg-emerald-500/20 text-emerald-400' :
                  d.action === 'EXIT' ? 'bg-red-500/20 text-red-400' :
                  d.action === 'ADJUST' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                )}>
                  {d.action}
                </span>
                <span className="text-xs text-slate-300 truncate flex-1">
                  {stratInfo.icon} {stratInfo.name}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  d.confidence_score >= 70 ? 'text-emerald-400' : d.confidence_score >= 50 ? 'text-amber-400' : 'text-slate-500'
                )}>
                  {d.confidence_score?.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);

export default DecisionHistory;
