// Skeleton loading components — shimmer placeholders for async content
import { cn } from '../../lib/utils';

/* ─── base shimmer bar ─── */
export const Skeleton = ({ className, ...props }) => (
  <div className={cn('skeleton', className)} {...props} />
);

/* ─── text lines ─── */
export const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)}>
    {[...Array(lines)].map((_, i) => (
      <Skeleton
        key={i}
        className={cn('h-4 rounded', i === lines - 1 ? 'w-3/4' : 'w-full')}
      />
    ))}
  </div>
);

/* ─── stat card (index card, KPI) ─── */
export const SkeletonCard = ({ className }) => (
  <div className={cn('glass-card rounded-2xl p-5 space-y-3', className)}>
    <Skeleton className="h-4 w-1/3 rounded" />
    <Skeleton className="h-8 w-2/3 rounded" />
    <Skeleton className="h-3 w-1/2 rounded" />
  </div>
);

/* ─── table rows ─── */
export const SkeletonTable = ({ rows = 5, cols = 4, className }) => (
  <div className={cn('glass-card rounded-2xl overflow-hidden', className)}>
    {/* header */}
    <div className="flex gap-4 p-4 border-b border-white/[0.06]">
      {[...Array(cols)].map((_, c) => (
        <Skeleton key={c} className="h-4 flex-1 rounded" />
      ))}
    </div>
    {/* rows */}
    {[...Array(rows)].map((_, r) => (
      <div key={r} className="flex gap-4 p-4 border-b border-white/[0.04]">
        {[...Array(cols)].map((_, c) => (
          <Skeleton key={c} className="h-4 flex-1 rounded" />
        ))}
      </div>
    ))}
  </div>
);

/* ─── chart area ─── */
export const SkeletonChart = ({ className }) => (
  <div className={cn('glass-card rounded-2xl p-5', className)}>
    <Skeleton className="h-4 w-1/4 rounded mb-4" />
    <Skeleton className="h-48 w-full rounded-xl" />
  </div>
);

/* ─── page-level skeleton: grid of cards ─── */
export const SkeletonPage = ({ cards = 6, cols = 3 }) => (
  <div className={cn(
    'grid gap-4',
    cols === 2 && 'grid-cols-1 md:grid-cols-2',
    cols === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    cols === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    cols === 6 && 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  )}>
    {[...Array(cards)].map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

/* ─── Dashboard-specific skeleton ─── */
export const DashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Index cards */}
    <SkeletonPage cards={6} cols={6} />
    {/* Chart + Table row */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SkeletonChart className="lg:col-span-2" />
      <SkeletonTable rows={4} cols={2} />
    </div>
    {/* Sector heatmap */}
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {[...Array(11)].map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  </div>
);

/* ─── Options chain skeleton ─── */
export const OptionsChainSkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-3">
      <Skeleton className="h-10 w-40 rounded-lg" />
      <Skeleton className="h-10 w-32 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
    <SkeletonTable rows={10} cols={7} />
  </div>
);

/* ─── Signals / Scanner skeleton ─── */
export const SignalsSkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-2">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-lg" />
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <Skeleton className="h-7 w-32 rounded" />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  </div>
);

/* ─── Market hub section skeleton ─── */
export const MarketSkeleton = () => (
  <div className="space-y-6">
    <SkeletonPage cards={4} cols={4} />
    <SkeletonChart />
    <SkeletonTable rows={6} cols={5} />
  </div>
);

export default Skeleton;
