// Contraparte de backup-storage.mjs: sube de vuelta a un bucket `clinical-files`
// todos los archivos de un directorio local (recursivo), preservando la
// estructura de carpetas como path dentro del bucket. Pensado para la prueba
// de restauración contra `supabase start` (ver docs/BACKUP_RESTORE.md) — no
// se usa en el workflow de backup, solo en la restauración.
//
// Uso: node scripts/restore-storage.mjs <directorio-origen>
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno (el bucket
// puede no existir todavía — lo crea si falta).

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const BUCKET = "clinical-files";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const srcDir = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !srcDir) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node restore-storage.mjs <dir>");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function main() {
  const { data: buckets } = await client.storage.listBuckets();
  if (!buckets.some((b) => b.name === BUCKET)) {
    const { error } = await client.storage.createBucket(BUCKET, { public: false });
    if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
  }

  const files = await walk(srcDir);
  console.log(`${files.length} archivo(s) para subir`);

  for (const full of files) {
    const path = relative(srcDir, full);
    const content = await readFile(full);
    const { error } = await client.storage.from(BUCKET).upload(path, content, { upsert: true });
    if (error) console.error(`Error subiendo ${path}: ${error.message}`);
  }

  console.log(`Listo: ${files.length} archivo(s) restaurados en ${BUCKET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
