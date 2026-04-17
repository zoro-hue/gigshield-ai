import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'];

const THRESHOLDS = {
  rainfall: { value: 65, sustainedMinutes: 60 },        // >65mm/hr sustained ≥1hr
  temperature: { value: 45, sustainedMinutes: 120 },     // >45°C sustained ≥2hr
  aqi: { value: 400, sustainedMinutes: 180 },            // AQI ≥400 sustained ≥3hr
  wind_speed: { value: 20, sustainedMinutes: 0 },        // >20m/s (immediate)
  traffic_congestion: { value: 3, sustainedMinutes: 0 }, // ratio >3x (immediate)
};

// Check if condition has been sustained by looking at recent weather readings
async function checkSustainedCondition(
  supabase: any,
  city: string,
  field: string,
  threshold: number,
  sustainedMinutes: number
): Promise<boolean> {
  if (sustainedMinutes <= 0) return true; // No sustained check needed

  const since = new Date(Date.now() - sustainedMinutes * 60 * 1000).toISOString();
  const { data: readings } = await supabase
    .from('weather_readings')
    .select(`recorded_at, ${field}`)
    .eq('city', city)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });

  if (!readings || readings.length < 2) return false;

  // All readings in the window must exceed threshold
  const allExceed = readings.every((r: any) => {
    const val = Number(r[field]) || 0;
    return val >= threshold;
  });

  return allExceed;
}

// Fetch latest weather from DB (written by fetch-weather)
async function getLatestWeather(supabase: any, city: string) {
  const { data } = await supabase
    .from('weather_readings')
    .select('*')
    .eq('city', city)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    temperature: Number(data.temperature) || 0,
    rainfall: Number(data.rainfall) || 0,
    aqi: Number(data.aqi) || 0,
    humidity: Number(data.humidity) || 0,
    wind_speed: Number(data.wind_speed) || 0,
    source: data.source || 'unknown',
    city,
  };
}

// Fetch traffic via edge function
async function fetchTrafficForCity(city: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/check-traffic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ city }),
    });
    const data = await res.json();
    return data?.traffic || [];
  } catch (err) {
    console.error(`Traffic fetch failed for ${city}:`, err);
    return [];
  }
}

// Fetch fresh weather via edge function
async function fetchWeatherForCity(city: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/fetch-weather`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ city }),
    });
    return await res.json();
  } catch (err) {
    console.error(`Weather fetch failed for ${city}:`, err);
    return null;
  }
}

// Create disruption event with dedup
async function createDisruption(supabase: any, params: {
  type: string; title: string; description: string; city: string; severity: string;
}) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('disruption_events').select('id')
    .eq('city', params.city).eq('type', params.type).eq('is_active', true)
    .gte('started_at', thirtyMinAgo).limit(1);

  if (existing && existing.length > 0) return false;

  await supabase.from('disruption_events').insert({
    type: params.type,
    title: params.title,
    description: params.description,
    city: params.city,
    zone: 'City-wide',
    severity: params.severity,
    source: 'auto_trigger',
    is_active: true,
  });
  return true;
}

// Auto-create claims for affected workers with duplicate prevention
async function createClaimsForCity(
  supabase: any, city: string, triggerType: string, triggerValue: string, weather: any
) {
  let claimsCreated = 0;

  // Find active policies for workers in this city
  const { data: workerProfiles } = await supabase
    .from('worker_profiles').select('user_id, city, zone').eq('city', city);
  if (!workerProfiles || workerProfiles.length === 0) return 0;

  const cityUserIds = new Set(workerProfiles.map((w: any) => w.user_id));

  const { data: policies } = await supabase
    .from('policies').select('id, user_id, max_payout').eq('status', 'active');
  if (!policies) return 0;

  for (const policy of policies) {
    if (!cityUserIds.has(policy.user_id)) continue;

    // Duplicate claim check: same worker + same trigger type in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existingClaim } = await supabase
      .from('claims').select('id')
      .eq('user_id', policy.user_id).eq('trigger_type', triggerType)
      .gte('created_at', oneHourAgo).limit(1);

    if (existingClaim && existingClaim.length > 0) continue;

    const payoutMap: Record<string, number> = {
      heavy_rainfall: 1900, aqi_critical: 1100, extreme_heat: 1600,
      severe_wind: 1400, severe_traffic: 1200,
    };
    const amount = Math.min(payoutMap[triggerType] || 1500, policy.max_payout);

    await supabase.from('claims').insert({
      user_id: policy.user_id,
      policy_id: policy.id,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      amount,
      location_city: city,
      location_zone: 'City-wide',
      status: 'processing',
      fraud_score: 0,
      fraud_check_passed: true,
    });
    claimsCreated++;
  }
  return claimsCreated;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const results: Array<{ city: string; triggers: string[]; claims_created: number }> = [];

    for (const city of CITIES) {
      try {
        // Fetch fresh weather data (which also stores it in DB)
        const weather = await fetchWeatherForCity(city);
        if (!weather || weather.source === 'unavailable') {
          console.warn(`[${city}] No weather data available, skipping triggers`);
          results.push({ city, triggers: [], claims_created: 0 });
          continue;
        }

        const triggeredTypes: string[] = [];

        // Fetch latest AI risk score for this city
        let cityRiskScore: number | null = null;
        const { data: riskRow } = await supabase
          .from('risk_assessments')
          .select('risk_score')
          .eq('city', city)
          .not('risk_score', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (riskRow) cityRiskScore = Number(riskRow.risk_score);

        // AI risk amplification: if risk_score > 0.7, lower thresholds by 20%
        const riskMultiplier = (cityRiskScore !== null && cityRiskScore > 0.7) ? 0.8 : 1.0;

        // Rainfall check with sustained condition
        if (weather.rainfall > THRESHOLDS.rainfall.value * riskMultiplier) {
          const sustained = await checkSustainedCondition(
            supabase, city, 'rainfall', THRESHOLDS.rainfall.value, THRESHOLDS.rainfall.sustainedMinutes
          );
          if (sustained) {
            triggeredTypes.push('heavy_rainfall');
            await createDisruption(supabase, {
              type: 'heavy_rainfall', city,
              title: `Heavy Rainfall Alert - ${city}`,
              description: `Sustained rainfall of ${Number(weather.rainfall).toFixed(1)}mm/hr for ≥1hr, exceeding ${THRESHOLDS.rainfall.value}mm/hr threshold.`,
              severity: weather.rainfall > 100 ? 'critical' : 'high',
            });
          }
        }

        // Temperature check with sustained condition
        if (weather.temperature > THRESHOLDS.temperature.value * riskMultiplier) {
          const sustained = await checkSustainedCondition(
            supabase, city, 'temperature', THRESHOLDS.temperature.value, THRESHOLDS.temperature.sustainedMinutes
          );
          if (sustained) {
            triggeredTypes.push('extreme_heat');
            await createDisruption(supabase, {
              type: 'extreme_heat', city,
              title: `Extreme Heat Warning - ${city}`,
              description: `Sustained temperature of ${Number(weather.temperature).toFixed(1)}°C for ≥2hrs, exceeding ${THRESHOLDS.temperature.value}°C threshold.`,
              severity: weather.temperature > 48 ? 'critical' : 'high',
            });
          }
        }

        // AQI check with sustained condition (using Indian AQI scale, threshold 400)
        const aqiValue = Number(weather.aqi) || 0;
        if (aqiValue >= THRESHOLDS.aqi.value * riskMultiplier) {
          const sustained = await checkSustainedCondition(
            supabase, city, 'aqi', THRESHOLDS.aqi.value, THRESHOLDS.aqi.sustainedMinutes
          );
          if (sustained) {
            triggeredTypes.push('aqi_critical');
            await createDisruption(supabase, {
              type: 'aqi_critical', city,
              title: `Air Quality Critical - ${city}`,
              description: `AQI ${aqiValue} sustained for ≥3hrs. Hazardous for outdoor workers.`,
              severity: aqiValue >= 500 ? 'critical' : 'high',
            });
          }
        }

        // Wind check (immediate, no sustained)
        if (weather.wind_speed > THRESHOLDS.wind_speed.value) {
          triggeredTypes.push('severe_wind');
          await createDisruption(supabase, {
            type: 'severe_wind', city,
            title: `Severe Wind Alert - ${city}`,
            description: `Wind speed of ${Number(weather.wind_speed).toFixed(1)}m/s detected, exceeding ${THRESHOLDS.wind_speed.value}m/s threshold.`,
            severity: weather.wind_speed > 25 ? 'critical' : 'high',
          });
        }

        // Traffic check
        const trafficResults = await fetchTrafficForCity(city);
        const blockedRoutes = trafficResults.filter((t: any) => t.congestionRatio > THRESHOLDS.traffic_congestion.value);
        if (blockedRoutes.length > 0) {
          triggeredTypes.push('severe_traffic');
          // Disruption already created by check-traffic function
        }

        // Create claims for triggered conditions
        let claimsCreated = 0;
        for (const triggerType of triggeredTypes) {
          const triggerValueMap: Record<string, string> = {
            heavy_rainfall: `${Number(weather.rainfall).toFixed(1)}mm/hr`,
            aqi_critical: `AQI ${aqiValue}`,
            extreme_heat: `${Number(weather.temperature).toFixed(1)}°C`,
            severe_wind: `${Number(weather.wind_speed).toFixed(1)}m/s`,
            severe_traffic: `${blockedRoutes.length} route(s) blocked`,
          };
          claimsCreated += await createClaimsForCity(
            supabase, city, triggerType, triggerValueMap[triggerType] || '', weather
          );
        }

        results.push({ city, triggers: triggeredTypes, claims_created: claimsCreated });
      } catch (cityErr) {
        console.error(`Error processing ${city}:`, cityErr);
        results.push({ city, triggers: [], claims_created: 0 });
      }
    }

    return new Response(JSON.stringify({
      processed_at: new Date().toISOString(),
      cities_checked: CITIES.length,
      results,
      total_claims: results.reduce((sum, r) => sum + r.claims_created, 0),
      thresholds: THRESHOLDS,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Auto-trigger error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
