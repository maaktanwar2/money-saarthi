import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR } from '../lib/utils';
import { Trash2 } from 'lucide-react';

const STORAGE_KEY = 'ms_trading_journal';

const loadTrades = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
};

const saveTrades = (trades) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
};

const EMPTY_FORM = { date: '', symbol: '', type: 'BUY', entry: '', exit: '', qty: '', notes: '' };

// Trading Journal Page — localStorage-backed, zero mock data
export default function TradingJournal() {
  const [activeTab, setActiveTab] = useState('trades');
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  useEffect(() => { setTrades(loadTrades()); }, []);

  // Derived stats from real trades
  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
    const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
    const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? ((wins.length / trades.length) * 100).toFixed(1) : 0,
      avgWin,
      avgLoss,
      profitFactor: grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '∞' : '0',
      totalPnL,
    };
  }, [trades]);

  const handleSave = useCallback(() => {
    setFormError('');
    if (!form.date || !form.symbol || !form.entry || !form.qty) {
      setFormError('Please fill date, symbol, entry price and quantity.');
      return;
    }
    const entry = parseFloat(form.entry);
    const exit = form.exit ? parseFloat(form.exit) : null;
    const qty = parseInt(form.qty, 10);
    if (isNaN(entry) || isNaN(qty) || qty <= 0) {
      setFormError('Entry and quantity must be valid numbers.');
      return;
    }
    const pnl = exit !== null
      ? (form.type === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty)
      : 0;
    const newTrade = {
      id: Date.now(),
      date: form.date,
      symbol: form.symbol.toUpperCase(),
      type: form.type,
      entry,
      exit,
      qty,
      pnl: Math.round(pnl),
      notes: form.notes,
    };
    const updated = [newTrade, ...trades];
    setTrades(updated);
    saveTrades(updated);
    setForm(EMPTY_FORM);
    setActiveTab('trades');
  }, [form, trades]);

  const handleDelete = useCallback((id) => {
    const updated = trades.filter(t => t.id !== id);
    setTrades(updated);
    saveTrades(updated);
  }, [trades]);

  // Day-of-week analysis from real trades
  const dayAnalysis = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = {};
    trades.forEach(t => {
      const d = new Date(t.date);
      const dayName = days[d.getDay()];
      if (!grouped[dayName]) grouped[dayName] = { wins: 0, total: 0 };
      grouped[dayName].total++;
      if (t.pnl > 0) grouped[dayName].wins++;
    });
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      .map(day => ({
        day,
        winRate: grouped[day] ? Math.round((grouped[day].wins / grouped[day].total) * 100) : null,
        trades: grouped[day]?.total || 0,
      }));
  }, [trades]);

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/journal')} path="/journal" />
      <PageHeader
        title="Trading Journal"
        subtitle="Track, analyze, and improve your trading performance"
      />

      {/* Stats Overview — derived from real trades */}
      <Section>
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card className="glass-card p-4 text-center">
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
              <div className="text-xs text-foreground-muted">Total Trades</div>
            </Card>
            <Card className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-profit">{stats.winRate}%</div>
              <div className="text-xs text-foreground-muted">Win Rate</div>
            </Card>
            <Card className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-profit">{formatINR(stats.avgWin)}</div>
              <div className="text-xs text-foreground-muted">Avg Win</div>
            </Card>
            <Card className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-loss">{formatINR(stats.avgLoss)}</div>
              <div className="text-xs text-foreground-muted">Avg Loss</div>
            </Card>
            <Card className="glass-card p-4 text-center">
              <div className="text-2xl font-bold">{stats.profitFactor}</div>
              <div className="text-xs text-foreground-muted">Profit Factor</div>
            </Card>
            <Card className="glass-card p-4 text-center">
              <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatINR(stats.totalPnL)}
              </div>
              <div className="text-xs text-foreground-muted">Total P&L</div>
            </Card>
          </div>
        ) : (
          <Card className="glass-card p-8 text-center mb-8">
            <p className="text-foreground-muted mb-2">No trades logged yet.</p>
            <Button onClick={() => setActiveTab('add')}>Log Your First Trade</Button>
          </Card>
        )}

        {/* Tabs */}
        <Tabs 
          tabs={[
            { id: 'trades', label: `Recent Trades (${trades.length})` },
            { id: 'add', label: '+ Add Trade' },
            { id: 'analysis', label: 'Analysis' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Trades Table */}
        {activeTab === 'trades' && (
          <Card className="glass-card mt-6">
            <CardContent className="p-0">
              {trades.length === 0 ? (
                <div className="p-8 text-center text-foreground-muted">
                  No trades yet. Click "+ Add Trade" to log your first trade.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-sm font-medium text-foreground-muted">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-foreground-muted">Symbol</th>
                        <th className="text-left p-4 text-sm font-medium text-foreground-muted">Type</th>
                        <th className="text-right p-4 text-sm font-medium text-foreground-muted">Entry</th>
                        <th className="text-right p-4 text-sm font-medium text-foreground-muted">Exit</th>
                        <th className="text-right p-4 text-sm font-medium text-foreground-muted">Qty</th>
                        <th className="text-right p-4 text-sm font-medium text-foreground-muted">P&L</th>
                        <th className="text-left p-4 text-sm font-medium text-foreground-muted">Notes</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map(trade => (
                        <tr key={trade.id} className="border-b border-border/50 hover:bg-card/50">
                          <td className="p-4 text-sm">{trade.date}</td>
                          <td className="p-4 text-sm font-medium">{trade.symbol}</td>
                          <td className="p-4">
                            <Badge variant={trade.type === 'BUY' ? 'success' : 'error'}>
                              {trade.type}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-right">{formatINR(trade.entry)}</td>
                          <td className="p-4 text-sm text-right">{trade.exit !== null ? formatINR(trade.exit) : '—'}</td>
                          <td className="p-4 text-sm text-right">{trade.qty}</td>
                          <td className={`p-4 text-sm text-right font-medium ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {trade.exit !== null ? formatINR(trade.pnl) : 'Open'}
                          </td>
                          <td className="p-4 text-sm text-foreground-muted max-w-[200px] truncate">{trade.notes}</td>
                          <td className="p-4">
                            <button 
                              onClick={() => handleDelete(trade.id)}
                              className="text-foreground-muted hover:text-red-500 transition-colors"
                              title="Delete trade"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Trade Form — fully functional */}
        {activeTab === 'add' && (
          <Card className="glass-card mt-6">
            <CardHeader>
              <CardTitle>Add New Trade</CardTitle>
            </CardHeader>
            <CardContent>
              {formError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                  {formError}
                </div>
              )}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Date *</label>
                  <Input 
                    type="date" 
                    value={form.date} 
                    onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Symbol *</label>
                  <Input 
                    placeholder="e.g. NIFTY 22500 CE" 
                    value={form.symbol}
                    onChange={(e) => setForm(f => ({ ...f, symbol: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Type</label>
                  <select 
                    className="input w-full"
                    value={form.type}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Entry Price *</label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={form.entry}
                    onChange={(e) => setForm(f => ({ ...f, entry: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Exit Price (leave blank if open)</label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={form.exit}
                    onChange={(e) => setForm(f => ({ ...f, exit: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Quantity *</label>
                  <Input 
                    type="number" 
                    placeholder="0" 
                    value={form.qty}
                    onChange={(e) => setForm(f => ({ ...f, qty: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-sm text-foreground-muted block mb-2">Notes</label>
                  <textarea 
                    className="input w-full h-24 resize-none"
                    placeholder="Trade rationale, observations, lessons learned..."
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <Button className="mt-4" onClick={handleSave}>Save Trade</Button>
            </CardContent>
          </Card>
        )}

        {/* Analysis — derived from real trades only */}
        {activeTab === 'analysis' && (
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Win Rate by Day</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length < 3 ? (
                  <p className="text-foreground-muted text-sm">Log at least 3 trades to see day-wise analysis.</p>
                ) : (
                  <div className="space-y-3">
                    {dayAnalysis.map(({ day, winRate, trades: count }) => (
                      <div key={day} className="flex items-center justify-between">
                        <span className="text-sm">{day}</span>
                        {count > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${winRate > 50 ? 'bg-profit' : 'bg-loss'}`}
                                style={{ width: `${winRate}%` }}
                              />
                            </div>
                            <span className="text-sm text-foreground-muted w-16 text-right">
                              {winRate}% ({count})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-muted">No trades</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Top Symbols</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length < 3 ? (
                  <p className="text-foreground-muted text-sm">Log more trades to see symbol-level analysis.</p>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const grouped = {};
                      trades.forEach(t => {
                        if (!grouped[t.symbol]) grouped[t.symbol] = { pnl: 0, count: 0, wins: 0 };
                        grouped[t.symbol].pnl += t.pnl;
                        grouped[t.symbol].count++;
                        if (t.pnl > 0) grouped[t.symbol].wins++;
                      });
                      return Object.entries(grouped)
                        .sort((a, b) => b[1].pnl - a[1].pnl)
                        .slice(0, 5)
                        .map(([symbol, data]) => (
                          <div key={symbol} className="flex items-center justify-between p-3 rounded-lg bg-background">
                            <div>
                              <div className="font-medium">{symbol}</div>
                              <div className="text-xs text-foreground-muted">
                                {data.count} trades — {Math.round((data.wins / data.count) * 100)}% win
                              </div>
                            </div>
                            <span className={`font-semibold ${data.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {formatINR(data.pnl)}
                            </span>
                          </div>
                        ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Section>
    </PageLayout>
  );
}

