/**
 * Token Recharge Page
 * Buy AI tokens using various payment methods
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, Package, Zap, Crown, Star, Check,
  QrCode, CheckCircle2,
  ArrowRight, History, AlertCircle,
  Brain, Target, BarChart3, ShieldCheck
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../components/ui';
import { cn, formatINR } from '../lib/utils';
import {
  getTokenBalance,
  getTokenPackages,
  rechargeTokens,
  getTokenHistory
} from '../services/tokenService';
import { fetchWithAuth } from '../config/api';

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
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        onClick={() => onSelect(pkg)}
        className={cn(
          'cursor-pointer transition-all relative overflow-hidden',
          isSelected && 'ring-2 ring-primary border-primary',
          isPopular && !isSelected && 'border-amber-500/30'
        )}
      >
        {isPopular && (
          <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
            POPULAR
          </div>
        )}
        
        <CardContent className="p-6">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
            pkg.id === 'starter' && "bg-blue-500/15 text-blue-500",
            pkg.id === 'basic' && "bg-emerald-500/15 text-emerald-500",
            pkg.id === 'pro' && "bg-violet-500/15 text-violet-500",
            pkg.id === 'unlimited' && "bg-amber-500/15 text-amber-500",
          )}>
            {getIcon()}
          </div>

          <h3 className="text-lg font-bold mb-1">{pkg.name}</h3>
          <p className="text-3xl font-bold mb-1">
            {pkg.tokens}
            <span className="text-sm text-muted-foreground ml-2">tokens</span>
          </p>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-bold text-primary">₹{pkg.price}</span>
            <span className="text-xs text-muted-foreground">
              (₹{pkg.price_per_token}/token)
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{Math.floor(pkg.tokens / 20)} Portfolio Analyses</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{Math.floor(pkg.tokens / 10)} Strategy Suggestions</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Never expires</span>
            </div>
          </div>

          <Button 
            className="w-full" 
            variant={isSelected ? 'default' : 'outline'}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Selected
              </>
            ) : (
              'Select Package'
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT MODAL (Simple UPI)
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_UPI = { upi_number: '9818856552', payee_name: 'mspay', upi_id: 'gpay-11206998739@okbizaxis' };

const PaymentModal = ({ pkg, onClose, onSuccess }) => {
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
      if (result.success) {
        setSubmitted(true);
        setTimeout(() => onSuccess(result), 1500);
      } else {
        alert(result.error || 'Submission failed. Try again.');
      }
    } catch (err) {
      alert(err.message || 'Error submitting payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg glass-strong rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">Complete Payment</h2>
          <p className="text-sm text-muted-foreground">
            {pkg.name} - {pkg.tokens} tokens for ₹{pkg.price}
          </p>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Payment Submitted!</h3>
            <p className="text-muted-foreground">Tokens will be added after verification.</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Step 1: Scan QR */}
            <div className="bg-secondary/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
                <p className="font-semibold">Scan QR code to pay ₹{pkg.price}</p>
              </div>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <img
                  src={getQrUrl()}
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
            <div className="bg-secondary/50 rounded-xl p-5">
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
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!transactionId.trim() || loading}
              className="w-full h-12 text-base"
            >
              {loading ? 'Submitting...' : 'Submit Payment'}
            </Button>

            <button onClick={onClose} className="w-full text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN USAGE HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
const TokenHistoryCard = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No token history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Token History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.slice(0, 10).map((item, i) => (
            <div 
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  item.tokens > 0 ? "bg-emerald-500/15" : "bg-red-500/15"
                )}>
                  {item.tokens > 0 ? (
                    <Coins className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Brain className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {item.type === 'purchase' ? `Purchased ${item.package}` : item.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className={cn(
                "font-bold",
                item.tokens > 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {item.tokens > 0 ? '+' : ''}{item.tokens}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TOKENS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const TokensPage = () => {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [packagesRes, balanceRes, historyRes] = await Promise.all([
          getTokenPackages(),
          getTokenBalance(),
          getTokenHistory()
        ]);
        
        setPackages(packagesRes.packages || []);
        setTokenBalance(balanceRes.balance || 0);
        setHistory(historyRes.history || []);
      } catch (err) {
        // Token data fetch failed — show defaults
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (result) => {
    setTokenBalance(result.new_balance);
    setShowPaymentModal(false);
    setSelectedPackage(null);
    // Refresh history
    getTokenHistory().then(res => setHistory(res.history || []));
  };

  return (
    <PageLayout>
      <PageHeader
        title="AI Tokens"
        description="Purchase tokens to power AI trading analysis"
        badge="Recharge"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'AI Advisor', link: '/ai-advisor' },
          { label: 'Tokens' },
        ]}
      />

      {/* Current Balance */}
      <Section className="mb-6">
        <div className="flex flex-wrap items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-primary/20 to-violet-500/20 border border-primary/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Coins className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-4xl font-bold">{tokenBalance} <span className="text-lg text-muted-foreground">tokens</span></p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-wrap gap-4 justify-end">
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-2xl font-bold">{Math.floor(tokenBalance / 20)}</p>
              <p className="text-xs text-muted-foreground">Portfolio Analyses</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-2xl font-bold">{Math.floor(tokenBalance / 10)}</p>
              <p className="text-xs text-muted-foreground">Strategy Suggestions</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-2xl font-bold">{Math.floor(tokenBalance / 5)}</p>
              <p className="text-xs text-muted-foreground">Trade Analyses</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Token Costs Info */}
      <Section className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { action: 'Portfolio Review', tokens: 20, icon: <BarChart3 className="w-5 h-5" /> },
            { action: 'Strategy Suggestion', tokens: 10, icon: <Target className="w-5 h-5" /> },
            { action: 'Risk Assessment', tokens: 8, icon: <ShieldCheck className="w-5 h-5" /> },
            { action: 'Trade Analysis', tokens: 5, icon: <Brain className="w-5 h-5" /> },
          ].map(item => (
            <Card key={item.action} className="text-center">
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3 text-primary">
                  {item.icon}
                </div>
                <p className="text-sm font-medium mb-1">{item.action}</p>
                <Badge variant="secondary">{item.tokens} tokens</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Packages */}
      <Section className="mb-6">
        <h2 className="text-xl font-bold mb-6">Choose a Package</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg, i) => (
            <TokenPackageCard
              key={pkg.id}
              pkg={pkg}
              isPopular={pkg.id === 'pro'}
              isSelected={selectedPackage?.id === pkg.id}
              onSelect={handleSelectPackage}
            />
          ))}
        </div>
      </Section>

      {/* History */}
      <Section>
        <TokenHistoryCard history={history} />
      </Section>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedPackage && (
          <PaymentModal
            pkg={selectedPackage}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedPackage(null);
            }}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default TokensPage;
