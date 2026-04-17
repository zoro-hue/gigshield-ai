import { motion } from "framer-motion";
import { Brain, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Server, Cpu } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { type AIRiskAssessment } from "@/hooks/useAIRisk";

interface AIRiskDisplayProps {
  assessment: AIRiskAssessment | null;
  state: "loading" | "success";
  onRefetch?: () => void;
  className?: string;
}

const labelConfig = {
  LOW: { color: "text-success", bg: "bg-success/10 border-success/20", icon: CheckCircle2 },
  MEDIUM: { color: "text-warning", bg: "bg-warning/10 border-warning/20", icon: AlertTriangle },
  HIGH: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: XCircle },
  UNAVAILABLE: { color: "text-muted-foreground", bg: "bg-muted/50 border-border", icon: XCircle },
};

function getSourceLabel(source: string) {
  if (source === "xgboost_model" || source === "ai_service") return { label: "AI Model (XGBoost)", icon: Server };
  if (source === "lovable_ai") return { label: "Gemini AI (Live)", icon: Server };
  if (source === "rule_based_fallback") return { label: "Rule-based AI (Fallback)", icon: Cpu };
  return { label: source, icon: Server };
}

export default function AIRiskDisplay({ assessment, state, onRefetch, className = "" }: AIRiskDisplayProps) {
  if (state === "loading" && !assessment) {
    return (
      <div className={`rounded-xl border border-border bg-card p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary animate-pulse" />
          <span className="text-sm font-medium text-muted-foreground">Loading AI Risk Assessment...</span>
        </div>
        <Skeleton className="h-8 w-32 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!assessment) return null;

  const config = labelConfig[assessment.risk_label] || labelConfig.MEDIUM;
  const Icon = config.icon;
  const scorePercent = assessment.risk_score !== null ? Math.round(assessment.risk_score * 100) : 0;
  const sourceInfo = getSourceLabel(assessment.source);
  const SourceIcon = sourceInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-border bg-card p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Risk Assessment</span>
          <Badge variant="outline" className="text-[10px] h-5">
            <SourceIcon className="w-3 h-3 mr-1" />
            {sourceInfo.label}
          </Badge>
        </div>
        {onRefetch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefetch}
            disabled={state === "loading"}
            className="h-7 px-2"
            title="Refresh AI risk assessment"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className={`flex items-center justify-center w-16 h-16 rounded-xl border ${config.bg}`}>
          <span className={`text-2xl font-bold ${config.color}`}>{scorePercent}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${config.color}`} />
            <span className={`text-sm font-semibold ${config.color}`}>{assessment.risk_label} RISK</span>
          </div>
          <Progress value={scorePercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Score: {assessment.risk_score?.toFixed(4)} / 1.0
          </p>
        </div>
      </div>

      {assessment.weather_snapshot && (
        <div className="grid grid-cols-5 gap-2 p-3 rounded-lg bg-muted/30 border border-border">
          {[
            { label: "Temp", value: `${assessment.weather_snapshot.temperature}°C` },
            { label: "Rain", value: `${assessment.weather_snapshot.rainfall}mm` },
            { label: "Humid", value: `${assessment.weather_snapshot.humidity}%` },
            { label: "Wind", value: `${assessment.weather_snapshot.wind_speed}m/s` },
            { label: "AQI", value: `${assessment.weather_snapshot.aqi}` },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className="text-xs font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3">
        Last assessed: {new Date(assessment.created_at).toLocaleString()} • {sourceInfo.label}
        {assessment.model_version && ` • v${assessment.model_version}`}
      </p>
    </motion.div>
  );
}
