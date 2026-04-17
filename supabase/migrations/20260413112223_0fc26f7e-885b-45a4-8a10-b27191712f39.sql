-- Allow service/authenticated to update claims (for fraud scoring)
CREATE POLICY "Service can update claims"
ON public.claims
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
