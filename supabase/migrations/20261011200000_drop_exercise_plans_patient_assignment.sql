-- Se saca la asignación de rutinas de ejercicios a un paciente puntual
-- (tab "Ejercicios" de la ficha + wizard + link público /plan/:token):
-- se armó una vez y nunca se usó, y hoy solo confunde. La biblioteca
-- standalone de ejercicios (exercise_library, exercise_routines/_items,
-- exercise_programs/_routines, categorías) NO se toca — sigue viva en
-- /exercises, son plantillas del profesional sin patient_id.
--
-- Orden de DROP: funciones primero (dependen de las tablas), después
-- tablas de hijo a padre por las FKs.

DROP FUNCTION IF EXISTS get_exercise_plan_public(uuid);
DROP FUNCTION IF EXISTS get_exercise_plan_token(uuid);
DROP FUNCTION IF EXISTS create_exercise_plan_token(uuid, uuid, timestamptz);
DROP FUNCTION IF EXISTS add_routine_to_exercise_plan(uuid, uuid, jsonb, date, integer, text, uuid);

DROP TABLE IF EXISTS exercise_plan_tokens;
DROP TABLE IF EXISTS exercise_plan_items;
DROP TABLE IF EXISTS exercise_plans;
