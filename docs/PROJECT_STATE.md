# PROJECT_STATE — RehabOT

> Este archivo es la ÚNICA fuente de verdad sobre "dónde estamos ahora".
> Se actualiza al FINAL de cada sesión de trabajo (con Claude Code o sin él).
> Si algo no está acá, no pasó — o no está confirmado.

**Última actualización:** 2026-07-17
**Sprint / objetivo actual:** _(sin definir todavía — completar)_

---

## 🎯 Objetivo de esta semana
_(sin definir todavía — completar)_

---

## 🟢 En progreso AHORA (máximo 1-2 ítems)
| Tarea | Estado | Bloqueado por | Próximo paso concreto |
|---|---|---|---|
| | | | |

**Vacío** — Recordatorios de turnos pasó a Pausado con plan listo; decidir qué arranca.

Regla: si hay más de 2 filas acá, es mentira — elegí una y pausá el resto explícitamente abajo.

## ⏸️ Pausado (con motivo — esto es lo que normalmente se pierde)
| Tarea | Por qué se pausó | Qué falta para retomarla |
|---|---|---|
| Recordatorios de turnos | Jose priorizó otra cosa (2026-07-16); el plan quedó completo | Nada — ejecutar `docs/PLAN_recordatorios_turnos.md` de punta a punta (6 commits planificados) |

## ✅ Cerrado esta semana
- **[2026-07-17] Cuatro mejoras del flujo de pacientes** (20 commits, todo verificado con lint/typecheck/tests/build):
  1. **Obra social**: checkbox "No posee obra social" en alta y edición; el campo de edición ahora usa el mismo autocomplete que el alta (`InsuranceField.tsx`). Guarda el string fijo `"No posee"` (null = sin dato).
  2. **Diagnósticos múltiples**: tabla `episode_diagnoses` (N por episodio, position 0 = principal, RLS igual que fichas) con backfill de los 15 episodios existentes. Editor compartido (`DiagnosisListEditor.tsx` + helpers en `diagnoses.ts`) en alta, sesión de admisión, nuevo episodio y edición de ficha. El principal se sigue escribiendo en las columnas legacy — ver DECISIONS.
  3. **Alta y abandono**: botón "Dar de alta" (navega con `?type=discharge` preseleccionado) y "Marcar abandono" (nuevo valor de enum `abandoned` + `abandoned_at`/`abandon_reason`, cierra episodio, diálogo con motivo opcional, botón Reactivar, tab en el listado). Guards para que borrar/editar sesiones no pise el estado abandonado.
  4. **Perfil ocupacional**: situación laboral, estado civil y nivel educativo como selects con opciones predefinidas (`occupationalOptions.ts`); además se agregó el campo "gestión de la salud" que faltaba en la edición de ficha.
  Migraciones aplicadas en remoto: `20260717010000`, `020000`, `021000`, `030000`, `031000`. Suite RLS ampliada a 16 tests (verde contra el proyecto real).
- **[2026-07-16] CI + tests de RLS.** GitHub Actions corre lint (techo 260 warnings) + typecheck + tests + build en cada push/PR. Suite de 12 tests de RLS contra el Supabase real (aislamiento de pacientes/sesiones/fichas entre profesionales + anon sin acceso) con usuarios y datos de prueba fijos que se reutilizan. Hallazgo pendiente de decisión en `TASKS.md`: el registro está abierto a cualquiera (signUp crea perfil de profesional activo sin invitación).
- **[2026-07-15] Hardening de seguridad** (migración `20260715130000_security_hardening.sql`, aplicada y verificada contra la API): funciones RPC sensibles sin acceso anon, trigger functions no invocables, search_path fijo, bucket avatars sin listado público. Además `.env` fuera de git (+ `.env.example`), `.gitignore` arreglado (líneas UTF-16 rotas) y mínimo de contraseña a 8 en los 4 formularios. Pendiente bloqueado por plan Pro: leaked password protection (ver `TASKS.md`).
- **[2026-07-15] Fix recuperación de contraseña / mails de auth**: el Site URL de Supabase estaba en el default `localhost:3000` y producción no estaba en la allowlist — configurado en dashboard, verificado andando. El cambio de email ahora redirige a `/profile`.
- **[2026-07-15] Módulo Perfil en `/profile`** (ítem en sidebar debajo de Ejercicios): edición de datos personales (nombre, especialidad, matrícula), foto de avatar (bucket `avatars` público + columna `avatar_url`, con compresión client-side a 512px porque las fotos de cámara superaban el límite de 2MB del bucket), cambio de contraseña (verificando la actual) y cambio de email (flujo de confirmación de Supabase; `profiles.email` se sincroniza client-side en `fetchProfile`, sin trigger). AuthContext ahora expone `refreshProfile`. Verificado: datos personales y avatar. Sin probar todavía: flujo completo de cambio de email (requiere casilla accesible y chequear el redirect URL del mail en el dashboard de Supabase).
- **[2026-07-15] Fix: spinner infinito en `/` para usuarios sin sesión.** `useIsAdmin` dejaba `isAdmin` en `null` para siempre cuando no había sesión (a propósito — ver comentario del hook), pero `AppLayout` trataba `isAdmin === null` como "todavía cargando" sin importar si había sesión. Resultado: nunca se llegaba a evaluar la redirección a `/login`, pantalla en blanco con spinner eterno. Fix en `src/components/AppLayout.tsx`: ahora solo espera a `isAdmin` cuando efectivamente hay `session` (mismo orden que ya usaba `AdminLayout`).
- **[2026-07-15] Setup del sistema de tracking del proyecto** (este mismo archivo + `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` en `docs/`, y reglas de flujo de trabajo en `CLAUDE.md`).

## 🧠 Contexto que Claude Code necesita saber HOY
(Decisiones recientes, cosas raras del schema, cosas que no están en el código ni importan)
- Turnos virtuales usan Jitsi Meet (links generados en el cliente en `src/lib/videoRoom.ts`, sin API key ni edge function). Daily.co se probó primero y se descartó — hay una edge function `create-daily-room` huérfana deployada en Supabase (`pvuaqatdendcgumwktid`) que se puede borrar del dashboard. Caveat conocido: en `meet.jit.si` el que inicia la reunión necesita loguearse como moderador; los pacientes entran sin cuenta. Ver candidato en `TASKS.md`.
- El servidor de desarrollo local corre en el puerto **8080** (no el 5173 default de Vite) — está fijado en `vite.config.ts`.
- Los diagnósticos viven en `episode_diagnoses` (fuente de verdad) pero el principal se sincroniza a `patient_clinical_records.diagnosis` y `treatment_episodes.diagnosis` en cada save. Estadísticas futuras deben leer la tabla nueva. Obra social: `"No posee"` es un valor sentinela distinto de null.
- El lint está EXACTAMENTE en el techo del CI (239 warnings) — cualquier warning nuevo rompe el build. Ojo con `react-refresh/only-export-components`: no exportar helpers desde archivos de componentes.

---

## Última sesión de trabajo
**Fecha:** 2026-07-17
**Qué se hizo:** Las cuatro mejoras del flujo de pacientes pedidas por Jose (obra social "No posee", diagnósticos múltiples por episodio, botones Dar de alta / Marcar abandono con estado nuevo, perfil ocupacional estandarizado) — 20 commits, 5 migraciones aplicadas en remoto, 2 entradas en DECISIONS. Verificado: typecheck, lint en el techo (239), 16 tests RLS en verde contra el Supabase real, build OK.
**Qué quedó a medio camino:** Nada del frente. Falta la verificación manual en el navegador de los flujos nuevos (checklist en el plan: `~/.claude/plans/analiza-todo-el-proyecto-hidden-hennessy.md`).
**Próxima sesión debería empezar por:** Probar los flujos nuevos en la app (puerto 8080) y pushear para que corra el CI. Después: retomar Recordatorios de turnos (plan completo en `docs/PLAN_recordatorios_turnos.md`) o el asistente de IA si llegó el PDF.

---

## Sesión anterior
**Fecha:** 2026-07-16
**Qué se hizo:** CI con GitHub Actions (lint+typecheck+tests+build) y suite de 12 tests de RLS que corren en CI contra el Supabase real. Backlog actualizado con los pendientes del informe de mejoras (Sentry, e2e, deuda de lint, performance de DB) y el hallazgo del registro abierto.
**Qué quedó a medio camino:** Nada. El primer run del CI en GitHub queda por verificarse con el próximo push.
**Próxima sesión debería empezar por:** Decidir sobre el registro abierto (¿cerrar signup y dejar solo invitaciones?) o retomar el asistente de IA si ya llegó el PDF.
