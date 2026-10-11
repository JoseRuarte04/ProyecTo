DROP POLICY IF EXISTS "therapy_sessions: editar" ON public.therapy_sessions;

CREATE POLICY "therapy_sessions: editar"
ON public.therapy_sessions
FOR UPDATE
TO authenticated
USING (professional_id = auth.uid() AND public.is_active_professional())
WITH CHECK (professional_id = auth.uid() AND public.is_active_professional());