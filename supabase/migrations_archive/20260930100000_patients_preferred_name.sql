-- Preferencia de nombre: cómo le gusta al paciente que le llamen.
-- Opcional (no todos los pacientes necesitan uno distinto de first_name).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS preferred_name text NULL;
