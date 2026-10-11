-- Triage de feedback: hoy AdminFeedback.tsx es de solo lectura, sin forma de
-- marcar algo como visto/resuelto (hallazgo del análisis del panel admin,
-- 2026-10-11). Se agrega `status` + una RPC admin-only para cambiarlo
-- (mismo patrón que el resto de admin_*, con auditoría).

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_status_check CHECK (status IN ('new', 'seen', 'resolved'));

CREATE OR REPLACE FUNCTION public.admin_update_feedback_status(p_feedback_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_status NOT IN ('new', 'seen', 'resolved') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feedback WHERE id = p_feedback_id) THEN
    RAISE EXCEPTION 'Feedback no encontrado';
  END IF;

  UPDATE feedback
  SET status = p_status,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END
  WHERE id = p_feedback_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback_status(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_feedback_status(uuid, text) FROM PUBLIC, anon;
