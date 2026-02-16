/**
 * Activity Feed - Real-time event log for trading bots
 * Shows bot events, trades, adjustments, and AI decisions
 */
import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Square, ArrowUpRight, ArrowDownRight, RefreshCw, 
  Brain, AlertCircle, Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../ui';
import { cn, formatINR } from '../../lib/utils';

const EVENT_TYPES = {
  bot_start: { icon: Play, color: 'green', label: 'Bot Started' },
  bot_stop: { icon: Square, color: 'red', label: 'Bot Stopped' },
  trade_buy: { icon: ArrowUpRight, color: 'green', label: 'Buy' },
  trade_sell: { icon: ArrowDownRight, color: 'red', label: 'Sell' },
  adjustment: { icon: RefreshCw, color: 'blue', label: 'Adjustment' },
  ai_decision: { icon: Brain, color: 'purple', label: 'AI Decision' },
  alert: { icon: AlertCircle, color: 'amber', label: 'Alert' },
};

const colorClasses = {
  green: { bg: 'bg-green-500/20', text: 'text-green-500' },
  red: { bg: 'bg-red-500/20', text: 'text-red-500' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
};

const ActivityFeed = ({ events = [], className }) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-primary" />
          Activity Feed
          <Badge variant="secondary" className="ml-auto text-xs">
            {events.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="max-h-[350px] overflow-y-auto pr-2">
          {events.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No activity yet</p>
                <p className="text-xs mt-1">Events will appear here when bots are running</p>
              </div>
            </div>
          ) : (
            <div className="relative pl-8">
              {/* Vertical timeline line */}
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              
              {events.map((event, i) => {
                const config = EVENT_TYPES[event.type] || EVENT_TYPES.alert;
                const Icon = config.icon;
                const colors = colorClasses[config.color] || colorClasses.amber;
                
                return (
                  <motion.div
                    key={event.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className="relative mb-3 last:mb-0"
                  >
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-5 w-6 h-6 rounded-full flex items-center justify-center",
                      colors.bg
                    )}>
                      <Icon className={cn("w-3 h-3", colors.text)} />
                    </div>
                    
                    {/* Event content */}
                    <div className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{config.label}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {event.timestamp 
                            ? new Date(event.timestamp).toLocaleTimeString('en-IN', { 
                                hour: '2-digit', minute: '2-digit', second: '2-digit' 
                              }) 
                            : ''
                          }
                        </span>
                      </div>
                      {event.message && (
                        <p className="text-xs text-muted-foreground mt-1">{event.message}</p>
                      )}
                      {event.pnl !== undefined && (
                        <span className={cn(
                          "text-xs font-mono font-medium",
                          event.pnl >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {event.pnl >= 0 ? '+' : ''}{formatINR(event.pnl)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(ActivityFeed);
