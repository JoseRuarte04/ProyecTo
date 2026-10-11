-- Campo de alergias del paciente, texto libre (mismo patrón que
-- "Antecedentes"/"Motivo de consulta" en patient_clinical_records).
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS allergies text;
