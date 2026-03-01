// Advance-Decline Bar — NIFTY 500 breadth indicator
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import { fetchAPI } from '../../lib/utils';

const AdvanceDeclineBar = () => {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreadth = async () => {
      try {
        const res = await fetchAPI('/nse/market-breadth');
        setData(res);
      } catch (err) {
        console.error('Breadth error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBreadth();
    // Let React Query handle refetching via useMarketStats hook instead of manual polling
  }, []);

  if (loading) return <Skeleton variant="rounded" height={88} sx={{ borderRadius: 4 }} />;
  if (!data) return null;

  const adv = data.advances ?? 0;
  const dec = data.declines ?? 0;
  const unch = data.unchanged ?? 0;
  const total = adv + dec + unch || 1;
  const advPct = (adv / total) * 100;
  const decPct = (dec / total) * 100;
  const unchPct = (unch / total) * 100;
  const adRatio = data.advanceDeclineRatio ?? (adv / Math.max(dec, 1));
  const sentiment = data.sentiment || 'NEUTRAL';

  const isBullish = sentiment.includes('BULL');
  const isBearish = sentiment.includes('BEAR');

  const sentimentConfig = isBullish
    ? {
        color: theme.palette.success.light,
        bgColor: alpha(theme.palette.success.main, 0.1),
        glow: alpha(theme.palette.success.main, 0.15),
        borderColor: alpha(theme.palette.success.main, 0.3),
      }
    : isBearish
    ? {
        color: theme.palette.error.light,
        bgColor: alpha(theme.palette.error.main, 0.1),
        glow: alpha(theme.palette.error.main, 0.15),
        borderColor: alpha(theme.palette.error.main, 0.3),
      }
    : {
        color: theme.palette.warning.light,
        bgColor: alpha(theme.palette.warning.main, 0.1),
        glow: alpha(theme.palette.warning.main, 0.15),
        borderColor: alpha(theme.palette.warning.main, 0.3),
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          border: 1,
          borderColor: alpha(theme.palette.divider, 0.4),
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 0.5)})`,
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Top accent strip */}
        <Box
          sx={{
            height: 2,
            width: '100%',
            background: `linear-gradient(to right, rgba(16,185,129,0.6) ${advPct}%, rgba(245,158,11,0.4) ${advPct}%, rgba(245,158,11,0.4) ${advPct + unchPct}%, rgba(244,63,94,0.6) ${advPct + unchPct}%)`,
          }}
        />

        {/* Background glow */}
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 160,
            height: 80,
            borderRadius: '50%',
            filter: 'blur(48px)',
            opacity: 0.4,
            pointerEvents: 'none',
            bgcolor: sentimentConfig.glow,
          }}
        />

        <Box sx={{ p: 2, position: 'relative' }}>
          {/* Stats Row */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            {/* Advances */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.success.main, 0.15),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp style={{ width: 14, height: 14, color: theme.palette.success.light }} />
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'success.light',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {adv}
                </Typography>
                <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', fontWeight: 500 }}>
                  Advancing
                </Typography>
              </Box>
            </Stack>

            {/* Sentiment badge + ratio */}
            <Stack alignItems="center" spacing={0.5}>
              <Box
                component="span"
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 50,
                  border: 1,
                  borderColor: sentimentConfig.borderColor,
                  bgcolor: sentimentConfig.bgColor,
                  color: sentimentConfig.color,
                }}
              >
                {sentiment.replace('_', ' ')}
              </Box>
              <Typography
                sx={{
                  fontSize: '0.625rem',
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500,
                }}
              >
                A/D {adRatio.toFixed(2)}
              </Typography>
            </Stack>

            {/* Declines */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'error.light',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dec}
                </Typography>
                <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', fontWeight: 500 }}>
                  Declining
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.15),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingDown style={{ width: 14, height: 14, color: theme.palette.error.light }} />
              </Box>
            </Stack>
          </Stack>

          {/* The Bar */}
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                display: 'flex',
                height: 24,
                borderRadius: 50,
                overflow: 'hidden',
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
              }}
            >
              {/* Advances */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${advPct}%` }}
                transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'linear-gradient(90deg, #059669, #10b981, #34d399)',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(to bottom, ${alpha('#fff', 0.2)}, transparent)`,
                  }}
                />
                {advPct > 12 && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {advPct.toFixed(0)}%
                  </Box>
                )}
              </motion.div>

              {/* Unchanged */}
              {unch > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${unchPct}%` }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  style={{
                    position: 'relative',
                    backgroundColor: alpha(theme.palette.warning.main, 0.3),
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(to bottom, ${alpha('#fff', 0.1)}, transparent)`,
                    }}
                  />
                </motion.div>
              )}

              {/* Declines */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${decPct}%` }}
                transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'linear-gradient(90deg, #f43f5e, #e11d48, #be123c)',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(to bottom, ${alpha('#fff', 0.2)}, transparent)`,
                  }}
                />
                {decPct > 12 && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {decPct.toFixed(0)}%
                  </Box>
                )}
              </motion.div>
            </Box>

            {/* Glow underneath the bar */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -4,
                left: 0,
                right: 0,
                height: 12,
                borderRadius: 50,
                filter: 'blur(8px)',
                pointerEvents: 'none',
                background: `linear-gradient(to right, rgba(16,185,129,0.2) ${advPct}%, transparent ${advPct}%, transparent ${advPct + unchPct}%, rgba(244,63,94,0.2) ${advPct + unchPct}%)`,
              }}
            />
          </Box>

          {/* Unchanged footer */}
          {unch > 0 && (
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75} sx={{ mt: 1 }}>
              <Minus style={{ width: 12, height: 12, color: alpha(theme.palette.warning.main, 0.6) }} />
              <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {unch} Unchanged
              </Typography>
            </Stack>
          )}
        </Box>
      </Box>
    </motion.div>
  );
};

export default AdvanceDeclineBar;
