// AI Agent — Latest Decision card
import { tw } from '../../lib/colorMap';
import {
  Brain, Shield, Target, XCircle, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '../ui';
import { cn } from '../../lib/utils';
import { STRATEGY_INFO, REGIME_COLORS } from './constants';

const LatestDecision = ({ decision, snapshot }) => {
  if (!decision) {
    return (
      <Card className="bg-slate-800/60 border-slate-700/50">
        <CardContent className="p-6 text-center">
          <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Waiting for first decision...</p>
          <p className="text-slate-600 text-xs mt-1">The agent is analyzing market conditions</p>
        </CardContent>
      </Card>
    );
  }

  const stratInfo = STRATEGY_INFO[decision.strategy] || STRATEGY_INFO.no_trade;
  const regimeColor = REGIME_COLORS[decision.market_regime] || 'text-slate-400';

  return (
    <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden">
      <div className={cn(
        "h-1",
        decision.action === 'ENTER' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
        decision.action === 'EXIT' ? 'bg-gradient-to-r from-red-500 to-orange-500' :
        decision.action === 'ADJUST' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
        'bg-gradient-to-r from-slate-600 to-slate-500'
      )} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Latest Decision
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  decision.action === 'ENTER' ? 'bg-emerald-500/20 text-emerald-400' :
                  decision.action === 'EXIT' ? 'bg-red-500/20 text-red-400' :
                  decision.action === 'ADJUST' ? 'bg-amber-500/20 text-amber-400' :
                  decision.action === 'WAIT' ? 'bg-slate-500/20 text-slate-400' :
                  'bg-blue-500/20 text-blue-400'
                )}>
                  {decision.action}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {decision.timestamp ? new Date(decision.timestamp).toLocaleTimeString('en-IN') : '--'} · {decision.id}
              </p>
            </div>
          </div>

          {/* Confidence meter */}
          <div className="text-right">
            <div className={cn(
              "text-lg font-bold",
              decision.confidence_score >= 80 ? 'text-emerald-400' :
              decision.confidence_score >= 60 ? 'text-amber-400' :
              'text-red-400'
            )}>
              {decision.confidence_score?.toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500">confidence</div>
          </div>
        </div>

        {/* Strategy & Regime */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-lg",
            `${tw(stratInfo.color, 'bg10')} ${tw(stratInfo.color, 'text400')} border ${tw(stratInfo.color, 'border20')}`
          )}>
            <span>{stratInfo.icon}</span> {stratInfo.name}
          </span>
          <span className={cn("text-xs px-2 py-1 rounded-lg bg-slate-700/50 border border-slate-600/20", regimeColor)}>
            {decision.market_regime?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Reasoning */}
        <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
          <p className="text-sm text-slate-300 leading-relaxed">{decision.reasoning || 'No reasoning logged'}</p>
        </div>

        {/* Risk Assessment */}
        {decision.risk_assessment && (
          <div className="flex items-start gap-2 bg-amber-500/5 rounded-lg p-2.5 border border-amber-500/10">
            <Shield className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300/80">{decision.risk_assessment}</p>
          </div>
        )}

        {/* Scenarios */}
        {decision.scenarios_considered?.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Scenarios Considered</p>
            {decision.scenarios_considered.map((s, i) => (
              <div key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-600" />
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Hedge Plan */}
        {decision.hedge_plan && (decision.hedge_plan.required || decision.hedge_plan.reason) && (
          <div className="mt-3 bg-purple-500/5 rounded-lg p-3 border border-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">Hedge Plan</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                decision.hedge_plan.required ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              )}>
                {decision.hedge_plan.required ? '⚠️ Required' : '✅ Not Required'}
              </span>
            </div>
            {decision.hedge_plan.reason && (
              <p className="text-xs text-slate-400 mb-2">{decision.hedge_plan.reason}</p>
            )}
            {decision.hedge_plan.legs?.length > 0 && (
              <div className="space-y-1">
                {decision.hedge_plan.legs.map((leg, i) => (
                  <div key={i} className={cn(
                    "flex items-center gap-2 text-[10px] px-2.5 py-1.5 rounded-lg",
                    leg.direction === 'BUY' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                  )}>
                    <span className={cn("font-bold", leg.direction === 'BUY' ? 'text-green-400' : 'text-red-400')}>
                      {leg.action} {leg.direction}
                    </span>
                    <span className="text-slate-300">
                      {leg.instrument}{leg.strike ? ` @ ${leg.strike}` : ''}
                    </span>
                    {leg.quantity_lots && <span className="text-slate-500">x{leg.quantity_lots}L</span>}
                    {leg.notes && <span className="text-slate-500 ml-auto">{leg.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Position Plan */}
        {decision.position_plan && (decision.position_plan.targets || decision.position_plan.exits) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {decision.position_plan.targets && (
              <div className="bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/10">
                <div className="text-[10px] text-emerald-400 mb-1 font-semibold flex items-center gap-1">
                  <Target className="w-3 h-3" /> Targets / SL
                </div>
                <p className="text-[11px] text-slate-400">{decision.position_plan.targets}</p>
              </div>
            )}
            {decision.position_plan.exits && (
              <div className="bg-red-500/5 rounded-lg p-2.5 border border-red-500/10">
                <div className="text-[10px] text-red-400 mb-1 font-semibold flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Exit Triggers
                </div>
                <p className="text-[11px] text-slate-400">{decision.position_plan.exits}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LatestDecision;
