import { motion } from "framer-motion";
import { Play, Check } from "lucide-react";
import { useDemoMode } from "./DemoModeProvider";

const DemoModeBanner = () => {
  const { isDemoMode, demoSteps, currentStepIndex } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-16 left-0 right-0 z-40 bg-secondary/10 border-b border-secondary/20 backdrop-blur-xl"
    >
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="h-3.5 w-3.5 text-secondary" />
          <span className="text-xs font-semibold text-secondary">DEMO MODE</span>
        </div>
        <div className="flex items-center gap-1">
          {demoSteps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <div className={`h-6 px-2.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition-all ${
                step.completed ? "bg-success/10 text-success" :
                i === currentStepIndex ? "bg-secondary/15 text-secondary border border-secondary/20" :
                "bg-muted/10 text-muted-foreground"
              }`}>
                {step.completed ? <Check className="h-3 w-3" /> : null}
                {step.label}
              </div>
              {i < demoSteps.length - 1 && <div className={`w-3 h-[1px] ${step.completed ? 'bg-success/40' : 'bg-border/30'}`} />}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default DemoModeBanner;
