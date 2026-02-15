// Options Hub — shared constants
import { Layers, BarChart3, TrendingUp, Activity, LineChart } from 'lucide-react';

export const INDICES = [
  { value: 'NIFTY', label: 'NIFTY 50' },
  { value: 'BANKNIFTY', label: 'Bank NIFTY' },
  { value: 'FINNIFTY', label: 'FIN NIFTY' },
  { value: 'MIDCPNIFTY', label: 'MIDCAP NIFTY' },
];

export const TOOLS = [
  { id: 'chain', label: 'Option Chain', icon: Layers },
  { id: 'oi-analysis', label: 'OI Analysis', icon: BarChart3 },
  { id: 'iv-skew', label: 'IV Skew', icon: TrendingUp },
  { id: 'greeks', label: 'Greeks', icon: Activity },
  { id: 'payoff', label: 'Payoff Chart', icon: LineChart },
];

export const REFRESH_INTERVAL = 30000; // 30 seconds

export const formatTime = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch { return ''; }
};
