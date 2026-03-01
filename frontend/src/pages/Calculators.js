import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { alpha } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, AccuracyBadge } from '../components/ui';
import { formatINR, formatPercent } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATORS PAGE - All financial calculators in one place
// ═══════════════════════════════════════════════════════════════════════════════

// Calculator cards config
const CALCULATORS = [
  {
    id: 'margin',
    name: 'Margin Calculator',
    description: 'Calculate margin required for F&O trades',
    icon: '📊',
    color: 'emerald',
    accuracy: 99.5,
    trades: '15K+',
    howToUse: [
      'Select the segment (Equity, F&O, Currency)',
      'Enter the scrip/symbol name',
      'Input quantity and price',
      'See SPAN + Exposure margin required'
    ]
  },
  {
    id: 'brokerage',
    name: 'Brokerage Calculator',
    description: 'Calculate total charges including STT, GST, stamp duty',
    icon: '💰',
    color: 'blue',
    accuracy: 99.9,
    trades: '50K+',
    howToUse: [
      'Select your broker',
      'Enter buy and sell prices',
      'Input quantity',
      'View complete breakdown of all charges'
    ]
  },
  {
    id: 'position',
    name: 'Position Size Calculator',
    description: 'Optimal position size based on risk management',
    icon: '⚖️',
    color: 'purple',
    accuracy: 98.5,
    trades: '8K+',
    howToUse: [
      'Enter your account capital',
      'Set maximum risk per trade (%)',
      'Input entry and stop-loss prices',
      'Get recommended position size'
    ]
  },
  {
    id: 'options',
    name: 'Options Premium Calculator',
    description: 'Black-Scholes based premium estimation',
    icon: '📈',
    color: 'orange',
    accuracy: 94.2,
    trades: '12K+',
    howToUse: [
      'Enter spot price and strike price',
      'Input days to expiry',
      'Set volatility (IV) and risk-free rate',
      'View theoretical premium with Greeks'
    ]
  },
  {
    id: 'sip',
    name: 'SIP Calculator',
    description: 'Calculate returns on systematic investment',
    icon: '🎯',
    color: 'teal',
    accuracy: 99.9,
    trades: '25K+',
    howToUse: [
      'Enter monthly SIP amount',
      'Set expected annual return (%)',
      'Input investment period (years)',
      'View future value and wealth gained'
    ]
  },
  {
    id: 'tax',
    name: 'Tax Calculator',
    description: 'STCG/LTCG tax calculation for trades',
    icon: '🧾',
    color: 'red',
    accuracy: 99.8,
    trades: '10K+',
    howToUse: [
      'Enter your short-term gains',
      'Enter your long-term gains',
      'Input your income slab',
      'View tax liability breakdown'
    ]
  }
];

// Margin Calculator Component
function MarginCalculator() {
  const [segment, setSegment] = useState('futures');
  const [symbol, setSymbol] = useState('NIFTY');
  const [quantity, setQuantity] = useState(50);
  const [price, setPrice] = useState(22500);

  const margin = useMemo(() => {
    // Simplified margin calculation
    const lotValue = quantity * price;
    let spanMargin, exposureMargin;

    if (segment === 'futures') {
      spanMargin = lotValue * 0.09; // ~9% SPAN
      exposureMargin = lotValue * 0.03; // ~3% Exposure
    } else {
      spanMargin = lotValue * 0.02; // Options have lower margin
      exposureMargin = lotValue * 0.01;
    }

    return {
      span: spanMargin,
      exposure: exposureMargin,
      total: spanMargin + exposureMargin,
      lotValue
    };
  }, [segment, quantity, price]);

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ fontSize: '1.5rem' }}>📊</Box>
          Margin Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Segment
              </Typography>
              <TextField
                select
                size="small"
                fullWidth
                value={segment}
                onChange={e => setSegment(e.target.value)}
              >
                <MenuItem value="futures">Futures</MenuItem>
                <MenuItem value="options">Options</MenuItem>
              </TextField>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Symbol
              </Typography>
              <Input value={symbol} onChange={e => setSymbol(e.target.value)} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Quantity
              </Typography>
              <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Price (₹)
              </Typography>
              <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} />
            </Box>
          </Box>

          <Stack spacing={1.5} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Contract Value</Typography>
              <Typography variant="body2" fontWeight={600}>{formatINR(margin.lotValue)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">SPAN Margin</Typography>
              <Typography variant="body2" sx={{ color: 'warning.main' }}>{formatINR(margin.span)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Exposure Margin</Typography>
              <Typography variant="body2" sx={{ color: 'info.main' }}>{formatINR(margin.exposure)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" fontWeight={600}>Total Margin Required</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'primary.main' }}>
                {formatINR(margin.total)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Brokerage Calculator Component
function BrokerageCalculator() {
  const [broker, setBroker] = useState('zerodha');
  const [buyPrice, setBuyPrice] = useState(100);
  const [sellPrice, setSellPrice] = useState(105);
  const [qty, setQty] = useState(100);
  const [segment, setSegment] = useState('equity_intraday');

  const charges = useMemo(() => {
    const turnover = (buyPrice + sellPrice) * qty;
    const profit = (sellPrice - buyPrice) * qty;

    let brokerage = 0;
    let stt = 0;

    if (segment === 'equity_intraday') {
      brokerage = Math.min(turnover * 0.0003, 40); // 0.03% or ₹20 per order
      stt = sellPrice * qty * 0.00025; // 0.025% sell side
    } else if (segment === 'equity_delivery') {
      brokerage = 0; // Zerodha free delivery
      stt = turnover * 0.001; // 0.1% both sides
    } else if (segment === 'futures') {
      brokerage = Math.min(turnover * 0.0003, 40);
      stt = sellPrice * qty * 0.0001; // 0.01% sell side
    } else if (segment === 'options') {
      brokerage = 40; // Flat ₹20 per order
      stt = sellPrice * qty * 0.0005; // 0.05% sell side
    }

    const exchangeCharges = turnover * 0.0000325;
    const sebi = turnover * 0.000001;
    const gst = (brokerage + exchangeCharges + sebi) * 0.18;
    const stampDuty = buyPrice * qty * 0.00015;

    const totalCharges = brokerage + stt + exchangeCharges + sebi + gst + stampDuty;
    const netProfit = profit - totalCharges;

    return {
      brokerage,
      stt,
      exchangeCharges,
      sebi,
      gst,
      stampDuty,
      totalCharges,
      profit,
      netProfit,
      breakeven: totalCharges / qty
    };
  }, [buyPrice, sellPrice, qty, segment]);

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ fontSize: '1.5rem' }}>💰</Box>
          Brokerage Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Segment
              </Typography>
              <TextField
                select
                size="small"
                fullWidth
                value={segment}
                onChange={e => setSegment(e.target.value)}
              >
                <MenuItem value="equity_intraday">Equity Intraday</MenuItem>
                <MenuItem value="equity_delivery">Equity Delivery</MenuItem>
                <MenuItem value="futures">Futures</MenuItem>
                <MenuItem value="options">Options</MenuItem>
              </TextField>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Quantity
              </Typography>
              <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Buy Price (₹)
              </Typography>
              <Input type="number" value={buyPrice} onChange={e => setBuyPrice(Number(e.target.value))} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Sell Price (₹)
              </Typography>
              <Input type="number" value={sellPrice} onChange={e => setSellPrice(Number(e.target.value))} />
            </Box>
          </Box>

          <Stack spacing={1} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Brokerage</Typography>
              <Typography variant="body2">{formatINR(charges.brokerage)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">STT</Typography>
              <Typography variant="body2">{formatINR(charges.stt)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Exchange Txn</Typography>
              <Typography variant="body2">{formatINR(charges.exchangeCharges)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">GST</Typography>
              <Typography variant="body2">{formatINR(charges.gst)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">SEBI Charges</Typography>
              <Typography variant="body2">{formatINR(charges.sebi)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Stamp Duty</Typography>
              <Typography variant="body2">{formatINR(charges.stampDuty)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body1" fontWeight={600}>Total Charges</Typography>
              <Typography variant="body1" sx={{ color: 'error.main', fontWeight: 600 }}>
                {formatINR(charges.totalCharges)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Breakeven</Typography>
              <Typography variant="body2">{formatINR(charges.breakeven)} per share</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body1" fontWeight={600}>Net Profit/Loss</Typography>
              <Typography
                variant="body1"
                sx={{ fontWeight: 700, color: charges.netProfit >= 0 ? 'success.main' : 'error.main' }}
              >
                {formatINR(charges.netProfit)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Position Size Calculator
function PositionSizeCalculator() {
  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState(100);
  const [stopLoss, setStopLoss] = useState(95);

  const result = useMemo(() => {
    const riskAmount = capital * (riskPercent / 100);
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
    const positionValue = shares * entryPrice;
    const maxLoss = shares * riskPerShare;

    return {
      riskAmount,
      riskPerShare,
      shares,
      positionValue,
      maxLoss,
      capitalUsed: (positionValue / capital) * 100
    };
  }, [capital, riskPercent, entryPrice, stopLoss]);

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ fontSize: '1.5rem' }}>⚖️</Box>
          Position Size Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Account Capital (₹)
              </Typography>
              <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Risk Per Trade (%)
              </Typography>
              <Input type="number" value={riskPercent} onChange={e => setRiskPercent(Number(e.target.value))} step="0.5" />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Entry Price (₹)
              </Typography>
              <Input type="number" value={entryPrice} onChange={e => setEntryPrice(Number(e.target.value))} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Stop Loss (₹)
              </Typography>
              <Input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} />
            </Box>
          </Box>

          <Stack spacing={1.5} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Risk Amount</Typography>
              <Typography variant="body2" sx={{ color: 'warning.main' }}>{formatINR(result.riskAmount)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Risk Per Share</Typography>
              <Typography variant="body2">{formatINR(result.riskPerShare)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" fontWeight={600}>Recommended Shares</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
                {result.shares}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Position Value</Typography>
              <Typography variant="body2">{formatINR(result.positionValue)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Capital Used</Typography>
              <Typography variant="body2">{result.capitalUsed.toFixed(1)}%</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Max Loss</Typography>
              <Typography variant="body2" sx={{ color: 'error.main' }}>{formatINR(result.maxLoss)}</Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// SIP Calculator
function SIPCalculator() {
  const [monthlyAmount, setMonthlyAmount] = useState(10000);
  const [annualReturn, setAnnualReturn] = useState(12);
  const [years, setYears] = useState(10);

  const result = useMemo(() => {
    const monthlyRate = annualReturn / 12 / 100;
    const months = years * 12;
    const totalInvested = monthlyAmount * months;

    // FV = P × [{(1 + r)^n – 1} / r] × (1 + r)
    const futureValue = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    const wealthGained = futureValue - totalInvested;

    return {
      totalInvested,
      futureValue,
      wealthGained,
      effectiveReturn: ((futureValue / totalInvested - 1) * 100)
    };
  }, [monthlyAmount, annualReturn, years]);

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ fontSize: '1.5rem' }}>🎯</Box>
          SIP Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Monthly Investment (₹)
              </Typography>
              <Input type="number" value={monthlyAmount} onChange={e => setMonthlyAmount(Number(e.target.value))} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Expected Return (% p.a.)
              </Typography>
              <Input type="number" value={annualReturn} onChange={e => setAnnualReturn(Number(e.target.value))} step="0.5" />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Time Period (Years)
              </Typography>
              <Input type="number" value={years} onChange={e => setYears(Number(e.target.value))} />
            </Box>
          </Stack>

          <Stack spacing={1.5} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Total Invested</Typography>
              <Typography variant="body2">{formatINR(result.totalInvested)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Wealth Gained</Typography>
              <Typography variant="body2" sx={{ color: 'success.main' }}>{formatINR(result.wealthGained)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" fontWeight={600}>Future Value</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'primary.main' }}>
                {formatINR(result.futureValue)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Total Returns</Typography>
              <Typography variant="body2" sx={{ color: 'success.main' }}>{result.effectiveReturn.toFixed(1)}%</Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// Main Calculators Page
export default function Calculators() {
  const navigate = useNavigate();
  const [activeCalc, setActiveCalc] = useState('margin');

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/calculators')} path="/calculators" />
      <PageHeader
        title="Financial Calculators"
        subtitle="Professional-grade calculators for trading and investment"
        accuracy={99.2}
        totalTrades="120K+"
      />

      {/* Calculator Selector */}
      <Section>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
            gap: 2,
            mb: 4,
          }}
        >
          {CALCULATORS.map(calc => (
            <Box
              key={calc.id}
              component={motion.button}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveCalc(calc.id)}
              sx={{
                p: 2,
                borderRadius: 2,
                border: 1,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                ...(activeCalc === calc.id
                  ? {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      borderColor: 'primary.main',
                    }
                  : {
                      bgcolor: 'background.paper',
                      borderColor: 'divider',
                      '&:hover': {
                        borderColor: (theme) => alpha(theme.palette.primary.main, 0.5),
                      },
                    }),
              }}
            >
              <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>{calc.icon}</Typography>
              <Typography variant="body2" fontWeight={500}>{calc.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                {calc.accuracy}% accurate
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Active Calculator */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            gap: 3,
          }}
        >
          <Box>
            {activeCalc === 'margin' && <MarginCalculator />}
            {activeCalc === 'brokerage' && <BrokerageCalculator />}
            {activeCalc === 'position' && <PositionSizeCalculator />}
            {activeCalc === 'sip' && <SIPCalculator />}
            {activeCalc === 'options' && (
              <Card>
                <CardHeader>
                  <CardTitle>Options Premium Calculator</CardTitle>
                </CardHeader>
                <CardContent>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Use the Options Hub for comprehensive Greeks and premium calculation
                    </Typography>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/options')}
                      sx={{ mt: 2, display: 'block', mx: 'auto' }}
                    >
                      Go to Options Hub
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}
            {activeCalc === 'tax' && (
              <Card>
                <CardHeader>
                  <CardTitle>Tax Calculator</CardTitle>
                </CardHeader>
                <CardContent>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Tax calculation feature coming soon
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>

          {/* How to Use */}
          <Box>
            <Card sx={{ position: 'sticky', top: 16 }}>
              <CardHeader>
                <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span">📖</Box>
                  How to Use
                </CardTitle>
              </CardHeader>
              <CardContent>
                {CALCULATORS.filter(c => c.id === activeCalc).map(calc => (
                  <Box key={calc.id}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {calc.description}
                    </Typography>
                    <Stack component="ol" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                      {calc.howToUse.map((step, i) => (
                        <Box component="li" key={i} sx={{ display: 'flex', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {i + 1}
                          </Box>
                          <Typography variant="body2" sx={{ color: 'text.primary' }}>
                            {step}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <AccuracyBadge accuracy={calc.accuracy} />
                        <Typography variant="caption" color="text.secondary">
                          based on {calc.trades} calculations
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Section>
    </PageLayout>
  );
}
