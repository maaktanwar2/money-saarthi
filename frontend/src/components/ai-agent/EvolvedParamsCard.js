// AI Agent — Self-Evolved Parameters + Strategy Performance
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { RotateCw } from 'lucide-react';
import { STRATEGY_INFO } from './constants';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { formatINR } from '../../lib/utils';

const EvolvedParamsCard = ({ params, performance }) => {
  if (!params) return null;

  return (
    <Card>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          <RotateCw style={{ width: 16, height: 16, color: '#22d3ee' }} />
          Self-Evolved Parameters
          <Badge
            sx={{
              bgcolor: alpha('#06b6d4', 0.1),
              color: '#22d3ee',
              borderColor: alpha('#06b6d4', 0.2),
              fontSize: '10px',
            }}
          >
            ADAPTIVE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent sx={{ p: 2, pt: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          <Box sx={{ bgcolor: alpha('#0f172a', 0.4), borderRadius: 2, p: 1.25 }}>
            <Typography sx={{ fontSize: '10px', color: 'text.disabled', mb: 0.5 }}>Confidence Threshold</Typography>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#c084fc' }}>
              {params.confidence_threshold?.toFixed(0)}%
            </Typography>
          </Box>
          <Box sx={{ bgcolor: alpha('#0f172a', 0.4), borderRadius: 2, p: 1.25 }}>
            <Typography sx={{ fontSize: '10px', color: 'text.disabled', mb: 0.5 }}>Vol Comfort</Typography>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#fbbf24', textTransform: 'capitalize' }}>
              {params.volatility_comfort || 'medium'}
            </Typography>
          </Box>
          <Box sx={{ bgcolor: alpha('#0f172a', 0.4), borderRadius: 2, p: 1.25 }}>
            <Typography sx={{ fontSize: '10px', color: 'text.disabled', mb: 0.5 }}>Time Preference</Typography>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#60a5fa', textTransform: 'capitalize' }}>
              {params.time_preference || 'any'}
            </Typography>
          </Box>
          <Box sx={{ bgcolor: alpha('#0f172a', 0.4), borderRadius: 2, p: 1.25 }}>
            <Typography sx={{ fontSize: '10px', color: 'text.disabled', mb: 0.5 }}>Drawdown</Typography>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#f87171' }}>
              {formatINR(performance?.drawdown || 0)}
            </Typography>
          </Box>
        </Box>

        {/* Strategy Performance */}
        {performance?.strategy_stats && Object.keys(performance.strategy_stats).length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography
              sx={{
                fontSize: '10px',
                color: 'text.disabled',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1,
              }}
            >
              Strategy Performance
            </Typography>
            <Stack spacing={0.75}>
              {Object.entries(performance.strategy_stats).map(([strat, stats]) => {
                const wr = stats.trades > 0 ? (stats.wins / stats.trades * 100) : 0;
                const info = STRATEGY_INFO[strat] || { icon: '\uD83D\uDCCA', name: strat };
                return (
                  <Stack key={strat} direction="row" alignItems="center" spacing={1.5} sx={{ fontSize: '0.75rem' }}>
                    <Typography sx={{ width: 20, textAlign: 'center', fontSize: 'inherit' }}>{info.icon}</Typography>
                    <Typography sx={{ color: 'text.secondary', flex: 1, fontSize: 'inherit' }}>{info.name}</Typography>
                    <Typography sx={{ color: 'text.disabled', fontSize: 'inherit' }}>{stats.trades} trades</Typography>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        width: 48,
                        textAlign: 'right',
                        fontSize: 'inherit',
                        color: wr >= 50 ? '#34d399' : '#f87171',
                      }}
                    >
                      {wr.toFixed(0)}% WR
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        width: 64,
                        textAlign: 'right',
                        fontSize: 'inherit',
                        color: stats.pnl >= 0 ? '#34d399' : '#f87171',
                      }}
                    >
                      {formatINR(stats.pnl)}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EvolvedParamsCard;
