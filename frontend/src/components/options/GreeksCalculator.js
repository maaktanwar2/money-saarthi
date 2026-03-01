// Options Hub — Black-Scholes Greeks Calculator
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { alpha, useTheme } from '@mui/material/styles';
import { Info } from 'lucide-react';
import { Card, Input, Select, MenuItem } from '../ui';

const GreeksCalculator = () => {
  const theme = useTheme();

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Option Parameters
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Spot Price
            </Typography>
            <Input type="number" value={inputs.spotPrice} onChange={(e) => setInputs({ ...inputs, spotPrice: +e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Strike Price
            </Typography>
            <Input type="number" value={inputs.strikePrice} onChange={(e) => setInputs({ ...inputs, strikePrice: +e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Days to Expiry
            </Typography>
            <Input type="number" value={inputs.daysToExpiry} onChange={(e) => setInputs({ ...inputs, daysToExpiry: +e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              IV (%)
            </Typography>
            <Input type="number" value={inputs.volatility} onChange={(e) => setInputs({ ...inputs, volatility: +e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Risk-Free Rate (%)
            </Typography>
            <Input type="number" value={inputs.riskFreeRate} onChange={(e) => setInputs({ ...inputs, riskFreeRate: +e.target.value })} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Option Type
            </Typography>
            <Select value={inputs.optionType} onChange={(e) => setInputs({ ...inputs, optionType: e.target.value })}>
              <MenuItem value="CE">Call (CE)</MenuItem>
              <MenuItem value="PE">Put (PE)</MenuItem>
            </Select>
          </Box>
        </Box>
      </Card>

      {greeks && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 2,
          }}
        >
          <Card sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Delta ({'\u0394'})
            </Typography>
            <Typography variant="h5" fontWeight={700}>{greeks.delta}</Typography>
            <Typography variant="caption" color="text.secondary">Price sensitivity</Typography>
          </Card>
          <Card sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Gamma ({'\u0393'})
            </Typography>
            <Typography variant="h5" fontWeight={700}>{greeks.gamma}</Typography>
            <Typography variant="caption" color="text.secondary">Delta change rate</Typography>
          </Card>
          <Card sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Theta ({'\u0398'})
            </Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: 'error.main' }}>
              {greeks.theta}
            </Typography>
            <Typography variant="caption" color="text.secondary">Time decay/day</Typography>
          </Card>
          <Card sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Vega ({'\u03BD'})
            </Typography>
            <Typography variant="h5" fontWeight={700}>{greeks.vega}</Typography>
            <Typography variant="caption" color="text.secondary">IV sensitivity</Typography>
          </Card>
          <Card sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Premium
            </Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>
              {'\u20B9'}{greeks.premium}
            </Typography>
            <Typography variant="caption" color="text.secondary">Theoretical value</Typography>
          </Card>
        </Box>
      )}

      <Card
        sx={{
          p: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          borderColor: (t) => alpha(t.palette.primary.main, 0.2),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Info style={{ width: 20, height: 20, color: theme.palette.primary.main, marginTop: 2 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Understanding Greeks
            </Typography>
            <Box component="ul" sx={{ pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Delta:</strong> How much option price changes for {'\u20B9'}1 spot move
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Gamma:</strong> Rate of change of Delta (acceleration)
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Theta:</strong> Time decay - value lost per day
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                {'\u2022'} <strong>Vega:</strong> Sensitivity to 1% change in IV
              </Typography>
            </Box>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default GreeksCalculator;
