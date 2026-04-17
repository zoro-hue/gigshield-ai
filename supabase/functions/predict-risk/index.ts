import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v) && isFinite(v);
}

// Deterministic fallback — runs if Gemini AI fails
const CITY_BASE_RISK: Record<string, number> = {
  Mumbai: 0.62, Delhi: 0.58, Bangalore: 0.42, Chennai: 0.55,
  Hyderabad: 0.40, Pune: 0.38, Kolkata: 0.56, Ahmedabad: 0.44,
};

function computeServerFallback(city: string, weather: Record<string, number>) {
  let score = CITY_BASE_RISK[city] ?? 0.45;
  if (weather.rainfall > 50) score += 0.12;
  else if (weather.rainfall > 20) score += 0.06;
  if (weather.temperature > 42) score += 0.08;
  else if (weather.temperature > 38) score += 0.04;
  if (weather.aqi > 300) score += 0.10;
  else if (weather.aqi > 150) score += 0.05;
  if (weather.wind_speed > 15) score += 0.06;
  if (weather.humidity > 85) score += 0.03;
  score = Math.min(0.98, Math.max(0.05, score));
  const label = score >= 0.6 ? "HIGH" : score >= 0.3 ? "MEDIUM" : "LOW";
  return { risk_score: Math.round(score * 10000) / 10000, risk_label: label };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { city } = await req.json();
    if (!city || typeof city !== 'string') {
      return new Response(JSON.stringify({ error: 'city is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch latest weather
    const { data: weatherRow } = await supabase
      .from('weather_readings')
      .select('*')
      .eq('city', city)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const weather = weatherRow ? {
      temperature: Number(weatherRow.temperature) || 30,
      rainfall: Number(weatherRow.rainfall) || 0,
      humidity: Number(weatherRow.humidity) || 60,
      wind_speed: Number(weatherRow.wind_speed) || 5,
      aqi: Number(weatherRow.aqi) || 100,
    } : { temperature: 30, rainfall: 0, humidity: 60, wind_speed: 5, aqi: 100 };

    let riskScore: number | null = null;
    let riskLabel = '';
    let source = '';
    let modelVersion = 'gemini_v1';

    // 2. Try Lovable AI Gateway (Gemini) for real ML-enhanced risk scoring
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        const systemPrompt = `You are a risk assessment AI for gig worker insurance in India. Given weather data for a city, compute a risk score from 0.0 to 1.0 and a label (LOW/MEDIUM/HIGH).

Risk factors:
- Rainfall >50mm/hr = high risk, >20mm = moderate
- Temperature >42°C = high risk, >38°C = moderate  
- AQI >300 = high risk, >150 = moderate
- Wind >15m/s = elevated risk
- Humidity >85% = slight increase
- City-specific base risks: Mumbai=0.62, Delhi=0.58, Bangalore=0.42, Chennai=0.55, Hyderabad=0.40, Pune=0.38, Kolkata=0.56, Ahmedabad=0.44

You MUST respond with ONLY a JSON object, no other text:
{"risk_score": <float 0-1>, "risk_label": "<LOW|MEDIUM|HIGH>", "reasoning": "<brief explanation>"}`;

        const userPrompt = `City: ${city}
Weather data:
- Temperature: ${weather.temperature}°C
- Rainfall: ${weather.rainfall}mm/hr
- Humidity: ${weather.humidity}%
- Wind Speed: ${weather.wind_speed}m/s
- AQI: ${weather.aqi}

Compute the risk score.`;

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          // Parse JSON from response (handle markdown code blocks)
          let jsonStr = content;
          const jsonMatch = content.match(/\{[\s\S]*?\}/);
          if (jsonMatch) jsonStr = jsonMatch[0];
          
          const parsed = JSON.parse(jsonStr);
          if (isValidNumber(parsed.risk_score) && typeof parsed.risk_label === 'string') {
            riskScore = Math.max(0, Math.min(1, parsed.risk_score));
            riskLabel = parsed.risk_label;
            source = 'lovable_ai';
            modelVersion = 'gemini_2.5_flash_lite';
            
            console.log(`[${city}] Gemini AI risk: ${riskScore} (${riskLabel}) - ${parsed.reasoning || ''}`);
          }
        } else {
          const errText = await aiRes.text();
          console.error('Lovable AI error:', aiRes.status, errText);
        }
      } catch (aiErr: any) {
        console.error('Gemini AI scoring failed:', aiErr.message);
      }
    }

    // 3. Also try external XGBoost service if configured
    if (riskScore === null) {
      const AI_SERVICE_URL = Deno.env.get('AI_RISK_SERVICE_URL') || '';
      if (AI_SERVICE_URL) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const xgRes = await fetch(`${AI_SERVICE_URL}/predict-risk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(weather),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (xgRes.ok) {
            const xgData = await xgRes.json();
            if (isValidNumber(xgData.risk_score)) {
              riskScore = Math.max(0, Math.min(1, xgData.risk_score));
              riskLabel = xgData.risk_label || (riskScore >= 0.6 ? 'HIGH' : riskScore >= 0.3 ? 'MEDIUM' : 'LOW');
              source = 'xgboost_model';
              modelVersion = 'xgboost_v1';
            }
          }
        } catch (e: any) {
          console.error('XGBoost fallback failed:', e.message);
        }
      }
    }

    // 4. Final fallback: deterministic rule-based (NEVER return unavailable)
    if (riskScore === null) {
      const fallback = computeServerFallback(city, weather);
      riskScore = fallback.risk_score;
      riskLabel = fallback.risk_label;
      source = 'rule_based_fallback';
      modelVersion = 'fallback_v1';
    }

    // 5. Store result
    const assessment = {
      city,
      risk_score: riskScore,
      risk_label: riskLabel,
      weather_snapshot: weather,
      model_version: modelVersion,
      source,
      created_at: new Date().toISOString(),
    };

    await supabase.from('risk_assessments').insert(assessment);

    return new Response(JSON.stringify(assessment), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('predict-risk error:', error);
    return new Response(JSON.stringify({ error: error.message, risk_score: null, risk_label: 'UNAVAILABLE' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
