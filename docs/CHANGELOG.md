# CHANGELOG — HisTO

> Log cronológico simple. Una entrada por sesión de trabajo, 2-4 líneas.
> No es para detalle técnico profundo (para eso están los commits) — es para
> poder responder en 10 segundos "¿qué pasó la semana pasada?" sin tener que
> releer código.

Formato: `## [YYYY-MM-DD] Título corto`

---

## [2026-10-08] QA del alta de pacientes y de obras sociales + arreglos (PRs #62 y #63 abiertos)
- Alta de pacientes: el guardado de diagnósticos y de la ficha clínica no chequeaba el error (mostraba éxito aunque fallara). Ahora avisa con un error claro y lleva igual a la ficha. PR [#62](https://github.com/JoseRuarte04/ProyecTo/pull/62).
- Obras sociales: renombrar una en uso actualiza a los pacientes, borrar una en uso se frena en la base, "OSDE " y "Galenó" ya no entran como duplicados, y el alta/edición valida contra el catálogo. Requiere aplicar la migración `20261008120000` al mergear. PR [#63](https://github.com/JoseRuarte04/ProyecTo/pull/63).

## [2026-10-08] Perfil fusionado dentro de Configuraciones, en sub-apartados separados
- "Perfil" deja de ser una página aparte: datos personales, cambio de email y cambio de contraseña ahora son 3 sub-apartados de `/configuraciones` ("Mi cuenta"), junto a Evaluaciones/Turnos ("Equipo"). `/profile` redirige a `/configuraciones/general`.
- De paso corrige un gap: "Configuraciones" ahora es siempre visible en el sidebar y en el bottom nav mobile (antes un miembro de equipo no-admin no podía ni llegar a su propia cuenta).
- PR [#59](https://github.com/JoseRuarte04/ProyecTo/pull/59), abierto y pendiente de review.

## [2026-10-08] Prep de beta: los 6 PRs mergeados + drill de restauración real confirmado
- Jose mergeó los 6 PRs de la prep de beta. CI de `main` en verde en el estado final.
- Drill de restauración contra el dump real de producción (no sintético): `supabase init` + `supabase start` fuera del repo, restauró datos reales y confirmó el criterio completo — login real + pacientes vía RLS + archivo descargado con hash idéntico al original. Todo el material real se borró al terminar.
- Corregido en el camino: el connection string para el backup tiene que ser el Session pooler (`postgres.<ref>`), no "Direct connection" — GitHub Actions es IPv4-only.

## [2026-10-06] Prep de beta cerrada: privacidad, feedback, backups, seguridad
- Passwords de `rls-test-a/b` rotadas (ya no son las que estuvieron expuestas). Auditoría de `profile_role`: sin escalada de privilegios posible.
- 5 PRs listos con CI real en verde, esperando revisión de Jose: `RESEND_FROM` configurable (#52), política de privacidad + consentimiento obligatorio + gate (#53), feedback + Vercel Analytics + banner de beta (#54), backups semanales encriptados de base y Storage (#55), checklist manual de beta (#56).
- Hallazgo en el camino: `supabase start` no levanta de cero **dentro del repo** con el historial de migraciones actual (ver `TASKS.md`) — no bloquea la restauración real de un backup (confirmado el 2026-10-08, el drill usa un `supabase init` aparte), pero sigue haciendo falta arreglarlo para desarrollo local normal.

## [2026-10-06] Seguridad: passwords de usuarios de prueba fuera del código
- Las passwords de `rls-test-a/b@example.com` estaban en texto plano desde julio en un repo público (`src/test/rls.test.ts` y `e2e/supabaseTestClient.ts`) — cualquiera podía loguearse como esas cuentas en producción.
- Pasan a GitHub Secrets / `.env` local (PRs #51 y #43). Falta que Jose rote las passwords reales en el dashboard de Supabase — la exposición pasada no se revierte sacándolas del código.

## [2026-10-06] Capas de DevOps pendientes: CI gate, e2e en CI, Speed Insights
- Branch protection de `main` ahora exige que `ci` pase antes de mergear; regla de trazabilidad PR↔tarea escrita en `TASKS.md`; PR #1 (Speed Insights) y PR #43 (piloto e2e, sumado a `ci.yml` como job no bloqueante) rebaseados y verificados en CI real.
- IaC (`supabase config.toml`) pausada — el CLI no tiene `config pull`. Docker descartado (ver `DECISIONS.md`). PR #43 queda para que Jose lo revise y mergee (bloqueado por el clasificador de permisos, no por CI).

## [2026-10-02] Sesiones: quitar "Nueva sesión" del Dashboard, renombrar a "Evolución"
- Dashboard: se elimina el botón "Nueva sesión" (solo llevaba a elegir paciente).
- Ficha del paciente y pestaña Sesiones: el botón "Nueva sesión" pasa a llamarse "Evolución" (alinea el nombre con el paso del wizard). Solo texto, sin cambios de lógica ni migraciones. PR [#29](https://github.com/JoseRuarte04/ProyecTo/pull/29).

## [2026-10-01] Turnos: botón + para alta rápida de paciente desde "Nuevo turno"
- En el diálogo "Nuevo turno", un botón "+" junto al buscador de paciente abre el alta (`/patients/new`) sin salir del flujo de turnos. Visible solo mientras no hay paciente seleccionado. PR [#27](https://github.com/JoseRuarte04/ProyecTo/pull/27).

## [2026-10-01] Turnos: estados, advertencia por ausencias y semáforo de prioridades
- Estados nuevos de turno (sala de espera, ausente, ausente con aviso) con colores y selector de estado; los "No asistió" viejos pasan a "Ausente".
- Configuraciones > Turnos: máximo de ausencias por paciente (advierte al agendar, no bloquea) y semáforo de prioridades por patologia (rojo/amarillo/verde), visible en la lista de Turnos y en "Nuevo turno". 2 migraciones nuevas (`appointment_settings`, `priority_pathologies`), personal o de equipo. PR [#28](https://github.com/JoseRuarte04/ProyecTo/pull/28).

## [2026-09-30] Ajustes de alta, perfil ocupacional y wizard de sesión (PR #25)
- 6 cambios pedidos por Jose: nombre preferido en el alta, reorden de Perfil ocupacional, Dolor "EVA"→"END", título + Barthel/FIM/QuickDASH agrupados al final de Eval. funcional, renombrado Intervenciones→Evolución con campo Objetivo nuevo (se elimina el step Evolución viejo), y QuickDASH integrado al wizard pasando de ser por episodio a ser por sesión.
- 3 migraciones aplicadas contra Supabase real. Verificado de punta a punta en el navegador con el usuario de prueba, incluyendo el flujo completo del link de QuickDASH simulando al paciente.
- Sumado después: menú "..." en el historial de sesiones para generar el link de QuickDASH sin entrar a editar.
- PR: [#25](https://github.com/JoseRuarte04/ProyecTo/pull/25) (mergeado, deploy a producción verificado).

## [2026-09-30] Merge de los 3 PRs abiertos de Javito (#22, #23, #24) + blindaje de migración
- Analizados #22/#23/#24 con `gh` y Supabase real — sin el problema grave de septiembre (ramas apiladas/duplicados), solo un choque menor: #22 y #23 arreglaron el mismo bug de overflow (`min-w-0`) en paralelo sin saberlo (dos sesiones corriendo la misma noche).
- Mergeados en orden #22 → #23 → #24. Antes de mergear #24 se blindó `20260923100000_evaluation_settings.sql`: el trigger y las 2 policies no tenían guard de idempotencia (solo la tabla y el índice) — se agregó `DROP TRIGGER/POLICY IF EXISTS` antes de cada `CREATE`, confirmado 1:1 contra los nombres reales en producción.
- Typecheck/lint/build verificados en cada rama antes de mergear, CI verde en los 3. Ver `DECISIONS.md`.

## [2026-09-23] Obras sociales: alta desde "Administrar" + fix de overflow
- El diálogo "Administrar" solo tenía editar/borrar — se agregó un botón "Agregar" con formulario inline, mismo patrón que editar.
- Corregido bug visual reportado: el diálogo desbordaba horizontalmente (grid blowout por texto largo sin truncar bien) y tapaba los botones de editar/borrar — fix con `min-w-0` en el contenedor de la lista.
- Se confirmó que el guard de borrado contra obras sociales en uso ya funcionaba bien, no requería cambios. PR [#22](https://github.com/JoseRuarte04/ProyecTo/pull/22).

## [2026-09-23] Mobile: barra de navegación inferior + listados/tabs responsive
- El sidebar en mobile pasa de hamburger + drawer a una barra inferior fija (`AppBottomNav.tsx`); "Más" agrupa perfil, workspace, Mi equipo y logout.
- Corregidos dos overflows de página completa a 375px (listado de Pacientes, tabs de ficha) y el wrap de campos largos en Ficha Clínica.
- Fila de acciones del Dashboard y vista por defecto de Turnos ajustadas a mobile. PR [#23](https://github.com/JoseRuarte04/ProyecTo/pull/23).

## [2026-09-23] Evaluaciones: activar/desactivar escalas por espacio de trabajo
- Tabla nueva `evaluation_settings` (RLS: personal por `auth.uid()`, equipo editable solo por admins) + página `/evaluaciones` y botón nuevo en el sidebar, para elegir qué escalas del wizard de sesiones se muestran (Barthel, FIM, Ocupaciones, Contexto de desempeño, y las 8 sub-secciones de Eval. analítica).
- El wizard oculta lo deshabilitado solo al crear una sesión nueva; al editar una ya guardada se muestra todo igual, porque no hay estado "borrador" server-side en este modelo. Ver `DECISIONS.md`.
- Migración blindada con `DROP TRIGGER/POLICY IF EXISTS` antes de mergear (ver entrada del 2026-09-30 más arriba).
- Verificado en el navegador contra Supabase real con el usuario de prueba RLS. PR [#24](https://github.com/JoseRuarte04/ProyecTo/pull/24).

## [2026-09-18] Obras sociales: editar y borrar desde el catálogo
- Nuevo diálogo `ObrasSocialesManager.tsx` (link "Administrar" en `InsuranceField`, visible en alta y Editar ficha): búsqueda, edición inline (nombre/nombre completo/tipo) y borrado.
- Borrado guardado con un RPC `SECURITY DEFINER` nuevo (`obra_social_usage_count`) en vez de un count desde el cliente, porque `patients` tiene RLS por profesional/equipo y el catálogo es compartido por todos — ver `DECISIONS.md`.
- 2 migraciones aplicadas (policies UPDATE/DELETE + el RPC) y `types.ts` regenerado. PR [#21](https://github.com/JoseRuarte04/ProyecTo/pull/21).

## [2026-09-18] Revisión, saneamiento y merge de los 6 PRs de Javito
- Revisión encontró dos ramas apiladas (#15→#16→#17) y dos pares de trabajo duplicado (#13/#17, #14/#18). Confirmado contra Supabase real que dos migraciones ya estaban aplicadas en producción sin commit mergeado — blindadas con `IF NOT EXISTS`/`DROP...IF EXISTS` antes de mergear. Ver `DECISIONS.md`.
- Rebaseadas #16 y #17 sobre `main` para que cada PR quedara solo con sus commits propios; agregado índice único case-insensitive en `obras_sociales.name` antes de mergear el alta de obra social nueva desde la UI.
- Mergeados en orden #15 → #16 → #17 → #14. Cerrados sin mergear #13 y #18 (superados). PR #19 nuevo para sincronizar el repo con datos que también ya estaban en producción.
- Auditoría completa de `PROJECT_STATE.md` contra GitHub y Supabase real: 7 desincronizaciones encontradas y corregidas.

## [2026-09-16] Editar ficha: botón al header + formulario recortado a los campos del alta
- El botón "Editar ficha" se movió de la pestaña Ficha Clínica a un ícono junto al nombre del paciente en el header de `PatientProfile.tsx`, visible desde cualquier pestaña.
- El diálogo se recortó a los mismos campos que pide el alta de paciente (datos personales, obra social/diagnósticos/médico/motivo/alergias, contacto, contacto de emergencia). Perfil ocupacional se saca del diálogo (se sigue editando en el paso de Admisión de la sesión). Los campos clínicos que sí tienen otra vía de edición (reabriendo la sesión de Admisión) se sacan sin pérdida; los 4 que no tenían ninguna otra vía (inicio de síntomas, tratamiento actual, próximo turno OyT, notas clínicas) se borran del formulario y de la vista de solo lectura — quedan deprecados. Ver `DECISIONS.md`.
- Verificado en el navegador contra Supabase real — 0 errores de consola. Typecheck y lint sin problemas nuevos.

## [2026-09-15] Borrado el código muerto de "Plan de tratamiento"
- Se confirmó en el navegador que el diálogo de "Plan de tratamiento" (anotado como candidato en la sesión anterior) era código muerto de punta a punta: ni el componente que lo abría (`PlanCardActions`) se usaba en ningún lado. Se borraron `src/components/patients/dialogs/PlanDialogs.tsx` y `src/components/plans/PlanPdfExport.tsx` enteros, y en `PatientProfile.tsx` el import, los 4 estados de diálogo y las 2 queries a `treatment_plans` que tampoco se mostraban en ningún lado.
- La tabla `treatment_plans`/`treatment_plan_exercises` queda en la base sin borrar (0 filas en producción) — `Exercises.tsx` todavía la usa como guard antes de borrar un ejercicio, así que no se puede tirar sin revisar eso primero.
- Verificado en el navegador (Ficha, Evolución y Ejercicios de un paciente real) — 0 errores de consola. Lint bajó de 235 a 207 (el archivo muerto tenía 19 `any`). Typecheck y build OK.

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
