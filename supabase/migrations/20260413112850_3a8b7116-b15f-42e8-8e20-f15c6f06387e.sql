
-- Create transactions table for payout lifecycle
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'payout',
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  method text DEFAULT 'UPI',
  payment_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can update transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
