import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR } from '../lib/utils';
import { Crown, Check, X, ArrowRight, Calendar, CreditCard, Shield, Sparkles } from 'lucide-react';
import { getUserSubscription, hasProAccess, PLANS } from './Pricing';

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [subscription, setSubscription] = useState({ plan: 'free', status: 'inactive' });

  useEffect(() => {
    // Load user from localStorage
    const storedUser = getUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
      setSubscription(getUserSubscription());
    } else {
      // No user found, redirect to login
      navigate('/login');
    }
  }, [navigate]);

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
              <div className="space-y-6 mt-6">
                {/* Current Subscription Status */}
                <Card className={`glass-card border-2 ${hasProAccess() ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasProAccess() ? 'bg-primary/20' : 'bg-slate-500/20'}`}>
                            <Crown className={`w-6 h-6 ${hasProAccess() ? 'text-primary' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">
                              {hasProAccess() ? 'Pro Plan' : 'Free Plan'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {hasProAccess() 
                                ? `${subscription.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} subscription`
                                : 'Limited access to features'}
                            </p>
                          </div>
                        </div>
                        
                        {hasProAccess() && subscription.expiresAt && (
                          <div className="flex items-center gap-2 mt-4 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Renews on {new Date(subscription.expiresAt).toLocaleDateString('en-IN', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {hasProAccess() ? (
                        <Badge variant="success" className="bg-green-500/20 text-green-500 border-green-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Button onClick={() => navigate('/pricing')} className="bg-gradient-to-r from-primary to-emerald-600">
                          <Crown className="w-4 h-4 mr-2" />
                          Upgrade to Pro
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Plan Comparison */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Plan Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Free Plan */}
                      <div className={`p-5 rounded-xl border ${!hasProAccess() ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-lg font-bold">Free</span>
                          {!hasProAccess() && <Badge variant="outline" className="text-xs">Current</Badge>}
                        </div>
                        <ul className="space-y-3">
                          {PLANS.free.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              {feature.included ? (
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              )}
                              <span className={!feature.included ? 'text-muted-foreground' : ''}>{feature.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pro Plan */}
                      <div className={`p-5 rounded-xl border ${hasProAccess() ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <Crown className="w-5 h-5 text-primary" />
                          <span className="text-lg font-bold">Pro</span>
                          {hasProAccess() && <Badge className="text-xs bg-primary">Current</Badge>}
                        </div>
                        <ul className="space-y-3">
                          {PLANS.pro.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              {feature.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Pricing */}
                    {!hasProAccess() && (
                      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              Upgrade to Pro and unlock everything
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Starting at just ₹899/month or ₹4,999/year (save 53%)
                            </p>
                          </div>
                          <Button onClick={() => navigate('/pricing')}>
                            View Plans
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment History - Only for Pro users */}
                {hasProAccess() && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Billing & Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">Current Plan</div>
                            <div className="text-sm text-muted-foreground">
                              Pro - {subscription.billingCycle === 'yearly' ? '₹4,999/year' : '₹899/month'}
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => navigate('/pricing')}>Change Plan</Button>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">Next Billing Date</div>
                            <div className="text-sm text-muted-foreground">
                              {subscription.expiresAt 
                                ? new Date(subscription.expiresAt).toLocaleDateString('en-IN')
                                : 'N/A'}
                            </div>
                          </div>
                          <Badge variant="success">Auto-renew On</Badge>
                        </div>

                        <div className="pt-4 border-t border-border">
                          <p className="text-sm text-muted-foreground">
                            Need help? Contact support at support@moneysaarthi.com
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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
