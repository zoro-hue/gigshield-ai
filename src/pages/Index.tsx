import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Shield, CloudRain, Zap, TrendingUp, Users, Brain, ArrowRight, ChevronDown, Sparkles, IndianRupee } from "lucide-react";
import Navbar from "@/components/Navbar";
import TiltCard from "@/components/TiltCard";
import { useAnimatedCounter, useLiveValue } from "@/hooks/useRealtimeData";
import { useRef, useState, useCallback } from "react";
import { useActivePolicy } from "@/hooks/useActivePolicy";
import StoryEntryButton from "@/components/StoryEntryButton";
import StoryMode from "@/components/StoryMode";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";

const features = [
  { icon: Brain, title: "AI Risk Profiling", desc: "ML-driven risk assessment using hyper-local weather, traffic & disruption data for personalized weekly premiums.", accent: "primary", glow: "168, 80%, 48%" },
  { icon: Zap, title: "Parametric Auto-Claims", desc: "Zero-touch claims. When disruption triggers hit, payouts initiate automatically — no paperwork, no waiting.", accent: "secondary", glow: "250, 70%, 62%" },
  { icon: Shield, title: "Fraud Detection Engine", desc: "GPS spoofing detection, anomaly scoring, duplicate claim prevention & location-activity cross-validation.", accent: "warning", glow: "38, 95%, 55%" },
  { icon: CloudRain, title: "Live Weather Triggers", desc: "Real-time monitoring of extreme heat, floods, pollution & storms with parametric threshold activation.", accent: "primary", glow: "168, 80%, 48%" },
  { icon: IndianRupee, title: "Weekly Micro-Premiums", desc: "Dynamic weekly premium calculated by AI risk engine, aligned with gig worker payout cycles.", accent: "success", glow: "152, 70%, 50%" },
  { icon: TrendingUp, title: "Predictive Analytics", desc: "AI forecasts next week's disruption probability, enabling proactive coverage adjustments.", accent: "secondary", glow: "250, 70%, 62%" },
];

const personas = [
  { name: "Food Delivery", platforms: "Zomato, Swiggy", icon: "🍕" },
  { name: "Quick Commerce", platforms: "Zepto, Blinkit, Dunzo", icon: "⚡" },
];

const accentColors: Record<string, string> = {
  primary: "text-primary bg-primary/10 group-hover:bg-primary/15",
  secondary: "text-secondary bg-secondary/10 group-hover:bg-secondary/15",
  warning: "text-warning bg-warning/10 group-hover:bg-warning/15",
  success: "text-success bg-success/10 group-hover:bg-success/15",
};

const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const { hasActivePolicy } = useActivePolicy();
  const [isStoryMode, setIsStoryMode] = useState(false);
  const savedScrollRef = useRef(0);

  const enterStory = useCallback(() => {
    savedScrollRef.current = window.scrollY;
    setIsStoryMode(true);
  }, []);

  const exitStory = useCallback(() => {
    setIsStoryMode(false);
    requestAnimationFrame(() => {
      window.scrollTo(0, savedScrollRef.current);
    });
  }, []);

  // Live stats
  const liveWorkers = useLiveValue(24847, 50, 4000);
  const workersCount = useAnimatedCounter(liveWorkers);
  const livePayout = useLiveValue(30, 3, 5000);
  const payoutCount = useAnimatedCounter(livePayout);

  return (
    <>
      <AnimatePresence>
        {isStoryMode && <StoryMode onExit={exitStory} />}
      </AnimatePresence>

      <div
        className="min-h-screen bg-background transition-opacity duration-500"
        style={{
          opacity: isStoryMode ? 0 : 1,
          pointerEvents: isStoryMode ? "none" : "auto",
        }}
      >
      <Navbar />

      {/* Hero with parallax */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="ambient-orb w-[700px] h-[700px] bg-primary/8 top-[-250px] left-[-150px] animate-glow-pulse" />
        <div className="ambient-orb w-[500px] h-[500px] bg-secondary/6 bottom-[-150px] right-[-100px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
        <div className="ambient-orb w-[350px] h-[350px] bg-warning/5 top-[25%] right-[5%] animate-glow-pulse" style={{ animationDelay: "1s" }} />

        <div className="absolute inset-0 grid-bg opacity-30" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 container mx-auto px-4 pt-24 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full px-5 py-2 mb-8"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium tracking-wide">AI-Powered Parametric Insurance</span>
            </motion.div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.05] mb-6 tracking-tight">
              <span className="text-foreground">Protect Your</span>
              <br />
              <motion.span
                className="gradient-text inline-block"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                Hustle.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed font-light"
            >
              India's first AI-powered income protection for gig delivery workers. 
              When storms, floods, or curfews stop your rides — we've got your back. <span className="text-foreground font-medium">Instantly.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
            >
              {!hasActivePolicy && (
                <Link to="/onboarding" className="glow-button text-base px-8 py-4 rounded-2xl inline-flex items-center gap-2.5 font-semibold group">
                  Start Protection <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <Link to="/dashboard" className="glass-card-hover px-8 py-4 rounded-2xl text-foreground/80 hover:text-foreground inline-flex items-center gap-2 text-base font-medium">
                {hasActivePolicy ? 'Go to Dashboard' : 'View Demo Dashboard'}
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats with tilt */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto"
          >
            {[
              { value: "AI", label: "Dynamic Premium", suffix: "" },
              { value: `< ${payoutCount}`, label: "Payout Speed", suffix: "s" },
              { value: "99.2", label: "Fraud Detection", suffix: "%" },
              { value: "24/7", label: "Monitoring", suffix: "" },
            ].map((stat, i) => (
              <TiltCard key={i} className="stat-card rounded-2xl" intensity={10}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="text-center py-6 px-4"
                >
                  <div className="font-display text-3xl md:text-4xl font-bold gradient-text">
                    {stat.value}<span className="text-lg">{stat.suffix}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1.5 font-medium">{stat.label}</div>
                </motion.div>
              </TiltCard>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-20"
          >
            <ChevronDown className="h-6 w-6 text-primary/40 mx-auto animate-bounce" />
          </motion.div>
        </motion.div>
      </section>

      <div className="section-divider" />

      {/* Personas */}
      <section className="py-28 relative">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Built for <span className="gradient-text">Food Delivery Partners</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto font-light">
              Choose your platform. Get coverage tailored to your risks.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {personas.map((p, i) => (
              <TiltCard key={p.name} className="cursor-pointer" intensity={12}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="glass-card-hover p-8 text-center group"
                >
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 10 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="text-5xl mb-5 inline-block"
                  >{p.icon}</motion.div>
                  <h3 className="font-display text-xl font-semibold mb-2 text-foreground">{p.name}</h3>
                  <p className="text-muted-foreground text-sm">{p.platforms}</p>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Features */}
      <section className="py-28 relative">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              <span className="gradient-text">Intelligent</span> Protection
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto font-light">
              Powered by AI. Triggered by data. Paid out instantly.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <TiltCard key={f.title} className="group" intensity={8} glareColor={f.glow}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="glass-card-hover p-7 h-full"
                >
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 ${accentColors[f.accent]}`}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-3 text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* How It Works — matches Story Mode typography (SF Pro Display, light, Apple blue) */}
      <section className="py-28 relative" style={{ background: "#000000" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(255,255,255,0.06), transparent)",
        }} />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2
              className="text-white mb-3 uppercase"
              style={{
                fontFamily: '"SF Pro Display", "Inter", -apple-system, sans-serif',
                fontWeight: 300,
                fontSize: "clamp(1.1rem, 2vw, 1.5rem)",
                letterSpacing: "0.3em",
              }}
            >
              How <span style={{ color: "hsl(211, 100%, 55%)", fontWeight: 500 }}>GigShield</span> Works
            </h2>
            <p
              className="text-white/50 max-w-xl mx-auto"
              style={{
                fontFamily: '"SF Pro Display", "Inter", sans-serif',
                fontWeight: 300,
                fontSize: "clamp(0.85rem, 1.2vw, 1rem)",
                letterSpacing: "0.02em",
              }}
            >
              Four steps. Zero paperwork. Real protection.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Tell us about your gig", desc: "Quick KYC with platform verification", icon: Users },
              { step: "02", title: "Pick your coverage", desc: "AI personalizes premium for your zone & risk", icon: Brain },
              { step: "03", title: "Pay weekly — cancel anytime", desc: "Micro-premium aligned with payout cycles", icon: IndianRupee },
              { step: "04", title: "AutoClaim — Zero Touch", desc: "Disruption detected. Payout sent. Automatically.", icon: Zap },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-center"
              >
                <div
                  className="mx-auto mb-5 flex items-center justify-center rounded-full"
                  style={{
                    width: 48,
                    height: 48,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    backdropFilter: "blur(4px)",
                    fontFamily: "monospace",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "0.9rem",
                  }}
                >
                  {s.step}
                </div>
                <div className="flex items-center justify-center mb-4">
                  <s.icon className="h-5 w-5" style={{ color: "hsl(211, 100%, 55%)" }} />
                </div>
                <h3
                  className="text-white mb-2"
                  style={{
                    fontFamily: '"SF Pro Display", "Inter", sans-serif',
                    fontWeight: 500,
                    fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-white/50"
                  style={{
                    fontFamily: '"SF Pro Display", "Inter", sans-serif',
                    fontWeight: 300,
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                  }}
                >
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Testimonials */}
      <TestimonialsCarousel />

      <div className="section-divider" />
      <section className="py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="gradient-border p-12 md:p-20 text-center max-w-4xl mx-auto relative overflow-hidden"
          >
            <div className="ambient-orb w-[300px] h-[300px] bg-primary/15 top-[-100px] right-[-100px] animate-glow-pulse" />
            <div className="relative z-10">
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-5 tracking-tight">
                {hasActivePolicy ? (
                  <>Your Income is <span className="gradient-text">Protected</span></>
                ) : (
                  <>Ready to <span className="gradient-text">Shield Your Income?</span></>
                )}
              </h2>
              <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto font-light">
                {hasActivePolicy
                  ? "Your coverage is active. Monitor your dashboard for real-time updates."
                  : "Join delivery partners who never worry about weather disruptions again."}
              </p>
              {hasActivePolicy ? (
                <Link to="/dashboard" className="glow-button text-lg px-10 py-4 rounded-2xl inline-flex items-center gap-2.5 font-semibold group">
                  Go to Dashboard <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <Link to="/onboarding" className="glow-button text-lg px-10 py-4 rounded-2xl inline-flex items-center gap-2.5 font-semibold group">
                  Get Started Now <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p className="font-medium">© 2026 GigShield — AI-Powered Parametric Insurance for India's Gig Economy</p>
          <p className="mt-2 text-muted-foreground/60">Built for Guidewire DEVTrails 2026</p>
        </div>
      </footer>

      <StoryEntryButton onClick={enterStory} />
    </div>
    </>
  );
};

export default Index;
