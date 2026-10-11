-- quickdash_tokens: igualar el patrón de ownership de exercise_plan_tokens.
--
-- Encontrado en la auditoría de seguridad del 2026-10-02
-- (docs/AUDIT_2026-10-02.md, crítico #1): la policy de INSERT solo validaba
-- `created_by = auth.uid()`, sin confirmar que el paciente le pertenece al
-- profesional (directo o por equipo, vía is_my_patient()) — permitía generar
-- un token de QuickDASH para el paciente de OTRO profesional, saltando la
-- validación real que hace la RPC create_quickdash_token. La policy de
-- UPDATE ("update propio") tenía el mismo hueco, no solo la de INSERT.
--
-- Referencia del patrón correcto: exercise_plan_tokens ("crear"/"editar"),
-- confirmado contra pg_policies en Supabase real antes de escribir esto.

DROP POLICY IF EXISTS "quickdash_tokens: insert" ON public.quickdash_tokens;
CREATE POLICY "quickdash_tokens: insert"
ON public.quickdash_tokens FOR INSERT
TO authenticated
WITH CHECK (
  is_active_professional()
  AND created_by = auth.uid()
  AND is_my_patient(patient_id)
);

DROP POLICY IF EXISTS "quickdash_tokens: update propio" ON public.quickdash_tokens;
CREATE POLICY "quickdash_tokens: update propio"
ON public.quickdash_tokens FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_my_patient(patient_id))
WITH CHECK (created_by = auth.uid() OR is_my_patient(patient_id));
