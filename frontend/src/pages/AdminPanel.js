import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import { alpha, useTheme } from '@mui/material/styles';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR } from '../lib/utils';
import { getUserFromStorage, isAdmin } from './UserProfile';
import * as adminService from '../services/adminService';
import { useConfirm } from '../hooks/useConfirm';
import {
  Users, Crown, TrendingUp, DollarSign, Activity, Settings, Shield,
  Bell, FileText, BarChart3, Zap, AlertTriangle, CheckCircle, XCircle,
  Search, Filter, Download, RefreshCw, Eye, Edit, Trash2, UserPlus,
  CreditCard, Calendar, Mail, Send, Database, Server, Globe, Lock, Clock
} from 'lucide-react';

// ===============================================================================
// ADMIN PANEL - Enhanced Super Admin Dashboard with Real Data
// ===============================================================================

export default function AdminPanel() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [ConfirmEl, confirmAction] = useConfirm();
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
    const ok = await confirmAction({
      title: 'Delete User',
      message: `Are you sure you want to delete user ${email}?`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (ok) {
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
  const handleDeleteSignal = async (id) => {
    const ok = await confirmAction({
      title: 'Delete Signal',
      message: 'Are you sure you want to delete this signal?',
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (ok) {
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
  const handleClearCache = async () => {
    const ok = await confirmAction({
      title: 'Clear Cache',
      message: 'This will clear all cached data. Continue?',
      confirmText: 'Clear Cache',
      variant: 'destructive',
    });
    if (ok) {
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
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card>
            <CardContent sx={{ p: 4, textAlign: 'center', maxWidth: 400, mx: 'auto' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 2,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock style={{ width: 40, height: 40, color: theme.palette.error.main }} />
              </Box>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                Access Denied
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                You don't have permission to access the admin panel.
                Only administrators can view this page.
              </Typography>
              <Button onClick={() => navigate('/')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {ConfirmEl}
      <PageHeader
        title="Admin Panel"
        subtitle="Complete control over Money Saarthi platform"
      />

      {/* Admin Badge */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 3,
          background: `linear-gradient(to right, ${alpha(theme.palette.error.main, 0.1)}, ${alpha('#f97316', 0.1)}, ${alpha('#eab308', 0.1)})`,
          border: 1,
          borderColor: alpha(theme.palette.error.main, 0.2),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${theme.palette.error.main}, #f97316)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Crown style={{ width: 24, height: 24, color: '#fff' }} />
          </Box>
          <Box>
            <Typography fontWeight={600} variant="subtitle1">
              Super Admin Access
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Logged in as {user?.email}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge variant="outline">
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'success.main',
                mr: 1,
                display: 'inline-block',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            System Online
          </Badge>
        </Box>
      </Box>

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

        {/* ===============================================================================
            DASHBOARD TAB - Revenue & Analytics
        =============================================================================== */}
        {activeTab === 'dashboard' && (
          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Period Selector & Refresh */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} />
                Refresh Data
              </Button>
              <Box
                sx={{
                  display: 'inline-flex',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 0.5,
                }}
              >
                {['24h', '7d', '30d', '90d'].map(period => (
                  <Box
                    key={period}
                    component="button"
                    onClick={() => setSelectedPeriod(period)}
                    sx={{
                      px: 2,
                      py: 0.75,
                      borderRadius: 1.5,
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: selectedPeriod === period ? 'primary.main' : 'transparent',
                      color: selectedPeriod === period ? 'primary.contrastText' : 'text.secondary',
                      '&:hover': {
                        color: selectedPeriod === period ? 'primary.contrastText' : 'text.primary',
                      },
                    }}
                  >
                    {period}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Revenue Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.success.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <DollarSign style={{ width: 20, height: 20, color: theme.palette.success.main }} />
                      </Box>
                      {stats.paidUsers > 0 && <Badge variant="success">Live</Badge>}
                    </Box>
                    <Typography variant="h5" fontWeight={700}>{stats.paidUsers || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Paid Users</Typography>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.info.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CreditCard style={{ width: 20, height: 20, color: theme.palette.info.main }} />
                      </Box>
                      <Badge variant="outline">Free Access</Badge>
                    </Box>
                    <Typography variant="h5" fontWeight={700}>{stats.freeAccessUsers || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Free Access Grants</Typography>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.secondary.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Crown style={{ width: 20, height: 20, color: theme.palette.secondary.main }} />
                      </Box>
                      <Badge variant="outline">Pending</Badge>
                    </Box>
                    <Typography variant="h5" fontWeight={700}>{stats.pendingPayments || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Pending Payments</Typography>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }}>
                <Card>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Users style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
                      </Box>
                    </Box>
                    <Typography variant="h5" fontWeight={700}>{(stats.totalUsers || 0).toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Users</Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Box>

            {/* Engagement Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              {[
                { label: 'Active Users', value: (stats.activeUsers || 0).toLocaleString(), icon: Activity, color: theme.palette.success.main },
                { label: 'Total Signals', value: (stats.totalSignals || 0).toLocaleString(), icon: Zap, color: theme.palette.warning.main },
                { label: 'Active Signals', value: (stats.activeSignals || 0).toLocaleString(), icon: TrendingUp, color: theme.palette.info.main },
                { label: 'Transactions', value: (stats.totalTransactions || 0).toLocaleString(), icon: CreditCard, color: theme.palette.secondary.main },
              ].map(stat => (
                <Card key={stat.label}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(stat.color, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <stat.icon style={{ width: 20, height: 20, color: stat.color }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{stat.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            {/* Activity Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <CardTitle>Recent Transactions</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('subscriptions')}>View All</Button>
                  </Box>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CreditCard style={{ width: 48, height: 48, margin: '0 auto 8px', opacity: 0.5, color: theme.palette.text.secondary }} />
                      <Typography color="text.secondary">No pending payments</Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1.5}>
                      {transactions.slice(0, 4).map(tx => (
                        <Box
                          key={tx._id || tx.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: alpha(theme.palette.warning.main, 0.2),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Clock style={{ width: 16, height: 16, color: theme.palette.warning.main }} />
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>{tx.email || tx.user}</Typography>
                              <Typography variant="caption" color="text.secondary">{tx.plan_name || tx.plan_id || tx.plan}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" fontWeight={500} sx={{ color: theme.palette.warning.main }}>
                              {formatINR(tx.amount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {tx.utr_number ? `UTR: ${tx.utr_number}` : tx.date}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {/* System Status */}
              <Card>
                <CardHeader>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <CardTitle>System Status</CardTitle>
                    <Badge variant="success">All Systems Operational</Badge>
                  </Box>
                </CardHeader>
                <CardContent>
                  <Stack spacing={2}>
                    {[
                      { label: 'API Server', status: 'Operational', icon: Server },
                      { label: 'Database', status: 'Operational', icon: Database },
                      { label: 'WebSocket', status: 'Operational', icon: Globe },
                      { label: 'Payment (UPI)', status: 'Operational', icon: CreditCard },
                    ].map(item => (
                      <Box
                        key={item.label}
                        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <item.icon style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
                          <Typography variant="body2">{item.label}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'success.main',
                            }}
                          />
                        </Box>
                      </Box>
                    ))}

                    <Divider />

                    <Stack spacing={1.5}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Pending Payments</Typography>
                        <Typography variant="body2" fontWeight={500}>{stats.pendingPayments || 0}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Blocked Users</Typography>
                        <Typography variant="body2" fontWeight={500}>{stats.blockedUsers || 0}</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  {[
                    { label: 'Broadcast Alert', icon: Bell, color: theme.palette.info.main, action: () => setActiveTab('content') },
                    { label: 'Generate Signal', icon: Zap, color: theme.palette.warning.main, action: () => setActiveTab('signals') },
                    { label: 'Export Data', icon: Download, color: theme.palette.success.main, action: handleExportData },
                    { label: 'Clear Cache', icon: RefreshCw, color: '#f97316', action: handleClearCache },
                  ].map(action => (
                    <Button
                      key={action.label}
                      variant="outline"
                      onClick={action.action}
                      sx={{
                        height: 'auto',
                        py: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: alpha(action.color, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <action.icon style={{ width: 20, height: 20, color: action.color }} />
                      </Box>
                      <Typography variant="body2">{action.label}</Typography>
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* ===============================================================================
            USERS TAB - User Management
        =============================================================================== */}
        {activeTab === 'users' && (
          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* User Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.info.main }}>{stats.totalUsers || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Users</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.success.main }}>{stats.activeUsers || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Users</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.secondary.main }}>{(stats.proMonthly || 0) + (stats.proYearly || 0)}</Typography>
                  <Typography variant="body2" color="text.secondary">Pro Users</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>+{stats.newUsersWeek || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">New This Week</Typography>
                </CardContent>
              </Card>
            </Box>

            {/* User Management Table */}
            <Card>
              <CardHeader>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 2 }}>
                  <CardTitle>User Management</CardTitle>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TextField
                      size="small"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      sx={{ width: 256 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search style={{ width: 16, height: 16, color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button size="sm" onClick={handleRefresh}>
                      <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} />
                      Refresh
                    </Button>
                  </Box>
                </Box>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Users style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.5, color: theme.palette.text.secondary }} />
                    <Typography variant="subtitle1" color="text.secondary">No users found</Typography>
                    <Typography variant="body2" color="text.secondary">Users will appear here when they sign in</Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>User</TableCell>
                          <TableCell>Plan</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Last Active</TableCell>
                          <TableCell align="right">Revenue</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredUsers.map(u => {
                          // Normalize user data (handle both backend and local formats)
                          const userPlan = u.is_paid ? 'pro' : (u.plan || 'free');
                          const userStatus = u.is_blocked ? 'blocked' : (u.status || 'active');
                          const lastActive = u.last_login || u.lastActive;
                          const userName = u.name || u.display_name || u.email?.split('@')[0] || 'Unknown';

                          return (
                          <TableRow key={u.id || u.user_id || u.email}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                {(u.picture || u.photo_url) ? (
                                  <Avatar
                                    src={u.picture || u.photo_url}
                                    alt=""
                                    sx={{ width: 40, height: 40 }}
                                  />
                                ) : (
                                  <Avatar
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                                      color: 'primary.main',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {(userName || '?').charAt(0).toUpperCase()}
                                  </Avatar>
                                )}
                                <Box>
                                  <Typography variant="body2" fontWeight={500}>{userName}</Typography>
                                  <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Badge variant={userPlan === 'pro' ? 'default' : 'secondary'}>
                                  {userPlan === 'pro' && <Crown style={{ width: 12, height: 12, marginRight: 4 }} />}
                                  {userPlan}
                                </Badge>
                                {u.billingCycle && (
                                  <Typography variant="caption" color="text.secondary">({u.billingCycle})</Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box
                                onClick={() => handleToggleUserStatus(u.email, userStatus)}
                                sx={{ cursor: 'pointer', display: 'inline-block' }}
                              >
                                <Badge
                                  variant={userStatus === 'active' ? 'success' : userStatus === 'blocked' ? 'destructive' : 'secondary'}
                                >
                                  {userStatus}
                                </Badge>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {lastActive ? adminService.formatTimeAgo(lastActive) : 'Never'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
                                {u.revenue > 0 ? formatINR(u.revenue) : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => alert(`User: ${userName}\nEmail: ${u.email}\nPlan: ${userPlan}\nJoined: ${u.joinedAt || u.created_at}`)}
                                >
                                  <Eye style={{ width: 16, height: 16 }} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  sx={{ color: 'error.main' }}
                                  onClick={() => handleDeleteUser(u.email)}
                                >
                                  <Trash2 style={{ width: 16, height: 16 }} />
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* ===============================================================================
            SUBSCRIPTIONS TAB - Revenue & Subscription Management
        =============================================================================== */}
        {activeTab === 'subscriptions' && (
          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Subscription Overview */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.text.secondary, 0.2),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Users style={{ width: 28, height: 28, color: theme.palette.text.secondary }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.freeUsers || 0}</Typography>
                      <Typography color="text.secondary">Free Users</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Card sx={{ borderColor: alpha(theme.palette.primary.main, 0.3) }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Crown style={{ width: 28, height: 28, color: theme.palette.primary.main }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.proMonthly || 0}</Typography>
                      <Typography color="text.secondary">Pro Monthly</Typography>
                      <Typography variant="body2" sx={{ color: 'primary.main' }}>{formatINR((stats.proMonthly || 0) * 899)}/mo</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Card sx={{ borderColor: alpha(theme.palette.warning.main, 0.3) }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.warning.main, 0.2),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Crown style={{ width: 28, height: 28, color: theme.palette.warning.main }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={700}>{stats.proYearly || 0}</Typography>
                      <Typography color="text.secondary">Pro Yearly</Typography>
                      <Typography variant="body2" sx={{ color: theme.palette.warning.main }}>{formatINR((stats.proYearly || 0) * 4999)}/yr</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <CardTitle>Payment History</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportData}>
                    <Download style={{ width: 16, height: 16, marginRight: 8 }} />
                    Export
                  </Button>
                </Box>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <CreditCard style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.5, color: theme.palette.text.secondary }} />
                    <Typography variant="subtitle1" color="text.secondary">No transactions yet</Typography>
                    <Typography variant="body2" color="text.secondary">Transactions will appear here when users subscribe</Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>User</TableCell>
                          <TableCell>Plan</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Payment ID</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactions.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{tx.user}</Typography>
                              <Typography variant="caption" color="text.secondary">{tx.email}</Typography>
                            </TableCell>
                            <TableCell>{tx.plan}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>{formatINR(tx.amount)}</Typography>
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.status === 'success' ? 'success' : 'destructive'}>
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{tx.paymentId}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{tx.date}</Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* ===============================================================================
            SIGNALS TAB - Signal Management
        =============================================================================== */}
        {activeTab === 'signals' && (
          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Signal Stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700}>{stats.totalSignals || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Signals</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.success.main }}>{stats.avgConfidence || 0}%</Typography>
                  <Typography variant="body2" color="text.secondary">Avg Confidence</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.info.main }}>{stats.activeSignals || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Signals</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.secondary.main }}>{stats.closedSignals || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Closed Signals</Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Active Signals */}
            <Card>
              <CardHeader>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <CardTitle>Signal Management</CardTitle>
                  <Button size="sm" onClick={handleRefresh}>
                    <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} />
                    Refresh
                  </Button>
                </Box>
              </CardHeader>
              <CardContent>
                {signals.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Zap style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.5, color: theme.palette.text.secondary }} />
                    <Typography variant="subtitle1" color="text.secondary">No signals generated yet</Typography>
                    <Typography variant="body2" color="text.secondary">Use the form below to create your first signal</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {signals.map(signal => (
                      <Box
                        key={signal.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Badge variant={signal.type === 'BUY' ? 'success' : 'destructive'}>
                            {signal.type}
                          </Badge>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>{signal.symbol}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {signal.createdAt ? adminService.formatTimeAgo(signal.createdAt) : signal.generated}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" fontWeight={500}>{signal.confidence}%</Typography>
                            <Typography variant="caption" color="text.secondary">Confidence</Typography>
                          </Box>
                          {signal.targetPrice && (
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={500}>&#8377;{signal.targetPrice}</Typography>
                              <Typography variant="caption" color="text.secondary">Target</Typography>
                            </Box>
                          )}
                          <Badge variant={signal.status === 'active' ? 'default' : 'secondary'}>
                            {signal.status}
                          </Badge>
                          {signal.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => handleCloseSignal(signal.id)}>
                              Close
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            sx={{ color: 'error.main' }}
                            onClick={() => handleDeleteSignal(signal.id)}
                          >
                            <Trash2 style={{ width: 16, height: 16 }} />
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Manual Signal Generator */}
            <Card>
              <CardHeader>
                <CardTitle>Generate New Signal</CardTitle>
              </CardHeader>
              <CardContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Symbol *</Typography>
                    <Input
                      placeholder="e.g., NIFTY 22500 CE"
                      value={signalForm.symbol}
                      onChange={e => setSignalForm(f => ({ ...f, symbol: e.target.value }))}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Type</Typography>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={signalForm.type}
                      onChange={e => setSignalForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <MenuItem value="BUY">BUY</MenuItem>
                      <MenuItem value="SELL">SELL</MenuItem>
                    </TextField>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Confidence (%)</Typography>
                    <Input
                      type="number"
                      placeholder="75"
                      value={signalForm.confidence}
                      onChange={e => setSignalForm(f => ({ ...f, confidence: parseInt(e.target.value) || 75 }))}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Target Price</Typography>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={signalForm.targetPrice}
                      onChange={e => setSignalForm(f => ({ ...f, targetPrice: e.target.value }))}
                    />
                  </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Rationale</Typography>
                  <TextField
                    multiline
                    rows={3}
                    fullWidth
                    size="small"
                    placeholder="Enter signal rationale..."
                    value={signalForm.rationale}
                    onChange={e => setSignalForm(f => ({ ...f, rationale: e.target.value }))}
                  />
                </Box>
                <Button sx={{ mt: 2 }} onClick={handleGenerateSignal}>
                  <Send style={{ width: 16, height: 16, marginRight: 8 }} />
                  Broadcast Signal
                </Button>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* ===============================================================================
            CONTENT TAB - Content Management
        =============================================================================== */}
        {activeTab === 'content' && (
          <Stack spacing={3} sx={{ mt: 3 }}>
            <Card>
              <CardHeader>
                <CardTitle>Content Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                  {[
                    { label: 'Announcements', desc: 'Manage platform announcements', icon: Bell, count: adminService.getAllAnnouncements().length },
                    { label: 'Active Signals', desc: 'Currently broadcasting', icon: Zap, count: signals.filter(s => s.status === 'active').length },
                    { label: 'Total Users', desc: 'Registered users', icon: Users, count: users.length },
                    { label: 'Pro Subscribers', desc: 'Paid members', icon: Crown, count: users.filter(u => u.plan === 'pro').length },
                    { label: 'Transactions', desc: 'Payment history', icon: CreditCard, count: transactions.length },
                    { label: 'System Config', desc: 'Platform settings', icon: Settings, count: '\u2192' },
                  ].map(item => (
                    <Box
                      key={item.label}
                      onClick={() => {
                        if (item.label === 'System Config') setActiveTab('settings');
                        else if (item.label === 'Active Signals') setActiveTab('signals');
                        else if (item.label.includes('Users') || item.label.includes('Subscribers')) setActiveTab('users');
                        else if (item.label === 'Transactions') setActiveTab('subscriptions');
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'background.paper',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <item.icon style={{ width: 24, height: 24, color: theme.palette.primary.main }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={500}>{item.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                      </Box>
                      <Badge variant="outline">{item.count}</Badge>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Broadcast Message */}
            <Card>
              <CardHeader>
                <CardTitle>Broadcast Message</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Title *</Typography>
                    <Input
                      placeholder="Announcement title..."
                      value={broadcastForm.title}
                      onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Message *</Typography>
                    <TextField
                      multiline
                      rows={5}
                      fullWidth
                      size="small"
                      placeholder="Write your message..."
                      value={broadcastForm.message}
                      onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Target Audience</Typography>
                      <TextField
                        select
                        size="small"
                        value={broadcastForm.audience}
                        onChange={e => setBroadcastForm(f => ({ ...f, audience: e.target.value }))}
                        sx={{ minWidth: 180 }}
                      >
                        <MenuItem value="all">All Users</MenuItem>
                        <MenuItem value="pro">Pro Users Only</MenuItem>
                        <MenuItem value="free">Free Users Only</MenuItem>
                      </TextField>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Priority</Typography>
                      <TextField
                        select
                        size="small"
                        value={broadcastForm.priority}
                        onChange={e => setBroadcastForm(f => ({ ...f, priority: e.target.value }))}
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                      </TextField>
                    </Box>
                  </Box>
                  <Box>
                    <Button onClick={handleBroadcast}>
                      <Send style={{ width: 16, height: 16, marginRight: 8 }} />
                      Send Broadcast
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Recent Announcements */}
            {adminService.getAllAnnouncements().length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Announcements</CardTitle>
                </CardHeader>
                <CardContent>
                  <Stack spacing={1.5}>
                    {adminService.getAllAnnouncements().slice(0, 5).map(ann => (
                      <Box
                        key={ann.id}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" fontWeight={500}>{ann.title}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Badge variant={ann.priority === 'urgent' ? 'destructive' : ann.priority === 'high' ? 'default' : 'secondary'}>
                              {ann.priority}
                            </Badge>
                            <Badge variant="outline">{ann.audience}</Badge>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">{ann.message}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {adminService.formatTimeAgo(ann.createdAt)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        )}

        {/* ===============================================================================
            SETTINGS TAB - System Settings & Danger Zone
        =============================================================================== */}
        {activeTab === 'settings' && (
          <Stack spacing={3} sx={{ mt: 3 }}>
            {/* Payment Configuration */}
            <Card sx={{ borderColor: alpha(theme.palette.primary.main, 0.2) }}>
              <CardHeader>
                <CardTitle>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CreditCard style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
                    Payment Settings
                  </Box>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Stack spacing={3}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    }}
                  >
                    <Typography variant="body2">
                      <strong>Tip:</strong> Configure your payment details here. Users will see these options when subscribing.
                    </Typography>
                  </Box>

                  {/* UPI Settings */}
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 3,
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.secondary.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ color: theme.palette.secondary.main }}>UPI</Typography>
                      </Box>
                      <Typography fontWeight={600}>UPI Payment Details</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>UPI ID</Typography>
                        <Input
                          placeholder="yourname@paytm or yourname@upi"
                          value={paymentConfig.upiId || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, upiId: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Merchant Name</Typography>
                        <Input
                          placeholder="Money Saarthi"
                          value={paymentConfig.merchantName || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, merchantName: e.target.value }))}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Phone Numbers */}
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 3,
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.success.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                        }}
                      >
                        &#128241;
                      </Box>
                      <Typography fontWeight={600}>Phone Numbers (for PhonePe, GPay, Paytm)</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>PhonePe Number</Typography>
                        <Input
                          placeholder="9999999999"
                          value={paymentConfig.phonepeNumber || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, phonepeNumber: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Google Pay Number</Typography>
                        <Input
                          placeholder="9999999999"
                          value={paymentConfig.gpayNumber || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, gpayNumber: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Paytm Number</Typography>
                        <Input
                          placeholder="9999999999"
                          value={paymentConfig.paytmNumber || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, paytmNumber: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>WhatsApp Support Number</Typography>
                        <Input
                          placeholder="919999999999 (with country code)"
                          value={paymentConfig.whatsappNumber || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, whatsappNumber: e.target.value }))}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Bank Details */}
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 3,
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.info.main, 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                        }}
                      >
                        &#127974;
                      </Box>
                      <Typography fontWeight={600}>Bank Account Details (for NEFT/IMPS)</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Account Holder Name</Typography>
                        <Input
                          placeholder="Account holder name"
                          value={paymentConfig.bankDetails?.accountName || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), accountName: e.target.value } }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Account Number</Typography>
                        <Input
                          placeholder="XXXXXXXXXXXX"
                          value={paymentConfig.bankDetails?.accountNumber || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), accountNumber: e.target.value } }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>IFSC Code</Typography>
                        <Input
                          placeholder="SBIN0XXXXXX"
                          value={paymentConfig.bankDetails?.ifscCode || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), ifscCode: e.target.value } }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Bank Name</Typography>
                        <Input
                          placeholder="State Bank of India"
                          value={paymentConfig.bankDetails?.bankName || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, bankDetails: { ...(c.bankDetails || {}), bankName: e.target.value } }))}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Razorpay (Optional) */}
                  <Box
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 3,
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          bgcolor: alpha('#06b6d4', 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                        }}
                      >
                        &#128179;
                      </Box>
                      <Typography fontWeight={600}>Razorpay (Optional - for Card/Net Banking)</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Razorpay API Key</Typography>
                        <Input
                          placeholder="rzp_live_XXXXXX"
                          value={paymentConfig.razorpayKey || ''}
                          onChange={e => setPaymentConfig(c => ({ ...c, razorpayKey: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Enable Razorpay</Typography>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={paymentConfig.razorpayEnabled ? 'yes' : 'no'}
                          onChange={e => setPaymentConfig(c => ({ ...c, razorpayEnabled: e.target.value === 'yes' }))}
                        >
                          <MenuItem value="no">No (Hide Razorpay option)</MenuItem>
                          <MenuItem value="yes">Yes (Show Razorpay option)</MenuItem>
                        </TextField>
                      </Box>
                    </Box>
                  </Box>

                  <Box>
                    <Button onClick={handleSavePaymentConfig}>
                      <CreditCard style={{ width: 16, height: 16, marginRight: 8 }} />
                      Save Payment Settings
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* System Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack spacing={3}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>API Rate Limit (per min)</Typography>
                      <Input
                        type="number"
                        value={systemConfig.apiRateLimit || 60}
                        onChange={e => setSystemConfig(c => ({ ...c, apiRateLimit: parseInt(e.target.value) }))}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Cache TTL (seconds)</Typography>
                      <Input
                        type="number"
                        value={systemConfig.cacheTTL || 300}
                        onChange={e => setSystemConfig(c => ({ ...c, cacheTTL: parseInt(e.target.value) }))}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Max Concurrent Users</Typography>
                      <Input
                        type="number"
                        value={systemConfig.maxConcurrentUsers || 1000}
                        onChange={e => setSystemConfig(c => ({ ...c, maxConcurrentUsers: parseInt(e.target.value) }))}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Maintenance Mode</Typography>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={systemConfig.maintenanceMode ? 'on' : 'off'}
                        onChange={e => setSystemConfig(c => ({ ...c, maintenanceMode: e.target.value === 'on' }))}
                      >
                        <MenuItem value="off">Off</MenuItem>
                        <MenuItem value="on">On</MenuItem>
                      </TextField>
                    </Box>
                  </Box>
                  <Box>
                    <Button onClick={handleSaveConfig}>Save Configuration</Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card sx={{ borderColor: alpha(theme.palette.error.main, 0.2) }}>
              <CardHeader>
                <CardTitle>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <AlertTriangle style={{ width: 20, height: 20 }} />
                    Danger Zone
                  </Box>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Stack spacing={2}>
                  {[
                    { label: 'Clear All Cache', desc: 'Remove all cached data', action: 'Clear Cache', onClick: handleClearCache },
                    { label: 'Export All Data', desc: 'Download backup JSON', action: 'Export', onClick: handleExportData },
                    { label: 'Reset All Signals', desc: 'Close all active signals', action: 'Reset Signals', onClick: async () => {
                      const ok = await confirmAction({
                        title: 'Reset All Signals',
                        message: 'Close all active signals? This cannot be undone.',
                        confirmText: 'Reset Signals',
                        variant: 'destructive',
                      });
                      if (ok) {
                        signals.forEach(s => s.status === 'active' && adminService.updateSignal(s.id, { status: 'closed' }));
                        loadData();
                        alert('All signals closed!');
                      }
                    }},
                    { label: 'Clear All Data', desc: 'Remove all stored data (dangerous!)', action: 'Clear All', onClick: async () => {
                      const ok = await confirmAction({
                        title: 'Clear ALL Data',
                        message: 'This will permanently delete ALL stored data. This action cannot be undone. Are you absolutely sure?',
                        confirmText: 'Delete Everything',
                        variant: 'destructive',
                      });
                      if (ok) {
                        localStorage.clear();
                        navigate('/login');
                      }
                    }},
                  ].map(item => (
                    <Box
                      key={item.label}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderRadius: 2,
                        border: 1,
                        borderColor: alpha(theme.palette.error.main, 0.2),
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{item.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                      </Box>
                      <Button
                        variant="outline"
                        sx={{
                          color: 'error.main',
                          borderColor: alpha(theme.palette.error.main, 0.3),
                          '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
                        }}
                        onClick={item.onClick}
                      >
                        {item.action}
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Section>
    </PageLayout>
  );
}
