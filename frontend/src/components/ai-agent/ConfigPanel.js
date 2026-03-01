// AI Agent — Config Panel (modal)
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import {
  Brain, Snowflake, Gauge, Flame, Rocket
} from 'lucide-react';
import { Button, Spinner } from '../ui';
import { toast } from '../../hooks/use-toast';

const COLOR_HEX = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  emerald: '#10b981',
};

const ConfigPanel = ({ config, setConfig, onStart, onClose, starting }) => {
  const update = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  // Clamp a numeric field within [min, max]
  const clamp = (key, min, max) => {
    const v = Number(config[key]);
    if (isNaN(v) || v < min) update(key, min);
    else if (v > max) update(key, max);
  };

  // Validate all inputs before launch
  const handleLaunch = () => {
    const c = config;
    if (!c.max_capital || c.max_capital < 10000) {
      toast({ title: 'Invalid Capital', description: 'Max capital must be at least \u20B910,000', variant: 'destructive' });
      return;
    }
    if (c.max_capital > 50000000) {
      toast({ title: 'Invalid Capital', description: 'Max capital cannot exceed \u20B95,00,00,000', variant: 'destructive' });
      return;
    }
    if (!c.num_lots || c.num_lots < 1 || c.num_lots > 50) {
      toast({ title: 'Invalid Lots', description: 'Lots per trade must be between 1 and 50', variant: 'destructive' });
      return;
    }
    if (c.think_interval < 15 || c.think_interval > 600) {
      toast({ title: 'Invalid Interval', description: 'Think interval must be between 15 and 600 seconds', variant: 'destructive' });
      return;
    }
    onStart();
  };

  const inputSx = {
    width: '100%',
    bgcolor: 'action.hover',
    border: 1,
    borderColor: 'divider',
    borderRadius: 2,
    px: 1.5,
    py: 1,
    fontSize: '0.875rem',
    color: 'text.primary',
    outline: 'none',
    '&:focus': { borderColor: 'primary.main' },
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha('#000', 0.6),
        backdropFilter: 'blur(4px)',
        p: 2,
      }}
    >
      <Box
        component={motion.div}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 4,
          p: 3,
          width: '100%',
          maxWidth: 512,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 3,
              background: 'linear-gradient(to bottom right, #a855f7, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Brain style={{ width: 20, height: 20, color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              Configure AI Agent
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Set parameters before launch
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={2}>
          {/* Underlying */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Underlying
            </Typography>
            <Stack direction="row" spacing={1}>
              {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map(sym => (
                <Box
                  key={sym}
                  component="button"
                  onClick={() => update('underlying', sym)}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    ...(config.underlying === sym
                      ? {
                          bgcolor: alpha('#a855f7', 0.2),
                          color: '#d8b4fe',
                          border: 1,
                          borderColor: alpha('#a855f7', 0.4),
                        }
                      : {
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          border: 1,
                          borderColor: 'divider',
                          '&:hover': { borderColor: 'text.disabled' },
                        }),
                  }}
                >
                  {sym}
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Risk Level */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Risk Level
            </Typography>
            <Stack direction="row" spacing={1}>
              {[
                { value: 'conservative', icon: Snowflake, label: 'Conservative', color: 'blue' },
                { value: 'moderate', icon: Gauge, label: 'Moderate', color: 'amber' },
                { value: 'aggressive', icon: Flame, label: 'Aggressive', color: 'red' },
              ].map(r => {
                const hex = COLOR_HEX[r.color];
                return (
                  <Box
                    key={r.value}
                    component="button"
                    onClick={() => update('risk_level', r.value)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      fontSize: '0.875rem',
                      flex: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      ...(config.risk_level === r.value
                        ? {
                            bgcolor: alpha(hex, 0.2),
                            color: hex,
                            border: 1,
                            borderColor: alpha(hex, 0.4),
                          }
                        : {
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            border: 1,
                            borderColor: 'divider',
                            '&:hover': { borderColor: 'text.disabled' },
                          }),
                    }}
                  >
                    <r.icon style={{ width: 14, height: 14 }} />
                    {r.label}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* Capital & Lots */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Max Capital (₹)
              </Typography>
              <Box
                component="input"
                type="number"
                value={config.max_capital}
                onChange={e => update('max_capital', Number(e.target.value))}
                onBlur={() => clamp('max_capital', 10000, 50000000)}
                min={10000}
                sx={inputSx}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Lots per Trade
              </Typography>
              <Box
                component="input"
                type="number"
                value={config.num_lots}
                onChange={e => update('num_lots', Number(e.target.value))}
                onBlur={() => clamp('num_lots', 1, 50)}
                min={1}
                max={50}
                sx={inputSx}
              />
            </Box>
          </Box>

          {/* Confidence & Interval */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Min Confidence ({config.min_confidence}%)
              </Typography>
              <Box
                component="input"
                type="range"
                min={40}
                max={95}
                value={config.min_confidence}
                onChange={e => update('min_confidence', Number(e.target.value))}
                sx={{ width: '100%', accentColor: '#a855f7' }}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Think Interval (sec)
              </Typography>
              <Box
                component="input"
                type="number"
                value={config.think_interval}
                onChange={e => update('think_interval', Number(e.target.value))}
                onBlur={() => clamp('think_interval', 15, 600)}
                min={15}
                max={600}
                sx={inputSx}
              />
            </Box>
          </Box>

          {/* Toggle Options */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              { key: 'use_mock', label: '🧪 Mock Mode (Paper Trade)', hint: 'No real orders' },
              { key: 'auto_enter', label: '⚡ Auto-Enter Trades' },
              { key: 'auto_exit', label: '🚪 Auto-Exit Positions' },
              { key: 'auto_adjust', label: '🔧 Auto-Adjust Positions' },
              { key: 'adapt_enabled', label: '🧬 Self-Adaptation' },
            ].map(opt => (
              <Box
                key={opt.key}
                component="button"
                onClick={() => update(opt.key, !config[opt.key])}
                sx={{
                  textAlign: 'left',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  ...(config[opt.key]
                    ? {
                        bgcolor: alpha('#10b981', 0.1),
                        color: '#6ee7b7',
                        border: 1,
                        borderColor: alpha('#10b981', 0.3),
                      }
                    : {
                        bgcolor: alpha('#000', 0.1),
                        color: 'text.secondary',
                        border: 1,
                        borderColor: alpha('#fff', 0.05),
                      }),
                }}
              >
                {opt.label}
                {opt.hint && (
                  <Typography
                    component="span"
                    sx={{ display: 'block', fontSize: '10px', opacity: 0.6, mt: 0.25 }}
                  >
                    {opt.hint}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Stack>

        {/* Actions */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button onClick={onClose} variant="outline" sx={{ flex: 1, borderColor: 'divider', color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={starting || !config.max_capital || config.max_capital < 10000 || !config.num_lots || config.num_lots < 1}
            sx={{
              flex: 1,
              background: 'linear-gradient(to right, #9333ea, #db2777)',
              color: '#fff',
              border: 0,
              '&:hover': { background: 'linear-gradient(to right, #a855f7, #ec4899)' },
              '&:disabled': { opacity: 0.5 },
            }}
          >
            {starting ? <Spinner sx={{ width: 16, height: 16, mr: 1 }} /> : <Rocket style={{ width: 16, height: 16, marginRight: 8 }} />}
            {starting ? 'Starting...' : 'Launch Agent'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default ConfigPanel;
