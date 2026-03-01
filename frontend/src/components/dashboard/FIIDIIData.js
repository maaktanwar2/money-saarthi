// Dashboard — FII/DII Activity Card (glassmorphic)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Building2, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import { fetchAPI } from '../../lib/utils';

/* ─── Helpers ─── */
const fmt = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toFixed(0);
};

const FlowBar = ({ buy, sell, accent }) => {
  const theme = useTheme();
  const total = buy + sell;
  const buyPct = total > 0 ? (buy / total) * 100 : 50;
  return (
    <Box
      sx={{
        position: 'relative',
        height: 10,
        width: '100%',
        borderRadius: 5,
        overflow: 'hidden',
        bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
        mt: 1,
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${buyPct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          borderRadius: 20,
          background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
        }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${100 - buyPct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          borderRadius: 20,
          background: `linear-gradient(270deg, ${theme.palette.error.main}, ${alpha(theme.palette.error.main, 0.5)})`,
        }}
      />
    </Box>
  );
};

const EntityCard = ({ label, icon: Icon, buy, sell, net, accent, delay }) => {
  const theme = useTheme();
  const isPositive = net >= 0;
  const successColor = theme.palette.success.main;
  const errorColor = theme.palette.error.main;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay }}
    >
      <Box
        sx={{
          position: 'relative',
          borderRadius: 3,
          border: 1,
          borderColor: (t) => alpha(t.palette.divider, 0.3),
          background: (t) => `linear-gradient(to bottom right, ${alpha(t.palette.text.primary, 0.04)}, ${alpha(t.palette.text.primary, 0.01)})`,
          p: 2,
          overflow: 'hidden',
          transition: 'all 0.3s',
          '&:hover': {
            borderColor: (t) => alpha(t.palette.divider, 0.5),
            transform: 'translateY(-2px)',
          },
        }}
      >
        {/* Top accent */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} style={{ background: accent }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              style={{ background: `${accent}18` }}
            >
              <Icon style={{ width: 16, height: 16, color: accent }} />
            </Box>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: (t) => alpha(t.palette.text.primary, 0.9) }}>
              {label}
            </Typography>
          </Box>
          {/* Net pill */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 5,
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 1,
              borderColor: isPositive ? alpha(successColor, 0.3) : alpha(errorColor, 0.3),
              color: isPositive ? successColor : errorColor,
              bgcolor: isPositive ? alpha(successColor, 0.1) : alpha(errorColor, 0.1),
            }}
          >
            {isPositive ? <TrendingUp style={{ width: 12, height: 12 }} /> : <TrendingDown style={{ width: 12, height: 12 }} />}
            {isPositive ? '+' : ''}{fmt(net)} Cr
          </Box>
        </Box>

        {/* Net value big text */}
        <Typography
          sx={{
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            mb: 0.5,
            color: isPositive ? successColor : errorColor,
          }}
        >
          {isPositive ? '+' : ''}{net.toFixed(0)}{' '}
          <Typography component="span" sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.secondary' }}>
            Cr
          </Typography>
        </Typography>

        {/* Buy / Sell breakdown */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.6875rem',
            color: 'text.secondary',
            mb: 0.25,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Buy: <Typography component="span" variant="caption" sx={{ color: successColor, fontWeight: 600 }}>{fmt(buy)} Cr</Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Sell: <Typography component="span" variant="caption" sx={{ color: errorColor, fontWeight: 600 }}>{fmt(sell)} Cr</Typography>
          </Typography>
        </Box>

        <FlowBar buy={buy} sell={sell} accent={accent} />
      </Box>
    </motion.div>
  );
};

const FIIDIIData = () => {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchAPI('/fii-dii-data');
        const cashData = Array.isArray(result) ? result[0] : result;
        setData({
          fii: {
            buyValue: Number(cashData?.fii_buy) || 0,
            sellValue: Number(cashData?.fii_sell) || 0,
            netValue: Number(cashData?.fii_net) || 0
          },
          dii: {
            buyValue: Number(cashData?.dii_buy) || 0,
            sellValue: Number(cashData?.dii_sell) || 0,
            netValue: Number(cashData?.dii_net) || 0
          },
        });
      } catch (error) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Skeleton variant="rectangular" sx={{ height: 208, borderRadius: 4 }} animation="wave" />;

  const fii = data?.fii || { buyValue: 0, sellValue: 0, netValue: 0 };
  const dii = data?.dii || { buyValue: 0, sellValue: 0, netValue: 0 };
  const totalNet = fii.netValue + dii.netValue;

  /* Derive sentiment label */
  const sentiment = (() => {
    if (fii.netValue > 0 && dii.netValue > 0) return { label: 'Both Buying', color: 'success' };
    if (fii.netValue < 0 && dii.netValue < 0) return { label: 'Both Selling', color: 'error' };
    if (fii.netValue < 0 && dii.netValue > 0) return { label: 'FII Selling \u00b7 DII Absorbing', color: 'warning' };
    if (fii.netValue > 0 && dii.netValue < 0) return { label: 'FII Buying \u00b7 DII Selling', color: 'warning' };
    return { label: 'Neutral', color: 'default' };
  })();

  const getSentimentStyles = (colorKey) => {
    const colorMap = {
      success: { color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.1), border: alpha(theme.palette.success.main, 0.3) },
      error: { color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.1), border: alpha(theme.palette.error.main, 0.3) },
      warning: { color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.1), border: alpha(theme.palette.warning.main, 0.3) },
      default: { color: theme.palette.text.secondary, bg: alpha(theme.palette.text.secondary, 0.1), border: alpha(theme.palette.text.secondary, 0.3) },
    };
    return colorMap[colorKey] || colorMap.default;
  };

  const sentimentStyle = getSentimentStyles(sentiment.color);
  const glowColor = totalNet >= 0 ? alpha(theme.palette.success.main, 0.06) : alpha(theme.palette.error.main, 0.06);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <Box
        sx={{
          position: 'relative',
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
        }}
      >
        {/* Accent strip — gradient based on net flow */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
          }}
          style={{
            background: totalNet >= 0
              ? `linear-gradient(to right, ${theme.palette.success.main}, #14b8a6)`
              : `linear-gradient(to right, ${theme.palette.error.main}, #ec4899)`,
          }}
        />

        {/* Background glow */}
        <Box
          sx={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 208,
            height: 208,
            borderRadius: '50%',
            filter: 'blur(48px)',
            pointerEvents: 'none',
            bgcolor: glowColor,
          }}
        />

        <Box sx={{ position: 'relative', p: 2.5 }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: (t) => alpha(t.palette.text.primary, 0.9) }}>
              FII / DII Activity
            </Typography>
            <Box
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 5,
                fontSize: '0.6875rem',
                fontWeight: 700,
                border: 1,
                borderColor: sentimentStyle.border,
                color: sentimentStyle.color,
                bgcolor: sentimentStyle.bg,
              }}
            >
              {sentiment.label}
            </Box>
          </Box>

          {/* Cards grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
            <EntityCard
              label="FII (Foreign)"
              icon={Globe}
              buy={fii.buyValue}
              sell={fii.sellValue}
              net={fii.netValue}
              accent="#8b5cf6"
              delay={0.1}
            />
            <EntityCard
              label="DII (Domestic)"
              icon={Building2}
              buy={dii.buyValue}
              sell={dii.sellValue}
              net={dii.netValue}
              accent="#3b82f6"
              delay={0.18}
            />
          </Box>

          {/* Net flow summary + link */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Combined Net:{' '}
              <Typography
                component="span"
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: totalNet >= 0 ? 'success.main' : 'error.main',
                }}
              >
                {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(0)} Cr
              </Typography>
            </Typography>
            <Box
              component={Link}
              to="/market"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                fontSize: '0.75rem',
                color: 'primary.main',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: (t) => alpha(t.palette.primary.main, 0.8) },
              }}
            >
              View detailed analysis
              <ChevronRight style={{ width: 14, height: 14 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default FIIDIIData;
