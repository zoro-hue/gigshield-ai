
-- Weather readings
CREATE TABLE IF NOT EXISTS public.weather_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  zone text,
  temperature numeric,
  rainfall numeric,
  aqi integer,
  humidity numeric,
  wind_speed numeric,
  source text DEFAULT 'openweathermap',
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weather_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read weather" ON public.weather_readings;
DROP POLICY IF EXISTS "Service role can insert weather" ON public.weather_readings;
CREATE POLICY "Authenticated users can read weather" ON public.weather_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can insert weather" ON public.weather_readings FOR INSERT TO authenticated WITH CHECK (true);

-- GPS logs
CREATE TABLE IF NOT EXISTS public.gps_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  speed numeric,
  anomaly_score numeric DEFAULT 0,
  is_spoofed boolean DEFAULT false,
  flagged_reason text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gps_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own gps logs" ON public.gps_logs;
DROP POLICY IF EXISTS "Users can read own gps logs" ON public.gps_logs;
CREATE POLICY "Users can insert own gps logs" ON public.gps_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own gps logs" ON public.gps_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Disruption events
CREATE TABLE IF NOT EXISTS public.disruption_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  description text,
  city text NOT NULL,
  zone text,
  severity text DEFAULT 'moderate',
  source text,
  is_active boolean DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.disruption_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read disruptions" ON public.disruption_events;
DROP POLICY IF EXISTS "Authenticated users can insert disruptions" ON public.disruption_events;
CREATE POLICY "Authenticated users can read disruptions" ON public.disruption_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert disruptions" ON public.disruption_events FOR INSERT TO authenticated WITH CHECK (true);

-- Policies
CREATE TABLE IF NOT EXISTS public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_profile_id uuid REFERENCES public.worker_profiles(id),
  status text NOT NULL DEFAULT 'active',
  weekly_premium integer NOT NULL,
  max_payout integer NOT NULL,
  coverage_type text DEFAULT 'income_loss',
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  renewed_count integer DEFAULT 0
);
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own policies" ON public.policies;
DROP POLICY IF EXISTS "Users can insert own policies" ON public.policies;
DROP POLICY IF EXISTS "Users can update own policies" ON public.policies;
CREATE POLICY "Users can read own policies" ON public.policies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own policies" ON public.policies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own policies" ON public.policies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Claims
CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.policies(id),
  trigger_type text NOT NULL,
  trigger_value text,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  location_city text,
  location_zone text,
  fraud_score numeric DEFAULT 0,
  fraud_check_passed boolean DEFAULT true,
  processing_time_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON public.claims;
CREATE POLICY "Users can read own claims" ON public.claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own claims" ON public.claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
