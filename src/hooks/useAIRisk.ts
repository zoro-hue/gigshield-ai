import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AIRiskAssessment {
  risk_score: number | null;
  risk_label: "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE";
  weather_snapshot: {
    temperature: number;
    rainfall: number;
    humidity: number;
    wind_speed: number;
    aqi: number;
  } | null;
  source: string;
  model_version?: string;
  created_at: string;
}

type AIRiskState = "loading" | "success";

// Deterministic fallback risk engine — NO randomness
const CITY_BASE_RISK: Record<string, number> = {
  Mumbai: 0.62, Delhi: 0.58, Bangalore: 0.42, Chennai: 0.55,
  Hyderabad: 0.40, Pune: 0.38, Kolkata: 0.56, Ahmedabad: 0.44,
};

function computeFallbackRisk(city: string, weather?: AIRiskAssessment["weather_snapshot"]): AIRiskAssessment {
  let score = CITY_BASE_RISK[city] ?? 0.45;

  if (weather) {
    if (weather.rainfall > 50) score += 0.12;
    else if (weather.rainfall > 20) score += 0.06;
    if (weather.temperature > 42) score += 0.08;
    else if (weather.temperature > 38) score += 0.04;
    if (weather.aqi > 300) score += 0.10;
    else if (weather.aqi > 150) score += 0.05;
    if (weather.wind_speed > 15) score += 0.06;
    if (weather.humidity > 85) score += 0.03;
  }

  score = Math.min(0.98, Math.max(0.05, score));
  const label: AIRiskAssessment["risk_label"] = score >= 0.6 ? "HIGH" : score >= 0.3 ? "MEDIUM" : "LOW";

  return {
    risk_score: Math.round(score * 10000) / 10000,
    risk_label: label,
    weather_snapshot: weather || null,
    source: "rule_based_fallback",
    model_version: "fallback_v1",
    created_at: new Date().toISOString(),
  };
}

export function useAIRisk(city: string) {
  const [assessment, setAssessment] = useState<AIRiskAssessment | null>(null);
  const [state, setState] = useState<AIRiskState>("loading");

  const fetchLatest = useCallback(async () => {
    if (!city) return;
    setState("loading");

    try {
      // 1. Check DB for recent valid assessment (< 10 min old)
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: latest } = await supabase
        .from("risk_assessments")
        .select("*")
        .eq("city", city)
        .gte("created_at", tenMinAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.risk_label !== "UNAVAILABLE" && latest.risk_score != null) {
        setAssessment({
          risk_score: latest.risk_score,
          risk_label: (latest.risk_label as any) || "MEDIUM",
          weather_snapshot: latest.weather_snapshot as any,
          source: latest.source || "ai_service",
          model_version: (latest as any).model_version || undefined,
          created_at: latest.created_at,
        });
        setState("success");
        return;
      }

      // 2. Call the predict-risk edge function (it tries AI API internally, returns result)
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("predict-risk", {
          body: { city },
        });

        if (!fnError && fnData && fnData.risk_score != null && fnData.risk_label !== "UNAVAILABLE") {
          setAssessment({
            risk_score: fnData.risk_score,
            risk_label: fnData.risk_label || "MEDIUM",
            weather_snapshot: fnData.weather_snapshot || null,
            source: fnData.source || "ai_service",
            model_version: fnData.model_version || undefined,
            created_at: fnData.created_at || new Date().toISOString(),
          });
          setState("success");
          return;
        }
      } catch (edgeFnErr) {
        console.warn("Edge function call failed, using local fallback:", edgeFnErr);
      }

      // 3. Fallback: get latest weather from DB and compute locally
      const { data: weatherRow } = await supabase
        .from("weather_readings")
        .select("temperature, rainfall, humidity, wind_speed, aqi")
        .eq("city", city)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const weatherSnap = weatherRow ? {
        temperature: Number(weatherRow.temperature) || 30,
        rainfall: Number(weatherRow.rainfall) || 0,
        humidity: Number(weatherRow.humidity) || 60,
        wind_speed: Number(weatherRow.wind_speed) || 5,
        aqi: Number(weatherRow.aqi) || 100,
      } : undefined;

      const fallback = computeFallbackRisk(city, weatherSnap);
      setAssessment(fallback);
      setState("success");
    } catch (err) {
      console.error("AI risk fetch failed, using fallback:", err);
      const fallback = computeFallbackRisk(city);
      setAssessment(fallback);
      setState("success");
    }
  }, [city]);

  useEffect(() => {
    fetchLatest();

    const channel = supabase
      .channel(`risk-assessments-${city}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'risk_assessments', filter: `city=eq.${city}` },
        (payload) => {
          const row = payload.new as any;
          if (row.risk_label !== "UNAVAILABLE" && row.risk_score != null) {
            setAssessment({
              risk_score: row.risk_score,
              risk_label: row.risk_label || "MEDIUM",
              weather_snapshot: row.weather_snapshot,
              source: row.source || "ai_service",
              model_version: row.model_version || undefined,
              created_at: row.created_at,
            });
            setState("success");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [city, fetchLatest]);

  return { assessment, state, refetch: fetchLatest };
}
