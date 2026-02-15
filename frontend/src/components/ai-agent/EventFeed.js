// AI Agent — Live Event Feed with filter tabs
import {
  Power, Rocket, Square, Eye, Brain, Zap, Sparkles,
  RotateCw, Shield, AlertCircle, Settings, Clock, XCircle,
  Pause, Play, Terminal, MessageSquare
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { cn } from '../../lib/utils';

const EVENT_TYPES = ['ALL', 'THINK', 'ACT', 'REFLECT', 'ADAPT', 'SAFETY', 'ERROR'];

const EVENT_ICONS = {
  SYSTEM: Power,
  START: Rocket,
  STOP: Square,
  OBSERVE: Eye,
  THINK: Brain,
  ACT: Zap,
  REFLECT: Sparkles,
  ADAPT: RotateCw,
  SAFETY: Shield,
  ERROR: AlertCircle,
  WARN: AlertCircle,
  CONFIG: Settings,
  IDLE: Clock,
  EXIT: XCircle,
  PAUSE: Pause,
  RESUME: Play,
};

const EventFeed = ({ events, filter, setFilter }) => {
  const filtered = filter === 'ALL' ? events : events.filter(e => e.type === filter);

  return (
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Live Feed
          <span className="text-[10px] text-slate-500 font-normal ml-auto">{filtered.length} events</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {EVENT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-md transition-all",
                filter === t
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >{t}</button>
          ))}
        </div>

        {/* Events list */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No events yet</p>
          ) : (
            filtered.slice(0, 50).map((evt, i) => {
              const EvtIcon = EVENT_ICONS[evt.type] || MessageSquare;
              return (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-700/20 last:border-0">
                  <EvtIcon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0",
                    evt.type === 'ERROR' ? 'text-red-400' :
                    evt.type === 'SAFETY' ? 'text-amber-400' :
                    evt.type === 'ACT' ? 'text-emerald-400' :
                    evt.type === 'THINK' ? 'text-purple-400' :
                    evt.type === 'ADAPT' ? 'text-cyan-400' :
                    'text-slate-500'
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">
                        {evt.time ? new Date(evt.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </span>
                      <span className="text-[11px] font-medium text-slate-200 truncate">{evt.title}</span>
                    </div>
                    {evt.detail && (
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{evt.detail}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EventFeed;
