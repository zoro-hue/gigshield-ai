import { motion, AnimatePresence } from "framer-motion";
import { Zap, IndianRupee, AlertTriangle, ArrowUpRight, Shield } from "lucide-react";
import { ActivityEvent } from "@/hooks/useRealtimeData";

const typeConfig = {
  claim: { icon: Zap, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  premium: { icon: IndianRupee, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  payout: { icon: ArrowUpRight, color: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/20" },
  alert: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  fraud: { icon: Shield, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
};

const ActivityFeed = ({ events }: { events: ActivityEvent[] }) => {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {events.map((event) => {
          const config = typeConfig[event.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`flex items-start gap-3 p-3 rounded-xl border ${config.border} bg-card/50 backdrop-blur-sm`}
            >
              <div className={`h-7 w-7 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/80 leading-relaxed truncate">{event.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{event.time}</span>
                  {event.amount && (
                    <span className={`text-[10px] font-mono font-semibold ${config.color}`}>₹{event.amount.toLocaleString()}</span>
                  )}
                </div>
              </div>
              {event.time === "Just now" && (
                <span className="flex-shrink-0 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ActivityFeed;
