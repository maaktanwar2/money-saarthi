// AI Agent — StatCard sub-component
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { Card, CardContent } from '../ui';
import { COLOR_MAP } from './constants';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => {
  const theme = useTheme();
  const c = COLOR_MAP[color] || color;

  return (
    <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6), borderColor: alpha(theme.palette.divider, 0.5) }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </Typography>
          <Box sx={{
            width: 32, height: 32, borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(c, 0.1),
          }}>
            <Icon size={16} color={c} />
          </Box>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: c }}>{value}</Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 11, color: alpha(theme.palette.text.secondary, 0.6), mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
