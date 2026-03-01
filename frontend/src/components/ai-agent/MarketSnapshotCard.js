// AI Agent — Market Snapshot sidebar card
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { Waves } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';

const MarketSnapshotCard = ({ snapshot }) => {
  const theme = useTheme();

  if (!snapshot) return null;

  return (
    <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: alpha(theme.palette.divider, 0.5) }}>
      <CardHeader sx={{ pb: 1 }}>
        <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Waves size={16} color={theme.palette.info.main} />
          Market Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent sx={{ p: 2, pt: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {snapshot.symbol}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>
              {snapshot.spot_price?.toLocaleString('en-IN')}
            </Typography>
          </Box>

          <Typography sx={{
            textAlign: 'right', fontSize: '0.75rem', fontWeight: 500,
            color: snapshot.day_change_pct >= 0 ? 'success.main' : 'error.main',
          }}>
            {snapshot.day_change_pct >= 0 ? '+' : ''}{snapshot.day_change_pct?.toFixed(2)}%
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>Trend</Typography>
              <Typography component="span" sx={{
                fontSize: 11, fontWeight: 500,
                color: snapshot.trend === 'BULLISH' ? 'success.main'
                  : snapshot.trend === 'BEARISH' ? 'error.main' : 'info.main',
              }}>{snapshot.trend}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>VIX</Typography>
              <Typography component="span" sx={{ fontSize: 11, fontWeight: 500, color: 'text.primary' }}>{snapshot.vix?.toFixed(1)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>VWAP</Typography>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.primary' }}>{snapshot.vwap?.toFixed(0)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>PCR</Typography>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.primary' }}>{snapshot.pcr?.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>IV Rank</Typography>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.primary' }}>{snapshot.iv_rank?.toFixed(0)}/100</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>Session</Typography>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.primary' }}>{snapshot.session}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>Support</Typography>
              <Typography component="span" sx={{ fontSize: 11, color: 'success.main' }}>{snapshot.s1?.toFixed(0)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>Resistance</Typography>
              <Typography component="span" sx={{ fontSize: 11, color: 'error.main' }}>{snapshot.r1?.toFixed(0)}</Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MarketSnapshotCard;
