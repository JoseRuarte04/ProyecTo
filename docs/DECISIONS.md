# DECISIONS — HisTO

> Registro de decisiones de arquitectura/producto. La idea NO es documentar todo
> el código (para eso está el código y los comentarios) sino el "por qué"
> detrás de decisiones que en 2 meses vas a olvidar y vas a querer revertir
> sin saber que ya las probaste.

Formato: copiar el bloque de abajo por cada decisión. 5 minutos, no más.

---

## [2026-10-07] Funciones `SECURITY DEFINER` validan pertenencia por dentro + QA previo al push contra una base local

**Contexto:** al probar un pendiente de `TASKS.md` (compañeros de equipo no podían
generar el link de QuickDASH) se encontró que `create_quickdash_token` no verificaba
que `p_patient_id` fuera el paciente de la sesión. Con SU sesión un profesional podía
generar el link para el paciente de OTRO, y `complete_quickdash_token` escribía una
`functional_evaluations` en esa ficha ajena. El PR #31 (2026-10-02) había cerrado
solo la puerta directa (la policy de INSERT de la tabla), no esta función, que se
salta el RLS.

**Decisión:** (1) `create_quickdash_token` exige `session.patient_id = p_patient_id`
y `is_my_patient(...)` (cubre dueño directo y equipo) — migración
`20261007100000_create_quickdash_token_team_and_patient_check.sql`. (2) Regla de
revisión: al cerrar un hueco de RLS en una tabla, revisar también toda función
`SECURITY DEFINER` que escriba en ella. (3) Se arma un QA previo al push contra una
base Supabase local en Docker (skill local `/qa-precision`, NO versionada, vive en
`~/.claude/`). Esto **no** contradice el descarte de Docker del 2026-10-06 (ese era
para CI y deploy): acá es solo una herramienta local para validar cambios antes del push.

**Por qué:** las funciones `SECURITY DEFINER` son una puerta alternativa a la tabla y
los tests de RLS que solo ejercitan la tabla no la ven. La base local (baseline del
schema real + seed ficticio) permite probar RLS por rol y la UI sin tocar producción.
Las migraciones del repo no crean 22 de las 38 tablas (origen Lovable), por eso el
baseline sale de un `supabase db dump` y no de `supabase start` con el historial.

**Alternativas descartadas:** probar contra el proyecto real (riesgo para datos de
pacientes en beta) y una branch de Supabase (costo no verificado, depende de red).

---

## [2026-10-06] Prep de beta: auditoría de `profile_role` — sin escalada de privilegios

**Contexto:** antes de invitar a ~30 profesionales reales, Jose pidió auditar si
`profile_role` (enum `professional`/`admin`/`patient`) se puede escalar desde el
cliente — por ejemplo vía `raw_user_meta_data` en el signup.

**Decisión:** no se encontró ninguna vulnerabilidad, así que no se abrió un PR de
"prioridad antes que los demás" como estaba previsto si se encontraba algo. Se
dejó un solo nice-to-have en `TASKS.md` (policy de INSERT de `profiles` sin el
mismo candado que la de UPDATE, no explotable hoy).

**Por qué:** revisado en vivo contra el proyecto real — `handle_new_user` inserta
`role` hardcodeado a `'professional'` (nunca lee metadata del cliente); la policy
de UPDATE de `profiles` fuerza `role = 'professional'` en el `WITH CHECK` de
cualquier edición propia; `admin_users` no tiene ninguna policy de
INSERT/UPDATE/DELETE (nadie puede escribir ahí vía API). Las tres capas
independientes cierran el camino.

---

## [2026-10-06] Prep de beta: consentimiento con tabla propia + gate, no una columna

**Contexto:** con pacientes reales en camino, hace falta consentimiento explícito
de privacidad al registrarse — y una forma de no dejar afuera a usuarios ya
existentes ni a futuros cambios de la política.

**Decisión:** `privacy_consents` es una tabla aparte (append-only, nunca se
edita/borra una fila), no una columna en `profiles`. Un gate en `AppLayout.tsx`
(no en `AdminLayout`) bloquea a cualquier usuario sin fila para la versión
vigente (`CURRENT_PRIVACY_POLICY_VERSION`), además del checkbox en los 2 flujos
de registro. Ese constante vive en un archivo separado
(`privacyPolicyVersion.ts`) sin imports de Vite, para que `e2e/globalSetup.ts`
lo pueda leer sin romper (Playwright no pasa por `import.meta.env`).

**Por qué:** una columna solo guarda la última aceptación — una tabla deja
historial de qué versión aceptó cada uno y cuándo, útil si algún día hay que
demostrarlo. El gate (no solo el checkbox al registrarse) es necesario porque en
el flujo de invitación de equipo el `signUp()` no devuelve sesión activa hasta
confirmar el email, así que el insert en ese momento no siempre es posible — el
gate es el mecanismo que realmente garantiza que nadie entra sin haber
aceptado, para usuarios nuevos y para los que ya tenían cuenta antes de esta
feature.

---

## [2026-10-06] Prep de beta: backups con pg_dump plano, no `-Fc` ni `supabase db dump`

**Contexto:** el plan free de Supabase no tiene backups automáticos. Hacía falta
un mecanismo propio, con la base y los archivos de Storage, probado de verdad
antes de confiar en él.

**Decisión:** `pg_dump` en formato plano (no `-Fc`/custom) vía la imagen oficial
`postgres:17` (no el `pg_dump` de apt de `ubuntu-latest`, para que la versión
coincida con la real). Se probó el pipeline completo contra `supabase start`
con un schema **sintético** (no el real).

**Por qué:** formato plano se puede inspeccionar con `grep` (de hecho el workflow
falla explícito si no encuentra `auth.users` en el dump) y restaurar con `psql`
sin `pg_restore`. Se descartó usar el schema real para la prueba porque
`supabase start` no levanta hoy con el historial de migraciones del repo —
`20260406150452_...sql` referencia `exercise_library` antes de crearla (bug
preexistente, no de este cambio, ver `TASKS.md`). Restaurar el dump plano sobre
un `supabase start` ya inicializado tira errores de "must be owner"/"already
exists" para tablas internas de Supabase (`auth.sso_domains`, etc.) —
confirmado que son inofensivos, los datos reales (incluido `auth.users`) se
restauran igual. `--no-privileges` no incluye los `GRANT` a
`anon`/`authenticated`/`service_role`, pero en el proyecto real esos grants ya
existen por las migraciones aplicadas, no dependen del dump — solo hizo falta
re-otorgarlos a mano en la prueba porque la tabla sintética no pasó por una
migración real. El criterio de éxito de la prueba fue login real + ver los
datos vía RLS + archivo restaurado byte a byte, no solo "existen filas".

---

## [2026-10-06] Seguridad: passwords de usuarios de prueba fuera del repo

**Contexto:** las passwords de `rls-test-a/b@example.com` estaban hardcodeadas en texto
plano en `src/test/rls.test.ts` desde el 2026-07-16 (commit `bf4672b`) y se duplicaron en
`e2e/supabaseTestClient.ts` al armar el piloto de e2e — en un repo **público** en
GitHub. Son credenciales reales de dos cuentas activas en el Supabase de producción, no
datos ficticios: cualquiera con el link al repo podía loguearse como esos usuarios.

**Decisión:** las passwords salen del código y pasan a `RLS_TEST_USER_A_PASSWORD` /
`RLS_TEST_USER_B_PASSWORD` — GitHub Secrets en CI, `.env` local (gitignorado) en
desarrollo. Los emails se quedan hardcodeados (identifican la cuenta, no dan acceso).
`vitest.config.ts` usa `loadEnv` de Vite (sin prefijo `VITE_`, sin dependencia nueva) para
exponerlas vía `process.env` también en desarrollo local.

**Por qué:** el email no es secreto, la password sí. Se evitó agregar `dotenv` u otra
dependencia porque `vite` (ya instalado) expone exactamente lo que hacía falta. Las
passwords **no llevan prefijo `VITE_`** a propósito — ese prefijo significa "seguro para
el bundle del cliente" en este repo (ver `.env.example`) y estas nunca deberían sugerir
esa idea, aunque de hecho nunca se bundlean (el archivo de test no se importa desde
`main.tsx`/`App.tsx`). **Pendiente, fuera del alcance de este cambio:** rotar las
passwords reales en el dashboard de Supabase — ya estuvieron expuestas 3 meses en
público, moverlas a secrets no revierte esa exposición pasada.

---

## [2026-10-06] DevOps pendientes: CD, e2e en CI y Supabase free

**Contexto:** se analizaron las capas de DevOps que le faltaban a ProyecTo contra un
checklist tipo facultad (contenedores, planificación, CD con ambientes, e2e en CI, IaC,
observabilidad). Dos ya estaban resueltas sin que se supiera (Sentry desde el
2026-07-16, trazabilidad PR↔tarea ya en la práctica). Quedaban por decidir: el gate de
CD (hoy merge a `main` = deploy directo a producción real con pacientes reales, sin
ambiente intermedio) y si wirear el piloto de e2e (#43) a `ci.yml` (corre contra
Supabase real).

**Decisión:**
1. Branch protection de `main`: se agregó `required_status_checks` exigiendo que el
   check `ci` pase antes de poder mergear (antes no estaba, en teoría se podía mergear
   con CI en rojo).
2. Supabase se queda en plan **free** — no se evalúa upgrade a Pro por ahora. Esto
   implica que no hay branching real (bases de datos aisladas por PR); el check
   `Supabase Preview` que aparece en cada PR siempre da "skipping" porque el plan free
   no lo soporta.
3. El piloto de e2e (#43) se suma a `ci.yml` (job `e2e`) corriendo contra Supabase real
   de producción, con su propio `concurrency` group para evitar que dos PRs activos a
   la vez se pisen sobre el paciente/sesión de prueba fijos. Arranca como check **no
   bloqueante** (no se agregó a `required_status_checks`) — se promueve a bloqueante
   más adelante si se ve estable en corridas reales.

**Por qué:** sin plan Pro de Supabase, la única opción realista de gate es el check de
CI + Preview Deployments de Vercel (que ya existían) — no vale la pena pagar un
ambiente de preview con DB aislada para el volumen de PRs actual (solo Jose + Javito).
Para el e2e, el riesgo de pegarle a producción se aceptó porque el piloto ya está
diseñado para no ensuciar datos (paciente con DNI fijo reusado, sesión con soft-delete
en `afterAll`) — pero como es nuevo y depende de un servicio real, arranca informativo
en vez de bloqueante hasta probar que es estable.

---

## [2026-10-06] Descartado: Docker / docker-compose para desarrollo local

**Contexto:** se evaluó contenerizar ProyecTo (Dockerfile para el front +
docker-compose para levantar todo local con un comando) como parte de un checklist de
DevOps "completo", aunque el deploy real es serverless (Vercel + Supabase) y no iba a
usarse para eso.

**Decisión:** no se hace. El Supabase CLI (`supabase start`) ya levanta
Postgres+Auth+Storage local con un solo comando — es el mismo beneficio práctico que
se buscaba con `docker-compose`, sin mantener Dockerfiles a mano.

**Por qué:** escribir y mantener Dockerfiles para replicar algo que la herramienta
oficial del stack ya da gratis es trabajo sin beneficio real. Solo tendría sentido si
en algún momento se abandona Vercel/Supabase — no está en el radar.

---

## [2026-10-02] Proceso: toda sesión de Claude Code arranca en su propio git worktree

**Contexto:** el choque de sesiones concurrentes sobre el mismo checkout ya pasó varias veces (2026-09-23: dos sesiones arreglaron el mismo bug de overflow en paralelo sin saberlo; 2026-10-02: la auditoría de seguridad corrió en paralelo con otra sesión que mergeó los PRs #27/#28/#29 sin que ninguna se enterara de la otra, y PROJECT_STATE.md quedó desincronizado por eso). Hasta ahora la regla era "mover el trabajo a un worktree aislado si a mitad de camino se detecta otra sesión activa" — reactivo, depende de notarlo.

**Decisión:** la regla pasa a ser proactiva — toda sesión nueva arranca en su propio `git worktree` (`.claude/worktrees/<nombre-de-la-tarea>`) antes de tocar cualquier archivo o crear una rama, sin excepción, no solo cuando se detecta el choque. Agregado a `CLAUDE.md`.

**Por qué:** detectar el choque a mitad de camino depende de que alguien se dé cuenta (un archivo sin commitear ajeno, un dev server ocupado) — no es confiable. Arrancar siempre aislado elimina la clase entera de problema en vez de mitigarlo caso por caso, y deja el checkout principal libre para que Jose lo use directamente sin que una sesión se lo pise.

---

## [2026-10-01] Turnos: ausencias cuentan solo "Ausente"; semáforo por patologia con el nivel más alto

**Contexto:** Jose pidió en Configuraciones > Turnos (1) un máximo de ausencias por paciente que advierta al dar turno y (2) un semáforo de prioridades por patologia.

**Decisión:** (1) Solo suman los turnos en estado `absent`; `absent_with_notice` no suma. La advertencia no bloquea el guardado. (2) Tres niveles (rojo/amarillo/verde) asignados a patologias (CIE-10 o texto libre); un paciente toma el nivel más alto entre los diagnósticos de sus episodios activos, con coincidencia por código o por nombre. Ambas configs son personales o de equipo (solo admins editan), mismo patrón que `evaluation_settings`.

**Por qué:** una ausencia con aviso no es desinterés del paciente, y bloquear el turno le sacaría criterio a la terapista. El punto de color no se agregó al calendario semanal porque ya usa color por estado de turno.

---

## [2026-09-30] QuickDASH: de "por episodio" a "por sesión", con "gana el último guardado"

**Contexto:** QuickDASH vivía 100% fuera del wizard de sesión — un link público (`/q/:token`) que el paciente completaba, con el resultado atado a `quickdash_tokens.episode_id` (un solo QuickDASH vigente por todo el tratamiento). Jose pidió integrarlo al wizard para que el profesional también pudiera completarlo, igual que Barthel/FIM (que sí son por sesión).

**Opciones consideradas:**
1. Dejar el link por episodio como está y agregar un botón en el wizard que solo muestre el resultado ya completado (de solo lectura).
2. Pasar QuickDASH a ser por sesión (como Barthel/FIM), con dos vías para completarlo en esa sesión puntual — el profesional en el wizard, o un link nuevo para el paciente atado a esa sesión — y que gane el que se guarde último.
3. Mantener ambos flujos en paralelo (por episodio para el link histórico, por sesión para lo que complete el profesional), mostrando los dos.

**Decisión:** Opción 2, confirmada con Jose en dos rondas de preguntas. Se aprovechó que `functional_evaluations` ya tenía las columnas `quickdash_items`/`quickdash_score` sin usar (mismo lugar que Barthel/FIM) y que `quickdash_tokens.session_id` existía huérfano desde mayo (se había reemplazado por `episode_id` en su momento, migración `20260512000001`). Se revivió `session_id` como vínculo activo, se migró `create_quickdash_token` de `p_episode_id` a `p_session_id`, y `complete_quickdash_token` ahora además escribe en `functional_evaluations` de esa sesión. "Gana el último guardado" se resuelve sin lógica de prioridad: si el profesional no toca QuickDASH en el wizard, esa clave no se manda en el payload de guardado de la sesión, así que nunca pisa en `null` lo que el paciente haya completado por link mientras la sesión seguía abierta.

**Alternativas descartadas:** la 1 no resolvía el pedido de Jose (quería que el profesional pudiera completarlo, no solo verlo). La 3 se descartó porque dejaba dos lugares distintos completando el mismo cuestionario con alcances distintos (episodio vs. sesión) — confuso para el día a día y para los gráficos de evolución, que tuvieron que migrar de leer `quickdash_tokens` a leer `functional_evaluations`.

**Efecto colateral:** el flujo viejo por episodio (tab "QuickDASH" en la pestaña Evaluaciones, `QuickDashEpisodeSection.tsx`) quedó redundante y se borró junto con `QuickDashTokenManager.tsx` (que ya estaba huérfano, sin usar en ningún lado). `quickdash_tokens.episode_id` no se borró de la tabla — sigue ahí para no romper el historial de tokens viejos, aunque ya no es el vínculo activo (candidato de limpieza en `TASKS.md`).

## [2026-09-23] Sesiones concurrentes de Claude Code en el mismo repo: aislar en git worktree

**Contexto:** Al arrancar la tarea de mobile se encontró que había otra sesión de Claude Code activa en el mismo checkout del repo (`/Users/jruarte/Documents/1. Proyectos CC/Proyectito`) — mismo dev server en el puerto 8080 ("Port 8080 is in use by another chat's dev server"), y un cambio sin commitear en `docs/TASKS.md` que no se había hecho en esta sesión. Un `git checkout main` + `git checkout -b` ya ejecutados habían cambiado la rama del checkout compartido antes de notar el problema — riesgo real de pisarle el working directory a esa otra sesión (formularios, estado del dev server, HMR).

**Opciones consideradas:**
1. Seguir trabajando en el checkout compartido, asumiendo que la otra sesión ya no está activa.
2. Mudar el trabajo a un git worktree aislado (`EnterWorktree`), con su propio `npm install`, `.env` copiado y dev server en otro puerto — sin volver a tocar el checkout compartido.
3. Pausar todo hasta confirmar manualmente qué es esa otra sesión.

**Decisión:** Opción 2, confirmada con Jose. Al intentar revertir el checkout compartido a su rama original (`fix/obras-sociales-alta-y-diseno`) para minimizar el daño, el clasificador de auto mode del harness bloqueó el comando (`Interfere With Workloads`) — confirmando que había actividad real detectada ahí. El checkout compartido quedó en la rama `fix/mobile-nav-y-listados` (creada por esta sesión, sin commits) con el cambio ajeno de la otra sesión todavía sin commitear encima; no se pudo revertir. Todo el trabajo de esta tarea se hizo en el worktree (`fix/mobile-nav-bottombar`), sin volver a tocar el checkout principal.

**Alternativas descartadas:** la 1 quedó descartada por el riesgo confirmado (el propio harness bloqueó la reversión); la 3 hubiera pausado la tarea sin necesidad, dado que el worktree resuelve el aislamiento sin esperar.

**Para la próxima vez:** si el dev server o `git status` muestran señales de otra sesión activa en el mismo directorio, mudar a un worktree ANTES de tocar ramas en el checkout compartido (no después) — evita el problema en vez de tener que repararlo a medias.

## [2026-09-23] Config de evaluaciones habilitadas: una tabla con `owner_type` en vez de dos, y `isEditMode` como proxy de "sesión finalizada"

**Contexto:** Pedido: un botón en el sidebar para que cada Terapista active/desactive qué evaluaciones (Barthel, FIM, las 8 sub-secciones de Eval. analítica, etc.) se muestran en el wizard de sesiones, porque hay demasiadas y varían según especialidad. En la aclaración con el usuario, la preferencia declarada fue "ambos [personal y equipo], el de equipo es de primer nivel (prioridad)" — y para el caso de datos ya cargados en una escala que se deshabilita después, "si es una sesión ya finalizada se muestra los datos".

**Decisión 1 — modelo de datos:** una sola tabla `evaluation_settings` con `owner_type` (`'professional'|'team'`) + `owner_id`, en vez de dos tablas separadas (`personal_evaluation_settings`/`team_evaluation_settings`) o una columna `enabled_evaluations jsonb` en `teams`/`profiles`. Se eligió porque reutiliza exactamente el mismo patrón nullable que ya usa `patients.team_id` (personal vs. equipo, mutuamente excluyente según el `workspace` activo de `WorkspaceContext`) — así el caso personal queda resuelto desde el día uno sin esperar una "fase 2", sin necesitar tampoco ninguna lógica de merge entre capas (cada `owner` tiene su propia fila, no hay "override sobre default"). Trade-off aceptado: si más adelante se pide que un profesional pueda personalizar su vista *dentro* de un equipo (override individual sobre el default del equipo), esta tabla no lo resuelve tal cual — haría falta una segunda capa de resolución (leer team primero, después buscar override personal). Anotado como candidato en `TASKS.md`, no se construyó preventivamente porque no fue pedido.

**Decisión 2 — no reciclar `analytical_evaluations.sections_config`:** esa columna (jsonb, desde la migración `20260601000000`) ya estaba reservada con el comentario "JSON con el estado visible/oculto de cada sección" pero nunca se conectó a ningún componente. Se descartó reusarla porque vive en la tabla de datos *de una sesión concreta* (por paciente/sesión), no del espacio de trabajo del profesional — no tiene forma de expresar "esto aplica a todo mi equipo para toda sesión futura". Queda deprecada sin borrar (mismo criterio que otras columnas muertas ya documentadas).

**Decisión 3 — "sesión finalizada muestra los datos igual" se resolvió con `isEditMode`, no con un chequeo dato-por-dato:** la alternativa más fiel al pedido sería, por cada una de las 12 escalas, chequear si esa escala específica ya tiene contenido cargado (`barthel_answered`, `pains.some(...)`, etc.) y mostrarla igual si es así, sin importar el toggle. Se descartó por ahora: `SessionForm.tsx` ya supera las 1000 líneas con ~80 campos de estado, y replicar esa lógica "answered" (que hoy solo existe inline en `handleSave`, línea ~800) para las 12 escalas en el punto de render habría sido una superficie de cambio grande y fácil de desalinear con el `handleSave` real. En su lugar, `showEval(key) = isEditMode || settings[key]`: al editar una sesión ya guardada (`isEditMode`) se muestran **todas** las evaluaciones sin importar el toggle, no solo las que tienen datos. Es la señal disponible más cercana a "finalizada" porque el modelo no tiene un estado de sesión server-side (`therapy_sessions` no tiene `status`; toda sesión guardada se reabre con el mismo wizard editable, no hay una vista de solo lectura separada). Trade-off aceptado: al editar una sesión vieja se puede ver alguna escala vacía que el profesional ya no usa — nunca se oculta un dato real, que era el requisito no negociable.

**Alternativas descartadas:** granularidad a nivel de test individual dentro de "Pruebas específicas" (Finkelstein/Phalen/etc. por separado) — se descartó por exceso de superficie para un v1 sin pedido explícito de esa profundidad; queda anotado en `TASKS.md` si el uso real lo pide.

**Quién lo decidió:** Javier (por chat, tras 3 preguntas de aclaración sobre granularidad, alcance personal/equipo y comportamiento con datos existentes).

---

## [2026-09-18] Guard de borrado de obras sociales: RPC `SECURITY DEFINER` en vez de count desde el cliente

**Contexto:** Al agregar editar/borrar al catálogo de obras sociales (pedido: "si ya está utilizada, no se puede eliminar"), el chequeo obvio era un `count` desde el cliente sobre `patients` filtrando por `insurance`. Pero `patients` tiene RLS scoped por profesional/equipo (policy "patients: ver") — un profesional cualquiera solo ve sus propios pacientes o los de su equipo. `obras_sociales`, en cambio, es un catálogo 100% compartido entre TODOS los profesionales del sistema (sin dueño, confirmado en la migración de alta del 2026-09-16). Un count scoped por RLS hubiera dejado borrar una obra social que sí está en uso, con tal de que sea un paciente de *otro* profesional el que la tiene cargada — el guard hubiera fallado silenciosamente en el caso exacto para el que se pidió.

**Opciones consideradas:**
1. Count directo desde el cliente sobre `patients` (simple, pero con el hueco de RLS de arriba).
2. RPC `SECURITY DEFINER` que hace el count bypaseando RLS, igual que `is_active_professional()` ya bypasea RLS sobre `profiles` para sus propios chequeos.
3. No hacer guard scoped al sistema completo y aceptar el riesgo (documentarlo como limitación conocida).

**Decisión:** Opción 2 — `obra_social_usage_count(p_name text)`, `SECURITY DEFINER`, `SET search_path TO public`, grant solo a `authenticated`. Se eligió sobre la opción 1 porque el pedido explícito era que el guard funcione de verdad, no una aproximación; y sobre la opción 3 porque el hueco no es un edge case raro — el producto ya tiene equipos con pacientes de distintos profesionales conviviendo en la misma base. Nota: `Exercises.tsx` tiene el mismo tipo de guard pero scoped por RLS (sin RPC) — no se tocó en esta sesión por estar fuera de alcance, pero es candidato a revisar con el mismo criterio si se prioriza (ver `TASKS.md`).

**Alternativas descartadas:** ninguna especial — la 1 y la 3 quedaron descartadas por el motivo de arriba, no hubo otra opción evaluada en profundidad.

---

## [2026-09-18] Migraciones aplicadas directo a producción sin commit mergeado — blindaje y orden de merge de los PRs de Javito

**Contexto:** Al revisar los 6 PRs abiertos de Javito (#13-#18) aparecieron dos problemas
independientes: (1) `#15`→`#16`→`#17` eran ramas apiladas — cada una contenía todos los commits
de la anterior, así que mergear cualquiera "de punta" hubiera traído sin review el trabajo de
las de abajo bajo un título engañoso; (2) las migraciones de `#13`/`#17` (`patients.document_type`)
y `#14`/`#18` (`obras_sociales.full_name`) ya estaban aplicadas directo contra Supabase de
producción (`pvuaqatdendcgumwktid`) en sesiones anteriores, sin que el commit correspondiente
llegara a mergearse a `main` — confirmado por Jose contra la base real. El PR #18 traía además
un backfill de 30 obras sociales que resultó estar en el mismo caso.

**Opciones consideradas:**
1. Migraciones ya aplicadas: mergear los PRs tal cual (con `ADD COLUMN`/`CREATE POLICY` sin
   guardas) vs. blindarlas con `IF NOT EXISTS`/`DROP...IF EXISTS` antes de mergear.
2. Ramas apiladas: mergear cada PR tal cual viene (trayendo commits duplicados/ya mergeados)
   vs. rebasar cada una sobre `main` una vez mergeada su base, para que el diff de cada PR
   refleje solo su trabajo propio.
3. Duplicados en `obras_sociales.name`: no hacer nada vs. agregar protección antes de mergear
   el alta de obra social nueva desde la UI (`#14`).

**Decisión:**
1. Se blindaron ambas migraciones (`20260916100000_patients_document_type.sql`,
   `20260916110000_obras_sociales_full_name.sql`) con `ADD COLUMN IF NOT EXISTS` y
   `DROP CONSTRAINT/POLICY IF EXISTS` antes de `ADD`/`CREATE` (Postgres no soporta
   `ADD CONSTRAINT IF NOT EXISTS` ni `CREATE POLICY IF NOT EXISTS`, así que el idiom es
   drop-y-recrear). Así el merge no rompe ni contra la producción actual ni contra una base
   reconstruida desde cero.
2. Se rebasó `#16` sobre `main` recién mergeado `#15`, y `#17` sobre `main` recién mergeado
   `#16` — cada PR quedó solo con sus commits propios antes de mergear. Se avisó en cada PR
   antes del force-push (rebase reescribe historia; si Javito estaba trabajando sobre esa
   rama vieja, tenía que enterarse antes de que se pisara).
3. Se agregó `CREATE UNIQUE INDEX ... ON obras_sociales (lower(name))` (verificado antes que
   no había duplicados case-insensitive previos) más el manejo del error `23505` en el
   cliente para un mensaje claro en vez del error crudo de Postgres. Se descartó un chequeo
   solo-cliente porque es racy (dos altas simultáneas pasan la validación antes de que
   cualquiera de las dos inserte); el índice en DB es la única guarda real.
4. Orden de merge: `#15` → `#16` → `#17` → `#14`. Cerrados sin mergear `#13` (superado por
   `#17`) y `#18` (superado por `#14`), con comentario y link al reemplazo en cada uno. El
   backfill de 30 obras sociales de `#18` se recuperó en un PR nuevo (`#19`) solo de datos,
   porque también ya estaba aplicado en producción.

**Por qué:** El objetivo era que el merge de git y el estado real de Supabase quedaran
consistentes de nuevo, sin perder ningún dato ya cargado ni romper un ambiente nuevo que
corra las migraciones desde cero. El rebase de la cadena evita que un PR (`#17`) termine
mergeando sin review el contenido de otros dos (`#15`/`#16`) bajo un título que no lo menciona.

**Consecuencias / trade-offs aceptados:** El historial de migraciones de Supabase
(`list_migrations`) no coincide con los timestamps de los archivos del repo para
`document_type`, `full_name` ni `exercise_programs` (este último, de una sesión anterior al
2026-08-11) — quedaron aplicadas bajo otra versión o directamente sin registro. No rompe nada
hoy porque los archivos relevantes del repo ya son idempotentes, pero es un desfasaje real
entre repo y base — candidato de limpieza dedicada en `TASKS.md`, no resuelto en esta sesión.

**Quién lo decidió:** Jose (por chat, guiando cada paso hasta autorizar merge/cierre autónomo).

---

## [2026-09-15] Barthel con opciones visibles + Evaluación analítica en acordeón — FIM excluido

**Contexto:** A Jose le gustó el patrón de UI de la nueva Evaluación funcional (apartados que
se despliegan mostrando todo, sin "activar" nada) y pidió llevarlo a Barthel (mostrar todas las
opciones en vez de un `<select>` oculto) y a Evaluación analítica (acordeón en vez de switches
de "Mostrar en evaluación" por sub-sección).

**Opciones consideradas:**
1. Aplicar el mismo cambio de "todas las opciones visibles" a FIM (mismo problema que Barthel:
   `<select>` oculto).
2. Para Evaluación analítica: mantener el guardado de qué sub-sección estaba abierta/cerrada
   (persistir en DB) vs. no guardarlo y que arranque siempre colapsado.

**Decisión:**
1. FIM queda como está (select) — se descarta por ahora. FIM tiene 7 opciones con etiquetas
   largas (ej. "Asistencia máxima (aporta 25% o más)") × 18 ítems; mostrarlas todas como botones
   se vería muy cargado, a diferencia de Barthel que tiene 2-4 opciones cortas × 10 ítems.
   Anotado en `TASKS.md` con una idea de diseño más compacta (círculos numerados 1-7 con
   tooltip) para si se quiere retomar.
2. El estado abierto/cerrado de cada sub-sección de Evaluación analítica NO se persiste —
   confirmado con Jose que no hace falta, arranca siempre colapsado como Evaluación funcional.

**Por qué:** Se verificó en el código que los switches "Mostrar en evaluación" de hoy son
puramente visuales (no afectan qué datos se guardan), así que el cambio a acordeón no tiene
ningún costo de compatibilidad de datos — se pudo simplificar limpiamente.

**Consecuencias / trade-offs aceptados:** `analytical_evaluations.sections_config` queda
deprecada (dejó de escribirse, columna sin borrar). FIM sigue con la UX de select oculto,
inconsistente con Barthel — aceptado hasta que se diseñe una versión compacta.

---

## [2026-09-16] Editar ficha recortado a los campos del alta — 4 columnas clínicas deprecadas

**Contexto:** Javito pidió mover el botón "Editar ficha" (vivía solo dentro de la pestaña Ficha
Clínica) al lado del nombre del paciente, y que el diálogo deje de tener todos los campos
clínicos/ocupacionales que acumuló con el tiempo — solo los que pide el alta de paciente.

**Opciones consideradas:**
1. Qué hacer con los campos clínicos que no están en el alta pero sí en el diálogo de edición
   (tipo de tratamiento, fechas de lesión/cirugía, inmovilización, tratamiento farmacológico,
   estudios, antecedentes, inicio de síntomas, tratamiento actual, próximo turno OyT, notas
   clínicas): sacarlos sin más, o revisar primero si tenían otra vía de edición.
2. Qué hacer con Perfil ocupacional (lateralidad, estado civil, nivel educativo, trabajo, red de
   apoyo), que tampoco está en el alta.

**Decisión:**
1. Se investigó antes de borrar: el paso "Ficha clínica" del wizard de sesión (`FichaClinicaStep.tsx`)
   solo aparece en la sesión de Admisión (`isAdmission`), pero esa sesión se puede reabrir después
   con "Editar sesión" (`SessionTimeline.tsx`) — por ahí siguen siendo editables fecha de lesión,
   fecha de cirugía, mecanismo de lesión, tipo de tratamiento, estudios, antecedentes e
   inmovilización, y tratamiento farmacológico. Esos se sacaron del diálogo de Editar ficha sin
   pérdida real de funcionalidad.
2. Inicio de síntomas, tratamiento actual, próximo turno OyT y notas clínicas **no** se cargan en
   ningún otro lado — se decidió borrarlos igual, con la aprobación explícita de que no hace falta
   poder editarlos. Se sacaron tanto del formulario de edición como de la vista de solo lectura de
   Ficha Clínica (dejarlos ahí, de solo lectura y sin forma de corregirlos, no tenía sentido).
3. Perfil ocupacional se saca del diálogo — ya se edita en dos lugares a propósito desde el
   2026-09-15 (Ficha y paso de Admisión de la sesión), este cambio deja solo el segundo.
4. El botón "Editar ficha" pasa de la pestaña Ficha Clínica a un ícono junto al nombre del
   paciente en el header de `PatientProfile.tsx`, visible desde cualquier pestaña.

**Por qué:** El diálogo había crecido con el tiempo hasta duplicar casi toda la Ficha Clínica
además del alta, lo que lo hacía largo y confuso para una edición rápida de datos básicos. Separar
"corrección rápida de datos personales/contacto" (Editar ficha) de "carga clínica detallada"
(sesión de Admisión) es más claro para el flujo real de uso.

**Consecuencias / trade-offs aceptados:** `patient_clinical_records.symptom_start_date`,
`current_treatment`, `next_oyt_appointment` y `notes` quedan deprecadas (sin UI en ningún lado,
columnas sin borrar). Si en el futuro hace falta cargar alguno de estos 4 datos, hay que agregar
UI nueva desde cero — no hay ninguna pantalla que los toque hoy.

**Quién lo decidió:** con Jose (confirmado por chat antes de implementar).

---

## [2026-09-15] Fix de queries con error silencioso: priorizar impacto real, no cobertura total

**Contexto:** Tras una pasada de QA completa de la app (que no encontró bugs de consola), Jose pidió
retomar un hallazgo ya documentado en `TASKS.md` desde julio: "14 queries ignoran el error
silenciosamente". Al ir a arreglarlas, el grep dio ~30 sitios con el mismo patrón (el código
creció bastante desde julio), no 14.

**Opciones consideradas:**
1. Arreglar los ~30 sitios a ciegas con el mismo `toast.error` mecánico.
2. Auditar cada uno, clasificar por riesgo real, y arreglar solo los de mayor impacto.

**Decisión:** Opción 2. Se clasificaron los sitios en: (a) pérdida de datos real — `fetchEpisodeDiagnoses`
podía dejar que un guardado borrara diagnósticos existentes si la carga fallaba en silencio (el
guardado hace un reemplazo completo); (b) carga principal de página que queda en blanco sin aviso
— `PatientProfile.tsx` (~11 queries en un solo fetch), vistas de detalle de evaluaciones, contextos
de Auth/Workspace, hooks del dashboard/equipos; (c) documento clínico generado incorrectamente sin
avisar — el PDF de plan de ejercicios se generaba "exitosamente" pero vacío si fallaba la carga de
ejercicios; (d) riesgo de doble turno — la consulta de turnos ocupados del día. Se dejaron sin tocar
~16 sitios de menor riesgo (autocompletes, chequeos de gating internos), anotados en `TASKS.md`.

Para los casos (a) y (c), en vez de solo agregar un toast, se cambió el comportamiento: la función
ahora tira el error (`throw`) en vez de devolver un valor vacío, y el caller decide qué hacer —
en diagnósticos, no tocar la lista guardada; en el PDF, no generarlo. En los demás casos (lecturas
de solo mostrar datos), se mantuvo el patrón simple: loguear + `toast.error` + seguir con datos
vacíos, sin bloquear la página.

**Por qué:** Arreglar 30 sitios mecánicamente hubiera sido un diff mucho más grande para revisar,
con el mismo riesgo de introducir un bug por prisa, a cambio de cubrir casos de bajo riesgo real
(un autocomplete que no encuentra resultados no es comparable a un guardado que borra datos).

**Consecuencias / trade-offs aceptados:** Quedan ~16 sitios con el patrón viejo sin arreglar —
documentados, no ocultos. Si alguno de esos resulta tener más impacto del estimado, hay que
revisarlo aparte.

**Quién lo decidió:** con Jose (el pedido fue "arreglalas", el criterio de priorización se decidió
en el momento de implementar y se documenta acá para que quede claro que no es una cobertura
completa).

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
