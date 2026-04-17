import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LogIn, Play, Square, Sun, Moon, Shield } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMode } from "@/components/DemoModeProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useActivePolicy } from "@/hooks/useActivePolicy";

const links = [
  { to: "/", label: "Home" },
  { to: "/onboarding", label: "Get Covered" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/claims", label: "Claims" },
  { to: "/admin", label: "Admin" },
  { to: "/payments", label: "Payments" },
  { to: "/analytics", label: "Analytics" },
];

const GigShieldLogo = () => (
  <div className="flex items-center gap-2.5">
    <div className="relative h-8 w-8 flex items-center justify-center">
      <Shield className="h-7 w-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" strokeWidth={2.5} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-2.5 w-2.5 rounded-full bg-primary/30 blur-[4px]" />
      </div>
    </div>
    <span className="font-display text-xl font-bold tracking-tight">
      <span className="text-foreground">Gig</span>
      <span className="text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.3)]">Shield</span>
    </span>
  </div>
);

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const { mode, toggleMode } = useTheme();
  const { hasActivePolicy } = useActivePolicy();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30"
      style={{
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        background: mode === "dark"
          ? "hsla(228, 14%, 5%, 0.6)"
          : "hsla(0, 0%, 100%, 0.7)",
      }}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <GigShieldLogo />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link key={link.to} to={link.to}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}>
                {link.label}
                {isActive && (
                  <motion.div layoutId="nav-indicator"
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {/* Dark/Light Toggle */}
          <button
            onClick={toggleMode}
            className="p-2 rounded-lg border border-border/30 hover:bg-muted/20 transition-all duration-300"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {mode === "dark" ? (
                  <Sun className="h-4 w-4 text-warning" />
                ) : (
                  <Moon className="h-4 w-4 text-secondary" />
                )}
              </motion.div>
            </AnimatePresence>
          </button>

          {/* Demo Mode Toggle */}
          <button
            onClick={toggleDemoMode}
            className={`text-[10px] font-mono px-2.5 py-2 rounded-lg border flex items-center gap-1.5 transition-all ${
              isDemoMode
                ? 'bg-secondary/10 border-secondary/20 text-secondary'
                : 'bg-muted/10 border-border/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            {isDemoMode ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isDemoMode ? 'EXIT' : 'DEMO'}
          </button>

          {user ? (
            <>
              {!hasActivePolicy && (
                <Link to="/onboarding" className="glow-button text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-semibold">
                  Get Protected
                </Link>
              )}
              <button onClick={handleSignOut}
                className="text-sm px-3 py-2.5 rounded-xl inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </>
          ) : (
            <Link to="/auth" className="glow-button text-sm px-5 py-2.5 rounded-xl inline-flex items-center gap-2 font-semibold">
              <LogIn className="h-4 w-4" /> Sign In
            </Link>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground p-2 rounded-lg hover:bg-muted/30">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="md:hidden border-t border-border/40 overflow-hidden"
            style={{
              backdropFilter: "blur(24px) saturate(180%)",
              background: mode === "dark" ? "hsla(225, 15%, 8%, 0.9)" : "hsla(0, 0%, 100%, 0.9)",
            }}
          >
            <div className="p-4 space-y-1">
              {links.map((link) => (
                <Link key={link.to} to={link.to}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === link.to ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  }`}
                  onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <button onClick={toggleMode} className="flex-1 text-sm py-2.5 rounded-lg border border-border/30 text-center">
                  {mode === "dark" ? "☀️ Light" : "🌙 Dark"}
                </button>
                <button onClick={() => { toggleDemoMode(); setOpen(false); }}
                  className={`flex-1 text-sm py-2.5 rounded-lg border ${isDemoMode ? 'border-secondary/20 text-secondary' : 'border-border/30 text-muted-foreground'}`}>
                  {isDemoMode ? '■ Exit Demo' : '▶ Demo'}
                </button>
              </div>
              {user ? (
                <>
                  {!hasActivePolicy && (
                    <Link to="/onboarding" className="block glow-button text-center mt-3 text-sm py-2.5 rounded-xl" onClick={() => setOpen(false)}>
                      Get Protected
                    </Link>
                  )}
                  <button onClick={() => { handleSignOut(); setOpen(false); }}
                    className="block w-full text-center mt-2 text-sm py-2.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
                    Sign Out
                  </button>
                </>
              ) : (
                <Link to="/auth" className="block glow-button text-center mt-3 text-sm py-2.5 rounded-xl" onClick={() => setOpen(false)}>
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
