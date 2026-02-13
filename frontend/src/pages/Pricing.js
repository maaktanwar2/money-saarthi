import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, Button, Badge } from '../components/ui';
import { cn } from '../lib/utils';
import { addTransaction, updateUser } from '../services/adminService';
import API from '../config/api';
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
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING PAGE - Subscription Plans
// ═══════════════════════════════════════════════════════════════════════════════

// Razorpay is the only payment gateway

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
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState('');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('ms_user') || 'null');
    setUser(storedUser);
    if (storedUser?.subscription?.plan) {
      setCurrentPlan(storedUser.subscription.plan);
    }
  }, []);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
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
    setPaymentSuccess(false);
    setPaymentId('');
  };

  // Handle Razorpay payment via backend order creation
  const handleRazorpayPayment = async () => {
    if (!selectedPlan) return;
    setLoading(true);

    const planId = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;

    try {
      // Create order on backend
      const orderRes = await API.post('/payment/create-order', { plan_id: planId, amount: amount * 100 });
      const orderData = orderRes.data;

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Money Saarthi',
        description: `${selectedPlan.name} Plan - ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            // Verify on backend
            const verifyRes = await API.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              const expiresAt = verifyRes.data.subscription_end || new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 86400000).toISOString();

              saveSubscription({
                plan: selectedPlan.id,
                status: 'active',
                expiresAt,
                billingCycle,
                paymentId: response.razorpay_payment_id,
                subscribedAt: new Date().toISOString(),
              });

              addTransaction({
                user: user?.name || 'Unknown',
                email: user?.email,
                amount,
                plan: `Pro ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
                status: 'success',
                paymentId: response.razorpay_payment_id,
                paymentMethod: 'razorpay',
              });

              updateUser(user?.email, { plan: 'pro', billingCycle, revenue: amount });

              setCurrentPlan(selectedPlan.id);
              setPaymentId(response.razorpay_payment_id);
              setPaymentSuccess(true);
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch {
            alert('Payment verification failed. Please contact support.');
          }
          setLoading(false);
        },
        prefill: { name: user?.name || '', email: user?.email || '' },
        theme: { color: '#10b981' },
        modal: { ondismiss: () => setLoading(false) },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch {
      alert('Unable to initiate payment. Please try again later.');
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

  // Payment Modal Component (Razorpay only)
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

            {paymentSuccess ? (
              /* Success State */
              <div className="p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Payment Successful!</h3>
                <p className="text-muted-foreground mb-4">
                  Welcome to Money Saarthi Pro! Your subscription is now active.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
                  <p className="text-sm"><strong>Payment ID:</strong> {paymentId}</p>
                  <p className="text-sm"><strong>Amount:</strong> {formatPrice(amount)}</p>
                  <p className="text-sm"><strong>Plan:</strong> {selectedPlan.name} ({billingCycle === 'yearly' ? 'Yearly' : 'Monthly'})</p>
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
              /* Razorpay Payment */
              <div className="p-6">
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-xl p-6 text-center">
                    <CreditCard className="w-14 h-14 mx-auto mb-4 text-primary" />
                    <p className="font-semibold text-lg mb-1">Secure Payment via Razorpay</p>
                    <p className="text-sm text-muted-foreground">
                      Credit/Debit Cards, Net Banking, UPI, Wallets
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Cards', icon: '💳' },
                      { label: 'UPI', icon: '📱' },
                      { label: 'NetBanking', icon: '🏦' },
                      { label: 'Wallets', icon: '👛' },
                    ].map((m) => (
                      <div key={m.label} className="text-center p-3 rounded-lg bg-muted/30 border border-border">
                        <span className="text-xl block mb-1">{m.icon}</span>
                        <span className="text-xs text-muted-foreground">{m.label}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full h-12 text-base"
                    onClick={handleRazorpayPayment}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay {formatPrice(amount)}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Payments are secured by Razorpay. Your card details are never stored.
                  </p>
                </div>

                {/* Close button */}
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

  return (
    <PageLayout>
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
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
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
                  : 'text-muted-foreground hover:text-foreground'
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
                  : 'text-muted-foreground hover:text-foreground'
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
                          <p className="text-muted-foreground text-sm">{plan.description}</p>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-8">
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-bold">
                            {price === 0 ? 'Free' : formatPrice(price)}
                          </span>
                          {price > 0 && (
                            <span className="text-muted-foreground">
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
                          <p className="text-sm text-muted-foreground mt-2">
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
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          {isPro ? 'All features included:' : 'Features NOT available:'}
                        </p>
                        <ul className="space-y-3">
                          {plan.features.map((feature, i) => (
                            <li
                              key={i}
                              className={cn(
                                'flex items-center gap-3 text-sm',
                                !feature.included && 'text-muted-foreground'
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
                <p className="text-xs text-muted-foreground">{item.desc}</p>
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
                a: 'We accept all major payment methods via Razorpay — Credit/Debit Cards, Net Banking, UPI, and Digital Wallets. All payments are processed instantly.',
              },
              {
                q: 'How long does payment verification take?',
                a: 'All payments are verified instantly via Razorpay. Your subscription is activated immediately after successful payment.',
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
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
