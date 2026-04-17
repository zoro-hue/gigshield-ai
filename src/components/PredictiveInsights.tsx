import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PredictiveData {
  expectedClaimsNextWeek: number;
  avgClaimAmount: number;
  riskTrend: "increasing" | "stable" | "decreasing";
  trendPercent: number;
  weeklyClaimCounts: number[];
}

export default function PredictiveInsights() {
  const [data, setData] = useState<PredictiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        // Last 7 days claims
        const w1Start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: w1Claims } = await supabase
          .from('claims')
          .select('amount, created_at')
          .gte('created_at', w1Start);

        // Previous 7 days (8-14 days ago)
        const w2Start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const w2End = w1Start;
        const { data: w2Claims } = await supabase
          .from('claims')
          .select('amount, created_at')
          .gte('created_at', w2Start)
          .lt('created_at', w2End);

        const w1Count = w1Claims?.length || 0;
        const w2Count = w2Claims?.length || 0;
        const w1Avg = w1Count > 0 ? Math.round((w1Claims?.reduce((s, c) => s + c.amount, 0) || 0) / w1Count) : 0;

        let trend: "increasing" | "stable" | "decreasing" = "stable";
        let trendPercent = 0;
        if (w2Count > 0) {
          const change = ((w1Count - w2Count) / w2Count) * 100;
          trendPercent = Math.abs(Math.round(change));
          if (change > 10) trend = "increasing";
          else if (change < -10) trend = "decreasing";
        }

        // Simple prediction: average of last 2 weeks + trend bias
        const baseExpected = Math.round((w1Count + w2Count) / 2);
        const predicted = trend === "increasing"
          ? Math.round(baseExpected * 1.15)
          : trend === "decreasing"
            ? Math.round(baseExpected * 0.85)
            : baseExpected;

        setData({
          expectedClaimsNextWeek: Math.max(predicted, 0),
          avgClaimAmount: w1Avg,
          riskTrend: trend,
          trendPercent,
          weeklyClaimCounts: [w2Count, w1Count],
        });
      } catch (err) {
        console.error('Predictive fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading predictions...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const TrendIcon = data.riskTrend === "increasing" ? TrendingUp : data.riskTrend === "decreasing" ? TrendingDown : Minus;
  const trendColor = data.riskTrend === "increasing" ? "text-destructive" : data.riskTrend === "decreasing" ? "text-success" : "text-muted-foreground";
  const trendBg = data.riskTrend === "increasing" ? "bg-destructive/10 border-destructive/20" : data.riskTrend === "decreasing" ? "bg-success/10 border-success/20" : "bg-muted/10 border-border/20";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-2xl">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-secondary" />
        <h3 className="font-display text-lg font-semibold">Predictive Analytics</h3>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/15 px-2 py-0.5 rounded-md border border-border/30">AI FORECAST</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-xl bg-muted/10 border border-border/20">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Expected Claims</div>
          <div className="font-display text-2xl font-bold text-foreground">{data.expectedClaimsNextWeek}</div>
          <div className="text-[10px] text-muted-foreground">next 7 days</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-muted/10 border border-border/20">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Claim</div>
          <div className="font-display text-2xl font-bold text-foreground">₹{data.avgClaimAmount.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">per claim</div>
        </div>
        <div className={`text-center p-3 rounded-xl border ${trendBg}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Risk Trend</div>
          <div className="flex items-center justify-center gap-1">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            <span className={`font-display text-lg font-bold capitalize ${trendColor}`}>{data.riskTrend}</span>
          </div>
          {data.trendPercent > 0 && (
            <div className={`text-[10px] font-mono ${trendColor}`}>
              {data.riskTrend === "increasing" ? "+" : "-"}{data.trendPercent}% vs last week
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <span className="font-mono">W-2: {data.weeklyClaimCounts[0]} claims</span>
          <span>→</span>
          <span className="font-mono">W-1: {data.weeklyClaimCounts[1]} claims</span>
          <span>→</span>
          <span className="font-mono text-primary">Predicted: {data.expectedClaimsNextWeek}</span>
        </div>
      </div>
    </motion.div>
  );
}
