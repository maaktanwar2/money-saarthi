// AI Agent — Decision History timeline
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { STRATEGY_INFO } from './constants';
import { Lightbulb, Terminal } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';

const DecisionHistory = ({ decisions, onShowThoughts }) => (
  <Card>
    <CardHeader sx={{ pb: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lightbulb style={{ width: 16, height: 16, color: '#fbbf24' }} />
          Decision History ({decisions.length})
        </CardTitle>
        <Box
          component="button"
          onClick={onShowThoughts}
          sx={{
            fontSize: '11px',
            color: '#c084fc',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            fontFamily: 'inherit',
            '&:hover': { color: '#d8b4fe' },
          }}
        >
          <Terminal style={{ width: 12, height: 12 }} /> Full Thought Log
        </Box>
      </Stack>
    </CardHeader>
    <CardContent sx={{ p: 2, pt: 0 }}>
      {decisions.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ py: 2, textAlign: 'center', display: 'block' }}>
          No decisions yet
        </Typography>
      ) : (
        <Stack spacing={0.75} sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {decisions.map((d, i) => {
            const stratInfo = STRATEGY_INFO[d.strategy] || STRATEGY_INFO.no_trade;
            return (
              <Stack
                key={d.id || i}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: alpha('#334155', 0.3),
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Typography sx={{ fontSize: '10px', color: 'text.disabled', width: 56, flexShrink: 0 }}>
                  {d.timestamp ? new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </Typography>
                <Box
                  sx={{
                    fontSize: '10px',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    fontWeight: 500,
                    width: 56,
                    textAlign: 'center',
                    flexShrink: 0,
                    ...(d.action === 'ENTER'
                      ? { bgcolor: alpha('#10b981', 0.2), color: '#34d399' }
                      : d.action === 'EXIT'
                      ? { bgcolor: alpha('#ef4444', 0.2), color: '#f87171' }
                      : d.action === 'ADJUST'
                      ? { bgcolor: alpha('#f59e0b', 0.2), color: '#fbbf24' }
                      : { bgcolor: alpha('#64748b', 0.2), color: '#94a3b8' }),
                  }}
                >
                  {d.action}
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stratInfo.icon} {stratInfo.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: d.confidence_score >= 70
                      ? '#34d399'
                      : d.confidence_score >= 50
                      ? '#fbbf24'
                      : '#64748b',
                  }}
                >
                  {d.confidence_score?.toFixed(0)}%
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </CardContent>
  </Card>
);

export default DecisionHistory;
