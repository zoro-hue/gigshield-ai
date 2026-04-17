import { motion } from "framer-motion";
import { CloudRain, Thermometer, Wind, Car, AlertTriangle, MapPin, Clock, CheckCircle2, Loader2, XCircle, IndianRupee } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ClaimCardProps {
  claim: {
    id: string;
    trigger_type: string;
    trigger_value?: string | null;
    amount: number;
    status: string;
    location_city?: string | null;
    location_zone?: string | null;
    fraud_score?: number | null;
    fraud_check_passed?: boolean | null;
    processing_time_seconds?: number | null;
    created_at: string;
    paid_at?: string | null;
  };
  index?: number;
}

const triggerIcons: Record<string, typeof CloudRain> = {
  rainfall: CloudRain,
  rain: CloudRain,
  heat: Thermometer,
  aqi: Wind,
  traffic: Car,
  strike: AlertTriangle,
  flood: CloudRain,
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  processing: { label: "Processing", color: "text-primary", bg: "bg-primary/10", icon: Loader2 },
  approved: { label: "Approved", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
  paid: { label: "Paid", color: "text-success", bg: "bg-success/10", icon: IndianRupee },
  rejected: { label: "Rejected", color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
  fraud_blocked: { label: "Blocked", color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
};

const ClaimCard = ({ claim, index = 0 }: ClaimCardProps) => {
  const TriggerIcon = triggerIcons[claim.trigger_type?.toLowerCase()] || AlertTriangle;
  const status = statusConfig[claim.status] || statusConfig.processing;
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border/30 bg-muted/8 hover:bg-muted/15 transition-all group"
    >
      <div className="flex items-start gap-3 mb-3 md:mb-0">
        <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
          <TriggerIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-medium text-sm capitalize flex items-center gap-2">
            {claim.trigger_type?.replace(/_/g, ' ') || 'Unknown'}
            {claim.trigger_value && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded">
                {claim.trigger_value}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {(claim.location_city || claim.location_zone) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {claim.location_zone ? `${claim.location_zone}, ` : ''}{claim.location_city || ''}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(claim.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* Fraud & AI indicators */}
        {claim.fraud_score != null && (
          <div className="flex items-center gap-2">
            <div className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              Number(claim.fraud_score) >= 60 ? 'bg-destructive/10 border-destructive/20 text-destructive' :
              Number(claim.fraud_score) >= 30 ? 'bg-warning/10 border-warning/20 text-warning' :
              'bg-success/10 border-success/20 text-success'
            }`}>
              Fraud: {Number(claim.fraud_score)}%
            </div>
            {claim.fraud_check_passed === false && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive">BLOCKED</span>
            )}
          </div>
        )}

        <div className="text-right">
          <div className="font-display text-lg font-bold text-foreground">₹{claim.amount.toLocaleString()}</div>
          {claim.processing_time_seconds && (
            <div className="text-[10px] text-muted-foreground">{claim.processing_time_seconds}s processing</div>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${status.bg} ${status.color}`}>
          <StatusIcon className={`h-3 w-3 ${claim.status === 'processing' ? 'animate-spin' : ''}`} />
          {status.label}
        </span>
      </div>
    </motion.div>
  );
};

export default ClaimCard;
