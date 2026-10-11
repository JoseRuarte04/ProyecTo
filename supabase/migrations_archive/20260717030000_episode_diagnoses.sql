-- Diagnósticos por episodio (N por episodio, position 0 = principal).
-- Las columnas legacy patient_clinical_records.diagnosis y
-- treatment_episodes.diagnosis se siguen escribiendo con el principal para
-- no romper vistas existentes ni el informe de alta (generate-discharge-report).
CREATE TABLE public.episode_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.treatment_episodes(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  code text,                            -- código CIE-10 (null si texto libre)
  label text NOT NULL,                  -- ej: "S62.0 — Fractura de escafoides"
  position integer NOT NULL DEFAULT 0,  -- 0 = diagnóstico principal
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_episode_diagnoses_episode_id ON public.episode_diagnoses(episode_id);
CREATE INDEX idx_episode_diagnoses_patient_id ON public.episode_diagnoses(patient_id);

ALTER TABLE public.episode_diagnoses ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que patient_clinical_records (ver 20260430025057)
CREATE POLICY "episode_diagnoses: acceso profesional"
ON public.episode_diagnoses
FOR ALL
USING (public.is_active_professional() AND public.is_my_patient(patient_id))
WITH CHECK (public.is_active_professional() AND public.is_my_patient(patient_id));
