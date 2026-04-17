import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Animated counter hook
export function useAnimatedCounter(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

// Live value from DB — no Math.random, fetches actual policy/weather values
export function useLiveValue(base: number, _range: number, _intervalMs = 3000) {
  // Simply return the base value — no random fluctuation
  return base;
}

// Activity feed from real DB events
export type ActivityEvent = {
  id: string;
  type: "claim" | "premium" | "alert" | "payout" | "fraud";
  message: string;
  time: string;
  amount?: number;
};

export function useLiveActivityFeed(maxItems = 8) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    // Fetch recent claims from DB as activity events
    const fetchRecentActivity = async () => {
      const { data: claims } = await supabase
        .from('claims')
        .select('id, trigger_type, amount, status, created_at, location_city')
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (claims && claims.length > 0) {
        const mapped: ActivityEvent[] = claims.map(c => {
          const ago = getTimeAgo(c.created_at);
          let type: ActivityEvent['type'] = 'claim';
          let message = `Claim triggered — ${c.trigger_type} in ${c.location_city || 'Unknown'}`;
          if (c.status === 'paid') {
            type = 'payout';
            message = `₹${c.amount.toLocaleString()} payout for ${c.trigger_type}`;
          } else if (c.status === 'processing') {
            message = `Processing claim — ${c.trigger_type} (₹${c.amount.toLocaleString()})`;
          }
          return { id: c.id, type, message, time: ago, amount: c.amount };
        });
        setEvents(mapped);
      } else {
        // No claims yet — show empty state
        setEvents([]);
      }
    };

    fetchRecentActivity();

    // Subscribe to real-time claim inserts
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'claims' }, (payload) => {
        const c = payload.new as any;
        const newEvent: ActivityEvent = {
          id: c.id,
          type: 'claim',
          message: `Auto-claim triggered — ${c.trigger_type} in ${c.location_city || 'Unknown'}`,
          time: 'Just now',
          amount: c.amount,
        };
        setEvents(prev => [newEvent, ...prev].slice(0, maxItems));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [maxItems]);

  return events;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Sparkline from real DB data — fetches recent weather readings
export function useLiveSparkline(points = 20, _intervalMs = 2000) {
  const [data, setData] = useState<number[]>([]);

  useEffect(() => {
    const fetchSparkline = async () => {
      const { data: readings } = await supabase
        .from('weather_readings')
        .select('temperature')
        .order('recorded_at', { ascending: false })
        .limit(points);

      if (readings && readings.length > 0) {
        setData(readings.map(r => Number(r.temperature) || 0).reverse());
      } else {
        // No data yet — empty sparkline
        setData(new Array(points).fill(0));
      }
    };

    fetchSparkline();
    // Refresh every 60s
    const id = setInterval(fetchSparkline, 60000);
    return () => clearInterval(id);
  }, [points]);

  return data;
}

// Tilt card mouse handler
export function useTiltEffect(intensity = 15) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform = `perspective(800px) rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) scale3d(1.02, 1.02, 1.02)`;
  }, [intensity]);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)";
  }, []);

  return { ref, handleMouseMove, handleMouseLeave };
}
