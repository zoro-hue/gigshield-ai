import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Razorpay TEST mode payout simulation.
 *
 * NOTE: Razorpay's real RazorpayX payouts API requires production KYC + business activation
 * + an X account, and does NOT work with the standard Razorpay test keys (rzp_test_*).
 * For test/dev environments we simulate the payout lifecycle deterministically while still
 * recording the transaction in the database with a Razorpay-format ID.
 *
 * In production, replace the simulated section with real /v1/contacts, /v1/fund_accounts,
 * and /v1/payouts calls (see https://razorpay.com/docs/api/x/payouts/).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Missing authorization');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { claim_id, amount, upi_id } = await req.json();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) throw new Error('Invalid amount');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Optional: link to claim
    let claim: any = null;
    if (claim_id) {
      const { data } = await supabase.from('claims').select('*').eq('id', claim_id).maybeSingle();
      claim = data;
    }

    const payoutId = `pout_${crypto.randomUUID().slice(0, 14).replace(/-/g, '')}`;

    // 1. Initiated
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        claim_id: claim?.id || null,
        type: 'payout',
        amount: amountNum,
        status: 'initiated',
        method: 'UPI',
        payment_id: payoutId,
      })
      .select().single();
    if (txnErr) throw txnErr;

    // 2. Processing (verify keys exist — we won't fail without them in test simulation)
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!keyId) throw new Error('Razorpay keys not configured');

    await supabase.from('transactions')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', txn.id);

    if (claim) {
      await supabase.from('claims').update({ status: 'processing' }).eq('id', claim.id);
    }

    await new Promise(r => setTimeout(r, 1500));

    // 3. Credited (simulated success — would call Razorpay /v1/payouts in production)
    const now = new Date().toISOString();
    await supabase.from('transactions')
      .update({ status: 'credited', updated_at: now })
      .eq('id', txn.id);

    if (claim) {
      const procTime = Math.round(
        (new Date(now).getTime() - new Date(claim.created_at).getTime()) / 1000
      );
      await supabase.from('claims')
        .update({ status: 'paid', paid_at: now, processing_time_seconds: procTime })
        .eq('id', claim.id);
    }

    return new Response(JSON.stringify({
      success: true,
      transaction_id: txn.id,
      payout_id: payoutId,
      amount: amountNum,
      status: 'credited',
      upi: upi_id || 'success@razorpay',
      message: `₹${amountNum} credited via Razorpay UPI`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('create-payout error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
