# Migraciones pendientes (2026-10-28)

A diferencia de `supabase/migrations_archive/` (archivos ya aplicados en
producción, cuyo efecto el baseline captura), lo que vive acá **nunca se
aplicó en ningún lado** y tiene un bug real que lo bloquea — no es cuestión
de timing ni de orden.

## `20261011210300_exercise_library_catalog_seed.sql`

Parte del catálogo global HEP2go (`docs/PLAN_catalogo_ejercicios_hep2go.md`,
pausado). Encontrado al armar `rehabot-staging` (ver `docs/DECISIONS.md`
2026-10-28) y correr `supabase db push` contra un proyecto real por primera
vez: el seed generado por `scripts/generate_catalog_seed.py` escribe valores
de `exercise_type` (`'pasivo'`, `'sin_clasificar'`, combinaciones tipo
`'activo_asistido; fortalecimiento'`) que **no están permitidos** por
`exercise_library_exercise_type_check` (solo acepta `'activo'` /
`'activo_asistido'` / `'fortalecimiento'`, ver
`supabase/migrations/20261011210000_baseline_schema.sql`). El bug de
`ON CONFLICT` que sí se pudo arreglar mecánicamente (el índice es parcial,
el `ON CONFLICT` necesitaba repetir el `WHERE`) ya está corregido acá y en
el generador — este archivo queda con ESE fix aplicado, pero sigue sin poder
correr por el choque de `exercise_type`.

Arreglar esto a fondo es una decisión de producto, no un fix mecánico: hay
que decidir si el CHECK se amplía para aceptar la taxonomía completa de
HEP2go, o si el generador remapea sus categorías a las 3 que ya existen —
exactamente el tipo de decisión que `docs/TASKS.md` ya marca como pendiente
("decidir con Jose cómo se integra el catálogo"). Mientras tanto, esta
migración queda **fuera** de `supabase/migrations/` para que `supabase db
push` (local, staging o producción) no se rompa contra ella en cada corrida
del pipeline de CI/CD. `20261011210100`/`210200` (columnas nuevas +
la función que las usa) sí quedan activas — son aditivas, no rompen nada
estando aplicadas sin el seed.

Para retomar: mover el archivo de vuelta a `supabase/migrations/` una vez
resuelto el mapeo de `exercise_type`.
