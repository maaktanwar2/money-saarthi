// AI Agent — StatCard sub-component
import { tw } from '../../lib/colorMap';
import { Card, CardContent } from '../ui';
import { cn } from '../../lib/utils';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <Card className="bg-card/60 border-border/50">
    <CardContent className="p-4">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tw(color, 'bg10'))}>
          <Icon className={cn("w-4 h-4", tw(color, 'text400'))} />
        </div>
      </div>
      <div className={cn("text-2xl font-bold", tw(color, 'text400'))}>{value}</div>
      {subtitle && <div className="text-[11px] text-muted-foreground/60 mt-1">{subtitle}</div>}
    </CardContent>
  </Card>
);

export default StatCard;
