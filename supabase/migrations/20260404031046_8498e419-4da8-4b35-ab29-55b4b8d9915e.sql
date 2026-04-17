CREATE TABLE public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  risk_score numeric,
  risk_label text NOT NULL DEFAULT 'UNAVAILABLE',
  weather_snapshot jsonb,
  source text DEFAULT 'ai_service',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read risk assessments"
  ON public.risk_assessments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can insert risk assessments"
  ON public.risk_assessments FOR INSERT TO authenticated
  WITH CHECK (true);