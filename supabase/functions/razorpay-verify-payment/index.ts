import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Missing payment fields');
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) throw new Error('Razorpay secret not configured');

    // Verify HMAC SHA256
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = createHmac('sha256', keySecret).update(payload).digest('hex');
    if (expected !== razorpay_signature) {
      console.error('Signature mismatch', { expected, received: razorpay_signature });
      throw new Error('Invalid payment signature');
    }

    // Insert credited transaction
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Prevent duplicate
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('payment_id', razorpay_payment_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, duplicate: true, transaction_id: existing.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'premium',
        amount: Number(amount),
        status: 'credited',
        method: 'UPI',
        payment_id: razorpay_payment_id,
      })
      .select().single();
    if (txnErr) throw txnErr;

    return new Response(JSON.stringify({
      success: true,
      transaction_id: txn.id,
      payment_id: razorpay_payment_id,
      amount,
      message: `₹${amount} premium credited via Razorpay`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('verify-payment error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
