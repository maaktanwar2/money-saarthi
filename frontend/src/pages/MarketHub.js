// Market Hub - Comprehensive NSE Market Data Dashboard
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { motion } from 'framer-motion';
import {
  Activity, Users, TrendingUp, TrendingDown,
  PieChart, Layers, RefreshCw,
  Info, Building2, Globe, Flame,
  Award, AlertTriangle,
  ArrowUp, ArrowDown, Volume2, Crown
} from 'lucide-react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
  Button, Badge
} from '../components/ui';
import { formatNumber, formatPercent, fetchAPI } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE INDICES TICKER
// ═══════════════════════════════════════════════════════════════════════════════
const LiveIndicesTicker = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const data = await fetchAPI('/nse/indices');
        const allIndices = data?.all_indices || data?.data || [];
        const keyIndices = ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY FIN', 'MIDCAP', 'INDIA VIX'];
        const filtered = allIndices.filter(idx =>
          keyIndices.some(k => (idx.symbol || idx.name || '').toUpperCase().includes(k.replace(' ', '')))
        ).slice(0, 8);
        setIndices(filtered.length > 0 ? filtered : allIndices.slice(0, 8));
      } catch {
        setIndices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchIndices();
    const interval = setInterval(() => { if (!document.hidden) fetchIndices(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ overflowX: 'auto', pb: 1, mx: -1, px: 1 }}>
      <Box sx={{ display: 'flex', gap: 1.5, minWidth: 'max-content' }}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" width={144} height={80} sx={{ borderRadius: 3 }} />
          ))
        ) : (
          indices.map((idx, i) => {
            const change = idx.pChange || idx.percentChange || 0;
            const isPositive = change >= 0;
            return (
              <Box
                key={idx.name || idx.symbol || i}
                component={motion.div}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                sx={{
                  minWidth: 140,
                  p: 1.5,
                  borderRadius: 3,
                  border: 1,
                  borderColor: isPositive
                    ? alpha(theme.palette.success.main, 0.2)
                    : alpha(theme.palette.error.main, 0.2),
                  bgcolor: isPositive
                    ? alpha(theme.palette.success.main, 0.05)
                    : alpha(theme.palette.error.main, 0.05),
                  transition: 'all 0.2s ease',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    mb: 0.5,
                  }}
                >
                  {(idx.name || idx.symbol || '').replace('NIFTY ', '')}
                </Typography>
                <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
                  {formatNumber(idx.last || idx.lastPrice, { decimals: idx.last < 100 ? 2 : 0 })}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: isPositive ? 'success.main' : 'error.main',
                  }}
                >
                  {isPositive ? '+' : ''}{formatPercent(change)}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FII DII SECTION
// ═══════════════════════════════════════════════════════════════════════════════
const FIIDIISection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today');
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Pass timeframe to API
        const timeframe = view === 'today' ? 'week' : view;
        const response = await fetchAPI(`/fii-dii-data?timeframe=${timeframe}`);
        // API returns an array, get first element
        const cashData = Array.isArray(response) ? response[0] : response;
        setData({
          cash: {
            fii_buy: Number(cashData?.fii_buy) || 0,
            fii_sell: Number(cashData?.fii_sell) || 0,
            fii_net: Number(cashData?.fii_net) || 0,
            dii_buy: Number(cashData?.dii_buy) || 0,
            dii_sell: Number(cashData?.dii_sell) || 0,
            dii_net: Number(cashData?.dii_net) || 0,
          },
        });
      } catch (err) {
        console.error('FII/DII fetch error:', err);
        setData({
          cash: { fii_buy: 0, fii_sell: 0, fii_net: 0, dii_buy: 0, dii_sell: 0, dii_net: 0 },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [view]);

  if (loading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 4 }} />;

  const cash = data?.cash || {};
  const fiiNet = cash.fii_net || 0;
  const diiNet = cash.dii_net || 0;
  const totalNet = fiiNet + diiNet;

  return (
    <Card sx={{ gridColumn: { lg: 'span 2' } }}>
      <CardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Users style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
              Institutional Activity
            </CardTitle>
            <CardDescription>FII/DII cash market flows (₹ Crores)</CardDescription>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {['today', 'week', 'month'].map(v => (
              <Box
                key={v}
                component="button"
                onClick={() => setView(v)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize',
                  border: 'none',
                  cursor: 'pointer',
                  ...(view === v
                    ? { bgcolor: 'primary.main', color: '#fff' }
                    : {
                        color: 'text.secondary',
                        bgcolor: 'transparent',
                        '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                      }),
                }}
              >
                {v}
              </Box>
            ))}
          </Box>
        </Box>
      </CardHeader>
      <CardContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          {/* FII Card */}
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: 1,
              borderColor: fiiNet >= 0
                ? alpha(theme.palette.success.main, 0.2)
                : alpha(theme.palette.error.main, 0.2),
              bgcolor: fiiNet >= 0
                ? alpha(theme.palette.success.main, 0.05)
                : alpha(theme.palette.error.main, 0.05),
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', right: -16, top: -16, opacity: 0.1 }}>
              <Globe style={{ width: 96, height: 96 }} />
            </Box>
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Globe style={{ width: 16, height: 16, color: theme.palette.info.light }} />
                  FII/FPI
                </Typography>
                <Badge variant={fiiNet >= 0 ? 'success' : 'destructive'}>
                  {fiiNet >= 0 ? '↑ Buying' : '↓ Selling'}
                </Badge>
              </Box>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, mb: 1, color: fiiNet >= 0 ? 'success.main' : 'error.main' }}>
                {fiiNet >= 0 ? '+' : ''}{formatNumber(fiiNet, { decimals: 0 })} Cr
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, fontSize: '0.75rem' }}>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 'inherit' }}>Buy</Typography>
                  <Typography sx={{ fontWeight: 600, color: 'success.main', fontSize: 'inherit' }}>
                    {formatNumber(cash.fii_buy || 0, { decimals: 0 })} Cr
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 'inherit' }}>Sell</Typography>
                  <Typography sx={{ fontWeight: 600, color: 'error.main', fontSize: 'inherit' }}>
                    {formatNumber(cash.fii_sell || 0, { decimals: 0 })} Cr
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* DII Card */}
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: 1,
              borderColor: diiNet >= 0
                ? alpha(theme.palette.success.main, 0.2)
                : alpha(theme.palette.error.main, 0.2),
              bgcolor: diiNet >= 0
                ? alpha(theme.palette.success.main, 0.05)
                : alpha(theme.palette.error.main, 0.05),
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', right: -16, top: -16, opacity: 0.1 }}>
              <Building2 style={{ width: 96, height: 96 }} />
            </Box>
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Building2 style={{ width: 16, height: 16, color: theme.palette.secondary.light }} />
                  DII
                </Typography>
                <Badge variant={diiNet >= 0 ? 'success' : 'destructive'}>
                  {diiNet >= 0 ? '↑ Buying' : '↓ Selling'}
                </Badge>
              </Box>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, mb: 1, color: diiNet >= 0 ? 'success.main' : 'error.main' }}>
                {diiNet >= 0 ? '+' : ''}{formatNumber(diiNet, { decimals: 0 })} Cr
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, fontSize: '0.75rem' }}>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 'inherit' }}>Buy</Typography>
                  <Typography sx={{ fontWeight: 600, color: 'success.main', fontSize: 'inherit' }}>
                    {formatNumber(cash.dii_buy || 0, { decimals: 0 })} Cr
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 'inherit' }}>Sell</Typography>
                  <Typography sx={{ fontWeight: 600, color: 'error.main', fontSize: 'inherit' }}>
                    {formatNumber(cash.dii_sell || 0, { decimals: 0 })} Cr
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Net Flow */}
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: 1,
              borderColor: totalNet >= 0
                ? alpha(theme.palette.success.main, 0.3)
                : alpha(theme.palette.error.main, 0.3),
              background: totalNet >= 0
                ? `linear-gradient(to bottom right, ${alpha(theme.palette.success.main, 0.1)}, ${alpha(theme.palette.success.dark, 0.1)})`
                : `linear-gradient(to bottom right, ${alpha(theme.palette.error.main, 0.1)}, ${alpha(theme.palette.warning.dark, 0.1)})`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', right: -16, top: -16, opacity: 0.1 }}>
              <Layers style={{ width: 96, height: 96 }} />
            </Box>
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Layers style={{ width: 16, height: 16, color: theme.palette.primary.main }} />
                  Net Flow
                </Typography>
                <Badge variant={totalNet >= 0 ? 'success' : 'destructive'}>
                  {totalNet >= 0 ? 'BULLISH' : 'BEARISH'}
                </Badge>
              </Box>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, mb: 1, color: totalNet >= 0 ? 'success.main' : 'error.main' }}>
                {totalNet >= 0 ? '+' : ''}{formatNumber(totalNet, { decimals: 0 })} Cr
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {totalNet >= 0 ? '\u{1F7E2} Institutions net buying' : '\u{1F534} Institutions net selling'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            p: 1.5,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.2),
            fontSize: '0.875rem',
          }}
        >
          <Typography sx={{ fontWeight: 500, mb: 0.5, fontSize: 'inherit' }}>
            {'\u{1F4CA}'} Market Insight
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
            {fiiNet >= 0 && diiNet >= 0 && 'Both FII & DII buying - Strong bullish signal'}
            {fiiNet >= 0 && diiNet < 0 && 'FII buying, DII profit booking - Selective approach'}
            {fiiNet < 0 && diiNet >= 0 && 'DII support while FII exit - Domestic support'}
            {fiiNet < 0 && diiNet < 0 && 'Both selling - Defensive stance recommended'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTOR HEATMAP WITH STOCKS - F&O SECTORS
// ═══════════════════════════════════════════════════════════════════════════════
// Sector name mapping for API
const SECTOR_API_MAP = {
  'BANK': 'Banking & Financial Services',
  'PSU BANK': 'Banking & Financial Services',
  'PVT BANK': 'Banking & Financial Services',
  'FIN SERVICE': 'Banking & Financial Services',
  'IT': 'Information Technology',
  'PHARMA': 'Healthcare & Pharmaceuticals',
  'HEALTHCARE': 'Healthcare & Pharmaceuticals',
  'AUTO': 'Automobile & Auto Components',
  'FMCG': 'FMCG & Consumer',
  'METAL': 'Metals & Mining',
  'ENERGY': 'Oil, Gas & Energy',
  'OIL AND GAS': 'Oil, Gas & Energy',
  'INFRA': 'Infrastructure & Construction',
  'REALTY': 'Infrastructure & Construction',
};

// Short display names for all 12 F&O sectors
const SECTOR_SHORT_NAMES = {
  'Financial Services': 'FINANCE',
  'Information Technology': 'IT',
  'Healthcare & Pharmaceuticals': 'PHARMA',
  'Automobile & Auto Components': 'AUTO',
  'FMCG & Consumer': 'FMCG',
  'Metals & Mining': 'METAL',
  'Oil, Gas & Energy': 'ENERGY',
  'Infrastructure & Construction': 'INFRA',
  'Telecom & Media': 'TELECOM',
  'Capital Goods & Industrials': 'CAPITAL',
  'Chemicals & Fertilizers': 'CHEMICAL',
};

const SectorHeatmap = () => {
  const [sectorData, setSectorData] = useState({});
  const [selectedSector, setSelectedSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all 12 F&O sectors data with live prices
        const data = await fetchAPI('/scanners/fno-by-sector');
        setSectorData(data || {});
      } catch {
        setSectorData({});
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSectorClick = (sectorName) => {
    if (selectedSector === sectorName) {
      setSelectedSector(null);
    } else {
      setSelectedSector(sectorName);
    }
  };

  // Convert to array and sort by performance
  const sectors = Object.entries(sectorData).map(([name, data]) => ({
    name,
    pChange: data.avg_change || 0,
    trend: data.trend,
    stocks: data.stocks || []
  })).sort((a, b) => b.pChange - a.pChange);

  const maxChange = Math.max(...sectors.map(s => Math.abs(s.pChange)), 0.1);

  return (
    <Card>
      <CardHeader style={{ paddingBottom: 8 }}>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PieChart style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
          F&O Sectors
        </CardTitle>
        <CardDescription sx={{ fontSize: '0.75rem' }}>Click to view F&O stocks</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={24} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {sectors.map((sector, i) => {
              const pctChange = sector.pChange || 0;
              const isPositive = pctChange >= 0;
              const barWidth = Math.min((Math.abs(pctChange) / maxChange) * 100, 100);
              const displayName = SECTOR_SHORT_NAMES[sector.name] || sector.name;
              const isSelected = selectedSector === sector.name;

              return (
                <Box key={sector.name}>
                  <Box
                    component={motion.div}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => handleSectorClick(sector.name)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      height: 28,
                      borderRadius: 1,
                      px: 0.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      ...(isSelected
                        ? {
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
                          }
                        : {
                            '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                          }),
                    }}
                  >
                    {/* Sector Name */}
                    <Box
                      sx={{
                        width: 80,
                        textAlign: 'right',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.2s ease',
                        color: isSelected ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {displayName}
                    </Box>

                    {/* Bar Container */}
                    <Box sx={{ flex: 1, height: 20, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: 0,
                          bottom: 0,
                          width: '1px',
                          bgcolor: alpha(theme.palette.text.primary, 0.1),
                        }}
                      />
                      <Box
                        sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
                        style={{
                          justifyContent: isPositive ? 'flex-start' : 'flex-end',
                          paddingLeft: isPositive ? '50%' : 0,
                          paddingRight: isPositive ? 0 : '50%',
                        }}
                      >
                        <Box
                          component={motion.div}
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.4 }}
                          sx={{
                            height: 16,
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: 28,
                            bgcolor: isPositive ? 'success.main' : 'error.main',
                            justifyContent: isPositive ? 'flex-end' : 'flex-start',
                            px: 0.5,
                          }}
                        >
                          <Typography
                            component="span"
                            sx={{ fontSize: '10px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}
                          >
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Expanded Stocks View */}
                  {isSelected && sector.stocks.length > 0 && (
                    <Box
                      component={motion.div}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      sx={{
                        ml: 1,
                        mr: 0.5,
                        my: 0.5,
                        p: 1,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.text.primary, 0.05),
                        border: `1px solid ${alpha(theme.palette.text.primary, 0.05)}`,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
                        <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>
                          {sector.stocks.length} F&O Stocks
                        </Typography>
                        <Typography
                          component="span"
                          sx={{
                            fontSize: '10px',
                            fontWeight: 500,
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                            bgcolor: sector.trend === 'Bullish'
                              ? alpha(theme.palette.success.main, 0.2)
                              : alpha(theme.palette.error.main, 0.2),
                            color: sector.trend === 'Bullish' ? 'success.main' : 'error.main',
                          }}
                        >
                          {sector.trend}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0.5 }}>
                        {sector.stocks.slice(0, 10).map((stock) => (
                          <Box
                            key={stock.symbol}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              py: 0.5,
                              px: 1,
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  bgcolor: stock.change >= 0 ? 'success.main' : 'error.main',
                                }}
                              />
                              <Typography component="span" sx={{ fontWeight: 500, fontSize: 'inherit' }}>
                                {stock.symbol}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography component="span" sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
                                {'\u20B9'}{stock.price?.toFixed(1)}
                              </Typography>
                              <Typography
                                component="span"
                                sx={{
                                  fontWeight: 600,
                                  width: 56,
                                  textAlign: 'right',
                                  color: stock.change >= 0 ? 'success.main' : 'error.main',
                                  fontSize: 'inherit',
                                }}
                              >
                                {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)}%
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                      {sector.stocks.length > 10 && (
                        <Typography sx={{ fontSize: '10px', color: 'text.secondary', textAlign: 'center', mt: 1 }}>
                          +{sector.stocks.length - 10} more stocks
                        </Typography>
                      )}
                    </Box>
                  )}

                  {isSelected && sector.stocks.length === 0 && (
                    <Box
                      sx={{
                        ml: 1,
                        my: 0.5,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.secondary.main, 0.2),
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textAlign: 'center',
                      }}
                    >
                      No stocks data available
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET BREADTH
// ═══════════════════════════════════════════════════════════════════════════════
const MarketBreadth = () => {
  const [breadth, setBreadth] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchBreadth = async () => {
      try {
        const breadthData = await fetchAPI('/nse/market-breadth');
        setBreadth(breadthData);
      } catch {
        setBreadth({ advances: 0, declines: 0, unchanged: 0, advanceDeclineRatio: 0, newHighs: 0, newLows: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchBreadth();
  }, []);

  if (loading) return <Skeleton variant="rectangular" height={256} sx={{ borderRadius: 4 }} />;

  const total = (breadth?.advances || 0) + (breadth?.declines || 0) + (breadth?.unchanged || 0);
  const advancePercent = total > 0 ? ((breadth?.advances || 0) / total * 100) : 50;
  const adRatio = breadth?.advanceDeclineRatio || (breadth?.advances / Math.max(breadth?.declines, 1));

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Activity style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
          Market Breadth
        </CardTitle>
        <CardDescription>NSE advance/decline analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ArrowUp style={{ width: 16, height: 16, color: theme.palette.success.main }} />
              <Typography component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
                {breadth?.advances}
              </Typography>
              <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Advances
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                Declines
              </Typography>
              <Typography component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
                {breadth?.declines}
              </Typography>
              <ArrowDown style={{ width: 16, height: 16, color: theme.palette.error.main }} />
            </Box>
          </Box>

          <Box
            sx={{
              height: 24,
              borderRadius: 9999,
              bgcolor: alpha(theme.palette.error.main, 0.2),
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box
              component={motion.div}
              initial={{ width: 0 }}
              animate={{ width: `${advancePercent}%` }}
              transition={{ duration: 0.8 }}
              sx={{
                height: '100%',
                background: `linear-gradient(to right, ${theme.palette.success.main}, ${theme.palette.success.light})`,
                borderRadius: 9999,
                position: 'relative',
              }}
            >
              <Typography
                component="span"
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {advancePercent.toFixed(0)}%
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
            {breadth?.unchanged} Unchanged
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.05), textAlign: 'center' }}>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', mb: 0.5 }}>A/D Ratio</Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: adRatio > 1 ? 'success.main' : 'error.main' }}>
              {adRatio?.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.05), textAlign: 'center' }}>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', mb: 0.5 }}>52W Highs</Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'success.main' }}>
              {breadth?.newHighs || 0}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.05), textAlign: 'center' }}>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', mb: 0.5 }}>52W Lows</Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'error.main' }}>
              {breadth?.newLows || 0}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 3,
            border: 1,
            textAlign: 'center',
            ...(adRatio > 1.5
              ? {
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  borderColor: alpha(theme.palette.success.main, 0.3),
                }
              : adRatio < 0.7
                ? {
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    borderColor: alpha(theme.palette.error.main, 0.3),
                  }
                : {
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    borderColor: alpha(theme.palette.warning.main, 0.3),
                  }),
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.125rem',
              color: adRatio > 1.5
                ? 'success.main'
                : adRatio < 0.7
                  ? 'error.main'
                  : 'warning.main',
            }}
          >
            {adRatio > 1.5 ? '\u{1F680} STRONG BULLISH' : adRatio > 1.2 ? '\u{1F4C8} BULLISH' :
             adRatio > 0.8 ? '\u2696\uFE0F NEUTRAL' : adRatio > 0.5 ? '\u{1F4C9} BEARISH' : '\u{1F53B} STRONG BEARISH'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INDIA VIX
// ═══════════════════════════════════════════════════════════════════════════════
const IndiaVIX = () => {
  const [vix, setVix] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchVIX = async () => {
      try {
        const data = await fetchAPI('/nse/india-vix');
        setVix(data);
      } catch {
        setVix({ value: 0, change: 0, pChange: 0, high: 0, low: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchVIX();
  }, []);

  if (loading) return <Skeleton variant="rectangular" height={256} sx={{ borderRadius: 4 }} />;

  const vixValue = vix?.value || vix?.last || 15;

  const getVIXLevel = (value) => {
    if (value < 13) return { label: 'Very Low', emoji: '\u{1F60E}', color: theme.palette.success.light, bg: alpha(theme.palette.success.main, 0.2), desc: 'Extreme complacency' };
    if (value < 16) return { label: 'Low', emoji: '\u{1F60A}', color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.2), desc: 'Low fear - good for option sellers' };
    if (value < 20) return { label: 'Normal', emoji: '\u{1F610}', color: theme.palette.warning.light, bg: alpha(theme.palette.warning.main, 0.2), desc: 'Average volatility' };
    if (value < 25) return { label: 'Elevated', emoji: '\u{1F61F}', color: theme.palette.warning.dark, bg: alpha(theme.palette.warning.dark, 0.2), desc: 'Increased uncertainty' };
    if (value < 35) return { label: 'High', emoji: '\u{1F630}', color: theme.palette.error.light, bg: alpha(theme.palette.error.main, 0.2), desc: 'High fear' };
    return { label: 'Extreme Fear', emoji: '\u{1F631}', color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.3), desc: 'Panic selling' };
  };

  const level = getVIXLevel(vixValue);
  const vixPosition = Math.min(100, (vixValue / 40) * 100);
  const vixChange = vix?.change || 0;
  const vixPChange = vix?.pChange || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
          India VIX
        </CardTitle>
        <CardDescription>Fear & Greed Index</CardDescription>
      </CardHeader>
      <CardContent>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: '3rem' }}>{level.emoji}</Typography>
          <Typography sx={{ fontSize: '2.25rem', fontWeight: 700, mt: 1, color: level.color }}>
            {vixValue.toFixed(2)}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: vixChange > 0 ? 'success.main' : vixChange < 0 ? 'error.main' : 'text.secondary',
            }}
          >
            {vixChange >= 0 ? '+' : ''}{vixChange.toFixed(2)} ({formatPercent(vixPChange)})
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              height: 16,
              borderRadius: 9999,
              background: `linear-gradient(to right, ${theme.palette.success.main}, ${theme.palette.warning.main}, ${theme.palette.error.main})`,
              position: 'relative',
              overflow: 'visible',
            }}
          >
            <Box
              component={motion.div}
              initial={{ left: '20%' }}
              animate={{ left: `${vixPosition}%` }}
              sx={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                ml: -1.5,
                width: 24,
                height: 24,
                bgcolor: 'common.white',
                borderRadius: '50%',
                boxShadow: 3,
                border: `2px solid ${theme.palette.primary.main}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box sx={{ width: 8, height: 8, bgcolor: 'primary.main', borderRadius: '50%' }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'text.secondary', mt: 1 }}>
            <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>{'\u{1F60E}'} Greed</Typography>
            <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>{'\u{1F610}'} Neutral</Typography>
            <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>{'\u{1F631}'} Fear</Typography>
          </Box>
        </Box>

        <Box sx={{ p: 1.5, borderRadius: 3, textAlign: 'center', bgcolor: level.bg }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: level.color }}>
            {level.label}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
            {level.desc}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Day Low</Typography>
            <Typography sx={{ fontWeight: 600, color: 'success.main' }}>
              {(vix?.low || vixValue * 0.97).toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Day High</Typography>
            <Typography sx={{ fontWeight: 600, color: 'error.main' }}>
              {(vix?.high || vixValue * 1.03).toFixed(2)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP GAINERS & LOSERS
// ═══════════════════════════════════════════════════════════════════════════════
const TopMovers = () => {
  const [data, setData] = useState({ gainers: [], losers: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('gainers');
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/gainers-losers');
        setData({
          gainers: response?.gainers?.slice(0, 5) || [],
          losers: response?.losers?.slice(0, 5) || []
        });
      } catch {
        setData({ gainers: [], losers: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stocks = view === 'gainers' ? data.gainers : data.losers;

  return (
    <Card>
      <CardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Flame style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            Top Movers
          </CardTitle>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Box
              component="button"
              onClick={() => setView('gainers')}
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                border: 'none',
                cursor: 'pointer',
                ...(view === 'gainers'
                  ? { bgcolor: 'success.main', color: '#fff' }
                  : { color: 'text.secondary', bgcolor: 'transparent', '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) } }),
              }}
            >
              {'\u{1F680}'} Gainers
            </Box>
            <Box
              component="button"
              onClick={() => setView('losers')}
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: 500,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                border: 'none',
                cursor: 'pointer',
                ...(view === 'losers'
                  ? { bgcolor: 'error.main', color: '#fff' }
                  : { color: 'text.secondary', bgcolor: 'transparent', '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) } }),
              }}
            >
              {'\u{1F4C9}'} Losers
            </Box>
          </Box>
        </Box>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {stocks.map((stock, i) => {
              const change = stock.pChange || 0;
              const isPositive = change >= 0;
              return (
                <Box
                  key={stock.symbol}
                  component={motion.div}
                  initial={{ opacity: 0, x: isPositive ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: 3,
                    border: 1,
                    borderColor: isPositive
                      ? alpha(theme.palette.success.main, 0.2)
                      : alpha(theme.palette.error.main, 0.2),
                    bgcolor: isPositive
                      ? alpha(theme.palette.success.main, 0.05)
                      : alpha(theme.palette.error.main, 0.05),
                    transition: 'all 0.2s ease',
                    '&:hover': { transform: 'scale(1.02)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        bgcolor: isPositive
                          ? alpha(theme.palette.success.main, 0.2)
                          : alpha(theme.palette.error.main, 0.2),
                        color: isPositive ? 'success.main' : 'error.main',
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 500 }}>{stock.symbol}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {'\u20B9'}{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      textAlign: 'right',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 2,
                      fontWeight: 600,
                      bgcolor: isPositive
                        ? alpha(theme.palette.success.main, 0.2)
                        : alpha(theme.palette.error.main, 0.2),
                      color: isPositive ? 'success.main' : 'error.main',
                    }}
                  >
                    {isPositive ? '+' : ''}{formatPercent(change)}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP DELIVERIES - Shows stocks with high delivery percentage
// ═══════════════════════════════════════════════════════════════════════════════
const TopDeliveries = () => {
  const [data, setData] = useState({ high: [], low: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('high');
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/market/delivery-data');
        setData({
          high: response?.high_delivery || response?.all_stocks?.slice(0, 15) || [],
          low: response?.low_delivery || []
        });
      } catch {
        setData({ high: [], low: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getSignalColor = (signal) => {
    if (signal?.includes('Strong Accumulation')) return 'text-bullish bg-bullish/10';
    if (signal?.includes('Accumulation')) return 'text-emerald-400 bg-emerald-500/10';
    if (signal?.includes('Distribution')) return 'text-bearish bg-bearish/10';
    if (signal?.includes('Selling')) return 'text-orange-400 bg-orange-500/10';
    if (signal?.includes('Intraday')) return 'text-purple-400 bg-purple-500/10';
    return 'text-amber-400 bg-amber-500/10';
  };

  const formatVolume = (vol) => {
    if (vol >= 10000000) return (vol / 10000000).toFixed(2) + ' Cr';
    if (vol >= 100000) return (vol / 100000).toFixed(2) + ' L';
    return vol?.toLocaleString();
  };

  const displayData = activeTab === 'high' ? data.high : data.low;

  return (
    <Card>
      <CardHeader style={{ paddingBottom: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Layers style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            Top Deliveries
          </CardTitle>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="sm"
              variant={activeTab === 'high' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('high')}
              style={{ fontSize: '0.75rem', height: 28, padding: '0 8px' }}
            >
              High ({data.high?.length || 0})
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'low' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('low')}
              style={{ fontSize: '0.75rem', height: 28, padding: '0 8px' }}
            >
              Low ({data.low?.length || 0})
            </Button>
          </Box>
        </Box>
        <CardDescription sx={{ fontSize: '0.75rem' }}>
          {activeTab === 'high' ? '\u{1F7E2} High delivery % = genuine investor interest' : '\u{1F7E3} Low delivery % = intraday speculation'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {/* Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: 0.5,
                fontSize: '10px',
                color: 'text.secondary',
                px: 1,
                py: 0.5,
                borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
              }}
            >
              <Box sx={{ gridColumn: 'span 3' }}>Stock</Box>
              <Box sx={{ gridColumn: 'span 2', textAlign: 'right' }}>LTP</Box>
              <Box sx={{ gridColumn: 'span 2', textAlign: 'right' }}>Chg%</Box>
              <Box sx={{ gridColumn: 'span 2', textAlign: 'right' }}>Traded</Box>
              <Box sx={{ gridColumn: 'span 3', textAlign: 'right' }}>Del%</Box>
            </Box>
            {displayData.slice(0, 8).map((stock, i) => (
              <Box
                key={stock.symbol}
                component={motion.div}
                initial={{ opacity: 0, x: activeTab === 'high' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gap: 0.5,
                  alignItems: 'center',
                  p: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.secondary.main, 0.2),
                  fontSize: '0.75rem',
                  transition: 'background-color 0.2s ease',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                }}
              >
                <Box sx={{ gridColumn: 'span 3', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stock.symbol}
                </Box>
                <Box sx={{ gridColumn: 'span 2', textAlign: 'right' }}>
                  {'\u20B9'}{stock.price?.toFixed(0)}
                </Box>
                <Box
                  sx={{
                    gridColumn: 'span 2',
                    textAlign: 'right',
                    fontWeight: 500,
                    color: stock.change_pct > 0 ? 'success.main' : stock.change_pct < 0 ? 'error.main' : 'text.secondary',
                  }}
                >
                  {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct?.toFixed(2)}%
                </Box>
                <Box sx={{ gridColumn: 'span 2', textAlign: 'right', color: 'text.secondary' }}>
                  {formatVolume(stock.traded_volume)}
                </Box>
                <Box sx={{ gridColumn: 'span 3', textAlign: 'right' }}>
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: 700,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      fontSize: '11px',
                      ...(activeTab === 'high'
                        ? (stock.change_pct >= 0
                          ? { bgcolor: alpha(theme.palette.success.main, 0.2), color: 'success.main' }
                          : { bgcolor: alpha(theme.palette.warning.dark, 0.2), color: 'warning.dark' })
                        : { bgcolor: alpha(theme.palette.secondary.main, 0.2), color: 'secondary.light' }),
                    }}
                  >
                    {stock.delivery_pct?.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.1)}` }}>
          <Typography sx={{ fontSize: '10px', color: 'text.secondary', textAlign: 'center' }}>
            {activeTab === 'high'
              ? '\u{1F4A1} Del% > 60% with price \u2191 = Strong Accumulation'
              : '\u{1F4A1} Del% < 35% = Heavy intraday trading, no conviction'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 52 WEEK HIGH/LOW
// ═══════════════════════════════════════════════════════════════════════════════
const Week52HighLow = () => {
  const [data, setData] = useState({ highs: [], lows: [] });
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/52week-high-low');
        setData({
          highs: response?.near_52_week_high?.slice(0, 5) || response?.highs?.slice(0, 5) || [],
          lows: response?.near_52_week_low?.slice(0, 5) || response?.lows?.slice(0, 5) || []
        });
      } catch {
        setData({ highs: [], lows: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Award style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
          52-Week Extremes
        </CardTitle>
        <CardDescription>Stocks at yearly highs & lows</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Crown style={{ width: 16, height: 16, color: theme.palette.warning.light }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'success.main' }}>
                  52W Highs ({data.highs.length})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.highs.slice(0, 3).map((stock, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                    }}
                  >
                    <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stock.symbol}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'success.main' }}>
                      {'\u20B9'}{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <TrendingDown style={{ width: 16, height: 16, color: theme.palette.error.main }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'error.main' }}>
                  52W Lows ({data.lows.length})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.lows.slice(0, 3).map((stock, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                    }}
                  >
                    <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stock.symbol}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'error.main' }}>
                      {'\u20B9'}{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME SHOCKERS
// ═══════════════════════════════════════════════════════════════════════════════
const VolumeShockers = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetchAPI('/nse/volume-shockers');
        setStocks(response?.data?.slice(0, 5) || response?.slice(0, 5) || []);
      } catch {
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Volume2 style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
          Volume Shockers
        </CardTitle>
        <CardDescription>Unusual volume activity</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {stocks.map((stock, i) => {
              const change = stock.pChange || 0;
              const volRatio = stock.volumeRatio || stock.volume_ratio || 2;
              return (
                <Box
                  key={stock.symbol || i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.text.primary, 0.05),
                    transition: 'background-color 0.2s ease',
                    '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.08) },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Volume2 style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 500 }}>{stock.symbol}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {'\u20B9'}{formatNumber(stock.lastPrice || stock.last, { decimals: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        color: change > 0 ? 'success.main' : change < 0 ? 'error.main' : 'text.secondary',
                      }}
                    >
                      {change >= 0 ? '+' : ''}{formatPercent(change)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'warning.light' }}>
                      {volRatio.toFixed(1)}x Vol
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const MarketHub = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const theme = useTheme();

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/market')} path="/market" />
      <PageHeader
        title="Market Pulse"
        description="Live NSE market data, institutional flows, sector performance & volatility"
        breadcrumbs={[{ label: 'Dashboard', link: '/' }, { label: 'Market Pulse' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(p => p + 1)}>
            <RefreshCw style={{ width: 16, height: 16, marginRight: 8 }} />
            Refresh
          </Button>
        }
      />

      <Section key={`ticker-${refreshKey}`}>
        <LiveIndicesTicker />
      </Section>

      <Box
        key={`main-${refreshKey}`}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 3,
          mt: 3,
        }}
      >
        <FIIDIISection />
        <SectorHeatmap />
        <MarketBreadth />
        <IndiaVIX />
        <TopMovers />
        <TopDeliveries />
        <Week52HighLow />
        <VolumeShockers />
      </Box>

      <Card
        sx={{
          mt: 4,
          p: 2.5,
          background: `linear-gradient(to right, ${alpha(theme.palette.primary.main, 0.05)}, transparent)`,
          borderColor: alpha(theme.palette.primary.main, 0.2),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <Info style={{ width: 24, height: 24, color: theme.palette.primary.main }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              {'\u{1F4DA}'} Market Intelligence Guide
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: 2,
                fontSize: '0.875rem',
                color: 'text.secondary',
              }}
            >
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5, fontSize: 'inherit' }}>
                  FII/DII Flows
                </Typography>
                <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                  FII+DII buying = Strong Rally. FII selling + DII buying = Support.
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5, fontSize: 'inherit' }}>
                  VIX Signals
                </Typography>
                <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                  VIX &lt; 13: Complacent. VIX &gt; 20: Fear. Spike above 25 = bottoms.
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5, fontSize: 'inherit' }}>
                  A/D Ratio
                </Typography>
                <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                  A/D &gt; 1.5: Strong breadth. A/D &lt; 0.7: Weak. Divergences = reversals.
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.05) }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5, fontSize: 'inherit' }}>
                  Sector Rotation
                </Typography>
                <Typography sx={{ fontSize: 'inherit', color: 'inherit' }}>
                  IT/Pharma = Defensive. Metal/Auto = Risk-on. Track the flow!
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Card>
    </PageLayout>
  );
};

export default MarketHub;
