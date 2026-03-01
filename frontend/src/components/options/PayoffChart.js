// Options Hub — Interactive Payoff Chart / Strategy Builder
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Input, Select, MenuItem
} from '../ui';
import { TradingAreaChart } from '../ui/Charts';
import { formatINR, formatNumber } from '../../lib/utils';

const PayoffChart = ({ symbol, spotPrice: initialSpot }) => {
  const theme = useTheme();

  const [legs, setLegs] = useState([
    { type: 'call', strike: 0, premium: 100, quantity: 1 }
  ]);
  const [spotPrice, setSpotPrice] = useState(initialSpot || 24000);
  const [payoffData, setPayoffData] = useState([]);

  useEffect(() => {
    const step = spotPrice > 5000 ? 50 : 25;
    const range = step * 30;
    const prices = [];
    for (let p = spotPrice - range; p <= spotPrice + range; p += step) prices.push(p);

    const data = prices.map(price => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const strike = leg.strike || spotPrice;
        const premium = leg.premium || 0;
        const qty = leg.quantity || 0;
        const lotSize = symbol === 'BANKNIFTY' ? 30 : symbol === 'FINNIFTY' ? 60 : 65;

        let intrinsic = 0;
        if (leg.type === 'call') intrinsic = Math.max(0, price - strike);
        else intrinsic = Math.max(0, strike - price);

        totalPnl += (intrinsic - premium) * qty * lotSize;
      });
      return { price, pnl: Math.round(totalPnl) };
    });
    setPayoffData(data);
  }, [legs, spotPrice, symbol]);

  const addLeg = () => {
    setLegs([...legs, { type: 'call', strike: spotPrice, premium: 50, quantity: -1 }]);
  };

  const removeLeg = (index) => {
    if (legs.length > 1) setLegs(legs.filter((_, i) => i !== index));
  };

  const updateLeg = (index, field, value) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], [field]: value };
    setLegs(updated);
  };

  const maxProfit = Math.max(...payoffData.map(d => d.pnl));
  const maxLoss = Math.min(...payoffData.map(d => d.pnl));
  const breakevens = payoffData.filter((d, i) => {
    if (i === 0) return false;
    return (payoffData[i - 1].pnl < 0 && d.pnl >= 0) || (payoffData[i - 1].pnl >= 0 && d.pnl < 0);
  }).map(d => d.price);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Strategy Legs */}
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Strategy Legs</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">Spot:</Typography>
              <Input
                type="number"
                value={spotPrice}
                onChange={(e) => setSpotPrice(+e.target.value)}
                sx={{ width: 112 }}
              />
            </Box>
            <Button variant="outline" size="sm" onClick={addLeg}>+ Add Leg</Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {legs.map((leg, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: (t) => alpha(t.palette.action.hover, 0.08),
              }}
            >
              <Box sx={{ width: 96 }}>
                <Select value={leg.type} onChange={(e) => updateLeg(i, 'type', e.target.value)}>
                  <MenuItem value="call">Call</MenuItem>
                  <MenuItem value="put">Put</MenuItem>
                </Select>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.625rem' }}>
                  Strike
                </Typography>
                <Input
                  type="number"
                  value={leg.strike || spotPrice}
                  onChange={(e) => updateLeg(i, 'strike', +e.target.value)}
                  sx={{ width: 96 }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.625rem' }}>
                  Premium
                </Typography>
                <Input
                  type="number"
                  value={leg.premium}
                  onChange={(e) => updateLeg(i, 'premium', +e.target.value)}
                  sx={{ width: 80 }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.625rem' }}>
                  Qty ({'\u00B1'})
                </Typography>
                <Input
                  type="number"
                  value={leg.quantity}
                  onChange={(e) => updateLeg(i, 'quantity', +e.target.value)}
                  sx={{ width: 80 }}
                />
              </Box>
              <Badge variant={leg.quantity > 0 ? 'success' : 'destructive'}>
                {leg.quantity > 0 ? 'BUY' : 'SELL'}
              </Badge>
              {legs.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLeg(i)}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                >
                  {'\u00D7'}
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </Card>

      {/* Strategy Metrics */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        <Card sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Max Profit</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'success.main' }}>
            {maxProfit >= 999999 ? 'Unlimited' : formatINR(maxProfit)}
          </Typography>
        </Card>
        <Card sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Max Loss</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'error.main' }}>
            {maxLoss <= -999999 ? 'Unlimited' : formatINR(maxLoss)}
          </Typography>
        </Card>
        <Card sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Breakeven(s)</Typography>
          <Typography variant="h6" fontWeight={700}>
            {breakevens.length > 0 ? breakevens.map(b => formatNumber(b)).join(', ') : 'N/A'}
          </Typography>
        </Card>
        <Card sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Risk-Reward</Typography>
          <Typography variant="h6" fontWeight={700}>
            {maxLoss !== 0 ? Math.abs(maxProfit / maxLoss).toFixed(2) + 'x' : '\u221E'}
          </Typography>
        </Card>
      </Box>

      {/* Payoff Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Payoff at Expiry</CardTitle>
          <CardDescription>P&L across underlying prices</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingAreaChart data={payoffData} dataKey="pnl" xAxisKey="price" height={300} />
        </CardContent>
      </Card>
    </Box>
  );
};

export default PayoffChart;
