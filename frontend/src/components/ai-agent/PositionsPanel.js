// AI Agent — Active Positions panel
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { STRATEGY_INFO, COLOR_MAP } from './constants';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { formatINR } from '../../lib/utils';

const PositionsPanel = ({ positions }) => {
  const theme = useTheme();

  return (
    <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: alpha(theme.palette.divider, 0.5) }}>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Activity size={16} color={theme.palette.success.main} />
          Active Positions ({positions.length})
        </CardTitle>
      </CardHeader>
      <CardContent sx={{ p: 2, pt: 0 }}>
        {positions.length === 0 ? (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', py: 2, textAlign: 'center' }}>
            No active positions
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {positions.map((pos, i) => {
              const stratInfo = STRATEGY_INFO[pos.strategy] || STRATEGY_INFO.no_trade;
              const pnl = pos.current_pnl || 0;
              return (
                <Box key={pos.id || i} sx={{
                  bgcolor: alpha(theme.palette.background.default, 0.4),
                  borderRadius: 2, p: 1.5,
                  border: 1, borderColor: alpha(theme.palette.divider, 0.3),
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span">{stratInfo.icon}</Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.primary' }}>
                        {stratInfo.name}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        {pos.id}
                      </Typography>
                    </Box>
                    <Typography sx={{
                      fontSize: '0.875rem', fontWeight: 700,
                      color: pnl >= 0 ? 'success.main' : 'error.main',
                    }}>
                      {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
                    </Typography>
                  </Box>

                  {/* Legs */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {(pos.legs || []).map((leg, j) => {
                      const isSell = leg.type?.includes('SELL');
                      const legColor = isSell ? theme.palette.error.main : theme.palette.success.main;
                      return (
                        <Box key={j} component="span" sx={{
                          fontSize: 10, px: 1, py: 0.25, borderRadius: 10,
                          bgcolor: alpha(legColor, 0.1),
                          color: legColor,
                        }}>
                          {leg.type} {leg.strike} @ ₹{leg.premium?.toFixed(1)}
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Progress bar */}
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, fontSize: 10, color: 'text.disabled' }}>
                    <Box component="span">SL: {formatINR(pos.stoploss_pnl || 0)}</Box>
                    <Box sx={{
                      flex: 1, height: 6, borderRadius: 10, overflow: 'hidden',
                      bgcolor: alpha(theme.palette.divider, 0.5),
                    }}>
                      <Box sx={{
                        height: '100%', borderRadius: 10, transition: 'all 0.3s',
                        bgcolor: pnl >= 0 ? 'success.main' : 'error.main',
                        width: `${Math.min(100, Math.abs(pnl / (pos.target_pnl || 1)) * 100)}%`,
                      }} />
                    </Box>
                    <Box component="span">Target: {formatINR(pos.target_pnl || 0)}</Box>
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

export default PositionsPanel;
