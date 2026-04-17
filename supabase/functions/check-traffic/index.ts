import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CITY_ROUTES: Record<string, { origin: { lat: number; lng: number }; destination: { lat: number; lng: number }; routeName: string; baseMinutes: number }[]> = {
  Mumbai: [
    { origin: { lat: 19.1136, lng: 72.8697 }, destination: { lat: 19.0176, lng: 72.8562 }, routeName: 'Andheri → Bandra (Western Express)', baseMinutes: 25 },
    { origin: { lat: 19.0760, lng: 72.8777 }, destination: { lat: 18.9388, lng: 72.8354 }, routeName: 'CST → Colaba (Eastern Freeway)', baseMinutes: 20 },
  ],
  Delhi: [
    { origin: { lat: 28.6139, lng: 77.2090 }, destination: { lat: 28.5355, lng: 77.2100 }, routeName: 'Connaught Place → Saket', baseMinutes: 30 },
    { origin: { lat: 28.6692, lng: 77.4538 }, destination: { lat: 28.6304, lng: 77.2177 }, routeName: 'Noida → Central Delhi', baseMinutes: 40 },
  ],
  Bangalore: [
    { origin: { lat: 12.9352, lng: 77.6245 }, destination: { lat: 12.9716, lng: 77.5946 }, routeName: 'Koramangala → MG Road', baseMinutes: 15 },
    { origin: { lat: 13.0358, lng: 77.5970 }, destination: { lat: 12.9352, lng: 77.6245 }, routeName: 'Hebbal → Koramangala (ORR)', baseMinutes: 35 },
  ],
  Chennai: [
    { origin: { lat: 13.0827, lng: 80.2707 }, destination: { lat: 12.9165, lng: 80.1270 }, routeName: 'Chennai Central → Tambaram', baseMinutes: 35 },
  ],
  Hyderabad: [
    { origin: { lat: 17.4400, lng: 78.3489 }, destination: { lat: 17.3850, lng: 78.4867 }, routeName: 'HITEC City → Charminar', baseMinutes: 30 },
  ],
  Pune: [
    { origin: { lat: 18.5204, lng: 73.8567 }, destination: { lat: 18.5074, lng: 73.8077 }, routeName: 'Pune Station → Kothrud', baseMinutes: 20 },
  ],
  Kolkata: [
    { origin: { lat: 22.5726, lng: 88.3639 }, destination: { lat: 22.5448, lng: 88.3426 }, routeName: 'Howrah → Park Street', baseMinutes: 25 },
  ],
  Ahmedabad: [
    { origin: { lat: 23.0225, lng: 72.5714 }, destination: { lat: 23.0733, lng: 72.6267 }, routeName: 'City Center → SG Highway', baseMinutes: 20 },
  ],
};

interface TrafficResult {
  city: string;
  routeName: string;
  normalDuration: number;
  trafficDuration: number;
  congestionRatio: number;
  status: 'normal' | 'moderate' | 'severe' | 'blocked';
  source: string;
}

// Time-based estimation fallback (deterministic, no Math.random)
function estimateTrafficFromTime(route: typeof CITY_ROUTES['Mumbai'][0], city: string): TrafficResult {
  const now = new Date();
  const hour = now.getUTCHours() + 5.5; // IST offset
  const normalizedHour = ((hour % 24) + 24) % 24;

  // Rush hour congestion multipliers (deterministic)
  let congestionMultiplier = 1.0;
  if (normalizedHour >= 8 && normalizedHour <= 10) congestionMultiplier = 1.8; // Morning rush
  else if (normalizedHour >= 17 && normalizedHour <= 20) congestionMultiplier = 2.0; // Evening rush
  else if (normalizedHour >= 12 && normalizedHour <= 14) congestionMultiplier = 1.3; // Lunch
  else if (normalizedHour >= 22 || normalizedHour <= 5) congestionMultiplier = 0.8; // Night

  // City-specific multiplier
  const cityMultiplier: Record<string, number> = {
    Mumbai: 1.3, Delhi: 1.25, Bangalore: 1.4, Chennai: 1.1,
    Hyderabad: 1.15, Pune: 1.1, Kolkata: 1.2, Ahmedabad: 1.0,
  };
  congestionMultiplier *= (cityMultiplier[city] || 1.0);

  const normalDuration = route.baseMinutes * 60;
  const trafficDuration = Math.round(normalDuration * congestionMultiplier);
  const ratio = +(trafficDuration / normalDuration).toFixed(2);

  return {
    city,
    routeName: route.routeName,
    normalDuration,
    trafficDuration,
    congestionRatio: ratio,
    status: ratio > 3 ? 'blocked' : ratio > 2.2 ? 'severe' : ratio > 1.5 ? 'moderate' : 'normal',
    source: 'time_estimation',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    const resolvedCity = city || 'Mumbai';
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const routes = CITY_ROUTES[resolvedCity] || CITY_ROUTES['Mumbai'];
    const results: TrafficResult[] = [];

    if (apiKey) {
      // PRIMARY: Google Maps Routes API
      console.log(`[${resolvedCity}] Using Google Maps Routes API (PRIMARY)`);
      for (const route of routes) {
        try {
          const body = {
            origin: { location: { latLng: { latitude: route.origin.lat, longitude: route.origin.lng } } },
            destination: { location: { latLng: { latitude: route.destination.lat, longitude: route.destination.lng } } },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
          };

          const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.duration,routes.staticDuration',
            },
            body: JSON.stringify(body),
          });

          if (res.status !== 200) {
            console.warn(`Google Maps API error for ${route.routeName}: ${res.status}`);
            results.push(estimateTrafficFromTime(route, resolvedCity));
            continue;
          }

          const data = await res.json();
          const routeData = data.routes?.[0];

          if (routeData) {
            const staticSec = parseInt(routeData.staticDuration?.replace('s', '') || String(route.baseMinutes * 60));
            const trafficSec = parseInt(routeData.duration?.replace('s', '') || String(staticSec));
            const ratio = +(trafficSec / Math.max(staticSec, 1)).toFixed(2);

            results.push({
              city: resolvedCity,
              routeName: route.routeName,
              normalDuration: staticSec,
              trafficDuration: trafficSec,
              congestionRatio: ratio,
              status: ratio > 3 ? 'blocked' : ratio > 2.2 ? 'severe' : ratio > 1.5 ? 'moderate' : 'normal',
              source: 'google_maps',
            });
          } else {
            results.push(estimateTrafficFromTime(route, resolvedCity));
          }
        } catch (routeErr) {
          console.error(`Route error for ${route.routeName}:`, routeErr);
          results.push(estimateTrafficFromTime(route, resolvedCity));
        }
      }
    } else {
      // FALLBACK: Time-based estimation (deterministic)
      console.log(`[${resolvedCity}] No GOOGLE_MAPS_API_KEY, using time-based estimation`);
      for (const route of routes) {
        results.push(estimateTrafficFromTime(route, resolvedCity));
      }
    }

    // Auto-create disruption events for severe/blocked traffic
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (const result of results) {
      if (result.status === 'severe' || result.status === 'blocked') {
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from('disruption_events')
          .select('id')
          .eq('type', 'traffic')
          .eq('city', result.city)
          .eq('is_active', true)
          .ilike('title', `%${result.routeName.split('→')[0].trim()}%`)
          .gte('started_at', thirtyMinAgo)
          .limit(1);

        if (!existing || existing.length === 0) {
          const delayMin = Math.round((result.trafficDuration - result.normalDuration) / 60);
          await supabase.from('disruption_events').insert({
            type: 'traffic',
            title: `Traffic ${result.status === 'blocked' ? 'Blockade' : 'Severe Congestion'} - ${result.routeName}`,
            description: `${result.routeName}: ${delayMin}min extra delay (${result.congestionRatio}x normal). Delivery workers severely impacted.`,
            city: result.city,
            zone: result.routeName.split('→')[0].trim(),
            severity: result.status === 'blocked' ? 'critical' : 'high',
            source: result.source,
            is_active: true,
          });
        }
      }
    }

    const primarySource = results.find(r => r.source === 'google_maps') ? 'google_maps' : 'time_estimation';
    return new Response(JSON.stringify({ traffic: results, source: primarySource }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Traffic function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
