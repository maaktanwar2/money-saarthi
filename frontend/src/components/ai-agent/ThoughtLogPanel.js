// AI Agent — Expandable thought log with LLM reasoning chains
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { fetchWithAuth } from '../../config/api';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('ms_user') || '{}');
    return u.id || u.email || 'default';
  } catch { return 'default'; }
};

const ThoughtLogPanel = ({ agentStatus }) => {
  const [thoughts, setThoughts] = useState([]);
  const [fetchError, setFetchError] = useState(false);
  const theme = useTheme();

  const userId = getUserId();
  useEffect(() => {
    let cancelled = false;
    const fetchThoughts = async () => {
      try {
        const res = await fetchWithAuth(`/ai-agent/thought-log?user_id=${userId}&limit=10`);
        const data = await res.json();
        if (!cancelled && data.success) setThoughts(data.data.thoughts || []);
      } catch (err) {
        console.error('Thought log fetch error:', err);
        if (!cancelled) setFetchError(true);
      }
    };
    fetchThoughts();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: alpha(theme.palette.divider, 0.5) }}>
        <CardHeader sx={{ pb: 1 }}>
          <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Terminal size={16} color="#c084fc" />
            Full Thought Log (LLM Reasoning Chains)
          </CardTitle>
        </CardHeader>
        <CardContent sx={{ p: 2, pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 320, overflowY: 'auto' }}>
            {fetchError ? (
              <Typography sx={{ fontSize: '0.75rem', color: alpha(theme.palette.error.main, 0.7), py: 2, textAlign: 'center' }}>
                Failed to load thought logs
              </Typography>
            ) : thoughts.length === 0 ? (
              <Typography sx={{ fontSize: '0.75rem', color: alpha(theme.palette.text.secondary, 0.6), py: 2, textAlign: 'center' }}>
                No thought logs yet
              </Typography>
            ) : (
              thoughts.map((t, i) => (
                <Box key={i} sx={{
                  bgcolor: alpha(theme.palette.background.default, 0.5),
                  borderRadius: 2, p: 1.5,
                  border: 1, borderColor: alpha(theme.palette.divider, 0.4),
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      Cycle #{t.cycle}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: alpha(theme.palette.text.secondary, 0.6) }}>
                      {t.time ? new Date(t.time).toLocaleTimeString('en-IN') : ''}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: alpha(theme.palette.text.primary, 0.8), mb: 1 }}>
                    {t.decision?.reasoning}
                  </Typography>
                  {t.decision?.scenarios_considered?.map((s, j) => (
                    <Typography key={j} sx={{ fontSize: 10, color: alpha(theme.palette.text.secondary, 0.6), ml: 1 }}>
                      • {s}
                    </Typography>
                  ))}
                  {t.snapshot && (
                    <Typography sx={{ mt: 1, fontSize: 10, color: alpha(theme.palette.text.secondary, 0.4) }}>
                      Spot: {t.snapshot.spot_price} | Trend: {t.snapshot.trend} | VIX: {t.snapshot.vix}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ThoughtLogPanel;
