import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type AnomalyPoint = {
  time: string;
  label: string;
  score: number;
  threshold: number;
  isAnomaly: boolean;
};

type AnomalyEvent = {
  time: string;
  type: string;
  desc: string;
  severity: string;
};

const AnomalyTimeline = () => {
  const [anomalyData, setAnomalyData] = useState<AnomalyPoint[]>([]);
  const [anomalyEvents, setAnomalyEvents] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnomalyData = async () => {
      setLoading(true);
      try {
        // Fetch GPS logs with anomaly scores from last 48 hours
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: gpsLogs } = await supabase
          .from('gps_logs')
          .select('recorded_at, anomaly_score, is_spoofed, flagged_reason')
          .gte('recorded_at', since)
          .order('recorded_at', { ascending: true })
          .limit(500);

        if (gpsLogs && gpsLogs.length > 0) {
          // Group by hour
          const hourlyData: Record<string, { scores: number[]; spoofed: number; reasons: string[] }> = {};
          gpsLogs.forEach(g => {
            const dt = new Date(g.recorded_at);
            const hourKey = `${dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ${String(dt.getHours()).padStart(2, '0')}:00`;
            if (!hourlyData[hourKey]) hourlyData[hourKey] = { scores: [], spoofed: 0, reasons: [] };
            hourlyData[hourKey].scores.push(Number(g.anomaly_score) || 0);
            if (g.is_spoofed) hourlyData[hourKey].spoofed++;
            if (g.flagged_reason) hourlyData[hourKey].reasons.push(g.flagged_reason);
          });

          const points: AnomalyPoint[] = Object.entries(hourlyData).map(([time, data]) => {
            const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            return {
              time,
              label: time.split(' ').pop() || '',
              score: Math.round(avgScore * 10) / 10,
              threshold: 35,
              isAnomaly: avgScore > 35 || data.spoofed > 0,
            };
          });
          setAnomalyData(points);

          // Build events from anomalous entries
          const events: AnomalyEvent[] = [];
          Object.entries(hourlyData).forEach(([time, data]) => {
            if (data.spoofed > 0) {
              events.push({
                time: time.split(' ').pop() || '',
                type: 'GPS Spoofing Detected',
                desc: `${data.spoofed} spoofed point(s) detected`,
                severity: data.spoofed > 3 ? 'critical' : 'high',
              });
            }
            const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            if (avgScore > 50 && data.spoofed === 0) {
              events.push({
                time: time.split(' ').pop() || '',
                type: 'High Anomaly Score',
                desc: `Avg anomaly score: ${avgScore.toFixed(1)}`,
                severity: avgScore > 70 ? 'critical' : 'high',
              });
            }
          });
          setAnomalyEvents(events.slice(0, 5));
        } else {
          setAnomalyData([]);
          setAnomalyEvents([]);
        }
      } catch (err) {
        console.error('Anomaly timeline fetch failed:', err);
        setAnomalyData([]);
        setAnomalyEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnomalyData();
  }, []);

  const tooltipStyle = {
    background: "hsl(225, 15%, 8%)",
    border: "1px solid hsl(225, 10%, 14%)",
    borderRadius: "12px",
    color: "hsl(210, 40%, 96%)",
    fontSize: "12px",
    boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
  };

  return (
    <div className="glass-card p-6 md:p-7 rounded-2xl">
      <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
        <Activity className="h-5 w-5 text-warning" /> Anomaly Detection Timeline
      </h3>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && anomalyData.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No GPS anomaly data yet. Data will appear as GPS logs are validated.
        </div>
      )}

      {!loading && anomalyData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={anomalyData}>
              <defs>
                <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 95%, 55%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(38, 95%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 10%, 14%)" />
              <XAxis dataKey="label" stroke="hsl(215, 15%, 35%)" fontSize={10} interval={5} />
              <YAxis stroke="hsl(215, 15%, 35%)" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={35} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" label={{ value: "Threshold", fill: "hsl(0, 84%, 60%)", fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(38, 95%, 55%)"
                fillOpacity={1}
                fill="url(#anomalyFill)"
                strokeWidth={2}
                dot={(props: any) => {
                  if (props.payload.isAnomaly) {
                    return <circle cx={props.cx} cy={props.cy} r={5} fill="hsl(0, 84%, 60%)" stroke="hsl(0, 84%, 80%)" strokeWidth={2} />;
                  }
                  return <circle cx={0} cy={0} r={0} fill="none" />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {anomalyEvents.length > 0 && (
            <div className="mt-4 space-y-2">
              {anomalyEvents.map((evt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 text-xs px-3 py-2.5 rounded-xl bg-muted/10 border border-border/20"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${evt.severity === "critical" ? "bg-destructive animate-pulse" : evt.severity === "high" ? "bg-warning" : "bg-primary"}`} />
                  <span className="text-muted-foreground w-24 shrink-0 font-mono">{evt.time}</span>
                  <span className="font-medium text-foreground/90">{evt.type}</span>
                  <span className="text-muted-foreground hidden sm:inline">— {evt.desc}</span>
                  <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full shrink-0 font-medium ${
                    evt.severity === "critical" ? "bg-destructive/10 text-destructive" : evt.severity === "high" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                  }`}>{evt.severity}</span>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnomalyTimeline;
