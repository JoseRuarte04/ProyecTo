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
- [ ] Decidir si la fricción de Jitsi (moderador tiene que loguearse con Google/GitHub/Facebook, paciente no) amerita migrar a Daily.co o Whereby embebido — discutido, no decidido. Poco detalle, afinar.

## 🗄️ Base de datos / Supabase
- [ ] **Revisar que el registro esté abierto a cualquiera**: `signUp` sin invitación funciona (autoconfirm activado) y `handle_new_user` crea un perfil de profesional activo automáticamente. RLS aísla los datos así que no ve nada ajeno, pero cualquiera que descubra la URL puede crearse una cuenta de profesional. Decidir: ¿cerrar signup y dejar solo invitaciones? Encontrado el 2026-07-16 armando los tests de RLS.
- [ ] Activar "Prevent use of leaked passwords" en el dashboard de Supabase (Auth → Providers → Email) — **bloqueada: requiere plan Pro**. Retomarla si/cuando se upgradee el plan (mismo momento en que conviene evaluar PITR para backups, ver Ideas). El resto del hardening de seguridad ya se hizo (2026-07-15: REVOKEs de RPC, search_path, listado del bucket, mínimo de contraseña 8 client-side).
- [x] Verificar que "Minimum password length" esté en 8 en el dashboard (Auth → Providers → Email) — hecho 2026-07-16, ahora el mínimo de 8 se aplica client-side y server-side.
- [ ] Probar el flujo completo de cambio de email del módulo Perfil: cambiar a una casilla accesible, confirmar desde el mail, y verificar en el dashboard de Supabase que el redirect URL del mail de cambio de email apunte al dominio de la app (misma config que reset-password).
- [ ] Borrar la edge function huérfana `create-daily-room` del proyecto Supabase (`pvuaqatdendcgumwktid`) — quedó deployada del intento con Daily.co, ya no se usa desde que se pasó a Jitsi.
- [ ] Definir alcance de arquitectura offline-first para centros con conectividad inestable durante la sesión clínica (ver ejemplo cargado en `DECISIONS.md` — quedó "pendiente de definir alcance", a validar con Maia el impacto clínico real).

## 🎨 UI / UX
- [ ] 

## 🔧 Infraestructura / DevOps
- [x] CI con GitHub Actions (lint con techo de warnings + typecheck + tests + build) — hecho 2026-07-16.
- [x] Tests de RLS (pacientes, sesiones, fichas clínicas, perfiles, anon) — hecho 2026-07-16, corren en CI.
- [ ] Monitoreo de errores en producción (Sentry o similar) — hay ErrorBoundary pero nada reporta. Del informe de mejoras del 2026-07-15.
- [ ] Tests e2e de flujos críticos (login, crear paciente, cargar sesión) — a propósito para más adelante, cuando el producto se estabilice (el churn de UI actual los rompería seguido).
- [ ] Bajar la deuda de lint: 212 warnings de no-explicit-any (los tipos de Supabase ya existen, se pisan con any) y 15 de exhaustive-deps. El CI tiene techo de 260 warnings para que no crezca; bajarlo a medida que se limpie.
- [ ] Performance de DB (del informe 2026-07-15): 58 políticas RLS re-evalúan auth.uid() por fila (envolver en select), 15 FKs sin índice, 7 tablas con políticas permisivas duplicadas. Migración mecánica, hacerla antes de tener volumen.

## 💡 Ideas / Backlog sin priorizar
(Todo lo que se te ocurre a mitad de otra tarea va ACÁ, no se empieza ahí nomás)
- [ ] Asistente de IA para médicos/terapeutas (chat dentro de la app): RAG sobre pgvector en Supabase — pipeline de ingesta de documentos (tabla `documents` + `document_chunks` con embeddings), búsqueda por similitud y respuestas con cita de fuente. Bloqueada por: falta el PDF fuente (lo pasan externos) y decidir proveedor de embeddings (Anthropic no tiene API propia; candidatos Voyage AI u OpenAI) y LLM de respuesta. Arquitectura ya conversada el 2026-07-15.
- [ ] Backfillear en `DECISIONS.md` la decisión ya tomada de pasar de Daily.co a Jitsi Meet (2026-07-10) — quedó documentada solo en memoria de sesiones anteriores, no en el repo. Poco detalle, afinar.

---

## Historial de descartadas (para no re-litigar las mismas discusiones)
| Tarea | Por qué se descartó | Fecha |
|---|---|---|
| | | |
