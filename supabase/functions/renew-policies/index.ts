import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Risk engine — mirrors the frontend computeRiskProfile but runs server-side
function computeRisk(profile: any) {
  const hours = profile.working_hours_per_day || 8;
  const earnings = profile.avg_weekly_earnings || 3000;

  const cityRisk: Record<string, { base: number; flood: number; heat: number; pollution: number; traffic: number; strike: number }> = {
    Mumbai: { base: 75, flood: 95, heat: 40, pollution: 55, traffic: 80, strike: 50 },
    Delhi: { base: 70, flood: 30, heat: 90, pollution: 95, traffic: 85, strike: 60 },
    Bangalore: { base: 55, flood: 45, heat: 35, pollution: 40, traffic: 90, strike: 30 },
    Chennai: { base: 65, flood: 80, heat: 70, pollution: 50, traffic: 65, strike: 55 },
    Hyderabad: { base: 50, flood: 50, heat: 60, pollution: 45, traffic: 70, strike: 25 },
    Pune: { base: 45, flood: 55, heat: 45, pollution: 40, traffic: 60, strike: 35 },
    Kolkata: { base: 65, flood: 75, heat: 50, pollution: 70, traffic: 75, strike: 70 },
    Ahmedabad: { base: 45, flood: 25, heat: 85, pollution: 55, traffic: 50, strike: 40 },
  };

  const cr = cityRisk[profile.city] || { base: 50, flood: 50, heat: 50, pollution: 50, traffic: 50, strike: 50 };

  const vehicleRisk: Record<string, number> = { Bicycle: 1.3, 'Two-Wheeler': 1.2, 'Three-Wheeler': 1.0, 'Four-Wheeler': 0.8 };
  const vMult = vehicleRisk[profile.vehicle_type] || 1.0;

  const segmentRisk: Record<string, number> = { 'Food Delivery': 1.15, 'Quick Commerce / Grocery': 1.1, 'E-Commerce': 0.95 };
  const sMult = segmentRisk[profile.segment] || 1.0;

  const hoursMult = hours > 12 ? 1.35 : hours > 10 ? 1.2 : hours > 8 ? 1.08 : 0.95;

  const platformRisk: Record<string, number> = { Zomato: 1.0, Swiggy: 0.95, Zepto: 1.1, Blinkit: 1.08, Amazon: 0.85, Flipkart: 0.88, Dunzo: 1.05, Other: 1.15 };
  const pMult = platformRisk[profile.platform] || 1.0;

  const rawScore = (cr.base * 0.4 + (cr.flood + cr.heat + cr.pollution + cr.traffic + cr.strike) / 5 * 0.3 + 50 * hoursMult * 0.15 + 50 * vMult * 0.15) * sMult * pMult;
  const riskScore = Math.min(98, Math.max(12, Math.round(rawScore)));

  const basePremium = earnings * 0.015;
  const riskMult = riskScore > 80 ? 1.6 : riskScore > 65 ? 1.3 : riskScore > 50 ? 1.1 : 0.85;
  const weeklyPremium = Math.round(basePremium * riskMult);
  const maxPayout = Math.round(earnings * (riskScore > 70 ? 0.8 : 0.65));

  return { riskScore, weeklyPremium, maxPayout };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active policies
    const { data: policies, error: polErr } = await supabase
      .from('policies')
      .select('id, user_id, worker_profile_id, weekly_premium, max_payout, renewed_count, activated_at')
      .eq('status', 'active');

    if (polErr) throw polErr;

    let renewed = 0;
    let skipped = 0;

    for (const policy of (policies || [])) {
      // Get worker profile for risk recalculation
      const { data: profile } = await supabase
        .from('worker_profiles')
        .select('*')
        .eq('user_id', policy.user_id)
        .limit(1)
        .single();

      if (!profile) { skipped++; continue; }

      const { riskScore, weeklyPremium, maxPayout } = computeRisk(profile);

      // Update worker profile with new risk score
      await supabase.from('worker_profiles').update({
        risk_score: riskScore,
        weekly_premium: weeklyPremium,
        max_payout: maxPayout,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);

      // Renew policy
      const nextExpiry = new Date();
      nextExpiry.setDate(nextExpiry.getDate() + 7);

      await supabase.from('policies').update({
        weekly_premium: weeklyPremium,
        max_payout: maxPayout,
        renewed_count: (policy.renewed_count || 0) + 1,
        expires_at: nextExpiry.toISOString(),
        activated_at: new Date().toISOString(),
      }).eq('id', policy.id);

      renewed++;
    }

    return new Response(JSON.stringify({
      renewed_at: new Date().toISOString(),
      policies_renewed: renewed,
      policies_skipped: skipped,
      total_active: (policies || []).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Policy renewal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
