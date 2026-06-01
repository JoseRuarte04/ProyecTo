-- ── 1. Fecha de derivación en treatment_episodes ──────────────────────────────
ALTER TABLE treatment_episodes
  ADD COLUMN IF NOT EXISTS referral_date date NULL;

-- ── 2. Dolores múltiples en analytical_evaluations ────────────────────────────
-- pains: array JSON de objetos de dolor. Cada ítem tiene:
--   { localizacion, eva, tipo, aparicion, irradia, irradia_hacia,
--     caracteristicas, agravantes, observaciones }
-- pain_score se mantiene como el EVA máximo del array (calculado en el cliente).
-- Los campos planos legacy (pain_location, pain_radiation, etc.) se conservan
-- sin borrar para retrocompatibilidad con evaluaciones históricas.
ALTER TABLE analytical_evaluations
  ADD COLUMN IF NOT EXISTS pains jsonb NULL;

-- ── 3. Configuración de visibilidad de secciones ──────────────────────────────
-- sections_config: objeto JSON con el estado visible/oculto de cada sección.
-- Ejemplo: { "pain": true, "edema": false, "mobility": true, ... }
-- NULL = evaluación histórica → inferir visibilidad desde presencia de datos.
ALTER TABLE analytical_evaluations
  ADD COLUMN IF NOT EXISTS sections_config jsonb NULL;

-- ── 4. Observaciones de movilidad ─────────────────────────────────────────────
ALTER TABLE analytical_evaluations
  ADD COLUMN IF NOT EXISTS mobility_observations text NULL;
