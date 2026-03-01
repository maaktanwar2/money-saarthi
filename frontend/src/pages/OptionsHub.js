// Options Hub - Real-time Options chain, Greeks, OI analytics, IV Skew, Payoff charts
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Clock } from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, Badge, Select, MenuItem } from '../components/ui';
import { fetchAPI, isMarketHours } from '../lib/utils';

// Sub-components
import { INDICES, TOOLS } from '../components/options/constants';
import OptionsChain from '../components/options/OptionsChain';
import OIAnalysis from '../components/options/OIAnalysis';
import IVSkewAnalysis from '../components/options/IVSkewAnalysis';
import PayoffChart from '../components/options/PayoffChart';
import GreeksCalculator from '../components/options/GreeksCalculator';

const OptionsHub = () => {
  const theme = useTheme();

  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState([]);
  const [activeTool, setActiveTool] = useState('chain');
  const [spotPrice, setSpotPrice] = useState(0);

  const handleChainLoaded = useCallback((expiryDates, currentExpiry) => {
    if (expiryDates?.length > 0) {
      setExpiries(expiryDates);
      if (!expiry || !expiryDates.includes(expiry)) {
        setExpiry(currentExpiry || expiryDates[0]);
      }
    }
  }, [expiry]);

  useEffect(() => {
    const fetchExpiries = async () => {
      try {
        const response = await fetchAPI(`/options/chain/${encodeURIComponent(symbol)}`);
        if (response?.expiryDates) {
          setExpiries(response.expiryDates);
          setExpiry(response.currentExpiry || response.expiryDates[0] || '');
          setSpotPrice(response.spotPrice || 0);
        }
      } catch { /* Chain will retry via onChainLoaded */ }
    };
    fetchExpiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/options')} path="/options" />
      <PageHeader
        title="Options Lab"
        description="Real-time options analysis with live data"
        badge="Live"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Options Lab' },
        ]}
      />

      <Section sx={{ mb: 3 }}>
        <Card sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
            }}
          >
            {/* Index Selector */}
            <Box sx={{ width: { xs: '100%', md: 192 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Index
              </Typography>
              <Select
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value); setExpiry(''); setExpiries([]); }}
              >
                {INDICES.map((idx) => (
                  <MenuItem key={idx.value} value={idx.value}>{idx.label}</MenuItem>
                ))}
              </Select>
            </Box>

            {/* Expiry Selector */}
            <Box sx={{ width: { xs: '100%', md: 192 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Expiry
              </Typography>
              <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {expiries.length === 0 && <MenuItem value="">Loading...</MenuItem>}
                {expiries.map((exp) => (
                  <MenuItem key={exp} value={exp}>{exp}</MenuItem>
                ))}
              </Select>
            </Box>

            {/* Market Status Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { md: 1 } }}>
              {isMarketHours() ? (
                <Badge variant="success">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Wifi style={{ width: 12, height: 12, animation: 'pulse 2s infinite' }} />
                    Market Open - Auto-refresh ON
                  </Box>
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    Market Closed
                  </Box>
                </Badge>
              )}
            </Box>

            {/* Tool Selector */}
            <Box sx={{ flex: 1, width: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Tool
              </Typography>
              <ToggleButtonGroup
                value={activeTool}
                exclusive
                onChange={(_, val) => { if (val) setActiveTool(val); }}
                size="small"
                sx={{
                  flexWrap: 'wrap',
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    px: 1.5,
                    py: 0.75,
                    gap: 0.75,
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                    },
                  },
                }}
              >
                {TOOLS.map((tool) => (
                  <ToggleButton key={tool.id} value={tool.id}>
                    <tool.icon style={{ width: 16, height: 16 }} />
                    {tool.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Card>
      </Section>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTool}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTool === 'chain' && <OptionsChain symbol={symbol} expiry={expiry} onChainLoaded={handleChainLoaded} />}
          {activeTool === 'oi-analysis' && <OIAnalysis symbol={symbol} />}
          {activeTool === 'iv-skew' && <IVSkewAnalysis symbol={symbol} />}
          {activeTool === 'greeks' && <GreeksCalculator />}
          {activeTool === 'payoff' && <PayoffChart symbol={symbol} spotPrice={spotPrice} />}
        </motion.div>
      </AnimatePresence>
    </PageLayout>
  );
};

export default OptionsHub;
