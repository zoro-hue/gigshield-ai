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
    const { claim_id, action } = await req.json();
    if (!claim_id) throw new Error('claim_id is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: claim, error: claimErr } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claim_id)
      .maybeSingle();

    if (claimErr || !claim) throw new Error('Claim not found');

    const paymentId = `test_${crypto.randomUUID().slice(0, 8)}`;

    if (action === 'auto') {
      // Step 1: Insert transaction as initiated
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert({
          user_id: claim.user_id,
          claim_id: claim.id,
          type: 'payout',
          amount: claim.amount,
          status: 'initiated',
          method: 'UPI',
          payment_id: paymentId,
        })
        .select()
        .single();
      if (txnErr) throw txnErr;

      // Step 2: Processing
      await supabase.from('claims').update({ status: 'processing' }).eq('id', claim_id);
      await supabase.from('transactions').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', txn.id);

      await new Promise(r => setTimeout(r, 2000));

      // Step 3: Credited
      const now = new Date().toISOString();
      const processingTime = Math.round((new Date(now).getTime() - new Date(claim.created_at).getTime()) / 1000);

      await supabase.from('claims').update({ status: 'paid', paid_at: now, processing_time_seconds: processingTime }).eq('id', claim_id);
      await supabase.from('transactions').update({ status: 'credited', updated_at: now }).eq('id', txn.id);

      return new Response(JSON.stringify({
        claim_id, transaction_id: txn.id, status: 'credited', paid_at: now,
        processing_time_seconds: processingTime, amount: claim.amount,
        payment_id: paymentId, message: `₹${claim.amount} credited via UPI`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'initiate') {
      const { data: txn } = await supabase.from('transactions').insert({
        user_id: claim.user_id, claim_id: claim.id, type: 'payout',
        amount: claim.amount, status: 'initiated', method: 'UPI', payment_id: paymentId,
      }).select().single();

      await supabase.from('claims').update({ status: 'processing' }).eq('id', claim_id);

      return new Response(JSON.stringify({
        claim_id, transaction_id: txn?.id, status: 'initiated', payment_id: paymentId, message: 'Payout initiated',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'complete') {
      const now = new Date().toISOString();
      const processingTime = Math.round((new Date(now).getTime() - new Date(claim.created_at).getTime()) / 1000);

      await supabase.from('claims').update({ status: 'paid', paid_at: now, processing_time_seconds: processingTime }).eq('id', claim_id);
      await supabase.from('transactions').update({ status: 'credited', updated_at: now }).eq('claim_id', claim_id).eq('status', 'processing');

      return new Response(JSON.stringify({
        claim_id, status: 'paid', paid_at: now, amount: claim.amount, message: `₹${claim.amount} credited`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      throw new Error('Invalid action. Use: initiate, complete, or auto');
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
