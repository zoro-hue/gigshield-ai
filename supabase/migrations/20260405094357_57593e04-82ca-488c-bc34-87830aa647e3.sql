
ALTER TABLE public.risk_assessments ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'xgboost_v1';

CREATE TABLE IF NOT EXISTS public.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read logs" ON public.logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert logs" ON public.logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_assessments;
