import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowRight, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const [verificationSent, setVerificationSent] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Redirecting to dashboard..." });
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setVerificationSent(true);
        setResendEmail(email);
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account before signing in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!resendEmail) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({ title: "Verification email sent!", description: "Please check your inbox." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/5 blur-[120px] pointer-events-none" />

      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative">
        <div className="max-w-md space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <Shield className="h-10 w-10 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" strokeWidth={2.5} />
              <span className="font-display text-3xl font-bold"><span className="text-foreground">Gig</span><span className="text-primary">Shield</span></span>
            </div>
            <h1 className="font-display text-4xl font-bold text-foreground leading-tight">
              Parametric insurance
              <br />
              <span className="gradient-text">for the gig economy</span>
            </h1>
            <p className="text-muted-foreground font-body text-lg mt-4 leading-relaxed">
              Real-time weather monitoring, instant payouts, and AI-powered risk scoring — all in one platform.
            </p>
          </motion.div>

          {/* Floating stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              { label: "AI Risk Engine", value: "Live" },
              { label: "Payout Speed", value: "< 30s" },
              { label: "Monitoring", value: "24/7" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
                <div className="font-display text-xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-2xl p-8 border border-border/50 glow-border-animated">
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <Shield className="h-7 w-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" strokeWidth={2.5} />
              <span className="font-display text-xl font-bold"><span className="text-foreground">Gig</span><span className="text-primary">Shield</span></span>
            </div>

            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-foreground">
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1 font-body">
                {isLogin
                  ? "Sign in to access your dashboard"
                  : "Get started with GigShield protection"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Label htmlFor="name" className="text-foreground text-sm font-medium mb-2 block">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={!isLogin}
                        className="pl-10 bg-muted/30 border-border/50 h-11 font-body focus:border-primary/50"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <Label htmlFor="email" className="text-foreground text-sm font-medium mb-2 block">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-muted/30 border-border/50 h-11 font-body focus:border-primary/50"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground text-sm font-medium mb-2 block">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 pr-10 bg-muted/30 border-border/50 h-11 font-body focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 glow-button rounded-xl font-display font-semibold text-sm gap-2"
              >
                {loading ? (
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {verificationSent && !isLogin && (
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                <p className="text-xs text-muted-foreground mb-2">Didn't receive the email?</p>
                <button
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
                >
                  {resendingEmail ? "Sending..." : "Resend verification email"}
                </button>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setVerificationSent(false); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors font-body"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
