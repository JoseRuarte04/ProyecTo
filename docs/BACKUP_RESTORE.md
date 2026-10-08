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

## Probado dos veces: mecanismo con schema sintético, y drill completo con el dump real

**Mecanismo (schema sintético):** ver detalle abajo.

**Drill con el dump real de producción — hecho el 2026-10-08.** `supabase init`
+ `supabase start` en una carpeta temporal **fuera del repo**, sin nuestras
migraciones (un proyecto Supabase nuevo nunca arranca replayando los archivos
de migración de otro proyecto, así que esto es representativo de lo que
pasaría en un desastre real, no un atajo — y confirmado que **no depende de
arreglar el drift de migraciones**). Jose corrió el workflow a mano, descifró
el artifact en su máquina y dejó el `.tar` en `backups.local/`.

Resultado: **login real + ve sus pacientes + ve sus archivos — los 3
criterios, con datos reales** (10 usuarios, 36 pacientes, 65 sesiones, 9
archivos en el bucket `clinical-files`). En un usuario restaurado (sin
exponer cuál) se le puso una password de prueba **solo en la copia local
aislada** — nunca se tocó ni se conoció la password real de nadie. Con esa
password: login real → vio **18 pacientes vía RLS** (no los 36 totales del
sistema, confirma que el aislamiento entre profesionales también sobrevive
la restauración) → descargó uno de sus archivos reales vía API → **hash
SHA-256 idéntico al original**. Todo el material real (stack de Docker,
carpetas temporales, el `.tar` descifrado) se borró apenas terminó la
verificación.

**2 hallazgos nuevos sobre la prueba sintética anterior** (confirmados ahora
con el schema real, ya incorporados al procedimiento de abajo):
- Hacen falta los `GRANT` a `anon`/`authenticated`/`service_role` después de
  restaurar — en un `supabase init` nuevo no existen todavía (ver el punto ya
  conocido más abajo, antes solo confirmado con el schema sintético).
- Hay que **crear el bucket `clinical-files`** antes de poder subir los
  archivos — `pg_dump --no-privileges` no pudo insertar la fila en
  `storage.buckets` (mismo error de "permission denied for schema storage"
  que las demás tablas internas de Supabase). `scripts/restore-storage.mjs`
  ya lo crea solo si no existe, no hace falta un paso manual aparte.

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

### Procedimiento de restauración real (confirmado con el drill del 2026-10-08)

1. `supabase init` + `supabase start` en una carpeta **fuera de este repo**
   (ej. `/tmp/restore-<fecha>/`) — no hace falta que el drift de migraciones
   esté arreglado, un proyecto nuevo no replaya los archivos de migración de
   otro proyecto.
2. Descifrar: `gpg -o backup.tar -d backup.tar.gpg` (prompt interactivo de
   passphrase, no pasarla por `--passphrase` en la línea de comandos).
3. Extraer: `tar -xf backup.tar` (da `db.sql` + `storage/`)
4. Restaurar la base: `docker run --rm -v "$PWD:/backup" postgres:17 psql "$LOCAL_DB_URL" -f /backup/db.sql` — ignorar los errores de "must be owner"/"already exists"/"permission denied for schema auth|storage|realtime" de tablas internas de Supabase, son esperados. Los datos reales (`auth.users`, todo `public`) se restauran igual.
5. **Re-otorgar los `GRANT`** que `--no-privileges` no incluye (si no, la API
   responde "permission denied" aunque los datos ya estén):
   ```sql
   grant usage on schema public to anon, authenticated, service_role;
   grant all on all tables in schema public to anon, authenticated, service_role;
   grant all on all sequences in schema public to anon, authenticated, service_role;
   grant all on all routines in schema public to anon, authenticated, service_role;
   alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
   NOTIFY pgrst, 'reload schema';
   ```
6. Restaurar Storage: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/restore-storage.mjs ./storage` — crea el bucket solo si hace falta.
7. Verificar con un usuario real: ponerle una password de prueba **en esa
   copia local únicamente** (vía `crypt()`/`pgcrypto`, nunca se usa ni se
   conoce la password real de nadie), loguearse, y confirmar que ve sus
   pacientes **vía RLS** (no una consulta directa) y puede descargar sus
   archivos — no alcanza con que la tabla tenga filas.
8. Borrar todo el material real al terminar: `supabase stop --no-backup`, la
   carpeta temporal, y el `.tar`/`.tar.gpg` descifrados.

## Pendiente post-lanzamiento

Reconciliar el historial de migraciones (`TASKS.md`) para que `supabase
start`/`db reset` funcionen de cero **dentro de este repo** con el schema
real — el drill de restauración ya no depende de esto (usa `supabase init`
aparte, fuera del repo, confirmado el 2026-10-08), pero sigue haciendo falta
para desarrollo local normal dentro del proyecto.
