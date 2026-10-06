// Descarga recursivamente todos los archivos del bucket `clinical-files` a un
// directorio local, preservando la estructura de carpetas
// ({userId}/{patientId}/{timestamp}_{nombre}, ver FileDialogs.tsx). Parte del
// backup semanal (.github/workflows/backup.yml) — pg_dump no cubre esto,
// son blobs en Storage, no filas de Postgres.
//
// Uso: node scripts/backup-storage.mjs <directorio-destino>
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno. La
// service_role key salta todo el RLS — es la única forma de listar/bajar
// todos los archivos de todos los profesionales, no solo los propios.

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const BUCKET = "clinical-files";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outDir = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !outDir) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backup-storage.mjs <dir>");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listAllFiles(prefix = "") {
  const { data, error } = await client.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list(${prefix}) falló: ${error.message}`);

  const files = [];
  for (const entry of data) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Supabase Storage no distingue carpeta/archivo en el listado — una
    // "carpeta" es cualquier entrada sin metadata de tamaño.
    if (entry.id === null) {
      files.push(...(await listAllFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

async function main() {
  const files = await listAllFiles();
  console.log(`${files.length} archivo(s) encontrados en ${BUCKET}`);

  for (const path of files) {
    const { data, error } = await client.storage.from(BUCKET).download(path);
    if (error) {
      console.error(`Error bajando ${path}: ${error.message}`);
      continue;
    }
    const destPath = join(outDir, path);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, Buffer.from(await data.arrayBuffer()));
  }

  console.log(`Listo: ${files.length} archivo(s) descargados en ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
