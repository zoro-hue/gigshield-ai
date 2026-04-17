import { motion } from "framer-motion";
import { Brain, Shield, Activity } from "lucide-react";

interface AIInsightsCardProps {
  riskScore?: number;
  fraudProbability?: number;
  model?: string;
  confidence?: number;
  insights?: string[];
}

const AIInsightsCard = ({ riskScore, fraudProbability, model, confidence, insights }: AIInsightsCardProps) => {
  const defaultInsights = [
    riskScore && riskScore > 70 ? "High risk due to monsoon exposure" : "Moderate risk — stable weather pattern",
    `Fraud probability: ${fraudProbability != null ? (fraudProbability < 0.2 ? 'Low' : fraudProbability < 0.5 ? 'Medium' : 'High') : 'Low'} (${(fraudProbability ?? 0.08).toFixed(2)})`,
    model === 'xgboost_ai' ? "XGBoost model active with live data" : "Rule-based fallback engine active",
  ];

  const items = insights && insights.length > 0 ? insights : defaultInsights;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          AI Insights
        </h3>
        {confidence != null && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/15 px-2 py-0.5 rounded border border-border/20">
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {/* Model badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { name: "XGBoost Risk", active: model === 'xgboost_ai', icon: Activity },
            { name: "Isolation Forest", active: true, icon: Shield },
            { name: "DBSCAN Clustering", active: true, icon: Brain },
          ].map(m => (
            <span key={m.name} className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border ${
              m.active ? 'bg-primary/5 border-primary/15 text-primary' : 'bg-muted/10 border-border/20 text-muted-foreground'
            }`}>
              <m.icon className="h-3 w-3" />
              {m.name}
            </span>
          ))}
        </div>

        {items.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="text-xs text-foreground/70 flex items-start gap-2"
          >
            <span className="text-primary mt-0.5">▸</span>
            {insight}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AIInsightsCard;
