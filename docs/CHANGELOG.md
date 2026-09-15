# CHANGELOG — HisTO

> Log cronológico simple. Una entrada por sesión de trabajo, 2-4 líneas.
> No es para detalle técnico profundo (para eso están los commits) — es para
> poder responder en 10 segundos "¿qué pasó la semana pasada?" sin tener que
> releer código.

Formato: `## [YYYY-MM-DD] Título corto`

---

## [2026-09-15] Card vacía de Perfil ocupacional + últimos ~16 sitios de queries sin chequear error
- Perfil ocupacional ya no deja una card vacía en la Ficha: `SessionForm.tsx` no inserta la fila si el usuario no tocó el paso (antes lo hacía con todos los campos en `null`), y `FichaTab.tsx` no muestra la card salvo que tenga algún dato cargado.
- Cerrados los ~16 sitios de menor riesgo que quedaban del hallazgo de "queries sin chequear error": autocompletes (CIE-10, obras sociales) con `console.error` sin toast, prefills de sesión/episodio igual, y dos casos de riesgo real — `NewEpisodeDialog.tsx` (crear episodio podía quedar sin diagnósticos guardados mostrando éxito) y `PlanDialogs.tsx` (un plan de tratamiento podía guardarse "correctamente" con 0 ejercicios) — ahora avisan en vez de fallar en silencio.
- Al verificar en el navegador se encontró que el diálogo de "Plan de tratamiento" (`PlanDialogs.tsx`, tabla `treatment_plans`) es código muerto — no hay ningún botón en la UI actual que lo abra, quedó huérfano del viejo flujo reemplazado por Ejercicio→Plan→Programa. Anotado en `TASKS.md` para decidir si se borra.
- Verificado de punta a punta en el navegador contra Supabase real con un paciente de prueba (admisión sin perfil ocupacional → sin card ni fila en DB; sesión editada completando el paso → card aparece; nuevo episodio con diagnóstico → guardado correcto en `episode_diagnoses`) — 0 errores de consola, dato de prueba borrado al final. Typecheck, lint (235, bajo el techo de 239) y build OK.

## [2026-09-15] QA completa de la app + fix de queries con error silencioso
- Pasada de QA manual de toda la app (todas las rutas, alta de paciente, wizard de sesión completo, evaluaciones, turnos, ejercicios, admin) — 0 errores de consola en todo el recorrido. Único hallazgo real: `patient_occupational_profiles` inserta una fila vacía al completar el wizard de Admisión aunque no se toque ese paso, dejando una card en blanco en la Ficha (anotado en `TASKS.md`, no arreglado todavía).
- Se retomó el hallazgo de julio "14 queries ignoran el error de Supabase en silencio" — el código creció desde entonces (hoy ~30 sitios), así que se priorizaron los de mayor impacto real en vez de arreglar todos a ciegas: `fetchEpisodeDiagnoses` (podía borrar diagnósticos reales en un guardado si la carga fallaba en silencio), la carga principal de la ficha del paciente (~11 queries en un solo fetch), el PDF del plan de ejercicios (se generaba "exitosamente" pero vacío), la consulta de turnos ocupados del día (riesgo de doble turno), y varias vistas/contextos/hooks más. Quedan ~16 sitios de menor riesgo sin tocar, documentados en `TASKS.md`.
- Verificado en el navegador contra Supabase real que el camino feliz de cada archivo tocado sigue funcionando (Dashboard, ficha de paciente con diagnósticos reales, Editar ficha, Nuevo turno, Biblioteca de ejercicios, edición de sesión existente) — 0 errores de consola. Typecheck, lint (239, en el techo) y build OK.

## [2026-09-15] Barthel con todas las opciones visibles + Evaluación analítica en acordeón
- Índice de Barthel: cada ítem reemplaza el `<select>` oculto por botones con todas las opciones visibles, mismo patrón que el checklist de Ocupaciones pero adaptado a la cantidad variable de opciones (2-4) por ítem. FIM queda como select por ahora — 7 opciones con etiquetas largas × 18 ítems se vería muy cargado como botones (candidato en `TASKS.md` con una idea de diseño más compacta).
- Evaluación analítica: las 8 sub-secciones (Dolor, Edema, Movilidad, Fuerza muscular, Sensibilidad, Cicatriz, Pruebas específicas, Otros) dejan de "activarse" con un switch y pasan a ser un acordeón siempre visible, colapsado por defecto — mismo patrón que Evaluación funcional. Se verificó que los switches viejos no afectaban qué se guardaba (solo la UI), así que el cambio no tocó el guardado de datos. `sections_config` queda deprecada sin borrar.
- Sin migración SQL. Verificado de punta a punta en el navegador contra Supabase real (Barthel con puntaje en vivo, las 8 secciones de analítica cargando y persistiendo datos, reapertura de sesión) — 0 errores de consola. Typecheck, lint (235, bajó del techo de 239) y build OK.

---

## [2026-09-15] Perfil ocupacional recortado a 5 campos + Evaluación funcional en 5 apartados (AOTA/MOHO)
- Perfil ocupacional (Ficha del paciente y sesión de Admisión) recortado a dominancia, estado civil, nivel educativo, trabajo y red de apoyo — se sacó situación laboral, educación (detalle), ocio, actividad física, sueño y descanso, gestión de la salud y notas.
- Evaluación funcional rediseñada por completo: reemplaza los textareas libres de AVD/AIVD por un checklist estructurado de 47 ítems en 9 categorías (AVD, AIVD, Gestión de la salud, Descanso y sueño, Educación, Trabajo, Juego, Ocio, Participación social), cada uno calificable independiente/requiere asistencia/dependiente, más 4 apartados de texto libre nuevos (Contextos, Patrones de desempeño, Habilidades de desempeño, Factores del cliente). Barthel y FIM se mantienen sin cambios, como sección aparte. Sigue apareciendo en cada sesión (admisión y seguimiento), decisión confirmada con Jose.
- 2 migraciones aplicadas contra Supabase (sin columnas nuevas para Perfil ocupacional; 14 columnas nuevas en `functional_evaluations` para la nueva estructura). `types.ts` regenerado. Se corrigió de paso un bug donde el paso "Eval. funcional" escribía AVD/AIVD también en la tabla de Perfil ocupacional.
- Verificado de punta a punta en el navegador contra Supabase real: sesión de Admisión completa con el checklist de Ocupaciones y los 4 apartados nuevos, vista de detalle de la evaluación mostrando la nueva estructura, y reapertura de la sesión confirmando que los datos se recargan bien. 0 errores de consola. Typecheck, lint (239, en el techo) y build OK.
- 2 PRs: Perfil ocupacional (chico, sin migración) y Evaluación funcional (grande, con migración). Ver `docs/DECISIONS.md` para las decisiones de alcance confirmadas con Jose antes de implementar.

## [2026-09-15] Pacientes: nacionalidad obligatoria, Sexo, contacto de emergencia separado, alergias
- Cuatro cambios en el alta (y ficha) de paciente: nacionalidad obligatoria al dar de alta (y ahora editable desde la ficha, corrige un bug donde no se podía); "Género" renombrado a "Sexo" con masculino/femenino/no binario, opciones centralizadas en `sexOptions.ts` (antes duplicadas 3 veces); contacto de emergencia separado en nombre y apellido; campo de alergias (texto libre) nuevo en alta y ficha.
- 3 migraciones aplicadas contra Supabase: normalización de valores sucios de género (`M`/`F` → `male`/`female`, 6 pacientes), columna `allergies`, columnas `emergency_contact_first_name`/`last_name` con backfill automático de los 7 pacientes con contacto de emergencia cargado (split por primera palabra). `types.ts` regenerado.
- Verificado de punta a punta en el navegador contra Supabase real: alta de paciente con nacionalidad obligatoria (falla sin ella), sexo "No binario", contacto de emergencia y alergias — todo persiste y se ve bien en la ficha; edición de un paciente existente confirma la migración de datos. 0 errores de consola. Typecheck, lint (239, en el techo) y build OK. Dato de prueba creado durante la verificación, borrado al final.
- Se pausó el catálogo de ejercicios HEP2go para priorizar este pedido (ver PROJECT_STATE.md).

## [2026-08-11] Ejercicios: se corrige el rediseño — Ejercicio → Plan → Programa (3 pestañas)
- Feedback del usuario: el rediseño del 08-10 no era lo pedido. Biblioteca de Ejercicios reordenada en 3 pestañas de primer nivel: Ejercicios (con filtro por Activo/Activo asistido/Fortalecimiento en vez de sub-pestañas), Planes (renombre de "Rutina", solo texto/UI) y Programas (nuevo nivel reutilizable que agrupa varios Planes, sin Bloques ni Prescripciones). El wizard de aplicar a un paciente ahora deja elegir entre un Plan o un Programa completo. El "programa del paciente" (antes "plan del paciente") se relabeleó para no colisionar con el nuevo "Plan" reutilizable. 2 migraciones nuevas (`exercise_programs`/`exercise_program_routines`, `exercise_plans.program_id` + RPC extendido) escritas y listas — **pendientes de que Jose las corra**. Typecheck/lint/build OK; verificado en el navegador contra Supabase real que la Biblioteca funciona y degrada bien (sin romper la página) hasta que se apliquen las migraciones.
- Decisión tomada: se revierte parcialmente la decisión del 08-10 — "Programa" pasa a ser también reutilizable, no solo instancia única por paciente (ver DECISIONS.md).
- Sin commitear todavía (no se pidió explícitamente en la sesión).

## [2026-08-10] Ejercicios: Rutinas reutilizables + Programa con fecha/duración
- Se cerró: nivel intermedio "Rutina" (tab nueva en Biblioteca de Ejercicios, CRUD completo) entre el Ejercicio y el Programa del paciente. Wizard de 3 pasos ("Aplicar rutina") en la ficha del paciente para armar el plan a partir de una rutina, con cantidades editables sin tocar la plantilla y programación (fecha de inicio + duración en semanas). Link público del paciente actualizado para mostrar la programación. Guard de borrado de ejercicios extendido para rutinas. 4 migraciones (`exercise_routines`/`exercise_routine_items`, columnas de programa + `UNIQUE(patient_id)` en `exercise_plans`, RPC `add_routine_to_exercise_plan`, `get_exercise_plan_public` con fecha/duración) aplicadas y verificadas en el navegador de punta a punta.
- Decisión tomada: Programa como instancia única por paciente, no biblioteca reutilizable de programas (ver DECISIONS.md).
- Para la próxima: candidato chico anotado — `exercise_plan_tokens.patient_id` sin `ON DELETE CASCADE` (inconsistente con `plan_id`, no urgente porque no hay borrado duro de pacientes desde la UI).

## [2026-07-15] Ejemplo de formato
- Se cerró: ...
- Se pausó: ... (motivo: ...)
- Decisión tomada: ... (ver DECISIONS.md si aplica)
- Para la próxima: ...

## [2026-07-17] Admisión, diagnósticos múltiples, alta/abandono y perfil ocupacional
- Se cerró: checkbox "No posee obra social" en alta y edición (campo unificado con autocomplete); diagnósticos múltiples por episodio (tabla `episode_diagnoses` + backfill, editor en los 4 formularios); botón "Dar de alta" directo y "Marcar abandono" con nuevo estado `abandoned` (fecha + motivo + reactivar); situación laboral, estado civil y nivel educativo como selects estandarizados.
- Decisión tomada: los diagnósticos viven en `episode_diagnoses` pero el principal se sigue escribiendo en las columnas legacy (ver DECISIONS.md).
- Suite RLS ampliada a 16 tests (aislamiento de `episode_diagnoses`); lint quedó en el techo (239).

## [2026-07-16] Registro solo por invitación
- Se cerró: el signup abierto — `handle_new_user` ahora rechaza altas sin invitación (nativa o de equipo). Los flujos `/registro` y `/accept-invite` siguen andando. Verificado contra la API + test de regresión (suite RLS: 13 tests).
- Decisión tomada: guard en el trigger en vez del toggle del dashboard, para no romper el flujo de invitación de equipos que usa signUp (ver DECISIONS.md).

## [2026-07-16] CI + tests de RLS
- Se cerró: CI con GitHub Actions (lint con techo de 260 warnings + typecheck + tests + build en cada push/PR — antes nada validaba lo que llegaba a producción). Para destrabarlo, no-explicit-any pasó a warning y se arreglaron los 4 errores reales de lint.
- Se cerró: suite de 12 tests de RLS contra el Supabase real — un profesional no puede acceder a pacientes/sesiones/fichas de otro; corren en CI.
- Hallazgo anotado en TASKS: el registro está abierto (signUp sin invitación crea perfil de profesional activo) — decidir si se cierra.
- Para la próxima: pendientes del informe cargados en TASKS (Sentry, e2e, deuda de lint, performance de DB).

## [2026-07-15] Hardening de seguridad + fix de URLs de auth
- Se cerró: revisión completa del proyecto (código + advisors de Supabase) y fix de todas las urgentes de seguridad — REVOKE de funciones RPC expuestas a anon, trigger functions no invocables, search_path fijo, bucket avatars sin listado público, `.env` fuera de git, mínimo de contraseña a 8.
- Se cerró: fix de recuperación de contraseña — el Site URL de Supabase estaba en el default `localhost:3000` y el dominio de producción no estaba en la allowlist de redirects; configurado en el dashboard.
- Quedó pendiente: "Prevent leaked passwords" requiere plan Pro (ver TASKS.md); verificar min length 8 server-side.
- Para la próxima: queda el informe de mejoras no urgentes (tests de RLS, CI, monitoreo, lint) sin cargar al backlog.

## [2026-07-15] Módulo Perfil completo
- Se cerró: módulo Perfil en `/profile` — datos personales, foto de avatar (con compresión client-side porque las fotos de cámara superaban el límite del bucket), cambio de contraseña y de email.
- Decisión tomada: bucket `avatars` público + sync de email client-side sin trigger (ver DECISIONS.md).
- Quedó pendiente: probar el flujo completo de cambio de email (ver TASKS.md).
- Para la próxima: el asistente de IA (RAG) quedó como candidata en TASKS.md esperando el PDF fuente.

## [2026-07-15] Fix spinner infinito + setup de tracking del proyecto
- Se cerró: fix del spinner infinito en `/` para usuarios sin sesión (`AppLayout` esperaba a `useIsAdmin` aunque no hubiera `session`).
- Se cerró: setup del sistema de tracking (`docs/PROJECT_STATE.md`, `TASKS.md`, `DECISIONS.md`, este changelog) + reglas de flujo de trabajo en `CLAUDE.md`.
- Decisión tomada: ninguna nueva (no trivial) esta sesión.
- Para la próxima: definir qué tarea pasa a "En progreso" en `PROJECT_STATE.md` — no hay nada activo elegido todavía.
