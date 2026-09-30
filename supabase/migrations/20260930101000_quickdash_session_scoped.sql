-- QuickDASH pasa a ser por SESIÓN (como Barthel/FIM) en vez de por episodio.
-- quickdash_tokens.session_id ya existía (huérfano desde 20260512000001,
-- cuando se pasó a episode_id) — se vuelve a poblar como vínculo activo.
-- episode_id se mantiene para no romper queries históricas por episodio.

-- 1. create_quickdash_token: invalidar/crear por sesión, no por episodio.
--    DROP primero porque Postgres no permite renombrar parámetros con
--    CREATE OR REPLACE (mismo motivo que en 20260512000001).
DROP FUNCTION IF EXISTS public.create_quickdash_token(uuid, uuid, timestamptz);

CREATE FUNCTION public.create_quickdash_token(
  p_session_id uuid,
  p_patient_id uuid,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token  uuid;
  v_episode_id uuid;
BEGIN
  -- Validar que la sesión pertenece al terapeuta autenticado
  SELECT episode_id INTO v_episode_id
  FROM therapy_sessions
  WHERE id = p_session_id AND professional_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin permisos sobre esta sesión';
  END IF;

  -- Invalidar tokens activos previos de ESTA sesión (no de todo el episodio:
  -- cada sesión tiene su propio QuickDASH, igual que Barthel/FIM)
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

GRANT EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) TO authenticated;

-- 2. complete_quickdash_token: además de guardar el resultado en
--    quickdash_tokens (como antes), reflejarlo en functional_evaluations de
--    la sesión asociada (mismo lugar donde vive Barthel/FIM) — así "gana el
--    último guardado" sin importar si lo completó el paciente o el
--    profesional en el wizard.
CREATE OR REPLACE FUNCTION public.complete_quickdash_token(
  p_token  uuid,
  p_items  jsonb,
  p_score  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   quickdash_tokens;
  v_item  numeric;
  v_score numeric;
  v_fe_id uuid;
  i       int;
BEGIN
  SELECT * INTO v_row
  FROM quickdash_tokens
  WHERE token = p_token
    AND completed_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El enlace no es válido, ya fue utilizado o expiró';
  END IF;

  IF jsonb_array_length(p_items) <> 11 THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  FOR i IN 0..10 LOOP
    v_item := (p_items->>i)::numeric;
    IF v_item < 1 OR v_item > 5 THEN
      RAISE EXCEPTION 'Datos inválidos';
    END IF;
  END LOOP;

  -- Score recalculado server-side, ignoramos p_score del cliente
  v_score := round((((
    (p_items->>0)::numeric + (p_items->>1)::numeric + (p_items->>2)::numeric +
    (p_items->>3)::numeric + (p_items->>4)::numeric + (p_items->>5)::numeric +
    (p_items->>6)::numeric + (p_items->>7)::numeric + (p_items->>8)::numeric +
    (p_items->>9)::numeric + (p_items->>10)::numeric
  ) / 11.0) - 1) * 25, 1);

  UPDATE quickdash_tokens
  SET
    completed_at = now(),
    completed_by = 'patient',
    result = jsonb_build_object('items', p_items, 'score', v_score)
  WHERE id = v_row.id;

  -- Reflejar en functional_evaluations de la sesión (si el token está atado
  -- a una — los tokens viejos pre-migración solo tienen episode_id)
  IF v_row.session_id IS NOT NULL THEN
    SELECT id INTO v_fe_id
    FROM functional_evaluations
    WHERE session_id = v_row.session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_fe_id IS NOT NULL THEN
      UPDATE functional_evaluations
      SET quickdash_items = p_items, quickdash_score = v_score
      WHERE id = v_fe_id;
    ELSE
      INSERT INTO functional_evaluations (
        patient_id, professional_id, episode_id, session_id,
        evaluation_date, quickdash_items, quickdash_score
      )
      VALUES (
        v_row.patient_id, v_row.created_by, v_row.episode_id, v_row.session_id,
        current_date, p_items, v_score
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_quickdash_token(uuid, jsonb, numeric) TO anon;
