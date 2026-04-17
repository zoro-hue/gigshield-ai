/**
 * GigShield Risk Engine — Modular architecture with AI model integration
 * 
 * Active models:
 * - Rule-based: 7-factor composite (fallback, always available)
 * - XGBoost AI: Dynamic premium prediction via Lovable AI
 * - Isolation Forest AI: Fraud anomaly detection via Lovable AI
 * - DBSCAN AI: Coordinated fraud clustering via Lovable AI
 */

import { supabase } from "@/integrations/supabase/client";

// ============ INTERFACES ============
export interface RiskInput {
  city: string;
  vehicleType: string;
  segment: string;
  workingHoursPerDay: number;
  avgWeeklyEarnings: number;
  platform: string;
  weatherData?: { rainfall: number; temperature: number; aqi: number };
  trafficData?: { congestionRatio: number };
}

export interface RiskOutput {
  riskScore: number;
  weeklyPremium: number;
  maxPayout: number;
  factors: RiskFactor[];
  model: string;
  confidence?: number;
  cached?: boolean;
}

export interface RiskFactor {
  label: string;
  value: string;
  score: number;
  risk: boolean;
}

export interface FraudSignal {
  type: 'teleportation' | 'impossible_speed' | 'location_mismatch' | 'duplicate_claim' | 'cluster_fraud';
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
}

export interface FraudResult {
  signals: FraudSignal[];
  overallFraudScore: number;
  isAnomaly: boolean;
  model: string;
}

export interface ClusterResult {
  clusters: Array<{
    id: number;
    size: number;
    centerCity: string;
    suspicionScore: number;
    pattern: string;
    workerIds: string[];
  }>;
  totalClusters: number;
  fraudRingDetected: boolean;
  model: string;
}

export interface RiskModel {
  name: string;
  version: string;
  computeRisk(input: RiskInput): Promise<RiskOutput> | RiskOutput;
}

export interface FraudDetector {
  name: string;
  version: string;
  detectFraud(signals: any[]): Promise<FraudSignal[]> | FraudSignal[];
}

// ============ LRU CACHE ============
class LRUCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();
  constructor(private maxSize: number, private ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expires) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expires: Date.now() + this.ttlMs });
  }

  clear() { this.cache.clear(); }
}

const riskCache = new LRUCache<RiskOutput>(50, 300_000); // 5 min TTL
const fraudCache = new LRUCache<FraudSignal[]>(30, 120_000); // 2 min TTL

// ============ CITY RISK DATA ============
const CITY_RISK_FACTORS: Record<string, { base: number; flood: number; heat: number; pollution: number; traffic: number; strike: number }> = {
  Mumbai: { base: 75, flood: 95, heat: 40, pollution: 55, traffic: 80, strike: 50 },
  Delhi: { base: 70, flood: 30, heat: 90, pollution: 95, traffic: 85, strike: 60 },
  Bangalore: { base: 55, flood: 45, heat: 35, pollution: 40, traffic: 90, strike: 30 },
  Chennai: { base: 65, flood: 80, heat: 70, pollution: 50, traffic: 65, strike: 55 },
  Hyderabad: { base: 50, flood: 50, heat: 60, pollution: 45, traffic: 70, strike: 25 },
  Pune: { base: 45, flood: 55, heat: 45, pollution: 40, traffic: 60, strike: 35 },
  Kolkata: { base: 65, flood: 75, heat: 50, pollution: 70, traffic: 75, strike: 70 },
  Ahmedabad: { base: 45, flood: 25, heat: 85, pollution: 55, traffic: 50, strike: 40 },
};

const VEHICLE_RISK: Record<string, number> = { Bicycle: 1.3, 'Two-Wheeler': 1.2, 'Three-Wheeler': 1.0, 'Four-Wheeler': 0.8 };
const SEGMENT_RISK: Record<string, number> = { 'Food Delivery': 1.15, 'Quick Commerce / Grocery': 1.1, 'E-Commerce': 0.95 };
const PLATFORM_RISK: Record<string, number> = { Zomato: 1.0, Swiggy: 0.95, Zepto: 1.1, Blinkit: 1.08, Dunzo: 1.05, Other: 1.15 };

// ============ RULE-BASED MODEL (Fallback) ============
export class RuleBasedRiskModel implements RiskModel {
  name = 'rule_based';
  version = '1.0.0';

  computeRisk(input: RiskInput): RiskOutput {
    const cr = CITY_RISK_FACTORS[input.city] || { base: 50, flood: 50, heat: 50, pollution: 50, traffic: 50, strike: 50 };
    const vMult = VEHICLE_RISK[input.vehicleType] || 1.0;
    const sMult = SEGMENT_RISK[input.segment] || 1.0;
    const pMult = PLATFORM_RISK[input.platform] || 1.0;
    const hoursMult = input.workingHoursPerDay > 12 ? 1.35 : input.workingHoursPerDay > 10 ? 1.2 : input.workingHoursPerDay > 8 ? 1.08 : 0.95;

    let weatherBoost = 0;
    if (input.weatherData) {
      if (input.weatherData.rainfall > 50) weatherBoost += 10;
      if (input.weatherData.temperature > 42) weatherBoost += 8;
      if (input.weatherData.aqi > 300) weatherBoost += 12;
    }

    const rawScore = (cr.base * 0.4 + (cr.flood + cr.heat + cr.pollution + cr.traffic + cr.strike) / 5 * 0.3 + 50 * hoursMult * 0.15 + 50 * vMult * 0.15) * sMult * pMult + weatherBoost;
    const riskScore = Math.min(98, Math.max(12, Math.round(rawScore)));

    const factors: RiskFactor[] = [
      { label: 'Flood History (3Y)', value: cr.flood > 70 ? 'High' : cr.flood > 40 ? 'Medium' : 'Low', score: cr.flood, risk: cr.flood > 60 },
      { label: 'Extreme Heat Days/Y', value: cr.heat > 70 ? `${Math.round(cr.heat * 0.5)} days` : `${Math.round(cr.heat * 0.3)} days`, score: cr.heat, risk: cr.heat > 60 },
      { label: 'Pollution Risk', value: cr.pollution > 80 ? 'Very High' : cr.pollution > 50 ? 'Moderate' : 'Low', score: cr.pollution, risk: cr.pollution > 60 },
      { label: 'Traffic Congestion', value: cr.traffic > 80 ? 'Severe' : cr.traffic > 50 ? 'Moderate' : 'Light', score: cr.traffic, risk: cr.traffic > 60 },
      { label: 'Strike Frequency', value: cr.strike > 60 ? 'High' : cr.strike > 30 ? 'Moderate' : 'Low', score: cr.strike, risk: cr.strike > 50 },
      { label: 'Vehicle Risk Factor', value: `${(vMult * 100).toFixed(0)}%`, score: vMult * 75, risk: vMult > 1.1 },
      { label: 'Shift Intensity', value: `${input.workingHoursPerDay}hr/day`, score: hoursMult * 60, risk: input.workingHoursPerDay > 10 },
    ];

    const basePremium = input.avgWeeklyEarnings * 0.015;
    const riskMult = riskScore > 80 ? 1.6 : riskScore > 65 ? 1.3 : riskScore > 50 ? 1.1 : 0.85;
    const weeklyPremium = Math.max(29, Math.min(299, Math.round(basePremium * riskMult)));
    // Max payout: reasonable weekly income replacement (₹1,500 - ₹5,000)
    const payoutRatio = riskScore > 70 ? 0.8 : riskScore > 50 ? 0.65 : 0.5;
    const maxPayout = Math.max(1500, Math.min(5000, Math.round(input.avgWeeklyEarnings * payoutRatio)));

    return { riskScore, weeklyPremium, maxPayout, factors, model: this.name };
  }
}

// ============ XGBOOST AI MODEL ============
export class XGBoostRiskModel implements RiskModel {
  name = 'xgboost_ai';
  version = '1.0.0';

  async computeRisk(input: RiskInput): Promise<RiskOutput> {
    const cacheKey = `xgb:${input.city}:${input.vehicleType}:${input.segment}:${input.workingHoursPerDay}:${input.avgWeeklyEarnings}`;
    const cached = riskCache.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    try {
      const { data, error } = await supabase.functions.invoke('ai-risk-engine', {
        body: { action: 'xgboost_risk', input },
      });
      if (error) throw error;
      
      const result: RiskOutput = {
        riskScore: Math.min(98, Math.max(12, data.riskScore || 50)),
        weeklyPremium: Math.max(29, Math.min(299, data.weeklyPremium || Math.round(input.avgWeeklyEarnings * 0.02))),
        // Cap max payout at ₹5,000 — reasonable weekly income replacement
        maxPayout: Math.max(1500, Math.min(5000, data.maxPayout || Math.round(input.avgWeeklyEarnings * 0.7))),
        factors: data.factors || [],
        model: 'xgboost_ai',
        confidence: data.confidence,
      };
      riskCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('XGBoost AI failed, falling back to rule-based:', err);
      return ruleBasedFallback.computeRisk(input);
    }
  }
}

// ============ ISOLATION FOREST FRAUD DETECTOR ============
export class IsolationForestDetector implements FraudDetector {
  name = 'isolation_forest_ai';
  version = '1.0.0';

  async detectFraud(gpsLogs: any[], extra?: { city?: string; claimCount?: number; lastClaimTime?: string }): Promise<FraudSignal[]> {
    const cacheKey = `iso:${JSON.stringify(gpsLogs.slice(0, 3))}`;
    const cached = fraudCache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase.functions.invoke('ai-risk-engine', {
        body: {
          action: 'isolation_forest',
          input: { gpsLogs, city: extra?.city, claimCount: extra?.claimCount, lastClaimTime: extra?.lastClaimTime },
        },
      });
      if (error) throw error;
      const signals: FraudSignal[] = data.signals || [];
      fraudCache.set(cacheKey, signals);
      return signals;
    } catch (err) {
      console.warn('Isolation Forest AI failed, falling back to rule-based:', err);
      return ruleBasedFraud.detectFraud(gpsLogs);
    }
  }
}

// ============ DBSCAN CLUSTER DETECTOR ============
export class DBSCANClusterDetector {
  name = 'dbscan_ai';
  version = '1.0.0';

  async detectClusters(claims: any[], workers: any[]): Promise<ClusterResult> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-risk-engine', {
        body: { action: 'dbscan_clustering', input: { claims, workers } },
      });
      if (error) throw error;
      return {
        clusters: data.clusters || [],
        totalClusters: data.totalClusters || 0,
        fraudRingDetected: data.fraudRingDetected || false,
        model: 'dbscan_ai',
      };
    } catch (err) {
      console.warn('DBSCAN AI failed:', err);
      return { clusters: [], totalClusters: 0, fraudRingDetected: false, model: 'dbscan_fallback' };
    }
  }
}

// ============ RULE-BASED FRAUD DETECTOR (Fallback) ============
export class RuleBasedFraudDetector implements FraudDetector {
  name = 'rule_based_fraud';
  version = '1.0.0';

  detectFraud(gpsLogs: any[]): FraudSignal[] {
    const signals: FraudSignal[] = [];
    if (gpsLogs.length < 2) return signals;

    for (let i = 1; i < gpsLogs.length; i++) {
      const prev = gpsLogs[i - 1];
      const curr = gpsLogs[i];
      const distance = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const timeDiff = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
      const speed = timeDiff > 0 ? (distance / timeDiff) * 3600 : 0;

      if (speed > 500) {
        signals.push({ type: 'teleportation', severity: 'critical', score: 0.95, description: `Impossible jump: ${distance.toFixed(1)}km in ${timeDiff.toFixed(0)}s` });
      } else if (speed > 150) {
        signals.push({ type: 'impossible_speed', severity: 'high', score: 0.8, description: `Speed ${speed.toFixed(0)}km/h exceeds vehicle limit` });
      }
    }
    return signals;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============ PAYMENT SERVICE INTERFACE ============
export interface PaymentProvider {
  name: string;
  collectPremium(workerId: string, amount: number, upiId?: string): Promise<{ txnId: string; status: string }>;
  sendPayout(workerId: string, amount: number, upiId?: string): Promise<{ txnId: string; status: string }>;
}

export class MockPaymentProvider implements PaymentProvider {
  name = 'mock_upi';

  async collectPremium(_workerId: string, _amount: number, _upiId?: string) {
    await new Promise(r => setTimeout(r, 500));
    return { txnId: `TXN-${Date.now().toString().slice(-5)}`, status: 'success' };
  }

  async sendPayout(_workerId: string, _amount: number, _upiId?: string) {
    await new Promise(r => setTimeout(r, 500));
    return { txnId: `TXN-${Date.now().toString().slice(-5)}`, status: 'success' };
  }
}

// ============ SINGLETON INSTANCES ============
const ruleBasedFallback = new RuleBasedRiskModel();
const ruleBasedFraud = new RuleBasedFraudDetector();

// Primary models (AI-powered with rule-based fallback)
export const riskEngine = ruleBasedFallback; // Sync fallback for onboarding
export const xgboostEngine = new XGBoostRiskModel();
export const fraudDetector = new RuleBasedFraudDetector();
export const aiFraudDetector = new IsolationForestDetector();
export const clusterDetector = new DBSCANClusterDetector();
export const paymentProvider = new MockPaymentProvider();

// ============ HYBRID RISK COMPUTATION ============
// Use this for async contexts where AI models can be awaited
export async function computeHybridRisk(input: RiskInput): Promise<RiskOutput> {
  try {
    const aiResult = await xgboostEngine.computeRisk(input);
    return aiResult;
  } catch {
    return ruleBasedFallback.computeRisk(input);
  }
}

// ============ TRAINING DATA SCHEMA ============
export interface TrainingDataPoint {
  timestamp: string;
  city: string;
  zone: string;
  weather: { temp: number; rainfall: number; aqi: number; wind: number; humidity: number };
  traffic: { congestionRatio: number; status: string };
  disruption: { type: string; severity: string; active: boolean } | null;
  claim: { triggered: boolean; amount: number; fraudScore: number } | null;
  worker: { segment: string; vehicle: string; hours: number; platform: string };
}
