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
// UPI details fetched from backend (admin can change anytime)
const DEFAULT_UPI = { upi_number: '9818856552', payee_name: 'mspay', upi_id: 'gpay-11206998739@okbizaxis' };

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
    if (!transactionId.trim()) {
      alert('Please enter the Transaction ID / UTR Number');
      return;
    }

    setLoading(true);
    const amount = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;

    try {
      // Submit to backend for admin verification
      await fetchWithAuth('/payment/upi/submit', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: billingCycle === 'yearly' ? 'yearly' : 'monthly',
          utr_number: transactionId.trim(),
          amount,
        }),
      });
    } catch {
      // Even if backend fails, continue
    }

    updateUser(user?.email, {
      plan: 'pro',
      billingCycle,
      subscriptionStatus: 'pending',
    });

    setPaymentSubmitted(true);
    setLoading(false);
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
                  <p className="text-sm text-foreground-muted">
                    {selectedPlan.name} Plan - {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{formatPrice(amount)}</p>
                  <p className="text-xs text-foreground-muted">
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
                <p className="text-foreground-muted mb-4">
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
                    <p className="text-xs text-foreground-muted mt-3 text-center">
                      Open PhonePe, Google Pay, Paytm or any UPI app and scan this QR code
                    </p>
                    <p className="text-xs text-foreground-muted text-center mt-1">
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
                    <p className="text-xs text-foreground-muted mt-2">
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

                  <p className="text-xs text-center text-foreground-muted">
                    Your subscription will be activated after payment verification.
                  </p>
                </div>

                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full mt-4 text-sm text-foreground-muted hover:text-foreground"
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

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/pricing')} path="/pricing" />
      {/* Payment Modal */}
      <PaymentModal />
      
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        {/* Subscription Required Alert */}
        {requireSubscription && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto px-4 pt-6"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Subscription Required</p>
                <p className="text-sm text-amber-400">Please subscribe to access all features of Money Saarthi. Choose a plan below to continue.</p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Header */}
        <div className="text-center pt-12 pb-8 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            Simple, transparent pricing
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Unlock Your Trading
            <span className="text-gradient block">Potential</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-foreground-muted text-lg max-w-2xl mx-auto"
          >
            Choose the plan that fits your trading journey. Upgrade anytime to access 
            premium features and take your trading to the next level.
          </motion.p>
        </div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex items-center gap-4 p-1.5 rounded-xl bg-card border border-border">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                'px-6 py-2.5 rounded-lg font-medium transition-all',
                billingCycle === 'monthly'
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                'px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2',
                billingCycle === 'yearly'
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              Yearly
              <Badge variant="success" className="text-xs">Save 53%</Badge>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid md:grid-cols-2 gap-8">
            {Object.values(PLANS).map((plan, index) => {
              const Icon = plan.icon;
              const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
              const isCurrentPlan = currentPlan === plan.id;
              const isPro = plan.id === 'pro';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <Card
                    className={cn(
                      'relative overflow-hidden h-full',
                      plan.popular && 'border-primary shadow-xl shadow-primary/20',
                      isCurrentPlan && 'ring-2 ring-primary'
                    )}
                  >
                    {/* Popular Badge */}
                    {plan.popular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-primary text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                          MOST POPULAR
                        </div>
                      </div>
                    )}

                    {/* Current Plan Badge */}
                    {isCurrentPlan && (
                      <div className="absolute top-0 left-0">
                        <div className="bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-br-lg flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" />
                          CURRENT PLAN
                        </div>
                      </div>
                    )}

                    <CardContent className="p-8">
                      {/* Plan Header */}
                      <div className="flex items-start gap-4 mb-6">
                        <div className={cn(
                          'w-14 h-14 rounded-2xl flex items-center justify-center',
                          isPro ? 'bg-primary/20 text-primary' : 'bg-slate-500/20 text-slate-400'
                        )}>
                          <Icon className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{plan.name}</h3>
                          <p className="text-foreground-muted text-sm">{plan.description}</p>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-8">
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-bold">
                            {price === 0 ? 'Free' : formatPrice(price)}
                          </span>
                          {price > 0 && (
                            <span className="text-foreground-muted">
                              /{billingCycle === 'yearly' ? 'year' : 'month'}
                            </span>
                          )}
                        </div>
                        {isPro && billingCycle === 'yearly' && (
                          <p className="text-sm text-green-500 mt-2 flex items-center gap-1">
                            <Star className="w-4 h-4" />
                            Save {formatPrice(899 * 12 - 4999)} compared to monthly
                          </p>
                        )}
                        {isPro && billingCycle === 'monthly' && (
                          <p className="text-sm text-foreground-muted mt-2">
                            or {formatPrice(4999)}/year (save 53%)
                          </p>
                        )}
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={loading || isCurrentPlan || !isPro}
                        className={cn(
                          'w-full mb-8 h-12 text-base',
                          isPro 
                            ? 'bg-primary hover:bg-primary/90' 
                            : 'bg-slate-600 opacity-50 cursor-not-allowed'
                        )}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processing...
                          </span>
                        ) : isCurrentPlan && isPro ? (
                          <span className="flex items-center gap-2">
                            <BadgeCheck className="w-5 h-5" />
                            Current Plan
                          </span>
                        ) : !isPro ? (
                          <span className="flex items-center gap-2">
                            Subscription Required
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Get Started
                            <ArrowRight className="w-5 h-5" />
                          </span>
                        )}
                      </Button>

                      {/* Features List */}
                      <div className="space-y-4">
                        <p className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
                          {isPro ? 'All features included:' : 'Features NOT available:'}
                        </p>
                        <ul className="space-y-3">
                          {plan.features.map((feature, i) => (
                            <li
                              key={i}
                              className={cn(
                                'flex items-center gap-3 text-sm',
                                !feature.included && 'text-foreground-muted'
                              )}
                            >
                              {feature.included ? (
                                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                  <Check className="w-3 h-3 text-green-500" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-500/20 flex items-center justify-center flex-shrink-0">
                                  <X className="w-3 h-3 text-slate-500" />
                                </div>
                              )}
                              {feature.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="max-w-4xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, label: 'Secure Payments', desc: 'SSL Encrypted' },
              { icon: Clock, label: 'Instant Access', desc: 'Start immediately' },
              { icon: Users, label: '10K+ Traders', desc: 'Trust us' },
              { icon: Star, label: 'Cancel Anytime', desc: 'No lock-in' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-foreground-muted">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel my subscription anytime?',
                a: 'Yes, you can cancel your subscription at any time. You will continue to have access until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept UPI payments via any app — PhonePe, Google Pay, Paytm, or any banking UPI app. Just pay to our number and enter the transaction ID.',
              },
              {
                q: 'How long does payment verification take?',
                a: 'Most payments are verified within a few hours. You will receive access once your payment is confirmed.',
              },
              {
                q: 'Is there a refund policy?',
                a: 'We offer a 7-day money-back guarantee. If you are not satisfied, contact us within 7 days for a full refund.',
              },
              {
                q: 'What happens when my subscription expires?',
                a: 'Your account will be downgraded to the Free plan. Your data will be preserved, and you can upgrade again anytime.',
              },
            ].map((faq, i) => (
              <Card key={i} className="glass">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-sm text-foreground-muted">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

