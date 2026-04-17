import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { city, intensity } = await req.json();
    const targetCity = city || 'Mumbai';
    const rainIntensity = intensity || 'high';

    // 1. Insert disruption event tagged as demo
    const { data: disruption, error: disErr } = await supabase
      .from('disruption_events')
      .insert({
        type: 'rain',
        title: `[DEMO] Heavy Rainstorm - ${targetCity}`,
        description: `Demo simulation: ${rainIntensity} intensity rainfall causing delivery disruptions`,
        city: targetCity, zone: 'City-wide',
        severity: rainIntensity === 'high' ? 'severe' : 'moderate',
        source: 'demo_simulation', is_active: true,
      })
      .select().single();
    if (disErr) throw disErr;

    // 2. Get user's active policy
    const { data: policy } = await supabase
      .from('policies')
      .select('id, max_payout')
      .eq('user_id', user.id).eq('status', 'active')
      .order('activated_at', { ascending: false })
      .limit(1).maybeSingle();

    if (!policy) {
      return new Response(JSON.stringify({
        disruption_id: disruption.id,
        message: 'Disruption created but no active policy found for claim auto-trigger',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Auto-create claim
    const claimAmount = Math.min(policy.max_payout, Math.round(800 + Math.random() * 700));

    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .insert({
        user_id: user.id, policy_id: policy.id,
        trigger_type: 'rain', trigger_value: `${rainIntensity === 'high' ? '78' : '55'}mm/hr`,
        amount: claimAmount, status: 'processing',
        location_city: targetCity, location_zone: 'City-wide',
        fraud_score: Math.round(Math.random() * 15), fraud_check_passed: true,
      })
      .select().single();
    if (claimErr) throw claimErr;

    // 4. Insert transaction as initiated
    const paymentId = `test_${crypto.randomUUID().slice(0, 8)}`;
    const { data: txn } = await supabase.from('transactions').insert({
      user_id: user.id, claim_id: claim.id, type: 'payout',
      amount: claimAmount, status: 'initiated', method: 'UPI', payment_id: paymentId,
    }).select().single();

    // 5. Processing step
    await supabase.from('transactions').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', txn!.id);
    await new Promise(r => setTimeout(r, 2000));

    // 6. Credited
    const now = new Date().toISOString();
    await supabase.from('claims').update({ status: 'paid', paid_at: now, processing_time_seconds: 3 }).eq('id', claim.id);
    await supabase.from('transactions').update({ status: 'credited', updated_at: now }).eq('id', txn!.id);

    return new Response(JSON.stringify({
      success: true, disruption_id: disruption.id, claim_id: claim.id,
      transaction_id: txn?.id, amount: claimAmount, status: 'paid',
      message: `Demo: ₹${claimAmount} payout processed for rainstorm in ${targetCity}`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
