import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IndianRupee, Smartphone, ArrowRight, CheckCircle2, Clock,
  AlertTriangle, ArrowUpRight, ArrowDownLeft, Loader2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useTransactions } from "@/hooks/useTransactions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type ModalState = {
  open: boolean;
  type: "collect" | "payout";
  step: "form" | "processing" | "done";
};

declare global {
  interface Window { Razorpay: any; }
}

// Load Razorpay checkout script once
function useRazorpayScript() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.Razorpay) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => setLoaded(true);
    s.onerror = () => toast.error("Failed to load Razorpay");
    document.body.appendChild(s);
  }, []);
  return loaded;
}

const PaymentGateway = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: dbTransactions = [], isLoading: txnLoading } = useTransactions();
  const [filter, setFilter] = useState<"all" | "premium" | "payout">("all");
  const [modal, setModal] = useState<ModalState>({ open: false, type: "collect", step: "form" });
  const [formData, setFormData] = useState({ upiId: "", amount: "" });
  const [lastResult, setLastResult] = useState<{ amount: number; id: string } | null>(null);
  useRazorpayScript();

  // Realtime sync — listen to INSERT/UPDATE on transactions
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`payments-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient]);

  const transactions = dbTransactions.map((t: any) => ({
    id: `TXN-${t.id.slice(0, 5).toUpperCase()}`,
    raw_id: t.id,
    type: t.type as "premium" | "payout",
    method: t.method || "UPI",
    amount: t.amount,
    status: t.status,
    payment_id: t.payment_id,
    timestamp: t.created_at,
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filtered = transactions.filter(
    t => filter === "all" || (filter === "premium" ? t.type === "premium" : t.type === "payout")
  );

  // KPIs from real DB
  const totalCollected = dbTransactions
    .filter((t: any) => t.type === "premium" && t.status === "credited")
    .reduce((s: number, t: any) => s + t.amount, 0);
  const totalPaid = dbTransactions
    .filter((t: any) => t.type === "payout" && t.status === "credited")
    .reduce((s: number, t: any) => s + t.amount, 0);
  const pendingCount = dbTransactions.filter((t: any) => t.status === "initiated" || t.status === "processing").length;
  const totalCount = dbTransactions.length;
  const successCount = dbTransactions.filter((t: any) => t.status === "credited").length;
  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : "—";

  const handleCollectPremium = useCallback(async () => {
    if (!user) { toast.error("Please sign in"); return; }
    const amount = Number(formData.amount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!window.Razorpay) { toast.error("Razorpay not ready, try again"); return; }

    setModal(m => ({ ...m, step: "processing" }));

    try {
      // 1. Create order via edge function
      const { data: order, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { amount },
      });
      if (error || !order?.order_id) throw new Error(error?.message || "Order failed");

      // 2. Open Razorpay Checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "GigShield",
        description: "Weekly Premium",
        order_id: order.order_id,
        prefill: {
          email: user.email || "",
          contact: "",
          method: "upi",
        },
        notes: { type: "premium" },
        theme: { color: "#0071e3" },
        handler: async (resp: any) => {
          // 3. Verify payment
          try {
            const { data: verify, error: vErr } = await supabase.functions.invoke("razorpay-verify-payment", {
              body: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                amount,
              },
            });
            if (vErr || !verify?.success) throw new Error(vErr?.message || "Verification failed");

            setLastResult({ amount, id: resp.razorpay_payment_id });
            setModal(m => ({ ...m, step: "done" }));
            toast.success(`₹${amount} premium received via UPI`);
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
          } catch (e: any) {
            toast.error(e.message || "Verification failed");
            setModal(m => ({ ...m, step: "form" }));
          }
        },
        modal: {
          ondismiss: () => setModal(m => ({ ...m, step: "form" })),
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        toast.error(resp.error?.description || "Payment failed");
        setModal(m => ({ ...m, step: "form" }));
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || "Could not start payment");
      setModal(m => ({ ...m, step: "form" }));
    }
  }, [user, formData.amount, queryClient]);

  const handleProcessPayout = useCallback(async () => {
    if (!user) { toast.error("Please sign in"); return; }
    const amount = Number(formData.amount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }

    setModal(m => ({ ...m, step: "processing" }));

    try {
      // Find a pending claim if any (auto-link)
      const { data: claim } = await supabase
        .from("claims")
        .select("id, amount")
        .in("status", ["processing", "approved"])
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("razorpay-create-payout", {
        body: {
          claim_id: claim?.id || null,
          amount,
          upi_id: formData.upiId || "success@razorpay",
        },
      });
      if (error || !data?.success) throw new Error(error?.message || "Payout failed");

      setLastResult({ amount, id: data.payout_id });
      setModal(m => ({ ...m, step: "done" }));
      toast.success(`₹${amount} credited successfully`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    } catch (e: any) {
      toast.error(e.message || "Payout failed");
      setModal(m => ({ ...m, step: "form" }));
    }
  }, [user, formData, queryClient]);

  const closeModal = () => {
    setModal({ open: false, type: "collect", step: "form" });
    setFormData({ upiId: "", amount: "" });
    setLastResult(null);
  };

  const statusLabel = (s: string) => {
    if (s === "credited") return { label: "Credited", cls: "bg-success/10 text-success", icon: CheckCircle2 };
    if (s === "processing") return { label: "Processing", cls: "bg-primary/10 text-primary", icon: Loader2 };
    if (s === "initiated") return { label: "Initiated", cls: "bg-warning/10 text-warning", icon: Clock };
    if (s === "failed") return { label: "Failed", cls: "bg-destructive/10 text-destructive", icon: AlertTriangle };
    return { label: s, cls: "bg-muted/10 text-muted-foreground", icon: Clock };
  };

  const loading = txnLoading;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          [
            { label: "Premiums Collected", value: `₹${totalCollected.toLocaleString()}`, icon: ArrowDownLeft, color: "text-success" },
            { label: "Payouts Disbursed", value: `₹${totalPaid.toLocaleString()}`, icon: ArrowUpRight, color: "text-primary" },
            { label: "Pending", value: pendingCount.toString(), icon: Clock, color: "text-warning" },
            { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2, color: "text-success" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="stat-card rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="font-display text-2xl font-bold text-foreground">{kpi.value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{kpi.label}</div>
            </motion.div>
          ))
        )}
      </div>

      {/* Action buttons + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setModal({ open: true, type: "collect", step: "form" })} className="glow-button px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
          <IndianRupee className="h-4 w-4" /> Collect Premium
        </button>
        <button onClick={() => setModal({ open: true, type: "payout", step: "form" })} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-success/8 text-success border border-success/15 hover:bg-success/15 transition-all flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4" /> Process Payout
        </button>
        <div className="ml-auto flex gap-1 bg-muted/20 border border-border/40 rounded-xl p-1">
          {(["all", "premium", "payout"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-300 ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
          ))}
        </div>
      </div>

      {/* Transaction table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No transactions yet. Collect a premium or process a payout to see activity.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  {["Txn ID", "Type", "Method", "Amount", "Status", "Date"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn, i) => {
                  const st = statusLabel(txn.status);
                  const StIcon = st.icon;
                  return (
                    <motion.tr key={`${txn.id}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-primary">{txn.id}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${txn.type === "premium" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}>
                          {txn.type === "premium" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-3 px-4"><span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Smartphone className="h-3 w-3" />{txn.method}</span></td>
                      <td className={`py-3 px-4 font-semibold ${txn.type === "payout" ? "text-success" : "text-foreground"}`}>{txn.type === "payout" ? "+" : ""}₹{txn.amount.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                          <StIcon className={`h-3 w-3 ${txn.status === "processing" ? "animate-spin" : ""}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(txn.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {modal.open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={closeModal}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${modal.type === "collect" ? "bg-primary/10" : "bg-success/10"}`}>
                    {modal.type === "collect" ? <IndianRupee className="h-5 w-5 text-primary" /> : <ArrowUpRight className="h-5 w-5 text-success" />}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{modal.type === "collect" ? "Collect Premium" : "Process Payout"}</h3>
                    <p className="text-xs text-muted-foreground">Razorpay {modal.type === "collect" ? "Checkout" : "UPI Payout"} (TEST)</p>
                  </div>
                </div>
                <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>

              <div className="p-5">
                {modal.step === "form" && (
                  <div className="space-y-4">
                    {modal.type === "payout" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">UPI ID (test mode accepts any)</label>
                        <input value={formData.upiId} onChange={e => setFormData({ ...formData, upiId: e.target.value })} placeholder="success@razorpay" className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (₹)</label>
                      <input value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder={modal.type === "collect" ? "89" : "1900"} type="number" min="1" className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <button
                      onClick={modal.type === "collect" ? handleCollectPremium : handleProcessPayout}
                      className="w-full glow-button py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {modal.type === "collect" ? "Pay with Razorpay" : "Initiate Payout"} <ArrowRight className="h-4 w-4" />
                    </button>
                    {modal.type === "collect" && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        TEST MODE — use UPI ID <span className="text-primary font-mono">success@razorpay</span> in checkout
                      </p>
                    )}
                  </div>
                )}
                {modal.step === "processing" && (
                  <div className="flex flex-col items-center py-10">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                    <p className="font-display font-semibold text-foreground">
                      {modal.type === "collect" ? "Processing payment…" : `Transferring ₹${formData.amount}…`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Razorpay test gateway</p>
                  </div>
                )}
                {modal.step === "done" && (
                  <div className="flex flex-col items-center py-10">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                      <CheckCircle2 className="h-16 w-16 text-success mb-4" />
                    </motion.div>
                    <p className="font-display text-xl font-bold text-foreground">{modal.type === "collect" ? "Payment Received!" : "Payout Successful!"}</p>
                    <p className="text-muted-foreground text-sm mt-1">₹{lastResult?.amount?.toLocaleString() ?? formData.amount} via UPI</p>
                    {lastResult?.id && (
                      <p className="text-[10px] font-mono text-primary mt-2">{lastResult.id}</p>
                    )}
                    <button onClick={closeModal} className="mt-6 px-6 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium">Done</button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentGateway;
