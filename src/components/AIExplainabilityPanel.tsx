import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronUp, Info, Shield, Zap, TrendingUp } from "lucide-react";
import { type RiskOutput, type RiskFactor } from "@/lib/riskEngine";
import { Progress } from "@/components/ui/progress";

interface AIExplainabilityPanelProps {
  riskOutput: RiskOutput;
  weatherData?: { rainfall: number; temperature: number; aqi: number };
  className?: string;
}

const getRiskCategory = (score: number) => {
  if (score > 80) return { label: "Critical", color: "text-destructive", bg: "bg-destructive/10" };
  if (score > 65) return { label: "High", color: "text-warning", bg: "bg-warning/10" };
  if (score > 45) return { label: "Medium", color: "text-secondary", bg: "bg-secondary/10" };
  return { label: "Low", color: "text-success", bg: "bg-success/10" };
};

const getFactorImpact = (factors: RiskFactor[]) => {
  const total = factors.reduce((s, f) => s + f.score, 0) || 1;
  return factors.map(f => ({
    ...f,
    percentage: Math.round((f.score / total) * 100),
  }));
};

const getTopReasons = (factors: RiskFactor[], weatherData?: any): string[] => {
  const reasons: string[] = [];
  const sorted = [...factors].sort((a, b) => b.score - a.score);

  for (const f of sorted) {
    if (reasons.length >= 5) break;
    if (f.label.includes("Flood") && f.risk) reasons.push(`High flood zone history (+${Math.round(f.score * 0.3)}%)`);
    else if (f.label.includes("Heat") && f.risk) reasons.push(`Extreme heat exposure (+${Math.round(f.score * 0.25)}%)`);
    else if (f.label.includes("Pollution") && f.risk) reasons.push(`Severe air quality risk (+${Math.round(f.score * 0.2)}%)`);
    else if (f.label.includes("Traffic") && f.risk) reasons.push(`Heavy traffic congestion (+${Math.round(f.score * 0.2)}%)`);
    else if (f.label.includes("Strike") && f.risk) reasons.push(`Frequent labor disruptions (+${Math.round(f.score * 0.15)}%)`);
    else if (f.label.includes("Vehicle") && f.risk) reasons.push(`High-risk vehicle type (+${Math.round(f.score * 0.1)}%)`);
    else if (f.label.includes("Shift") && f.risk) reasons.push(`Long working hours exposure (+${Math.round(f.score * 0.12)}%)`);
  }

  if (weatherData?.rainfall > 50 && reasons.length < 5) reasons.push(`Current rainfall ${weatherData.rainfall}mm (+22%)`);
  if (weatherData?.temperature > 42 && reasons.length < 5) reasons.push(`Current temp ${weatherData.temperature}°C (+15%)`);
  if (weatherData?.aqi > 300 && reasons.length < 5) reasons.push(`Current AQI ${weatherData.aqi} (+18%)`);

  return reasons.length > 0 ? reasons : ["Standard risk profile — no elevated factors detected"];
};

const AIExplainabilityPanel = ({ riskOutput, weatherData, className = "" }: AIExplainabilityPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const category = getRiskCategory(riskOutput.riskScore);
  const impacts = getFactorImpact(riskOutput.factors);
  const reasons = getTopReasons(riskOutput.factors, weatherData);

  const impactCategories = [
    { label: "Weather Impact", pct: Math.round(impacts.filter(f => f.label.includes("Flood") || f.label.includes("Heat")).reduce((s, f) => s + f.percentage, 0)), color: "bg-primary" },
    { label: "Traffic Impact", pct: Math.round(impacts.filter(f => f.label.includes("Traffic")).reduce((s, f) => s + f.percentage, 0)), color: "bg-warning" },
    { label: "AQI Impact", pct: Math.round(impacts.filter(f => f.label.includes("Pollution")).reduce((s, f) => s + f.percentage, 0)), color: "bg-destructive" },
    { label: "Worker Exposure", pct: Math.round(impacts.filter(f => f.label.includes("Vehicle") || f.label.includes("Shift")).reduce((s, f) => s + f.percentage, 0)), color: "bg-secondary" },
  ];

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${className}`}>
      {/* Header Stats Row */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold">AI Risk Analysis</h3>
          </div>
          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-md border ${
            riskOutput.model === 'xgboost_ai' ? 'bg-success/5 border-success/15 text-success' : 'bg-muted/15 border-border/30 text-muted-foreground'
          }`}>
            {riskOutput.model === 'xgboost_ai' ? '🧠 XGBoost AI' : '📊 Rule-Based'}
            {riskOutput.confidence ? ` · ${(riskOutput.confidence * 100).toFixed(0)}% conf.` : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="stat-card rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Risk Score</div>
            <div className={`font-display text-2xl font-bold ${category.color}`}>
              {riskOutput.riskScore}<span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="stat-card rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Category</div>
            <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${category.bg} ${category.color}`}>
              {category.label}
            </span>
          </div>
          <div className="stat-card rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Premium</div>
            <div className="font-display text-2xl font-bold text-primary">₹{riskOutput.weeklyPremium}</div>
          </div>
          <div className="stat-card rounded-xl p-4 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Max Payout</div>
            <div className="font-display text-2xl font-bold text-success">₹{riskOutput.maxPayout}</div>
          </div>
        </div>
      </div>

      {/* Impact Breakdown Bars */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {impactCategories.map(cat => (
            <div key={cat.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                <span className="text-[10px] font-bold text-foreground">{cat.pct}%</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, cat.pct)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${cat.color}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable "Why this premium?" */}
      <div className="border-t border-border/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-6 py-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors"
        >
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Why this premium?
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-5 space-y-4">
                {/* Key Reasons */}
                <div>
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Key Factors</h4>
                  <div className="space-y-2">
                    {reasons.map((reason, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-2.5 text-sm"
                      >
                        <Zap className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                        <span className="text-foreground/80">{reason}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Full Factor Breakdown */}
                <div>
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Detailed Breakdown</h4>
                  <div className="space-y-2.5">
                    {impacts.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{f.label}</span>
                        <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, f.score)}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className={`h-full rounded-full ${f.risk ? 'bg-warning/70' : 'bg-success/70'}`}
                          />
                        </div>
                        <span className={`text-xs font-semibold min-w-[50px] text-right ${f.risk ? "text-warning" : "text-success"}`}>
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIExplainabilityPanel;
