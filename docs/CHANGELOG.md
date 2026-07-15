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

## [2026-07-15] Fix spinner infinito + setup de tracking del proyecto
- Se cerró: fix del spinner infinito en `/` para usuarios sin sesión (`AppLayout` esperaba a `useIsAdmin` aunque no hubiera `session`).
- Se cerró: setup del sistema de tracking (`docs/PROJECT_STATE.md`, `TASKS.md`, `DECISIONS.md`, este changelog) + reglas de flujo de trabajo en `CLAUDE.md`.
- Decisión tomada: ninguna nueva (no trivial) esta sesión.
- Para la próxima: definir qué tarea pasa a "En progreso" en `PROJECT_STATE.md` — no hay nada activo elegido todavía.
