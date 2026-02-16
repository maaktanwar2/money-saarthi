// Options Hub — Interactive Payoff Chart / Strategy Builder
import { useState, useEffect } from 'react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge, Input, Select
} from '../ui';
import { TradingAreaChart } from '../ui/Charts';
import { formatINR, formatNumber } from '../../lib/utils';

const PayoffChart = ({ symbol, spotPrice: initialSpot }) => {
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
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Strategy Legs</h3>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Spot:</label>
              <Input type="number" value={spotPrice} onChange={(e) => setSpotPrice(+e.target.value)} className="w-28" />
            </div>
            <Button variant="outline" size="sm" onClick={addLeg}>+ Add Leg</Button>
          </div>
        </div>
        <div className="space-y-3">
          {legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
              <Select value={leg.type} onChange={(e) => updateLeg(i, 'type', e.target.value)} className="w-24">
                <option value="call">Call</option>
                <option value="put">Put</option>
              </Select>
              <div>
                <label className="text-[10px] text-muted-foreground">Strike</label>
                <Input type="number" value={leg.strike || spotPrice} onChange={(e) => updateLeg(i, 'strike', +e.target.value)} className="w-24" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Premium</label>
                <Input type="number" value={leg.premium} onChange={(e) => updateLeg(i, 'premium', +e.target.value)} className="w-20" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Qty (±)</label>
                <Input type="number" value={leg.quantity} onChange={(e) => updateLeg(i, 'quantity', +e.target.value)} className="w-20" />
              </div>
              <Badge variant={leg.quantity > 0 ? 'success' : 'destructive'} className="text-xs">
                {leg.quantity > 0 ? 'BUY' : 'SELL'}
              </Badge>
              {legs.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeLeg(i)} className="text-muted-foreground hover:text-bearish">×</Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Max Profit</div>
          <p className="text-lg font-bold text-bullish">{maxProfit >= 999999 ? 'Unlimited' : formatINR(maxProfit)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Max Loss</div>
          <p className="text-lg font-bold text-bearish">{maxLoss <= -999999 ? 'Unlimited' : formatINR(maxLoss)}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Breakeven(s)</div>
          <p className="text-lg font-bold">{breakevens.length > 0 ? breakevens.map(b => formatNumber(b)).join(', ') : 'N/A'}</p>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Risk-Reward</div>
          <p className="text-lg font-bold">{maxLoss !== 0 ? Math.abs(maxProfit / maxLoss).toFixed(2) + 'x' : '∞'}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Strategy Payoff at Expiry</CardTitle>
          <CardDescription>P&L across underlying prices</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingAreaChart data={payoffData} dataKey="pnl" xAxisKey="price" height={300} />
        </CardContent>
      </Card>
    </div>
  );
};

export default PayoffChart;
