# PROJECT_STATE — RehabOT

> Este archivo es la ÚNICA fuente de verdad sobre "dónde estamos ahora".
> Se actualiza al FINAL de cada sesión de trabajo (con Claude Code o sin él).
> Si algo no está acá, no pasó — o no está confirmado.

**Última actualización:** 2026-07-15
**Sprint / objetivo actual:** _(sin definir todavía — completar)_

---

## 🎯 Objetivo de esta semana
_(sin definir todavía — completar)_

---

## 🟢 En progreso AHORA (máximo 1-2 ítems)
| Tarea | Estado | Bloqueado por | Próximo paso concreto |
|---|---|---|---|
| | | | |

**Vacío a propósito.** No hay nada activo ahora mismo — decidir qué arranca.

Regla: si hay más de 2 filas acá, es mentira — elegí una y pausá el resto explícitamente abajo.

## ⏸️ Pausado (con motivo — esto es lo que normalmente se pierde)
| Tarea | Por qué se pausó | Qué falta para retomarla |
|---|---|---|
| | | |

## ✅ Cerrado esta semana
- **[2026-07-15] Fix: spinner infinito en `/` para usuarios sin sesión.** `useIsAdmin` dejaba `isAdmin` en `null` para siempre cuando no había sesión (a propósito — ver comentario del hook), pero `AppLayout` trataba `isAdmin === null` como "todavía cargando" sin importar si había sesión. Resultado: nunca se llegaba a evaluar la redirección a `/login`, pantalla en blanco con spinner eterno. Fix en `src/components/AppLayout.tsx`: ahora solo espera a `isAdmin` cuando efectivamente hay `session` (mismo orden que ya usaba `AdminLayout`).
- **[2026-07-15] Setup del sistema de tracking del proyecto** (este mismo archivo + `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` en `docs/`, y reglas de flujo de trabajo en `CLAUDE.md`).

## 🧠 Contexto que Claude Code necesita saber HOY
(Decisiones recientes, cosas raras del schema, cosas que no están en el código ni importan)
- Turnos virtuales usan Jitsi Meet (links generados en el cliente en `src/lib/videoRoom.ts`, sin API key ni edge function). Daily.co se probó primero y se descartó — hay una edge function `create-daily-room` huérfana deployada en Supabase (`pvuaqatdendcgumwktid`) que se puede borrar del dashboard. Caveat conocido: en `meet.jit.si` el que inicia la reunión necesita loguearse como moderador; los pacientes entran sin cuenta. Ver candidato en `TASKS.md`.
- El servidor de desarrollo local corre en el puerto **8080** (no el 5173 default de Vite) — está fijado en `vite.config.ts`.

---

## Última sesión de trabajo
**Fecha:** 2026-07-15
**Qué se hizo:** Diagnóstico y fix del spinner infinito al abrir localhost (bug en `useIsAdmin`/`AppLayout` para usuarios sin sesión). Setup del sistema de tracking del proyecto (`docs/PROJECT_STATE.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` + reglas en `CLAUDE.md`).
**Qué quedó a medio camino:** Nada en código — el fix del spinner está cerrado. El sistema de tracking queda con `DECISIONS.md` todavía sin entradas reales (hay una candidata pendiente: backfillear la decisión Daily.co → Jitsi, ver `TASKS.md`).
**Próxima sesión debería empezar por:** Definir qué tarea pasa a "En progreso" — no hay nada activo elegido todavía.
