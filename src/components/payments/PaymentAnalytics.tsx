import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Zap, AlertTriangle, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const tooltipStyle = {
  background: "hsl(225, 15%, 8%)",
  border: "1px solid hsl(225, 10%, 14%)",
  borderRadius: "12px",
  color: "hsl(210, 40%, 96%)",
  fontSize: "12px",
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
};

type WeeklyCollection = { week: string; collected: number };
type PayoutDay = { day: string; avgTime: number; count: number };

const PaymentAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [collectionData, setCollectionData] = useState<WeeklyCollection[]>([]);
  const [payoutData, setPayoutData] = useState<PayoutDay[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ status: string; count: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Weekly premium collection from policies
        const { data: policies } = await supabase
          .from('policies')
          .select('weekly_premium, activated_at')
          .eq('status', 'active')
          .order('activated_at', { ascending: true });

        const weeklyMap: Record<string, number> = {};
        policies?.forEach(p => {
          const week = `W${Math.ceil(new Date(p.activated_at).getDate() / 7)}`;
          weeklyMap[week] = (weeklyMap[week] || 0) + (p.weekly_premium || 0);
        });
        setCollectionData(Object.entries(weeklyMap).map(([week, collected]) => ({ week, collected })));

        // Payout velocity from claims
        const { data: claims } = await supabase
          .from('claims')
          .select('processing_time_seconds, created_at, status, paid_at')
          .order('created_at', { ascending: false })
          .limit(100);

        const dayMap: Record<string, { totalTime: number; count: number }> = {};
        const statusMap: Record<string, number> = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        claims?.forEach(c => {
          const day = days[new Date(c.created_at).getDay()];
          if (!dayMap[day]) dayMap[day] = { totalTime: 0, count: 0 };
          dayMap[day].count++;
          if (c.processing_time_seconds) dayMap[day].totalTime += c.processing_time_seconds;
          statusMap[c.status] = (statusMap[c.status] || 0) + 1;
        });

        setPayoutData(days.filter(d => dayMap[d]).map(d => ({
          day: d,
          avgTime: dayMap[d].count > 0 ? Math.round(dayMap[d].totalTime / dayMap[d].count) : 0,
          count: dayMap[d].count,
        })));

        setStatusBreakdown(Object.entries(statusMap).map(([status, count]) => ({ status, count })));
      } catch (err) {
        console.error('Payment analytics fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel('payment-analytics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'policies' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-tight"><span className="gradient-text">Payment</span> Analytics</h2>
        <div className="grid lg:grid-cols-2 gap-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const hasNoData = collectionData.length === 0 && payoutData.length === 0;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold tracking-tight">
        <span className="gradient-text">Payment</span> Analytics
      </h2>

      {hasNoData ? (
        <div className="glass-card p-12 rounded-2xl text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">No Payment Data Yet</h3>
          <p className="text-muted-foreground text-sm">Analytics will populate as policies and claims are processed.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {collectionData.length > 0 && (
            <div className="glass-card p-6 md:p-7 rounded-2xl">
              <h3 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" /> Collection Trends
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Weekly premium collection from active policies</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={collectionData}>
                  <defs>
                    <linearGradient id="collectFillReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 70%, 50%)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(152, 70%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                  <XAxis dataKey="week" stroke="hsl(215, 15%, 35%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 15%, 35%)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="collected" stroke="hsl(152, 70%, 50%)" fill="url(#collectFillReal)" strokeWidth={2} name="Collected (₹)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {payoutData.length > 0 && (
            <div className="glass-card p-6 md:p-7 rounded-2xl">
              <h3 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
                <Zap className="h-5 w-5 text-warning" /> Payout Velocity
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Average payout time (s) & volume by day</p>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={payoutData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                  <XAxis dataKey="day" stroke="hsl(215, 15%, 35%)" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(215, 15%, 35%)" fontSize={12} unit="s" />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(215, 15%, 35%)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar yAxisId="right" dataKey="count" fill="hsl(168, 80%, 48%)" radius={[6, 6, 0, 0]} opacity={0.25} name="Count" />
                  <Line yAxisId="left" type="monotone" dataKey="avgTime" stroke="hsl(38, 95%, 55%)" strokeWidth={2.5} dot={{ fill: "hsl(38, 95%, 55%)", r: 4 }} name="Avg Time (s)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {statusBreakdown.length > 0 && (
        <div className="glass-card p-6 md:p-7 rounded-2xl">
          <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Claim Status Breakdown
          </h3>
          <div className="space-y-3">
            {statusBreakdown.map((s, i) => {
              const total = statusBreakdown.reduce((acc, v) => acc + v.count, 0);
              const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
              const color = s.status === 'paid' ? 'bg-success' : s.status === 'processing' ? 'bg-warning' : 'bg-primary';
              return (
                <motion.div key={s.status} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-foreground/80 capitalize">{s.status}</span>
                    <span className="text-muted-foreground text-xs font-mono">{s.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted/15 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.06 + 0.2, duration: 0.6 }} className={`h-full rounded-full ${color}/60`} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentAnalytics;
