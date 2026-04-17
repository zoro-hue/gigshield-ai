import { motion } from "framer-motion";
import { UserCheck, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

const workers = [
  {
    id: "W-4521", name: "Rajesh K.", trustScore: 23, trend: "down", flags: 4,
    radar: [
      { metric: "Claim Freq", value: 90 }, { metric: "GPS Drift", value: 85 },
      { metric: "Photo Dups", value: 70 }, { metric: "Off-Hours", value: 60 },
      { metric: "Amt Outlier", value: 75 }, { metric: "Peer Diff", value: 80 },
    ],
  },
  {
    id: "W-7823", name: "Priya M.", trustScore: 42, trend: "down", flags: 2,
    radar: [
      { metric: "Claim Freq", value: 55 }, { metric: "GPS Drift", value: 40 },
      { metric: "Photo Dups", value: 80 }, { metric: "Off-Hours", value: 30 },
      { metric: "Amt Outlier", value: 60 }, { metric: "Peer Diff", value: 45 },
    ],
  },
  {
    id: "W-9034", name: "Amit S.", trustScore: 15, trend: "down", flags: 6,
    radar: [
      { metric: "Claim Freq", value: 95 }, { metric: "GPS Drift", value: 92 },
      { metric: "Photo Dups", value: 88 }, { metric: "Off-Hours", value: 85 },
      { metric: "Amt Outlier", value: 90 }, { metric: "Peer Diff", value: 95 },
    ],
  },
  {
    id: "W-1245", name: "Sunita D.", trustScore: 87, trend: "up", flags: 0,
    radar: [
      { metric: "Claim Freq", value: 15 }, { metric: "GPS Drift", value: 10 },
      { metric: "Photo Dups", value: 5 }, { metric: "Off-Hours", value: 8 },
      { metric: "Amt Outlier", value: 12 }, { metric: "Peer Diff", value: 10 },
    ],
  },
];

const getColor = (score: number) => score >= 70 ? "success" : score >= 40 ? "warning" : "destructive";
const getHsl = (score: number) => score >= 70 ? "hsl(152, 70%, 50%)" : score >= 40 ? "hsl(38, 95%, 55%)" : "hsl(0, 84%, 60%)";

const tooltipStyle = {
  background: "hsl(225, 15%, 8%)",
  border: "1px solid hsl(225, 10%, 14%)",
  borderRadius: "12px",
  color: "hsl(210, 40%, 96%)",
  fontSize: "11px",
};

const WorkerBehaviorScoring = () => {
  return (
    <div className="glass-card p-6 md:p-7 rounded-2xl">
      <h3 className="font-display text-lg font-semibold mb-5 flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-primary" /> Worker Behavior Scoring
      </h3>

      <div className="grid md:grid-cols-2 gap-4">
        {workers.map((w, i) => (
          <motion.div key={w.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-muted/10 border border-border/25 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{w.id}</span>
                  <span className="font-semibold text-foreground text-sm">{w.name}</span>
                </div>
                {w.flags > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> {w.flags} flags
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-display font-bold text-${getColor(w.trustScore)}`}>{w.trustScore}</div>
                <div className="flex items-center gap-1 text-xs">
                  {w.trend === "down" ? <TrendingDown className="h-3 w-3 text-destructive" /> : <TrendingUp className="h-3 w-3 text-success" />}
                  <span className="text-muted-foreground">Trust</span>
                </div>
              </div>
            </div>

            <div className="w-full h-1.5 bg-muted/20 rounded-full overflow-hidden mb-4">
              <motion.div initial={{ width: 0 }} animate={{ width: `${w.trustScore}%` }} transition={{ delay: i * 0.08 + 0.3, duration: 0.8 }}
                className={`h-full rounded-full bg-${getColor(w.trustScore)}`}
              />
            </div>

            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={w.radar} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="hsl(225, 10%, 14%)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(215, 15%, 40%)", fontSize: 9 }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Radar dataKey="value" stroke={getHsl(w.trustScore)} fill={getHsl(w.trustScore)} fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default WorkerBehaviorScoring;
