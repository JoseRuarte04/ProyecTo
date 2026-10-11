-- Rediseño de Evaluación funcional en 5 apartados (marco AOTA/MOHO):
-- 1. Ocupaciones (checklist estructurado independiente/asistencia/dependiente,
--    ver src/components/evaluations/occupationsTaxonomy.ts) + notas libres.
-- 2. Contextos, 3. Patrones de desempeño, 4. Habilidades de desempeño,
-- 5. Factores del cliente (texto libre cada uno).
--
-- Sin CHECK en occupations_items (jsonb) ni en los campos de texto, mismo
-- patrón que el resto de los campos de opciones cerradas del proyecto.
-- avd/aivd/sleep_rest/health_management/physical_activity/dominance quedan
-- deprecadas (subsumidas en occupations_items) pero no se borran.
ALTER TABLE public.functional_evaluations
  ADD COLUMN IF NOT EXISTS occupations_items jsonb,
  ADD COLUMN IF NOT EXISTS occupations_notes text,
  ADD COLUMN IF NOT EXISTS context_environmental_factors text,
  ADD COLUMN IF NOT EXISTS context_personal_factors text,
  ADD COLUMN IF NOT EXISTS performance_pattern_habits text,
  ADD COLUMN IF NOT EXISTS performance_pattern_routines text,
  ADD COLUMN IF NOT EXISTS performance_pattern_roles text,
  ADD COLUMN IF NOT EXISTS performance_pattern_rituals text,
  ADD COLUMN IF NOT EXISTS performance_skill_motor text,
  ADD COLUMN IF NOT EXISTS performance_skill_processing text,
  ADD COLUMN IF NOT EXISTS performance_skill_social_interaction text,
  ADD COLUMN IF NOT EXISTS client_factor_values_beliefs_spirituality text,
  ADD COLUMN IF NOT EXISTS client_factor_body_functions text,
  ADD COLUMN IF NOT EXISTS client_factor_body_structures text;
