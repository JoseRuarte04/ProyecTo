-- exercise_body_regions / exercise_custom_categories: mismo bug de
-- duplicados por mayúsculas/minúsculas ya encontrado y arreglado para
-- obras_sociales.name el 2026-09-18 (ver docs/AUDIT_2026-10-02.md,
-- importante #10). exercise_body_regions no tenía NINGUNA constraint de
-- unicidad; exercise_custom_categories tenía uq_custom_category
-- case-sensitive. Ambas son catálogos por profesional (scoped por
-- professional_id, no globales como obras_sociales).
--
-- Confirmado antes de aplicar: no hay duplicados case-insensitive
-- existentes en ninguna de las 2 tablas.

CREATE UNIQUE INDEX IF NOT EXISTS exercise_body_regions_professional_name_lower_idx
ON public.exercise_body_regions (professional_id, lower(name));

ALTER TABLE public.exercise_custom_categories DROP CONSTRAINT IF EXISTS uq_custom_category;
CREATE UNIQUE INDEX IF NOT EXISTS exercise_custom_categories_professional_name_lower_idx
ON public.exercise_custom_categories (professional_id, lower(name));
