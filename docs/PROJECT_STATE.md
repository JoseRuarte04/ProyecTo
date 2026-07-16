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
- **[2026-07-15] Hardening de seguridad** (migración `20260715130000_security_hardening.sql`, aplicada y verificada contra la API): funciones RPC sensibles sin acceso anon, trigger functions no invocables, search_path fijo, bucket avatars sin listado público. Además `.env` fuera de git (+ `.env.example`), `.gitignore` arreglado (líneas UTF-16 rotas) y mínimo de contraseña a 8 en los 4 formularios. Pendiente bloqueado por plan Pro: leaked password protection (ver `TASKS.md`).
- **[2026-07-15] Fix recuperación de contraseña / mails de auth**: el Site URL de Supabase estaba en el default `localhost:3000` y producción no estaba en la allowlist — configurado en dashboard, verificado andando. El cambio de email ahora redirige a `/profile`.
- **[2026-07-15] Módulo Perfil en `/profile`** (ítem en sidebar debajo de Ejercicios): edición de datos personales (nombre, especialidad, matrícula), foto de avatar (bucket `avatars` público + columna `avatar_url`, con compresión client-side a 512px porque las fotos de cámara superaban el límite de 2MB del bucket), cambio de contraseña (verificando la actual) y cambio de email (flujo de confirmación de Supabase; `profiles.email` se sincroniza client-side en `fetchProfile`, sin trigger). AuthContext ahora expone `refreshProfile`. Verificado: datos personales y avatar. Sin probar todavía: flujo completo de cambio de email (requiere casilla accesible y chequear el redirect URL del mail en el dashboard de Supabase).
- **[2026-07-15] Fix: spinner infinito en `/` para usuarios sin sesión.** `useIsAdmin` dejaba `isAdmin` en `null` para siempre cuando no había sesión (a propósito — ver comentario del hook), pero `AppLayout` trataba `isAdmin === null` como "todavía cargando" sin importar si había sesión. Resultado: nunca se llegaba a evaluar la redirección a `/login`, pantalla en blanco con spinner eterno. Fix en `src/components/AppLayout.tsx`: ahora solo espera a `isAdmin` cuando efectivamente hay `session` (mismo orden que ya usaba `AdminLayout`).
- **[2026-07-15] Setup del sistema de tracking del proyecto** (este mismo archivo + `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` en `docs/`, y reglas de flujo de trabajo en `CLAUDE.md`).

## 🧠 Contexto que Claude Code necesita saber HOY
(Decisiones recientes, cosas raras del schema, cosas que no están en el código ni importan)
- Turnos virtuales usan Jitsi Meet (links generados en el cliente en `src/lib/videoRoom.ts`, sin API key ni edge function). Daily.co se probó primero y se descartó — hay una edge function `create-daily-room` huérfana deployada en Supabase (`pvuaqatdendcgumwktid`) que se puede borrar del dashboard. Caveat conocido: en `meet.jit.si` el que inicia la reunión necesita loguearse como moderador; los pacientes entran sin cuenta. Ver candidato en `TASKS.md`.
- El servidor de desarrollo local corre en el puerto **8080** (no el 5173 default de Vite) — está fijado en `vite.config.ts`.

---

## Última sesión de trabajo
**Fecha:** 2026-07-15
**Qué se hizo:** Módulo Perfil completo en `/profile` (datos personales, avatar con compresión client-side, contraseña, email) — 6 commits chicos, migración `20260715120000_profile_avatar.sql` ya aplicada en Supabase. También se planificó (sin implementar) un asistente de IA para médicos con RAG sobre pgvector — quedó como candidata en `TASKS.md` esperando el PDF fuente.
**Qué quedó a medio camino:** Del módulo Perfil, solo falta probar el flujo completo de cambio de email (confirmar desde una casilla real + verificar el redirect URL del mail en el dashboard de Supabase — ver `TASKS.md`).
**Próxima sesión debería empezar por:** Definir qué tarea pasa a "En progreso" — candidatas: asistente de IA (cuando llegue el PDF) o alguna del backlog.
