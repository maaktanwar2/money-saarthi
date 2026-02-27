import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { cn } from '../lib/utils';
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Complete Payment</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlan.name} Plan - {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{formatPrice(amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {billingCycle === 'yearly' ? 'per year' : 'per month'}
                  </p>
                </div>
              </div>
            </div>

            {paymentSubmitted ? (
              /* Success State */
              <div className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Payment Details Submitted!</h3>
                <p className="text-muted-foreground mb-4">
                  Your payment is being verified. You'll get access within a few hours.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
                  <p className="text-sm"><strong>Transaction ID:</strong> {transactionId}</p>
                  <p className="text-sm"><strong>Amount:</strong> {formatPrice(amount)}</p>
                  <p className="text-sm"><strong>Status:</strong> <span className="text-amber-500">Pending Verification</span></p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowPaymentModal(false);
                    navigate(getPostSubscriptionRedirect());
                  }}
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              /* UPI Payment Flow */
              <div className="p-6">
                <div className="space-y-4">
                  {/* Step 1: Scan QR */}
                  <div className="bg-muted/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
                      <p className="font-semibold">Scan QR code to pay {formatPrice(amount)}</p>
                    </div>
                    <div className="flex justify-center p-4 bg-white rounded-xl">
                      <img
                        src={getQrUrl(amount)}
                        alt="UPI QR Code"
                        className="w-56 h-56"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Open PhonePe, Google Pay, Paytm or any UPI app and scan this QR code
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      UPI ID: <span className="font-mono font-semibold">{upiConfig.upi_id || `${upiConfig.upi_number}@ybl`}</span>
                    </p>
                  </div>

                  {/* Step 2: Enter UTR */}
                  <div className="bg-muted/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">2</div>
                      <p className="font-semibold">Enter Transaction ID / UTR</p>
                    </div>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter 12-digit UTR number"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Find this in your UPI app's transaction history / receipt
                    </p>
                  </div>

                  <Button
                    className="w-full h-12 text-base"
                    onClick={handlePaymentSubmit}
                    disabled={loading || !transactionId.trim()}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Submit Payment
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Your subscription will be activated after payment verification.
                  </p>
                </div>

                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Feature categories for Pro plan
  const featureCategories = [
    {
      title: 'Market Intelligence',
      color: 'from-emerald-500 to-green-600',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      features: [
        'Full Market Dashboard & Overview',
        'Real-time FII / DII Flows',
        'Market Heatmap & Breadth',
        'Sectoral Index Performance',
      ],
    },
    {
      title: 'AI & Automation',
      color: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-500/15 text-violet-400',
      features: [
        'AI Trade Signals & Recommendations',
        'Autonomous AI Agent Trading',
        'Algo Trading Bots (Live)',
        'LTP Calculator & Trade Finder',
      ],
    },
    {
      title: 'Options & Analysis',
      color: 'from-cyan-500 to-blue-600',
      iconBg: 'bg-cyan-500/15 text-cyan-400',
      features: [
        'Options Chain & Greeks',
        'OI Analytics & Scans',
        '15+ Stock Screeners',
        'Payoff Diagrams',
      ],
    },
    {
      title: 'Tools & Tracking',
      color: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-500/15 text-amber-400',
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

      <div className="min-h-screen">
        {/* Subscription Required Alert */}
        {requireSubscription && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto px-4 pt-4"
          >
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Subscription Required</p>
                <p className="text-xs text-amber-400">Subscribe to access all features of Money Saarthi.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Hero Header ── */}
        <div className="text-center pt-10 pb-6 px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            One plan. Everything unlocked.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight"
          >
            Money Saarthi{' '}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-primary bg-clip-text text-transparent">
              Pro
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm max-w-md mx-auto"
          >
            AI-powered market intelligence, real-time analytics, algo trading bots — 
            everything a serious trader needs, in one subscription.
          </motion.p>
        </div>

        {/* ── Pricing Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="max-w-lg mx-auto px-4 mb-10"
        >
          <Card className="relative overflow-hidden border-primary/40 shadow-2xl shadow-primary/10">
            {/* Glow accents */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {isCurrentlyPro && (
              <div className="absolute top-0 right-0 z-10">
                <div className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" />
                  ACTIVE
                </div>
              </div>
            )}

            <CardContent className="relative p-6">
              {/* Billing toggle — inline */}
              <div className="flex items-center justify-center mb-6">
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-xs font-semibold transition-all',
                      billingCycle === 'monthly'
                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                      billingCycle === 'yearly'
                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Yearly
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      -53%
                    </span>
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-5xl font-extrabold tracking-tight">
                    {formatPrice(proPrice)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                <AnimatePresence mode="wait">
                  {billingCycle === 'yearly' ? (
                    <motion.p
                      key="yearly-save"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-green-400 mt-1.5 flex items-center justify-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Save {formatPrice(899 * 12 - 4999)} vs monthly &bull; Just {formatPrice(Math.round(4999 / 12))}/mo
                    </motion.p>
                  ) : (
                    <motion.p
                      key="monthly-hint"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-muted-foreground mt-1.5"
                    >
                      or {formatPrice(4999)}/year — save 53%
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* CTA */}
              <Button
                onClick={() => handleSubscribe('pro')}
                disabled={loading || isCurrentlyPro}
                className="w-full h-12 text-base bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-700 shadow-lg shadow-primary/25 mb-4"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : isCurrentlyPro ? (
                  <span className="flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5" />
                    You're a Pro Member
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Crown className="w-5 h-5" />
                    Subscribe Now
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                7-day money-back guarantee &bull; Cancel anytime &bull; Instant access
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Feature Categories Grid ── */}
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-lg font-bold text-center mb-6"
          >
            Everything included in Pro
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featureCategories.map((cat, ci) => (
              <motion.div
                key={ci}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + ci * 0.07 }}
              >
                <Card className="h-full border-white/[0.06] hover:border-white/[0.12] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cat.iconBg)}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold">{cat.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {cat.features.map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 h-4 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                            <Check className="w-2.5 h-2.5 text-green-500" />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Trust Strip ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-3xl mx-auto px-4 pb-10"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 py-4 px-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {[
              { icon: Shield, text: 'SSL Encrypted Payments' },
              { icon: Clock, text: 'Instant Activation' },
              { icon: Star, text: '7-Day Refund Guarantee' },
              { icon: Users, text: 'Trusted by Traders' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <item.icon className="w-3.5 h-3.5 text-primary" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── FAQ ── */}
        <div className="max-w-2xl mx-auto px-4 pb-16">
          <h2 className="text-lg font-bold text-center mb-5">Frequently Asked Questions</h2>
          <div className="space-y-3">
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
                <Card className="border-white/[0.06]">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-1">{faq.q}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

