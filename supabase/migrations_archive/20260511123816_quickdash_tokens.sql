-- ── quickdash_tokens ──

CREATE TABLE public.quickdash_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  completed_at timestamptz,
  completed_by text CHECK (completed_by IN ('patient', 'therapist')),
  result       jsonb
);

CREATE INDEX ON public.quickdash_tokens (session_id);

ALTER TABLE public.quickdash_tokens ENABLE ROW LEVEL SECURITY;

-- Terapeutas: leer sus propios tokens
CREATE POLICY "quickdash_tokens: select propio"
ON public.quickdash_tokens FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Terapeutas: crear tokens
CREATE POLICY "quickdash_tokens: insert"
ON public.quickdash_tokens FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Terapeutas: actualizar sus propios tokens (invalidación manual)
CREATE POLICY "quickdash_tokens: update propio"
ON public.quickdash_tokens FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- ── RPC pública: consultar estado del token ──
CREATE OR REPLACE FUNCTION public.get_quickdash_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quickdash_tokens;
BEGIN
  SELECT * INTO v_row FROM quickdash_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  RETURN jsonb_build_object('status', 'valid', 'expires_at', v_row.expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quickdash_token(uuid) TO anon;

-- ── RPC pública: completar el formulario ──
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
  v_id   uuid;
  v_item numeric;
  i      int;
BEGIN
  -- Validar token activo
  SELECT id INTO v_id
  FROM quickdash_tokens
  WHERE token = p_token
    AND completed_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El enlace no es válido, ya fue utilizado o expiró';
  END IF;

  -- Validar estructura de items: array de 11 números entre 1 y 5
  IF jsonb_array_length(p_items) <> 11 THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  FOR i IN 0..10 LOOP
    v_item := (p_items->>i)::numeric;
    IF v_item < 1 OR v_item > 5 THEN
      RAISE EXCEPTION 'Datos inválidos';
    END IF;
  END LOOP;

  -- Registrar resultado (score recalculado server-side, ignoramos p_score del cliente)
  UPDATE quickdash_tokens
  SET
    completed_at = now(),
    completed_by = 'patient',
    result = jsonb_build_object(
      'items', p_items,
      'score', round((((
        (p_items->>0)::numeric +
        (p_items->>1)::numeric +
        (p_items->>2)::numeric +
        (p_items->>3)::numeric +
        (p_items->>4)::numeric +
        (p_items->>5)::numeric +
        (p_items->>6)::numeric +
        (p_items->>7)::numeric +
        (p_items->>8)::numeric +
        (p_items->>9)::numeric +
        (p_items->>10)::numeric
      ) / 11.0) - 1) * 25, 1)
    )
  WHERE id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_quickdash_token(uuid, jsonb, numeric) TO anon;

-- ── RPC autenticada: crear token (invalida previos activos) ──
CREATE OR REPLACE FUNCTION public.create_quickdash_token(
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
  v_new_token uuid;
BEGIN
  -- Validar que la sesión pertenece al terapeuta
  IF NOT EXISTS (
    SELECT 1 FROM therapy_sessions
    WHERE id = p_session_id AND professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sin permisos sobre esta sesión';
  END IF;

  -- Invalidar tokens activos previos de esta sesión
  UPDATE quickdash_tokens
  SET completed_at = now(), completed_by = 'therapist'
  WHERE session_id = p_session_id
    AND completed_at IS NULL
    AND expires_at > now();

  -- Crear nuevo token
  INSERT INTO quickdash_tokens (patient_id, session_id, created_by, expires_at)
  VALUES (p_patient_id, p_session_id, auth.uid(), p_expires_at)
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) TO authenticated;
