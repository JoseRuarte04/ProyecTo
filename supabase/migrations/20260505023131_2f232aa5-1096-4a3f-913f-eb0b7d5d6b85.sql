DROP POLICY IF EXISTS "therapy_sessions: editar" ON public.therapy_sessions;

CREATE POLICY "therapy_sessions: editar"
ON public.therapy_sessions
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (professional_id = auth.uid())
WITH CHECK (professional_id = auth.uid());