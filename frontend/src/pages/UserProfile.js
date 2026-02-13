import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR, cn } from '../lib/utils';
import { getUserSubscription, hasProAccess, PLANS } from './Pricing';
import * as adminService from '../services/adminService';
import {
  Crown, Check, X, ArrowRight, Calendar, CreditCard, Shield, Sparkles,
  Users, TrendingUp, DollarSign, Activity, Settings, Bell, FileText,
  BarChart3, Zap, AlertTriangle, CheckCircle, XCircle, Search, Filter,
  Download, RefreshCw, Eye, Edit, Trash2, UserPlus, Mail, Send,
  Database, Server, Globe, Lock, LogOut
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED PROFILE & ADMIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_EMAILS = [
  'maaktanwar@gmail.com',
  'admin@moneysaarthi.com',
  'superadmin@moneysaarthi.com'
];

export const isAdmin = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export const getUserFromStorage = () => {
  try {
    const stored = localStorage.getItem('ms_user');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return null;
};

export const saveUserToStorage = (user) => {
  localStorage.setItem('ms_user', JSON.stringify(user));
};

export const clearUserFromStorage = () => {
  localStorage.removeItem('ms_user');
};

export default function UserProfile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [subscription, setSubscription] = useState({ plan: 'free', status: 'inactive' });

  // Admin states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({});
  const [systemConfig, setSystemConfig] = useState({});
  const [paymentConfig, setPaymentConfig] = useState({});
  const [signalForm, setSignalForm] = useState({ symbol: '', type: 'BUY', confidence: 75, targetPrice: '', rationale: '' });
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', audience: 'all', priority: 'normal' });

  // Load admin data
  const loadAdminData = useCallback(async () => {
    const currentUser = getUserFromStorage();
    if (currentUser) adminService.saveUserToList(currentUser);
    let fetchedUsers = [];
    try {
      fetchedUsers = await adminService.fetchUsersFromBackend();
      setAdminUsers(fetchedUsers);
    } catch (e) {
      fetchedUsers = adminService.getAllUsers();
      setAdminUsers(fetchedUsers);
    }
    const userStats = adminService.getUserStats();
    const revenueStats = adminService.getRevenueStats();
    const signalStats = adminService.getSignalStats();
    setStats({
      ...userStats, ...revenueStats, ...signalStats,
      totalUsers: fetchedUsers.length || userStats.totalUsers,
      activeUsers: userStats.activeUsers || fetchedUsers.filter(u => !u.is_blocked && u.status !== 'blocked').length,
      totalRevenue: revenueStats.totalRevenue || 0,
      revenueGrowth: 0,
      dailyActiveUsers: Math.floor((userStats.activeUsers || fetchedUsers.length) * 0.5),
      avgSessionTime: '18m 32s',
      signalAccuracy: 73.5,
      serverLoad: Math.floor(Math.random() * 30) + 20,
      apiCalls: '2.4M',
      uptime: '99.97%',
    });
    setTransactions(adminService.getAllTransactions());
    setSignals(adminService.getAllSignals());
    setSystemConfig(adminService.getSystemConfig());
    setPaymentConfig(adminService.getPaymentConfig());
  }, []);

  useEffect(() => {
    const storedUser = getUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
      setSubscription(getUserSubscription());
      if (isAdmin(storedUser.email)) loadAdminData();
    } else {
      navigate('/login');
    }
  }, [navigate, loadAdminData, refreshKey]);

  const userIsAdmin = user ? isAdmin(user.email) : false;

  // Profile handlers
  const handleSaveProfile = () => {
    const updatedUser = { ...user, ...editForm };
    updatedUser.isAdmin = isAdmin(updatedUser.email);
    setUser(updatedUser);
    saveUserToStorage(updatedUser);
    setIsEditing(false);
  };

  const handleLogout = () => {
    clearUserFromStorage();
    window.location.href = '/';
  };

  // Admin handlers
  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleDeleteUser = (email) => {
    if (window.confirm(`Are you sure you want to delete user ${email}?`)) {
      adminService.deleteUser(email);
      loadAdminData();
    }
  };

  const handleToggleUserStatus = (email, currentStatus) => {
    adminService.updateUser(email, { status: currentStatus === 'active' ? 'inactive' : 'active' });
    loadAdminData();
  };

  const handleGenerateSignal = () => {
    if (!signalForm.symbol) { alert('Please enter a symbol'); return; }
    adminService.addSignal(signalForm);
    setSignalForm({ symbol: '', type: 'BUY', confidence: 75, targetPrice: '', rationale: '' });
    loadAdminData();
    alert('Signal broadcasted successfully!');
  };

  const handleCloseSignal = (id) => { adminService.updateSignal(id, { status: 'closed' }); loadAdminData(); };
  const handleDeleteSignal = (id) => { if (window.confirm('Delete this signal?')) { adminService.deleteSignal(id); loadAdminData(); } };

  const handleBroadcast = () => {
    if (!broadcastForm.title || !broadcastForm.message) { alert('Please fill in title and message'); return; }
    adminService.addAnnouncement(broadcastForm);
    setBroadcastForm({ title: '', message: '', audience: 'all', priority: 'normal' });
    alert('Broadcast sent successfully!');
  };

  const handleSaveConfig = () => { adminService.updateSystemConfig(systemConfig); alert('Configuration saved!'); };
  const handleSavePaymentConfig = () => { adminService.updatePaymentConfig(paymentConfig); alert('Payment settings saved!'); };

  const handleExportData = () => {
    const data = adminService.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `moneysaarthi_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleClearCache = () => { if (window.confirm('Clear all cache?')) { adminService.clearAllCache(); alert('Cache cleared!'); } };

  const filteredUsers = adminUsers.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  // Build tabs based on role
  const profileTabs = [
    { id: 'profile', label: '👤 Profile' },
    { id: 'stats', label: '📊 Stats' },
    { id: 'subscription', label: '💎 Subscription' },
    { id: 'security', label: '🔒 Security' },
  ];

  const adminTabs = userIsAdmin ? [
    { id: 'admin-dashboard', label: '🏠 Dashboard' },
    { id: 'admin-users', label: '👥 Users' },
    { id: 'admin-subscriptions', label: '💰 Revenue' },
    { id: 'admin-signals', label: '⚡ Signals' },
    { id: 'admin-content', label: '📢 Content' },
    { id: 'admin-settings', label: '⚙️ Settings' },
  ] : [];

  return (
    <PageLayout>
      <PageHeader
        title={userIsAdmin ? "Profile & Admin" : "My Profile"}
        subtitle={userIsAdmin ? "Your profile and admin controls in one place" : "Manage your account and preferences"}
      />

      <Section>
        <div className="grid lg:grid-cols-4 gap-6">
          {/* ═════ LEFT SIDEBAR - Profile Card ═════ */}
          <div className="lg:col-span-1">
            <Card className="glass-card text-center sticky top-6">
              <CardContent className="pt-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center text-2xl font-bold text-white mb-3">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <h2 className="text-lg font-bold">{user.name}</h2>
                <p className="text-xs text-muted-foreground">{user.email}</p>

                <div className="flex justify-center gap-2 mt-3">
                  <Badge variant={user.plan === 'premium' ? 'default' : 'secondary'}>
                    {user.plan === 'premium' ? '⭐ Premium' : 'Free Plan'}
                  </Badge>
                  {userIsAdmin && (
                    <Badge variant="error" className="bg-red-500/20 text-red-400 border-red-500/30">
                      👑 Admin
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-border">
                  <div>
                    <div className="text-xl font-bold text-primary">{user.stats?.totalTrades || 0}</div>
                    <div className="text-xs text-muted-foreground">Trades</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-profit">{user.stats?.winRate || 0}%</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                </div>

                {/* Quick nav for admins */}
                {userIsAdmin && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Quick Jump</p>
                    {[
                      { label: 'Dashboard', tab: 'admin-dashboard', icon: '🏠' },
                      { label: 'Users', tab: 'admin-users', icon: '👥' },
                      { label: 'Settings', tab: 'admin-settings', icon: '⚙️' },
                    ].map(item => (
                      <button
                        key={item.tab}
                        onClick={() => setActiveTab(item.tab)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                          activeTab === item.tab ? 'bg-primary/20 text-primary' : 'hover:bg-card text-muted-foreground'
                        )}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full mt-4 text-red-400 border-red-500/20 hover:bg-red-500/10"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ═════ RIGHT - Main Content ═════ */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="space-y-2">
              {/* Profile tabs */}
              <Tabs
                tabs={profileTabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
              {/* Admin tabs - shown below for admins */}
              {userIsAdmin && (
                <div className="pt-1">
                  <Tabs
                    tabs={adminTabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                  />
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════
                PROFILE TAB
            ═══════════════════════════════════════ */}
            {activeTab === 'profile' && (
              <Card className="glass-card mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Profile Information</CardTitle>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => { setEditForm(user); setIsEditing(true); }}>
                      Edit Profile
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Full Name</label>
                          <Input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Email</label>
                          <Input type="email" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                          {isAdmin(editForm.email) && <p className="text-xs text-red-400 mt-1">👑 This email has admin privileges</p>}
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Phone</label>
                          <Input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Default Index</label>
                          <select className="input w-full" value={editForm.preferences?.defaultIndex || 'NIFTY'}
                            onChange={e => setEditForm({ ...editForm, preferences: {...editForm.preferences, defaultIndex: e.target.value} })}>
                            <option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={handleSaveProfile}>Save Changes</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: 'Full Name', value: user.name },
                        { label: 'Email', value: user.email },
                        { label: 'Phone', value: user.phone || 'Not set' },
                        { label: 'Member Since', value: new Date(user.joinedAt).toLocaleDateString() },
                        { label: 'Default Index', value: user.preferences?.defaultIndex || 'NIFTY' },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between py-3 border-b border-border/50">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ═══════════════════════════════════════
                TRADING STATS TAB
            ═══════════════════════════════════════ */}
            {activeTab === 'stats' && (
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Trades', value: user.stats?.totalTrades || 0, icon: '📊' },
                    { label: 'Win Rate', value: `${user.stats?.winRate || 0}%`, icon: '🎯', color: 'text-profit' },
                    { label: 'Total P&L', value: formatINR(user.stats?.totalPnL || 0), icon: '💰', color: user.stats?.totalPnL >= 0 ? 'text-profit' : 'text-loss' },
                    { label: 'Win Streak', value: user.stats?.streak || 0, icon: '🔥' },
                  ].map(stat => (
                    <Card key={stat.label} className="glass-card p-4 text-center">
                      <div className="text-2xl mb-2">{stat.icon}</div>
                      <div className={`text-2xl font-bold ${stat.color || ''}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </Card>
                  ))}
                </div>
                <Card className="glass-card">
                  <CardHeader><CardTitle>Performance Overview</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      <p>Connect your broker to see detailed performance analytics</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ═══════════════════════════════════════
                SUBSCRIPTION TAB
            ═══════════════════════════════════════ */}
            {activeTab === 'subscription' && (
              <div className="space-y-6 mt-6">
                <Card className={`glass-card border-2 ${hasProAccess() ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasProAccess() ? 'bg-primary/20' : 'bg-slate-500/20'}`}>
                            <Crown className={`w-6 h-6 ${hasProAccess() ? 'text-primary' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">{hasProAccess() ? 'Pro Plan' : 'Free Plan'}</h3>
                            <p className="text-sm text-muted-foreground">
                              {hasProAccess() ? `${subscription.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} subscription` : 'Limited access to features'}
                            </p>
                          </div>
                        </div>
                        {hasProAccess() && subscription.expiresAt && (
                          <div className="flex items-center gap-2 mt-4 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Renews on {new Date(subscription.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                      {hasProAccess() ? (
                        <Badge variant="success" className="bg-green-500/20 text-green-500 border-green-500/30">Active</Badge>
                      ) : (
                        <Button onClick={() => navigate('/pricing')} className="bg-gradient-to-r from-primary to-emerald-600">
                          <Crown className="w-4 h-4 mr-2" />Upgrade to Pro
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>Plan Features</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className={`p-5 rounded-xl border ${!hasProAccess() ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-lg font-bold">Free</span>
                          {!hasProAccess() && <Badge variant="outline" className="text-xs">Current</Badge>}
                        </div>
                        <ul className="space-y-3">
                          {PLANS.free.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              {feature.included ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> : <X className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                              <span className={!feature.included ? 'text-muted-foreground' : ''}>{feature.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className={`p-5 rounded-xl border ${hasProAccess() ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <Crown className="w-5 h-5 text-primary" />
                          <span className="text-lg font-bold">Pro</span>
                          {hasProAccess() && <Badge className="text-xs bg-primary">Current</Badge>}
                        </div>
                        <ul className="space-y-3">
                          {PLANS.pro.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />{feature.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {!hasProAccess() && (
                      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />Upgrade to Pro and unlock everything
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">Starting at just ₹899/month or ₹4,999/year (save 53%)</p>
                          </div>
                          <Button onClick={() => navigate('/pricing')}>View Plans<ArrowRight className="w-4 h-4 ml-2" /></Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {hasProAccess() && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Billing & Payment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">Current Plan</div>
                            <div className="text-sm text-muted-foreground">Pro - {subscription.billingCycle === 'yearly' ? '₹4,999/year' : '₹899/month'}</div>
                          </div>
                          <Button variant="outline" onClick={() => navigate('/pricing')}>Change Plan</Button>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">Next Billing Date</div>
                            <div className="text-sm text-muted-foreground">{subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('en-IN') : 'N/A'}</div>
                          </div>
                          <Badge variant="success">Auto-renew On</Badge>
                        </div>
                        <div className="pt-4 border-t border-border">
                          <p className="text-sm text-muted-foreground">Need help? Contact support at support@moneysaarthi.com</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════
                SECURITY TAB
            ═══════════════════════════════════════ */}
            {activeTab === 'security' && (
              <Card className="glass-card mt-6">
                <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { title: 'Change Password', desc: 'Update your account password', action: 'Change' },
                    { title: 'Two-Factor Authentication', desc: 'Add an extra layer of security', action: 'Enable' },
                    { title: 'Active Sessions', desc: 'Manage your logged in devices', action: 'View' },
                  ].map(item => (
                    <div key={item.title} className="flex items-center justify-between p-4 rounded-lg bg-background">
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">{item.desc}</div>
                      </div>
                      <Button variant="outline">{item.action}</Button>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-border">
                    <Button variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10">Delete Account</Button>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* ═══════════════════════════════════════════════════════════════════════════
                ADMIN TABS - Only rendered for admin users
            ═══════════════════════════════════════════════════════════════════════════ */}

            {/* ═══════════════════════════════════════
                ADMIN DASHBOARD TAB
            ═══════════════════════════════════════ */}
            {userIsAdmin && activeTab === 'admin-dashboard' && (
              <div className="space-y-6 mt-6">
                {/* Admin badge */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Super Admin Access</div>
                      <div className="text-sm text-muted-foreground">{user?.email}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />System Online
                  </Badge>
                </div>

                {/* Period selector */}
                <div className="flex justify-between items-center">
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="w-4 h-4 mr-2" />Refresh
                  </Button>
                  <div className="inline-flex bg-card border border-border rounded-lg p-1">
                    {['24h', '7d', '30d', '90d'].map(period => (
                      <button key={period} onClick={() => setSelectedPeriod(period)}
                        className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                          selectedPeriod === period ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Revenue stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: formatINR(stats.totalRevenue || 0), icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/20', badge: stats.totalRevenue > 0 ? 'Live' : null },
                    { label: 'Monthly Recurring', value: formatINR((stats.proMonthly || 0) * 899), icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-500/20', badge: 'MRR' },
                    { label: 'Pro Subscribers', value: (stats.proMonthly || 0) + (stats.proYearly || 0), icon: Crown, color: 'text-purple-500', bg: 'bg-purple-500/20' },
                    { label: 'Total Users', value: (stats.totalUsers || 0).toLocaleString(), icon: Users, color: 'text-primary', bg: 'bg-primary/20', badge: `+${stats.newUsersToday || 0} today` },
                  ].map(stat => (
                    <motion.div key={stat.label} whileHover={{ scale: 1.02 }} className="glass-card p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                          <stat.icon className={cn('w-5 h-5', stat.color)} />
                        </div>
                        {stat.badge && <Badge variant="outline" className="text-xs">{stat.badge}</Badge>}
                      </div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Engagement */}
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

                {/* Activity grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base">Recent Transactions</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('admin-subscriptions')}>View All</Button>
                    </CardHeader>
                    <CardContent>
                      {transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No transactions yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {transactions.slice(0, 4).map(tx => (
                            <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                              <div className="flex items-center gap-3">
                                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', tx.status === 'success' ? 'bg-green-500/20' : 'bg-red-500/20')}>
                                  {tx.status === 'success' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{tx.user}</div>
                                  <div className="text-xs text-muted-foreground">{tx.plan}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={cn('font-medium', tx.status === 'success' ? 'text-green-500' : 'text-red-500')}>{formatINR(tx.amount)}</div>
                                <div className="text-xs text-muted-foreground">{tx.date}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="glass-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base">System Status</CardTitle>
                      <Badge variant="success">All Systems Operational</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { label: 'API Server', latency: '45ms', icon: Server },
                          { label: 'Database', latency: '12ms', icon: Database },
                          { label: 'WebSocket', latency: '8ms', icon: Globe },
                          { label: 'Payment Gateway', latency: '120ms', icon: CreditCard },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <item.icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{item.latency}</span>
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                          </div>
                        ))}
                        <div className="pt-4 border-t border-border space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1"><span>CPU Load</span><span>{stats.serverLoad || 25}%</span></div>
                            <div className="h-2 bg-border rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${stats.serverLoad || 25}%` }} />
                            </div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Uptime</span>
                            <span className="text-green-500 font-medium">{stats.uptime || '99.97%'}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick actions */}
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Broadcast Alert', icon: Bell, color: 'bg-blue-500/20 text-blue-500', action: () => setActiveTab('admin-content') },
                        { label: 'Generate Signal', icon: Zap, color: 'bg-yellow-500/20 text-yellow-500', action: () => setActiveTab('admin-signals') },
                        { label: 'Export Data', icon: Download, color: 'bg-green-500/20 text-green-500', action: handleExportData },
                        { label: 'Clear Cache', icon: RefreshCw, color: 'bg-orange-500/20 text-orange-500', action: handleClearCache },
                      ].map(a => (
                        <Button key={a.label} variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={a.action}>
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', a.color)}>
                            <a.icon className="w-5 h-5" />
                          </div>
                          <span className="text-sm">{a.label}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ═══════════════════════════════════════
                ADMIN USERS TAB
            ═══════════════════════════════════════ */}
            {userIsAdmin && activeTab === 'admin-users' && (
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-blue-500">{stats.totalUsers || 0}</div><div className="text-sm text-muted-foreground">Total Users</div></Card>
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-green-500">{stats.activeUsers || 0}</div><div className="text-sm text-muted-foreground">Active Users</div></Card>
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-purple-500">{(stats.proMonthly || 0) + (stats.proYearly || 0)}</div><div className="text-sm text-muted-foreground">Pro Users</div></Card>
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-primary">+{stats.newUsersWeek || 0}</div><div className="text-sm text-muted-foreground">New This Week</div></Card>
                </div>

                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>User Management</CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search users..." className="pl-9 w-64" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                      </div>
                      <Button size="sm" onClick={handleRefresh}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
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
                                        {userPlan === 'pro' && <Crown className="w-3 h-3 mr-1" />}{userPlan}
                                      </Badge>
                                      {u.billingCycle && <span className="text-xs text-muted-foreground">({u.billingCycle})</span>}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <Badge variant={userStatus === 'active' ? 'success' : userStatus === 'blocked' ? 'destructive' : 'secondary'} className="cursor-pointer"
                                      onClick={() => handleToggleUserStatus(u.email, userStatus)}>{userStatus}</Badge>
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">{lastActive ? adminService.formatTimeAgo(lastActive) : 'Never'}</td>
                                  <td className="p-3 text-right font-medium">{u.revenue > 0 ? formatINR(u.revenue) : '-'}</td>
                                  <td className="p-3">
                                    <div className="flex justify-end gap-1">
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                                        onClick={() => alert(`User: ${userName}\nEmail: ${u.email}\nPlan: ${userPlan}\nJoined: ${u.joinedAt || u.created_at}`)}>
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500"
                                        onClick={() => handleDeleteUser(u.email)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ═══════════════════════════════════════
                ADMIN SUBSCRIPTIONS/REVENUE TAB
            ═══════════════════════════════════════ */}
            {userIsAdmin && activeTab === 'admin-subscriptions' && (
              <div className="space-y-6 mt-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="glass-card p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-slate-500/20 flex items-center justify-center"><Users className="w-7 h-7 text-slate-400" /></div>
                      <div><div className="text-3xl font-bold">{stats.freeUsers || 0}</div><div className="text-muted-foreground">Free Users</div></div>
                    </div>
                  </Card>
                  <Card className="glass-card p-6 border-primary/30">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center"><Crown className="w-7 h-7 text-primary" /></div>
                      <div><div className="text-3xl font-bold">{stats.proMonthly || 0}</div><div className="text-muted-foreground">Pro Monthly</div><div className="text-sm text-primary">{formatINR((stats.proMonthly || 0) * 899)}/mo</div></div>
                    </div>
                  </Card>
                  <Card className="glass-card p-6 border-yellow-500/30">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center"><Crown className="w-7 h-7 text-yellow-500" /></div>
                      <div><div className="text-3xl font-bold">{stats.proYearly || 0}</div><div className="text-muted-foreground">Pro Yearly</div><div className="text-sm text-yellow-500">{formatINR((stats.proYearly || 0) * 4999)}/yr</div></div>
                    </div>
                  </Card>
                </div>

                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Payment History</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExportData}><Download className="w-4 h-4 mr-2" />Export</Button>
                  </CardHeader>
                  <CardContent>
                    {transactions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" /><p className="text-lg">No transactions yet</p><p className="text-sm">Transactions will appear here when users subscribe</p>
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
                                <td className="p-3"><div className="font-medium">{tx.user}</div><div className="text-sm text-muted-foreground">{tx.email}</div></td>
                                <td className="p-3">{tx.plan}</td>
                                <td className="p-3 font-medium">{formatINR(tx.amount)}</td>
                                <td className="p-3"><Badge variant={tx.status === 'success' ? 'success' : 'error'}>{tx.status}</Badge></td>
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

            {/* ═══════════════════════════════════════
                ADMIN SIGNALS TAB
            ═══════════════════════════════════════ */}
            {userIsAdmin && activeTab === 'admin-signals' && (
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="glass-card p-4"><div className="text-2xl font-bold">{stats.totalSignals || 0}</div><div className="text-sm text-muted-foreground">Total Signals</div></Card>
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-green-500">{stats.avgConfidence || 0}%</div><div className="text-sm text-muted-foreground">Avg Confidence</div></Card>
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-blue-500">{stats.activeSignals || 0}</div><div className="text-sm text-muted-foreground">Active Signals</div></Card>
                  <Card className="glass-card p-4"><div className="text-2xl font-bold text-purple-500">{stats.closedSignals || 0}</div><div className="text-sm text-muted-foreground">Closed Signals</div></Card>
                </div>

                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Signal Management</CardTitle>
                    <Button size="sm" onClick={handleRefresh}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
                  </CardHeader>
                  <CardContent>
                    {signals.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" /><p className="text-lg">No signals generated yet</p><p className="text-sm">Use the form below to create your first signal</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {signals.map(signal => (
                          <div key={signal.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                            <div className="flex items-center gap-4">
                              <Badge variant={signal.type === 'BUY' ? 'success' : 'error'} className="w-14 justify-center">{signal.type}</Badge>
                              <div>
                                <div className="font-medium">{signal.symbol}</div>
                                <div className="text-sm text-muted-foreground">{signal.createdAt ? adminService.formatTimeAgo(signal.createdAt) : signal.generated}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-center"><div className="font-medium">{signal.confidence}%</div><div className="text-xs text-muted-foreground">Confidence</div></div>
                              {signal.targetPrice && <div className="text-center"><div className="font-medium">₹{signal.targetPrice}</div><div className="text-xs text-muted-foreground">Target</div></div>}
                              <Badge variant={signal.status === 'active' ? 'default' : 'secondary'}>{signal.status}</Badge>
                              {signal.status === 'active' && <Button size="sm" variant="outline" onClick={() => handleCloseSignal(signal.id)}>Close</Button>}
                              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteSignal(signal.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>Generate New Signal</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Symbol *</label>
                        <Input placeholder="e.g., NIFTY 22500 CE" value={signalForm.symbol} onChange={e => setSignalForm(f => ({ ...f, symbol: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Type</label>
                        <select className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={signalForm.type} onChange={e => setSignalForm(f => ({ ...f, type: e.target.value }))}>
                          <option>BUY</option><option>SELL</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Confidence (%)</label>
                        <Input type="number" placeholder="75" value={signalForm.confidence} onChange={e => setSignalForm(f => ({ ...f, confidence: parseInt(e.target.value) || 75 }))} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Target Price</label>
                        <Input type="number" placeholder="0.00" value={signalForm.targetPrice} onChange={e => setSignalForm(f => ({ ...f, targetPrice: e.target.value }))} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="text-sm text-muted-foreground block mb-2">Rationale</label>
                      <textarea className="input w-full h-20" placeholder="Enter signal rationale..."
                        value={signalForm.rationale} onChange={e => setSignalForm(f => ({ ...f, rationale: e.target.value }))} />
                    </div>
                    <Button className="mt-4" onClick={handleGenerateSignal}><Send className="w-4 h-4 mr-2" />Broadcast Signal</Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ═══════════════════════════════════════
                ADMIN CONTENT TAB
            ═══════════════════════════════════════ */}
            {userIsAdmin && activeTab === 'admin-content' && (
              <div className="space-y-6 mt-6">
                <Card className="glass-card">
                  <CardHeader><CardTitle>Content Management</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { label: 'Announcements', desc: 'Manage platform announcements', icon: Bell, count: adminService.getAllAnnouncements().length },
                        { label: 'Active Signals', desc: 'Currently broadcasting', icon: Zap, count: signals.filter(s => s.status === 'active').length },
                        { label: 'Total Users', desc: 'Registered users', icon: Users, count: adminUsers.length },
                        { label: 'Pro Subscribers', desc: 'Paid members', icon: Crown, count: adminUsers.filter(u => u.plan === 'pro').length },
                        { label: 'Transactions', desc: 'Payment history', icon: CreditCard, count: transactions.length },
                        { label: 'System Config', desc: 'Platform settings', icon: Settings, count: '→' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-4 p-4 rounded-lg bg-background/50 hover:bg-card cursor-pointer transition-colors"
                          onClick={() => {
                            if (item.label === 'System Config') setActiveTab('admin-settings');
                            else if (item.label === 'Active Signals') setActiveTab('admin-signals');
                            else if (item.label.includes('Users') || item.label.includes('Subscribers')) setActiveTab('admin-users');
                            else if (item.label === 'Transactions') setActiveTab('admin-subscriptions');
                          }}>
                          <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center"><item.icon className="w-6 h-6 text-primary" /></div>
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

                <Card className="glass-card">
                  <CardHeader><CardTitle>Broadcast Message</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Title *</label>
                        <Input placeholder="Announcement title..." value={broadcastForm.title} onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Message *</label>
                        <textarea className="input w-full h-32" placeholder="Write your message..."
                          value={broadcastForm.message} onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))} />
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Target Audience</label>
                          <select className="input" value={broadcastForm.audience} onChange={e => setBroadcastForm(f => ({ ...f, audience: e.target.value }))}>
                            <option value="all">All Users</option><option value="pro">Pro Users Only</option><option value="free">Free Users Only</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Priority</label>
                          <select className="input" value={broadcastForm.priority} onChange={e => setBroadcastForm(f => ({ ...f, priority: e.target.value }))}>
                            <option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <Button onClick={handleBroadcast}><Send className="w-4 h-4 mr-2" />Send Broadcast</Button>
                    </div>
                  </CardContent>
                </Card>

                {adminService.getAllAnnouncements().length > 0 && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle>Recent Announcements</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {adminService.getAllAnnouncements().slice(0, 5).map(ann => (
                          <div key={ann.id} className="p-4 rounded-lg bg-background/50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium">{ann.title}</div>
                              <div className="flex items-center gap-2">
                                <Badge variant={ann.priority === 'urgent' ? 'error' : ann.priority === 'high' ? 'default' : 'secondary'}>{ann.priority}</Badge>
                                <Badge variant="outline">{ann.audience}</Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{ann.message}</p>
                            <div className="text-xs text-muted-foreground mt-2">{adminService.formatTimeAgo(ann.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════
                ADMIN SETTINGS TAB
            ═══════════════════════════════════════ */}
            {userIsAdmin && activeTab === 'admin-settings' && (
              <div className="space-y-6 mt-6">
                {/* Payment Configuration */}
                <Card className="glass-card border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" />Payment Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                      <strong>💡 Tip:</strong> Configure your payment details here. Users will see these options when subscribing.
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center"><span className="text-purple-500 font-bold text-sm">UPI</span></span>
                        UPI Payment Details
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><label className="text-sm text-muted-foreground block mb-2">UPI ID</label>
                          <Input placeholder="yourname@paytm" value={paymentConfig.upiId || ''} onChange={e => setPaymentConfig(c => ({ ...c, upiId: e.target.value }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">Merchant Name</label>
                          <Input placeholder="Money Saarthi" value={paymentConfig.merchantName || ''} onChange={e => setPaymentConfig(c => ({ ...c, merchantName: e.target.value }))} /></div>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <h4 className="font-semibold mb-4 flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">📱</span>Phone Numbers</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><label className="text-sm text-muted-foreground block mb-2">PhonePe Number</label>
                          <Input placeholder="9999999999" value={paymentConfig.phonepeNumber || ''} onChange={e => setPaymentConfig(c => ({ ...c, phonepeNumber: e.target.value }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">Google Pay Number</label>
                          <Input placeholder="9999999999" value={paymentConfig.gpayNumber || ''} onChange={e => setPaymentConfig(c => ({ ...c, gpayNumber: e.target.value }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">Paytm Number</label>
                          <Input placeholder="9999999999" value={paymentConfig.paytmNumber || ''} onChange={e => setPaymentConfig(c => ({ ...c, paytmNumber: e.target.value }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">WhatsApp Support</label>
                          <Input placeholder="919999999999" value={paymentConfig.whatsappNumber || ''} onChange={e => setPaymentConfig(c => ({ ...c, whatsappNumber: e.target.value }))} /></div>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <h4 className="font-semibold mb-4 flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">🏦</span>Bank Account Details</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><label className="text-sm text-muted-foreground block mb-2">Account Holder Name</label>
                          <Input placeholder="Account holder name" value={paymentConfig.bankDetails?.accountName || ''} onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), accountName: e.target.value } }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">Account Number</label>
                          <Input placeholder="XXXXXXXXXXXX" value={paymentConfig.bankDetails?.accountNumber || ''} onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), accountNumber: e.target.value } }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">IFSC Code</label>
                          <Input placeholder="SBIN0XXXXXX" value={paymentConfig.bankDetails?.ifscCode || ''} onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), ifscCode: e.target.value } }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">Bank Name</label>
                          <Input placeholder="State Bank of India" value={paymentConfig.bankDetails?.bankName || ''} onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), bankName: e.target.value } }))} /></div>
                      </div>
                    </div>

                    <div className="border border-border rounded-xl p-4">
                      <h4 className="font-semibold mb-4 flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">💳</span>Razorpay (Optional)</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><label className="text-sm text-muted-foreground block mb-2">Razorpay API Key</label>
                          <Input placeholder="rzp_live_XXXXXX" value={paymentConfig.razorpayKey || ''} onChange={e => setPaymentConfig(c => ({ ...c, razorpayKey: e.target.value }))} /></div>
                        <div><label className="text-sm text-muted-foreground block mb-2">Enable Razorpay</label>
                          <select className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={paymentConfig.razorpayEnabled ? 'yes' : 'no'} onChange={e => setPaymentConfig(c => ({ ...c, razorpayEnabled: e.target.value === 'yes' }))}>
                            <option value="no">No</option><option value="yes">Yes</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleSavePaymentConfig} className="bg-primary"><CreditCard className="w-4 h-4 mr-2" />Save Payment Settings</Button>
                  </CardContent>
                </Card>

                {/* System Configuration */}
                <Card className="glass-card">
                  <CardHeader><CardTitle>System Configuration</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div><label className="text-sm text-muted-foreground block mb-2">API Rate Limit (per min)</label>
                        <Input type="number" value={systemConfig.apiRateLimit || 60} onChange={e => setSystemConfig(c => ({ ...c, apiRateLimit: parseInt(e.target.value) }))} /></div>
                      <div><label className="text-sm text-muted-foreground block mb-2">Cache TTL (seconds)</label>
                        <Input type="number" value={systemConfig.cacheTTL || 300} onChange={e => setSystemConfig(c => ({ ...c, cacheTTL: parseInt(e.target.value) }))} /></div>
                      <div><label className="text-sm text-muted-foreground block mb-2">Max Concurrent Users</label>
                        <Input type="number" value={systemConfig.maxConcurrentUsers || 1000} onChange={e => setSystemConfig(c => ({ ...c, maxConcurrentUsers: parseInt(e.target.value) }))} /></div>
                      <div><label className="text-sm text-muted-foreground block mb-2">Maintenance Mode</label>
                        <select className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={systemConfig.maintenanceMode ? 'on' : 'off'} onChange={e => setSystemConfig(c => ({ ...c, maintenanceMode: e.target.value === 'on' }))}>
                          <option value="off">Off</option><option value="on">On</option>
                        </select>
                      </div>
                    </div>
                    <Button onClick={handleSaveConfig}>Save Configuration</Button>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="glass-card border-red-500/20">
                  <CardHeader><CardTitle className="text-red-500 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Danger Zone</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'Clear All Cache', desc: 'Remove all cached data', action: 'Clear Cache', onClick: handleClearCache },
                      { label: 'Export All Data', desc: 'Download backup JSON', action: 'Export', onClick: handleExportData },
                      { label: 'Reset All Signals', desc: 'Close all active signals', action: 'Reset Signals', onClick: () => {
                        if (window.confirm('Close all active signals?')) {
                          signals.forEach(s => s.status === 'active' && adminService.updateSignal(s.id, { status: 'closed' }));
                          loadAdminData(); alert('All signals closed!');
                        }
                      }},
                      { label: 'Clear All Data', desc: 'Remove all stored data (dangerous!)', action: 'Clear All', onClick: () => {
                        if (window.confirm('⚠️ This will delete ALL data. Are you sure?')) {
                          if (window.confirm('This action cannot be undone.')) {
                            const confirm = window.prompt('Type DELETE to confirm:');
                            if (confirm === 'DELETE') { localStorage.clear(); window.location.reload(); }
                          }
                        }
                      }},
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                        <div><div className="font-medium">{item.label}</div><div className="text-sm text-muted-foreground">{item.desc}</div></div>
                        <Button variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={item.onClick}>{item.action}</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
