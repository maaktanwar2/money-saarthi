// AI Agent — Expandable thought log with LLM reasoning chains
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { fetchWithAuth } from '../../config/api';

const ThoughtLogPanel = ({ agentStatus }) => {
  const [thoughts, setThoughts] = useState([]);

  useEffect(() => {
    const fetchThoughts = async () => {
      try {
        const res = await fetchWithAuth(`/ai-agent/thought-log?user_id=default&limit=10`);
        const data = await res.json();
        if (data.success) setThoughts(data.data.thoughts || []);
      } catch (err) { console.error(err); }
    };
    fetchThoughts();
  }, []);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      <Card className="bg-slate-800/60 border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            Full Thought Log (LLM Reasoning Chains)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {thoughts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No thought logs yet</p>
            ) : (
              thoughts.map((t, i) => (
                <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] text-slate-400">Cycle #{t.cycle}</span>
                    <span className="text-[10px] text-slate-500">{t.time ? new Date(t.time).toLocaleTimeString('en-IN') : ''}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{t.decision?.reasoning}</p>
                  {t.decision?.scenarios_considered?.map((s, j) => (
                    <div key={j} className="text-[10px] text-slate-500 ml-2">• {s}</div>
                  ))}
                  {t.snapshot && (
                    <div className="mt-2 text-[10px] text-slate-600">
                      Spot: {t.snapshot.spot_price} | Trend: {t.snapshot.trend} | VIX: {t.snapshot.vix}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ThoughtLogPanel;
