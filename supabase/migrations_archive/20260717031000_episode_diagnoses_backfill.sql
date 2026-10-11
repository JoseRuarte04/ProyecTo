-- Backfill: copia el diagnóstico legacy de cada episodio como diagnóstico
-- principal (position 0). Prioridad: ficha clínica del episodio > episodio.
-- Idempotente: no toca episodios que ya tienen filas.
INSERT INTO public.episode_diagnoses (episode_id, patient_id, label, code, position)
SELECT te.id, te.patient_id,
       COALESCE(pcr.diagnosis, te.diagnosis),
       NULLIF((regexp_match(COALESCE(pcr.diagnosis, te.diagnosis), '^([A-Z][0-9][0-9A-Z.]*)\s+—'))[1], ''),
       0
FROM public.treatment_episodes te
LEFT JOIN public.patient_clinical_records pcr ON pcr.episode_id = te.id
WHERE COALESCE(pcr.diagnosis, te.diagnosis) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.episode_diagnoses ed WHERE ed.episode_id = te.id);

-- Fichas clínicas sin episode_id: solo si el paciente tiene un único episodio
-- (si tiene varios no se puede saber a cuál pertenece el diagnóstico).
INSERT INTO public.episode_diagnoses (episode_id, patient_id, label, code, position)
SELECT te.id, pcr.patient_id, pcr.diagnosis,
       NULLIF((regexp_match(pcr.diagnosis, '^([A-Z][0-9][0-9A-Z.]*)\s+—'))[1], ''),
       0
FROM public.patient_clinical_records pcr
JOIN public.treatment_episodes te ON te.patient_id = pcr.patient_id
WHERE pcr.episode_id IS NULL AND pcr.diagnosis IS NOT NULL
  AND (SELECT count(*) FROM public.treatment_episodes t2 WHERE t2.patient_id = pcr.patient_id) = 1
  AND NOT EXISTS (SELECT 1 FROM public.episode_diagnoses ed WHERE ed.episode_id = te.id);
