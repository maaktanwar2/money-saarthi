// AI Agent — Latest Decision card
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Brain, Shield, Target, XCircle, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '../ui';
import { STRATEGY_INFO, REGIME_COLORS, COLOR_MAP } from './constants';

const ACTION_COLORS = {
  ENTER: '#10b981',
  EXIT: '#ef4444',
  ADJUST: '#f59e0b',
  WAIT: '#64748b',
};
const DEFAULT_ACTION_COLOR = '#3b82f6';

const ACTION_GRADIENTS = {
  ENTER: 'linear-gradient(to right, #10b981, #22c55e)',
  EXIT: 'linear-gradient(to right, #ef4444, #f97316)',
  ADJUST: 'linear-gradient(to right, #f59e0b, #eab308)',
};
const DEFAULT_GRADIENT = 'linear-gradient(to right, #475569, #64748b)';

const LatestDecision = ({ decision, snapshot }) => {
  const theme = useTheme();

  if (!decision) {
    return (
      <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: alpha(theme.palette.divider, 0.5) }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <Brain size={32} color={alpha(theme.palette.text.secondary, 0.4)} />
          </Box>
          <Typography sx={{ color: alpha(theme.palette.text.secondary, 0.6), fontSize: '0.875rem' }}>
            Waiting for first decision...
          </Typography>
          <Typography sx={{ color: alpha(theme.palette.text.secondary, 0.4), fontSize: '0.75rem', mt: 0.5 }}>
            The agent is analyzing market conditions
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const stratInfo = STRATEGY_INFO[decision.strategy] || STRATEGY_INFO.no_trade;
  const stratColor = COLOR_MAP[stratInfo.color] || '#9ca3af';
  const regimeColor = REGIME_COLORS[decision.market_regime] || '#94a3b8';
  const actionColor = ACTION_COLORS[decision.action] || DEFAULT_ACTION_COLOR;

  return (
    <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: alpha(theme.palette.divider, 0.5), overflow: 'hidden' }}>
      {/* Top accent bar */}
      <Box sx={{ height: 4, background: ACTION_GRADIENTS[decision.action] || DEFAULT_GRADIENT }} />

      <CardContent sx={{ p: 2 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2,
              bgcolor: alpha('#a855f7', 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={20} color="#c084fc" />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                  Latest Decision
                </Typography>
                <Box component="span" sx={{
                  fontSize: '0.75rem', px: 1, py: 0.25, borderRadius: 10,
                  fontWeight: 500,
                  bgcolor: alpha(actionColor, 0.2),
                  color: actionColor,
                }}>
                  {decision.action}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.6) }}>
                {decision.timestamp ? new Date(decision.timestamp).toLocaleTimeString('en-IN') : '--'} · {decision.id}
              </Typography>
            </Box>
          </Box>

          {/* Confidence meter */}
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{
              fontSize: '1.125rem', fontWeight: 700,
              color: decision.confidence_score >= 80 ? 'success.main'
                : decision.confidence_score >= 60 ? 'warning.main' : 'error.main',
            }}>
              {decision.confidence_score?.toFixed(0)}%
            </Typography>
            <Typography sx={{ fontSize: 10, color: alpha(theme.palette.text.secondary, 0.6) }}>
              confidence
            </Typography>
          </Box>
        </Box>

        {/* Strategy & Regime badges */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <Box component="span" sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            fontSize: '0.75rem', px: 1, py: 0.5, borderRadius: 2,
            bgcolor: alpha(stratColor, 0.1),
            color: stratColor,
            border: 1, borderColor: alpha(stratColor, 0.2),
          }}>
            <span>{stratInfo.icon}</span> {stratInfo.name}
          </Box>
          <Box component="span" sx={{
            fontSize: '0.75rem', px: 1, py: 0.5, borderRadius: 2,
            bgcolor: 'action.hover',
            border: 1, borderColor: alpha(theme.palette.divider, 0.3),
            color: regimeColor,
          }}>
            {decision.market_regime?.replace(/_/g, ' ')}
          </Box>
        </Box>

        {/* Reasoning */}
        <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 2, p: 1.5, mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.875rem', color: alpha(theme.palette.text.primary, 0.8), lineHeight: 1.6 }}>
            {decision.reasoning || 'No reasoning logged'}
          </Typography>
        </Box>

        {/* Risk Assessment */}
        {decision.risk_assessment && (
          <Box sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1,
            bgcolor: alpha('#f59e0b', 0.05), borderRadius: 2, p: 1.25,
            border: 1, borderColor: alpha('#f59e0b', 0.1),
          }}>
            <Shield size={16} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.75rem', color: alpha('#fcd34d', 0.8) }}>
              {decision.risk_assessment}
            </Typography>
          </Box>
        )}

        {/* Scenarios */}
        {decision.scenarios_considered?.length > 0 && (
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{
              fontSize: 10, color: alpha(theme.palette.text.secondary, 0.6),
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Scenarios Considered
            </Typography>
            {decision.scenarios_considered.map((s, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                <ChevronRight size={12} color={alpha(theme.palette.text.secondary, 0.4)} style={{ marginTop: 2, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{s}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Hedge Plan */}
        {decision.hedge_plan && (decision.hedge_plan.required || decision.hedge_plan.reason) && (
          <Box sx={{
            mt: 1.5, bgcolor: alpha('#a855f7', 0.05), borderRadius: 2, p: 1.5,
            border: 1, borderColor: alpha('#a855f7', 0.1),
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Shield size={16} color="#c084fc" />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#d8b4fe' }}>
                Hedge Plan
              </Typography>
              <Box component="span" sx={{
                fontSize: 10, px: 0.75, py: 0.25, borderRadius: 10,
                bgcolor: decision.hedge_plan.required ? alpha('#ef4444', 0.2) : alpha('#22c55e', 0.2),
                color: decision.hedge_plan.required ? '#f87171' : '#4ade80',
              }}>
                {decision.hedge_plan.required ? 'Required' : 'Not Required'}
              </Box>
            </Box>
            {decision.hedge_plan.reason && (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
                {decision.hedge_plan.reason}
              </Typography>
            )}
            {decision.hedge_plan.legs?.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {decision.hedge_plan.legs.map((leg, i) => {
                  const isBuy = leg.direction === 'BUY';
                  const legColor = isBuy ? '#22c55e' : '#ef4444';
                  return (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      fontSize: 10, px: 1.25, py: 0.75, borderRadius: 2,
                      bgcolor: alpha(legColor, 0.1),
                      border: 1, borderColor: alpha(legColor, 0.2),
                    }}>
                      <Box component="span" sx={{ fontWeight: 700, color: legColor }}>
                        {leg.action} {leg.direction}
                      </Box>
                      <Box component="span" sx={{ color: alpha(theme.palette.text.primary, 0.8) }}>
                        {leg.instrument}{leg.strike ? ` @ ${leg.strike}` : ''}
                      </Box>
                      {leg.quantity_lots && (
                        <Box component="span" sx={{ color: alpha(theme.palette.text.secondary, 0.6) }}>
                          x{leg.quantity_lots}L
                        </Box>
                      )}
                      {leg.notes && (
                        <Box component="span" sx={{ color: alpha(theme.palette.text.secondary, 0.6), ml: 'auto' }}>
                          {leg.notes}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* Position Plan */}
        {decision.position_plan && (decision.position_plan.targets || decision.position_plan.exits) && (
          <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {decision.position_plan.targets && (
              <Box sx={{
                bgcolor: alpha('#10b981', 0.05), borderRadius: 2, p: 1.25,
                border: 1, borderColor: alpha('#10b981', 0.1),
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: 10, fontWeight: 600, color: '#34d399' }}>
                  <Target size={12} /> Targets / SL
                </Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {decision.position_plan.targets}
                </Typography>
              </Box>
            )}
            {decision.position_plan.exits && (
              <Box sx={{
                bgcolor: alpha('#ef4444', 0.05), borderRadius: 2, p: 1.25,
                border: 1, borderColor: alpha('#ef4444', 0.1),
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: 10, fontWeight: 600, color: '#f87171' }}>
                  <XCircle size={12} /> Exit Triggers
                </Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {decision.position_plan.exits}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default LatestDecision;
