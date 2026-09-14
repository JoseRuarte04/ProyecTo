-- Catálogo global HEP2go: columnas nuevas en exercise_library, nullable,
-- pobladas solo en filas de catálogo (professional_id IS NULL).
ALTER TABLE exercise_library
  ADD COLUMN catalog_region text,
  ADD COLUMN catalog_subcategory text,
  ADD COLUMN source_exercise_id integer;

-- Único cuando no es null: permite reimportar el catálogo con UPSERT
-- (ON CONFLICT (source_exercise_id)) si el sheet de HEP2go se actualiza.
CREATE UNIQUE INDEX exercise_library_source_exercise_id_key
  ON exercise_library (source_exercise_id)
  WHERE source_exercise_id IS NOT NULL;

-- Índices para los filtros de la sidebar de catálogo (Región) y para no
-- escanear toda la tabla al traer solo las filas de catálogo.
CREATE INDEX idx_exercise_library_catalog_region
  ON exercise_library (catalog_region)
  WHERE professional_id IS NULL;

CREATE INDEX idx_exercise_library_professional_id_null
  ON exercise_library (professional_id)
  WHERE professional_id IS NULL;

-- SELECT adicional y permisiva: cualquier profesional autenticado puede LEER
-- las filas de catálogo (professional_id IS NULL). No reemplaza ni toca la(s)
-- política(s) de SELECT/INSERT/UPDATE/DELETE existentes (desconocidas, no
-- versionadas porque exercise_library es anterior al historial de
-- migraciones) — esas siguen exigiendo professional_id = auth.uid(), lo cual
-- ya bloquea naturalmente cualquier intento de editar/borrar una fila NULL
-- (auth.uid() nunca es NULL, y professional_id = NULL nunca es true).
-- "Multiple permissive policies" en el mismo comando ya es un patrón
-- aceptado en este proyecto, ver 20260716010000_rls_initplan_and_fk_indexes.sql.
CREATE POLICY "catalogo global visible para todos los profesionales"
  ON exercise_library FOR SELECT
  TO authenticated
  USING (professional_id IS NULL);
