import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

// Admin emails - users with these emails get super rights
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
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    // Load user from localStorage or set demo user
    const storedUser = getUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
    } else {
      // Demo user for testing
      const demoUser = {
        id: '1',
        name: 'Demo User',
        email: 'demo@moneysaarthi.com',
        phone: '+91 98765 43210',
        avatar: null,
        plan: 'free',
        joinedAt: '2024-01-15',
        isAdmin: false,
        preferences: {
          defaultIndex: 'NIFTY',
          notifications: true,
          darkMode: true
        },
        stats: {
          totalTrades: 156,
          winRate: 62.5,
          totalPnL: 45000,
          streak: 5
        }
      };
      setUser(demoUser);
      saveUserToStorage(demoUser);
    }
  }, []);

  const handleLogin = (email) => {
    const newUser = {
      ...user,
      email,
      isAdmin: isAdmin(email),
      name: isAdmin(email) ? 'Admin User' : user?.name || 'User'
    };
    setUser(newUser);
    saveUserToStorage(newUser);
  };

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

  if (!user) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  const userIsAdmin = isAdmin(user.email);

  return (
    <PageLayout>
      <PageHeader
        title="My Profile"
        subtitle="Manage your account and preferences"
      />

      <Section>
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card className="glass-card text-center">
              <CardContent className="pt-6">
                {/* Avatar */}
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center text-3xl font-bold text-white mb-4">
                  {user.name?.charAt(0) || 'U'}
                </div>
                
                {/* Name & Email */}
                <h2 className="text-xl font-bold">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                
                {/* Badges */}
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

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-border">
                  <div>
                    <div className="text-2xl font-bold text-primary">{user.stats?.totalTrades || 0}</div>
                    <div className="text-xs text-muted-foreground">Trades</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-profit">{user.stats?.winRate || 0}%</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                </div>

                {/* Admin Panel Link */}
                {userIsAdmin && (
                  <Button 
                    className="w-full mt-4 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    onClick={() => window.location.href = '/admin'}
                  >
                    👑 Admin Panel
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  className="w-full mt-3"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs
              tabs={[
                { id: 'profile', label: 'Profile' },
                { id: 'stats', label: 'Trading Stats' },
                { id: 'subscription', label: 'Subscription' },
                { id: 'security', label: 'Security' },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <Card className="glass-card mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Profile Information</CardTitle>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditForm(user);
                      setIsEditing(true);
                    }}>
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
                          <Input 
                            value={editForm.name || ''} 
                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Email</label>
                          <Input 
                            type="email"
                            value={editForm.email || ''} 
                            onChange={e => setEditForm({...editForm, email: e.target.value})}
                          />
                          {isAdmin(editForm.email) && (
                            <p className="text-xs text-red-400 mt-1">👑 This email has admin privileges</p>
                          )}
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Phone</label>
                          <Input 
                            value={editForm.phone || ''} 
                            onChange={e => setEditForm({...editForm, phone: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Default Index</label>
                          <select 
                            className="input w-full"
                            value={editForm.preferences?.defaultIndex || 'NIFTY'}
                            onChange={e => setEditForm({
                              ...editForm, 
                              preferences: {...editForm.preferences, defaultIndex: e.target.value}
                            })}
                          >
                            <option>NIFTY</option>
                            <option>BANKNIFTY</option>
                            <option>FINNIFTY</option>
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

            {/* Trading Stats Tab */}
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
                  <CardHeader>
                    <CardTitle>Performance Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      <p>Connect your broker to see detailed performance analytics</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <Card className="glass-card mt-6">
                <CardHeader>
                  <CardTitle>Subscription Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Current Plan */}
                    <div className="p-6 rounded-xl border-2 border-primary bg-primary/5">
                      <Badge className="mb-4">Current Plan</Badge>
                      <h3 className="text-2xl font-bold mb-2">
                        {user.plan === 'premium' ? 'Premium' : 'Free'}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {user.plan === 'premium' 
                          ? 'Full access to all features and tools' 
                          : 'Basic access with limited features'}
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <span className="text-profit">✓</span> Dashboard & Market Data
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-profit">✓</span> Basic Scanners
                        </li>
                        <li className="flex items-center gap-2">
                          <span className={user.plan === 'premium' ? 'text-profit' : 'text-muted-foreground'}>
                            {user.plan === 'premium' ? '✓' : '✗'}
                          </span> 
                          AI Trade Signals
                        </li>
                        <li className="flex items-center gap-2">
                          <span className={user.plan === 'premium' ? 'text-profit' : 'text-muted-foreground'}>
                            {user.plan === 'premium' ? '✓' : '✗'}
                          </span> 
                          Options Analytics
                        </li>
                      </ul>
                    </div>

                    {/* Upgrade */}
                    {user.plan !== 'premium' && (
                      <div className="p-6 rounded-xl border border-border">
                        <Badge variant="secondary" className="mb-4">Upgrade</Badge>
                        <h3 className="text-2xl font-bold mb-2">Premium</h3>
                        <p className="text-muted-foreground mb-4">
                          Unlock all features and maximize your trading potential
                        </p>
                        <div className="text-3xl font-bold mb-4">
                          ₹999<span className="text-lg text-muted-foreground">/month</span>
                        </div>
                        <Button className="w-full">Upgrade Now</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <Card className="glass-card mt-6">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                    <div>
                      <div className="font-medium">Change Password</div>
                      <div className="text-sm text-muted-foreground">Update your account password</div>
                    </div>
                    <Button variant="outline">Change</Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                    <div>
                      <div className="font-medium">Two-Factor Authentication</div>
                      <div className="text-sm text-muted-foreground">Add an extra layer of security</div>
                    </div>
                    <Button variant="outline">Enable</Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                    <div>
                      <div className="font-medium">Active Sessions</div>
                      <div className="text-sm text-muted-foreground">Manage your logged in devices</div>
                    </div>
                    <Button variant="outline">View</Button>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Button variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10">
                      Delete Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
