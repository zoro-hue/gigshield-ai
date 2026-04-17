import { motion } from "framer-motion";

const testimonials = [
  { name: "Rahul K.", role: "Zomato Rider, Mumbai", text: "Got ₹2,400 payout during the July floods. Didn't even have to file a claim — it just showed up.", avatar: "🏍️" },
  { name: "Priya S.", role: "Swiggy Partner, Delhi", text: "The weekly premium is less than what I spend on chai. But the peace of mind? Priceless.", avatar: "🛵" },
  { name: "Arun M.", role: "Blinkit Runner, Bangalore", text: "42°C heat wave shut down deliveries for 3 days. GigShield covered my lost earnings automatically.", avatar: "⚡" },
  { name: "Deepa R.", role: "Zepto Rider, Chennai", text: "I was skeptical about AI insurance. Then Cyclone Michaung hit and I got paid in 28 seconds.", avatar: "🌊" },
  { name: "Vikram T.", role: "Dunzo Partner, Pune", text: "No paperwork, no calls, no waiting. Just protection that actually works for people like us.", avatar: "📦" },
  { name: "Sunita B.", role: "Swiggy Rider, Hyderabad", text: "My friends laughed when I got micro-insurance. They stopped laughing when I got paid during the floods.", avatar: "💪" },
];

const TestimonialsCarousel = () => {
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-28 overflow-hidden">
      <div className="container mx-auto px-4 mb-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Real Workers. <span className="gradient-text">Real Protection.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto font-light">
            Hear from delivery partners who've experienced GigShield firsthand.
          </p>
        </motion.div>
      </div>

      <div className="relative group">
        <div
          className="flex gap-5 w-max animate-scroll-left hover:[animation-play-state:paused]"
        >
          {doubled.map((t, i) => (
            <div
              key={i}
              className="glass-card w-[320px] md:w-[360px] flex-shrink-0 p-6 rounded-2xl border border-border/30"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{t.avatar}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
            </div>
          ))}
        </div>

        {/* Edge fades */}
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
};

export default TestimonialsCarousel;
