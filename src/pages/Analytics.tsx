import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, CloudRain, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const tooltipStyle = {
  background: "hsl(225, 15%, 8%)",
  border: "1px solid hsl(225, 10%, 14%)",
  borderRadius: "12px",
  color: "hsl(210, 40%, 96%)",
  fontSize: "12px",
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
};

const COLORS = [
  "hsl(168, 80%, 48%)", "hsl(250, 70%, 62%)", "hsl(38, 95%, 55%)",
  "hsl(0, 84%, 60%)", "hsl(152, 70%, 50%)", "hsl(200, 70%, 55%)",
];

type WeatherTrend = { date: string; temperature: number; rainfall: number; aqi: number; humidity: number };
type ClaimTrend = { date: string; count: number; total_amount: number; avg_fraud: number };
type DisruptionTrend = { date: string; count: number; high: number; critical: number };
type ClaimsByType = { type: string; count: number };

const Analytics = () => {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);
  const [weatherTrends, setWeatherTrends] = useState<WeatherTrend[]>([]);
  const [claimTrends, setClaimTrends] = useState<ClaimTrend[]>([]);
  const [disruptionTrends, setDisruptionTrends] = useState<DisruptionTrend[]>([]);
  const [claimsByType, setClaimsByType] = useState<ClaimsByType[]>([]);
  const [stats, setStats] = useState({ totalClaims: 0, totalPaid: 0, avgProcessing: 0, activePolicies: 0 });

  const fetchAnalytics = async () => {
    setLoading(true);
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    try {
      const { data: weatherData } = await supabase
        .from('weather_readings')
        .select('recorded_at, temperature, rainfall, aqi, humidity')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
        .limit(1000);

      const weatherByDate: Record<string, { temps: number[]; rain: number[]; aqi: number[]; hum: number[] }> = {};
      weatherData?.forEach(w => {
        const date = new Date(w.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        if (!weatherByDate[date]) weatherByDate[date] = { temps: [], rain: [], aqi: [], hum: [] };
        if (w.temperature) weatherByDate[date].temps.push(Number(w.temperature));
        if (w.rainfall) weatherByDate[date].rain.push(Number(w.rainfall));
        if (w.aqi) weatherByDate[date].aqi.push(Number(w.aqi));
        if (w.humidity) weatherByDate[date].hum.push(Number(w.humidity));
      });

      const wTrends = Object.entries(weatherByDate).map(([date, v]) => ({
        date,
        temperature: +(v.temps.reduce((a, b) => a + b, 0) / (v.temps.length || 1)).toFixed(1),
        rainfall: +(v.rain.reduce((a, b) => a + b, 0) / (v.rain.length || 1)).toFixed(1),
        aqi: Math.round(v.aqi.reduce((a, b) => a + b, 0) / (v.aqi.length || 1)),
        humidity: Math.round(v.hum.reduce((a, b) => a + b, 0) / (v.hum.length || 1)),
      }));
      setWeatherTrends(wTrends);

      const { data: claimsData } = await supabase
        .from('claims')
        .select('created_at, amount, trigger_type, fraud_score, processing_time_seconds, status, paid_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1000);

      const claimsByDate: Record<string, { count: number; totalAmt: number; totalFraud: number }> = {};
      const typeCount: Record<string, number> = {};
      let totalPaid = 0;
      let totalProcessing = 0;
      let processingCount = 0;

      claimsData?.forEach(c => {
        const date = new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        if (!claimsByDate[date]) claimsByDate[date] = { count: 0, totalAmt: 0, totalFraud: 0 };
        claimsByDate[date].count++;
        claimsByDate[date].totalAmt += c.amount;
        claimsByDate[date].totalFraud += Number(c.fraud_score || 0);
        typeCount[c.trigger_type] = (typeCount[c.trigger_type] || 0) + 1;
        if (c.paid_at) totalPaid += c.amount;
        if (c.processing_time_seconds) { totalProcessing += c.processing_time_seconds; processingCount++; }
      });

      setClaimTrends(Object.entries(claimsByDate).map(([date, v]) => ({
        date, count: v.count, total_amount: v.totalAmt,
        avg_fraud: Math.round(v.totalFraud / (v.count || 1)),
      })));

      setClaimsByType(
        Object.entries(typeCount).length > 0
          ? Object.entries(typeCount).map(([type, count]) => ({ type, count }))
          : []
      );

      const { data: disruptionData } = await supabase
        .from('disruption_events')
        .select('started_at, severity')
        .gte('started_at', since)
        .order('started_at', { ascending: true })
        .limit(1000);

      const disruptByDate: Record<string, { count: number; high: number; critical: number }> = {};
      disruptionData?.forEach(d => {
        const date = new Date(d.started_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        if (!disruptByDate[date]) disruptByDate[date] = { count: 0, high: 0, critical: 0 };
        disruptByDate[date].count++;
        if (d.severity === 'high') disruptByDate[date].high++;
        if (d.severity === 'critical') disruptByDate[date].critical++;
      });

      setDisruptionTrends(Object.entries(disruptByDate).map(([date, v]) => ({
        date, count: v.count, high: v.high, critical: v.critical,
      })));

      const { count: policyCount } = await supabase
        .from('policies')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      setStats({
        totalClaims: claimsData?.length || 0,
        totalPaid,
        avgProcessing: processingCount > 0 ? Math.round(totalProcessing / processingCount) : 0,
        activePolicies: policyCount || 0,
      });

    } catch (err) {
      console.error('Analytics fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  // Re-fetch only on real DB changes (no infinite cache subscribe loop)
  useEffect(() => {
    const channel = supabase
      .channel(`analytics-rt-${timeRange}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => fetchAnalytics())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weather_readings' }, () => fetchAnalytics())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disruption_events' }, () => fetchAnalytics())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [timeRange]);

  const hasNoData = weatherTrends.length === 0 && claimTrends.length === 0 && disruptionTrends.length === 0;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="ambient-orb w-[400px] h-[400px] bg-primary/5 top-[5%] right-[-150px] animate-glow-pulse" />
      <div className="ambient-orb w-[300px] h-[300px] bg-secondary/4 bottom-[15%] left-[-100px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              <span className="gradient-text">Historical</span> Analytics
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Weather trends, claims history & disruption patterns</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-muted/20 border border-border/40 rounded-xl p-1">
              {(["7d", "30d", "90d"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    timeRange === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/15 px-3 py-2 rounded-lg border border-border/30">
              <Calendar className="h-3 w-3" />
              {timeRange}
            </div>
          </div>
        </div>

        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton className="h-72 rounded-2xl" />
            <div className="grid lg:grid-cols-2 gap-6">
              <Skeleton className="h-60 rounded-2xl" />
              <Skeleton className="h-60 rounded-2xl" />
            </div>
          </div>
        )}

        {!loading && hasNoData && (
          <div className="glass-card p-12 rounded-2xl text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">No Data Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Analytics will populate as weather readings, claims, and disruption events are recorded. 
              Visit the Dashboard to start collecting live data.
            </p>
          </div>
        )}

        {!loading && !hasNoData && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
              {[
                { label: "Total Claims", value: stats.totalClaims || 0, icon: BarChart3, color: "text-primary" },
                { label: "Total Paid", value: stats.totalPaid ? `₹${stats.totalPaid.toLocaleString()}` : '₹0', icon: TrendingUp, color: "text-success" },
                { label: "Avg Processing", value: stats.avgProcessing > 0 ? `${stats.avgProcessing}s` : '—', icon: AlertTriangle, color: "text-warning" },
                { label: "Active Policies", value: stats.activePolicies || 0, icon: Calendar, color: "text-secondary" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="stat-card p-5 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-foreground">{s.value}</div>
                </motion.div>
              ))}
            </div>

            {/* Weather Trends */}
            {weatherTrends.length > 0 && (
              <div className="glass-card p-6 md:p-7 rounded-2xl mb-6">
                <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                  <CloudRain className="h-5 w-5 text-primary" /> Weather Trends
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={weatherTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                    <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} interval="preserveStartEnd" />
                    <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="temperature" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} name="Temp °C" />
                    <Line type="monotone" dataKey="rainfall" stroke="hsl(200, 70%, 55%)" strokeWidth={2} dot={false} name="Rain mm" />
                    <Line type="monotone" dataKey="aqi" stroke="hsl(38, 95%, 55%)" strokeWidth={2} dot={false} name="AQI" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-5 mt-3 text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded bg-destructive" /> Temperature</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded" style={{ background: "hsl(200, 70%, 55%)" }} /> Rainfall</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded bg-warning" /> AQI</div>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* Claims Over Time */}
              {claimTrends.length > 0 && (
                <div className="glass-card p-6 md:p-7 rounded-2xl">
                  <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-secondary" /> Claims Volume
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={claimTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                      <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} interval="preserveStartEnd" />
                      <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="hsl(250, 70%, 62%)" radius={[4, 4, 0, 0]} opacity={0.8} name="Claims" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Claims by Trigger Type */}
              {claimsByType.length > 0 && (
                <div className="glass-card p-6 md:p-7 rounded-2xl">
                  <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" /> Claims by Trigger
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={claimsByType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="count" nameKey="type">
                        {claimsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
                    {claimsByType.map((d, i) => (
                      <div key={d.type} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground capitalize">{d.type} ({d.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Disruption Events Timeline */}
            {disruptionTrends.length > 0 && (
              <div className="glass-card p-6 md:p-7 rounded-2xl mb-6">
                <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" /> Disruption Events Over Time
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={disruptionTrends}>
                    <defs>
                      <linearGradient id="colorDisrupt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                    <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} interval="preserveStartEnd" />
                    <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="hsl(0, 84%, 60%)" fill="url(#colorDisrupt)" strokeWidth={2} name="Total" />
                    <Area type="monotone" dataKey="high" stroke="hsl(38, 95%, 55%)" fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="High" />
                    <Area type="monotone" dataKey="critical" stroke="hsl(0, 84%, 60%)" fill="none" strokeWidth={1.5} strokeDasharray="2 2" name="Critical" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Fraud Score Distribution */}
            {claimTrends.length > 0 && (
              <div className="glass-card p-6 md:p-7 rounded-2xl">
                <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Avg Fraud Score Over Time
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={claimTrends}>
                    <defs>
                      <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(168, 80%, 48%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(168, 80%, 48%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                    <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} interval="preserveStartEnd" />
                    <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="avg_fraud" stroke="hsl(168, 80%, 48%)" fill="url(#colorFraud)" strokeWidth={2} name="Avg Fraud Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Claims vs Weather Correlation */}
            {weatherTrends.length > 0 && claimTrends.length > 0 && (
              <div className="glass-card p-6 md:p-7 rounded-2xl mb-6">
                <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
                  <CloudRain className="h-5 w-5 text-secondary" /> Claims vs Weather Correlation
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={weatherTrends.map((w, i) => ({
                    ...w,
                    claims: claimTrends[i]?.count || 0,
                  }))}>
                    <defs>
                      <linearGradient id="colorCorr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(250, 70%, 62%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(250, 70%, 62%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                    <XAxis dataKey="date" stroke="hsl(215, 15%, 35%)" fontSize={10} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" stroke="hsl(215, 15%, 35%)" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(215, 15%, 35%)" fontSize={10} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line yAxisId="left" type="monotone" dataKey="rainfall" stroke="hsl(200, 70%, 55%)" strokeWidth={2} dot={false} name="Rainfall mm" />
                    <Area yAxisId="right" type="monotone" dataKey="claims" stroke="hsl(250, 70%, 62%)" fill="url(#colorCorr)" strokeWidth={2} name="Claims" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-5 mt-3 text-xs">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded" style={{ background: "hsl(200, 70%, 55%)" }} /> Rainfall</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded bg-secondary" /> Claims</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
