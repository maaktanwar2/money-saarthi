import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Input, Button, Badge, Tabs } from '../components/ui';
import { formatINR, cn, isAdmin } from '../lib/utils';
import { getUserSubscription, hasProAccess, PLANS } from './Pricing';
import { getTokenBalance, getTokenPackages, rechargeTokens, getTokenHistory } from '../services/tokenService';
import { fetchWithAuth } from '../config/api';
import {
  Crown, Check, X, ArrowRight, Calendar, CreditCard, Shield, Sparkles,
  Zap, CheckCircle2, BarChart3, LogOut, Coins, Package, Star,
  History, Brain, Target, ShieldCheck
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN PACKAGE CARD
// ═══════════════════════════════════════════════════════════════════════════════
const TokenPackageCard = ({ pkg, isPopular, isSelected, onSelect }) => {
  const getIcon = () => {
    switch(pkg.id) {
      case 'starter': return <Package className="w-6 h-6" />;
      case 'basic': return <Zap className="w-6 h-6" />;
      case 'pro': return <Star className="w-6 h-6" />;
      case 'unlimited': return <Crown className="w-6 h-6" />;
      default: return <Package className="w-6 h-6" />;
    }
  };
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card onClick={() => onSelect(pkg)} className={cn('cursor-pointer transition-all relative overflow-hidden', isSelected && 'ring-2 ring-primary border-primary', isPopular && !isSelected && 'border-amber-500/30')}>
        {isPopular && <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>}
        <CardContent className="p-6">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", pkg.id === 'starter' && "bg-blue-500/15 text-blue-500", pkg.id === 'basic' && "bg-emerald-500/15 text-emerald-500", pkg.id === 'pro' && "bg-violet-500/15 text-violet-500", pkg.id === 'unlimited' && "bg-amber-500/15 text-amber-500")}>{getIcon()}</div>
          <h3 className="text-lg font-bold mb-1">{pkg.name}</h3>
          <p className="text-3xl font-bold mb-1">{pkg.tokens}<span className="text-sm text-foreground-muted ml-2">tokens</span></p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-bold text-primary">₹{pkg.price}</span>
            <span className="text-xs text-foreground-muted">(₹{pkg.price_per_token}/token)</span>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-foreground-muted"><Check className="w-4 h-4 text-emerald-500" /><span>{Math.floor(pkg.tokens / 20)} Portfolio Analyses</span></div>
            <div className="flex items-center gap-2 text-sm text-foreground-muted"><Check className="w-4 h-4 text-emerald-500" /><span>{Math.floor(pkg.tokens / 10)} Strategy Suggestions</span></div>
            <div className="flex items-center gap-2 text-sm text-foreground-muted"><Check className="w-4 h-4 text-emerald-500" /><span>Never expires</span></div>
          </div>
          <Button className="w-full" variant={isSelected ? 'default' : 'outline'}>
            {isSelected ? <><Check className="w-4 h-4 mr-2" />Selected</> : 'Select Package'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_UPI = { upi_number: '9818856552', payee_name: 'mspay', upi_id: 'gpay-11206998739@okbizaxis' };

const TokenPaymentModal = ({ pkg, onClose, onSuccess }) => {
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [upiConfig, setUpiConfig] = useState(DEFAULT_UPI);

  useEffect(() => {
    fetchWithAuth('/payment/upi-config').then(res => res.json()).then(data => {
      if (data?.upi_number) setUpiConfig(data);
    }).catch(() => {});
  }, []);

  const getQrUrl = () => {
    const upiId = upiConfig.upi_id || `${upiConfig.upi_number}@ybl`;
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiConfig.payee_name)}&am=${pkg.price}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
  };

  const handleSubmit = async () => {
    if (!transactionId.trim()) return;
    setLoading(true);
    try {
      const result = await rechargeTokens(pkg.id, transactionId.trim());
      if (result.success) { setSubmitted(true); setTimeout(() => onSuccess(result), 1500); }
      else { alert(result.error || 'Submission failed. Try again.'); }
    } catch (err) { alert(err.message || 'Error submitting payment'); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-surface-2 border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">Complete Payment</h2>
          <p className="text-sm text-foreground-muted">{pkg.name} - {pkg.tokens} tokens for ₹{pkg.price}</p>
        </div>
        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Payment Submitted!</h3>
            <p className="text-foreground-muted">Tokens will be added after verification.</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="bg-surface-1 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
                <p className="font-semibold">Scan QR code to pay ₹{pkg.price}</p>
              </div>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <img src={getQrUrl()} alt="UPI QR Code" className="w-56 h-56" />
              </div>
              <p className="text-xs text-foreground-muted mt-3 text-center">Open PhonePe, Google Pay, Paytm or any UPI app and scan this QR code</p>
              <p className="text-xs text-foreground-muted text-center mt-1">UPI ID: <span className="font-mono font-semibold">{upiConfig.upi_id || `${upiConfig.upi_number}@ybl`}</span></p>
            </div>
            <div className="bg-surface-1 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">2</div>
                <p className="font-semibold">Enter Transaction ID / UTR</p>
              </div>
              <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)}
                placeholder="Enter 12-digit UTR number" className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono" />
            </div>
            <Button onClick={handleSubmit} disabled={!transactionId.trim() || loading} className="w-full h-12 text-base">
              {loading ? 'Submitting...' : 'Submit Payment'}
            </Button>
            <button onClick={onClose} className="w-full text-sm text-foreground-muted hover:text-foreground">Cancel</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// Re-export isAdmin from utils for backward compatibility
export { isAdmin } from '../lib/utils';

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

  // Token states
  const [tokenPackages, setTokenPackages] = useState([]);
  const [selectedTokenPkg, setSelectedTokenPkg] = useState(null);
  const [showTokenPayment, setShowTokenPayment] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenHistory, setTokenHistory] = useState([]);

  // Load token data
  const loadTokenData = useCallback(async () => {
    try {
      const [packagesRes, balanceRes, historyRes] = await Promise.all([
        getTokenPackages(), getTokenBalance(), getTokenHistory()
      ]);
      setTokenPackages(packagesRes.packages || []);
      setTokenBalance(balanceRes.balance || 0);
      setTokenHistory(historyRes.history || []);
    } catch (e) { /* token data fetch failed - show defaults */ }
  }, []);

  useEffect(() => {
    const storedUser = getUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
      setSubscription(getUserSubscription());
      loadTokenData();
    } else {
      navigate('/login');
    }
  }, [navigate, loadTokenData]);

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

  if (!user) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  // Token handlers
  const handleSelectTokenPkg = (pkg) => { setSelectedTokenPkg(pkg); setShowTokenPayment(true); };
  const handleTokenPaymentSuccess = (result) => {
    setTokenBalance(result.new_balance);
    setShowTokenPayment(false);
    setSelectedTokenPkg(null);
    getTokenHistory().then(res => setTokenHistory(res.history || []));
  };

  // Build tabs
  const profileTabs = [
    { id: 'profile', label: '👤 Profile' },
    { id: 'stats', label: '📊 Stats' },
    { id: 'tokens', label: '🪙 AI Tokens' },
    { id: 'subscription', label: '💎 Subscription' },
    { id: 'security', label: '🔒 Security' },
  ];

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/profile')} path="/profile" />
      <PageHeader
        title="My Profile"
        subtitle="Manage your account and preferences"
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
                <p className="text-xs text-foreground-muted">{user.email}</p>

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
                    <div className="text-xs text-foreground-muted">Trades</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-profit">{user.stats?.winRate || 0}%</div>
                    <div className="text-xs text-foreground-muted">Win Rate</div>
                  </div>
                </div>

                {/* Admin link */}
                {userIsAdmin && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/admin')}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Button>
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
                          <label className="text-sm text-foreground-muted block mb-2">Full Name</label>
                          <Input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-sm text-foreground-muted block mb-2">Email</label>
                          <Input type="email" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                          {isAdmin(editForm.email) && <p className="text-xs text-red-400 mt-1">👑 This email has admin privileges</p>}
                        </div>
                        <div>
                          <label className="text-sm text-foreground-muted block mb-2">Phone</label>
                          <Input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-sm text-foreground-muted block mb-2">Default Index</label>
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
                          <span className="text-foreground-muted">{item.label}</span>
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
                      <div className="text-xs text-foreground-muted">{stat.label}</div>
                    </Card>
                  ))}
                </div>
                <Card className="glass-card">
                  <CardHeader><CardTitle>Performance Overview</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center text-foreground-muted">
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
                            <p className="text-sm text-foreground-muted">
                              {hasProAccess() ? `${subscription.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} subscription` : 'Limited access to features'}
                            </p>
                          </div>
                        </div>
                        {hasProAccess() && subscription.expiresAt && (
                          <div className="flex items-center gap-2 mt-4 text-sm">
                            <Calendar className="w-4 h-4 text-foreground-muted" />
                            <span className="text-foreground-muted">
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
                              <span className={!feature.included ? 'text-foreground-muted' : ''}>{feature.name}</span>
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
                            <p className="text-sm text-foreground-muted mt-1">Starting at just ₹899/month or ₹4,999/year (save 53%)</p>
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
                            <div className="text-sm text-foreground-muted">Pro - {subscription.billingCycle === 'yearly' ? '₹4,999/year' : '₹899/month'}</div>
                          </div>
                          <Button variant="outline" onClick={() => navigate('/pricing')}>Change Plan</Button>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">Next Billing Date</div>
                            <div className="text-sm text-foreground-muted">{subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('en-IN') : 'N/A'}</div>
                          </div>
                          <Badge variant="success">Auto-renew On</Badge>
                        </div>
                        <div className="pt-4 border-t border-border">
                          <p className="text-sm text-foreground-muted">Need help? Contact support at support@moneysaarthi.com</p>
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
                        <div className="text-sm text-foreground-muted">{item.desc}</div>
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


            {/* ═══════════════════════════════════════
                AI TOKENS TAB
            ═══════════════════════════════════════ */}
            {activeTab === 'tokens' && (
              <div className="space-y-6 mt-6">
                {/* Current Balance */}
                <div className="flex flex-wrap items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-violet-500/20 border border-primary/20">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                      <Coins className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground-muted">Current Balance</p>
                      <p className="text-4xl font-bold">{tokenBalance} <span className="text-lg text-foreground-muted">tokens</span></p>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-4 justify-end">
                    <div className="text-center p-4 rounded-xl bg-white/5"><p className="text-2xl font-bold">{Math.floor(tokenBalance / 20)}</p><p className="text-xs text-foreground-muted">Portfolio Analyses</p></div>
                    <div className="text-center p-4 rounded-xl bg-white/5"><p className="text-2xl font-bold">{Math.floor(tokenBalance / 10)}</p><p className="text-xs text-foreground-muted">Strategy Suggestions</p></div>
                    <div className="text-center p-4 rounded-xl bg-white/5"><p className="text-2xl font-bold">{Math.floor(tokenBalance / 5)}</p><p className="text-xs text-foreground-muted">Trade Analyses</p></div>
                  </div>
                </div>

                {/* Token Costs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { action: 'Portfolio Review', tokens: 20, icon: <BarChart3 className="w-5 h-5" /> },
                    { action: 'Strategy Suggestion', tokens: 10, icon: <Target className="w-5 h-5" /> },
                    { action: 'Risk Assessment', tokens: 8, icon: <ShieldCheck className="w-5 h-5" /> },
                    { action: 'Trade Analysis', tokens: 5, icon: <Brain className="w-5 h-5" /> },
                  ].map(item => (
                    <Card key={item.action} className="text-center">
                      <CardContent className="p-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3 text-primary">{item.icon}</div>
                        <p className="text-sm font-medium mb-1">{item.action}</p>
                        <Badge variant="secondary">{item.tokens} tokens</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Bot Token Costs */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">🤖 Algo Bot Costs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { name: 'VWAP Momentum', tokens: 15, color: 'text-blue-500', bg: 'bg-blue-500/15', desc: 'Basic bot' },
                      { name: 'Delta Neutral', tokens: 40, color: 'text-emerald-500', bg: 'bg-emerald-500/15', desc: 'Iron Condor / Butterfly / Strangle' },
                      { name: 'QuantStrangle AI', tokens: 60, color: 'text-purple-500', bg: 'bg-purple-500/15', desc: 'AI + Auto Hedging' },
                    ].map(item => (
                      <Card key={item.name} className="text-center">
                        <CardContent className="p-4">
                          <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-3 ${item.color}`}>
                            <Brain className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-medium mb-1">{item.name}</p>
                          <p className="text-xs text-foreground-muted mb-2">{item.desc}</p>
                          <Badge variant="secondary" className={item.color}>{item.tokens} tokens</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Token Packages */}
                <div>
                  <h2 className="text-xl font-bold mb-6">Choose a Package</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {tokenPackages.map(pkg => (
                      <TokenPackageCard key={pkg.id} pkg={pkg} isPopular={pkg.id === 'pro'}
                        isSelected={selectedTokenPkg?.id === pkg.id} onSelect={handleSelectTokenPkg} />
                    ))}
                  </div>
                </div>

                {/* Token History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Token History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!tokenHistory || tokenHistory.length === 0 ? (
                      <div className="py-8 text-center">
                        <History className="w-10 h-10 text-foreground-muted mx-auto mb-3" />
                        <p className="text-foreground-muted">No token history yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tokenHistory.slice(0, 10).map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-1">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", item.tokens > 0 ? "bg-emerald-500/15" : "bg-red-500/15")}>
                                {item.tokens > 0 ? <Coins className="w-4 h-4 text-emerald-500" /> : <Brain className="w-4 h-4 text-red-500" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{item.type === 'purchase' ? `Purchased ${item.package}` : item.action}</p>
                                <p className="text-xs text-foreground-muted">{new Date(item.timestamp).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <span className={cn("font-bold", item.tokens > 0 ? "text-emerald-500" : "text-red-500")}>
                              {item.tokens > 0 ? '+' : ''}{item.tokens}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Token Payment Modal */}
                <AnimatePresence>
                  {showTokenPayment && selectedTokenPkg && (
                    <TokenPaymentModal pkg={selectedTokenPkg}
                      onClose={() => { setShowTokenPayment(false); setSelectedTokenPkg(null); }}
                      onSuccess={handleTokenPaymentSuccess} />
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}


