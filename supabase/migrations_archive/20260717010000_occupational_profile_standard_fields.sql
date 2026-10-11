-- Campos estandarizados del perfil ocupacional. Se cargan desde selects con
-- opciones predefinidas (src/components/patients/occupationalOptions.ts);
-- sin CHECK para no romper si se agregan opciones nuevas.
ALTER TABLE public.patient_occupational_profiles
  ADD COLUMN IF NOT EXISTS employment_status text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS education_level text;
