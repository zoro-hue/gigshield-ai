import { motion } from "framer-motion";
import { MapPin, Shield, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// India map city coordinates mapped to SVG viewBox (0-100 range approximating India's geography)
const INDIA_CITIES: Array<{
  name: string;
  svgX: number;
  svgY: number;
  lat: number;
  lon: number;
}> = [
  { name: "Mumbai", svgX: 28, svgY: 58, lat: 19.076, lon: 72.878 },
  { name: "Delhi", svgX: 42, svgY: 22, lat: 28.614, lon: 77.209 },
  { name: "Bangalore", svgX: 40, svgY: 78, lat: 12.972, lon: 77.595 },
  { name: "Chennai", svgX: 48, svgY: 76, lat: 13.083, lon: 80.271 },
  { name: "Hyderabad", svgX: 42, svgY: 64, lat: 17.385, lon: 78.487 },
  { name: "Pune", svgX: 30, svgY: 62, lat: 18.520, lon: 73.857 },
  { name: "Kolkata", svgX: 68, svgY: 42, lat: 22.573, lon: 88.364 },
  { name: "Ahmedabad", svgX: 24, svgY: 42, lat: 23.023, lon: 72.571 },
  { name: "Jaipur", svgX: 35, svgY: 28, lat: 26.912, lon: 75.787 },
  { name: "Lucknow", svgX: 52, svgY: 28, lat: 26.846, lon: 80.947 },
];

type HeatmapPoint = {
  city: string;
  svgX: number;
  svgY: number;
  claims: number;
  spoofed: number;
  avgFraudScore: number;
  intensity: number;
  suspicious: boolean;
};

type ValidationResult = {
  total_points: number;
  avg_anomaly_score: number;
  spoofed_count: number;
  overall_verdict: string;
  details: Array<{
    point_index: number;
    distance_km: number;
    speed_kmh: number;
    anomaly_score: number;
    is_spoofed: boolean;
    flags: string[];
  }>;
};

const GPSHeatmap = () => {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real GPS data from DB
  useEffect(() => {
    const fetchGPSData = async () => {
      setLoading(true);
      try {
        const { data: gpsLogs } = await supabase
          .from('gps_logs')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(500);

        const { data: claimsData } = await supabase
          .from('claims')
          .select('location_city, fraud_score, fraud_check_passed')
          .order('created_at', { ascending: false })
          .limit(200);

        // Aggregate by city
        const cityStats: Record<string, { claims: number; spoofed: number; totalFraud: number; count: number }> = {};

        // Process claims data
        claimsData?.forEach((c) => {
          const city = c.location_city || 'Mumbai';
          if (!cityStats[city]) cityStats[city] = { claims: 0, spoofed: 0, totalFraud: 0, count: 0 };
          cityStats[city].claims++;
          cityStats[city].totalFraud += Number(c.fraud_score || 0);
          cityStats[city].count++;
          if (!c.fraud_check_passed) cityStats[city].spoofed++;
        });

        // Process GPS logs
        gpsLogs?.forEach((g) => {
          // Find nearest city
          let nearestCity = 'Mumbai';
          let minDist = Infinity;
          INDIA_CITIES.forEach(ic => {
            const d = Math.abs(Number(g.latitude) - ic.lat) + Math.abs(Number(g.longitude) - ic.lon);
            if (d < minDist) { minDist = d; nearestCity = ic.name; }
          });
          if (!cityStats[nearestCity]) cityStats[nearestCity] = { claims: 0, spoofed: 0, totalFraud: 0, count: 0 };
          if (g.is_spoofed) cityStats[nearestCity].spoofed++;
        });

        // Build heatmap points
        const points: HeatmapPoint[] = INDIA_CITIES.map(ic => {
          const stats = cityStats[ic.name] || { claims: 0, spoofed: 0, totalFraud: 0, count: 0 };
          const claims = stats.claims || 0;
          const spoofed = stats.spoofed || 0;
          const avgFraud = stats.count > 0 ? stats.totalFraud / stats.count : 0;
          const intensity = Math.min(1, (claims / 60) + (spoofed / 10));

          return {
            city: ic.name,
            svgX: ic.svgX,
            svgY: ic.svgY,
            claims,
            spoofed,
            avgFraudScore: Math.round(avgFraud),
            intensity,
            suspicious: spoofed >= 3 || avgFraud > 60,
          };
        });

        setHeatmapData(points);
      } catch (err) {
        console.error('GPS heatmap fetch failed:', err);
        // No data fallback — show zeros
        setHeatmapData(INDIA_CITIES.map(ic => ({
          city: ic.name,
          svgX: ic.svgX,
          svgY: ic.svgY,
          claims: 0,
          spoofed: 0,
          avgFraudScore: 0,
          intensity: 0,
          suspicious: false,
        })));
      } finally {
        setLoading(false);
      }
    };
    fetchGPSData();
  }, []);

  const runValidation = async () => {
    setValidating(true);
    try {
      // Use a realistic GPS trace for demo
      const mockGPSTrace = [
        { latitude: 19.076, longitude: 72.8777, accuracy: 5, timestamp: new Date(Date.now() - 300000).toISOString() },
        { latitude: 19.078, longitude: 72.879, accuracy: 8, timestamp: new Date(Date.now() - 240000).toISOString() },
        { latitude: 19.082, longitude: 72.881, accuracy: 6, timestamp: new Date(Date.now() - 180000).toISOString() },
        { latitude: 19.120, longitude: 72.900, accuracy: 150, timestamp: new Date(Date.now() - 120000).toISOString() },
        { latitude: 28.614, longitude: 77.209, accuracy: 5, timestamp: new Date(Date.now() - 60000).toISOString() },
        { latitude: 28.615, longitude: 77.210, accuracy: 4, timestamp: new Date().toISOString() },
      ];
      const { data, error } = await supabase.functions.invoke('validate-gps', {
        body: { points: mockGPSTrace },
      });
      if (error) throw error;
      setResult(data);
    } catch (err) {
      console.error('GPS validation failed:', err);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="glass-card p-6 md:p-7 rounded-2xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-destructive" /> GPS Fraud Heatmap — India
        </h3>
        <button
          onClick={runValidation}
          disabled={validating}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
          {validating ? 'Validating...' : 'Run GPS Validation'}
        </button>
      </div>

      <div className="relative w-full h-[380px] bg-muted/10 rounded-xl border border-border/30 overflow-hidden">
        {/* India outline SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          {/* Grid pattern */}
          <defs>
            <pattern id="heatGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(225, 10%, 14%)" strokeWidth="0.15" opacity="0.4" />
            </pattern>
            <radialGradient id="suspiciousGlow">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="normalGlow">
              <stop offset="0%" stopColor="hsl(38, 95%, 55%)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(38, 95%, 55%)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#heatGrid)" />

          {/* Simplified India outline */}
          <path
            d="M35,8 L40,6 L48,8 L55,7 L62,10 L68,12 L72,16 L74,22 L72,28 L70,32 L72,36 L70,40 L68,44 L65,48 L60,52 L55,58 L52,62 L50,68 L48,74 L45,80 L42,86 L40,90 L38,94 L36,90 L34,84 L30,78 L28,72 L26,66 L24,60 L22,54 L20,48 L18,42 L16,36 L18,30 L20,24 L22,18 L26,12 L30,10 Z"
            fill="hsl(225, 10%, 10%)"
            stroke="hsl(168, 80%, 48%)"
            strokeWidth="0.4"
            opacity="0.6"
          />

          {/* State boundary hints */}
          <line x1="25" y1="35" x2="65" y2="35" stroke="hsl(225, 10%, 18%)" strokeWidth="0.15" strokeDasharray="1" />
          <line x1="30" y1="55" x2="60" y2="55" stroke="hsl(225, 10%, 18%)" strokeWidth="0.15" strokeDasharray="1" />
          <line x1="45" y1="10" x2="45" y2="90" stroke="hsl(225, 10%, 18%)" strokeWidth="0.15" strokeDasharray="1" />
        </svg>

        {/* Heatmap points */}
        {heatmapData.map((point, i) => (
          <motion.div
            key={point.city}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
            className="absolute group"
            style={{ left: `${point.svgX}%`, top: `${point.svgY}%`, transform: "translate(-50%, -50%)" }}
          >
            {/* Glow ring */}
            <div
              className={`rounded-full ${point.suspicious ? "animate-pulse" : ""}`}
              style={{
                width: `${Math.max(30, point.claims * 1.2 + 15)}px`,
                height: `${Math.max(30, point.claims * 1.2 + 15)}px`,
                background: point.suspicious
                  ? `radial-gradient(circle, hsl(0 84% 60% / ${point.intensity * 0.5}), transparent 70%)`
                  : `radial-gradient(circle, hsl(38 95% 55% / ${point.intensity * 0.4}), transparent 70%)`,
              }}
            />
            {/* Center dot */}
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                point.suspicious ? "bg-destructive border-destructive/50" : "bg-warning border-warning/30"
              }`}
              style={{ width: "8px", height: "8px" }}
            />
            {/* City label */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground font-mono whitespace-nowrap opacity-60">
              {point.city}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-10">
              <div className="bg-card border border-border/40 rounded-xl px-3 py-2.5 text-xs whitespace-nowrap shadow-2xl">
                <div className="font-semibold text-foreground">{point.city}</div>
                <div className="text-muted-foreground">{point.claims} claims</div>
                <div className="text-muted-foreground">{point.spoofed} spoofed GPS</div>
                <div className="text-muted-foreground">Avg fraud: {point.avgFraudScore}%</div>
                <div className={point.suspicious ? "text-destructive font-medium" : "text-warning"}>
                  Risk: {Math.round(point.intensity * 100)}%
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 bg-card/80 backdrop-blur-sm border border-border/30 rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
            <span className="text-muted-foreground">Normal Activity</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-muted-foreground">Suspicious Cluster</span>
          </div>
          <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
            {loading ? 'Loading...' : `${heatmapData.reduce((a, b) => a + b.claims, 0)} total claims`}
          </div>
        </div>

        {/* Data source indicator */}
        <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm border border-border/30 rounded-lg px-2 py-1 text-[10px] font-mono text-muted-foreground">
          📡 DB + GPS Logs
        </div>
      </div>

      {/* Validation Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
              result.overall_verdict === 'HIGH_RISK' ? 'bg-destructive/10 text-destructive' :
              result.overall_verdict === 'SUSPICIOUS' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
            }`}>{result.overall_verdict}</span>
            <span className="text-xs text-muted-foreground">{result.spoofed_count} spoofed points detected</span>
            <span className="text-xs text-muted-foreground font-mono">Avg score: {result.avg_anomaly_score}</span>
          </div>
          <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
            {result.details.map((d, i) => (
              <div key={i} className={`flex items-center gap-3 text-[11px] px-3 py-2 rounded-lg ${d.is_spoofed ? 'bg-destructive/5 border border-destructive/10' : 'bg-muted/10 border border-border/20'}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${d.is_spoofed ? 'bg-destructive animate-pulse' : 'bg-success'}`} />
                <span className="font-mono text-muted-foreground w-12">Pt {d.point_index}</span>
                <span className="text-muted-foreground">{d.distance_km}km</span>
                <span className={d.speed_kmh > 150 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>{d.speed_kmh}km/h</span>
                {d.flags.length > 0 && (
                  <span className="text-destructive font-mono text-[10px]">{d.flags.join(', ')}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GPSHeatmap;
