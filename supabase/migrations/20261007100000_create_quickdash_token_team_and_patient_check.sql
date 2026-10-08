-- create_quickdash_token: dos arreglos en la misma función.
--
-- 1) Hueco (preexistente, mismo patrón del crítico #1 de docs/AUDIT_2026-10-02.md, que el PR #31 cerró
--    solo del lado de la tabla): la función es SECURITY DEFINER (se salta el RLS) y confiaba en
--    `p_patient_id` sin verificar que fuera el paciente de la sesión. Un profesional podía usar SU
--    sesión con el paciente de OTRO profesional: se creaba el token, y al completarlo el paciente,
--    complete_quickdash_token escribía una functional_evaluations con ese patient_id ajeno.
--    Ahora se exige que la sesión pertenezca al paciente indicado.
--
-- 2) Compañeros de equipo (candidato de docs/TASKS.md, hallazgo nice-to-have de la auditoría): solo
--    podía generar el token quien escribió la sesión (`professional_id = auth.uid()`), así que un
--    compañero recibía un "Sin permisos" confuso en un paciente del equipo. Ahora alcanza con que el
--    paciente sea "mío" según is_my_patient() (dueño directo o miembro del equipo), igual que el
--    resto del sistema.
--
-- CREATE OR REPLACE conserva owner y grants; es idempotente.

CREATE OR REPLACE FUNCTION public.create_quickdash_token(
  p_session_id uuid,
  p_patient_id uuid,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_token  uuid;
  v_episode_id uuid;
BEGIN
  SELECT s.episode_id INTO v_episode_id
  FROM therapy_sessions s
  WHERE s.id = p_session_id
    AND s.patient_id = p_patient_id
    AND is_my_patient(s.patient_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin permisos sobre esta sesión o el paciente no corresponde';
  END IF;

  UPDATE quickdash_tokens
  SET completed_at = now(), completed_by = 'therapist'
  WHERE session_id = p_session_id
    AND completed_at IS NULL
    AND expires_at > now();

  INSERT INTO quickdash_tokens (patient_id, episode_id, session_id, created_by, expires_at)
  VALUES (p_patient_id, v_episode_id, p_session_id, auth.uid(), p_expires_at)
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;
