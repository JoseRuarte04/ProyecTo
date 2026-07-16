# CHANGELOG — RehabOT

> Log cronológico simple. Una entrada por sesión de trabajo, 2-4 líneas.
> No es para detalle técnico profundo (para eso están los commits) — es para
> poder responder en 10 segundos "¿qué pasó la semana pasada?" sin tener que
> releer código.

Formato: `## [YYYY-MM-DD] Título corto`

---

## [2026-07-15] Ejemplo de formato
- Se cerró: ...
- Se pausó: ... (motivo: ...)
- Decisión tomada: ... (ver DECISIONS.md si aplica)
- Para la próxima: ...

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
