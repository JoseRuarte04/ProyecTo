# TASKS — HisTO

> Backlog completo. A diferencia de PROJECT_STATE (que es "ahora"), acá va TODO
> lo que existe como idea o pendiente, tenga o no fecha.

**Convención de estado:**
- `[ ]` Todo — no arrancada
- `[~]` En progreso
- `[⏸]` Pausada (siempre con motivo entre paréntesis)
- `[x]` Hecha
- `[✗]` Descartada (con motivo — está bien matar ideas, pero que quede registrado por qué)

**Regla de oro:** no se abre una tarea nueva en `[~]` si ya hay otra en `[~]` sin
pasarla primero a `[⏸]` con motivo o a `[x]`. Si te agarrás haciendo esto, es la
señal de que estás cayendo en el patrón de siempre.

---

## 🏥 Módulo clínico
- [ ] Borrar la columna `patients.emergency_contact_name` (deprecada desde el 2026-09-15, reemplazada por `emergency_contact_first_name`/`last_name` con backfill ya aplicado) una vez confirmado en producción que todo anduvo bien con la separación nombre/apellido.
- [ ] Evaluar si `allergies` debería incluirse en el prompt del informe de alta generado por IA (`supabase/functions/generate-discharge-report/index.ts`) — relevante clínicamente, no se agregó en el 2026-09-15 porque no fue pedido explícitamente.
- [ ] `NewFuncEvalDialog.tsx` (creación standalone de evaluación funcional desde la pestaña "Evaluaciones") escribe una forma simplificada e incompatible de `functional_evaluations` (sin FIM, sin la nueva estructura de Ocupaciones/Contextos/Patrones/Habilidades/Factores del 2026-09-15) y esas filas no se pueden editar después — problema preexistente a ese cambio, encontrado al mapear duplicaciones del wizard de sesiones. Evaluar si conviene rehacer ese diálogo con la misma estructura del wizard o sacarlo y dirigir todo a través de una sesión.
- [ ] Columnas deprecadas en `functional_evaluations` desde el 2026-09-15 (`avd`, `aivd`, `sleep_rest`, `health_management`, `physical_activity`, `dominance`, subsumidas en `occupations_items`) — candidato de limpieza junto con `patient_occupational_profiles` (fila de arriba) y `emergency_contact_name`, una vez confirmado en producción.
- [ ] Perfil ocupacional se sigue editando en 2 lugares (Ficha del paciente y sesión de Admisión, mismos 5 campos desde el 2026-09-15) — duplicación de componentes conocida, mantenida a propósito por decisión de Jose. Revisar si conviene unificarla en algún momento.
- [x] Al completar el wizard de Admisión, `patient_occupational_profiles` insertaba una fila con todos los campos en `null` aunque el usuario nunca hubiera tocado el paso "Perfil ocupacional" — la card correspondiente en Ficha Clínica se veía como una caja blanca vacía. Cerrado 2026-09-15: `SessionForm.tsx` ya no inserta la fila si está todo vacío (si actualiza una fila existente, eso no cambió), y `FichaTab.tsx` no muestra la card salvo que tenga al menos un campo cargado (mismo patrón que "Datos clínicos" en el mismo archivo). Verificado en el navegador con un paciente de prueba: admisión sin tocar el paso → sin card ni fila en DB; luego se completó el paso en una edición de sesión → card aparece y la fila se guarda.
- [ ] FIM (18 ítems, escala 1-7) sigue usando el `<select>` oculto, a diferencia de Barthel que desde el 2026-09-15 muestra todas las opciones como botones — se descartó hacer lo mismo en FIM por tener etiquetas largas (ej. "Asistencia máxima (aporta 25% o más)") que se verían muy cargadas × 18 ítems. Si se retoma: una fila de 7 círculos numerados con la descripción completa solo en tooltip/al costado del seleccionado, en vez de repetir las 7 etiquetas largas en cada ítem.
- [ ] `analytical_evaluations.sections_config` queda deprecada desde el 2026-09-15 (Evaluación analítica pasó a acordeón, ya no hace falta recordar qué sub-sección estaba "activada") — candidato de limpieza junto con las otras columnas deprecadas anotadas arriba.

## 📅 Turnos / Agenda
- [⏸] **Recordatorios de turnos** (pausada 2026-07-16 — Jose priorizó otra cosa; el plan quedó completo y listo para ejecutar en **`docs/PLAN_recordatorios_turnos.md`**). Alcance ya decidido: email automático (cron + edge function + Resend, que YA está configurado en el proyecto) + panel de WhatsApp manual con tracking en Dashboard y Turnos + modelo de datos preparado para el futuro bot "RehaBot". Dato clave del plan: el `from` actual de Resend es el dominio de prueba (solo entrega al dueño de la cuenta) — para pacientes reales hay que verificar un dominio propio.
- [ ] Decidir si la fricción de Jitsi (moderador tiene que loguearse con Google/GitHub/Facebook, paciente no) amerita migrar a Daily.co o Whereby embebido — discutido, no decidido. Poco detalle, afinar.

## 🗄️ Base de datos / Supabase
- [ ] `exercise_plan_tokens.patient_id` no tiene `ON DELETE CASCADE` (a diferencia de `plan_id`, que sí) — inconsistente. Hoy no rompe nada porque no hay borrado duro de pacientes desde la UI, pero si alguna vez se agrega, hay que agregar el cascade o el delete va a fallar con FK violation. Encontrado 2026-08-10 al limpiar datos de prueba a mano.
- [x] **Registro abierto a cualquiera** — cerrado 2026-07-16 (migración `20260716000000_signup_only_by_invitation`): `handle_new_user` rechaza el alta salvo invitación nativa o de equipo pendiente. Verificado contra la API + test de regresión en la suite de RLS. Nota operativa: los usuarios de prueba de los tests ya no se auto-crean; si se borran, re-invitarlos desde el dashboard.
- [ ] Activar "Prevent use of leaked passwords" en el dashboard de Supabase (Auth → Providers → Email) — **bloqueada: requiere plan Pro**. Retomarla si/cuando se upgradee el plan (mismo momento en que conviene evaluar PITR para backups, ver Ideas). El resto del hardening de seguridad ya se hizo (2026-07-15: REVOKEs de RPC, search_path, listado del bucket, mínimo de contraseña 8 client-side).
- [x] Verificar que "Minimum password length" esté en 8 en el dashboard (Auth → Providers → Email) — hecho 2026-07-16, ahora el mínimo de 8 se aplica client-side y server-side.
- [ ] Probar el flujo completo de cambio de email del módulo Perfil: cambiar a una casilla accesible, confirmar desde el mail, y verificar en el dashboard de Supabase que el redirect URL del mail de cambio de email apunte al dominio de la app (misma config que reset-password).
- [ ] Borrar la edge function huérfana `create-daily-room` del proyecto Supabase (`pvuaqatdendcgumwktid`) — quedó deployada del intento con Daily.co, ya no se usa desde que se pasó a Jitsi.
- [ ] Definir alcance de arquitectura offline-first para centros con conectividad inestable durante la sesión clínica (ver ejemplo cargado en `DECISIONS.md` — quedó "pendiente de definir alcance", a validar con Maia el impacto clínico real).

## 🎨 UI / UX
- [x] **14 queries ignoran el error silenciosamente** — cerrado 2026-09-15. El código creció desde julio (hoy son ~30 sitios con el patrón `const { data } = await supabase...` sin `error`); se priorizaron los ~14 de mayor impacto real: `fetchEpisodeDiagnoses` (riesgo de pérdida de datos — un guardado podía borrar diagnósticos reales si la carga fallaba en silencio), la carga principal de la ficha del paciente (`PatientProfile.tsx`, ~11 queries), el PDF del plan de ejercicios (se generaba "exitosamente" pero vacío), la consulta de turnos ocupados del día, y las vistas de detalle de evaluaciones/contextos de Auth-Workspace/hooks del dashboard/equipos/categorías de ejercicios/QuickDASH/links de plan. Ver commit en `fix/silent-error-queries`.
- [x] Los ~16 sitios restantes del patrón de queries sin chequear error — cerrado 2026-09-15. `Cie10AutocompleteInline.tsx` e `InsuranceField.tsx` (autocompletes): `console.error` sin toast, para no spamear mientras se tipea. `ApplyRoutineWizard.tsx` (lista de planes/programas + autocomplete de agregar ejercicio): `console.error`. `SessionForm.tsx`/`SessionTimeline.tsx` (prefills de episodio/ficha/perfil ocupacional/dinamómetro y los cambios de estado alta↔activo del paciente/episodio): `console.error`, sin cambiar el flujo. `NewEpisodeDialog.tsx`: los inserts encadenados tras crear el episodio (diagnósticos, ficha clínica, alta de episodios previos, reactivación) ahora tiran el error y lo captura el try/catch existente — antes podían fallar en silencio dejando un episodio sin diagnósticos pero mostrando éxito. `PlanDialogs.tsx` (Plan de tratamiento, `treatment_plans`): el insert/replace de `treatment_plan_exercises` ahora chequea error y avisa con toast — antes podía guardar el plan "correctamente" con 0 ejercicios si esa segunda query fallaba. **Nota:** al verificar en el navegador se encontró que `NewPlanDialog`/`EditPlanDialog`/`PlanDetailDialog`/`DeletePlanConfirm` en `PatientProfile.tsx` son código muerto — sus estados (`showNewPlan`, etc.) nunca se setean a `true` en ningún botón visible, no son alcanzables desde la UI actual (reemplazados por el flujo Ejercicio→Plan→Programa de agosto). El fix ahí quedó aplicado igual (es código correcto por si se reactiva) pero no se pudo probar en vivo — anotado abajo.
- [x] Código muerto de "Plan de tratamiento" — cerrado 2026-09-15. Se confirmó que era código muerto de punta a punta, no solo los 4 diálogos: `PlanCardActions` (el componente que los abría) tampoco se usaba en ningún lado, y `exportPlanPdf` (`src/components/plans/PlanPdfExport.tsx`) solo lo llamaba ese componente muerto. Se borraron `src/components/patients/dialogs/PlanDialogs.tsx` y `src/components/plans/PlanPdfExport.tsx` enteros, y en `PatientProfile.tsx` el import, los 4 estados de diálogo, las 2 queries a `treatment_plans` (nunca se mostraba el resultado en ningún lado) y el render de los diálogos. La tabla `treatment_plans`/`treatment_plan_exercises` queda en la base sin borrar (0 filas en producción — nunca se llegó a usar realmente) — `Exercises.tsx` todavía consulta `treatment_plan_exercises` como guard de "¿este ejercicio está en uso?" antes de borrarlo, así que la tabla no se puede tirar sin revisar eso primero. Verificado en el navegador (Ficha, Evolución, Ejercicios de un paciente real) — 0 errores de consola. Lint bajó de 235 a 207 (el archivo muerto tenía 19 `any`).
- [ ] **Decidir el destino del rol `patient`**: existe en el enum del schema pero no hay ninguna experiencia de paciente (solo links públicos de QuickDASH/planes). ¿Portal de paciente o matar el rol? Charlar con Maia antes de codear. Encontrado 2026-07-16.

## 🔧 Infraestructura / DevOps
- [x] CI con GitHub Actions (lint con techo de warnings + typecheck + tests + build) — hecho 2026-07-16.
- [x] Tests de RLS (pacientes, sesiones, fichas clínicas, perfiles, anon) — hecho 2026-07-16, corren en CI.
- [x] Monitoreo de errores en producción (Sentry) — hecho 2026-07-16. Init opt-in por `VITE_SENTRY_DSN` (solo builds de producción), captura global + ErrorBoundary, sin PII/replay/tracing. DSN cargado en Vercel, verificado en el bundle de producción y con evento de prueba ingresado.
- [ ] Tests e2e de flujos críticos (login, crear paciente, cargar sesión) — a propósito para más adelante, cuando el producto se estabilice (el churn de UI actual los rompería seguido).
- [~] Bajar la deuda de lint — techo del CI en 239, bajó a 207 el 2026-09-15 al borrar el código muerto de `PlanDialogs.tsx`/`PlanPdfExport.tsx` (19 `any` menos). Queda: `any` concentrados en SessionForm, AnalyticalEvaluationPage, PatientProfile — son estructuras JSON de evaluaciones clínicas, requieren diseñar interfaces de dominio, no reemplazo mecánico; seguir el patrón de `AppointmentWithPatient` en useAppointments.ts. También quedan react-refresh legítimos (contexts/status exportan helpers junto a componentes) y exhaustive-deps (revisar de a uno, riesgo de loops). Bajar el techo del CI con cada limpieza.
- [x] Performance de DB — hecho 2026-07-16 (migración `20260716010000_rls_initplan_and_fk_indexes`): 64 políticas RLS con initplan (public + storage, reescritas dinámicamente desde pg_policies) + índices para las 15 FKs. Suite de RLS verde después del cambio. Las 7 tablas con políticas permisivas múltiples quedaron a propósito sin consolidar (cambia semántica fácil, beneficio marginal).

## 💡 Ideas / Backlog sin priorizar
(Todo lo que se te ocurre a mitad de otra tarea va ACÁ, no se empieza ahí nomás)
- [ ] Limpieza de restos de Lovable (media hora): borrar `bun.lockb` (el CI usa npm y `package-lock.json`), sacar `lovable-tagger` de `vite.config.ts`, borrar `pages/Index.tsx` huérfana, el `playwright.config.ts` de Lovable sin e2e, y desinstalar `react-hook-form`+`zod` si se confirma que no se van a usar. Encontrado 2026-07-16.
- [ ] Asistente de IA para médicos/terapeutas (chat dentro de la app): RAG sobre pgvector en Supabase — pipeline de ingesta de documentos (tabla `documents` + `document_chunks` con embeddings), búsqueda por similitud y respuestas con cita de fuente. Bloqueada por: falta el PDF fuente (lo pasan externos) y decidir proveedor de embeddings (Anthropic no tiene API propia; candidatos Voyage AI u OpenAI) y LLM de respuesta. Arquitectura ya conversada el 2026-07-15.
- [ ] Backfillear en `DECISIONS.md` la decisión ya tomada de pasar de Daily.co a Jitsi Meet (2026-07-10) — quedó documentada solo en memoria de sesiones anteriores, no en el repo. Poco detalle, afinar.

---

## Historial de descartadas (para no re-litigar las mismas discusiones)
| Tarea | Por qué se descartó | Fecha |
|---|---|---|
| | | |
