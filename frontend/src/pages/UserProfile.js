import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Input, Button, Badge, Tabs, Select, MenuItem } from '../components/ui';
import { formatINR, isAdmin } from '../lib/utils';
import { getUserSubscription, hasProAccess, PLANS } from './Pricing';
import { getTokenBalance, getTokenPackages, rechargeTokens, getTokenHistory } from '../services/tokenService';
import { fetchWithAuth } from '../config/api';
import {
  Crown, Check, X, ArrowRight, Calendar, CreditCard, Shield, Sparkles,
  Zap, CheckCircle2, BarChart3, LogOut, Coins, Package, Star,
  History, Brain, Target, ShieldCheck
} from 'lucide-react';

// TokenPackageCard
const TokenPackageCard = ({ pkg, isPopular, isSelected, onSelect }) => {
  const theme = useTheme();
  const getIcon = () => {
    switch(pkg.id) {
      case 'starter': return <Package className="w-6 h-6" />;
      case 'basic': return <Zap className="w-6 h-6" />;
      case 'pro': return <Star className="w-6 h-6" />;
      case 'unlimited': return <Crown className="w-6 h-6" />;
      default: return <Package className="w-6 h-6" />;
    }
  };

  const iconColors = {
    starter: { bgcolor: alpha('#3b82f6', 0.15), color: '#3b82f6' },
    basic: { bgcolor: alpha('#10b981', 0.15), color: '#10b981' },
    pro: { bgcolor: alpha('#8b5cf6', 0.15), color: '#8b5cf6' },
    unlimited: { bgcolor: alpha('#f59e0b', 0.15), color: '#f59e0b' },
  };

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card
        onClick={() => onSelect(pkg)}
        sx={{
          cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
          ...(isSelected ? { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', borderColor: 'primary.main' } : {}),
          ...(isPopular && !isSelected ? { borderColor: alpha('#f59e0b', 0.3) } : {}),
        }}
      >
        {isPopular && (
          <Box sx={{
            position: 'absolute', top: 0, right: 0,
            bgcolor: '#f59e0b', color: '#000',
            fontSize: '0.75rem', fontWeight: 700,
            px: 1.5, py: 0.5, borderBottomLeftRadius: 8,
          }}>
            POPULAR
          </Box>
        )}
        <CardContent sx={{ p: 3 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
            ...(iconColors[pkg.id] || iconColors.starter),
          }}>
            {getIcon()}
          </Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, mb: 0.5 }}>{pkg.name}</Typography>
          <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, mb: 0.5 }}>
            {pkg.tokens}<Box component="span" sx={{ fontSize: '0.875rem', color: 'text.secondary', ml: 1 }}>tokens</Box>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>{'\u20B9'}{pkg.price}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>({'\u20B9'}{pkg.price_per_token}/token)</Typography>
          </Box>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
              <Check className="w-4 h-4" style={{ color: '#10b981' }} />
              <Typography variant="body2">{Math.floor(pkg.tokens / 20)} Portfolio Analyses</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
              <Check className="w-4 h-4" style={{ color: '#10b981' }} />
              <Typography variant="body2">{Math.floor(pkg.tokens / 10)} Strategy Suggestions</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
              <Check className="w-4 h-4" style={{ color: '#10b981' }} />
              <Typography variant="body2">Never expires</Typography>
            </Box>
          </Stack>
          <Button variant={isSelected ? 'default' : 'outline'} sx={{ width: '100%' }}>
            {isSelected ? <><Check className="w-4 h-4" style={{ marginRight: 8 }} />Selected</> : 'Select Package'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Token Payment Modal
const DEFAULT_UPI = { upi_number: '9818856552', payee_name: 'mspay', upi_id: 'gpay-11206998739@okbizaxis' };

const TokenPaymentModal = ({ pkg, onClose, onSuccess }) => {
  const theme = useTheme();
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
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 512 }}
      >
        <Box sx={{
          bgcolor: 'background.paper', border: 1, borderColor: 'divider',
          borderRadius: 4, overflow: 'hidden',
        }}>
          <Box sx={{ p: 3, borderBottom: 1, borderColor: alpha(theme.palette.common.white, 0.1) }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>Complete Payment</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{pkg.name} - {pkg.tokens} tokens for {'\u20B9'}{pkg.price}</Typography>
          </Box>
          {submitted ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircle2 className="w-16 h-16" style={{ color: '#22c55e', margin: '0 auto 16px' }} />
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1 }}>Payment Submitted!</Typography>
              <Typography sx={{ color: 'text.secondary' }}>Tokens will be added after verification.</Typography>
            </Box>
          ) : (
            <Box sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 3, p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700 }}>1</Box>
                    <Typography sx={{ fontWeight: 600 }}>Scan QR code to pay {'\u20B9'}{pkg.price}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#fff', borderRadius: 3 }}>
                    <Box component="img" src={getQrUrl()} alt="UPI QR Code" sx={{ width: 224, height: 224 }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>
                    Open PhonePe, Google Pay, Paytm or any UPI app and scan this QR code
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center', mt: 0.5 }}>
                    UPI ID: <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{upiConfig.upi_id || `${upiConfig.upi_number}@ybl`}</Box>
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 3, p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700 }}>2</Box>
                    <Typography sx={{ fontWeight: 600 }}>Enter Transaction ID / UTR</Typography>
                  </Box>
                  <TextField
                    fullWidth size="small" variant="outlined"
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value)}
                    placeholder="Enter 12-digit UTR number"
                    sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                  />
                </Box>
                <Button onClick={handleSubmit} disabled={!transactionId.trim() || loading} sx={{ width: '100%', height: 48, fontSize: '1rem' }}>
                  {loading ? 'Submitting...' : 'Submit Payment'}
                </Button>
                <Box
                  component="button"
                  onClick={onClose}
                  sx={{ width: '100%', fontSize: '0.875rem', color: 'text.secondary', cursor: 'pointer', bgcolor: 'transparent', border: 'none', '&:hover': { color: 'text.primary' } }}
                >
                  Cancel
                </Box>
              </Stack>
            </Box>
          )}
        </Box>
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
  const theme = useTheme();
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
    navigate('/');
  };

  if (!user) {
    return (
      <PageLayout>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <Box sx={{
            width: 32, height: 32, border: 4,
            borderColor: alpha(theme.palette.primary.main, 0.3),
            borderTopColor: 'primary.main',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
          }} />
        </Box>
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
    { id: 'profile', label: '\u{1F464} Profile' },
    { id: 'stats', label: '\u{1F4CA} Stats' },
    { id: 'tokens', label: '\u{1FA99} AI Tokens' },
    { id: 'subscription', label: '\u{1F48E} Subscription' },
    { id: 'security', label: '\u{1F512} Security' },
  ];

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/profile')} path="/profile" />
      <PageHeader
        title="My Profile"
        description="Manage your account and preferences"
      />

      <Section>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 3fr)' }, gap: 3 }}>
          {/* LEFT SIDEBAR - Profile Card */}
          <Box sx={{ gridColumn: { lg: '1' } }}>
            <Card sx={{ textAlign: 'center', position: 'sticky', top: 48 }}>
              <CardContent sx={{ pt: 3 }}>
                <Box sx={{
                  width: 80, height: 80, mx: 'auto', borderRadius: '50%',
                  background: 'linear-gradient(to bottom right, var(--mui-palette-primary-main), #0d9488)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 700, color: 'common.white', mb: 1.5,
                }}>
                  {user.name?.charAt(0) || 'U'}
                </Box>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>{user.name}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{user.email}</Typography>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1.5 }}>
                  <Badge variant={user.plan === 'premium' ? 'default' : 'secondary'}>
                    {user.plan === 'premium' ? '\u2B50 Premium' : 'Free Plan'}
                  </Badge>
                  {userIsAdmin && (
                    <Badge sx={{ bgcolor: alpha('#ef4444', 0.2), color: '#f87171', borderColor: alpha('#ef4444', 0.3) }}>
                      {'\u{1F451}'} Admin
                    </Badge>
                  )}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mt: 2.5, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'primary.main' }}>{user.stats?.totalTrades || 0}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Trades</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'success.main' }}>{user.stats?.winRate || 0}%</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Win Rate</Typography>
                  </Box>
                </Box>

                {/* Admin link */}
                {userIsAdmin && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button variant="outline" sx={{ width: '100%' }} onClick={() => navigate('/admin')}>
                      <Crown className="w-4 h-4" style={{ marginRight: 8 }} />
                      Admin Panel
                    </Button>
                  </Box>
                )}

                <Button
                  variant="outline"
                  onClick={handleLogout}
                  sx={{ width: '100%', mt: 2, color: 'error.main', borderColor: alpha('#ef4444', 0.2), '&:hover': { bgcolor: alpha('#ef4444', 0.1) } }}
                >
                  <LogOut className="w-4 h-4" style={{ marginRight: 8 }} />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* RIGHT - Main Content */}
          <Box sx={{ gridColumn: { lg: '2' } }}>
            {/* Tab Navigation */}
            <Box>
              <Tabs
                tabs={profileTabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            </Box>

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <Card sx={{ mt: 3 }}>
                <CardHeader sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CardTitle>Profile Information</CardTitle>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => { setEditForm(user); setIsEditing(true); }}>
                      Edit Profile
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Stack spacing={2}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                        <Box>
                          <Typography component="label" sx={{ fontSize: '0.875rem', color: 'text.secondary', display: 'block', mb: 1 }}>Full Name</Typography>
                          <Input value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                        </Box>
                        <Box>
                          <Typography component="label" sx={{ fontSize: '0.875rem', color: 'text.secondary', display: 'block', mb: 1 }}>Email</Typography>
                          <Input type="email" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                          {isAdmin(editForm.email) && <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mt: 0.5 }}>{'\u{1F451}'} This email has admin privileges</Typography>}
                        </Box>
                        <Box>
                          <Typography component="label" sx={{ fontSize: '0.875rem', color: 'text.secondary', display: 'block', mb: 1 }}>Phone</Typography>
                          <Input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                        </Box>
                        <Box>
                          <Typography component="label" sx={{ fontSize: '0.875rem', color: 'text.secondary', display: 'block', mb: 1 }}>Default Index</Typography>
                          <Select
                            value={editForm.preferences?.defaultIndex || 'NIFTY'}
                            onChange={e => setEditForm({ ...editForm, preferences: {...editForm.preferences, defaultIndex: e.target.value} })}
                          >
                            <MenuItem value="NIFTY">NIFTY</MenuItem>
                            <MenuItem value="BANKNIFTY">BANKNIFTY</MenuItem>
                            <MenuItem value="FINNIFTY">FINNIFTY</MenuItem>
                          </Select>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button onClick={handleSaveProfile}>Save Changes</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={2}>
                      {[
                        { label: 'Full Name', value: user.name },
                        { label: 'Email', value: user.email },
                        { label: 'Phone', value: user.phone || 'Not set' },
                        { label: 'Member Since', value: new Date(user.joinedAt).toLocaleDateString() },
                        { label: 'Default Index', value: user.preferences?.defaultIndex || 'NIFTY' },
                      ].map(item => (
                        <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: 1, borderColor: alpha(theme.palette.divider, 0.5) }}>
                          <Typography sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                          <Typography sx={{ fontWeight: 500 }}>{item.value}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TRADING STATS TAB */}
            {activeTab === 'stats' && (
              <Stack spacing={3} sx={{ mt: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  {[
                    { label: 'Total Trades', value: user.stats?.totalTrades || 0, icon: '\u{1F4CA}' },
                    { label: 'Win Rate', value: `${user.stats?.winRate || 0}%`, icon: '\u{1F3AF}', color: 'success.main' },
                    { label: 'Total P&L', value: formatINR(user.stats?.totalPnL || 0), icon: '\u{1F4B0}', color: user.stats?.totalPnL >= 0 ? 'success.main' : 'error.main' },
                    { label: 'Win Streak', value: user.stats?.streak || 0, icon: '\u{1F525}' },
                  ].map(stat => (
                    <Card key={stat.label} sx={{ p: 2, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>{stat.icon}</Typography>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, ...(stat.color ? { color: stat.color } : {}) }}>{stat.value}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{stat.label}</Typography>
                    </Card>
                  ))}
                </Box>
                <Card>
                  <CardHeader><CardTitle>Performance Overview</CardTitle></CardHeader>
                  <CardContent>
                    <Box sx={{ height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                      <Typography>Connect your broker to see detailed performance analytics</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* SUBSCRIPTION TAB */}
            {activeTab === 'subscription' && (
              <Stack spacing={3} sx={{ mt: 3 }}>
                <Card sx={{
                  border: 2,
                  borderColor: hasProAccess() ? 'primary.main' : 'divider',
                  ...(hasProAccess() ? { bgcolor: alpha(theme.palette.primary.main, 0.05) } : {}),
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <Box sx={{
                            width: 48, height: 48, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: hasProAccess() ? alpha(theme.palette.primary.main, 0.2) : alpha('#64748b', 0.2),
                          }}>
                            <Crown className="w-6 h-6" style={{ color: hasProAccess() ? theme.palette.primary.main : '#94a3b8' }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{hasProAccess() ? 'Pro Plan' : 'Free Plan'}</Typography>
                            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                              {hasProAccess() ? `${subscription.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} subscription` : 'Limited access to features'}
                            </Typography>
                          </Box>
                        </Box>
                        {hasProAccess() && subscription.expiresAt && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, fontSize: '0.875rem' }}>
                            <Calendar className="w-4 h-4" style={{ color: theme.palette.text.secondary }} />
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                              Renews on {new Date(subscription.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      {hasProAccess() ? (
                        <Badge sx={{ bgcolor: alpha('#22c55e', 0.2), color: '#22c55e', borderColor: alpha('#22c55e', 0.3) }}>Active</Badge>
                      ) : (
                        <Button onClick={() => navigate('/pricing')} sx={{ background: 'linear-gradient(135deg, var(--mui-palette-primary-main), #059669)', color: '#fff' }}>
                          <Crown className="w-4 h-4" style={{ marginRight: 8 }} />Upgrade to Pro
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Plan Features</CardTitle></CardHeader>
                  <CardContent>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
                      <Box sx={{
                        p: 2.5, borderRadius: 3, border: 1,
                        borderColor: !hasProAccess() ? alpha(theme.palette.primary.main, 0.5) : 'divider',
                        ...(! hasProAccess() ? { bgcolor: alpha(theme.palette.primary.main, 0.05) } : {}),
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>Free</Typography>
                          {!hasProAccess() && <Badge variant="outline" sx={{ fontSize: '0.75rem' }}>Current</Badge>}
                        </Box>
                        <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                          {PLANS.free.features.map((feature, i) => (
                            <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem' }}>
                              {feature.included
                                ? <Check className="w-4 h-4" style={{ color: '#22c55e', flexShrink: 0 }} />
                                : <X className="w-4 h-4" style={{ color: '#64748b', flexShrink: 0 }} />
                              }
                              <Typography variant="body2" sx={{ ...(!feature.included ? { color: 'text.secondary' } : {}) }}>{feature.name}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                      <Box sx={{
                        p: 2.5, borderRadius: 3, border: 1,
                        borderColor: hasProAccess() ? alpha(theme.palette.primary.main, 0.5) : 'divider',
                        ...(hasProAccess() ? { bgcolor: alpha(theme.palette.primary.main, 0.05) } : {}),
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Crown className="w-5 h-5" style={{ color: theme.palette.primary.main }} />
                          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>Pro</Typography>
                          {hasProAccess() && <Badge sx={{ fontSize: '0.75rem', bgcolor: 'primary.main' }}>Current</Badge>}
                        </Box>
                        <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                          {PLANS.pro.features.map((feature, i) => (
                            <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.875rem' }}>
                              <Check className="w-4 h-4" style={{ color: '#22c55e', flexShrink: 0 }} />
                              <Typography variant="body2">{feature.name}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                    {!hasProAccess() && (
                      <Box sx={{
                        mt: 3, p: 2, borderRadius: 3,
                        background: `linear-gradient(to right, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha('#f59e0b', 0.1)})`,
                        border: 1, borderColor: alpha(theme.palette.primary.main, 0.2),
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 500 }}>
                              <Sparkles className="w-4 h-4" style={{ color: theme.palette.primary.main }} />
                              <Typography sx={{ fontWeight: 500 }}>Upgrade to Pro and unlock everything</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5 }}>Starting at just {'\u20B9'}899/month or {'\u20B9'}4,999/year (save 53%)</Typography>
                          </Box>
                          <Button onClick={() => navigate('/pricing')}>View Plans<ArrowRight className="w-4 h-4" style={{ marginLeft: 8 }} /></Button>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {hasProAccess() && (
                  <Card>
                    <CardHeader>
                      <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CreditCard className="w-5 h-5" />Billing & Payment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 500 }}>Current Plan</Typography>
                            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Pro - {subscription.billingCycle === 'yearly' ? '\u20B94,999/year' : '\u20B9899/month'}</Typography>
                          </Box>
                          <Button variant="outline" onClick={() => navigate('/pricing')}>Change Plan</Button>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 500 }}>Next Billing Date</Typography>
                            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('en-IN') : 'N/A'}</Typography>
                          </Box>
                          <Badge variant="success">Auto-renew On</Badge>
                        </Box>
                        <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Need help? Contact support at support@moneysaarthi.com</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <Card sx={{ mt: 3 }}>
                <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
                <CardContent>
                  <Stack spacing={3}>
                    {[
                      { title: 'Change Password', desc: 'Update your account password', action: 'Change' },
                      { title: 'Two-Factor Authentication', desc: 'Add an extra layer of security', action: 'Enable' },
                      { title: 'Active Sessions', desc: 'Manage your logged in devices', action: 'View' },
                    ].map(item => (
                      <Box key={item.title} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                        <Box>
                          <Typography sx={{ fontWeight: 500 }}>{item.title}</Typography>
                          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{item.desc}</Typography>
                        </Box>
                        <Button variant="outline">{item.action}</Button>
                      </Box>
                    ))}
                    <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Button variant="outline" sx={{ color: '#ef4444', borderColor: alpha('#ef4444', 0.2), '&:hover': { bgcolor: alpha('#ef4444', 0.1) } }}>Delete Account</Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* AI TOKENS TAB */}
            {activeTab === 'tokens' && (
              <Stack spacing={3} sx={{ mt: 3 }}>
                {/* Current Balance */}
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3,
                  p: 3, borderRadius: 4,
                  background: `linear-gradient(to right, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha('#8b5cf6', 0.2)})`,
                  border: 1, borderColor: alpha(theme.palette.primary.main, 0.2),
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.2), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Coins className="w-7 h-7" style={{ color: theme.palette.primary.main }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Current Balance</Typography>
                      <Typography sx={{ fontSize: '2.25rem', fontWeight: 700 }}>
                        {tokenBalance} <Box component="span" sx={{ fontSize: '1.125rem', color: 'text.secondary' }}>tokens</Box>
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-end' }}>
                    <Box sx={{ textAlign: 'center', p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.common.white, 0.05) }}>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.floor(tokenBalance / 20)}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Portfolio Analyses</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.common.white, 0.05) }}>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.floor(tokenBalance / 10)}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Strategy Suggestions</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.common.white, 0.05) }}>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.floor(tokenBalance / 5)}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Trade Analyses</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Token Costs */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                  {[
                    { action: 'Portfolio Review', tokens: 20, icon: <BarChart3 className="w-5 h-5" /> },
                    { action: 'Strategy Suggestion', tokens: 10, icon: <Target className="w-5 h-5" /> },
                    { action: 'Risk Assessment', tokens: 8, icon: <ShieldCheck className="w-5 h-5" /> },
                    { action: 'Trade Analysis', tokens: 5, icon: <Brain className="w-5 h-5" /> },
                  ].map(item => (
                    <Card key={item.action} sx={{ textAlign: 'center' }}>
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5, color: 'primary.main' }}>{item.icon}</Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, mb: 0.5 }}>{item.action}</Typography>
                        <Badge variant="secondary">{item.tokens} tokens</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                {/* Bot Token Costs */}
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 2 }}>{'\u{1F916}'} Algo Bot Costs</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                    {[
                      { name: 'VWAP Momentum', tokens: 15, color: '#3b82f6', desc: 'Basic bot' },
                      { name: 'Delta Neutral', tokens: 40, color: '#10b981', desc: 'Iron Condor / Butterfly / Strangle' },
                      { name: 'QuantStrangle AI', tokens: 60, color: '#a855f7', desc: 'AI + Auto Hedging' },
                    ].map(item => (
                      <Card key={item.name} sx={{ textAlign: 'center' }}>
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: 3, bgcolor: alpha(item.color, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5, color: item.color }}>
                            <Brain className="w-5 h-5" />
                          </Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, mb: 0.5 }}>{item.name}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>{item.desc}</Typography>
                          <Badge variant="secondary" sx={{ color: item.color }}>{item.tokens} tokens</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>

                {/* Token Packages */}
                <Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 3 }}>Choose a Package</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 3 }}>
                    {tokenPackages.map(pkg => (
                      <TokenPackageCard key={pkg.id} pkg={pkg} isPopular={pkg.id === 'pro'}
                        isSelected={selectedTokenPkg?.id === pkg.id} onSelect={handleSelectTokenPkg} />
                    ))}
                  </Box>
                </Box>

                {/* Token History */}
                <Card>
                  <CardHeader>
                    <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><History className="w-5 h-5" />Token History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!tokenHistory || tokenHistory.length === 0 ? (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <History className="w-10 h-10" style={{ color: theme.palette.text.secondary, margin: '0 auto 12px' }} />
                        <Typography sx={{ color: 'text.secondary' }}>No token history yet</Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1.5}>
                        {tokenHistory.slice(0, 10).map((item, i) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{
                                width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: item.tokens > 0 ? alpha('#10b981', 0.15) : alpha('#ef4444', 0.15),
                              }}>
                                {item.tokens > 0
                                  ? <Coins className="w-4 h-4" style={{ color: '#10b981' }} />
                                  : <Brain className="w-4 h-4" style={{ color: '#ef4444' }} />
                                }
                              </Box>
                              <Box>
                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.type === 'purchase' ? `Purchased ${item.package}` : item.action}</Typography>
                                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{new Date(item.timestamp).toLocaleDateString()}</Typography>
                              </Box>
                            </Box>
                            <Typography sx={{ fontWeight: 700, color: item.tokens > 0 ? '#10b981' : '#ef4444' }}>
                              {item.tokens > 0 ? '+' : ''}{item.tokens}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
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
              </Stack>
            )}
          </Box>
        </Box>
      </Section>
    </PageLayout>
  );
}
