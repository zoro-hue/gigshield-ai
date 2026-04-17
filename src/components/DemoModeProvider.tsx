import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

interface DemoStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

interface DemoContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoSteps: DemoStep[];
  completeStep: (id: string) => void;
  currentStepIndex: number;
}

const defaultSteps: DemoStep[] = [
  { id: "register", label: "Register", description: "Create worker profile", completed: false },
  { id: "covered", label: "Get Covered", description: "AI calculates premium", completed: false },
  { id: "ai_premium", label: "AI Premium", description: "View risk assessment", completed: false },
  { id: "disruption", label: "Disruption", description: "Weather event detected", completed: false },
  { id: "auto_claim", label: "Auto-Claim", description: "Claim triggered", completed: false },
  { id: "processed", label: "Processed", description: "Payout completed", completed: false },
];

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  toggleDemoMode: () => {},
  demoSteps: defaultSteps,
  completeStep: () => {},
  currentStepIndex: 0,
});

export const useDemoMode = () => useContext(DemoContext);

export const DemoModeProvider = ({ children }: { children: ReactNode }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>(defaultSteps);

  const toggleDemoMode = () => {
    const newState = !isDemoMode;
    setIsDemoMode(newState);
    if (newState) {
      toast.info("🎬 Demo Mode activated — guided walkthrough enabled");
      setDemoSteps(defaultSteps);
    } else {
      toast.info("Demo Mode deactivated");
    }
  };

  const completeStep = (id: string) => {
    setDemoSteps(prev => prev.map(s => s.id === id ? { ...s, completed: true } : s));
  };

  const currentStepIndex = demoSteps.findIndex(s => !s.completed);

  return (
    <DemoContext.Provider value={{ isDemoMode, toggleDemoMode, demoSteps, completeStep, currentStepIndex }}>
      {children}
    </DemoContext.Provider>
  );
};
