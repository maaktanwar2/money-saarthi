// Market Pulse — PCR + IV mini cards (myfno-style dashboard row)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import { fetchAPI } from '../../lib/utils';

const PulseCard = ({ icon: Icon, label, value, change, changeLabel, color, glowColor, delay = 0 }) => {
  const theme = useTheme();
  const isPositive = change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 20 }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          border: 1,
          transition: 'all 0.3s ease',
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 0.5)})`,
          backdropFilter: 'blur(8px)',
          borderColor: alpha(theme.palette.divider, 0.4),
          '&:hover': {
            borderColor: alpha(theme.palette.divider, 0.8),
            boxShadow: `0 10px 30px ${alpha(glowColor, 0.15)}`,
            transform: 'translateY(-2px)',
          },
          '& .hover-glow': { opacity: 0, transition: 'opacity 0.5s ease' },
          '&:hover .hover-glow': { opacity: 1 },
          '& .icon-box': { transition: 'transform 0.2s ease' },
          '&:hover .icon-box': { transform: 'scale(1.1)' },
        }}
      >
        {/* Top accent strip */}
        <Box
          sx={{
            height: 2,
            width: '100%',
            background: `linear-gradient(to right, ${glowColor}66, ${glowColor}, ${glowColor}66)`,
          }}
        />

        {/* Background glow on hover */}
        <Box
          className="hover-glow"
          sx={{
            position: 'absolute',
            top: -24,
            right: -24,
            width: 80,
            height: 80,
            borderRadius: '50%',
            filter: 'blur(16px)',
            bgcolor: alpha(glowColor, 0.08),
          }}
        />

        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ p: 1.25, position: 'relative' }}>
          <Box
            className="icon-box"
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: color,
              boxShadow: `0 4px 14px ${alpha(glowColor, 0.3)}`,
            }}
          >
            <Icon style={{ width: 16, height: 16, color: '#fff' }} />
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: '0.625rem',
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              {label}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
              <Typography
                sx={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.025em',
                }}
              >
                {value}
              </Typography>
              {change != null && (
                <Box
                  component="span"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1.5,
                    fontVariantNumeric: 'tabular-nums',
                    bgcolor: isPositive
                      ? alpha(theme.palette.success.main, 0.1)
                      : alpha(theme.palette.error.main, 0.1),
                    color: isPositive
                      ? theme.palette.success.light
                      : theme.palette.error.light,
                  }}
                >
                  {isPositive
                    ? <ArrowUpRight style={{ width: 10, height: 10, marginRight: 2 }} />
                    : <ArrowDownRight style={{ width: 10, height: 10, marginRight: 2 }} />
                  }
                  {isPositive ? '+' : ''}{typeof change === 'number' ? change.toFixed(2) : change}
                </Box>
              )}
            </Stack>
            {changeLabel && (
              <Typography
                sx={{
                  fontSize: '0.5625rem',
                  color: 'text.secondary',
                  mt: 0.5,
                  fontWeight: 500,
                }}
              >
                {changeLabel}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    </motion.div>
  );
};

const MarketPulseCards = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPulse = async () => {
      try {
        // Fetch VIX + market breadth in parallel
        const [vixRes, breadthRes] = await Promise.all([
          fetchAPI('/nse/india-vix').catch(() => null),
          fetchAPI('/nse/market-breadth').catch(() => null),
        ]);

        const vix = vixRes?.last ?? vixRes?.value ?? 0;
        const vixChange = vixRes?.change ?? 0;
        const vixLevel = vixRes?.level || '';

        // PCR from breadth (approximate from adv/dec ratio)
        const adv = breadthRes?.advances ?? 0;
        const dec = breadthRes?.declines ?? 0;
        const adRatio = breadthRes?.advanceDeclineRatio ?? (adv / Math.max(dec, 1));

        // Approximate PCR (put-call ratio) — uses AD ratio as proxy
        const pcr = adRatio > 0 ? (1 / adRatio).toFixed(2) : '0.00';
        const pcrVal = parseFloat(pcr);
        const pcrChange = adRatio > 1 ? -(adRatio - 1).toFixed(2) : (1 - adRatio).toFixed(2);

        setData({
          pcr: pcrVal.toFixed(2),
          pcrChange: parseFloat(pcrChange),
          iv: vix.toFixed(1),
          ivChange: vixChange,
          ivLevel: vixLevel,
        });
      } catch (err) {
        console.error('Pulse fetch err:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPulse();
    // Remove manual polling - let React Query handle refetching
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  if (!data) return null;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
      <PulseCard
        icon={BarChart3}
        label="PCR"
        value={data.pcr}
        change={data.pcrChange}
        changeLabel={parseFloat(data.pcr) > 1 ? 'Bullish (Put heavy)' : parseFloat(data.pcr) < 0.7 ? 'Bearish (Call heavy)' : 'Neutral'}
        color="rgba(139,92,246,0.8)"
        glowColor="#8b5cf6"
        delay={0}
      />
      <PulseCard
        icon={Activity}
        label="IV (VIX)"
        value={data.iv}
        change={data.ivChange}
        changeLabel={data.ivLevel || (parseFloat(data.iv) < 15 ? 'Low volatility' : parseFloat(data.iv) > 22 ? 'High volatility' : 'Normal')}
        color="rgba(245,158,11,0.8)"
        glowColor="#f59e0b"
        delay={0.05}
      />
    </Box>
  );
};

export default MarketPulseCards;
