import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Shield, CreditCard, CheckCircle2 } from "lucide-react";
import RainCanvas from "./RainCanvas";
import LightOverlay from "./LightOverlay";
import workerSilhouette from "@/assets/worker-silhouette.png";

interface StoryModeProps {
  onExit: () => void;
}

// Story timeline matching the spec — 3 acts
const storyLines = [
  // Act 1: The Storm
  { text: "No safety net.", start: 0.05, end: 0.15 },
  { text: "No benefits.", start: 0.12, end: 0.22 },
  { text: "No backup plan.", start: 0.19, end: 0.29 },
  // Act 2: The Shift
  { text: "What if someone had your back?", start: 0.30, end: 0.40 },
  { text: "Rain or shine.", start: 0.37, end: 0.46 },
  { text: "Sick days covered.", start: 0.44, end: 0.53 },
  { text: "Accidents handled.", start: 0.51, end: 0.59 },
  { text: "Peace of mind — finally.", start: 0.58, end: 0.66 },
];

// Act 3: process steps
const steps = [
  { num: "01", title: "Tell us about your gig", icon: Briefcase },
  { num: "02", title: "Pick your coverage", icon: Shield },
  { num: "03", title: "Pay weekly — cancel anytime", icon: CreditCard },
  { num: "04", title: "AutoClaim — Zero Touch", icon: CheckCircle2 },
];

const STEP_RANGES = [
  { start: 0.68, fadeIn: 0.695, holdEnd: 0.715, fadeOut: 0.724 },
  { start: 0.725, fadeIn: 0.74, holdEnd: 0.76, fadeOut: 0.769 },
  { start: 0.77, fadeIn: 0.785, holdEnd: 0.805, fadeOut: 0.814 },
  { start: 0.815, fadeIn: 0.83, holdEnd: 0.85, fadeOut: 0.859 },
];

// Easing
const apple = (t: number) => Math.max(0, Math.min(1, t));

const StoryMode = ({ onExit }: StoryModeProps) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleScroll = useCallback(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    setScrollProgress(Math.min(1, Math.max(0, p)));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Compute opacity of a story line given its [start, end] range
  const lineOpacity = (start: number, end: number) => {
    const p = scrollProgress;
    if (p < start || p > end) return 0;
    const range = end - start;
    const fadeIn = start + range * 0.2;
    const fadeOut = start + range * 0.7;
    if (p < fadeIn) return apple((p - start) / (fadeIn - start));
    if (p > fadeOut) return apple((end - p) / (end - fadeOut));
    return 1;
  };

  const lineTranslateY = (start: number, end: number, opacity: number) => {
    const p = scrollProgress;
    const mid = (start + end) / 2;
    if (p < mid) return (1 - opacity) * 24;
    return -(1 - opacity) * 12;
  };

  // Step opacity & translateX
  const stepState = (idx: number) => {
    const r = STEP_RANGES[idx];
    const p = scrollProgress;
    let op = 0;
    if (p >= r.start && p <= r.fadeOut) {
      if (p < r.fadeIn) op = (p - r.start) / (r.fadeIn - r.start);
      else if (p < r.holdEnd) op = 1;
      else op = (r.fadeOut - p) / (r.fadeOut - r.holdEnd);
      op = apple(op);
    }
    // Once we're past the entire steps section keep them visible
    if (p > 0.86 && p < 0.92) op = Math.max(op, 1);
    return { opacity: op, x: (1 - op) * 40 };
  };

  // CTA scroll 0.92 - 1.0
  const ctaProgress = apple((scrollProgress - 0.92) / 0.06);

  // Worker silhouette opacity
  let silhouetteOpacity = 0.85;
  if (scrollProgress > 0.5 && scrollProgress <= 0.75) {
    silhouetteOpacity = 0.85 - ((scrollProgress - 0.5) / 0.25) * 0.25; // 0.85 → 0.6
  } else if (scrollProgress > 0.75) {
    silhouetteOpacity = Math.max(0.4, 0.6 - ((scrollProgress - 0.75) / 0.25) * 0.2); // 0.6 → 0.4 (still visible at end)
  }

  // Rain fades only at the very end
  const rainIntensity = Math.max(0.3, 1 - Math.max(0, scrollProgress - 0.85) * 4);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-0"
      style={{ backgroundColor: "#000000", zIndex: 9995 }}
    >
      {/* Layer 0: Pure black background (already from bg) */}

      {/* Layer 1: Light overlay (eclipse glow from bottom center near worker's feet) */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <LightOverlay progress={scrollProgress} />
      </div>

      {/* Layer 2: Rain canvas */}
      {!reducedMotion.current && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          <RainCanvas intensity={rainIntensity} />
        </div>
      )}

      {/* Layer 3: Worker silhouette — STATIC, fixed position, full scroll */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: 3,
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "clamp(220px, 32vw, 460px)",
          opacity: silhouetteOpacity,
          transition: "opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      >
        <img
          src={workerSilhouette}
          alt="Gig delivery worker silhouette in the rain"
          className="w-full h-auto block"
          style={{ filter: "brightness(0)" }}
          width={512}
          height={768}
        />
      </div>

      {/* Layer 10: Story text + steps + CTA */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Scroll spacer — 1000vh */}
        <div style={{ height: "1000vh" }} />

        {/* Story lines (Acts 1 + 2) */}
        {storyLines.map((line, i) => {
          const op = lineOpacity(line.start, line.end);
          if (op === 0) return null;
          const y = lineTranslateY(line.start, line.end, op);
          return (
            <div
              key={i}
              className="fixed inset-0 flex items-center justify-center pointer-events-none px-6"
              style={{
                zIndex: 10,
                opacity: op,
                transform: `translateY(${y}px)`,
                transition: "opacity 0.15s linear",
              }}
            >
              <h2
                className="text-center text-white tracking-tight"
                style={{
                  fontFamily: '"SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 300,
                  fontSize: "clamp(1.75rem, 5vw, 4rem)",
                  letterSpacing: "0.02em",
                  textShadow: "0 2px 24px rgba(0,0,0,0.6)",
                }}
              >
                {line.text}
              </h2>
            </div>
          );
        })}

        {/* Act 3: How It Works steps + CTA */}
        {scrollProgress > 0.66 && (
          <div
            className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none px-6"
            style={{ zIndex: 11 }}
          >
            <div className="max-w-4xl w-full text-center">
              <h2
                className="text-white mb-12 tracking-[0.3em] uppercase"
                style={{
                  fontFamily: '"SF Pro Display", "Inter", sans-serif',
                  fontWeight: 300,
                  fontSize: "clamp(1rem, 2vw, 1.5rem)",
                  opacity: apple((scrollProgress - 0.67) / 0.02),
                }}
              >
                How <span style={{ color: "hsl(211, 100%, 55%)", fontWeight: 500 }}>GigShield</span> Works
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6 mb-14">
                {steps.map((s, i) => {
                  const { opacity, x } = stepState(i);
                  return (
                    <div
                      key={s.num}
                      className="text-center"
                      style={{
                        opacity,
                        transform: `translateX(${x}px)`,
                        transition: "opacity 0.2s linear, transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                      }}
                    >
                      <div
                        className="mx-auto mb-4 flex items-center justify-center rounded-full"
                        style={{
                          width: "clamp(40px, 6vw, 48px)",
                          height: "clamp(40px, 6vw, 48px)",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          backdropFilter: "blur(4px)",
                          fontFamily: "monospace",
                          color: "rgba(255,255,255,0.6)",
                          fontSize: "0.85rem",
                        }}
                      >
                        {s.num}
                      </div>
                      <div className="flex items-center justify-center mb-3">
                        <s.icon className="h-5 w-5" style={{ color: "hsl(211, 100%, 55%)" }} />
                      </div>
                      <h3
                        className="text-white mb-1"
                        style={{
                          fontFamily: '"SF Pro Display", "Inter", sans-serif',
                          fontWeight: 500,
                          fontSize: "clamp(0.95rem, 1.4vw, 1.1rem)",
                        }}
                      >
                        {s.title}
                      </h3>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div
                className="pointer-events-auto"
                style={{
                  opacity: ctaProgress,
                  transform: `translateY(${30 * (1 - ctaProgress)}px) scale(${0.96 + 0.04 * ctaProgress})`,
                  transition: "opacity 0.2s linear",
                }}
              >
                <button
                  onClick={onExit}
                  className="inline-flex items-center gap-2.5 text-white font-semibold rounded-full"
                  style={{
                    fontFamily: '"SF Pro Display", "Inter", sans-serif',
                    background: "hsl(211, 100%, 50%)",
                    padding: "20px 48px",
                    fontSize: "18px",
                    animation: ctaProgress > 0.9 ? "ctaGlow 3s ease-in-out infinite" : undefined,
                    boxShadow: "0 0 30px hsla(211, 100%, 45%, 0.4)",
                    transition: "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  Secure Your Shift <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Close hint (top right) */}
      <button
        onClick={onExit}
        className="fixed top-6 right-6 text-white/40 hover:text-white/90 transition-colors text-sm font-medium"
        style={{ zIndex: 9999, fontFamily: '"SF Pro Display", "Inter", sans-serif' }}
      >
        ✕ Close
      </button>

      {/* Scroll hint */}
      {scrollProgress < 0.03 && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs tracking-[0.3em] uppercase pointer-events-none"
          style={{ zIndex: 9998, fontFamily: '"SF Pro Display", "Inter", sans-serif' }}
        >
          Scroll
        </div>
      )}

      <style>{`
        @keyframes ctaGlow {
          0%, 100% { box-shadow: 0 0 30px hsla(211, 100%, 45%, 0.3); }
          50% { box-shadow: 0 0 50px hsla(211, 100%, 45%, 0.65); }
        }
      `}</style>
    </motion.div>
  );
};

export default StoryMode;
