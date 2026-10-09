-- appointments: cerrar la puerta lateral de UPDATE (hallazgo T-1 del QA de Turnos, 2026-10-08).
--
-- La policy "appointments: editar" tenía en el WITH CHECK
--   professional_id = auth.uid() OR is_my_patient(patient_id)
-- o sea que bastaba ser el profesional del turno para dejarlo apuntando a
-- CUALQUIER paciente: un profesional podía reasignar su turno al paciente de
-- otro (el turno aparecía en la agenda del dueño real). Lo mismo con
-- professional_id: dejarlo apuntando a otro profesional lo inyecta en su agenda.
-- El INSERT ya estaba bien ("crear" exige is_my_patient); el UPDATE no.
-- Mismo patrón que quickdash_tokens (20261002100000): INSERT cerrado, UPDATE no.
--
-- Fix en dos capas:
--  1. WITH CHECK: el paciente tiene que seguir siendo del profesional que edita.
--  2. Trigger: patient_id y professional_id son inmutables para usuarios de la
--     app. Ningún flujo legítimo los cambia (la app solo toca estado,
--     cancelación, video_link, fecha/fin y notas); se verificó en src/ y en
--     las funciones SQL. Con auth.uid() nulo (service role / SQL directo) se
--     permite, para no trabar tareas de mantenimiento.

DROP POLICY IF EXISTS "appointments: editar" ON public.appointments;
CREATE POLICY "appointments: editar"
ON public.appointments FOR UPDATE
TO authenticated
USING (
  is_active_professional()
  AND (professional_id = auth.uid() OR is_my_patient(patient_id))
)
WITH CHECK (
  is_active_professional()
  AND is_my_patient(patient_id)
);

CREATE OR REPLACE FUNCTION public.appointments_lock_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.patient_id IS DISTINCT FROM OLD.patient_id
          OR NEW.professional_id IS DISTINCT FROM OLD.professional_id) THEN
    RAISE EXCEPTION 'No se puede cambiar el paciente ni el profesional de un turno'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_lock_ownership ON public.appointments;
CREATE TRIGGER trg_appointments_lock_ownership
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointments_lock_ownership();
