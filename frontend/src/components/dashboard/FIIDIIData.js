// Dashboard — FII/DII Activity Card
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui';
import { cn, fetchAPI } from '../../lib/utils';

const FIIDIIData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchAPI('/fii-dii-data');
        const cashData = Array.isArray(result) ? result[0] : result;
        setData({
          fii: {
            buyValue: Number(cashData?.fii_buy) || 0,
            sellValue: Number(cashData?.fii_sell) || 0,
            netValue: Number(cashData?.fii_net) || 0
          },
          dii: {
            buyValue: Number(cashData?.dii_buy) || 0,
            sellValue: Number(cashData?.dii_sell) || 0,
            netValue: Number(cashData?.dii_net) || 0
          },
        });
      } catch (error) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="h-48 skeleton rounded-2xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">FII/DII Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* FII */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">FII</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn(
              'text-2xl font-bold',
              (data?.fii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {(data?.fii?.netValue || 0) >= 0 ? '+' : ''}{(data?.fii?.netValue || 0).toFixed(0)} Cr
            </p>
            <p className="text-xs text-muted-foreground">Net Activity</p>
          </div>

          {/* DII */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">DII</span>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={cn(
              'text-2xl font-bold',
              (data?.dii?.netValue || 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {(data?.dii?.netValue || 0) >= 0 ? '+' : ''}{(data?.dii?.netValue || 0).toFixed(0)} Cr
            </p>
            <p className="text-xs text-muted-foreground">Net Activity</p>
          </div>
        </div>

        <Link
          to="/market"
          className="flex items-center justify-center gap-1 text-sm text-primary mt-4 hover:underline"
        >
          View detailed analysis
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
};

export default FIIDIIData;
