# TASKS — RehabOT

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
- [ ] 

## 📅 Turnos / Agenda
- [⏸] **Recordatorios de turnos** (pausada 2026-07-16 — Jose priorizó otra cosa; el plan quedó completo y listo para ejecutar en **`docs/PLAN_recordatorios_turnos.md`**). Alcance ya decidido: email automático (cron + edge function + Resend, que YA está configurado en el proyecto) + panel de WhatsApp manual con tracking en Dashboard y Turnos + modelo de datos preparado para el futuro bot "RehaBot". Dato clave del plan: el `from` actual de Resend es el dominio de prueba (solo entrega al dueño de la cuenta) — para pacientes reales hay que verificar un dominio propio.
- [ ] Decidir si la fricción de Jitsi (moderador tiene que loguearse con Google/GitHub/Facebook, paciente no) amerita migrar a Daily.co o Whereby embebido — discutido, no decidido. Poco detalle, afinar.

## 🗄️ Base de datos / Supabase
- [x] **Registro abierto a cualquiera** — cerrado 2026-07-16 (migración `20260716000000_signup_only_by_invitation`): `handle_new_user` rechaza el alta salvo invitación nativa o de equipo pendiente. Verificado contra la API + test de regresión en la suite de RLS. Nota operativa: los usuarios de prueba de los tests ya no se auto-crean; si se borran, re-invitarlos desde el dashboard.
- [ ] Activar "Prevent use of leaked passwords" en el dashboard de Supabase (Auth → Providers → Email) — **bloqueada: requiere plan Pro**. Retomarla si/cuando se upgradee el plan (mismo momento en que conviene evaluar PITR para backups, ver Ideas). El resto del hardening de seguridad ya se hizo (2026-07-15: REVOKEs de RPC, search_path, listado del bucket, mínimo de contraseña 8 client-side).
- [x] Verificar que "Minimum password length" esté en 8 en el dashboard (Auth → Providers → Email) — hecho 2026-07-16, ahora el mínimo de 8 se aplica client-side y server-side.
- [ ] Probar el flujo completo de cambio de email del módulo Perfil: cambiar a una casilla accesible, confirmar desde el mail, y verificar en el dashboard de Supabase que el redirect URL del mail de cambio de email apunte al dominio de la app (misma config que reset-password).
- [ ] Borrar la edge function huérfana `create-daily-room` del proyecto Supabase (`pvuaqatdendcgumwktid`) — quedó deployada del intento con Daily.co, ya no se usa desde que se pasó a Jitsi.
- [ ] Definir alcance de arquitectura offline-first para centros con conectividad inestable durante la sesión clínica (ver ejemplo cargado en `DECISIONS.md` — quedó "pendiente de definir alcance", a validar con Maia el impacto clínico real).

## 🎨 UI / UX
- [ ] **14 queries ignoran el error silenciosamente** (`const { data } = await supabase...` sin leer `error`): cuando fallan, el usuario ve pantalla vacía sin aviso y Sentry no lo captura porque el código lo traga. Pasada corta: sumar el `toast.error` que ya es patrón en el resto del repo. Encontrado 2026-07-16.
- [ ] **Decidir el destino del rol `patient`**: existe en el enum del schema pero no hay ninguna experiencia de paciente (solo links públicos de QuickDASH/planes). ¿Portal de paciente o matar el rol? Charlar con Maia antes de codear. Encontrado 2026-07-16.

## 🔧 Infraestructura / DevOps
- [x] CI con GitHub Actions (lint con techo de warnings + typecheck + tests + build) — hecho 2026-07-16.
- [x] Tests de RLS (pacientes, sesiones, fichas clínicas, perfiles, anon) — hecho 2026-07-16, corren en CI.
- [x] Monitoreo de errores en producción (Sentry) — hecho 2026-07-16. Init opt-in por `VITE_SENTRY_DSN` (solo builds de producción), captura global + ErrorBoundary, sin PII/replay/tracing. DSN cargado en Vercel, verificado en el bundle de producción y con evento de prueba ingresado.
- [ ] Tests e2e de flujos críticos (login, crear paciente, cargar sesión) — a propósito para más adelante, cuando el producto se estabilice (el churn de UI actual los rompería seguido).
- [~] Bajar la deuda de lint — techo del CI en 239 (era 260; 2026-07-16: Appointments.tsx tipado completo como caso ejemplar, react-refresh apagado para ui/, disables muertos removidos). Queda: 200 `any` (concentrados en SessionForm 41, AnalyticalEvaluationPage 24, PatientProfile 20, PlanDialogs 19 — son estructuras JSON de evaluaciones clínicas, requieren diseñar interfaces de dominio, no reemplazo mecánico; seguir el patrón de `AppointmentWithPatient` en useAppointments.ts), 26 react-refresh legítimos (contexts/status exportan helpers junto a componentes) y 13 exhaustive-deps (revisar de a uno, riesgo de loops). Bajar el techo del CI con cada limpieza.
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
