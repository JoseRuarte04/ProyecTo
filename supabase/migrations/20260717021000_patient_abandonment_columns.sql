-- Registro de abandono de tratamiento: fecha y motivo opcional.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandon_reason text;

-- Se recrea soft_delete_session (definida en 20260505035000) con un único
-- cambio: al borrar la última sesión de alta, solo revertir a 'active' si el
-- paciente estaba 'discharged'. Antes pisaba incondicionalmente cualquier
-- estado (incluido el nuevo 'abandoned' y 'paused').
CREATE OR REPLACE FUNCTION public.soft_delete_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_patient_id uuid;
BEGIN
  -- Validar ownership y que la sesión existe y no está borrada
  SELECT * INTO v_session
  FROM therapy_sessions
  WHERE id = p_session_id
    AND professional_id = auth.uid()
    AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión no encontrada o sin permisos de acceso';
  END IF;

  -- No permitir eliminar sesiones de admisión
  IF v_session.session_type = 'admission' THEN
    RAISE EXCEPTION 'No se puede eliminar una sesión de admisión';
  END IF;

  v_patient_id := v_session.patient_id;

  -- Soft delete (el trigger handle_session_soft_delete registrará deleted_at y el audit log)
  UPDATE therapy_sessions
  SET is_deleted = true
  WHERE id = p_session_id;

  -- Si era una sesión de alta, revertir el estado del paciente a activo si no quedan otras altas
  IF v_session.session_type = 'discharge' THEN
    DECLARE
      remaining_discharge int;
    BEGIN
      SELECT COUNT(*) INTO remaining_discharge
      FROM therapy_sessions
      WHERE patient_id = v_patient_id
        AND session_type = 'discharge'
        AND is_deleted = false;

      IF remaining_discharge = 0 THEN
        UPDATE patients SET status = 'active'
        WHERE id = v_patient_id AND status = 'discharged';
      END IF;
    END;
  END IF;
END;
$$;

-- Mismos permisos que fijó el hardening (20260715130000)
REVOKE EXECUTE ON FUNCTION public.soft_delete_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_session(uuid) TO authenticated;
