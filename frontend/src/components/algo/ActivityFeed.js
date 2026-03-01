/**
 * Activity Feed - Real-time event log for trading bots
 * Shows bot events, trades, adjustments, and AI decisions
 */
import React, { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import {
  Play, Square, ArrowUpRight, ArrowDownRight, RefreshCw,
  Brain, AlertCircle, Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { formatINR } from '../../lib/utils';

const EVENT_TYPES = {
  bot_start: { icon: Play, color: 'success', label: 'Bot Started' },
  bot_stop: { icon: Square, color: 'error', label: 'Bot Stopped' },
  trade_buy: { icon: ArrowUpRight, color: 'success', label: 'Buy' },
  trade_sell: { icon: ArrowDownRight, color: 'error', label: 'Sell' },
  adjustment: { icon: RefreshCw, color: 'info', label: 'Adjustment' },
  ai_decision: { icon: Brain, color: 'secondary', label: 'AI Decision' },
  alert: { icon: AlertCircle, color: 'warning', label: 'Alert' },
};

const ActivityFeed = ({ events = [], className }) => {
  const theme = useTheme();
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <Card className={className}>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <Activity style={{ width: 20, height: 20, color: theme.palette.primary.main }} />
            Activity Feed
            <Badge variant="secondary" sx={{ ml: 'auto' }}>
              {events.length} events
            </Badge>
          </Box>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Box ref={scrollRef} sx={{ maxHeight: 350, overflowY: 'auto', pr: 1 }}>
          {events.length === 0 ? (
            <Box
              sx={{
                height: 128,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Activity style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.3, color: theme.palette.text.secondary }} />
                <Typography variant="body2">No activity yet</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Events will appear here when bots are running
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', pl: 4 }}>
              {/* Vertical timeline line */}
              <Divider
                orientation="vertical"
                sx={{
                  position: 'absolute',
                  left: 12,
                  top: 0,
                  bottom: 0,
                  borderColor: 'divider',
                }}
              />

              {events.map((event, i) => {
                const config = EVENT_TYPES[event.type] || EVENT_TYPES.alert;
                const Icon = config.icon;
                const paletteColor = config.color;

                return (
                  <motion.div
                    key={event.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    style={{ position: 'relative', marginBottom: 12 }}
                  >
                    {/* Timeline dot */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -20,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: (t) => alpha(t.palette[paletteColor].main, 0.2),
                      }}
                    >
                      <Icon style={{ width: 12, height: 12, color: theme.palette[paletteColor].main }} />
                    </Box>

                    {/* Event content */}
                    <Box
                      sx={{
                        bgcolor: (t) => alpha(t.palette.action.hover, 0.06),
                        borderRadius: 2,
                        p: 1.5,
                        transition: 'background-color 0.2s',
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.action.hover, 0.12),
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500}>{config.label}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.625rem' }}>
                          {event.timestamp
                            ? new Date(event.timestamp).toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })
                            : ''
                          }
                        </Typography>
                      </Box>
                      {event.message && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {event.message}
                        </Typography>
                      )}
                      {event.pnl !== undefined && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 500,
                            color: event.pnl >= 0 ? 'success.main' : 'error.main',
                          }}
                        >
                          {event.pnl >= 0 ? '+' : ''}{formatINR(event.pnl)}
                        </Typography>
                      )}
                    </Box>
                  </motion.div>
                );
              })}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(ActivityFeed);
