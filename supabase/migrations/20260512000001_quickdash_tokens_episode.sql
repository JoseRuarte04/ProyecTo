-- ── quickdash_tokens: reemplazar session_id por episode_id ──

-- 1. session_id deja de ser obligatorio (se mantiene la FK, cae el NOT NULL)
ALTER TABLE public.quickdash_tokens
  ALTER COLUMN session_id DROP NOT NULL;

-- 2. Agregar episode_id
ALTER TABLE public.quickdash_tokens
  ADD COLUMN episode_id uuid REFERENCES public.treatment_episodes(id) ON DELETE CASCADE;

-- 3. Intercambiar índices
DROP INDEX IF EXISTS public.quickdash_tokens_session_id_idx;
CREATE INDEX ON public.quickdash_tokens (episode_id);

-- 4. Reemplazar RPC — DROP primero porque Postgres no permite renombrar parámetros con CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.create_quickdash_token(uuid, uuid, timestamptz);

CREATE FUNCTION public.create_quickdash_token(
  p_episode_id uuid,
  p_patient_id uuid,
  p_expires_at  timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid;
BEGIN
  -- Validar que el episodio pertenece al terapeuta autenticado
  IF NOT EXISTS (
    SELECT 1 FROM treatment_episodes
    WHERE id = p_episode_id AND professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sin permisos sobre este episodio';
  END IF;

  -- Invalidar tokens activos previos del episodio
  UPDATE quickdash_tokens
  SET completed_at = now(), completed_by = 'therapist'
  WHERE episode_id = p_episode_id
    AND completed_at IS NULL
    AND expires_at > now();

  -- Crear nuevo token
  INSERT INTO quickdash_tokens (patient_id, episode_id, created_by, expires_at)
  VALUES (p_patient_id, p_episode_id, auth.uid(), p_expires_at)
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) TO authenticated;
