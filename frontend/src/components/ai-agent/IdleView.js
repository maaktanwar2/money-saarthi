// AI Agent — Idle / Landing view with hero, how-it-works, strategies grid
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Brain, Eye, Lightbulb, Zap, Sparkles, RotateCw,
  Rocket, Network
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../ui';
import { STRATEGY_INFO } from './constants';

const COLOR_HEX = {
  blue: '#3b82f6',
  purple: '#a855f7',
  amber: '#f59e0b',
  emerald: '#10b981',
  cyan: '#06b6d4',
  pink: '#ec4899',
  green: '#22c55e',
  red: '#ef4444',
  slate: '#64748b',
  gray: '#6b7280',
};

const IdleView = ({ onLaunch }) => {
  const theme = useTheme();

  return (
    <Stack spacing={3}>
      {/* Hero */}
      <Card
        sx={{
          background: `linear-gradient(to bottom right, ${alpha('#581c87', 0.3)}, ${alpha(theme.palette.background.paper, 0.6)}, ${alpha('#831843', 0.2)})`,
          borderColor: alpha('#a855f7', 0.2),
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 256,
            height: 256,
            bgcolor: alpha('#a855f7', 0.05),
            borderRadius: '50%',
            filter: 'blur(48px)',
          }}
        />
        <CardContent sx={{ p: 4, position: 'relative' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems="center"
            spacing={3}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 4,
                background: 'linear-gradient(to bottom right, #a855f7, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 10px 25px ${alpha('#a855f7', 0.2)}`,
              }}
            >
              <Brain style={{ width: 40, height: 40, color: '#fff' }} />
            </Box>
            <Box sx={{ textAlign: { xs: 'center', md: 'left' }, flex: 1 }}>
              <Typography variant="h5" fontWeight={700} color="text.primary" sx={{ mb: 1 }}>
                Autonomous AI Trading Agent
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 512, mb: 2 }}>
                A self-thinking, self-adjusting AI agent that autonomously analyzes markets,
                selects strategies, executes trades, and learns from outcomes. Powered by Claude AI.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {[
                  '\uD83E\uDDE0 Claude AI Brain', '\uD83D\uDCCA Multi-Strategy', '\uD83D\uDD04 Self-Adapting',
                  '\uD83D\uDEE1\uFE0F Risk Management', '\u26A1 Real-Time', '\uD83D\uDCC8 Performance Tracking'
                ].map((tag, i) => (
                  <Box
                    key={i}
                    component="span"
                    sx={{
                      fontSize: '0.75rem',
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 50,
                      bgcolor: 'action.hover',
                      color: 'text.secondary',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {tag}
                  </Box>
                ))}
              </Box>
              <Button
                onClick={onLaunch}
                size="lg"
                sx={{
                  background: 'linear-gradient(to right, #9333ea, #db2777)',
                  color: '#fff',
                  border: 0,
                  boxShadow: `0 10px 25px ${alpha('#a855f7', 0.2)}`,
                  '&:hover': { background: 'linear-gradient(to right, #a855f7, #ec4899)' },
                }}
              >
                <Rocket style={{ width: 16, height: 16, marginRight: 8 }} /> Launch AI Agent
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
          gap: 1.5,
        }}
      >
        {[
          { icon: Eye, title: 'OBSERVE', desc: 'Scans spot, VIX, OI, technicals', color: 'blue' },
          { icon: Brain, title: 'THINK', desc: 'Claude AI reasons through scenarios', color: 'purple' },
          { icon: Lightbulb, title: 'DECIDE', desc: 'Picks optimal strategy & params', color: 'amber' },
          { icon: Zap, title: 'ACT', desc: 'Places/adjusts/exits trades', color: 'emerald' },
          { icon: Sparkles, title: 'REFLECT', desc: 'Analyzes outcomes & learns', color: 'cyan' },
          { icon: RotateCw, title: 'ADAPT', desc: 'Self-modifies for better results', color: 'pink' },
        ].map((step, i) => {
          const hex = COLOR_HEX[step.color];
          return (
            <Card
              key={i}
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.4),
                borderColor: alpha(theme.palette.divider, 0.3),
                transition: 'all 0.2s',
                '&:hover': { borderColor: alpha(theme.palette.divider, 0.6) },
              }}
            >
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 3,
                    mx: 'auto',
                    mb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(hex, 0.1),
                  }}
                >
                  <step.icon style={{ width: 20, height: 20, color: hex }} />
                </Box>
                <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ display: 'block', mb: 0.5 }}>
                  {step.title}
                </Typography>
                <Typography sx={{ fontSize: '10px', color: 'text.disabled' }}>
                  {step.desc}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* Available Strategies */}
      <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: 'divider' }}>
        <CardHeader>
          <CardTitle sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Network style={{ width: 16, height: 16, color: '#c084fc' }} />
            Available Strategies (Agent picks autonomously)
          </CardTitle>
        </CardHeader>
        <CardContent sx={{ p: 2, pt: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1,
            }}
          >
            {Object.entries(STRATEGY_INFO).filter(([k]) => k !== 'no_trade').map(([key, info]) => {
              const hex = COLOR_HEX[info.color] || COLOR_HEX.gray;
              return (
                <Box
                  key={key}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: 1,
                    transition: 'all 0.2s',
                    bgcolor: alpha(hex, 0.05),
                    borderColor: alpha(hex, 0.1),
                  }}
                >
                  <Typography component="span" sx={{ fontSize: '1.125rem', mr: 1 }}>{info.icon}</Typography>
                  <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.primary' }}>
                    {info.name}
                  </Typography>
                  <Typography sx={{ fontSize: '10px', color: 'text.disabled', mt: 0.5 }}>
                    {info.desc}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default IdleView;
