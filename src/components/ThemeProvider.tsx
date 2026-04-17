import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type ThemeMode = "dark" | "light";
type PlatformTheme = "gigshield" | "zomato" | "swiggy" | "zepto" | "blinkit" | "dunzo";

interface ThemeContextType {
  mode: ThemeMode;
  platform: PlatformTheme;
  toggleMode: () => void;
  setPlatform: (p: PlatformTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  platform: "gigshield",
  toggleMode: () => {},
  setPlatform: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("gs-theme-mode") as ThemeMode) || "dark";
    }
    return "dark";
  });

  const [platform, setPlatformState] = useState<PlatformTheme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("gs-theme-platform") as PlatformTheme) || "gigshield";
    }
    return "gigshield";
  });

  // Apply mode immediately on change
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(mode);
    localStorage.setItem("gs-theme-mode", mode);
  }, [mode]);

  // Apply platform theme immediately on change — no refresh needed
  useEffect(() => {
    const root = document.documentElement;
    // Remove all platform theme classes
    root.classList.remove("theme-zomato", "theme-swiggy", "theme-zepto", "theme-blinkit", "theme-dunzo");
    if (platform !== "gigshield") {
      root.classList.add(`theme-${platform}`);
    }
    localStorage.setItem("gs-theme-platform", platform);
  }, [platform]);

  const toggleMode = useCallback(() => setMode((prev) => (prev === "dark" ? "light" : "dark")), []);
  const setPlatform = useCallback((p: PlatformTheme) => setPlatformState(p), []);

  return (
    <ThemeContext.Provider value={{ mode, platform, toggleMode, setPlatform }}>
      {children}
    </ThemeContext.Provider>
  );
}
