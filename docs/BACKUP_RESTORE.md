# Backups y restauración

> El plan free de Supabase no incluye backups automáticos (ni diarios ni PITR —
> eso es Pro+). Esto es la red de contención mínima mientras estemos ahí.

## Qué hace el workflow (`.github/workflows/backup.yml`)

Corre semanalmente (lunes) o manual (`workflow_dispatch`) — **nunca** en cada
push/PR, no tiene sentido en un workflow que toca producción.

1. `pg_dump` (formato plano, vía la imagen oficial `postgres:17` para que la
   versión coincida con la del proyecto real) contra el connection string
   directo — **incluye `auth.users`**, el job falla explícitamente si no lo
   detecta en el dump (`grep` de verificación, ver el workflow).
2. `scripts/backup-storage.mjs` descarga todos los archivos del bucket
   `clinical-files` (los blobs no están en el dump de Postgres — son objetos
   de Storage, hay que bajarlos aparte vía API con la `service_role` key).
3. Empaqueta dump + archivos en un `.tar` y lo cifra con `gpg --symmetric
   --cipher-algo AES256` usando una passphrase de un secret.
4. Sube el `.tar.gpg` como artifact (90 días de retención).

**Por qué cifrado obligatorio:** el repo es público — los artifacts de Actions
de un repo público los puede bajar cualquier usuario de GitHub logueado. Sin
cifrar, un backup con datos de pacientes reales quedaría ahí accesible.

## Secrets que necesita (no los crea Claude Code — los crea Jose)

**Viven en un GitHub Environment llamado `production-backup`** (restringido a la
rama `main`, lo crea Jose en Settings → Environments), no como repo secret —
así nunca pasan por Claude Code. El job referencia ese Environment
(`environment: production-backup` en `backup.yml`); la sintaxis `${{ secrets.X }}`
es la misma, GitHub la resuelve contra los secrets del Environment.

| Secret | Qué es | Dónde conseguirlo |
|---|---|---|
| `SUPABASE_DB_URL` | Connection string **directo** a Postgres (no el pooler) | Dashboard → Project Settings → Database → Connection string → "URI" (modo "Direct connection") |
| `SUPABASE_SERVICE_ROLE_KEY` | Key que salta **todo** el RLS — la más sensible del proyecto | Dashboard → Project Settings → API → `service_role` |
| `BACKUP_ENCRYPTION_PASSPHRASE` | Passphrase nueva, no reusar ninguna otra | Generarla con `openssl rand -base64 32` y guardarla aparte (si se pierde, los backups viejos quedan inservibles) |

**Flujo para correrlo contra producción:** Jose dispara el workflow a mano
(`workflow_dispatch`), descarga el artifact cifrado, lo descifra en su propia
máquina, y deja el `.tar` resultante (ya descifrado) en `backups.local/` en la
raíz del repo — esa carpeta cae bajo el patrón `*.local` que ya está en
`.gitignore`, no hace falta agregar nada. Claude Code nunca ve el connection
string ni la service_role key, solo el `.tar` ya descifrado.

## Probado dos veces: mecanismo con schema sintético, y pendiente el drill con el dump real

**Mecanismo (ya hecho, con datos sintéticos):** ver detalle abajo.

**Drill con el dump real de producción (pendiente, a correr cuando Jose pase el
`.tar` descifrado):** no depende de arreglar el drift de migraciones — el
escenario real de desastre es `supabase init` + `supabase start` en una carpeta
temporal **fuera del repo**, sin nuestras migraciones (un proyecto Supabase
nuevo nunca arranca replayando los archivos de migración de otro proyecto, así
que esto es representativo de lo que pasaría en un desastre real, no un
atajo). Mismo criterio de siempre: login real + ve sus pacientes + ve sus
archivos — ahora con el schema real en vez de una tabla sintética.

## Probado contra `supabase start` (stack local), nunca contra producción

Se armó una tabla y un usuario sintéticos (no el schema real — ver más abajo
por qué) y se corrió el pipeline completo: dump → backup de Storage → tar →
cifrado → **borrado de los datos originales** (simulando el desastre) →
descifrado → restore de la base → restore de Storage → **login real** con
ese usuario → confirmar que ve sus datos (vía RLS, no una consulta directa) →
confirmar que el archivo restaurado tiene el contenido correcto. Los 3 pasos
finales (login, RLS, archivo) son el criterio real de éxito — no alcanza con
que existan filas.

**Por qué con una tabla sintética y no el schema real:** al intentar
`supabase start` con las migraciones reales del repo se encontró un error
real y preexistente — `20260406150452_...sql` referencia `exercise_library`
antes de que la migración que la crea haya corrido, así que el stack local
no levanta desde cero con el historial de migraciones actual. Esto es el
mismo problema de drift de migraciones ya documentado en `TASKS.md`
("reconciliar el historial de migraciones de Supabase"), no algo nuevo de
este cambio — no se tocó nada de las migraciones reales para no mezclar un
problema con el otro. La prueba se hizo igual con una tabla+usuario propios
para validar el *mecanismo* (dump/restore/cifrado/Storage), que es
independiente de cuál sea el schema real.

### Hallazgos reales al restaurar sobre un `supabase start` ya inicializado

- **`psql -f db.sql` tira errores de "must be owner of table X" / "already
  exists" para tablas internas de Supabase** (`auth.sso_domains`,
  `storage.objects`, `realtime.messages`, etc.) — el stack local ya las creó
  al iniciar, con otro owner (`supabase_admin`, no `postgres`). **Son
  inofensivos**: psql sigue ejecutando el resto del archivo, y los datos
  reales (`auth.users`, las tablas de `public`) se restauran bien a pesar de
  esos errores — confirmado consultando después de restaurar.
- **`pg_dump --no-privileges` no incluye los `GRANT` a `anon`/`authenticated`/
  `service_role`** sobre tablas de `public`. En el proyecto real esto no es
  un problema porque esos grants ya existen por las migraciones aplicadas
  (no vienen del dump) — solo hizo falta re-otorgarlos a mano en esta prueba
  porque la tabla sintética se creó sin pasar por una migración real.
- Las **políticas de RLS sí se restauran** (`CREATE POLICY` no es un
  privilegio, pg_dump las incluye igual con `--no-privileges`) — confirmado
  con una consulta a `pg_policies` después de restaurar.
- Storage: el archivo se restaura byte a byte, pero **para que un usuario
  pueda descargarlo vía API hace falta que exista la policy de
  `storage.objects` correspondiente al bucket** (en este proyecto,
  `clinical_files_select` — mismo patrón de `(storage.foldername(name))[1] =
  auth.uid()::text` que ya usan `clinical_files_insert`/`update`, ver
  `supabase/migrations/20260429031828_*.sql`). En producción esa policy ya
  existe; en la prueba local hubo que agregarla a mano por lo mismo del punto
  anterior (schema sintético, sin pasar por las migraciones reales).

### Procedimiento de restauración real (producción → `supabase start` local)

1. `supabase start` (asume que el historial de migraciones se arregló — ver
   el pendiente de `TASKS.md`; si no, usar una rama/branch de Supabase con el
   schema real ya aplicado en vez de un `supabase start` desde cero).
2. Descifrar: `gpg --batch --yes --passphrase "$PASSPHRASE" --decrypt -o backup.tar backup.tar.gpg`
3. Extraer: `tar -xf backup.tar` (da `db.sql` + `storage/`)
4. Restaurar la base: `docker run --rm -v "$PWD:/backup" postgres:17 psql "$LOCAL_DB_URL" -f /backup/db.sql` — ignorar los errores de "must be owner"/"already exists" de tablas internas de Supabase, son esperados.
5. Restaurar Storage: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/restore-storage.mjs ./storage`
6. Verificar con un usuario real: loguearse y confirmar que ve sus pacientes y sus archivos — no alcanza con que la tabla tenga filas.

## Pendiente post-lanzamiento

Reconciliar el historial de migraciones (`TASKS.md`) para que `supabase
start`/`db reset` funcionen de cero **dentro de este repo** con el schema
real — no bloquea el drill de restauración (que usa un `supabase init`
aparte, fuera del repo), pero sigue haciendo falta para desarrollo local
normal dentro del proyecto.
