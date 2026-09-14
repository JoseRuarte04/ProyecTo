# Catálogo global de ejercicios HEP2go

## Contexto

Se pidió actualizar la sección Ejercicios importando el catálogo HEP2go
(planilla `HEP2go_catalogo_completo.xlsx`, pestaña "Catalogo HEP2go ES",
2928 ejercicios en español clasificados por Región → Subcategoría →
Nombre, con Instrucciones y una Clasificación interna de 5 valores).

Decisiones ya confirmadas con el usuario:
1. **Catálogo global compartido** (no cargado en la cuenta de un solo
   profesional).
2. **Clasificación ampliada a 5 categorías** (Activo, Activo asistido,
   Fortalecimiento, Pasivo, Sin clasificar) — antes eran 3.
3. **Sin imágenes** por ahora (no se agrega `image_url`).
4. **Subcategoría filtrable**, un nivel debajo de Región.

Punto de partida clave: hoy `exercise_library` es 100% por profesional
(`professional_id = auth.uid()` en RLS, sin concepto de catálogo
compartido). El diseño reutiliza esa misma tabla marcando las filas de
catálogo con `professional_id IS NULL`, en vez de crear una tabla nueva —
evita duplicar toda la UI de ejercicios (detalle, PDF, selectores en
Planes/Programas, página pública del paciente) que hoy asume una sola
tabla.

**Hallazgo crítico durante la exploración:** la función
`add_routine_to_exercise_plan` (usada al aplicar un Plan/Programa a un
paciente) hace un chequeo manual de ownership (`el.professional_id IS
DISTINCT FROM auth.uid()`) que rechazaría cualquier ejercicio de catálogo.
Sin arreglarla, el catálogo quedaría navegable pero inutilizable en la
práctica — se corrige en la Migración B.

---

## 1. Migraciones (las corre Jose manualmente — nunca vía MCP/CLI en este proyecto)

### Migración A — columnas + índices + policy nueva
`supabase/migrations/20260823100000_exercise_library_catalog_columns.sql`

```sql
ALTER TABLE exercise_library
  ADD COLUMN catalog_region text,
  ADD COLUMN catalog_subcategory text,
  ADD COLUMN source_exercise_id integer;

CREATE UNIQUE INDEX exercise_library_source_exercise_id_key
  ON exercise_library (source_exercise_id)
  WHERE source_exercise_id IS NOT NULL;

CREATE INDEX idx_exercise_library_catalog_region
  ON exercise_library (catalog_region)
  WHERE professional_id IS NULL;

CREATE INDEX idx_exercise_library_professional_id_null
  ON exercise_library (professional_id)
  WHERE professional_id IS NULL;

CREATE POLICY "catalogo global visible para todos los profesionales"
  ON exercise_library FOR SELECT
  TO authenticated
  USING (professional_id IS NULL);
```

`source_exercise_id` (el ID numérico de HEP2go) permite reimportar el
catálogo más adelante con `ON CONFLICT ... DO UPDATE` si la planilla se
actualiza, sin duplicar filas. La policy nueva es **aditiva** (no toca la
policy de SELECT/INSERT/UPDATE/DELETE existente, que es desconocida
porque la tabla es anterior a las migraciones versionadas) — Postgres
combina policies permisivas del mismo comando con OR, y el patrón de
"multiple permissive policies" ya está documentado como aceptado en
`20260716010000_rls_initplan_and_fk_indexes.sql:52-55`. Las policies de
INSERT/UPDATE/DELETE existentes siguen exigiendo `professional_id =
auth.uid()`, lo que ya bloquea naturalmente editar/borrar filas con
`professional_id = NULL`.

**Antes de correr esta migración**, Jose debería correr esto para
confirmar que no hay ninguna policy de UPDATE/DELETE rara (ej.
`USING (true)`) que exponga las filas de catálogo a edición:
```sql
select policyname, cmd, qual, with_check from pg_policies where tablename = 'exercise_library';
select policyname, cmd, qual, with_check from pg_policies where tablename = 'treatment_plan_exercises';
```

### Migración B — fix del RPC que bloquea ejercicios de catálogo
`supabase/migrations/20260823110000_add_routine_to_exercise_plan_allow_catalog.sql`

`CREATE OR REPLACE FUNCTION add_routine_to_exercise_plan(...)` con el
mismo cuerpo que `20260811110000_exercise_plans_program_id_rpc.sql`,
cambiando solo el chequeo de ownership de los ejercicios:

```sql
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    JOIN exercise_library el ON el.id = (item->>'exercise_id')::uuid
    WHERE el.professional_id IS NOT NULL
      AND el.professional_id IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'one or more exercises do not belong to the caller';
  END IF;
```

Mismo signature (7 args) → no hace falta `DROP FUNCTION`. Se repiten los
`REVOKE`/`GRANT` finales (idempotentes).

### Migración C — carga de los 2928 ejercicios
`supabase/migrations/20260823120000_exercise_library_catalog_seed.sql`

Generada por un script Python (`openpyxl`, ya validado en esta sesión —
0 IDs duplicados/faltantes) que lee el Excel y escribe INSERTs batcheados
(~500 filas por statement) en un único archivo de migración:

```sql
INSERT INTO exercise_library
  (name, professional_id, is_active, exercise_type, catalog_region, catalog_subcategory, instructions, source_exercise_id)
VALUES (...)
ON CONFLICT (source_exercise_id) DO UPDATE SET
  name = EXCLUDED.name, exercise_type = EXCLUDED.exercise_type,
  catalog_region = EXCLUDED.catalog_region, catalog_subcategory = EXCLUDED.catalog_subcategory,
  instructions = EXCLUDED.instructions, updated_at = now();
```

Mapeo de columnas:
- `exercise_type` ← `Clasificación` separada por `"; "`, cada token
  mapeado a slug (`Activo→activo`, `Activo asistido→activo_asistido`,
  `Fortalecimiento→fortalecimiento`, `Pasivo→pasivo`, `Sin
  clasificar→sin_clasificar`) y re-unida con `"; "`.
- `catalog_region` ← `Región` tal cual (uno de los 9 valores fijos).
- `catalog_subcategory` ← `Subcategoría` tal cual, `NULL` si vacía (715
  filas).
- `instructions` ← `Instrucciones`, comillas simples escapadas.
- `source_exercise_id` ← `ID` de HEP2go.
- No se importan: `URL de la imagen`, `Enlace al editor`, `Criterio
  aplicado` (decisión ya tomada / bajo valor).

Después de aplicar A+B+C, regenerar `src/integrations/supabase/types.ts`
(vía Supabase MCP `generate_typescript_types`, que sí está permitido —
solo lectura de schema) **antes** de tocar cualquier `.tsx`, para que
`Tables<"exercise_library">` incluya las columnas nuevas.

---

## 2. Frontend

### `src/components/exercises/exerciseLibrary.ts` — fuente única de verdad
- `EXERCISE_TYPES`: agregar `pasivo` y `sin_clasificar` (mismo shape que
  los 3 actuales).
- `CATALOG_REGIONS`: array nuevo con los 9 nombres fijos, en el orden de
  la planilla (Cervical, Hombro, Codo y mano, Lumbar y torácica, Cadera y
  rodilla, Tobillo y pie, Motricidad oral, Especiales, Educación).
- `getExerciseTypes(value)`: versión plural de `getExerciseType`, separa
  por `"; "` y devuelve todos los tipos que matchean (para renderizar
  varios badges en los ~125 ejercicios con clasificación combinada).
- `matchesExerciseType(value, filter)`: reemplaza el `===` exacto usado
  hoy para filtrar/contar — separa por `"; "` e incluye el legacy `!value
  → true` que ya existe.

### `src/pages/Exercises.tsx` — toggle de fuente + sidebar de catálogo
- Nuevo estado: `source: "propios" | "catalogo"`, `catalogExercises`,
  `catalogLoaded` (fetch perezoso: solo se piden los 2928 ejercicios la
  primera vez que se abre "Catálogo", no en cada visita a la página).
- Toggle "Mis ejercicios" / "Catálogo" junto a la búsqueda (dentro de la
  pestaña Ejercicios, sin tocar Planes/Programas).
- Sidebar condicional por `source`: `ApartadosPanel` (sin cambios) para
  "Mis ejercicios", `CatalogRegionPanel` nuevo (solo lectura, 9 regiones
  fijas + "Todas") para "Catálogo".
- Filtro de Subcategoría: pills debajo del filtro de tipo, calculadas de
  `catalogExercises` para la región elegida (incluye "Sin subcategoría"
  para las filas sin valor), mismo patrón visual que las pills de tipo
  actuales.
- `filtered`/`typeCount` pasan a usar `matchesExerciseType` en vez de
  `===`.
- `ExerciseRow`/`ExerciseDetailDialog`: pasar `onEdit`/`onDelete` como
  `undefined` cuando `ex.professional_id === null` (fila de catálogo).
- `handleDelete`: guard extra al principio que rechaza borrar una fila
  con `professional_id === null` (defensa en profundidad, aunque la UI ya
  no debería ofrecer el botón).
- El contador de la pestaña "Ejercicios" (badge numérico) se mantiene
  igual a `exercises.length` (solo propios), independiente de `source`,
  para no mostrar +2928 de golpe.

### `src/components/exercises/CatalogRegionPanel.tsx` (nuevo)
Modelado en `ApartadosPanel.tsx` pero de solo lectura (sin crear/renombrar
/borrar) — la taxonomía de 9 regiones es fija.

### `src/components/exercises/ExerciseRow.tsx`
`onEdit`/`onDelete` pasan a ser opcionales; el `DropdownMenuItem` de
"Editar" y el de "Eliminar" (+ separador) solo se renderizan si la prop
correspondiente está definida.

### `src/components/exercises/ExerciseDetailDialog.tsx` y `ExercisePdfExport.tsx`
Cambiar de `getExerciseType` (singular) a `getExerciseTypes` (plural) para
renderizar todos los badges de un ejercicio con clasificación combinada.

### Selectores de ejercicio en Planes/Pacientes (deben poder usar catálogo)
Mismo patrón en los 4 archivos siguientes:
- `src/components/exercises/plans/PlanItemFormDialog.tsx`
- `src/components/patients/EjerciciosTab.tsx`
- `src/components/patients/ApplyRoutineWizard.tsx`
- `src/components/patients/dialogs/PlanDialogs.tsx` (2 queries)

Cambios:
1. Ampliar `.eq("professional_id", userId)` a
   `.or(\`professional_id.eq.${userId},professional_id.is.null\`)` para
   que el catálogo aparezca como opción al armar un Plan/Programa o
   aplicarlo a un paciente.
2. Donde el filtro de tipo hace `.eq("exercise_type", tipoFilter)`
   (`PlanItemFormDialog`, `EjerciciosTab`), reemplazar por un `.or()` de 3
   cláusulas que matchee valor exacto, valor al inicio de una lista
   combinada, o valor al final — para no perderse los ejercicios con
   clasificación combinada ni hacer falsos positivos por substring (ej.
   que "activo" matchee "activo_asistido").
3. Donde se renderiza el badge de tipo (`TYPE_BADGE[exercise_type]` en
   los 4 archivos + `PlanItemsPanel.tsx` + `PlanPublicPage.tsx`), pasar a
   `getExerciseTypes(...)` y renderizar un badge por token.
4. Opcional recomendado: un badge chico "Catálogo" en las filas de estos
   selectores, para distinguir visualmente un resultado propio de uno del
   catálogo cuando aparecen mezclados en la misma búsqueda.

`ApartadosPanel.tsx` no necesita cambios (su única query cuenta por
`body_region_id`, que las filas de catálogo nunca tienen).

---

## 3. Verificación

1. Jose corre las 3 migraciones en orden (A, B, C) contra el proyecto
   real, después de correr las 2 queries de chequeo de RLS de la sección
   1.
2. Regenerar `types.ts` contra el schema real (Supabase MCP,
   `generate_typescript_types` — solo lectura).
3. Verificación end-to-end en el navegador con Playwright headless contra
   el Supabase real (mismo patrón que sesiones anteriores, usuario de
   test `rls-test-a@example.com`):
   - Pestaña Ejercicios → toggle "Catálogo" → aparecen las 9 regiones con
     conteos, elegir una región → aparecen subcategorías → elegir tipo
     "Pasivo" y "Sin clasificar" → filtran correctamente.
   - Un ejercicio de catálogo no muestra botones Editar/Eliminar en el
     menú de acciones.
   - Armar un Plan nuevo agregando al menos un ejercicio del catálogo
     (`PlanItemFormDialog`) — se guarda y se lista bien en
     `PlanItemsPanel`.
   - Aplicar ese Plan a un paciente de prueba con `ApplyRoutineWizard` —
     confirma que la Migración B soluciona el bloqueo del RPC (este es el
     paso que fallaba sin el fix).
   - Link público del paciente (`PlanPublicPage`) muestra el ejercicio de
     catálogo con su badge de clasificación correcto.
   - 0 errores de consola en todo el flujo.
   - Limpiar los datos de prueba creados (Plan, aplicación al paciente) al
     final, sin tocar las 2928 filas de catálogo.
4. `npm run typecheck`, `npm run lint` (techo actual 239 warnings) y
   `npm run build` en verde.
