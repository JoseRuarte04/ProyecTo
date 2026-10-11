-- Unifica las columnas legacy de exercise_library con las que usa la app hoy:
--   default_sets / default_repetitions  ->  suggested_sets / suggested_reps
--   body_region (texto libre)           ->  body_region_id (FK a exercise_body_regions)
-- Las columnas legacy quedan en su lugar (la app ya no las lee ni las escribe);
-- se pueden eliminar en una migración futura una vez verificado el backfill.

UPDATE exercise_library
SET suggested_sets = COALESCE(suggested_sets, default_sets),
    suggested_reps = COALESCE(suggested_reps, default_repetitions)
WHERE (suggested_sets IS NULL AND default_sets IS NOT NULL)
   OR (suggested_reps IS NULL AND default_repetitions IS NOT NULL);

-- Crea un apartado por cada texto libre de body_region que todavía no tenga FK,
-- respetando que los apartados son por profesional.
INSERT INTO exercise_body_regions (name, professional_id)
SELECT DISTINCT trim(el.body_region), el.professional_id
FROM exercise_library el
WHERE el.body_region_id IS NULL
  AND el.body_region IS NOT NULL AND trim(el.body_region) <> ''
  AND el.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM exercise_body_regions br
    WHERE br.professional_id = el.professional_id
      AND br.name = trim(el.body_region)
  );

UPDATE exercise_library el
SET body_region_id = br.id
FROM exercise_body_regions br
WHERE el.body_region_id IS NULL
  AND el.body_region IS NOT NULL AND trim(el.body_region) <> ''
  AND br.professional_id = el.professional_id
  AND br.name = trim(el.body_region);
