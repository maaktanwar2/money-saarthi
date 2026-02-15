// Options Hub — Black-Scholes Greeks Calculator
import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { Card, Input, Select } from '../ui';

const GreeksCalculator = () => {
  const [inputs, setInputs] = useState({
    spotPrice: 24000,
    strikePrice: 24000,
    daysToExpiry: 7,
    volatility: 15,
    riskFreeRate: 6.5,
    optionType: 'CE',
  });
  
  const [greeks, setGreeks] = useState(null);

  useEffect(() => {
    const { spotPrice, strikePrice, daysToExpiry, volatility, riskFreeRate, optionType } = inputs;
    if (daysToExpiry <= 0 || spotPrice <= 0 || strikePrice <= 0) return;
    const T = daysToExpiry / 365;
    const sigma = volatility / 100;
    const r = riskFreeRate / 100;
    const S = spotPrice;
    const K = strikePrice;

    const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const cdf = (x) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
    const pdf = (x) => Math.exp(-Math.pow(x, 2) / 2) / Math.sqrt(2 * Math.PI);
    
    const delta = optionType === 'CE' ? cdf(d1) : cdf(d1) - 1;
    const gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
    const theta = -(S * sigma * pdf(d1)) / (2 * Math.sqrt(T)) / 365;
    const vega = S * Math.sqrt(T) * pdf(d1) / 100;

    let price;
    if (optionType === 'CE') {
      price = S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
    } else {
      price = K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
    }

    setGreeks({
      delta: delta.toFixed(4),
      gamma: gamma.toFixed(6),
      theta: theta.toFixed(2),
      vega: vega.toFixed(4),
      premium: Math.max(0.01, price).toFixed(2),
    });
  }, [inputs]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Option Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Spot Price</label>
            <Input type="number" value={inputs.spotPrice} onChange={(e) => setInputs({ ...inputs, spotPrice: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Strike Price</label>
            <Input type="number" value={inputs.strikePrice} onChange={(e) => setInputs({ ...inputs, strikePrice: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Days to Expiry</label>
            <Input type="number" value={inputs.daysToExpiry} onChange={(e) => setInputs({ ...inputs, daysToExpiry: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">IV (%)</label>
            <Input type="number" value={inputs.volatility} onChange={(e) => setInputs({ ...inputs, volatility: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Risk-Free Rate (%)</label>
            <Input type="number" value={inputs.riskFreeRate} onChange={(e) => setInputs({ ...inputs, riskFreeRate: +e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Option Type</label>
            <Select value={inputs.optionType} onChange={(e) => setInputs({ ...inputs, optionType: e.target.value })}>
              <option value="CE">Call (CE)</option>
              <option value="PE">Put (PE)</option>
            </Select>
          </div>
        </div>
      </Card>

      {greeks && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-xs text-foreground-muted mb-1">Delta (Δ)</div>
            <p className="text-2xl font-bold">{greeks.delta}</p>
            <p className="text-xs text-foreground-muted">Price sensitivity</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-foreground-muted mb-1">Gamma (Γ)</div>
            <p className="text-2xl font-bold">{greeks.gamma}</p>
            <p className="text-xs text-foreground-muted">Delta change rate</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-foreground-muted mb-1">Theta (Θ)</div>
            <p className="text-2xl font-bold text-bearish">{greeks.theta}</p>
            <p className="text-xs text-foreground-muted">Time decay/day</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-foreground-muted mb-1">Vega (ν)</div>
            <p className="text-2xl font-bold">{greeks.vega}</p>
            <p className="text-xs text-foreground-muted">IV sensitivity</p>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-foreground-muted mb-1">Premium</div>
            <p className="text-2xl font-bold text-primary">₹{greeks.premium}</p>
            <p className="text-xs text-foreground-muted">Theoretical value</p>
          </Card>
        </div>
      )}

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Understanding Greeks</h4>
            <ul className="text-sm text-foreground-muted space-y-1">
              <li>• <strong>Delta:</strong> How much option price changes for ₹1 spot move</li>
              <li>• <strong>Gamma:</strong> Rate of change of Delta (acceleration)</li>
              <li>• <strong>Theta:</strong> Time decay - value lost per day</li>
              <li>• <strong>Vega:</strong> Sensitivity to 1% change in IV</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GreeksCalculator;
