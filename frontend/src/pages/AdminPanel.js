import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { DataTable } from '../components/ui/DataTable';
import { formatINR } from '../lib/utils';
import { getUserFromStorage, isAdmin } from './UserProfile';

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL - Super Rights for Admin Users
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const storedUser = getUserFromStorage();
    if (storedUser && isAdmin(storedUser.email)) {
      setUser(storedUser);
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

  // Mock data for admin panel
  const [users] = useState([
    { id: 1, name: 'Demo User', email: 'demo@test.com', plan: 'free', status: 'active', joinedAt: '2024-01-15', trades: 45 },
    { id: 2, name: 'John Trader', email: 'john@example.com', plan: 'premium', status: 'active', joinedAt: '2024-02-20', trades: 234 },
    { id: 3, name: 'Sarah Smith', email: 'sarah@example.com', plan: 'premium', status: 'active', joinedAt: '2024-03-10', trades: 156 },
    { id: 4, name: 'Mike Wilson', email: 'mike@example.com', plan: 'free', status: 'inactive', joinedAt: '2024-01-25', trades: 12 },
    { id: 5, name: 'Emily Brown', email: 'emily@example.com', plan: 'premium', status: 'active', joinedAt: '2024-04-05', trades: 89 },
  ]);

  const [signals] = useState([
    { id: 1, symbol: 'NIFTY 22500 CE', type: 'BUY', confidence: 85, status: 'active', generated: '10 mins ago' },
    { id: 2, symbol: 'BANKNIFTY 48000 PE', type: 'SELL', confidence: 72, status: 'closed', generated: '2 hours ago' },
    { id: 3, symbol: 'RELIANCE', type: 'BUY', confidence: 68, status: 'active', generated: '30 mins ago' },
  ]);

  const [systemStats] = useState({
    totalUsers: 1247,
    activeUsers: 856,
    premiumUsers: 312,
    totalSignals: 4521,
    signalAccuracy: 73.5,
    apiCalls: '2.4M',
    serverLoad: 45,
    uptime: '99.97%'
  });

  // Not authorized - show access denied
  if (!isAuthorized) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="glass-card p-8 text-center max-w-md">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access the admin panel.
              Only administrators can view this page.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Dashboard
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Admin Panel"
        subtitle="Super Admin Controls & System Management"
      />

      {/* Admin Badge */}
      <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
        <span className="text-2xl">👑</span>
        <div>
          <div className="font-semibold text-red-400">Super Admin Access</div>
          <div className="text-sm text-muted-foreground">Logged in as {user?.email}</div>
        </div>
      </div>

      <Section>
        <Tabs
          tabs={[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'users', label: '👥 Users' },
            { id: 'signals', label: '📡 Signals' },
            { id: 'content', label: '📝 Content' },
            { id: 'system', label: '⚙️ System' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 mt-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: systemStats.totalUsers.toLocaleString(), icon: '👥', color: 'text-blue-400' },
                { label: 'Active Users', value: systemStats.activeUsers.toLocaleString(), icon: '🟢', color: 'text-green-400' },
                { label: 'Premium Users', value: systemStats.premiumUsers.toLocaleString(), icon: '⭐', color: 'text-yellow-400' },
                { label: 'Signal Accuracy', value: `${systemStats.signalAccuracy}%`, icon: '🎯', color: 'text-primary' },
              ].map(stat => (
                <motion.div
                  key={stat.label}
                  whileHover={{ scale: 1.02 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>{stat.icon}</span>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                </motion.div>
              ))}
            </div>

            {/* Quick Actions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Generate Signal', icon: '📡', action: () => alert('Signal generated!') },
                    { label: 'Clear Cache', icon: '🗑️', action: () => alert('Cache cleared!') },
                    { label: 'Broadcast Alert', icon: '📢', action: () => alert('Alert sent!') },
                    { label: 'System Health', icon: '💚', action: () => alert('All systems operational!') },
                  ].map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={action.action}
                    >
                      <span className="text-2xl">{action.icon}</span>
                      <span>{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'API Server', status: 'Operational', color: 'bg-green-500' },
                    { label: 'Database', status: 'Operational', color: 'bg-green-500' },
                    { label: 'WebSocket', status: 'Operational', color: 'bg-green-500' },
                    { label: 'Data Feed', status: 'Operational', color: 'bg-green-500' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-sm text-muted-foreground">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Server Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">CPU Load</span>
                      <span className="text-sm">{systemStats.serverLoad}%</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${systemStats.serverLoad}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm">62%</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: '62%' }} />
                    </div>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="text-profit font-medium">{systemStats.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Calls (24h)</span>
                    <span className="font-medium">{systemStats.apiCalls}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="mt-6">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Button size="sm">+ Add User</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Plan</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Trades</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Joined</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-border/50 hover:bg-card/50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{u.name}</div>
                              <div className="text-sm text-muted-foreground">{u.email}</div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={u.plan === 'premium' ? 'default' : 'secondary'}>
                              {u.plan}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={u.status === 'active' ? 'success' : 'error'}>
                              {u.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">{u.trades}</td>
                          <td className="p-3 text-sm">{u.joinedAt}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline">Edit</Button>
                              <Button size="sm" variant="outline" className="text-red-500">Ban</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Signals Tab */}
        {activeTab === 'signals' && (
          <div className="space-y-6 mt-6">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Signal Management</CardTitle>
                <Button size="sm">+ Generate Signal</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signals.map(signal => (
                    <div key={signal.id} className="flex items-center justify-between p-4 rounded-lg bg-background">
                      <div className="flex items-center gap-4">
                        <Badge variant={signal.type === 'BUY' ? 'success' : 'error'}>
                          {signal.type}
                        </Badge>
                        <div>
                          <div className="font-medium">{signal.symbol}</div>
                          <div className="text-sm text-muted-foreground">{signal.generated}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-medium">{signal.confidence}%</div>
                          <div className="text-xs text-muted-foreground">Confidence</div>
                        </div>
                        <Badge variant={signal.status === 'active' ? 'default' : 'secondary'}>
                          {signal.status}
                        </Badge>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Signal Generator */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Manual Signal Generator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Symbol</label>
                    <Input placeholder="e.g., NIFTY 22500 CE" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Type</label>
                    <select className="input w-full">
                      <option>BUY</option>
                      <option>SELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Confidence (%)</label>
                    <Input type="number" placeholder="75" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Target Price</label>
                    <Input type="number" placeholder="0.00" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm text-muted-foreground block mb-2">Rationale</label>
                  <textarea className="input w-full h-20" placeholder="Enter signal rationale..." />
                </div>
                <Button className="mt-4">Broadcast Signal</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6 mt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Content Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    { label: 'Announcements', desc: 'Manage platform announcements', icon: '📢' },
                    { label: 'News & Updates', desc: 'Post market news and updates', icon: '📰' },
                    { label: 'Educational Content', desc: 'Manage courses and tutorials', icon: '📚' },
                    { label: 'Scanner Configs', desc: 'Configure scanner algorithms', icon: '🔧' },
                    { label: 'Strategy Templates', desc: 'Manage trading strategies', icon: '📈' },
                    { label: 'Help & FAQs', desc: 'Update help documentation', icon: '❓' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-4 p-4 rounded-lg bg-background hover:bg-card/80 cursor-pointer transition-colors">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.desc}</div>
                      </div>
                      <Button size="sm" variant="outline">Manage</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6 mt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">API Rate Limit (per min)</label>
                    <Input type="number" defaultValue={60} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Cache TTL (seconds)</label>
                    <Input type="number" defaultValue={300} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Max Concurrent Users</label>
                    <Input type="number" defaultValue={1000} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Maintenance Mode</label>
                    <select className="input w-full">
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </select>
                  </div>
                </div>
                <Button>Save Configuration</Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div>
                    <div className="font-medium text-red-400">Clear All Cache</div>
                    <div className="text-sm text-muted-foreground">Remove all cached data from the system</div>
                  </div>
                  <Button variant="outline" className="text-red-500 border-red-500/20">
                    Clear Cache
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div>
                    <div className="font-medium text-red-400">Reset All Signals</div>
                    <div className="text-sm text-muted-foreground">Close all active signals</div>
                  </div>
                  <Button variant="outline" className="text-red-500 border-red-500/20">
                    Reset Signals
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div>
                    <div className="font-medium text-red-400">Database Backup</div>
                    <div className="text-sm text-muted-foreground">Create a full database backup</div>
                  </div>
                  <Button variant="outline" className="text-red-500 border-red-500/20">
                    Create Backup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Section>
    </PageLayout>
  );
}
