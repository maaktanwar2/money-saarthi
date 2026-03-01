// Skeleton loading components - MUI-based shimmer placeholders
import MuiSkeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

/* --- base shimmer bar --- */
export const Skeleton = ({ className, width, height, variant = 'rectangular', ...props }) => (
  <MuiSkeleton
    variant={variant}
    width={width}
    height={height}
    className={className}
    animation="wave"
    sx={{ borderRadius: 1 }}
    {...props}
  />
);

/* --- text lines --- */
export const SkeletonText = ({ lines = 3, className }) => (
  <Stack spacing={1} className={className}>
    {[...Array(lines)].map((_, i) => (
      <MuiSkeleton key={i} variant="text" width={i === lines - 1 ? '75%' : '100%'} height={20} animation="wave" />
    ))}
  </Stack>
);

/* --- stat card --- */
export const SkeletonCard = ({ className }) => (
  <Paper className={className} sx={{ p: 2.5, borderRadius: 3 }}>
    <Stack spacing={1.5}>
      <MuiSkeleton variant="text" width="33%" height={20} animation="wave" />
      <MuiSkeleton variant="text" width="66%" height={32} animation="wave" />
      <MuiSkeleton variant="text" width="50%" height={16} animation="wave" />
    </Stack>
  </Paper>
);

/* --- table rows --- */
export const SkeletonTable = ({ rows = 5, cols = 4, className }) => (
  <Paper className={className} sx={{ borderRadius: 3, overflow: 'hidden' }}>
    <Box sx={{ display: 'flex', gap: 2, p: 2, borderBottom: 1, borderColor: 'divider' }}>
      {[...Array(cols)].map((_, c) => (
        <MuiSkeleton key={c} variant="text" sx={{ flex: 1 }} height={20} animation="wave" />
      ))}
    </Box>
    {[...Array(rows)].map((_, r) => (
      <Box key={r} sx={{ display: 'flex', gap: 2, p: 2, borderBottom: 1, borderColor: 'divider' }}>
        {[...Array(cols)].map((_, c) => (
          <MuiSkeleton key={c} variant="text" sx={{ flex: 1 }} height={20} animation="wave" />
        ))}
      </Box>
    ))}
  </Paper>
);

/* --- chart area --- */
export const SkeletonChart = ({ className }) => (
  <Paper className={className} sx={{ p: 2.5, borderRadius: 3 }}>
    <MuiSkeleton variant="text" width="25%" height={20} animation="wave" sx={{ mb: 2 }} />
    <MuiSkeleton variant="rectangular" width="100%" height={192} animation="wave" sx={{ borderRadius: 2 }} />
  </Paper>
);

/* --- page-level skeleton: grid of cards --- */
export const SkeletonPage = ({ cards = 6, cols = 3 }) => (
  <Box sx={{
    display: 'grid', gap: 2,
    gridTemplateColumns: {
      xs: cols >= 4 ? 'repeat(2, 1fr)' : '1fr',
      md: cols >= 4 ? `repeat(${Math.min(cols, 3)}, 1fr)` : `repeat(${Math.min(cols, 2)}, 1fr)`,
      lg: `repeat(${cols}, 1fr)`,
    },
  }}>
    {[...Array(cards)].map((_, i) => <SkeletonCard key={i} />)}
  </Box>
);

/* --- Dashboard-specific skeleton --- */
export const DashboardSkeleton = () => (
  <Stack spacing={3}>
    <SkeletonPage cards={6} cols={6} />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2 }}>
      <SkeletonChart />
      <SkeletonTable rows={4} cols={2} />
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1 }}>
      {[...Array(11)].map((_, i) => (
        <MuiSkeleton key={i} variant="rectangular" height={64} animation="wave" sx={{ borderRadius: 2 }} />
      ))}
    </Box>
  </Stack>
);

/* --- Options chain skeleton --- */
export const OptionsChainSkeleton = () => (
  <Stack spacing={2}>
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <MuiSkeleton variant="rectangular" width={160} height={40} animation="wave" sx={{ borderRadius: 1.5 }} />
      <MuiSkeleton variant="rectangular" width={128} height={40} animation="wave" sx={{ borderRadius: 1.5 }} />
      <MuiSkeleton variant="rectangular" width={96} height={40} animation="wave" sx={{ borderRadius: 1.5 }} />
    </Box>
    <SkeletonTable rows={10} cols={7} />
  </Stack>
);

/* --- Signals / Scanner skeleton --- */
export const SignalsSkeleton = () => (
  <Stack spacing={2}>
    <Box sx={{ display: 'flex', gap: 1 }}>
      {[...Array(4)].map((_, i) => (
        <MuiSkeleton key={i} variant="rectangular" width={96} height={36} animation="wave" sx={{ borderRadius: 1.5 }} />
      ))}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
      {[...Array(6)].map((_, i) => (
        <Paper key={i} sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <MuiSkeleton variant="text" width={96} height={22} animation="wave" />
              <MuiSkeleton variant="text" width={64} height={22} animation="wave" />
            </Box>
            <MuiSkeleton variant="text" width={128} height={28} animation="wave" />
            <SkeletonText lines={2} />
          </Stack>
        </Paper>
      ))}
    </Box>
  </Stack>
);

/* --- Market hub section skeleton --- */
export const MarketSkeleton = () => (
  <Stack spacing={3}>
    <SkeletonPage cards={4} cols={4} />
    <SkeletonChart />
    <SkeletonTable rows={6} cols={5} />
  </Stack>
);

export default Skeleton;
