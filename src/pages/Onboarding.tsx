import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, MapPin, Bike, Shield, ChevronRight, ChevronLeft, Check, Brain, Zap, Loader2, CloudRain, Thermometer, Wind } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import TiltCard from "@/components/TiltCard";
import StatusRing from "@/components/StatusRing";
import AIExplainabilityPanel from "@/components/AIExplainabilityPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/components/DemoModeProvider";
import { toast } from "sonner";
import { riskEngine, computeHybridRisk, type RiskInput, type RiskOutput } from "@/lib/riskEngine";
import { useTheme } from "@/components/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

type FormData = {
  name: string; phone: string; aadhaar: string; platform: string; segment: string;
  city: string; zone: string; avgWeeklyEarnings: string; workingHoursPerDay: string; vehicleType: string;
};

const platforms = ["Zomato", "Swiggy", "Zepto", "Blinkit", "Dunzo", "Other"];
const segments = ["Food Delivery", "Quick Commerce / Grocery"];
const cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad"];
const vehicles = ["Bicycle", "Two-Wheeler", "Three-Wheeler", "Four-Wheeler"];

const steps = [
  { title: "Personal Info", icon: User, description: "Your identity & KYC" },
  { title: "Work Profile", icon: Bike, description: "Delivery details" },
  { title: "Risk Assessment", icon: Brain, description: "AI analyzes your zone" },
  { title: "Your Plan", icon: Shield, description: "Weekly premium quote" },
];

const inputClass = "w-full bg-muted/40 border border-border/60 rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";
const chipClass = (active: boolean) => `px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-300 font-medium ${active ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_hsl(168_80%_48%/0.1)]" : "border-border/60 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"}`;

const DEMO_FORM: FormData = {
  name: "Ravi Kumar", phone: "+91 98765 43210", aadhaar: "XXXX XXXX 4321",
  platform: "Zomato", segment: "Food Delivery", city: "Mumbai", zone: "Andheri West",
  avgWeeklyEarnings: "5000", workingHoursPerDay: "10", vehicleType: "Two-Wheeler",
};

const computeRiskProfile = (form: FormData, weatherData?: any) => {
  const input: RiskInput = {
    city: form.city || 'Mumbai',
    vehicleType: form.vehicleType || 'Two-Wheeler',
    segment: form.segment || 'Food Delivery',
    workingHoursPerDay: parseInt(form.workingHoursPerDay) || 8,
    avgWeeklyEarnings: parseInt(form.avgWeeklyEarnings) || 3000,
    platform: form.platform || 'Zomato',
    weatherData: weatherData ? {
      rainfall: weatherData.rainfall ?? 0,
      temperature: weatherData.temperature ?? 30,
      aqi: weatherData.aqi ?? 100,
    } : undefined,
  };
  const result = riskEngine.computeRisk(input);
  return { riskScore: result.riskScore, factors: result.factors, weeklyPremium: result.weeklyPremium, maxPayout: result.maxPayout, input, model: result.model };
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDemoMode, completeStep } = useDemoMode();
  const { setPlatform: setPlatformTheme } = useTheme();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [aiRisk, setAiRisk] = useState<RiskOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState<FormData>(
    isDemoMode ? DEMO_FORM : {
      name: "", phone: "", aadhaar: "", platform: "", segment: "",
      city: "", zone: "", avgWeeklyEarnings: "", workingHoursPerDay: "", vehicleType: "",
    }
  );

  useEffect(() => {
    if (isDemoMode && form.name === "") {
      setForm(DEMO_FORM);
      completeStep("register");
    }
  }, [isDemoMode]);

  const update = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!form.city) return;
    supabase.functions.invoke('fetch-weather', { body: { city: form.city } })
      .then(({ data }) => { if (data) setWeatherData(data); })
      .catch(() => {});
  }, [form.city]);

  const ruleBasedRisk = computeRiskProfile(form, weatherData);
  const riskOutput: RiskOutput = aiRisk || {
    riskScore: ruleBasedRisk.riskScore,
    weeklyPremium: ruleBasedRisk.weeklyPremium,
    maxPayout: ruleBasedRisk.maxPayout,
    factors: ruleBasedRisk.factors,
    model: ruleBasedRisk.model,
  };

  useEffect(() => {
    if (step === 2 && form.city && form.avgWeeklyEarnings) {
      setAiLoading(true);
      completeStep("ai_premium");
      computeHybridRisk(ruleBasedRisk.input)
        .then(result => setAiRisk(result))
        .catch(() => {})
        .finally(() => setAiLoading(false));
    }
  }, [step, form.city, form.avgWeeklyEarnings, form.vehicleType, form.segment]);

  const canProceed = () => {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 1) return form.city && form.platform && form.vehicleType && form.avgWeeklyEarnings;
    return true;
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="ambient-orb w-[400px] h-[400px] bg-primary/6 top-[10%] left-[-100px] animate-glow-pulse" />
      <div className="ambient-orb w-[300px] h-[300px] bg-secondary/5 bottom-[10%] right-[-50px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-14">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <motion.div
                animate={i <= step ? { scale: 1 } : { scale: 0.9 }}
                className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-500 ${
                  i < step ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(168_80%_48%/0.3)]" :
                  i === step ? "bg-primary/15 text-primary border border-primary/30" :
                  "bg-muted/30 text-muted-foreground border border-border/40"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </motion.div>
              <span className="hidden md:inline text-sm text-muted-foreground font-medium">{s.title}</span>
              {i < steps.length - 1 && (
                <div className={`w-8 md:w-16 h-[2px] rounded-full transition-colors duration-500 ${i < step ? "bg-primary/60" : "bg-border/40"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="glass-card p-8 md:p-10 glow-border-animated">
                <h2 className="font-display text-2xl font-bold mb-2 gradient-text">Personal Information</h2>
                <p className="text-muted-foreground text-sm mb-8">We need a few details for your KYC verification.</p>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Full Name *</label>
                    <input value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} placeholder="Enter your full name" />
                    {form.name.trim().length === 0 && <p className="text-[10px] text-destructive mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Phone Number</label>
                    <input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Aadhaar (Last 4)</label>
                    <input value={form.aadhaar} onChange={e => update("aadhaar", e.target.value)} className={inputClass} placeholder="XXXX" maxLength={4} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="glass-card p-8 md:p-10 glow-border-animated">
                <h2 className="font-display text-2xl font-bold mb-2 gradient-text">Work Profile</h2>
                <p className="text-muted-foreground text-sm mb-8">Tell us about your delivery work.</p>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Platform *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {platforms.map(p => <button key={p} onClick={() => update("platform", p)} className={chipClass(form.platform === p)}>{p}</button>)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Segment</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {segments.map(s => <button key={s} onClick={() => update("segment", s)} className={chipClass(form.segment === s)}>{s}</button>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">City *</label>
                      <select value={form.city} onChange={e => update("city", e.target.value)} className={inputClass}>
                        <option value="">Select city</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Zone</label>
                      <input value={form.zone} onChange={e => update("zone", e.target.value)} className={inputClass} placeholder="e.g. Andheri West" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Avg Weekly Earnings (₹) *</label>
                      <input type="number" value={form.avgWeeklyEarnings} onChange={e => update("avgWeeklyEarnings", e.target.value)} className={inputClass} placeholder="e.g. 5000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Hours/Day</label>
                      <input type="number" value={form.workingHoursPerDay} onChange={e => update("workingHoursPerDay", e.target.value)} className={inputClass} placeholder="e.g. 10" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Vehicle Type *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {vehicles.map(v => <button key={v} onClick={() => update("vehicleType", v)} className={chipClass(form.vehicleType === v)}>{v}</button>)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="space-y-5">
                {/* Live weather context */}
                {weatherData && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    {[
                      { icon: CloudRain, label: "Rain", value: `${Math.round(weatherData.rainfall ?? 0)}mm`, risk: (weatherData.rainfall ?? 0) > 50 },
                      { icon: Thermometer, label: "Temp", value: `${Math.round(weatherData.temperature ?? 0)}°C`, risk: (weatherData.temperature ?? 0) > 42 },
                      { icon: Wind, label: "AQI", value: `${weatherData.aqi ?? 0}`, risk: (weatherData.aqi ?? 0) > 300 },
                    ].map(w => (
                      <div key={w.label} className={`flex-1 text-center p-3 rounded-xl border ${w.risk ? 'border-warning/30 bg-warning/5' : 'border-border/30 bg-muted/10'}`}>
                        <w.icon className={`h-4 w-4 mx-auto mb-1 ${w.risk ? 'text-warning' : 'text-muted-foreground'}`} />
                        <div className="text-[10px] text-muted-foreground">{w.label}</div>
                        <div className={`text-sm font-bold ${w.risk ? 'text-warning' : 'text-foreground'}`}>{w.value}</div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {aiLoading ? (
                  <div className="glass-card p-10 rounded-2xl text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">AI is analyzing your risk profile...</p>
                  </div>
                ) : (
                  <AIExplainabilityPanel
                    riskOutput={riskOutput}
                    weatherData={weatherData ? { rainfall: weatherData.rainfall ?? 0, temperature: weatherData.temperature ?? 30, aqi: weatherData.aqi ?? 100 } : undefined}
                  />
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="glass-card p-8 md:p-10 glow-border-animated">
                <h2 className="font-display text-2xl font-bold mb-2 gradient-text">Your Weekly Plan</h2>
                <p className="text-muted-foreground text-sm mb-8">Tailored to your risk profile and earnings.</p>

                <TiltCard className="gradient-border mb-8 relative overflow-hidden" intensity={6}>
                  <div className="p-10 text-center">
                    <div className="ambient-orb w-[200px] h-[200px] bg-primary/10 top-[-80px] left-[-50px]" />
                    <div className="relative z-10">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Weekly Premium</div>
                      <div className="font-display text-6xl font-bold gradient-text mb-1">₹{riskOutput.weeklyPremium}</div>
                      <div className="text-muted-foreground text-sm">per week</div>
                    </div>
                  </div>
                </TiltCard>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <TiltCard className="stat-card rounded-2xl" intensity={8}>
                    <div className="p-5 text-center">
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Max Payout</div>
                      <div className="font-display text-2xl font-bold text-success">₹{riskOutput.maxPayout}</div>
                    </div>
                  </TiltCard>
                  <TiltCard className="stat-card rounded-2xl" intensity={8}>
                    <div className="p-5 text-center">
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Coverage</div>
                      <div className="font-display text-lg font-bold text-primary">Income Loss</div>
                    </div>
                  </TiltCard>
                </div>

                <div className="space-y-3 mb-8">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">What's Covered</h3>
                  {[
                    "Heavy rainfall / Floods disrupting deliveries",
                    "Extreme heat (>45°C) making work unsafe",
                    "Severe pollution (AQI > 400) advisories",
                    "Traffic blockades & major road closures",
                    "Unplanned curfews & local strikes",
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3 text-sm">
                      <div className="h-5 w-5 rounded-md bg-success/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-success" />
                      </div>
                      <span className="text-foreground/80">{item}</span>
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={saving}
                  onClick={async () => {
                    if (!user) { toast.error("Please sign in first"); return; }
                    setSaving(true);
                    try {
                      const { data: profile, error: profileError } = await supabase.from("worker_profiles").insert({
                        user_id: user.id,
                        full_name: form.name,
                        phone: form.phone,
                        aadhaar_last4: form.aadhaar.slice(-4),
                        platform: form.platform,
                        segment: form.segment,
                        city: form.city,
                        zone: form.zone,
                        avg_weekly_earnings: parseInt(form.avgWeeklyEarnings) || 0,
                        working_hours_per_day: parseInt(form.workingHoursPerDay) || 0,
                        vehicle_type: form.vehicleType,
                        risk_score: Math.round(riskOutput.riskScore),
                        weekly_premium: Math.round(riskOutput.weeklyPremium),
                        max_payout: Math.round(riskOutput.maxPayout),
                      }).select().single();
                      if (profileError) throw profileError;

                      const { error: policyError } = await supabase.from("policies").insert({
                        user_id: user.id,
                        worker_profile_id: profile?.id,
                        weekly_premium: Math.round(riskOutput.weeklyPremium),
                        max_payout: Math.round(riskOutput.maxPayout),
                        status: 'active',
                        coverage_type: 'income_loss',
                      });
                      if (policyError) throw policyError;

                      // Apply platform theme instantly
                      const platformKey = (form.platform || '').toLowerCase();
                      const themeMap: Record<string, any> = { zomato: 'zomato', swiggy: 'swiggy', zepto: 'zepto', blinkit: 'blinkit', dunzo: 'dunzo' };
                      setPlatformTheme(themeMap[platformKey] || 'gigshield');

                      // Invalidate all queries so global policy state updates instantly
                      queryClient.invalidateQueries();

                      completeStep("covered");
                      toast.success("Coverage activated! Your profile and policy have been saved.");
                      navigate("/dashboard");
                    } catch (err: any) {
                      toast.error(err.message || "Failed to save profile");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="glow-button w-full py-4 rounded-2xl text-base flex items-center justify-center gap-2 font-semibold disabled:opacity-60"
                >
                  {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : <>Activate Coverage <Zap className="h-5 w-5" /></>}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <motion.button whileHover={{ x: -4 }} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="flex items-center gap-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all px-4 py-2 rounded-xl hover:bg-muted/20">
              <ChevronLeft className="h-4 w-4" /> Back
            </motion.button>
            {step < 3 && (
              <motion.button
                whileHover={{ x: 4 }}
                onClick={() => {
                  if (step === 0) completeStep("register");
                  setStep(step + 1);
                }}
                disabled={!canProceed()}
                className="glow-button px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
