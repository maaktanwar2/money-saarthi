/**
 * Dhan Connect Page
 * Simple broker connection to fetch and display trades, positions, holdings
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Wallet, TrendingUp, TrendingDown, RefreshCw,
  AlertCircle, CheckCircle, Eye, EyeOff, ArrowUpRight,
  Info, Package, ShieldCheck, Briefcase, History, PieChart
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Input, Spinner
} from '../components/ui';
import { cn, formatINR, fetchAPI } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// DHAN CONNECT CARD
// ═══════════════════════════════════════════════════════════════════════════════
const DhanConnectCard = ({ onConnect, isConnected, loading, error }) => {
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Load saved client ID
  useEffect(() => {
    const saved = localStorage.getItem('dhan_client_id');
    if (saved) setClientId(saved);
  }, []);

  const handleConnect = () => {
    if (!accessToken.trim()) return;
    localStorage.setItem('dhan_client_id', clientId);
    onConnect({ accessToken: accessToken.trim(), clientId: clientId.trim() });
  };

  return (
    <Card className={cn(
      "border-2 transition-colors",
      isConnected ? "border-emerald-500/50 bg-emerald-500/5" : "border-primary/30"
    )}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            isConnected ? "bg-emerald-500/20" : "bg-primary/15"
          )}>
            <Link2 className={cn("w-6 h-6", isConnected ? "text-emerald-500" : "text-primary")} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">Connect Your Dhan Account</CardTitle>
            <CardDescription>
              {isConnected ? "✅ Connected successfully!" : "Link your trading account to view your portfolio"}
            </CardDescription>
          </div>
          {isConnected && (
            <Badge className="bg-emerald-500 text-white">
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isConnected && (
          <>
            {/* Client ID */}
            <div>
              <label className="text-sm font-medium mb-2 block">Client ID</label>
              <Input
                type="text"
                placeholder="e.g., 1102137252"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="bg-secondary/50 text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">Your Dhan client/account ID</p>
            </div>

            {/* Access Token */}
            <div>
              <label className="text-sm font-medium mb-2 block">Access Token <span className="text-red-500">*</span></label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Paste your Dhan access token here"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="bg-secondary/50 pr-10 text-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* How to get Token - Step by Step */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
              <h4 className="text-base font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5" />
                How to get Access Token (FREE - Takes 30 seconds)
              </h4>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium">Open Dhan Web</p>
                    <p className="text-xs text-muted-foreground">Go to <a href="https://web.dhan.co" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">web.dhan.co</a> and login</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium">Go to Profile → Access DhanHQ APIs</p>
                    <p className="text-xs text-muted-foreground">Click your profile icon (top right) → Select "Access DhanHQ APIs"</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium">Generate Access Token</p>
                    <p className="text-xs text-muted-foreground">Click "Generate" button → Copy the token → Paste above!</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <a 
                  href="https://web.dhan.co" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Open Dhan Web
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                <a 
                  href="https://dhanhq.co/docs/v2/authentication/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground px-4 py-2"
                >
                  API Docs
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-emerald-500 mt-3 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Trading APIs are 100% FREE for all Dhan users
              </p>
            </div>

            {/* Security Note */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-500">
                  <p><strong>Your token is secure:</strong> It's only used to fetch your trades and is never stored on our servers.</p>
                  <p className="mt-1 text-xs">⚠️ Use your <strong>Production</strong> token from web.dhan.co, NOT sandbox token.</p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                    {error.includes('Invalid') && (
                      <p className="text-xs text-red-400 mt-1">
                        Make sure you're using a Production token from web.dhan.co (not Sandbox token)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Connect Button */}
            <Button 
              onClick={handleConnect} 
              disabled={!accessToken.trim() || loading}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {loading ? (
                <>
                  <Spinner className="w-5 h-5 mr-2" />
                  Connecting to Dhan...
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5 mr-2" />
                  Connect & Fetch My Trades
                </>
              )}
            </Button>
          </>
        )}

        {isConnected && (
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-emerald-500">Successfully Connected!</p>
            <p className="text-sm text-muted-foreground">Your portfolio data is loaded below</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT OVERVIEW CARD
// ═══════════════════════════════════════════════════════════════════════════════
const AccountOverview = ({ funds, isConnected }) => {
  if (!isConnected || !funds) return null;

  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-500" />
          Account Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-muted-foreground mb-1">Available Cash</p>
            <p className="text-2xl font-bold text-emerald-500">{formatINR(funds.availableBalance || 0)}</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-muted-foreground mb-1">Used Margin</p>
            <p className="text-2xl font-bold text-amber-500">{formatINR(funds.utilizedAmount || 0)}</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-muted-foreground mb-1">Collateral</p>
            <p className="text-2xl font-bold text-blue-500">{formatINR(funds.collateralAmount || 0)}</p>
          </div>
          <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
            <p className="text-2xl font-bold text-violet-500">{formatINR(funds.sodLimit || funds.availableBalance || 0)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOLDINGS TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const HoldingsTable = ({ holdings }) => {
  if (!holdings || holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Holdings
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No holdings found</p>
        </CardContent>
      </Card>
    );
  }

  const totalValue = holdings.reduce((sum, h) => sum + (h.totalMarketValue || h.buyPrice * h.quantity || 0), 0);
  const totalPnL = holdings.reduce((sum, h) => sum + (h.unrealizedPL || h.pnl || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Holdings ({holdings.length})
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="font-bold text-lg">{formatINR(totalValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total P&L</p>
              <p className={cn("font-bold text-lg", totalPnL >= 0 ? "text-emerald-500" : "text-red-500")}>
                {totalPnL >= 0 ? '+' : ''}{formatINR(totalPnL)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground">Stock</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Qty</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Avg Cost</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Current</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Value</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => {
                const pnl = h.unrealizedPL || h.pnl || ((h.lastPrice || h.currentPrice) - h.buyPrice) * h.quantity;
                const pnlPct = h.buyPrice > 0 ? ((h.lastPrice || h.currentPrice) - h.buyPrice) / h.buyPrice * 100 : 0;
                return (
                  <motion.tr
                    key={h.tradingSymbol || h.symbol || i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="py-3 px-3">
                      <div className="font-medium">{h.tradingSymbol || h.symbol}</div>
                      <div className="text-xs text-muted-foreground">{h.exchange || 'NSE'}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">{h.quantity}</td>
                    <td className="py-3 px-3 text-right">{formatINR(h.buyPrice || h.avgPrice)}</td>
                    <td className="py-3 px-3 text-right">{formatINR(h.lastPrice || h.currentPrice || h.ltp)}</td>
                    <td className="py-3 px-3 text-right font-medium">{formatINR(h.totalMarketValue || (h.lastPrice || h.currentPrice) * h.quantity)}</td>
                    <td className={cn("py-3 px-3 text-right font-medium", pnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                      <div>{pnl >= 0 ? '+' : ''}{formatINR(pnl)}</div>
                      <div className="text-xs">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// POSITIONS TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const PositionsTable = ({ positions }) => {
  if (!positions || positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-violet-500" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No open positions</p>
        </CardContent>
      </Card>
    );
  }

  const totalPnL = positions.reduce((sum, p) => sum + (p.unrealizedProfit || p.pnl || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-violet-500" />
            Open Positions ({positions.length})
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Day P&L</p>
            <p className={cn("font-bold text-lg", totalPnL >= 0 ? "text-emerald-500" : "text-red-500")}>
              {totalPnL >= 0 ? '+' : ''}{formatINR(totalPnL)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground">Symbol</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-center">Type</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Qty</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Entry</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">LTP</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pnl = p.unrealizedProfit || p.pnl || 0;
                const isBuy = p.positionType === 'LONG' || p.buyQty > p.sellQty;
                return (
                  <motion.tr
                    key={p.tradingSymbol || p.symbol || i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="py-3 px-3">
                      <div className="font-medium">{p.tradingSymbol || p.symbol}</div>
                      <div className="text-xs text-muted-foreground">{p.exchange} • {p.productType}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={isBuy ? "success" : "destructive"}>
                        {isBuy ? 'LONG' : 'SHORT'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">{p.netQty || p.quantity}</td>
                    <td className="py-3 px-3 text-right">{formatINR(p.averagePrice || p.avgPrice)}</td>
                    <td className="py-3 px-3 text-right">{formatINR(p.lastPrice || p.ltp)}</td>
                    <td className={cn("py-3 px-3 text-right font-bold", pnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TODAY'S ORDERS TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const OrdersTable = ({ orders }) => {
  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-500" />
            Today's Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No orders today</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-500" />
          Today's Orders ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground">Symbol</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-center">Side</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Qty</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-right">Price</th>
                <th className="py-3 px-3 text-sm font-medium text-muted-foreground text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 20).map((o, i) => (
                <motion.tr
                  key={o.orderId || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="py-3 px-3">
                    <div className="font-medium">{o.tradingSymbol || o.symbol}</div>
                    <div className="text-xs text-muted-foreground">{o.orderType} • {o.productType}</div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge variant={o.transactionType === 'BUY' ? "success" : "destructive"}>
                      {o.transactionType}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right font-medium">{o.quantity}</td>
                  <td className="py-3 px-3 text-right">{formatINR(o.price || o.averagePrice || 0)}</td>
                  <td className="py-3 px-3 text-center">
                    <Badge variant={
                      o.orderStatus === 'TRADED' ? 'success' :
                      o.orderStatus === 'PENDING' ? 'warning' :
                      o.orderStatus === 'REJECTED' ? 'destructive' : 'secondary'
                    }>
                      {o.orderStatus}
                    </Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const AIAdvisor = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [funds, setFunds] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);

  const handleConnect = async ({ accessToken, clientId }) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [fundsRes, holdingsRes, positionsRes, ordersRes] = await Promise.all([
        fetchAPI('/dhan/funds', { headers: { 'X-Dhan-Token': accessToken, 'X-Dhan-Client': clientId } }),
        fetchAPI('/dhan/holdings', { headers: { 'X-Dhan-Token': accessToken, 'X-Dhan-Client': clientId } }),
        fetchAPI('/dhan/positions', { headers: { 'X-Dhan-Token': accessToken, 'X-Dhan-Client': clientId } }),
        fetchAPI('/dhan/orders', { headers: { 'X-Dhan-Token': accessToken, 'X-Dhan-Client': clientId } })
      ]);

      setFunds(fundsRes.data || fundsRes);
      setHoldings(holdingsRes.data || holdingsRes || []);
      setPositions(positionsRes.data || positionsRes || []);
      setOrders(ordersRes.data || ordersRes || []);
      setIsConnected(true);
      
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect. Please check your access token and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // Trigger reconnect prompt
    setIsConnected(false);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Dhan Connect"
        description="Connect your Dhan account to view holdings, positions, and orders"
        badge="Live"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Dhan Connect' },
        ]}
        actions={
          isConnected && (
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reconnect
            </Button>
          )
        }
      />

      {/* Connection Card */}
      <Section className="mb-6">
        <DhanConnectCard
          onConnect={handleConnect}
          isConnected={isConnected}
          loading={loading}
          error={error}
        />
      </Section>

      {/* Account Overview */}
      {isConnected && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Section className="mb-6">
              <AccountOverview funds={funds} isConnected={isConnected} />
            </Section>

            {/* Holdings */}
            <Section className="mb-6">
              <HoldingsTable holdings={holdings} />
            </Section>

            {/* Positions */}
            <Section className="mb-6">
              <PositionsTable positions={positions} />
            </Section>

            {/* Orders */}
            <Section className="mb-6">
              <OrdersTable orders={orders} />
            </Section>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Not connected state info */}
      {!isConnected && !loading && (
        <Section>
          <Card className="bg-gradient-to-r from-primary/5 to-violet-500/5 border-primary/20">
            <CardContent className="py-8">
              <div className="text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">View Your Complete Portfolio</h3>
                <p className="text-muted-foreground mb-6">
                  Connect your Dhan account to see:
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-white/5">
                    <Briefcase className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium">Holdings</p>
                    <p className="text-xs text-muted-foreground">Your long-term investments</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <PieChart className="w-5 h-5 text-violet-500 mx-auto mb-2" />
                    <p className="font-medium">Positions</p>
                    <p className="text-xs text-muted-foreground">Intraday & F&O positions</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <History className="w-5 h-5 text-cyan-500 mx-auto mb-2" />
                    <p className="font-medium">Orders</p>
                    <p className="text-xs text-muted-foreground">Today's order history</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <Wallet className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p className="font-medium">Funds</p>
                    <p className="text-xs text-muted-foreground">Available balance & margin</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>
      )}
    </PageLayout>
  );
};

export default AIAdvisor;
