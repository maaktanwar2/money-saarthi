import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageLayout, PageHeader } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../components/ui';
import { cn } from '../lib/utils';
import { addTransaction, updateUser, getPaymentConfig } from '../services/adminService';
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
  Smartphone,
  Building2,
  QrCode,
  Copy,
  CheckCircle2,
  Wallet,
  IndianRupee,
  AlertCircle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING PAGE - Subscription Plans
// ═══════════════════════════════════════════════════════════════════════════════

// Default Payment Configuration (loaded from admin settings)
const DEFAULT_PAYMENT_CONFIG = {
  upiId: '',
  merchantName: 'Money Saarthi',
  bankDetails: {
    accountName: 'Money Saarthi',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  },
  phonepeNumber: '',
  gpayNumber: '',
  paytmNumber: '',
  whatsappNumber: '',
  razorpayKey: '',
  razorpayEnabled: false,
};

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
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [transactionId, setTransactionId] = useState('');
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [copied, setCopied] = useState('');
  const [paymentConfig, setPaymentConfig] = useState(DEFAULT_PAYMENT_CONFIG);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('ms_user') || 'null');
    setUser(storedUser);
    if (storedUser?.subscription?.plan) {
      setCurrentPlan(storedUser.subscription.plan);
    }
    // Load payment config from admin settings
    const savedConfig = getPaymentConfig();
    setPaymentConfig({ ...DEFAULT_PAYMENT_CONFIG, ...savedConfig });
  }, []);

  // Load Razorpay script (optional)
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

  // Copy to clipboard helper
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  // Generate UPI payment link
  const generateUPILink = (amount) => {
    const upiUrl = `upi://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Money Saarthi Pro - ${billingCycle}`)}`;
    return upiUrl;
  };

  // Open payment app directly
  const openPaymentApp = (app, amount) => {
    let url = '';
    const note = encodeURIComponent(`Money Saarthi Pro - ${billingCycle}`);
    
    switch(app) {
      case 'phonepe':
        url = `phonepe://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.merchantName)}&am=${amount}&cu=INR&tn=${note}`;
        break;
      case 'gpay':
        url = `gpay://upi/pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.merchantName)}&am=${amount}&cu=INR&tn=${note}`;
        break;
      case 'paytm':
        url = `paytmmp://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.merchantName)}&am=${amount}&cu=INR&tn=${note}`;
        break;
      default:
        url = generateUPILink(amount);
    }
    
    window.location.href = url;
  };

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

    // Open payment modal instead of direct Razorpay
    setSelectedPlan(PLANS[planId]);
    setShowPaymentModal(true);
    setPaymentSubmitted(false);
    setTransactionId('');
  };

  // Handle manual payment submission
  const handleManualPaymentSubmit = () => {
    if (!transactionId.trim()) {
      alert('Please enter the Transaction ID / UTR Number');
      return;
    }

    setLoading(true);

    const amount = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
    
    // Record pending transaction
    addTransaction({
      user: user?.name || 'Unknown',
      email: user?.email,
      amount: amount,
      plan: `Pro ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
      status: 'pending',
      paymentMethod: paymentMethod,
      transactionId: transactionId,
      notes: 'Pending verification',
    });

    // Update user with pending status
    updateUser(user?.email, {
      plan: 'pro',
      billingCycle: billingCycle,
      subscriptionStatus: 'pending',
    });

    setPaymentSubmitted(true);
    setLoading(false);
  };

  // Handle Razorpay payment (optional)
  const handleRazorpayPayment = () => {
    const amount = billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
    const amountInPaise = amount * 100;

    const options = {
      key: paymentConfig.razorpayKey,
      amount: amountInPaise,
      currency: 'INR',
      name: 'Money Saarthi',
      description: `${selectedPlan.name} Plan - ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
      image: '/logo.png',
      handler: function (response) {
        const expiresAt = new Date();
        if (billingCycle === 'yearly') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        saveSubscription({
          plan: selectedPlan.id,
          status: 'active',
          expiresAt: expiresAt.toISOString(),
          billingCycle: billingCycle,
          paymentId: response.razorpay_payment_id,
          subscribedAt: new Date().toISOString(),
        });

        addTransaction({
          user: user?.name || 'Unknown',
          email: user?.email,
          amount: amount,
          plan: `Pro ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
          status: 'success',
          paymentId: response.razorpay_payment_id,
          paymentMethod: 'razorpay',
        });

        updateUser(user?.email, {
          plan: 'pro',
          billingCycle: billingCycle,
          revenue: amount,
        });

        setCurrentPlan(selectedPlan.id);
        setShowPaymentModal(false);
        alert('🎉 Payment successful! Welcome to Money Saarthi Pro!');
        navigate(getPostSubscriptionRedirect());
      },
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
      },
      theme: { color: '#10b981' },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    try {
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Razorpay Error:', error);
      alert('Payment initialization failed. Please use another payment method.');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Payment methods configuration (dynamically filter based on config)
  const paymentMethods = [
    { id: 'upi', name: 'UPI / QR Code', icon: QrCode, description: 'Pay via any UPI app' },
    { id: 'phonepe', name: 'PhonePe', icon: Smartphone, description: 'Pay with PhonePe' },
    { id: 'gpay', name: 'Google Pay', icon: Wallet, description: 'Pay with GPay' },
    { id: 'paytm', name: 'Paytm', icon: Smartphone, description: 'Pay with Paytm' },
    { id: 'bank', name: 'Bank Transfer', icon: Building2, description: 'Direct bank transfer' },
    ...(paymentConfig.razorpayEnabled ? [{ id: 'razorpay', name: 'Card / Netbanking', icon: CreditCard, description: 'Cards, Netbanking, Wallets' }] : []),
  ];

  // Payment Modal Component
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
                  Your payment is being verified. You'll receive confirmation within 24 hours.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
                  <p className="text-sm"><strong>Transaction ID:</strong> {transactionId}</p>
                  <p className="text-sm"><strong>Amount:</strong> {formatPrice(amount)}</p>
                  <p className="text-sm"><strong>Method:</strong> {paymentMethods.find(m => m.id === paymentMethod)?.name}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  For faster verification, send screenshot to WhatsApp:
                </p>
                <a
                  href={`https://wa.me/${paymentConfig.whatsappNumber}?text=Payment%20for%20Money%20Saarthi%20Pro%0ATransaction%20ID:%20${transactionId}%0AAmount:%20${amount}%0AEmail:%20${user?.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  <Smartphone className="w-5 h-5" />
                  Send on WhatsApp
                </a>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    setShowPaymentModal(false);
                    navigate(getPostSubscriptionRedirect());
                  }}
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              /* Payment Form */
              <div className="p-6">
                {/* Payment Method Selection */}
                <div className="mb-6">
                  <label className="text-sm font-medium mb-3 block">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id)}
                          className={cn(
                            'p-3 rounded-xl border text-left transition-all',
                            paymentMethod === method.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={cn(
                              'w-5 h-5',
                              paymentMethod === method.id ? 'text-primary' : 'text-muted-foreground'
                            )} />
                            <span className="font-medium text-sm">{method.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* UPI / QR Code Payment */}
                {paymentMethod === 'upi' && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4 text-center">
                      <div className="w-48 h-48 mx-auto bg-white rounded-xl p-2 mb-3">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(generateUPILink(amount))}`}
                          alt="UPI QR Code"
                          className="w-full h-full"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">Scan with any UPI app</p>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <span className="flex-1 text-sm font-mono truncate">{paymentConfig.upiId}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(paymentConfig.upiId, 'upi')}
                      >
                        {copied === 'upi' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => window.location.href = generateUPILink(amount)}
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      Open UPI App
                    </Button>
                  </div>
                )}

                {/* PhonePe / GPay / Paytm */}
                {['phonepe', 'gpay', 'paytm'].includes(paymentMethod) && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4 text-center">
                      <div className={cn(
                        'w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center',
                        paymentMethod === 'phonepe' && 'bg-purple-500/20 text-purple-500',
                        paymentMethod === 'gpay' && 'bg-blue-500/20 text-blue-500',
                        paymentMethod === 'paytm' && 'bg-cyan-500/20 text-cyan-500'
                      )}>
                        <IndianRupee className="w-10 h-10" />
                      </div>
                      <p className="font-semibold text-lg">{formatPrice(amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {paymentMethod === 'phonepe' && `PhonePe: ${paymentConfig.phonepeNumber}`}
                        {paymentMethod === 'gpay' && `Google Pay: ${paymentConfig.gpayNumber}`}
                        {paymentMethod === 'paytm' && `Paytm: ${paymentConfig.paytmNumber}`}
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => openPaymentApp(paymentMethod, amount)}
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      Open {paymentMethod === 'phonepe' ? 'PhonePe' : paymentMethod === 'gpay' ? 'Google Pay' : 'Paytm'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      If app doesn't open, pay manually to the number above
                    </p>
                  </div>
                )}

                {/* Bank Transfer */}
                {paymentMethod === 'bank' && (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <h4 className="font-semibold mb-3">Bank Account Details</h4>
                      {[
                        { label: 'Account Name', value: paymentConfig.bankDetails?.accountName },
                        { label: 'Account Number', value: paymentConfig.bankDetails?.accountNumber },
                        { label: 'IFSC Code', value: paymentConfig.bankDetails?.ifscCode },
                        { label: 'Bank', value: paymentConfig.bankDetails?.bankName },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">{item.value}</span>
                            <button
                              onClick={() => copyToClipboard(item.value, item.label)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {copied === item.label ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                      <strong className="text-yellow-500">Important:</strong> Transfer exactly{' '}
                      <strong>{formatPrice(amount)}</strong> and note down the UTR/Reference number.
                    </div>
                  </div>
                )}

                {/* Razorpay */}
                {paymentMethod === 'razorpay' && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-xl p-4 text-center">
                      <CreditCard className="w-12 h-12 mx-auto mb-3 text-primary" />
                      <p className="font-semibold">Pay securely with Razorpay</p>
                      <p className="text-sm text-muted-foreground">
                        Credit/Debit Cards, Net Banking, UPI, Wallets
                      </p>
                    </div>
                    <Button className="w-full" onClick={handleRazorpayPayment}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay {formatPrice(amount)} with Razorpay
                    </Button>
                  </div>
                )}

                {/* Transaction ID Input (for manual payments) */}
                {paymentMethod !== 'razorpay' && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <label className="text-sm font-medium mb-2 block">
                      After payment, enter Transaction ID / UTR Number
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter Transaction ID / UTR Number"
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <Button
                      className="w-full mt-4"
                      onClick={handleManualPaymentSubmit}
                      disabled={loading || !transactionId.trim()}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Submit Payment Details
                        </>
                      )}
                    </Button>
                  </div>
                )}

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
                a: 'We accept UPI (PhonePe, Google Pay, Paytm, any UPI app), direct bank transfer, credit/debit cards, net banking, and digital wallets.',
              },
              {
                q: 'How long does payment verification take?',
                a: 'UPI and card payments are verified instantly. Bank transfers may take up to 24 hours. Send your payment screenshot on WhatsApp for faster verification.',
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
