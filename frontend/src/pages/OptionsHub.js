// Options Hub - Real-time Options chain, Greeks, OI analytics, IV Skew, Payoff charts
import { useState, useEffect, useCallback } from 'react';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Clock } from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, Badge, Select } from '../components/ui';
import { cn, fetchAPI, isMarketHours } from '../lib/utils';

// Sub-components
import { INDICES, TOOLS } from '../components/options/constants';
import OptionsChain from '../components/options/OptionsChain';
import OIAnalysis from '../components/options/OIAnalysis';
import IVSkewAnalysis from '../components/options/IVSkewAnalysis';
import PayoffChart from '../components/options/PayoffChart';
import GreeksCalculator from '../components/options/GreeksCalculator';

const OptionsHub = () => {
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

      <Section className="mb-6">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-full md:w-48">
              <label className="text-xs text-foreground-muted mb-1 block">Index</label>
              <Select value={symbol} onChange={(e) => { setSymbol(e.target.value); setExpiry(''); setExpiries([]); }}>
                {INDICES.map((idx) => (
                  <option key={idx.value} value={idx.value}>{idx.label}</option>
                ))}
              </Select>
            </div>
            <div className="w-full md:w-48">
              <label className="text-xs text-foreground-muted mb-1 block">Expiry</label>
              <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {expiries.length === 0 && <option value="">Loading...</option>}
                {expiries.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 md:ml-2">
              {isMarketHours() ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 animate-pulse" /> Market Open - Auto-refresh ON
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Market Closed
                </Badge>
              )}
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs text-foreground-muted mb-1 block">Tool</label>
              <div className="flex gap-1 flex-wrap">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      activeTool === tool.id
                        ? 'bg-primary text-white'
                        : 'text-foreground-muted hover:text-foreground hover:bg-surface-1'
                    )}
                  >
                    <tool.icon className="w-4 h-4" />
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
