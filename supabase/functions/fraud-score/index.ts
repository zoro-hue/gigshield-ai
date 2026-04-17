import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, claim_id } = await req.json();
    if (!user_id) throw new Error('user_id is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ===== 1. GPS SPOOFING RISK =====
    let gpsRisk = 0;
    const gpsFlags: string[] = [];

    const { data: recentGps } = await supabase
      .from('gps_logs')
      .select('latitude, longitude, recorded_at, speed, anomaly_score, is_spoofed')
      .eq('user_id', user_id)
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (recentGps && recentGps.length >= 2) {
      for (let i = 1; i < recentGps.length; i++) {
        const prev = recentGps[i];
        const curr = recentGps[i - 1];
        const dist = haversine(Number(prev.latitude), Number(prev.longitude), Number(curr.latitude), Number(curr.longitude));
        const timeDiffMin = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 60000;

        // >80km in 5 min = fraud flag
        if (dist > 80 && timeDiffMin <= 5) {
          gpsRisk += 40;
          gpsFlags.push(`teleportation:${dist.toFixed(1)}km_in_${timeDiffMin.toFixed(0)}min`);
        } else if (dist > 50 && timeDiffMin <= 10) {
          gpsRisk += 25;
          gpsFlags.push(`suspicious_speed:${dist.toFixed(1)}km_in_${timeDiffMin.toFixed(0)}min`);
        }
      }

      // Check for already-flagged spoofed points
      const spoofedCount = recentGps.filter(g => g.is_spoofed).length;
      if (spoofedCount > 0) {
        gpsRisk += spoofedCount * 10;
        gpsFlags.push(`${spoofedCount}_spoofed_points`);
      }
    }
    gpsRisk = Math.min(gpsRisk, 100);

    // ===== 2. WEATHER FRAUD RISK =====
    let weatherRisk = 0;
    const weatherFlags: string[] = [];

    if (claim_id) {
      const { data: claim } = await supabase
        .from('claims')
        .select('trigger_type, trigger_value, created_at, location_city')
        .eq('id', claim_id)
        .maybeSingle();

      if (claim && claim.location_city) {
        // Get weather at claim time
        const claimTime = new Date(claim.created_at);
        const windowStart = new Date(claimTime.getTime() - 60 * 60 * 1000).toISOString();
        const windowEnd = new Date(claimTime.getTime() + 60 * 60 * 1000).toISOString();

        const { data: weatherAtTime } = await supabase
          .from('weather_readings')
          .select('rainfall, temperature, aqi')
          .eq('city', claim.location_city)
          .gte('recorded_at', windowStart)
          .lte('recorded_at', windowEnd)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (weatherAtTime) {
          // Check if claim trigger matches actual weather
          if (claim.trigger_type === 'rain' && Number(weatherAtTime.rainfall) < 10) {
            weatherRisk += 40;
            weatherFlags.push(`rain_claim_but_rainfall_only_${weatherAtTime.rainfall}mm`);
          }
          if (claim.trigger_type === 'heat' && Number(weatherAtTime.temperature) < 35) {
            weatherRisk += 40;
            weatherFlags.push(`heat_claim_but_temp_only_${weatherAtTime.temperature}C`);
          }
          if (claim.trigger_type === 'pollution' && Number(weatherAtTime.aqi) < 100) {
            weatherRisk += 35;
            weatherFlags.push(`pollution_claim_but_aqi_only_${weatherAtTime.aqi}`);
          }
        } else {
          // No weather data to verify = moderate suspicion
          weatherRisk += 15;
          weatherFlags.push('no_weather_data_to_verify');
        }
      }
    }
    weatherRisk = Math.min(weatherRisk, 100);

    // ===== 3. BEHAVIORAL FRAUD RISK =====
    let behaviorRisk = 0;
    const behaviorFlags: string[] = [];

    // Claims in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentClaims } = await supabase
      .from('claims')
      .select('id, created_at, amount, trigger_type')
      .eq('user_id', user_id)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });

    if (recentClaims) {
      // >3 claims in 24h = suspicious
      if (recentClaims.length > 5) {
        behaviorRisk += 40;
        behaviorFlags.push(`${recentClaims.length}_claims_in_24h`);
      } else if (recentClaims.length > 3) {
        behaviorRisk += 20;
        behaviorFlags.push(`${recentClaims.length}_claims_in_24h`);
      }

      // Rapid-fire claims (multiple within 30 min)
      for (let i = 1; i < recentClaims.length; i++) {
        const gap = (new Date(recentClaims[i - 1].created_at).getTime() - new Date(recentClaims[i].created_at).getTime()) / 60000;
        if (gap < 30) {
          behaviorRisk += 15;
          behaviorFlags.push(`rapid_fire:${gap.toFixed(0)}min_gap`);
          break;
        }
      }

      // Same trigger type repeated
      const triggerCounts: Record<string, number> = {};
      recentClaims.forEach(c => { triggerCounts[c.trigger_type] = (triggerCounts[c.trigger_type] || 0) + 1; });
      Object.entries(triggerCounts).forEach(([type, count]) => {
        if (count > 3) {
          behaviorRisk += 20;
          behaviorFlags.push(`repeated_${type}:${count}x`);
        }
      });
    }

    // Claims in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weeklyClaimCount } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', weekAgo);

    if ((weeklyClaimCount || 0) > 10) {
      behaviorRisk += 25;
      behaviorFlags.push(`${weeklyClaimCount}_claims_in_7d`);
    }

    behaviorRisk = Math.min(behaviorRisk, 100);

    // ===== COMPOSITE FRAUD SCORE =====
    const fraudScore = Math.round(
      gpsRisk * 0.4 + weatherRisk * 0.3 + behaviorRisk * 0.3
    );
    const severity = fraudScore >= 70 ? 'HIGH' : fraudScore >= 40 ? 'MEDIUM' : 'LOW';

    const result = {
      user_id,
      claim_id: claim_id || null,
      fraud_score: fraudScore,
      severity,
      gps_risk: { score: gpsRisk, flags: gpsFlags },
      weather_risk: { score: weatherRisk, flags: weatherFlags },
      behavior_risk: { score: behaviorRisk, flags: behaviorFlags },
      computed_at: new Date().toISOString(),
    };

    // Update claim fraud_score if claim_id provided
    if (claim_id) {
      await supabase
        .from('claims')
        .update({
          fraud_score: fraudScore,
          fraud_check_passed: fraudScore < 60,
        })
        .eq('id', claim_id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
