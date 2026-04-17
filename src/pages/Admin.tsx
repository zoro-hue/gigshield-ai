import { motion } from "framer-motion";
import { Shield, Users, TrendingUp, AlertTriangle, IndianRupee, Brain, BarChart3, PieChart as PieChartIcon, Radio, Activity } from "lucide-react";
import Navbar from "@/components/Navbar";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import GPSHeatmap from "@/components/admin/GPSHeatmap";
import AnomalyTimeline from "@/components/admin/AnomalyTimeline";
import WorkerBehaviorScoring from "@/components/admin/WorkerBehaviorScoring";
import PredictiveInsights from "@/components/PredictiveInsights";
import TiltCard from "@/components/TiltCard";
import Sparkline from "@/components/Sparkline";
import ActivityFeed from "@/components/ActivityFeed";
import { useAnimatedCounter, useLiveActivityFeed, useLiveSparkline } from "@/hooks/useRealtimeData";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminStats {
  activePolicies: number;
  totalWorkers: number;
  weeklyRevenue: number;
  lossRatio: number;
  totalClaimsPaid: number;
  totalPremiumCollected: number;
  totalClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
}

function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const { count: activePolicies } = await supabase
        .from('policies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: totalWorkers } = await supabase
        .from('worker_profiles')
        .select('*', { count: 'exact', head: true });

      // Weekly revenue from active policies
      const { data: policyData } = await supabase
        .from('policies')
        .select('weekly_premium')
        .eq('status', 'active');
      const weeklyRevenue = policyData?.reduce((sum, p) => sum + (p.weekly_premium || 0), 0) || 0;

      // Total payouts from transactions (credited)
      const { data: creditedTxns } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'payout')
        .eq('status', 'credited');
      const totalClaimsPaid = creditedTxns?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      // Total premiums collected = weekly_premium * (renewed_count + 1) for all policies
      const { data: allPolicies } = await supabase
        .from('policies')
        .select('weekly_premium, renewed_count');
      const totalPremiumCollected = allPolicies?.reduce((sum, p) => sum + (p.weekly_premium || 0) * ((p.renewed_count || 0) + 1), 0) || 0;

      const lossRatio = totalPremiumCollected > 0 ? (totalClaimsPaid / totalPremiumCollected) * 100 : 0;

      // Claims overview
      const { count: totalClaims } = await supabase.from('claims').select('*', { count: 'exact', head: true });
      const { count: approvedClaims } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'paid');
      const { count: rejectedClaims } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('fraud_check_passed', false);

      setStats({
        activePolicies: activePolicies || 0,
        totalWorkers: totalWorkers || 0,
        weeklyRevenue,
        lossRatio: Math.min(lossRatio, 999),
        totalClaimsPaid,
        totalPremiumCollected: totalPremiumCollected || 1,
        totalClaims: totalClaims || 0,
        approvedClaims: approvedClaims || 0,
        rejectedClaims: rejectedClaims || 0,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Admin stats fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Rely on global-sync for real-time updates — no duplicate channel
  }, []);

  return { stats, loading, lastUpdated, refetch: fetchStats };
}

function useClaimsByType() {
  const [data, setData] = useState<Array<{ name: string; value: number; color: string }>>([]);

  const fetchData = async () => {
    const { data: claims } = await supabase
      .from('claims')
      .select('trigger_type, fraud_check_passed');

    if (!claims || claims.length === 0) return;

    const legitimate = claims.filter(c => c.fraud_check_passed !== false).length;
    const flagged = claims.filter(c => c.fraud_check_passed === false).length;

    setData([
      { name: "Legitimate", value: legitimate, color: "hsl(152, 70%, 50%)" },
      { name: "Flagged", value: flagged, color: "hsl(38, 95%, 55%)" },
    ]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return data;
}

function useRecentFraudAlerts() {
  const [alerts, setAlerts] = useState<Array<{ id: string; type: string; worker: string; score: number; action: string }>>([]);

  const fetchAlerts = async () => {
    const { data: gpsLogs } = await supabase
      .from('gps_logs')
      .select('id, user_id, anomaly_score, flagged_reason, is_spoofed')
      .or('is_spoofed.eq.true,anomaly_score.gt.0.5')
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (gpsLogs && gpsLogs.length > 0) {
      setAlerts(gpsLogs.map(g => ({
        id: g.id.slice(0, 8).toUpperCase(),
        type: g.flagged_reason || (g.is_spoofed ? 'GPS Spoofing' : 'Anomaly'),
        worker: g.user_id.slice(0, 8),
        score: Math.round((Number(g.anomaly_score) || 0) * 100),
        action: g.is_spoofed ? 'Auto-blocked' : 'Under review',
      })));
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return alerts;
}

const tooltipStyle = {
  background: "hsl(225, 15%, 8%)",
  border: "1px solid hsl(225, 10%, 14%)",
  borderRadius: "12px",
  color: "hsl(210, 40%, 96%)",
  fontSize: "12px",
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
};

const Admin = () => {
  const { stats, loading, lastUpdated } = useAdminStats();
  const fraudData = useClaimsByType();
  const fraudAlerts = useRecentFraudAlerts();
  const activityEvents = useLiveActivityFeed(5);

  const policiesCount = useAnimatedCounter(stats?.activePolicies || 0);
  const workersCount = useAnimatedCounter(stats?.totalWorkers || 0);
  const lossCount = useAnimatedCounter(Math.round((stats?.lossRatio || 0) * 10));
  const revenueCount = useAnimatedCounter(stats?.weeklyRevenue || 0);

  const spark1 = useLiveSparkline(15);
  const spark2 = useLiveSparkline(15);

  const kpis = [
    { label: "Active Policies", value: loading ? '—' : policiesCount.toLocaleString(), icon: Shield, spark: spark1, sparkColor: "hsl(168, 80%, 48%)" },
    { label: "Total Workers", value: loading ? '—' : workersCount.toLocaleString(), icon: Users, spark: spark2, sparkColor: "hsl(250, 70%, 62%)" },
    { label: "Loss Ratio", value: loading ? '—' : `${(lossCount / 10).toFixed(1)}%`, icon: TrendingUp, spark: spark1, sparkColor: "hsl(38, 95%, 55%)" },
    { label: "Revenue (Weekly)", value: loading ? '—' : `₹${revenueCount.toLocaleString()}`, icon: IndianRupee, spark: spark2, sparkColor: "hsl(152, 70%, 50%)" },
  ];

  return (
    <div className="min-h-screen bg-background relative">
      <div className="ambient-orb w-[400px] h-[400px] bg-secondary/5 top-[10%] left-[-150px] animate-glow-pulse" />
      <div className="ambient-orb w-[300px] h-[300px] bg-warning/4 bottom-[20%] right-[-100px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              <span className="gradient-text">Admin</span> Intelligence
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Insurer analytics, fraud detection & predictive models</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground font-mono bg-muted/15 px-2 py-1 rounded-md border border-border/30">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/15 px-3 py-2 rounded-lg border border-border/30">
              <Radio className="h-3 w-3 text-primary animate-pulse" />
              LIVE DATA
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          {kpis.map((s, i) => (
            <TiltCard key={s.label} className="stat-card rounded-2xl" intensity={8}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  {s.spark.length > 0 && <Sparkline data={s.spark} color={s.sparkColor} width={55} height={22} />}
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24 mb-1" />
                ) : (
                  <div className="font-display text-2xl font-bold text-foreground">{s.value}</div>
                )}
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </motion.div>
            </TiltCard>
          ))}
        </div>

        {/* Insurer Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-5 rounded-2xl">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Premiums Collected</div>
            <div className="font-display text-2xl font-bold text-foreground">₹{(stats?.totalPremiumCollected ?? 0).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-1">From active policies</div>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Payouts</div>
            <div className="font-display text-2xl font-bold text-success">₹{(stats?.totalClaimsPaid ?? 0).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Claims paid out</div>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Loss Ratio</div>
            <div className={`font-display text-2xl font-bold ${(stats?.lossRatio ?? 0) > 100 ? 'text-destructive' : (stats?.lossRatio ?? 0) > 70 ? 'text-warning' : 'text-success'}`}>
              {(stats?.lossRatio ?? 0).toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Payouts / Premiums</div>
          </div>
        </div>

        {/* Claims Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-5 rounded-2xl">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Claims</div>
            <div className="font-display text-2xl font-bold text-foreground">{stats?.totalClaims ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-1">All time</div>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Approved / Paid</div>
            <div className="font-display text-2xl font-bold text-success">{stats?.approvedClaims ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Successfully processed</div>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rejected / Flagged</div>
            <div className="font-display text-2xl font-bold text-destructive">{stats?.rejectedClaims ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Fraud check failed</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2 grid grid-cols-1 gap-5">
            {/* Predictive Analytics */}
            <PredictiveInsights />

            {/* AI Risk Assessments */}
            <div className="glass-card p-6 md:p-7 rounded-2xl">
              <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                <Brain className="h-5 w-5 text-secondary" /> AI Risk Assessments
              </h3>
              <RiskAssessmentChart />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" /> Claim Integrity
              </h3>
              {fraudData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={fraudData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                        {fraudData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-3 mt-2 text-xs">
                    {fraudData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.name} ({d.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">No claims data available</div>
              )}
            </div>

            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-semibold">Live Alerts</h3>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                </span>
              </div>
              {activityEvents.length > 0 ? (
                <ActivityFeed events={activityEvents} />
              ) : (
                <div className="text-muted-foreground text-xs text-center py-4">No recent activity</div>
              )}
            </div>
          </div>
        </div>

        {/* Fraud Alerts Table */}
        <div className="glass-card p-6 md:p-7 rounded-2xl mb-10">
          <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Fraud Detection Alerts
          </h3>
          {fraudAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Alert ID", "Type", "Worker", "Score", "Action"].map(h => (
                      <th key={h} className="text-left py-2.5 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fraudAlerts.map((a, i) => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                      className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono text-destructive text-xs">{a.id}</td>
                      <td className="py-3 px-3 text-foreground/80">{a.type}</td>
                      <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{a.worker}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${a.score}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} className="h-full rounded-full bg-destructive/80" />
                          </div>
                          <span className="text-destructive font-semibold text-xs">{a.score}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.action === "Auto-blocked" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{a.action}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">No fraud alerts detected</div>
          )}
        </div>

        {/* Advanced Fraud */}
        <div className="section-divider mb-10" />
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            <span className="gradient-text">Advanced</span> Fraud Intelligence
          </h2>
          <div className="grid lg:grid-cols-2 gap-5">
            <GPSHeatmap />
            <AnomalyTimeline />
          </div>
          <WorkerBehaviorScoring />
        </div>
      </div>
    </div>
  );
};

// Sub-component: Risk assessment chart from DB
function RiskAssessmentChart() {
  const [data, setData] = useState<Array<{ city: string; score: number }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'];
    const results: Array<{ city: string; score: number }> = [];

    for (const city of cities) {
      const { data: latest } = await supabase
        .from('risk_assessments')
        .select('risk_score, city')
        .eq('city', city)
        .not('risk_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.risk_score != null) {
        results.push({ city, score: Math.round(Number(latest.risk_score) * 100) });
      }
    }

    setData(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <Skeleton className="h-[220px] w-full" />;
  if (data.length === 0) return <div className="text-center py-10 text-muted-foreground text-sm">No AI risk data available yet</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
        <XAxis dataKey="city" stroke="hsl(215, 15%, 35%)" fontSize={11} />
        <YAxis stroke="hsl(215, 15%, 35%)" fontSize={11} domain={[0, 100]} />
        <Tooltip contentStyle={{
          background: "hsl(225, 15%, 8%)",
          border: "1px solid hsl(225, 10%, 14%)",
          borderRadius: "12px",
          color: "hsl(210, 40%, 96%)",
          fontSize: "12px",
        }} />
        <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} opacity={0.8} name="Risk Score %" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default Admin;
