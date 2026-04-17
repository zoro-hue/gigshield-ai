import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveWeatherData = {
  temperature: number;
  rainfall: number;
  aqi: number;
  humidity: number;
  wind_speed: number;
  source: string;
  city: string;
  aqi_raw?: number;
  weather_condition?: string;
  weather_description?: string;
};

export function useLiveWeather(city: string, refreshIntervalMs = 60000) {
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-weather', {
        body: { city },
      });
      if (fnError) throw fnError;
      setWeather(data);
      setIsLive(data?.source === 'openweathermap' || data?.source === 'open-meteo');
    } catch (err: any) {
      console.error('Weather fetch failed:', err);
      setError(err.message);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchWeather, refreshIntervalMs]);

  return { weather, loading, isLive, error, refetch: fetchWeather };
}

export type DisruptionEvent = {
  id: string;
  type: string;
  title: string;
  description: string;
  city: string;
  zone: string;
  severity: string;
  source: string;
  is_active: boolean;
};

export function useLiveDisruptions(city: string) {
  const [disruptions, setDisruptions] = useState<DisruptionEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDisruptions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-disruptions', {
        body: { city },
      });
      if (error) throw error;
      if (data?.disruptions) setDisruptions(data.disruptions);
    } catch (err) {
      console.error('Disruptions fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchDisruptions();
    const interval = setInterval(fetchDisruptions, 60000);
    return () => clearInterval(interval);
  }, [fetchDisruptions]);

  return { disruptions, loading, refetch: fetchDisruptions };
}

export type TrafficData = {
  city: string;
  routeName: string;
  normalDuration: number;
  trafficDuration: number;
  congestionRatio: number;
  status: 'normal' | 'moderate' | 'severe' | 'blocked';
  source: string;
};

export function useLiveTraffic(city: string, refreshIntervalMs = 120000) {
  const [traffic, setTraffic] = useState<TrafficData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const fetchTraffic = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-traffic', {
        body: { city },
      });
      if (error) throw error;
      if (data?.traffic) {
        setTraffic(data.traffic);
        setIsLive(data.source === 'google_maps');
      }
    } catch (err) {
      console.error('Traffic fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchTraffic();
    const interval = setInterval(fetchTraffic, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchTraffic, refreshIntervalMs]);

  return { traffic, loading, isLive, refetch: fetchTraffic };
}

export function useRecentClaims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClaims = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('claims')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        if (data) setClaims(data);
      } catch (err) {
        console.error('Claims fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, []);

  return { claims, loading };
}
