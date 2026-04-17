import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";

const PLATFORM_MAP: Record<string, string> = {
  Zomato: "zomato",
  Swiggy: "swiggy",
  Zepto: "zepto",
  Blinkit: "blinkit",
  Dunzo: "dunzo",
};

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setPlatform } = useTheme();

  const applyThemeFromDB = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("worker_profiles")
      .select("platform")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.platform) {
      setPlatform((PLATFORM_MAP[data.platform] || "gigshield") as any);
    }
  }, [user?.id, setPlatform]);

  // Global realtime sync — ONE channel, also instantly re-applies theme
  useEffect(() => {
    const channel = supabase
      .channel("global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "policies" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_assessments" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gps_logs" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "disruption_events" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "weather_readings" }, () => {
        queryClient.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_profiles" }, () => {
        queryClient.invalidateQueries();
        // Instantly re-apply theme when worker_profiles changes
        applyThemeFromDB();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, applyThemeFromDB]);

  // Apply theme on login (instant from localStorage, then confirm from DB)
  useEffect(() => {
    applyThemeFromDB();
  }, [applyThemeFromDB]);

  return <>{children}</>;
}
