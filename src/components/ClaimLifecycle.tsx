import { motion } from "framer-motion";
import { CloudRain, MapPin, Shield, CheckCircle2, Zap, IndianRupee } from "lucide-react";

interface ClaimLifecycleProps {
  currentStep: number; // 0-5
  triggerType?: string;
  amount?: number;
}

const steps = [
  { label: "Triggered", icon: CloudRain, time: "0s" },
  { label: "Location Verified", icon: MapPin, time: "~2s" },
  { label: "Fraud Check", icon: Shield, time: "~5s" },
  { label: "Approved", icon: CheckCircle2, time: "~8s" },
  { label: "Processing", icon: Zap, time: "~12s" },
  { label: "Paid", icon: IndianRupee, time: "~28s" },
];

const ClaimLifecycle = ({ currentStep, triggerType, amount }: ClaimLifecycleProps) => {
  return (
    <div className="glass-card p-6 rounded-2xl">
      <h3 className="font-display text-sm font-semibold mb-5 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
        <Zap className="h-4 w-4 text-secondary" /> Claim Lifecycle
      </h3>
      <div className="flex flex-col md:flex-row gap-1 md:gap-0 md:items-center">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex flex-col items-center text-center flex-1 ${i <= currentStep ? "" : "opacity-30"}`}>
              <motion.div
                animate={i === currentStep ? {
                  boxShadow: ["0 0 0 0 hsl(168 80% 48% / 0)", "0 0 16px 3px hsl(168 80% 48% / 0.25)", "0 0 0 0 hsl(168 80% 48% / 0)"]
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`h-10 w-10 rounded-xl flex items-center justify-center mb-1.5 transition-all ${
                  i < currentStep ? "bg-success/15 border border-success/20" :
                  i === currentStep ? "bg-primary/15 border border-primary/25" :
                  "bg-muted/20 border border-border/30"
                }`}
              >
                <step.icon className={`h-4 w-4 ${
                  i < currentStep ? "text-success" : i === currentStep ? "text-primary" : "text-muted-foreground"
                }`} />
              </motion.div>
              <div className="text-[10px] font-medium">{step.label}</div>
              <div className="text-[9px] text-muted-foreground font-mono">{step.time}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`hidden md:block w-6 h-[2px] rounded-full transition-colors ${
                i < currentStep ? "bg-success/50" : "bg-border/30"
              }`} />
            )}
          </div>
        ))}
      </div>
      {currentStep >= 5 && amount && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 text-center">
          <span className="inline-flex items-center gap-2 bg-success/8 border border-success/15 text-success px-5 py-2 rounded-xl font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4" /> ₹{amount.toLocaleString()} credited
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default ClaimLifecycle;
