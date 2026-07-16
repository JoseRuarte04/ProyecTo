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
