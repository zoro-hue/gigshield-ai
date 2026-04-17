import { motion } from "framer-motion";
import { Shield, CloudRain, Zap, TrendingUp, Clock, IndianRupee, CheckCircle2, ThermometerSun, Wind, Droplets, Activity, Radio, Wifi, WifiOff, Car, CalendarClock, CloudLightning, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import AIInsightsCard from "@/components/AIInsightsCard";
import AIRiskDisplay from "@/components/AIRiskDisplay";
import ClaimCard from "@/components/ClaimCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { useAIRisk } from "@/hooks/useAIRisk";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import TiltCard from "@/components/TiltCard";
import Sparkline from "@/components/Sparkline";
import ActivityFeed from "@/components/ActivityFeed";
import StatusRing from "@/components/StatusRing";
import { useAnimatedCounter, useLiveActivityFeed, useLiveSparkline } from "@/hooks/useRealtimeData";
import { useLiveWeather, useLiveTraffic, useRecentClaims } from "@/hooks/useLiveData";
import { useActivePolicy } from "@/hooks/useActivePolicy";
import { useDashboardMetrics } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const tooltipStyle = {
  background: "hsl(225, 15%, 8%)",
  border: "1px solid hsl(225, 10%, 14%)",
  borderRadius: "12px",
  color: "hsl(210, 40%, 96%)",
  fontSize: "12px",
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "weather" | "traffic" | "claims">("overview");
  const [selectedCity, setSelectedCity] = useState("Mumbai");
  const { weather, loading: weatherLoading, isLive } = useLiveWeather(selectedCity, 60000);
  const { traffic, loading: trafficLoading, isLive: trafficLive } = useLiveTraffic(selectedCity, 120000);
  const { policy, hasActivePolicy } = useActivePolicy();
  const { data: metrics } = useDashboardMetrics();
  const { claims: dbClaims, loading: claimsLoading } = useRecentClaims();
  const activityEvents = useLiveActivityFeed(6);
  const { user } = useAuth();
  const { assessment: aiRisk, state: aiState, refetch: refetchAI } = useAIRisk(selectedCity);
  const [userName, setUserName] = useState("Worker");
  const [earningsData, setEarningsData] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);
  const queryClient = useQueryClient();

  const simulateRainstorm = async () => {
    if (!user) { toast.error("Please sign in first"); return; }
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('demo-simulate', {
        body: { city: selectedCity, intensity: 'high' },
      });
      if (error) throw error;
      toast.success(data.message || `Demo: Rainstorm simulation complete in ${selectedCity}`);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    const metaName = user?.user_metadata?.full_name;
    if (metaName) { setUserName(metaName); return; }
    if (!user?.id) return;
    supabase.from('worker_profiles').select('full_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setUserName(data.full_name); });
  }, [user]);

  // Build earnings chart from real claims data
  useEffect(() => {
    if (dbClaims.length > 0) {
      const weeklyData: Record<string, { earnings: number; protected: number }> = {};
      dbClaims.forEach(c => {
        const week = `W${Math.ceil((new Date(c.created_at).getDate()) / 7)}`;
        if (!weeklyData[week]) weeklyData[week] = { earnings: 0, protected: 0 };
        if (c.status === 'paid') weeklyData[week].protected += c.amount;
        weeklyData[week].earnings += c.amount;
      });
      const chartData = Object.entries(weeklyData).map(([week, v]) => ({ week, ...v }));
      setEarningsData(chartData.length > 0 ? chartData : []);
    }
  }, [dbClaims]);

  const sparklineData = useLiveSparkline(20);

  const weeklyPremium = policy?.weekly_premium || 0;
  // Safety cap: never display max_payout above ₹5,000 (reasonable weekly income replacement)
  const maxPayout = Math.min(policy?.max_payout || 0, 5000);
  const totalPaidOut = metrics?.totalPayouts ?? 0;
  const avgProcessingTime = dbClaims.length > 0
    ? Math.round(dbClaims.filter(c => c.processing_time_seconds).reduce((s, c) => s + (c.processing_time_seconds || 0), 0) / Math.max(dbClaims.filter(c => c.processing_time_seconds).length, 1))
    : 0;

  const premiumCounter = useAnimatedCounter(weeklyPremium);
  const protectedCounter = useAnimatedCounter(totalPaidOut);
  const speedCounter = useAnimatedCounter(avgProcessingTime);

  const [liveTime, setLiveTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const getNextMonday = () => {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    return next.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const policyExpiry = policy?.expires_at
    ? new Date(policy.expires_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const statsConfig = [
    { label: "Weekly Premium", value: weeklyPremium > 0 ? `₹${premiumCounter}` : '—', icon: IndianRupee, sub: weeklyPremium > 0 ? `Renews: ${getNextMonday()}` : 'No active policy', spark: sparklineData, sparkColor: "hsl(168, 80%, 48%)" },
    { label: "Total Protected", value: totalPaidOut > 0 ? `₹${protectedCounter.toLocaleString()}` : '₹0', icon: Shield, sub: "Claims paid out", spark: sparklineData, sparkColor: "hsl(250, 70%, 62%)" },
    { label: "Avg Payout Speed", value: avgProcessingTime > 0 ? `${speedCounter}s` : '—', icon: Clock, sub: dbClaims.length > 0 ? `${dbClaims.length} claims` : 'No claims yet', spark: sparklineData, sparkColor: "hsl(38, 95%, 55%)" },
    { label: "Risk Score", value: weather ? `${weather.aqi > 300 ? 'High' : weather.aqi > 150 ? 'Med' : 'Low'}` : '—', icon: TrendingUp, sub: weather?.source || '—', spark: sparklineData, sparkColor: "hsl(152, 70%, 50%)" },
  ];

  const severeTrafficCount = traffic.filter(t => t.status === 'severe' || t.status === 'blocked').length;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="ambient-orb w-[500px] h-[500px] bg-primary/6 top-[0%] right-[-150px] animate-glow-pulse" />
      <div className="ambient-orb w-[350px] h-[350px] bg-secondary/4 bottom-[10%] left-[-100px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              Welcome back, <span className="gradient-text">{userName}</span>
            </motion.h1>
            <p className="text-muted-foreground mt-1 text-sm">Your income protection is active • {selectedCity}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={simulateRainstorm}
              disabled={simulating}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-warning/30 bg-warning/8 text-warning hover:bg-warning/15 transition-all disabled:opacity-50"
            >
              {simulating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudLightning className="h-3 w-3" />}
              {simulating ? 'Simulating...' : 'Simulate Rainstorm'}
            </button>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-muted/15 border border-border/30 rounded-lg px-3 py-2 text-xs text-foreground font-mono"
            >
              {["Mumbai","Delhi","Bangalore","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/15 px-3 py-2 rounded-lg border border-border/30">
              <Radio className="h-3 w-3 text-primary animate-pulse" />
              LIVE {liveTime.toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-2 bg-success/8 border border-success/15 px-4 py-2.5 rounded-xl">
              <div className="pulse-dot" />
              <span className="text-sm text-success font-medium">{policy ? 'Coverage Active' : 'No Policy'}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          {statsConfig.map((s, i) => (
            <TiltCard key={s.label} className="stat-card rounded-2xl" intensity={8}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  {s.spark.length > 0 && <Sparkline data={s.spark} color={s.sparkColor} width={60} height={24} />}
                </div>
                <div className="font-display text-2xl font-bold text-foreground">{s.value}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.sub}</span>
                </div>
              </motion.div>
            </TiltCard>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/20 border border-border/40 rounded-xl p-1 w-fit">
          {(["overview", "weather", "traffic", "claims"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300 capitalize ${
                activeTab === tab ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeTab === tab && (
                <motion.div layoutId="dash-tab" className="absolute inset-0 bg-primary rounded-lg shadow-[0_0_16px_hsl(168_80%_48%/0.2)]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab}
                {tab === 'traffic' && severeTrafficCount > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-[9px] rounded-full px-1.5 py-0.5 font-bold">{severeTrafficCount}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 glass-card p-6 md:p-7 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-semibold">Earnings & Protection</h3>
                <div className="flex items-center gap-1.5 text-[10px] text-primary font-mono bg-primary/5 border border-primary/10 px-2 py-1 rounded-md">
                  <Activity className="h-3 w-3" /> {dbClaims.length > 0 ? 'FROM DB' : 'NO DATA'}
                </div>
              </div>
              {earningsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={earningsData}>
                    <defs>
                      <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(168, 80%, 48%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(168, 80%, 48%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProtected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(250, 70%, 62%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(250, 70%, 62%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
                    <XAxis dataKey="week" stroke="hsl(215, 15%, 35%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 15%, 35%)" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="earnings" stroke="hsl(168, 80%, 48%)" fillOpacity={1} fill="url(#colorEarnings)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="protected" stroke="hsl(250, 70%, 62%)" fillOpacity={1} fill="url(#colorProtected)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  No claims data yet. Charts will appear as claims are processed.
                </div>
              )}
              {earningsData.length > 0 && (
                <div className="flex gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /> Earnings</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-secondary" /> Protected</div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <TiltCard className="glass-card rounded-2xl" intensity={6}>
                <div className="p-6">
                  <h3 className="font-display text-lg font-semibold mb-4">Active Policy</h3>
                  {policy ? (
                    <>
                      <div className="gradient-border p-3 mb-4">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Policy ID</div>
                        <div className="font-mono font-bold text-primary text-sm mt-0.5">
                          GS-{policy.id.slice(0, 8).toUpperCase()}
                        </div>
                      </div>
                      <div className="space-y-2.5 text-sm">
                        {[
                          ["Premium", `₹${policy.weekly_premium}/wk`],
                          ["Max Payout", `₹${Math.min(policy.max_payout, 5000).toLocaleString()}/wk`],
                          ["Valid Until", policyExpiry],
                          ["Renewals", `${policy.renewed_count || 0} times`],
                          ["Next Renewal", getNextMonday()],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-muted-foreground text-xs">{k}</span>
                            <span className="font-medium text-xs text-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={async () => {
                          if (!user || !policy) return;
                          try {
                            const newExpiry = new Date();
                            newExpiry.setDate(newExpiry.getDate() + 7);
                            const { error } = await supabase
                              .from('policies')
                              .update({
                                renewed_count: (policy.renewed_count || 0) + 1,
                                expires_at: newExpiry.toISOString(),
                                activated_at: new Date().toISOString(),
                              })
                              .eq('id', policy.id);
                            if (error) throw error;
                            queryClient.invalidateQueries();
                            toast.success("Policy renewed successfully!");
                          } catch (err: any) {
                            toast.error(err.message || "Renewal failed");
                          }
                        }}
                        className="glow-button w-full mt-4 py-2.5 rounded-xl text-sm"
                      >Renew Now</button>
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No active policy. Complete onboarding to get started.
                    </div>
                  )}
                </div>
              </TiltCard>

              <AIRiskDisplay
                assessment={aiRisk}
                state={aiState}
                onRefetch={refetchAI}
              />

              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-semibold">Live Activity</h3>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
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
        )}

        {activeTab === "weather" && (
          <div className="space-y-5">
            <div className="glass-card p-6 md:p-7 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                  <CloudRain className="h-5 w-5 text-primary" /> Live Weather Monitoring
                </h3>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/15 px-2 py-1 rounded-md border border-border/30">
                  {isLive ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-warning" />}
                  {isLive ? `LIVE · ${weather?.source}` : weatherLoading ? 'Loading...' : weather?.source || 'NO DATA'}
                </span>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Temperature", value: weather && weather.temperature != null ? `${Math.round(weather.temperature)}°C` : "—", status: weather && weather.temperature != null && weather.temperature > 45 ? "Alert" : "Normal", icon: ThermometerSun },
                  { label: "Rainfall", value: weather && weather.rainfall != null ? `${Number(weather.rainfall).toFixed(1)}mm` : "—", status: weather && weather.rainfall != null && weather.rainfall > 64 ? "Alert" : "Normal", icon: Droplets },
                  { label: "AQI", value: weather && weather.aqi != null ? `${weather.aqi}` : "—", status: weather && weather.aqi != null && weather.aqi > 300 ? "Alert" : weather && weather.aqi != null && weather.aqi > 150 ? "Moderate" : "Normal", icon: Wind },
                ].map((w, i) => (
                  <TiltCard key={i} className={`stat-card rounded-2xl ${w.status === "Alert" ? "border-warning/20" : ""}`} intensity={10}>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <w.icon className={`h-5 w-5 ${w.status === "Alert" ? "text-warning" : "text-primary"}`} />
                        <span className="text-sm text-muted-foreground">{w.label}</span>
                      </div>
                      <div className="font-display text-3xl font-bold">{w.value}</div>
                      <div className={`text-xs font-medium mt-1 ${w.status === "Alert" ? "text-warning" : w.status === "Normal" ? "text-success" : "text-secondary"}`}>
                        {w.status}
                      </div>
                    </div>
                  </TiltCard>
                ))}
              </div>
              {weather && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Humidity", value: weather.humidity != null ? `${weather.humidity}%` : "—" },
                    { label: "Wind", value: weather.wind_speed != null ? `${weather.wind_speed}m/s` : "—" },
                    { label: "City", value: weather.city || "—" },
                    { label: "Source", value: weather.source || "—" },
                  ].map(m => (
                    <div key={m.label} className="bg-muted/10 border border-border/20 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">{m.label}</div>
                      <div className="font-display text-lg font-bold capitalize">{m.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "traffic" && (
          <div className="space-y-5">
            <div className="glass-card p-6 md:p-7 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" /> Traffic Congestion Monitor
                </h3>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/15 px-2 py-1 rounded-md border border-border/30">
                  {trafficLive ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-warning" />}
                  {trafficLive ? 'LIVE · Google Maps' : trafficLoading ? 'Loading...' : 'TIME ESTIMATION'}
                </span>
              </div>

              {traffic.length === 0 && !trafficLoading && (
                <div className="text-center py-10 text-muted-foreground text-sm">No traffic data yet. Data refreshes every 2 minutes.</div>
              )}

              <div className="space-y-3">
                {traffic.map((t, i) => {
                  const delayMin = Math.round((t.trafficDuration - t.normalDuration) / 60);
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border ${
                        t.status === 'blocked' ? 'border-destructive/20 bg-destructive/5' :
                        t.status === 'severe' ? 'border-warning/15 bg-warning/3' :
                        t.status === 'moderate' ? 'border-secondary/15 bg-secondary/3' : 'border-border/30 bg-muted/8'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2 md:mb-0">
                        <div className={`h-2.5 w-2.5 rounded-full ${
                          t.status === 'blocked' ? 'bg-destructive animate-pulse' :
                          t.status === 'severe' ? 'bg-warning' :
                          t.status === 'moderate' ? 'bg-secondary' : 'bg-success'
                        }`} />
                        <div>
                          <div className="text-sm font-medium">{t.routeName}</div>
                          <div className="text-xs text-muted-foreground">{t.city}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase">Delay</div>
                          <div className={`font-mono text-xs font-semibold ${delayMin > 30 ? 'text-destructive' : delayMin > 15 ? 'text-warning' : 'text-success'}`}>+{delayMin}min</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase">Congestion</div>
                          <div className="font-mono text-xs font-semibold">{t.congestionRatio}x</div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
                          t.status === 'blocked' ? 'bg-destructive/10 text-destructive' :
                          t.status === 'severe' ? 'bg-warning/10 text-warning' :
                          t.status === 'moderate' ? 'bg-secondary/10 text-secondary' : 'bg-success/10 text-success'
                        }`}>{t.status}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "claims" && (
          <div className="glass-card p-6 md:p-7 rounded-2xl">
            <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Claims History
            </h3>
            {claimsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : dbClaims.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No claims yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Claims will appear here as triggers fire</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dbClaims.map((claim, i) => <ClaimCard key={claim.id} claim={claim} index={i} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
