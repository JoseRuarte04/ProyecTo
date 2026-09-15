# DECISIONS — HisTO

> Registro de decisiones de arquitectura/producto. La idea NO es documentar todo
> el código (para eso está el código y los comentarios) sino el "por qué"
> detrás de decisiones que en 2 meses vas a olvidar y vas a querer revertir
> sin saber que ya las probaste.

Formato: copiar el bloque de abajo por cada decisión. 5 minutos, no más.

---

## [2026-09-15] Perfil ocupacional recortado + Evaluación funcional en 5 apartados (AOTA/MOHO)

**Contexto:** Jose pidió recortar Perfil ocupacional a 5 campos y rediseñar Evaluación funcional
en 5 apartados según el marco AOTA/MOHO. Al mapear el código con 3 agentes de exploración se
encontró que Perfil ocupacional y Ficha clínica se editan en 2 lugares (Ficha del paciente y
sesión de Admisión, mismos campos/tabla) y que Evaluación funcional aparece en TODAS las
sesiones (admisión y seguimiento), no solo en la admisión.

**Opciones consideradas:**
1. Perfil ocupacional: sacar la duplicación (editar solo desde la Ficha) vs. mantener los 2
   formularios, ambos recortados.
2. Evaluación funcional nueva: aparecer solo en admisión (con re-evaluación aparte) vs. seguir
   apareciendo en cada sesión de seguimiento como hoy.
3. Barthel/FIM: mantenerlos aparte de la nueva checklist de Ocupaciones vs. sacarlos (la nueva
   checklist ya puntúa independencia ítem por ítem).

**Decisión:** Confirmado con Jose antes de implementar:
1. Perfil ocupacional se mantiene en los 2 lugares (Ficha + sesión de Admisión), ambos
   recortados a los mismos 5 campos (dominancia, estado civil, nivel educativo, trabajo, red de
   apoyo) — no se toca la duplicación de componentes.
2. La nueva Evaluación funcional (5 apartados: Ocupaciones/Contextos/Patrones de
   desempeño/Habilidades de desempeño/Factores del cliente) sigue apareciendo en cada sesión,
   admisión y seguimiento por igual, como ya funcionaba.
3. Barthel y FIM se mantienen como sección aparte, separados de la nueva checklist de
   Ocupaciones (47 ítems en 9 categorías, calificables independiente/requiere asistencia/
   dependiente).

Las columnas viejas de texto libre de `functional_evaluations` (`avd`, `aivd`, `sleep_rest`,
`health_management`, `physical_activity`, `dominance`) quedan deprecadas — el dato de AVD/AIVD
que antes se escribía por error también en `patient_occupational_profiles`
(`SessionForm.tsx`, bug encontrado durante el mapeo) se corrigió de paso.

**Por qué:** Perfil ocupacional y Evaluación funcional se cargan en momentos distintos del
flujo clínico real (admisión vs. seguimiento repetido) — Jose prefirió no cambiar ese
comportamiento ya conocido por el equipo, solo el contenido de los campos.

**Consecuencias / trade-offs aceptados:** La duplicación de Perfil ocupacional entre Ficha y
sesión de Admisión sigue existiendo (2 componentes a mantener sincronizados si se agregan
campos a futuro). La nueva Evaluación funcional (47 ítems) se completa en cada sesión de
seguimiento, lo cual es más carga de trabajo por sesión que antes (2 textareas libres) —
aceptado porque permite trackear progreso ítem por ítem en el tiempo.

**Quién lo decidió:** con Jose (confirmado por chat antes de implementar).

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

## [2026-09-15] Nacionalidad, sexo, contacto de emergencia y alergias en pacientes

**Contexto:** Jose pidió 4 cambios en el alta de paciente: nacionalidad obligatoria, "Género"
renombrado a "Sexo" con masculino/femenino/no binario, separar el contacto de emergencia en
nombre y apellido, y agregar alergias. Antes de tocar código se consultó la base real (31
pacientes): 21 sin nacionalidad, valores sucios `M`/`F` en género (de una carga vieja que no
pasaba por el Select), y 7 pacientes con contacto de emergencia (4 separables por espacio, 3 de
una sola palabra).

**Opciones consideradas:**
1. Forzar `nationality NOT NULL` a nivel DB.
2. Convertir `gender` en un enum de Postgres con CHECK.
3. Borrar `emergency_contact_name` de una vez al agregar las columnas nuevas.
4. Alergias como lista estructurada (tipo diagnósticos) en vez de texto libre.

**Decisión:**
1. Nacionalidad obligatoria solo en el formulario de alta (frontend) — la columna sigue
   nullable en DB, porque forzar `NOT NULL` hubiera roto los 21 pacientes existentes sin el dato.
2. `gender`/"Sexo" sigue siendo `text` libre sin CHECK ni enum — mismo patrón que el resto de
   los campos de opciones cerradas del proyecto (`occupationalOptions.ts`). Se agregó una
   migración de normalización (`M`→`male`, `F`→`female`) para no perder esos 6 registros sucios.
3. `emergency_contact_name` queda en la tabla, deprecada pero sin borrar — por las dudas con el
   dato crudo. Candidato de limpieza en `TASKS.md`.
4. Alergias es un campo de texto libre (como "Antecedentes"), no una lista estructurada — no
   hay pedido ni precedente de catálogo de alergias en el proyecto.

**Por qué:** Priorizar no romper datos de pacientes reales por sobre la integridad estricta a
nivel DB — el proyecto ya tiene esta convención para todos los campos de opciones cerradas
(ver perfil ocupacional). Confirmado con Jose antes de escribir las migraciones.

**Consecuencias / trade-offs aceptados:** Los 21 pacientes sin nacionalidad y los pacientes sin
sexo definido van a seguir sin ese dato hasta que alguien los edite a mano — no hay backfill
forzado. `emergency_contact_name` queda como columna muerta hasta la limpieza posterior.

**Quién lo decidió:** con Jose (confirmado por chat antes de implementar).

---

## [2026-08-11] Ejercicios: se agrega "Programa" reutilizable (agrupa Planes) — corrige la decisión del 08-10

**Contexto:** El rediseño del 2026-08-10 (ver entrada de abajo) no era lo que el equipo había
pedido — feedback directo del usuario con una captura de referencia de otra app. El pedido real:
la Biblioteca de Ejercicios se organiza en 3 pestañas de primer nivel — Ejercicio, Plan, Programa
— y "Programa" tiene que ser algo que se arma en la biblioteca sin elegir paciente (no solo la
instancia del paciente), igual que Ejercicio y Plan.

**Opciones consideradas:**
1. Copiar la jerarquía completa de la referencia (Programas / Rutinas / Bloques / Prescripciones /
   Materiales / Cuestionarios — 6 secciones).
2. 3 niveles simples y reutilizables: Ejercicio → Plan (renombre de "Rutina") → Programa (nuevo,
   agrupa varios Planes), sin Bloques ni Prescripciones.

**Decisión:** Opción 2 — exactamente la "opción 2" que se había evaluado y descartado el 08-10
("Programa como plantilla reutilizable aparte"), ahora sí necesaria porque el pedido real del
usuario la pide explícitamente. Tablas nuevas `exercise_programs` / `exercise_program_routines`
(agrupan Planes con orden, sin paciente ni fechas). `exercise_routines` no se renombra a nivel DB
—solo cambia el texto de la UI a "Plan" (carpeta `src/components/exercises/plans/`)— para no
arriesgar nada ya verificado en producción. La instancia del paciente sigue siendo `exercise_plans`
(ahora con `program_id` además de `routine_id` para trazabilidad), relabeleada "Programa del
paciente" en la UI para no colisionar con el nuevo "Plan" reutilizable.

**Por qué:** El usuario confirmó explícitamente (2 rondas de preguntas) que quería un nivel
reutilizable de verdad, no solo la instancia del paciente — y que la clasificación
Activo/Activo asistido/Fortalecimiento (que ya existía como pestañas) pasa a ser un filtro dentro
de la pestaña Ejercicio, no pestañas separadas.

**Consecuencias / trade-offs aceptados:** Vocabulario "Plan" ahora se usa para dos cosas
distintas en la app si se mira sin contexto (el "Plan de tratamiento" de la ficha clínica, y el
"Plan" reutilizable de la Biblioteca de Ejercicios) — mitigado con nombres de tipo específicos en
el código (`ExercisePlanTemplate`, no `Plan` a secas) y porque en la UI aparecen en secciones
claramente distintas. Migraciones nuevas (`20260811100000`, `20260811110000`) quedan pendientes
de que Jose las corra — hasta entonces la pestaña Programas muestra un error de tabla inexistente
mostrado con degradación grácil (no rompe la página).

**Quién lo decidió:** El usuario, corrigiendo el rediseño del 08-10 (con Claude, en modo plan).

---

## [2026-08-10] Ejercicios: 3 niveles (Ejercicio → Rutina → Programa), Programa como instancia única por paciente

**Contexto:** Terminología confusa en el equipo (ejercicio/prescripción/bloque/rutina/programa)
al armar el plan de ejercicios domiciliarios de un paciente. Se acordó en reunión simplificar
a 3 niveles claros y armar un flujo de 3 pasos para aplicar una rutina a un paciente.

**Opciones consideradas:**
1. Programa como instancia única por paciente: Rutina = plantilla reutilizable (sin tiempo);
   Programa = lo que nace al aplicar una Rutina a un paciente puntual, con su propia fecha/duración.
2. Programa como plantilla reutilizable aparte (biblioteca de programas con rutina + duración
   sugerida por defecto, instanciable en varios pacientes).

**Decisión:** Opción 1. `exercise_routines`/`exercise_routine_items` son la única plantilla
reutilizable (sin paciente ni fechas). `exercise_plans` (ya existente) suma `start_date`,
`duration_weeks` y `routine_id` (trazabilidad) y pasa a tener `UNIQUE(patient_id)` — el paciente
siempre tiene un único plan/programa, reforzado a nivel DB (antes era solo convención de UI vía
`.maybeSingle()`, sin constraint real). Aplicar una rutina copia sus ítems al plan del paciente
vía el RPC `add_routine_to_exercise_plan` (crea el plan si no existe, o le suma ítems si ya
existe) — las cantidades quedan editables por paciente sin tocar la plantilla.

**Por qué:** Es el alcance que el equipo definió en la reunión; no hay necesidad hoy de un
programa reutilizable separado de la rutina, y mantener "1 plan por paciente" es más simple de
razonar en la UI (`EjerciciosTab`) que un historial de programas por paciente.

**Consecuencias / trade-offs aceptados:** No hay historial de programas — aplicar una rutina
nueva se suma/actualiza sobre el plan existente del paciente, no crea uno paralelo. Si en el
futuro se necesita reutilizar un "programa completo" (rutina + duración default) entre pacientes,
o versionar programas en el tiempo, es un cambio de modelo más grande (evaluado y descartado por
ahora, ver opción 2).

**Quién lo decidió:** con Jose (reunión de equipo, resumen pasado el 2026-08-10).

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
