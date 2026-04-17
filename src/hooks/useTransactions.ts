import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDashboardMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-metrics", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Total payouts from transactions
      const { data: payoutTxns } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "payout")
        .eq("status", "credited");

      const totalPayouts = payoutTxns?.reduce((s, t) => s + t.amount, 0) ?? 0;

      // Total premiums from policies (all active)
      const { data: policies } = await supabase
        .from("policies")
        .select("weekly_premium")
        .eq("status", "active");

      const totalPremiums = policies?.reduce((s, p) => s + p.weekly_premium, 0) ?? 0;
      const lossRatio = totalPremiums > 0 ? (totalPayouts / totalPremiums) * 100 : 0;

      return { totalPayouts, totalPremiums, lossRatio: Math.min(lossRatio, 999) };
    },
  });
}
