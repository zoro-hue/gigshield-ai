import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActivePolicy() {
  const { user } = useAuth();

  const { data: policy, isLoading } = useQuery({
    queryKey: ["active-policy", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("policies")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("activated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5000,
  });

  return {
    policy,
    hasActivePolicy: !!policy,
    loading: isLoading,
  };
}
