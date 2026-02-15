// AI Agent — Idle / Landing view with hero, how-it-works, strategies grid
import { tw } from '../../lib/colorMap';
import {
  Brain, Eye, Lightbulb, Zap, Sparkles, RotateCw,
  Rocket, Network
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../ui';
import { cn } from '../../lib/utils';
import { STRATEGY_INFO } from './constants';

const IdleView = ({ onLaunch }) => (
  <div className="space-y-6">
    {/* Hero */}
    <Card className="bg-gradient-to-br from-purple-900/30 via-slate-800/60 to-pink-900/20 border-purple-500/20 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      <CardContent className="p-8 relative">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">
              Autonomous AI Trading Agent
            </h2>
            <p className="text-slate-400 text-sm max-w-lg mb-4">
              A self-thinking, self-adjusting AI agent that autonomously analyzes markets, 
              selects strategies, executes trades, and learns from outcomes. Powered by Claude AI.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                '🧠 Claude AI Brain', '📊 Multi-Strategy', '🔄 Self-Adapting',
                '🛡️ Risk Management', '⚡ Real-Time', '📈 Performance Tracking'
              ].map((tag, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/30">
                  {tag}
                </span>
              ))}
            </div>
            <Button
              onClick={onLaunch}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 shadow-lg shadow-purple-500/20"
              size="lg"
            >
              <Rocket className="w-4 h-4 mr-2" /> Launch AI Agent
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* How It Works */}
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { icon: Eye, title: 'OBSERVE', desc: 'Scans spot, VIX, OI, technicals', color: 'blue' },
        { icon: Brain, title: 'THINK', desc: 'Claude AI reasons through scenarios', color: 'purple' },
        { icon: Lightbulb, title: 'DECIDE', desc: 'Picks optimal strategy & params', color: 'amber' },
        { icon: Zap, title: 'ACT', desc: 'Places/adjusts/exits trades', color: 'emerald' },
        { icon: Sparkles, title: 'REFLECT', desc: 'Analyzes outcomes & learns', color: 'cyan' },
        { icon: RotateCw, title: 'ADAPT', desc: 'Self-modifies for better results', color: 'pink' },
      ].map((step, i) => (
        <Card key={i} className="bg-slate-800/40 border-slate-700/30 hover:border-slate-600/50 transition-all">
          <CardContent className="p-4 text-center">
            <div className={cn("w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center",
              tw(step.color, 'bg10')
            )}>
              <step.icon className={cn("w-5 h-5", tw(step.color, 'text400'))} />
            </div>
            <h3 className="text-xs font-bold text-white mb-1">{step.title}</h3>
            <p className="text-[10px] text-slate-500">{step.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Available Strategies */}
    <Card className="bg-slate-800/60 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Network className="w-4 h-4 text-purple-400" />
          Available Strategies (Agent picks autonomously)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(STRATEGY_INFO).filter(([k]) => k !== 'no_trade').map(([key, info]) => (
            <div key={key} className={cn(
              "p-3 rounded-lg border transition-all",
              `${tw(info.color, 'bg5')} ${tw(info.color, 'border10')}`
            )}>
              <span className="text-lg mr-2">{info.icon}</span>
              <span className="text-xs font-medium text-white">{info.name}</span>
              <p className="text-[10px] text-slate-500 mt-1">{info.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default IdleView;
