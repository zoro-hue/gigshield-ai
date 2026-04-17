import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// City bounding boxes for location mismatch detection
const CITY_BOUNDS: Record<string, { latMin: number; latMax: number; lonMin: number; lonMax: number }> = {
  Mumbai: { latMin: 18.85, latMax: 19.35, lonMin: 72.75, lonMax: 73.05 },
  Delhi: { latMin: 28.40, latMax: 28.90, lonMin: 76.85, lonMax: 77.45 },
  Bangalore: { latMin: 12.80, latMax: 13.20, lonMin: 77.40, lonMax: 77.80 },
  Chennai: { latMin: 12.85, latMax: 13.25, lonMin: 80.10, lonMax: 80.40 },
  Hyderabad: { latMin: 17.20, latMax: 17.55, lonMin: 78.30, lonMax: 78.65 },
  Pune: { latMin: 18.40, latMax: 18.65, lonMin: 73.70, lonMax: 74.00 },
  Kolkata: { latMin: 22.40, latMax: 22.70, lonMin: 88.20, lonMax: 88.50 },
  Ahmedabad: { latMin: 22.90, latMax: 23.15, lonMin: 72.45, lonMax: 72.70 },
};

interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { points, claimed_city } = await req.json() as { points: GPSPoint[]; claimed_city?: string };
    if (!points || points.length < 2) throw new Error('Need at least 2 GPS points');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ---- Duplicate claim check ----
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentClaims } = await adminClient
      .from('claims')
      .select('id, trigger_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    const duplicateClaimWarning = (recentClaims && recentClaims.length > 2)
      ? `WARNING: ${recentClaims.length} claims in last hour — potential duplicate abuse`
      : null;

    // ---- Location mismatch check ----
    let locationMismatch = false;
    let mismatchDetails = '';
    if (claimed_city && CITY_BOUNDS[claimed_city]) {
      const bounds = CITY_BOUNDS[claimed_city];
      const outOfBoundsPoints = points.filter(p =>
        p.latitude < bounds.latMin || p.latitude > bounds.latMax ||
        p.longitude < bounds.lonMin || p.longitude > bounds.lonMax
      );
      if (outOfBoundsPoints.length > points.length * 0.5) {
        locationMismatch = true;
        mismatchDetails = `${outOfBoundsPoints.length}/${points.length} GPS points outside ${claimed_city} boundaries`;
      }
    }

    const results = [];
    let totalAnomalyScore = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      const distKm = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const timeDiffHrs = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3600000;
      const speedKmh = timeDiffHrs > 0 ? distKm / timeDiffHrs : 0;

      let anomalyScore = 0;
      const flags: string[] = [];

      // Speed check — impossible travel (>150 km/h for delivery worker)
      if (speedKmh > 150) {
        anomalyScore += 40;
        flags.push(`impossible_speed:${speedKmh.toFixed(0)}kmh`);
      } else if (speedKmh > 80) {
        anomalyScore += 20;
        flags.push(`high_speed:${speedKmh.toFixed(0)}kmh`);
      }

      // Accuracy check
      if (curr.accuracy && curr.accuracy > 100) {
        anomalyScore += 15;
        flags.push(`low_accuracy:${curr.accuracy}m`);
      }

      // Teleportation check (>50km in <5min)
      if (distKm > 50 && timeDiffHrs < 0.083) {
        anomalyScore += 45;
        flags.push(`teleportation:${distKm.toFixed(1)}km_in_${(timeDiffHrs * 60).toFixed(0)}min`);
      }

      // Stationary spoofing (exact same coords with tiny fluctuation)
      if (distKm < 0.001 && timeDiffHrs > 0.5) {
        anomalyScore += 25;
        flags.push('stationary_spoof');
      }

      // Location mismatch penalty
      if (locationMismatch) {
        anomalyScore += 10;
        flags.push('location_mismatch');
      }

      const isSpoofed = anomalyScore >= 50;
      totalAnomalyScore += anomalyScore;

      // Log to DB
      await adminClient.from('gps_logs').insert({
        user_id: user.id,
        latitude: curr.latitude,
        longitude: curr.longitude,
        accuracy: curr.accuracy || null,
        speed: speedKmh,
        anomaly_score: anomalyScore,
        is_spoofed: isSpoofed,
        flagged_reason: flags.length > 0 ? flags.join(', ') : null,
      });

      results.push({
        point_index: i,
        distance_km: +distKm.toFixed(3),
        speed_kmh: +speedKmh.toFixed(1),
        anomaly_score: anomalyScore,
        is_spoofed: isSpoofed,
        flags,
      });
    }

    const avgScore = totalAnomalyScore / (points.length - 1);

    return new Response(JSON.stringify({
      total_points: points.length,
      avg_anomaly_score: +avgScore.toFixed(1),
      spoofed_count: results.filter(r => r.is_spoofed).length,
      overall_verdict: avgScore >= 40 ? 'HIGH_RISK' : avgScore >= 20 ? 'SUSPICIOUS' : 'CLEAN',
      location_mismatch: locationMismatch,
      location_mismatch_details: mismatchDetails || null,
      duplicate_claim_warning: duplicateClaimWarning,
      details: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
