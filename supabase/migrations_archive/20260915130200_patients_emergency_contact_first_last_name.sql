-- Separa el contacto de emergencia en nombre y apellido (antes era un solo
-- campo "nombre completo"). Backfill de los datos existentes con un split
-- simple: primera palabra -> nombre, resto -> apellido (null si no hay
-- resto). emergency_contact_name queda deprecada pero no se borra todavía
-- (dato crudo por las dudas) — ver candidato de limpieza en docs/TASKS.md.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS emergency_contact_first_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_last_name text;

UPDATE public.patients
SET
  emergency_contact_first_name = split_part(trim(emergency_contact_name), ' ', 1),
  emergency_contact_last_name = NULLIF(
    trim(substring(trim(emergency_contact_name) FROM length(split_part(trim(emergency_contact_name), ' ', 1)) + 1)),
    ''
  )
WHERE emergency_contact_name IS NOT NULL AND trim(emergency_contact_name) <> '';
