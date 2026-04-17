import { motion } from "framer-motion";
import { CloudRain, Zap, MapPin, Shield, RefreshCw, Wifi, WifiOff, Car, AlertTriangle, Radio, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import TiltCard from "@/components/TiltCard";
import ClaimCard from "@/components/ClaimCard";
import ClaimLifecycle from "@/components/ClaimLifecycle";
import AIInsightsCard from "@/components/AIInsightsCard";
import { useLiveWeather, useLiveDisruptions, useLiveTraffic, useRecentClaims } from "@/hooks/useLiveData";
import { useDemoMode } from "@/components/DemoModeProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const Claims = () => {
  const [selectedCity, setSelectedCity] = useState("Mumbai");
  const [newClaimToast, setNewClaimToast] = useState(false);

  const { weather, loading: weatherLoading, isLive, refetch: fetchWeather } = useLiveWeather(selectedCity, 60000);
  const { disruptions } = useLiveDisruptions(selectedCity);
  const { traffic } = useLiveTraffic(selectedCity, 120000);
  const { claims: dbClaims, loading: claimsLoading } = useRecentClaims();
  const { isDemoMode, completeStep } = useDemoMode();

  // Listen for new claims and show toast
  useEffect(() => {
    const channel = supabase
      .channel('claims-toast-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'claims' }, (payload) => {
        const c = payload.new as any;
        toast.success(`⚡ Auto-claim triggered due to ${c.trigger_type?.replace(/_/g, ' ')}`, {
          description: `₹${c.amount} payout initiated • ${c.location_city || 'Unknown'}`,
          duration: 6000,
        });
        if (isDemoMode) {
          completeStep("auto_claim");
          completeStep("processed");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isDemoMode]);

  const liveRainfall = weather?.rainfall != null ? Math.round(weather.rainfall) : 0;
  const liveTemp = weather?.temperature != null ? Math.round(weather.temperature) : 0;
  const liveAQI = weather?.aqi ?? 0;

  const dynamicTriggers = [
    {
      id: 1, type: "Heavy Rainfall", threshold: "> 64mm/hr",
      current: `${liveRainfall}mm/hr`,
      status: liveRainfall > 64 ? "triggered" as const : liveRainfall > 40 ? "monitoring" as const : "safe" as const,
      location: selectedCity,
      impact: liveRainfall > 64 ? "₹1,900 payout initiated" : liveRainfall > 40 ? "Approaching threshold" : "Within safe range",
    },
    {
      id: 2, type: "Extreme Heat", threshold: "> 45°C",
      current: `${liveTemp}°C`,
      status: liveTemp > 45 ? "triggered" as const : liveTemp > 42 ? "monitoring" as const : "safe" as const,
      location: selectedCity,
      impact: liveTemp > 45 ? "Heat advisory payout" : liveTemp > 42 ? "Approaching threshold" : "Within safe range",
    },
    {
      id: 3, type: "AQI Critical", threshold: "> 400",
      current: liveAQI.toString(),
      status: liveAQI > 400 ? "triggered" as const : liveAQI > 300 ? "monitoring" as const : "safe" as const,
      location: selectedCity,
      impact: liveAQI > 400 ? "AQI payout triggered" : liveAQI > 300 ? "Approaching threshold" : "Within safe range",
    },
    ...disruptions.slice(0, 3).map((d, i) => ({
      id: 10 + i,
      type: d.type === 'traffic' ? 'Traffic Blockade' : d.type === 'strike' ? 'Local Strike' : 'Alert',
      threshold: 'Official declaration',
      current: d.title,
      status: (d.severity === 'critical' ? 'triggered' : d.severity === 'high' ? 'monitoring' : 'safe') as 'triggered' | 'monitoring' | 'safe',
      location: `${d.zone || d.city}, ${d.city}`,
      impact: d.description?.slice(0, 60) || d.title,
    })),
    ...traffic.filter(t => t.status === 'severe' || t.status === 'blocked').map((t, i) => ({
      id: 20 + i,
      type: 'Traffic Congestion',
      threshold: 'Congestion > 3x',
      current: `${t.congestionRatio}x delay`,
      status: (t.status === 'blocked' ? 'triggered' : 'monitoring') as 'triggered' | 'monitoring',
      location: `${t.routeName}, ${t.city}`,
      impact: `+${Math.round((t.trafficDuration - t.normalDuration) / 60)}min extra delay`,
    })),
  ];

  const activeCount = dynamicTriggers.filter(t => t.status !== 'safe').length;
  const cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad"];

  // Lifecycle step from latest claim
  const latestClaim = dbClaims[0];
  const lifecycleStep = latestClaim
    ? latestClaim.status === 'paid' ? 5
    : latestClaim.status === 'approved' ? 4
    : latestClaim.status === 'processing' ? 2
    : 0
    : -1;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="ambient-orb w-[400px] h-[400px] bg-secondary/5 top-[20%] left-[-100px] animate-glow-pulse" />
      <div className="ambient-orb w-[300px] h-[300px] bg-destructive/3 bottom-[10%] right-[-80px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              <span className="gradient-text">Parametric Claims</span> Engine
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Real-time trigger monitoring & automated payouts</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-muted/15 border border-border/30 rounded-lg px-3 py-2 text-xs text-foreground font-mono">
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/15 px-3 py-2 rounded-lg border border-border/30">
              {isLive ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-warning" />}
              {isLive ? `LIVE · ${weather?.source}` : 'OFFLINE'}
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/15 px-3 py-2 rounded-lg border border-border/30">
              <Radio className="h-3 w-3 text-destructive animate-pulse" /> {activeCount} ACTIVE
            </div>
            <button onClick={() => fetchWeather()} disabled={weatherLoading}
              className="p-2 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors">
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${weatherLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live readings */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          {weatherLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))
          ) : (
            [
              { label: "Rainfall", value: `${liveRainfall}mm/hr`, status: liveRainfall > 64 ? "critical" : "normal", threshold: "64mm/hr" },
              { label: "Temperature", value: `${liveTemp}°C`, status: liveTemp > 45 ? "critical" : liveTemp > 42 ? "warning" : "normal", threshold: "45°C" },
              { label: "AQI Level", value: liveAQI.toString(), status: liveAQI > 400 ? "critical" : liveAQI > 300 ? "warning" : "normal", threshold: "400" },
              ...(weather ? [
                { label: "Humidity", value: weather.humidity != null ? `${weather.humidity}%` : "—", status: (weather.humidity != null && weather.humidity > 90 ? "warning" : "normal") as string, threshold: "90%" },
                { label: "Wind", value: weather.wind_speed != null ? `${weather.wind_speed}m/s` : "—", status: (weather.wind_speed != null && weather.wind_speed > 15 ? "warning" : "normal") as string, threshold: "15m/s" },
              ] : []),
            ].map((r) => (
              <TiltCard key={r.label} className="stat-card rounded-2xl" intensity={8}>
                <div className="p-4 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{r.label}</div>
                  <div className={`font-display text-2xl md:text-3xl font-bold ${
                    r.status === "critical" ? "text-destructive" : r.status === "warning" ? "text-warning" : "text-success"
                  }`}>{r.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Threshold: {r.threshold}</div>
                  {r.status !== "normal" && (
                    <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className={`text-[10px] font-semibold mt-1 ${r.status === "critical" ? "text-destructive" : "text-warning"}`}>
                      ● {r.status === "critical" ? "TRIGGERED" : "APPROACHING"}
                    </motion.div>
                  )}
                </div>
              </TiltCard>
            ))
          )}
        </div>

        {/* Claim Lifecycle for latest claim */}
        {lifecycleStep >= 0 && latestClaim && (
          <div className="mb-8">
            <ClaimLifecycle
              currentStep={lifecycleStep}
              triggerType={latestClaim.trigger_type}
              amount={latestClaim.amount}
            />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Triggers */}
          <div className="lg:col-span-2 glass-card p-6 md:p-7 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-semibold">Active Triggers</h3>
              {isLive && (
                <span className="text-[10px] font-mono text-success bg-success/5 border border-success/10 px-2 py-1 rounded-md flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> LIVE · {selectedCity}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {dynamicTriggers.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all ${
                    t.status === "triggered" ? "border-destructive/20 bg-destructive/5" :
                    t.status === "monitoring" ? "border-warning/15 bg-warning/3" : "border-border/30 bg-muted/8"
                  }`}>
                  <div className="flex items-center gap-4 mb-2 md:mb-0">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      t.status === "triggered" ? "bg-destructive animate-pulse" :
                      t.status === "monitoring" ? "bg-warning" : "bg-success"
                    }`} />
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {t.type}
                        {t.type.includes('Traffic') && <Car className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{t.location}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Threshold</div>
                      <div className="font-mono text-xs mt-0.5">{t.threshold}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Current</div>
                      <div className={`font-mono text-xs font-semibold mt-0.5 ${
                        t.status === "triggered" ? "text-destructive" : t.status === "monitoring" ? "text-warning" : "text-success"
                      }`}>{t.current}</div>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      t.status === "triggered" ? "bg-destructive/10 text-destructive" :
                      t.status === "monitoring" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{t.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* AI Insights Sidebar */}
          <AIInsightsCard
            riskScore={weather ? (liveRainfall > 64 || liveTemp > 45 || liveAQI > 400 ? 85 : 45) : undefined}
            fraudProbability={0.08}
            model={isLive ? 'xgboost_ai' : 'rule_based'}
            confidence={isLive ? 0.87 : undefined}
          />
        </div>

        {/* Claims History */}
        <div className="glass-card p-6 md:p-7 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-semibold">Claims History</h3>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/15 px-2 py-1 rounded-md border border-border/20">
              {dbClaims.length} claims • Realtime
            </span>
          </div>

          {claimsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : dbClaims.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No claims yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Claims will appear here automatically when triggers fire</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dbClaims.map((claim, i) => <ClaimCard key={claim.id} claim={claim} index={i} />)}
            </div>
          )}
        </div>

        {/* Disruption Feed */}
        {disruptions.length > 0 && (
          <div className="glass-card p-6 md:p-7 rounded-2xl mt-6">
            <h3 className="font-display text-lg font-semibold mb-6 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Social Disruption Feed
            </h3>
            <div className="space-y-3">
              {disruptions.map((d, i) => (
                <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/10 border border-border/20">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    d.severity === 'critical' ? 'bg-destructive animate-pulse' : d.severity === 'high' ? 'bg-warning' : 'bg-primary'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{d.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        d.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                        d.severity === 'high' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                      }`}>{d.severity}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.zone}, {d.city}</span>
                      <span className="font-mono bg-muted/20 px-1.5 py-0.5 rounded">{d.source}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Claims;
