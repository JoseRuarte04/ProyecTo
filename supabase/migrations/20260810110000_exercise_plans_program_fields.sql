-- Programa: exercise_plans suma fecha de inicio + duración (programación en
-- el tiempo) y routine_id (trazabilidad de la última rutina aplicada).
ALTER TABLE exercise_plans
  ADD COLUMN start_date date,
  ADD COLUMN duration_weeks integer,
  ADD COLUMN routine_id uuid REFERENCES exercise_routines(id) ON DELETE SET NULL,
  ADD CONSTRAINT exercise_plans_duration_weeks_check
    CHECK (duration_weeks IS NULL OR duration_weeks > 0);

CREATE INDEX idx_exercise_plans_routine_id ON public.exercise_plans (routine_id);

-- El "1 plan por paciente" era hasta ahora solo convención de UI (.maybeSingle()
-- sin constraint real). Se refuerza acá porque el modelo confirmado es que el
-- paciente siempre tiene un único plan/programa.
-- Nota: si esta migración falla por violación de UNIQUE, hay pacientes con más
-- de un exercise_plans — hay que resolver esos duplicados a mano antes de
-- reintentar (avisar antes de aplicar en el dashboard).
ALTER TABLE exercise_plans
  ADD CONSTRAINT exercise_plans_patient_id_key UNIQUE (patient_id);
