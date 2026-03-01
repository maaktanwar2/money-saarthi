// AI Agent — Live Event Feed with filter tabs
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import {
  Power, Rocket, Square, Eye, Brain, Zap, Sparkles,
  RotateCw, Shield, AlertCircle, Settings, Clock, XCircle,
  Pause, Play, Terminal, MessageSquare
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';

const EVENT_TYPES = ['ALL', 'THINK', 'ACT', 'REFLECT', 'ADAPT', 'SAFETY', 'ERROR'];

const EVENT_ICONS = {
  SYSTEM: Power,
  START: Rocket,
  STOP: Square,
  OBSERVE: Eye,
  THINK: Brain,
  ACT: Zap,
  REFLECT: Sparkles,
  ADAPT: RotateCw,
  SAFETY: Shield,
  ERROR: AlertCircle,
  WARN: AlertCircle,
  CONFIG: Settings,
  IDLE: Clock,
  EXIT: XCircle,
  PAUSE: Pause,
  RESUME: Play,
};

const getEventIconColor = (type) => {
  switch (type) {
    case 'ERROR': return '#f87171';
    case 'SAFETY': return '#fbbf24';
    case 'ACT': return '#34d399';
    case 'THINK': return '#c084fc';
    case 'ADAPT': return '#22d3ee';
    default: return '#64748b';
  }
};

const EventFeed = ({ events, filter, setFilter }) => {
  const filtered = filter === 'ALL' ? events : events.filter(e => e.type === filter);

  return (
    <Card>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Terminal style={{ width: 16, height: 16, color: '#34d399' }} />
          Live Feed
          <Typography component="span" sx={{ fontSize: '10px', color: 'text.disabled', fontWeight: 400, ml: 'auto' }}>
            {filtered.length} events
          </Typography>
        </CardTitle>
      </CardHeader>
      <CardContent sx={{ p: 2, pt: 0 }}>
        {/* Filter tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
          {EVENT_TYPES.map(t => (
            <Box
              key={t}
              component="button"
              onClick={() => setFilter(t)}
              sx={{
                fontSize: '10px',
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                ...(filter === t
                  ? {
                      bgcolor: alpha('#a855f7', 0.2),
                      color: '#d8b4fe',
                      border: 1,
                      borderColor: alpha('#a855f7', 0.3),
                    }
                  : {
                      color: '#64748b',
                      background: 'none',
                      border: 'none',
                      '&:hover': { color: '#cbd5e1' },
                    }),
              }}
            >
              {t}
            </Box>
          ))}
        </Box>

        {/* Events list */}
        <Stack spacing={0.5} sx={{ maxHeight: 400, overflowY: 'auto', pr: 0.5 }}>
          {filtered.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ py: 2, textAlign: 'center', display: 'block' }}>
              No events yet
            </Typography>
          ) : (
            filtered.slice(0, 50).map((evt, i) => {
              const EvtIcon = EVENT_ICONS[evt.type] || MessageSquare;
              const iconColor = getEventIconColor(evt.type);
              return (
                <Stack
                  key={i}
                  direction="row"
                  alignItems="flex-start"
                  spacing={1}
                  sx={{
                    py: 0.75,
                    borderBottom: 1,
                    borderColor: alpha('#334155', 0.2),
                    '&:last-child': { borderBottom: 0 },
                  }}
                >
                  <EvtIcon style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, color: iconColor }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Typography sx={{ fontSize: '10px', color: 'text.disabled' }}>
                        {evt.time ? new Date(evt.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {evt.title}
                      </Typography>
                    </Stack>
                    {evt.detail && (
                      <Typography
                        sx={{
                          fontSize: '10px',
                          color: 'text.disabled',
                          mt: 0.25,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {evt.detail}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              );
            })
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default EventFeed;
