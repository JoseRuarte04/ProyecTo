-- ── Tabla: exercise_plan_tokens ──────────────────────────────────────────
CREATE TABLE exercise_plan_tokens (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token          uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  plan_id        uuid        NOT NULL REFERENCES exercise_plans(id) ON DELETE CASCADE,
  patient_id     uuid        NOT NULL REFERENCES patients(id),
  professional_id uuid       NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz
);

ALTER TABLE exercise_plan_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeutas acceden a sus tokens de plan"
  ON exercise_plan_tokens FOR ALL
  USING  (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- ── RPC: crear token (revoca activos previos del mismo plan) ─────────────
CREATE OR REPLACE FUNCTION create_exercise_plan_token(
  p_plan_id   uuid,
  p_patient_id uuid,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token uuid;
BEGIN
  -- Solo el dueño del plan puede crear tokens
  IF NOT EXISTS (
    SELECT 1 FROM exercise_plans
    WHERE id = p_plan_id AND professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Revocar todos los tokens activos del mismo plan
  UPDATE exercise_plan_tokens
  SET revoked_at = now()
  WHERE plan_id = p_plan_id
    AND revoked_at IS NULL;

  -- Insertar nuevo token
  INSERT INTO exercise_plan_tokens (plan_id, patient_id, professional_id, expires_at)
  SELECT p_plan_id, p_patient_id, professional_id, p_expires_at
  FROM exercise_plans WHERE id = p_plan_id
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- ── RPC pública: verificar estado del token ──────────────────────────────
CREATE OR REPLACE FUNCTION get_exercise_plan_token(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row exercise_plan_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM exercise_plan_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN json_build_object('status', 'revoked', 'expires_at', v_row.expires_at);
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN json_build_object('status', 'expired', 'expires_at', v_row.expires_at);
  END IF;

  RETURN json_build_object('status', 'valid', 'expires_at', v_row.expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION get_exercise_plan_token(uuid) TO anon;

-- ── RPC pública: datos del plan (solo si token válido) ───────────────────
CREATE OR REPLACE FUNCTION get_exercise_plan_public(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id uuid;
  v_result  json;
BEGIN
  SELECT plan_id INTO v_plan_id
  FROM exercise_plan_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'plan_notes', ep.notes,
    'items', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'order_index',   epi.order_index,
            'assigned_sets', epi.assigned_sets,
            'assigned_reps', epi.assigned_reps,
            'frequency',     epi.frequency,
            'item_notes',    epi.notes,
            'exercise', json_build_object(
              'name',             el.name,
              'exercise_type',    el.exercise_type,
              'instructions',     el.instructions,
              'starting_position',el.starting_position,
              'precautions',      el.precautions,
              'equipment',        el.equipment,
              'video_url',        el.video_url
            )
          )
          ORDER BY epi.order_index
        )
        FROM exercise_plan_items epi
        JOIN exercise_library el ON el.id = epi.exercise_id
        WHERE epi.plan_id = v_plan_id
      ),
      '[]'::json
    )
  )
  INTO v_result
  FROM exercise_plans ep
  WHERE ep.id = v_plan_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_exercise_plan_public(uuid) TO anon;
