# DECISIONS — RehabOT

> Registro de decisiones de arquitectura/producto. La idea NO es documentar todo
> el código (para eso está el código y los comentarios) sino el "por qué"
> detrás de decisiones que en 2 meses vas a olvidar y vas a querer revertir
> sin saber que ya las probaste.

Formato: copiar el bloque de abajo por cada decisión. 5 minutos, no más.

---

## [2026-XX-XX] Título corto de la decisión

**Contexto:** ¿Qué problema había que resolver?

**Opciones consideradas:**
1. ...
2. ...

**Decisión:** ¿Qué se eligió?

**Por qué:** Razón concreta (no "porque sí" ni "porque Claude lo sugirió" — el
motivo real de negocio/técnico).

**Consecuencias / trade-offs aceptados:**

**Quién lo decidió:** (vos solo / con Maia / con Javier)

---

## [2026-07-17] Diagnósticos múltiples: tabla nueva + columnas legacy denormalizadas

**Contexto:** El diagnóstico era un solo string en `patient_clinical_records.diagnosis`
y `treatment_episodes.diagnosis`; con dos diagnósticos se mezclaban en un texto
imposible de agrupar en estadísticas futuras. Jose eligió lista abierta (N por episodio).

**Opciones consideradas:**
1. Segunda columna `diagnosis_2` (simple pero tope de 2)
2. Tabla `episode_diagnoses` reemplazando del todo a las columnas viejas
3. Tabla `episode_diagnoses` + seguir escribiendo el principal en las columnas legacy

**Decisión:** Opción 3. `episode_diagnoses` (code CIE-10 nullable, label, position;
0 = principal) es la fuente de verdad y se escribe primero; el principal se
sincroniza en cada save a las dos columnas viejas.

**Por qué:** El sidebar del paciente, el selector de episodios, el header de
SessionForm y la edge function `generate-discharge-report` leen las columnas
legacy — mantenerlas escritas evitó tocar todo eso y el informe de alta IA
siguió funcionando sin cambios. Backfill idempotente migró los 15 episodios
existentes (regex extrae el código del formato "CODE — desc").

**Consecuencias / trade-offs aceptados:** Doble escritura sin transacción
client-side: si un save falla a mitad pueden divergir (mitigado escribiendo
primero la tabla nueva; la lectura prioriza la tabla con fallback al legacy).
Estadísticas futuras deben leer `episode_diagnoses`, no las columnas viejas.

**Quién lo decidió:** Jose (lista abierta) + implementación propuesta por Claude.

---

## [2026-07-17] Estado "abandonó" como valor nuevo del enum patient_status

**Contexto:** No había forma de registrar que un paciente dejó el tratamiento;
el enum solo tenía active/discharged/paused y "pausado" mentía sobre el motivo.

**Decisión:** `ALTER TYPE patient_status ADD VALUE 'abandoned'` (migración
aislada, no puede usarse en su misma transacción) + `abandoned_at` /
`abandon_reason` en `patients`; el episodio activo se cierra con
`status='abandoned'`. Guards nuevos: `soft_delete_session` y la edición de
sesiones solo revierten a `active` si el paciente estaba `discharged`, y crear
un episodio nuevo reactiva a un paciente abandonado.

**Por qué:** Un enum nuevo mantiene la semántica limpia para filtros y
estadísticas (abandono ≠ alta) y el motivo/fecha quedan auditables. Se descartó
registrarlo como sesión de cierre por ser más pesado de usar.

**Quién lo decidió:** Jose (botón + estado con fecha y motivo opcional).

---

## [2026-07-16] Registro solo por invitación: guard en el trigger, no toggle del dashboard

**Contexto:** Cualquiera podía hacer `signUp` sin invitación y `handle_new_user`
le creaba un perfil de profesional activo (RLS aislaba los datos, pero el alta
era libre). Había que cerrarlo sin romper los dos flujos legítimos de invitación.

**Opciones consideradas:**
1. Apagar "Allow new users to sign up" en el dashboard de Supabase
2. Guard dentro de `handle_new_user`: rechazar el alta salvo `invited_at`
   seteado (invitación nativa) o invitación de equipo pendiente

**Decisión:** Opción 2 (migración `20260716000000_signup_only_by_invitation`).

**Por qué:** El toggle del dashboard rompería `/registro?token=` — el flujo de
invitación a equipos usa `signUp` público. El guard en el trigger cierra el alta
libre y mantiene ambos flujos sin tocar el frontend. Además queda versionado en
una migración (el toggle del dashboard no deja rastro en el repo).

**Consecuencias / trade-offs aceptados:** Los usuarios de prueba de la suite de
RLS ya no pueden auto-crearse; si se borran hay que re-invitarlos a mano. El
error que ve un intruso es el genérico de Supabase ("Database error saving new
user"), no un mensaje amigable — aceptable, no es un flujo que deba ser amigable.

**Quién lo decidió:** Jose (con Claude, tras el hallazgo al armar los tests de RLS)

---

## [2026-07-15] Bucket de avatares público (sin signed URLs)

**Contexto:** El módulo Perfil suma foto de avatar. El único bucket existente
(`clinical-files`) es privado con signed URLs porque guarda documentos clínicos.
¿El bucket de avatares sigue ese patrón o es público?

**Opciones consideradas:**
1. Privado + signed URLs (como `clinical-files`)
2. Público con lectura abierta y escritura solo sobre la carpeta propia

**Decisión:** Bucket `avatars` público. `profiles.avatar_url` guarda la URL
pública completa; los archivos van a `{user_id}/{timestamp}.jpg` y la escritura
está restringida por RLS a la carpeta del propio usuario.

**Por qué:** Un avatar no es data clínica sensible, y las signed URLs expiran —
el sidebar tendría que regenerarlas en cada sesión. El timestamp en el filename
evita que el CDN de Supabase siga sirviendo la imagen vieja al reemplazarla.

**Consecuencias / trade-offs aceptados:** Cualquiera con la URL puede ver la
foto (aceptable para un avatar). Fotos reemplazadas pueden quedar huérfanas si
el borrado best-effort falla.

**Quién lo decidió:** Jose (con Claude, durante la implementación del módulo Perfil)

---

## [2026-07-15] Sync de email auth→profiles client-side (sin trigger)

**Contexto:** El cambio de email se confirma en `auth.users` (flujo de
confirmación de Supabase), pero `profiles.email` es una columna aparte y no
había ningún mecanismo que las mantuviera consistentes.

**Opciones consideradas:**
1. Trigger en Postgres sobre `auth.users` que propague a `profiles`
2. Reconciliación client-side: `fetchProfile` compara `session.user.email` vs
   `profiles.email` y actualiza si difieren

**Decisión:** Reconciliación client-side en `AuthContext.fetchProfile`, más un
bypass para que el evento `USER_UPDATED` re-fetchee el perfil.

**Por qué:** Los triggers sobre `auth.users` son frágiles (schema administrado
por Supabase, difícil de testear y de versionar) y el `GRANT UPDATE (email)`
ya existía. La reconciliación corre en cada carga de perfil, así que cubre
también la confirmación hecha en otra pestaña o dispositivo.

**Consecuencias / trade-offs aceptados:** `profiles.email` puede quedar
desactualizado hasta el próximo login/fetch del usuario (ventana corta y sin
impacto: nada crítico lee `profiles.email` como fuente de verdad de login).

**Quién lo decidió:** Jose (con Claude, durante la implementación del módulo Perfil)

---

<!-- Ejemplo ya cargado para que veas el formato -->

## [2026-06-XX] Offline-first para centros con conectividad inestable

**Contexto:** Algunos centros de rehabilitación no tienen internet estable
durante la sesión clínica.

**Opciones consideradas:**
1. Requerir conexión siempre (más simple, pero rompe en consultorios sin wifi)
2. Offline-first con sync posterior (más complejo, más robusto)

**Decisión:** Explorar arquitectura offline-first (pendiente de definir alcance)

**Por qué:** Sin esto, el producto no sirve para el segmento de centros chicos/rurales,
que es parte del mercado objetivo.

**Consecuencias:** Suma complejidad de sync y manejo de conflictos en Supabase.

**Quién lo decidió:** Jose (a validar con Maia el impacto clínico real)
