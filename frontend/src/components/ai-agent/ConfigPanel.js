// AI Agent — Config Panel (modal)
import { motion } from 'framer-motion';
import { tw } from '../../lib/colorMap';
import {
  Brain, Snowflake, Gauge, Flame, Rocket
} from 'lucide-react';
import { Button, Spinner } from '../ui';
import { cn } from '../../lib/utils';

const ConfigPanel = ({ config, setConfig, onStart, onClose, starting }) => {
  const update = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Configure AI Agent</h2>
            <p className="text-xs text-slate-400">Set parameters before launch</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Underlying */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Underlying</label>
            <div className="flex gap-2">
              {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(sym => (
                <button
                  key={sym}
                  onClick={() => update('underlying', sym)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    config.underlying === sym
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:border-slate-500"
                  )}
                >{sym}</button>
              ))}
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Risk Level</label>
            <div className="flex gap-2">
              {[
                { value: 'conservative', icon: Snowflake, label: 'Conservative', color: 'blue' },
                { value: 'moderate', icon: Gauge, label: 'Moderate', color: 'amber' },
                { value: 'aggressive', icon: Flame, label: 'Aggressive', color: 'red' },
              ].map(r => (
                <button
                  key={r.value}
                  onClick={() => update('risk_level', r.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all flex-1",
                    config.risk_level === r.value
                      ? `${tw(r.color, 'bg20')} ${tw(r.color, 'text300')} border ${tw(r.color, 'border40')}`
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:border-slate-500"
                  )}
                >
                  <r.icon className="w-3.5 h-3.5" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Capital & Lots */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Max Capital (₹)</label>
              <input
                type="number"
                value={config.max_capital}
                onChange={e => update('max_capital', Number(e.target.value))}
                className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Lots per Trade</label>
              <input
                type="number"
                value={config.num_lots}
                onChange={e => update('num_lots', Number(e.target.value))}
                min={1} max={10}
                className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Confidence & Interval */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Min Confidence ({config.min_confidence}%)</label>
              <input
                type="range"
                min={40} max={95} value={config.min_confidence}
                onChange={e => update('min_confidence', Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Think Interval (sec)</label>
              <input
                type="number"
                value={config.think_interval}
                onChange={e => update('think_interval', Number(e.target.value))}
                min={30} max={300}
                className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Toggle Options */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'use_mock', label: '🧪 Mock Mode (Paper Trade)', hint: 'No real orders' },
              { key: 'auto_enter', label: '⚡ Auto-Enter Trades' },
              { key: 'auto_exit', label: '🚪 Auto-Exit Positions' },
              { key: 'auto_adjust', label: '🔧 Auto-Adjust Positions' },
              { key: 'adapt_enabled', label: '🧬 Self-Adaptation' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => update(opt.key, !config[opt.key])}
                className={cn(
                  "text-left px-3 py-2 rounded-lg text-xs transition-all",
                  config[opt.key]
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-700/30 text-slate-500 border border-slate-600/20"
                )}
              >
                {opt.label}
                {opt.hint && <span className="block text-[10px] opacity-60 mt-0.5">{opt.hint}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button onClick={onClose} variant="outline" className="flex-1 border-slate-600 text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={onStart}
            disabled={starting}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
          >
            {starting ? <Spinner className="w-4 h-4 mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
            {starting ? 'Starting...' : 'Launch Agent'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConfigPanel;
