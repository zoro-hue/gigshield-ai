import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: Array<{ city: string; status: string }> = [];

  for (const city of CITIES) {
    try {
      // Check if we already have a recent assessment (< 5 min old)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('risk_assessments')
        .select('id')
        .eq('city', city)
        .gte('created_at', fiveMinAgo)
        .limit(1);

      if (recent && recent.length > 0) {
        results.push({ city, status: 'skipped_recent' });
        continue;
      }

      // Call predict-risk edge function for this city
      const res = await fetch(`${supabaseUrl}/functions/v1/predict-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ city }),
      });

      if (res.ok) {
        const data = await res.json();
        results.push({ city, status: data.risk_label || 'done' });
      } else {
        results.push({ city, status: 'error' });
      }
    } catch (err: any) {
      console.error(`AI worker error for ${city}:`, err.message);
      results.push({ city, status: 'error' });
    }
  }

  return new Response(JSON.stringify({
    processed_at: new Date().toISOString(),
    results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
