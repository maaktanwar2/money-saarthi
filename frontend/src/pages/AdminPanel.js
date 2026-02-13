import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR, cn } from '../lib/utils';
import { getUserFromStorage, isAdmin } from './UserProfile';
import * as adminService from '../services/adminService';
import {
  Users, Crown, TrendingUp, DollarSign, Activity, Settings, Shield,
  Bell, FileText, BarChart3, Zap, AlertTriangle, CheckCircle, XCircle,
  Search, Filter, Download, RefreshCw, Eye, Edit, Trash2, UserPlus,
  CreditCard, Calendar, Mail, Send, Database, Server, Globe, Lock, Clock
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL - Enhanced Super Admin Dashboard with Real Data
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [refreshKey, setRefreshKey] = useState(0);

  // Real data states
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({});
  const [systemConfig, setSystemConfig] = useState({});
  const [paymentConfig, setPaymentConfig] = useState({});

  // Signal form state
  const [signalForm, setSignalForm] = useState({
    symbol: '',
    type: 'BUY',
    confidence: 75,
    targetPrice: '',
    rationale: ''
  });

  // Broadcast form state
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    audience: 'all',
    priority: 'normal'
  });

  // Load data function
  const loadData = useCallback(async () => {
    // First ensure current admin user is in the list
    const currentUser = getUserFromStorage();
    if (currentUser) {
      adminService.saveUserToList(currentUser);
    }
    
    // Fetch users from backend API
    let fetchedUsers = [];
    try {
      fetchedUsers = await adminService.fetchUsersFromBackend();
      setUsers(fetchedUsers);
    } catch (e) {
      console.error('Error loading users:', e);
      fetchedUsers = adminService.getAllUsers();
      setUsers(fetchedUsers);
    }
    
    // Fetch stats from backend
    const [userStats, revenueStats, pendingPayments, sysConfig, pmtConfig] = await Promise.all([
      adminService.getUserStats().catch(() => ({})),
      adminService.getRevenueStats().catch(() => ({})),
      adminService.getAllTransactions().catch(() => []),
      adminService.getSystemConfig().catch(() => ({})),
      adminService.getPaymentConfig().catch(() => ({})),
    ]);
    const signalStats = adminService.getSignalStats();
    
    setStats({
      ...userStats,
      ...signalStats,
      totalUsers: userStats.totalUsers || fetchedUsers.length,
      activeUsers: userStats.activeUsers || fetchedUsers.filter(u => !u.is_blocked).length,
      paidUsers: userStats.proUsers || revenueStats.paidUsers || 0,
      freeAccessUsers: userStats.freeAccessUsers || revenueStats.freeAccessUsers || 0,
      blockedUsers: userStats.blockedUsers || 0,
      pendingPayments: pendingPayments.length || 0,
    });

    setTransactions(pendingPayments);
    setSignals(adminService.getAllSignals());
    setSystemConfig(sysConfig);
    setPaymentConfig(pmtConfig);
  }, []);

  useEffect(() => {
    const storedUser = getUserFromStorage();
    if (storedUser && isAdmin(storedUser.email)) {
      setUser(storedUser);
      setIsAuthorized(true);
      loadData();
    } else {
      setIsAuthorized(false);
    }
  }, [loadData, refreshKey]);

  // Refresh data
  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  // Delete user handler
  const handleDeleteUser = async (email) => {
    if (window.confirm(`Are you sure you want to delete user ${email}?`)) {
      await adminService.deleteUser(email);
      loadData();
    }
  };

  // Toggle user status (block/unblock)
  const handleToggleUserStatus = async (email, currentStatus) => {
    const isBlocked = currentStatus === 'active' ? true : false;
    await adminService.updateUser(email, { is_blocked: isBlocked });
    loadData();
  };

  // Generate signal handler
  const handleGenerateSignal = () => {
    if (!signalForm.symbol) {
      alert('Please enter a symbol');
      return;
    }
    adminService.addSignal(signalForm);
    setSignalForm({ symbol: '', type: 'BUY', confidence: 75, targetPrice: '', rationale: '' });
    loadData();
    alert('Signal broadcasted successfully!');
  };

  // Close signal handler
  const handleCloseSignal = (id) => {
    adminService.updateSignal(id, { status: 'closed' });
    loadData();
  };

  // Delete signal handler
  const handleDeleteSignal = (id) => {
    if (window.confirm('Delete this signal?')) {
      adminService.deleteSignal(id);
      loadData();
    }
  };

  // Broadcast handler
  const handleBroadcast = () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      alert('Please fill in title and message');
      return;
    }
    adminService.addAnnouncement(broadcastForm);
    setBroadcastForm({ title: '', message: '', audience: 'all', priority: 'normal' });
    alert('Broadcast sent successfully!');
  };

  // Save system config
  const handleSaveConfig = async () => {
    await adminService.updateSystemConfig(systemConfig);
    alert('Configuration saved!');
  };

  // Save payment config
  const handleSavePaymentConfig = async () => {
    await adminService.updatePaymentConfig(paymentConfig);
    alert('Payment settings saved successfully!');
  };

  // Export data
  const handleExportData = () => {
    const data = adminService.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneysaarthi_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Clear cache
  const handleClearCache = () => {
    if (window.confirm('Clear all cache?')) {
      adminService.clearAllCache();
      alert('Cache cleared!');
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Not authorized - show access denied
  if (!isAuthorized) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="glass-card p-8 text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access the admin panel.
              Only administrators can view this page.
            </p>
            <Button onClick={() => navigate('/')}>
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
        subtitle="Complete control over Money Saarthi platform"
      />

      {/* Admin Badge */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-red-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-semibold text-lg">Super Admin Access</div>
            <div className="text-sm text-muted-foreground">Logged in as {user?.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            System Online
          </Badge>
        </div>
      </div>

      <Section>
        <Tabs
          tabs={[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'users', label: 'Users' },
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'signals', label: 'Signals' },
            { id: 'content', label: 'Content' },
            { id: 'settings', label: 'Settings' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* ═══════════════════════════════════════════════════════════════════════════════
            DASHBOARD TAB - Revenue & Analytics
        ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 mt-6">
            {/* Period Selector & Refresh */}
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
              <div className="inline-flex bg-card border border-border rounded-lg p-1">
                {['24h', '7d', '30d', '90d'].map(period => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                      selectedPeriod === period ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  {stats.paidUsers > 0 && <Badge variant="success" className="text-xs">Live</Badge>}
                </div>
                <div className="text-2xl font-bold">{stats.paidUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Paid Users</div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                  </div>
                  <Badge variant="outline" className="text-xs">Free Access</Badge>
                </div>
                <div className="text-2xl font-bold">{stats.freeAccessUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Free Access Grants</div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-purple-500" />
                  </div>
                  <Badge variant="outline" className="text-xs">Pending</Badge>
                </div>
                <div className="text-2xl font-bold">{stats.pendingPayments || 0}</div>
                <div className="text-sm text-muted-foreground">Pending Payments</div>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="text-2xl font-bold">{(stats.totalUsers || 0).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </motion.div>
            </div>

            {/* Engagement Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Active Users', value: (stats.activeUsers || 0).toLocaleString(), icon: Activity, color: 'text-green-500', bg: 'bg-green-500/20' },
                { label: 'Total Signals', value: (stats.totalSignals || 0).toLocaleString(), icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
                { label: 'Active Signals', value: (stats.activeSignals || 0).toLocaleString(), icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/20' },
                { label: 'Transactions', value: (stats.totalTransactions || 0).toLocaleString(), icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-500/20' },
              ].map(stat => (
                <Card key={stat.label} className="glass-card p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                      <stat.icon className={cn('w-5 h-5', stat.color)} />
                    </div>
                    <div>
                      <div className="text-lg font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Activity Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Transactions */}
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Recent Transactions</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('subscriptions')}>View All</Button>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No pending payments</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.slice(0, 4).map(tx => (
                        <div key={tx._id || tx.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-500/20">
                              <Clock className="w-4 h-4 text-yellow-500" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{tx.email || tx.user}</div>
                              <div className="text-xs text-muted-foreground">{tx.plan_name || tx.plan_id || tx.plan}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-yellow-500">
                              {formatINR(tx.amount)}
                            </div>
                            <div className="text-xs text-muted-foreground">{tx.utr_number ? `UTR: ${tx.utr_number}` : tx.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Status */}
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">System Status</CardTitle>
                  <Badge variant="success">All Systems Operational</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'API Server', status: 'Operational', icon: Server },
                      { label: 'Database', status: 'Operational', icon: Database },
                      { label: 'WebSocket', status: 'Operational', icon: Globe },
                      { label: 'Payment (UPI)', status: 'Operational', icon: CreditCard },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pending Payments</span>
                        <span className="font-medium">{stats.pendingPayments || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Blocked Users</span>
                        <span className="font-medium">{stats.blockedUsers || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Broadcast Alert', icon: Bell, color: 'bg-blue-500/20 text-blue-500', action: () => setActiveTab('content') },
                    { label: 'Generate Signal', icon: Zap, color: 'bg-yellow-500/20 text-yellow-500', action: () => setActiveTab('signals') },
                    { label: 'Export Data', icon: Download, color: 'bg-green-500/20 text-green-500', action: handleExportData },
                    { label: 'Clear Cache', icon: RefreshCw, color: 'bg-orange-500/20 text-orange-500', action: handleClearCache },
                  ].map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={action.action}
                    >
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', action.color)}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════
            USERS TAB - User Management
        ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-6 mt-6">
            {/* User Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-blue-500">{stats.totalUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-green-500">{stats.activeUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-purple-500">{(stats.proMonthly || 0) + (stats.proYearly || 0)}</div>
                <div className="text-sm text-muted-foreground">Pro Users</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-primary">+{stats.newUsersWeek || 0}</div>
                <div className="text-sm text-muted-foreground">New This Week</div>
              </Card>
            </div>

            {/* User Management Table */}
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      className="pl-9 w-64"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={handleRefresh}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No users found</p>
                    <p className="text-sm">Users will appear here when they sign in</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Plan</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Last Active</th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground">Revenue</th>
                          <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => {
                          // Normalize user data (handle both backend and local formats)
                          const userPlan = u.is_paid ? 'pro' : (u.plan || 'free');
                          const userStatus = u.is_blocked ? 'blocked' : (u.status || 'active');
                          const lastActive = u.last_login || u.lastActive;
                          const userName = u.name || u.display_name || u.email?.split('@')[0] || 'Unknown';
                          
                          return (
                          <tr key={u.id || u.user_id || u.email} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {(u.picture || u.photo_url) ? (
                                  <img src={u.picture || u.photo_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-medium">
                                    {(userName || '?').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">{userName}</div>
                                  <div className="text-sm text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={userPlan === 'pro' ? 'default' : 'secondary'}>
                                  {userPlan === 'pro' && <Crown className="w-3 h-3 mr-1" />}
                                  {userPlan}
                                </Badge>
                                {u.billingCycle && (
                                  <span className="text-xs text-muted-foreground">({u.billingCycle})</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge 
                                variant={userStatus === 'active' ? 'success' : userStatus === 'blocked' ? 'destructive' : 'secondary'}
                                className="cursor-pointer"
                                onClick={() => handleToggleUserStatus(u.email, userStatus)}
                              >
                                {userStatus}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {lastActive ? adminService.formatTimeAgo(lastActive) : 'Never'}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {u.revenue > 0 ? formatINR(u.revenue) : '-'}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  onClick={() => alert(`User: ${userName}\nEmail: ${u.email}\nPlan: ${userPlan}\nJoined: ${u.joinedAt || u.created_at}`)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 text-red-500"
                                  onClick={() => handleDeleteUser(u.email)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════
            SUBSCRIPTIONS TAB - Revenue & Subscription Management
        ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6 mt-6">
            {/* Subscription Overview */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="glass-card p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-500/20 flex items-center justify-center">
                    <Users className="w-7 h-7 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.freeUsers || 0}</div>
                    <div className="text-muted-foreground">Free Users</div>
                  </div>
                </div>
              </Card>
              <Card className="glass-card p-6 border-primary/30">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.proMonthly || 0}</div>
                    <div className="text-muted-foreground">Pro Monthly</div>
                    <div className="text-sm text-primary">{formatINR((stats.proMonthly || 0) * 899)}/mo</div>
                  </div>
                </div>
              </Card>
              <Card className="glass-card p-6 border-yellow-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-yellow-500" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.proYearly || 0}</div>
                    <div className="text-muted-foreground">Pro Yearly</div>
                    <div className="text-sm text-yellow-500">{formatINR((stats.proYearly || 0) * 4999)}/yr</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Payment History */}
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Payment History</CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No transactions yet</p>
                    <p className="text-sm">Transactions will appear here when users subscribe</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Plan</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Amount</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Payment ID</th>
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(tx => (
                          <tr key={tx.id} className="border-b border-border/50">
                            <td className="p-3">
                              <div className="font-medium">{tx.user}</div>
                              <div className="text-sm text-muted-foreground">{tx.email}</div>
                            </td>
                            <td className="p-3">{tx.plan}</td>
                            <td className="p-3 font-medium">{formatINR(tx.amount)}</td>
                            <td className="p-3">
                              <Badge variant={tx.status === 'success' ? 'success' : 'error'}>
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground font-mono">{tx.paymentId}</td>
                            <td className="p-3 text-sm">{tx.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════
            SIGNALS TAB - Signal Management
        ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'signals' && (
          <div className="space-y-6 mt-6">
            {/* Signal Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold">{stats.totalSignals || 0}</div>
                <div className="text-sm text-muted-foreground">Total Signals</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-green-500">{stats.avgConfidence || 0}%</div>
                <div className="text-sm text-muted-foreground">Avg Confidence</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-blue-500">{stats.activeSignals || 0}</div>
                <div className="text-sm text-muted-foreground">Active Signals</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-2xl font-bold text-purple-500">{stats.closedSignals || 0}</div>
                <div className="text-sm text-muted-foreground">Closed Signals</div>
              </Card>
            </div>

            {/* Active Signals */}
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Signal Management</CardTitle>
                <Button size="sm" onClick={handleRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {signals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No signals generated yet</p>
                    <p className="text-sm">Use the form below to create your first signal</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {signals.map(signal => (
                      <div key={signal.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                        <div className="flex items-center gap-4">
                          <Badge variant={signal.type === 'BUY' ? 'success' : 'error'} className="w-14 justify-center">
                            {signal.type}
                          </Badge>
                          <div>
                            <div className="font-medium">{signal.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {signal.createdAt ? adminService.formatTimeAgo(signal.createdAt) : signal.generated}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="font-medium">{signal.confidence}%</div>
                            <div className="text-xs text-muted-foreground">Confidence</div>
                          </div>
                          {signal.targetPrice && (
                            <div className="text-center">
                              <div className="font-medium">₹{signal.targetPrice}</div>
                              <div className="text-xs text-muted-foreground">Target</div>
                            </div>
                          )}
                          <Badge variant={signal.status === 'active' ? 'default' : 'secondary'}>
                            {signal.status}
                          </Badge>
                          {signal.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => handleCloseSignal(signal.id)}>
                              Close
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteSignal(signal.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual Signal Generator */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Generate New Signal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Symbol *</label>
                    <Input 
                      placeholder="e.g., NIFTY 22500 CE" 
                      value={signalForm.symbol}
                      onChange={e => setSignalForm(f => ({ ...f, symbol: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Type</label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={signalForm.type}
                      onChange={e => setSignalForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option>BUY</option>
                      <option>SELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Confidence (%)</label>
                    <Input 
                      type="number" 
                      placeholder="75"
                      value={signalForm.confidence}
                      onChange={e => setSignalForm(f => ({ ...f, confidence: parseInt(e.target.value) || 75 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Target Price</label>
                    <Input 
                      type="number" 
                      placeholder="0.00"
                      value={signalForm.targetPrice}
                      onChange={e => setSignalForm(f => ({ ...f, targetPrice: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm text-muted-foreground block mb-2">Rationale</label>
                  <textarea 
                    className="input w-full h-20" 
                    placeholder="Enter signal rationale..."
                    value={signalForm.rationale}
                    onChange={e => setSignalForm(f => ({ ...f, rationale: e.target.value }))}
                  />
                </div>
                <Button className="mt-4" onClick={handleGenerateSignal}>
                  <Send className="w-4 h-4 mr-2" />
                  Broadcast Signal
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════
            CONTENT TAB - Content Management
        ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'content' && (
          <div className="space-y-6 mt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Content Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Announcements', desc: 'Manage platform announcements', icon: Bell, count: adminService.getAllAnnouncements().length },
                    { label: 'Active Signals', desc: 'Currently broadcasting', icon: Zap, count: signals.filter(s => s.status === 'active').length },
                    { label: 'Total Users', desc: 'Registered users', icon: Users, count: users.length },
                    { label: 'Pro Subscribers', desc: 'Paid members', icon: Crown, count: users.filter(u => u.plan === 'pro').length },
                    { label: 'Transactions', desc: 'Payment history', icon: CreditCard, count: transactions.length },
                    { label: 'System Config', desc: 'Platform settings', icon: Settings, count: '→' },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="flex items-center gap-4 p-4 rounded-lg bg-background/50 hover:bg-card cursor-pointer transition-colors"
                      onClick={() => {
                        if (item.label === 'System Config') setActiveTab('settings');
                        else if (item.label === 'Active Signals') setActiveTab('signals');
                        else if (item.label.includes('Users') || item.label.includes('Subscribers')) setActiveTab('users');
                        else if (item.label === 'Transactions') setActiveTab('subscriptions');
                      }}
                    >
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <item.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.desc}</div>
                      </div>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Broadcast Message */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Broadcast Message</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Title *</label>
                    <Input 
                      placeholder="Announcement title..."
                      value={broadcastForm.title}
                      onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Message *</label>
                    <textarea 
                      className="input w-full h-32" 
                      placeholder="Write your message..."
                      value={broadcastForm.message}
                      onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Target Audience</label>
                      <select 
                        className="input"
                        value={broadcastForm.audience}
                        onChange={e => setBroadcastForm(f => ({ ...f, audience: e.target.value }))}
                      >
                        <option value="all">All Users</option>
                        <option value="pro">Pro Users Only</option>
                        <option value="free">Free Users Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Priority</label>
                      <select 
                        className="input"
                        value={broadcastForm.priority}
                        onChange={e => setBroadcastForm(f => ({ ...f, priority: e.target.value }))}
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <Button onClick={handleBroadcast}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Broadcast
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Announcements */}
            {adminService.getAllAnnouncements().length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Recent Announcements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {adminService.getAllAnnouncements().slice(0, 5).map(ann => (
                      <div key={ann.id} className="p-4 rounded-lg bg-background/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{ann.title}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={ann.priority === 'urgent' ? 'error' : ann.priority === 'high' ? 'default' : 'secondary'}>
                              {ann.priority}
                            </Badge>
                            <Badge variant="outline">{ann.audience}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{ann.message}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {adminService.formatTimeAgo(ann.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════════
            SETTINGS TAB - System Settings & Danger Zone
        ═══════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6 mt-6">
            {/* Payment Configuration */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                  <strong>💡 Tip:</strong> Configure your payment details here. Users will see these options when subscribing.
                </div>
                
                {/* UPI Settings */}
                <div className="border border-border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <span className="text-purple-500 font-bold text-sm">UPI</span>
                    </span>
                    UPI Payment Details
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">UPI ID</label>
                      <Input 
                        placeholder="yourname@paytm or yourname@upi"
                        value={paymentConfig.upiId || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, upiId: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Merchant Name</label>
                      <Input 
                        placeholder="Money Saarthi"
                        value={paymentConfig.merchantName || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, merchantName: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Phone Numbers */}
                <div className="border border-border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      📱
                    </span>
                    Phone Numbers (for PhonePe, GPay, Paytm)
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">PhonePe Number</label>
                      <Input 
                        placeholder="9999999999"
                        value={paymentConfig.phonepeNumber || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, phonepeNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Google Pay Number</label>
                      <Input 
                        placeholder="9999999999"
                        value={paymentConfig.gpayNumber || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, gpayNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Paytm Number</label>
                      <Input 
                        placeholder="9999999999"
                        value={paymentConfig.paytmNumber || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, paytmNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">WhatsApp Support Number</label>
                      <Input 
                        placeholder="919999999999 (with country code)"
                        value={paymentConfig.whatsappNumber || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, whatsappNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="border border-border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      🏦
                    </span>
                    Bank Account Details (for NEFT/IMPS)
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Account Holder Name</label>
                      <Input 
                        placeholder="Account holder name"
                        value={paymentConfig.bankDetails?.accountName || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), accountName: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Account Number</label>
                      <Input 
                        placeholder="XXXXXXXXXXXX"
                        value={paymentConfig.bankDetails?.accountNumber || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), accountNumber: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">IFSC Code</label>
                      <Input 
                        placeholder="SBIN0XXXXXX"
                        value={paymentConfig.bankDetails?.ifscCode || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), ifscCode: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Bank Name</label>
                      <Input 
                        placeholder="State Bank of India"
                        value={paymentConfig.bankDetails?.bankName || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), bankName: e.target.value } }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Razorpay (Optional) */}
                <div className="border border-border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      💳
                    </span>
                    Razorpay (Optional - for Card/Net Banking)
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Razorpay API Key</label>
                      <Input 
                        placeholder="rzp_live_XXXXXX"
                        value={paymentConfig.razorpayKey || ''}
                        onChange={e => setPaymentConfig(c => ({ ...c, razorpayKey: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Enable Razorpay</label>
                      <select 
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={paymentConfig.razorpayEnabled ? 'yes' : 'no'}
                        onChange={e => setPaymentConfig(c => ({ ...c, razorpayEnabled: e.target.value === 'yes' }))}
                      >
                        <option value="no">No (Hide Razorpay option)</option>
                        <option value="yes">Yes (Show Razorpay option)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSavePaymentConfig} className="bg-primary">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Save Payment Settings
                </Button>
              </CardContent>
            </Card>

            {/* System Configuration */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">API Rate Limit (per min)</label>
                    <Input 
                      type="number" 
                      value={systemConfig.apiRateLimit || 60}
                      onChange={e => setSystemConfig(c => ({ ...c, apiRateLimit: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Cache TTL (seconds)</label>
                    <Input 
                      type="number" 
                      value={systemConfig.cacheTTL || 300}
                      onChange={e => setSystemConfig(c => ({ ...c, cacheTTL: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Max Concurrent Users</label>
                    <Input 
                      type="number" 
                      value={systemConfig.maxConcurrentUsers || 1000}
                      onChange={e => setSystemConfig(c => ({ ...c, maxConcurrentUsers: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Maintenance Mode</label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={systemConfig.maintenanceMode ? 'on' : 'off'}
                      onChange={e => setSystemConfig(c => ({ ...c, maintenanceMode: e.target.value === 'on' }))}
                    >
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </select>
                  </div>
                </div>
                <Button onClick={handleSaveConfig}>Save Configuration</Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="glass-card border-red-500/20">
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Clear All Cache', desc: 'Remove all cached data', action: 'Clear Cache', onClick: handleClearCache },
                  { label: 'Export All Data', desc: 'Download backup JSON', action: 'Export', onClick: handleExportData },
                  { label: 'Reset All Signals', desc: 'Close all active signals', action: 'Reset Signals', onClick: () => {
                    if (window.confirm('Close all active signals?')) {
                      signals.forEach(s => s.status === 'active' && adminService.updateSignal(s.id, { status: 'closed' }));
                      loadData();
                      alert('All signals closed!');
                    }
                  }},
                  { label: 'Clear All Data', desc: 'Remove all stored data (dangerous!)', action: 'Clear All', onClick: () => {
                    if (window.confirm('⚠️ This will delete ALL data. Are you sure?')) {
                      if (window.confirm('This action cannot be undone. Type "DELETE" in the next prompt to confirm.')) {
                        const confirm = window.prompt('Type DELETE to confirm:');
                        if (confirm === 'DELETE') {
                          localStorage.clear();
                          window.location.reload();
                        }
                      }
                    }
                  }},
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">{item.desc}</div>
                    </div>
                    <Button variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={item.onClick}>
                      {item.action}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </Section>
    </PageLayout>
  );
}
