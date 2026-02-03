import React, { useState } from 'react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR, formatPercent } from '../lib/utils';

// Trading Journal Page
export default function TradingJournal() {
  const [activeTab, setActiveTab] = useState('trades');
  
  // Mock trades data
  const trades = [
    {
      id: 1,
      date: '2024-01-15',
      symbol: 'NIFTY 22500 CE',
      type: 'BUY',
      entry: 150,
      exit: 185,
      qty: 50,
      pnl: 1750,
      notes: 'Breakout trade on strong momentum'
    },
    {
      id: 2,
      date: '2024-01-14',
      symbol: 'RELIANCE',
      type: 'SELL',
      entry: 2850,
      exit: 2820,
      qty: 10,
      pnl: 300,
      notes: 'Short on resistance rejection'
    },
    {
      id: 3,
      date: '2024-01-13',
      symbol: 'BANKNIFTY 48000 PE',
      type: 'BUY',
      entry: 200,
      exit: 150,
      qty: 25,
      pnl: -1250,
      notes: 'Stop loss hit - market reversed'
    },
  ];

  const stats = {
    totalTrades: 45,
    winRate: 62.5,
    avgWin: 2500,
    avgLoss: -1200,
    profitFactor: 1.85,
    totalPnL: 45000
  };

  return (
    <PageLayout>
      <PageHeader
        title="Trading Journal"
        subtitle="Track, analyze, and improve your trading performance"
      />

      {/* Stats Overview */}
      <Section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
            <div className="text-xs text-muted-foreground">Total Trades</div>
          </Card>
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-profit">{stats.winRate}%</div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
          </Card>
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-profit">{formatINR(stats.avgWin)}</div>
            <div className="text-xs text-muted-foreground">Avg Win</div>
          </Card>
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-loss">{formatINR(stats.avgLoss)}</div>
            <div className="text-xs text-muted-foreground">Avg Loss</div>
          </Card>
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold">{stats.profitFactor}</div>
            <div className="text-xs text-muted-foreground">Profit Factor</div>
          </Card>
          <Card className="glass-card p-4 text-center">
            <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatINR(stats.totalPnL)}
            </div>
            <div className="text-xs text-muted-foreground">Total P&L</div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs 
          tabs={[
            { id: 'trades', label: 'Recent Trades' },
            { id: 'add', label: '+ Add Trade' },
            { id: 'analysis', label: 'Analysis' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Content */}
        {activeTab === 'trades' && (
          <Card className="glass-card mt-6">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Symbol</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Entry</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Exit</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Qty</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">P&L</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Notes</th>
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
                        <td className="p-4 text-sm text-right">{formatINR(trade.exit)}</td>
                        <td className="p-4 text-sm text-right">{trade.qty}</td>
                        <td className={`p-4 text-sm text-right font-medium ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatINR(trade.pnl)}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">{trade.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'add' && (
          <Card className="glass-card mt-6">
            <CardHeader>
              <CardTitle>Add New Trade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Date</label>
                  <Input type="date" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Symbol</label>
                  <Input placeholder="e.g. NIFTY 22500 CE" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Type</label>
                  <select className="input w-full">
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Entry Price</label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Exit Price</label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Quantity</label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-sm text-muted-foreground block mb-2">Notes</label>
                  <textarea 
                    className="input w-full h-24 resize-none"
                    placeholder="Trade rationale, observations, lessons learned..."
                  />
                </div>
              </div>
              <Button className="mt-4">Save Trade</Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'analysis' && (
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Performance by Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, i) => (
                    <div key={day} className="flex items-center justify-between">
                      <span className="text-sm">{day}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${[65, 45, 72, 58, 80][i] > 50 ? 'bg-profit' : 'bg-loss'}`}
                            style={{ width: `${[65, 45, 72, 58, 80][i]}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {[65, 45, 72, 58, 80][i]}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Top Performing Setups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Breakout', winRate: 75, trades: 12 },
                    { name: 'Mean Reversion', winRate: 68, trades: 8 },
                    { name: 'Momentum', winRate: 62, trades: 15 },
                    { name: 'Gap Fill', winRate: 55, trades: 10 },
                  ].map(setup => (
                    <div key={setup.name} className="flex items-center justify-between p-3 rounded-lg bg-background">
                      <div>
                        <div className="font-medium">{setup.name}</div>
                        <div className="text-xs text-muted-foreground">{setup.trades} trades</div>
                      </div>
                      <Badge variant={setup.winRate > 60 ? 'success' : 'warning'}>
                        {setup.winRate}% win
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Section>
    </PageLayout>
  );
}
