import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  Mumbai: { lat: 19.076, lon: 72.8777 },
  Delhi: { lat: 28.6139, lon: 77.209 },
  Bangalore: { lat: 12.9716, lon: 77.5946 },
  Chennai: { lat: 13.0827, lon: 80.2707 },
  Hyderabad: { lat: 17.385, lon: 78.4867 },
  Pune: { lat: 18.5204, lon: 73.8567 },
  Kolkata: { lat: 22.5726, lon: 88.3639 },
  Ahmedabad: { lat: 23.0225, lon: 72.5714 },
};

// In-memory cache: city -> { data, expires }
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60_000; // 60 seconds

async function fetchFromOpenWeatherMap(coords: { lat: number; lon: number }, apiKey: string, city: string) {
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${apiKey}`;
  const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}`;

  const [weatherRes, airRes] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);

  if (weatherRes.status === 401) {
    console.error('OpenWeatherMap API key is invalid (401 Unauthorized)');
    return null;
  }
  if (weatherRes.status !== 200) {
    console.warn(`OpenWeatherMap API returned status: ${weatherRes.status}`);
    return null;
  }

  const weather = await weatherRes.json();
  let aqi = 100;
  let aqiRaw = 1;
  try {
    if (airRes.status === 200) {
      const air = await airRes.json();
      const aqiMap: Record<number, number> = { 1: 50, 2: 100, 3: 200, 4: 300, 5: 450 };
      aqiRaw = air.list?.[0]?.main?.aqi || 1;
      aqi = aqiMap[aqiRaw] ?? aqiRaw * 100;
    }
  } catch (e) {
    console.warn('AQI fetch from OpenWeatherMap failed:', e);
  }

  return {
    temperature: weather.main?.temp ?? 0,
    rainfall: weather.rain?.['1h'] ?? weather.rain?.['3h'] ?? 0,
    aqi,
    aqi_raw: aqiRaw,
    humidity: weather.main?.humidity ?? 0,
    wind_speed: weather.wind?.speed ?? 0,
    weather_condition: weather.weather?.[0]?.main ?? 'Unknown',
    weather_description: weather.weather?.[0]?.description ?? '',
    source: 'openweathermap',
    city,
  };
}

async function fetchFromOpenMeteo(coords: { lat: number; lon: number }, city: string) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (res.status !== 200) {
      console.warn('Open-Meteo API returned status:', res.status);
      return null;
    }
    const data = await res.json();
    const current = data.current;
    if (!current) return null;

    let aqi = 100;
    try {
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lon}&current=european_aqi,pm10,pm2_5`;
      const aqiRes = await fetch(aqiUrl);
      if (aqiRes.status === 200) {
        const aqiData = await aqiRes.json();
        const pm25 = aqiData.current?.pm2_5 ?? 0;
        if (pm25 <= 30) aqi = Math.round(pm25 * 50 / 30);
        else if (pm25 <= 60) aqi = Math.round(50 + (pm25 - 30) * 50 / 30);
        else if (pm25 <= 90) aqi = Math.round(100 + (pm25 - 60) * 100 / 30);
        else if (pm25 <= 120) aqi = Math.round(200 + (pm25 - 90) * 100 / 30);
        else if (pm25 <= 250) aqi = Math.round(300 + (pm25 - 120) * 100 / 130);
        else aqi = Math.round(400 + (pm25 - 250) * 100 / 130);
      }
    } catch (e) {
      console.warn('AQI fetch from Open-Meteo failed:', e);
    }

    return {
      temperature: current.temperature_2m ?? 0,
      rainfall: current.rain ?? 0,
      aqi,
      humidity: current.relative_humidity_2m ?? 0,
      wind_speed: +(current.wind_speed_10m ? (current.wind_speed_10m / 3.6).toFixed(1) : 0),
      weather_condition: getWeatherCondition(current.weather_code),
      weather_description: getWeatherDescription(current.weather_code),
      source: 'open-meteo',
      city,
    };
  } catch (e) {
    console.error('Open-Meteo fetch error:', e);
    return null;
  }
}

function getWeatherCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Clouds';
  if (code <= 49) return 'Fog';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 84) return 'Rain';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'depositing rime fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
    61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain',
    71: 'slight snow', 73: 'moderate snow', 75: 'heavy snow',
    80: 'slight showers', 81: 'moderate showers', 82: 'violent showers',
    95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail',
  };
  return descriptions[code] || 'unknown';
}

// Last-known-good fallback from DB
async function fetchLastKnownWeather(supabase: any, city: string) {
  const { data } = await supabase
    .from('weather_readings')
    .select('*')
    .eq('city', city)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      temperature: Number(data.temperature) || 0,
      rainfall: Number(data.rainfall) || 0,
      aqi: Number(data.aqi) || 0,
      humidity: Number(data.humidity) || 0,
      wind_speed: Number(data.wind_speed) || 0,
      source: 'last_known_db',
      city,
    };
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    const resolvedCity = city || 'Mumbai';
    const apiKey = Deno.env.get('OPENWEATHERMAP_API_KEY');
    const coords = CITY_COORDS[resolvedCity] || CITY_COORDS['Mumbai'];

    // Check cache first
    const cached = cache.get(resolvedCity);
    if (cached && Date.now() < cached.expires) {
      console.log(`[${resolvedCity}] Returning cached weather (source: ${cached.data.source})`);
      return new Response(JSON.stringify({ ...cached.data, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result = null;

    // PRIMARY: OpenWeatherMap
    if (apiKey) {
      console.log(`[${resolvedCity}] Trying OpenWeatherMap (PRIMARY)...`);
      result = await fetchFromOpenWeatherMap(coords, apiKey, resolvedCity);
      if (result) console.log(`[${resolvedCity}] ✓ OpenWeatherMap success`);
      else console.warn(`[${resolvedCity}] ✗ OpenWeatherMap failed`);
    } else {
      console.warn(`[${resolvedCity}] No OPENWEATHERMAP_API_KEY configured`);
    }

    // FALLBACK 1: Open-Meteo
    if (!result) {
      console.log(`[${resolvedCity}] Trying Open-Meteo (FALLBACK)...`);
      result = await fetchFromOpenMeteo(coords, resolvedCity);
      if (result) console.log(`[${resolvedCity}] ✓ Open-Meteo success`);
      else console.warn(`[${resolvedCity}] ✗ Open-Meteo failed`);
    }

    // FALLBACK 2: Last known value from DB (NO random/mock)
    if (!result) {
      console.warn(`[${resolvedCity}] All APIs failed, trying last known DB value`);
      result = await fetchLastKnownWeather(supabase, resolvedCity);
      if (result) console.log(`[${resolvedCity}] ✓ Using last known DB value`);
    }

    // FINAL: Return zeros instead of mock/random
    if (!result) {
      console.error(`[${resolvedCity}] No weather data available at all`);
      result = {
        temperature: 0, rainfall: 0, aqi: 0, humidity: 0, wind_speed: 0,
        source: 'unavailable', city: resolvedCity,
      };
    }

    // Cache the result
    cache.set(resolvedCity, { data: result, expires: Date.now() + CACHE_TTL });

    // Store reading in DB (skip if unavailable/cached)
    if (result.source !== 'unavailable' && result.source !== 'last_known_db') {
      await supabase.from('weather_readings').insert({
        city: result.city,
        temperature: result.temperature,
        rainfall: result.rainfall,
        aqi: result.aqi,
        humidity: result.humidity,
        wind_speed: result.wind_speed,
        source: result.source,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Weather function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
