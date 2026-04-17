import Navbar from "@/components/Navbar";
import PaymentGateway from "@/components/payments/PaymentGateway";
import PaymentAnalytics from "@/components/payments/PaymentAnalytics";
import { Radio } from "lucide-react";

const Payments = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <div className="ambient-orb w-[400px] h-[400px] bg-primary/5 top-[15%] right-[-100px] animate-glow-pulse" />
      <div className="ambient-orb w-[300px] h-[300px] bg-success/4 bottom-[20%] left-[-80px] animate-glow-pulse" style={{ animationDelay: "1.5s" }} />
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />

      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              <span className="gradient-text">Payment</span> Gateway
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Mock UPI/Razorpay — premium collection & payout simulation</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/15 px-3 py-2 rounded-lg border border-border/30">
            <Radio className="h-3 w-3 text-success animate-pulse" /> GATEWAY LIVE
          </div>
        </div>
        <PaymentGateway />
        <div className="mt-12">
          <div className="section-divider mb-10" />
          <PaymentAnalytics />
        </div>
      </div>
    </div>
  );
};

export default Payments;
