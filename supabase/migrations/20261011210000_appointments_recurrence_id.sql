-- Turnos recurrentes (Fase 4 del plan de mejoras al calendario de Turnos,
-- docs/TASKS.md): agrupa las ocurrencias de una misma serie sin necesidad de
-- una tabla nueva ni de policies de RLS adicionales — cada fila sigue siendo
-- un turno independiente, gobernado por las mismas policies de "appointments"
-- que ya existen (professional_id = auth.uid() / is_my_patient). Editar o
-- cancelar una sola ocurrencia ya funciona hoy sin ningún cambio; cancelar
-- "toda la serie" es, del lado del cliente, un UPDATE masivo filtrando por
-- este mismo recurrence_id.

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_id uuid;

CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_id
  ON public.appointments (recurrence_id)
  WHERE recurrence_id IS NOT NULL;
