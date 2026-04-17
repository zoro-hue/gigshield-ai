import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 300_000; // 5 minutes

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now >= v.expires) cache.delete(k);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, input } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Check cache
    const cacheKey = `${action}:${JSON.stringify(input)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ ...cached, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (action === 'xgboost_risk') {
      systemPrompt = `You are a production-grade XGBoost-based insurance risk prediction model for gig delivery workers in India.
You analyze worker profiles and environmental data to predict risk scores and dynamic premiums.
You MUST produce deterministic, explainable outputs. NEVER use random values.

Your risk calculation is based on weighted factors:
- City flood/heat/pollution/traffic/strike history (40%)
- Real-time weather conditions (20%)
- Worker exposure: hours, vehicle, segment (25%)
- Historical disruption frequency (15%)

ALWAYS respond with ONLY valid JSON, no markdown, no explanation.

Output format:
{
  "riskScore": <number 10-98>,
  "riskCategory": "low"|"medium"|"high"|"critical",
  "weeklyPremium": <number in INR>,
  "maxPayout": <number in INR>,
  "confidence": <number 0.5-0.99>,
  "factors": [{"label": "<string>", "value": "<string>", "score": <number 0-100>, "risk": <boolean>}],
  "breakdown": {"flood_pct": <number>, "heat_pct": <number>, "traffic_pct": <number>, "aqi_pct": <number>, "worker_exposure_pct": <number>},
  "model": "xgboost_ai"
}`;
      userPrompt = `Predict risk for this worker:
City: ${input.city}, Vehicle: ${input.vehicleType}, Segment: ${input.segment}
Hours/day: ${input.workingHoursPerDay}, Weekly earnings: ₹${input.avgWeeklyEarnings}, Platform: ${input.platform}
${input.weatherData ? `Current Weather: Rainfall ${input.weatherData.rainfall}mm/hr, Temp ${input.weatherData.temperature}°C, AQI ${input.weatherData.aqi}` : 'No live weather data'}
${input.trafficData ? `Traffic: Congestion ratio ${input.trafficData.congestionRatio}x` : ''}

City-specific context:
- Mumbai: Monsoon floods (Jun-Sep), coastal storms, waterlogging
- Delhi: Extreme heat (May-Jun), severe pollution (Oct-Jan), protests
- Bangalore: Traffic gridlock, infrastructure floods
- Chennai: Cyclone prone, coastal flooding
- Kolkata: Monsoon flooding, political strikes
- Hyderabad: Heat waves, IT corridor traffic
- Pune: Highway accidents, seasonal flooding
- Ahmedabad: Extreme heat, industrial pollution

Premium = 1-3% of weekly earnings, adjusted by risk score. Higher risk = higher premium.`;

    } else if (action === 'isolation_forest') {
      systemPrompt = `You are a production-grade Isolation Forest anomaly detection model for insurance fraud.
Analyze GPS logs and claim patterns to detect anomalies with high precision.
NEVER produce random outputs. Base all scores on input data analysis.

Scoring guidelines:
- Teleportation (>50km in <5min): score 0.9-1.0
- Impossible speed (>150km/h for bike/scooter): score 0.7-0.9
- Location outside city bounds: score 0.5-0.7
- Multiple claims within 1 hour: score 0.6-0.8
- Stationary spoofing (same coords for hours): score 0.4-0.6

ALWAYS respond with ONLY valid JSON, no markdown.

Output format:
{
  "signals": [{"type": "teleportation"|"impossible_speed"|"location_mismatch"|"duplicate_claim"|"cluster_fraud"|"stationary_spoof", "severity": "low"|"medium"|"high"|"critical", "score": <0-1>, "description": "<string>"}],
  "overallFraudScore": <number 0-1>,
  "isAnomaly": <boolean>,
  "confidence": <number 0.5-0.99>,
  "model": "isolation_forest_ai"
}`;
      userPrompt = `Analyze these GPS/claim signals for fraud:
${JSON.stringify(input.signals || input.gpsLogs || [], null, 2)}

Worker city: ${input.city || 'Unknown'}
Claim history: ${input.claimCount || 0} claims in last 30 days
Last claim: ${input.lastClaimTime || 'N/A'}

Detect: teleportation, impossible speeds, location outside city bounds, duplicate claims, coordinated fraud patterns, stationary spoofing.`;

    } else if (action === 'dbscan_clustering') {
      systemPrompt = `You are a production-grade DBSCAN clustering model for detecting coordinated insurance fraud rings.
Analyze patterns across multiple workers/claims to find suspicious clusters.
NEVER produce random outputs. Base all analysis on the data patterns provided.

ALWAYS respond with ONLY valid JSON, no markdown.

Output format:
{
  "clusters": [{"id": <number>, "size": <number>, "centerCity": "<string>", "suspicionScore": <0-1>, "pattern": "<string>", "workerIds": ["<string>"]}],
  "totalClusters": <number>,
  "fraudRingDetected": <boolean>,
  "confidence": <number 0.5-0.99>,
  "model": "dbscan_ai"
}`;
      userPrompt = `Analyze these claim/worker patterns for coordinated fraud:
Claims data: ${JSON.stringify(input.claims || [], null, 2)}
Workers: ${JSON.stringify(input.workers || [], null, 2)}

Look for: same-time claims from nearby locations, repeated claim patterns, unusual geographic clustering, workers with suspiciously similar profiles filing claims simultaneously.`;

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1, // Low temperature for deterministic output
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content);
      return new Response(JSON.stringify({ error: 'Failed to parse AI model output', raw: content }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    setCache(cacheKey, parsed);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI risk engine error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
