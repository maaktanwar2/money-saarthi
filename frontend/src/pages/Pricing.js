import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { updateUser } from '../services/adminService';
import { fetchWithAuth } from '../config/api';
import {
  Check,
  X,
  Crown,
  Zap,
  Shield,
  Sparkles,
  Clock,
  Users,
  Star,
  ArrowRight,
  BadgeCheck,
  QrCode,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING PAGE - Subscription Plans
// ═══════════════════════════════════════════════════════════════════════════════

// UPI Payment — QR code flow
// UPI details fetched from backend on mount (no hardcoded fallback)
const DEFAULT_UPI = { upi_number: '', payee_name: '', upi_id: '' };

// Plan configurations
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'No longer available - Subscription required',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { name: 'Basic Market Overview', included: false },
      { name: 'Limited Scanners (2)', included: false },
      { name: 'Basic Calculators', included: false },
      { name: 'AI Trade Signals', included: false },
      { name: 'Options Analytics', included: false },
      { name: 'FII/DII Data', included: false },
      { name: 'Trading Journal', included: false },
      { name: 'Backtesting', included: false },
      { name: 'Priority Support', included: false },
    ],
    color: 'slate',
    icon: Zap,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Everything you need for serious trading',
    monthlyPrice: 899,
    yearlyPrice: 4999,
    yearlyDiscount: Math.round((1 - 4999 / (899 * 12)) * 100),
    features: [
      { name: 'Full Market Dashboard', included: true },
      { name: 'All Scanners (Unlimited)', included: true },
      { name: 'Advanced Calculators', included: true },
      { name: 'AI Trade Signals', included: true },
      { name: 'Options Chain & Greeks', included: true },
      { name: 'Real-time FII/DII Data', included: true },
      { name: 'Trading Journal', included: true },
      { name: 'Strategy Backtesting', included: true },
      { name: 'Priority Support', included: true },
      { name: 'Early Access Features', included: true },
    ],
    color: 'primary',
    icon: Crown,
    popular: true,
  },
};

// Get user subscription from storage
export const getUserSubscription = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    return {
      plan: user.subscription?.plan || 'free',
      status: user.subscription?.status || 'inactive',
      expiresAt: user.subscription?.expiresAt || null,
      billingCycle: user.subscription?.billingCycle || null,
    };
  } catch {
    return { plan: 'free', status: 'inactive', expiresAt: null, billingCycle: null };
  }
};

// Check if subscription is active (free plan no longer grants access)
export const isSubscriptionActive = () => {
  const sub = getUserSubscription();
  // Free plan does NOT grant access anymore - subscription required
  if (sub.plan === 'free') return false;
  if (sub.status !== 'active') return false;
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
  return true;
};

// Check if user has pro access
export const hasProAccess = () => {
  const sub = getUserSubscription();
  const user = JSON.parse(localStorage.getItem('ms_user') || '{}');

  // Admins always have pro access
  if (user.isAdmin) return true;

  return sub.plan === 'pro' && isSubscriptionActive();
};

// Save subscription to user storage
export const saveSubscription = (subscriptionData) => {
  try {
    const user = JSON.parse(localStorage.getItem('ms_user') || '{}');
    user.subscription = {
      ...user.subscription,
      ...subscriptionData,
    };
    localStorage.setItem('ms_user', JSON.stringify(user));
    window.dispatchEvent(new Event('storage'));
    return true;
  } catch {
    return false;
  }
};

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const requireSubscription = location.state?.requireSubscription || false;
  const [billingCycle, setBillingCycle] = useState('yearly');
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [user, setUser] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [upiConfig, setUpiConfig] = useState(DEFAULT_UPI);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('ms_user') || 'null');
    setUser(storedUser);
    if (storedUser?.subscription?.plan) {
      setCurrentPlan(storedUser.subscription.plan);
    }
    // Fetch UPI config from backend
    fetchWithAuth('/payment/upi-config').then(res => res.json()).then(data => {
      if (data?.upi_number) setUpiConfig(data);
    }).catch(() => {});
  }, []);

  // Helper to get redirect URL after subscription
  const getPostSubscriptionRedirect = () => {
    const redirectUrl = sessionStorage.getItem('redirectAfterSubscription') || sessionStorage.getItem('redirectAfterLogin') || '/';
    sessionStorage.removeItem('redirectAfterSubscription');
    sessionStorage.removeItem('redirectAfterLogin');
    return redirectUrl;
  };

  const handleSubscribe = async (planId) => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Free plan no longer grants access - redirect to pro selection
    if (planId === 'free') {
      return; // Do nothing for free plan - subscription required
    }

    setSelectedPlan(PLANS[planId]);
    setShowPaymentModal(true);
    setPaymentSubmitted(false);
    setTransactionId('');
  };

  // Generate UPI QR code URL
  const getQrUrl = (amount) => {
    const upiId = upiConfig.upi_id || `${upiConfig.upi_number}@ybl`;
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiConfig.payee_name)}&am=${amount}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
  };

  // Submit UTR after manual payment
  const handlePaymentSubmit = async () => {
    const utr = transactionId.trim();
    if (!utr) {
      alert('Please enter the Transaction ID / UTR Number');
      return;
    }
    // Basic UTR format validation (typically 12-22 alphanumeric chars)
    if (!/^[A-Za-z0-9]{8,22}$/.test(utr)) {
      alert('Please enter a valid UTR / Transaction ID (8-22 alphanumeric characters)');
      return;
    }

    setLoading(true);
    const amount = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;

    try {
      // Submit to backend for admin verification
      const res = await fetchWithAuth('/payment/upi/submit', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: billingCycle === 'yearly' ? 'yearly' : 'monthly',
          utr_number: utr,
          amount,
        }),
      });

      if (!res.ok) {
        throw new Error('Payment submission failed');
      }

      // Mark as pending (NOT active) — backend admin will activate after verification
      updateUser(user?.email, {
        plan: 'pro',
        billingCycle,
        subscriptionStatus: 'pending',
      });

      setPaymentSubmitted(true);
    } catch {
      alert('Could not submit payment details. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Payment Modal Component (Simple UPI)
  const PaymentModal = () => {
    if (!showPaymentModal || !selectedPlan) return null;

    const amount = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowPaymentModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 512 }}
          >
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 4,
                boxShadow: 24,
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      Complete Payment
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                      {selectedPlan.name} Plan - {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
                      {formatPrice(amount)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {billingCycle === 'yearly' ? 'per year' : 'per month'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {paymentSubmitted ? (
                /* Success State */
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: alpha('#22c55e', 0.2),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <CheckCircle2 style={{ width: 40, height: 40, color: '#22c55e' }} />
                  </Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mb: 1 }}>
                    Payment Details Submitted!
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', mb: 2 }}>
                    Your payment is being verified. You'll get access within a few hours.
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                      borderRadius: 2,
                      p: 2,
                      textAlign: 'left',
                      mb: 3,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>Transaction ID:</Box> {transactionId}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>Amount:</Box> {formatPrice(amount)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>Status:</Box>{' '}
                      <Box component="span" sx={{ color: 'warning.main' }}>Pending Verification</Box>
                    </Typography>
                  </Box>
                  <Button
                    sx={{ width: '100%' }}
                    onClick={() => {
                      setShowPaymentModal(false);
                      navigate(getPostSubscriptionRedirect());
                    }}
                  >
                    Go to Dashboard
                  </Button>
                </Box>
              ) : (
                /* UPI Payment Flow */
                <Box sx={{ p: 3 }}>
                  <Stack spacing={2.5}>
                    {/* Step 1: Scan QR */}
                    <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 3, p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: 'common.white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                          }}
                        >
                          1
                        </Box>
                        <Typography sx={{ fontWeight: 600 }}>
                          Scan QR code to pay {formatPrice(amount)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#fff', borderRadius: 3 }}>
                        <Box
                          component="img"
                          src={getQrUrl(amount)}
                          alt="UPI QR Code"
                          sx={{ width: 224, height: 224 }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>
                        Open PhonePe, Google Pay, Paytm or any UPI app and scan this QR code
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center', mt: 0.5 }}>
                        UPI ID:{' '}
                        <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {upiConfig.upi_id || `${upiConfig.upi_number}@ybl`}
                        </Box>
                      </Typography>
                    </Box>

                    {/* Step 2: Enter UTR */}
                    <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 3, p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: 'common.white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                          }}
                        >
                          2
                        </Box>
                        <Typography sx={{ fontWeight: 600 }}>Enter Transaction ID / UTR</Typography>
                      </Box>
                      <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter 12-digit UTR number"
                        sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                      />
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                        Find this in your UPI app's transaction history / receipt
                      </Typography>
                    </Box>

                    <Button
                      sx={{ width: '100%', height: 48, fontSize: '1rem' }}
                      onClick={handlePaymentSubmit}
                      disabled={loading || !transactionId.trim()}
                    >
                      {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              border: 2,
                              borderColor: alpha(theme.palette.common.white, 0.3),
                              borderTopColor: 'common.white',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                              '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' },
                              },
                            }}
                          />
                          Submitting...
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircle2 style={{ width: 20, height: 20 }} />
                          Submit Payment
                        </Box>
                      )}
                    </Button>

                    <Typography sx={{ fontSize: '0.75rem', textAlign: 'center', color: 'text.secondary' }}>
                      Your subscription will be activated after payment verification.
                    </Typography>
                  </Stack>

                  <Box
                    component="button"
                    onClick={() => setShowPaymentModal(false)}
                    sx={{
                      width: '100%',
                      mt: 2,
                      fontSize: '0.875rem',
                      color: 'text.secondary',
                      cursor: 'pointer',
                      bgcolor: 'transparent',
                      border: 'none',
                      '&:hover': { color: 'text.primary' },
                    }}
                  >
                    Cancel
                  </Box>
                </Box>
              )}
            </Box>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Feature categories for Pro plan
  const featureCategories = [
    {
      title: 'Market Intelligence',
      iconBg: { bgcolor: alpha('#10b981', 0.15), color: '#34d399' },
      features: [
        'Full Market Dashboard & Overview',
        'Real-time FII / DII Flows',
        'Market Heatmap & Breadth',
        'Sectoral Index Performance',
      ],
    },
    {
      title: 'AI & Automation',
      iconBg: { bgcolor: alpha('#8b5cf6', 0.15), color: '#a78bfa' },
      features: [
        'AI Trade Signals & Recommendations',
        'Autonomous AI Agent Trading',
        'Algo Trading Bots (Live)',
        'LTP Calculator & Trade Finder',
      ],
    },
    {
      title: 'Options & Analysis',
      iconBg: { bgcolor: alpha('#06b6d4', 0.15), color: '#22d3ee' },
      features: [
        'Options Chain & Greeks',
        'OI Analytics & Scans',
        '15+ Stock Screeners',
        'Payoff Diagrams',
      ],
    },
    {
      title: 'Tools & Tracking',
      iconBg: { bgcolor: alpha('#f59e0b', 0.15), color: '#fbbf24' },
      features: [
        'Trading Journal & Statistics',
        'Strategy Backtesting',
        'Advanced Calculators',
        'Personalized Watchlists',
      ],
    },
  ];

  const proPrice = billingCycle === 'yearly' ? PLANS.pro.yearlyPrice : PLANS.pro.monthlyPrice;
  const isCurrentlyPro = currentPlan === 'pro';

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/pricing')} path="/pricing" />
      {/* Payment Modal */}
      <PaymentModal />

      <Box sx={{ minHeight: '100vh' }}>
        {/* Subscription Required Alert */}
        {requireSubscription && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Box sx={{ maxWidth: 672, mx: 'auto', px: 2, pt: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.75,
                  borderRadius: 3,
                  bgcolor: alpha('#f59e0b', 0.1),
                  border: 1,
                  borderColor: alpha('#f59e0b', 0.3),
                  color: '#f59e0b',
                }}
              >
                <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    Subscription Required
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                    Subscribe to access all features of Money Saarthi.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}

        {/* Hero Header */}
        <Box sx={{ textAlign: 'center', pt: 5, pb: 3, px: 2 }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.75,
                py: 0.75,
                borderRadius: 20,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                fontSize: '0.75rem',
                fontWeight: 600,
                mb: 2.5,
                border: 1,
                borderColor: alpha(theme.palette.primary.main, 0.2),
              }}
            >
              <Sparkles style={{ width: 14, height: 14 }} />
              One plan. Everything unlocked.
            </Box>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Typography
              sx={{
                fontSize: { xs: '1.875rem', md: '2.25rem' },
                fontWeight: 800,
                mb: 1.5,
                letterSpacing: '-0.025em',
              }}
            >
              Money Saarthi{' '}
              <Box
                component="span"
                sx={{
                  background: `linear-gradient(to right, ${theme.palette.primary.main}, #34d399, ${theme.palette.primary.main})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Pro
              </Box>
            </Typography>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', maxWidth: 448, mx: 'auto' }}>
              AI-powered market intelligence, real-time analytics, algo trading bots —
              everything a serious trader needs, in one subscription.
            </Typography>
          </motion.div>
        </Box>

        {/* Pricing Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Box sx={{ maxWidth: 512, mx: 'auto', px: 2, mb: 5 }}>
            <Card
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderColor: alpha(theme.palette.primary.main, 0.4),
                boxShadow: `0 25px 50px -12px ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              {/* Glow accents */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -96,
                  right: -96,
                  width: 192,
                  height: 192,
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                  borderRadius: '50%',
                  filter: 'blur(48px)',
                  pointerEvents: 'none',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -96,
                  left: -96,
                  width: 192,
                  height: 192,
                  bgcolor: alpha('#10b981', 0.1),
                  borderRadius: '50%',
                  filter: 'blur(48px)',
                  pointerEvents: 'none',
                }}
              />

              {isCurrentlyPro && (
                <Box sx={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
                  <Box
                    sx={{
                      bgcolor: 'success.main',
                      color: 'common.white',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      px: 1.5,
                      py: 0.5,
                      borderBottomLeftRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <BadgeCheck style={{ width: 12, height: 12 }} />
                    ACTIVE
                  </Box>
                </Box>
              )}

              <CardContent sx={{ position: 'relative', p: 3 }}>
                {/* Billing toggle */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      p: 0.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.common.white, 0.04),
                      border: 1,
                      borderColor: alpha(theme.palette.common.white, 0.08),
                    }}
                  >
                    <Box
                      component="button"
                      onClick={() => setBillingCycle('monthly')}
                      sx={{
                        px: 2,
                        py: 0.75,
                        borderRadius: 1.5,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        border: 'none',
                        ...(billingCycle === 'monthly'
                          ? {
                              bgcolor: 'primary.main',
                              color: 'common.white',
                              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                            }
                          : {
                              bgcolor: 'transparent',
                              color: 'text.secondary',
                              '&:hover': { color: 'text.primary' },
                            }),
                      }}
                    >
                      Monthly
                    </Box>
                    <Box
                      component="button"
                      onClick={() => setBillingCycle('yearly')}
                      sx={{
                        px: 2,
                        py: 0.75,
                        borderRadius: 1.5,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        ...(billingCycle === 'yearly'
                          ? {
                              bgcolor: 'primary.main',
                              color: 'common.white',
                              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                            }
                          : {
                              bgcolor: 'transparent',
                              color: 'text.secondary',
                              '&:hover': { color: 'text.primary' },
                            }),
                      }}
                    >
                      Yearly
                      <Box
                        component="span"
                        sx={{
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          bgcolor: alpha('#22c55e', 0.2),
                          color: '#4ade80',
                          border: 1,
                          borderColor: alpha('#22c55e', 0.3),
                        }}
                      >
                        -53%
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Price */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.75 }}>
                    <Typography sx={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
                      {formatPrice(proPrice)}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </Typography>
                  </Box>
                  <AnimatePresence mode="wait">
                    {billingCycle === 'yearly' ? (
                      <motion.div
                        key="yearly-save"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: '#4ade80',
                            mt: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Star style={{ width: 12, height: 12 }} />
                          Save {formatPrice(899 * 12 - 4999)} vs monthly &bull; Just {formatPrice(Math.round(4999 / 12))}/mo
                        </Typography>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="monthly-hint"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.75 }}>
                          or {formatPrice(4999)}/year — save 53%
                        </Typography>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>

                {/* CTA */}
                <Button
                  onClick={() => handleSubscribe('pro')}
                  disabled={loading || isCurrentlyPro}
                  sx={{
                    width: '100%',
                    height: 48,
                    fontSize: '1rem',
                    background: `linear-gradient(to right, ${theme.palette.primary.main}, #059669)`,
                    '&:hover': {
                      background: `linear-gradient(to right, ${alpha(theme.palette.primary.main, 0.9)}, #047857)`,
                    },
                    boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.25)}`,
                    mb: 2,
                  }}
                >
                  {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          border: 2,
                          borderColor: alpha(theme.palette.common.white, 0.3),
                          borderTopColor: 'common.white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          '@keyframes spin': {
                            '0%': { transform: 'rotate(0deg)' },
                            '100%': { transform: 'rotate(360deg)' },
                          },
                        }}
                      />
                      Processing...
                    </Box>
                  ) : isCurrentlyPro ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BadgeCheck style={{ width: 20, height: 20 }} />
                      You're a Pro Member
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Crown style={{ width: 20, height: 20 }} />
                      Subscribe Now
                      <ArrowRight style={{ width: 20, height: 20 }} />
                    </Box>
                  )}
                </Button>

                <Typography sx={{ textAlign: 'center', fontSize: '0.6875rem', color: 'text.secondary' }}>
                  7-day money-back guarantee &bull; Cancel anytime &bull; Instant access
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </motion.div>

        {/* Feature Categories Grid */}
        <Box sx={{ maxWidth: 672, mx: 'auto', px: 2, pb: 5 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, textAlign: 'center', mb: 3 }}>
              Everything included in Pro
            </Typography>
          </motion.div>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {featureCategories.map((cat, ci) => (
              <motion.div
                key={ci}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + ci * 0.07 }}
              >
                <Card
                  sx={{
                    height: '100%',
                    borderColor: alpha(theme.palette.common.white, 0.06),
                    transition: 'border-color 0.2s',
                    '&:hover': {
                      borderColor: alpha(theme.palette.common.white, 0.12),
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ...cat.iconBg,
                        }}
                      >
                        <Zap style={{ width: 16, height: 16 }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
                        {cat.title}
                      </Typography>
                    </Box>
                    <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                      {cat.features.map((f, fi) => (
                        <Box
                          component="li"
                          key={fi}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                          }}
                        >
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              bgcolor: alpha('#22c55e', 0.15),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Check style={{ width: 10, height: 10, color: '#22c55e' }} />
                          </Box>
                          {f}
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>
        </Box>

        {/* Trust Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Box sx={{ maxWidth: 672, mx: 'auto', px: 2, pb: 5 }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                py: 2,
                px: 3,
                borderRadius: 3,
                border: 1,
                borderColor: alpha(theme.palette.common.white, 0.06),
                bgcolor: alpha(theme.palette.common.white, 0.02),
              }}
            >
              {[
                { icon: Shield, text: 'SSL Encrypted Payments' },
                { icon: Clock, text: 'Instant Activation' },
                { icon: Star, text: '7-Day Refund Guarantee' },
                { icon: Users, text: 'Trusted by Traders' },
              ].map((item, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  <item.icon style={{ width: 14, height: 14, color: theme.palette.primary.main }} />
                  <Typography component="span" sx={{ fontSize: '0.75rem' }}>
                    {item.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </motion.div>

        {/* FAQ */}
        <Box sx={{ maxWidth: 576, mx: 'auto', px: 2, pb: 8 }}>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, textAlign: 'center', mb: 2.5 }}>
            Frequently Asked Questions
          </Typography>
          <Stack spacing={1.5}>
            {[
              {
                q: 'Can I cancel my subscription anytime?',
                a: 'Yes. Cancel anytime — you keep access until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'UPI via any app — PhonePe, Google Pay, Paytm, or banking apps. Scan QR, pay, and enter the transaction ID.',
              },
              {
                q: 'How long does payment verification take?',
                a: 'Most payments are verified within a few hours. You\'ll get full access once confirmed.',
              },
              {
                q: 'Is there a refund policy?',
                a: '7-day money-back guarantee. Not satisfied? Contact us within 7 days for a full refund.',
              },
              {
                q: 'What happens when my subscription expires?',
                a: 'Dashboard stays accessible with limited features. Your data is preserved — upgrade again anytime.',
              },
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.05 }}
              >
                <Card sx={{ borderColor: alpha(theme.palette.common.white, 0.06) }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                      {faq.q}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.6 }}>
                      {faq.a}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Stack>
        </Box>
      </Box>
    </PageLayout>
  );
}
