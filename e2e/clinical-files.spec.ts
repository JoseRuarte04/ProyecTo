import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { test, expect, type Page } from "@playwright/test";
import { USER_A, makeTestClient } from "./supabaseTestClient";

// DNI propio (no 90000001, el de patient-and-session.spec.ts) para no
// compartir el mismo paciente entre specs que pueden correr en paralelo
// (fullyParallel: true en playwright.config.ts) — mismo criterio que ya
// usa esa otra suite.
const TEST_DNI = "90000002";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(USER_A.email);
  await page.locator("#password").fill(USER_A.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  const picker = page.getByText("¿Con qué perfil trabajás hoy?");
  await Promise.race([
    picker.waitFor({ timeout: 10_000 }).catch(() => {}),
    page.waitForURL(/\/dashboard/, { timeout: 10_000 }).catch(() => {}),
  ]);
  if (await picker.isVisible().catch(() => false)) {
    await page.getByText("Personal", { exact: true }).click();
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

async function goToTestPatient(page: Page) {
  await page.goto("/patients");
  await page.getByPlaceholder("Buscar por nombre o DNI...").fill(TEST_DNI);

  const existingRow = page.locator("p:visible").filter({ hasText: `DNI ${TEST_DNI}` });
  const patientExists = await existingRow
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (patientExists) {
    await existingRow.click();
    return;
  }

  await page.getByRole("button", { name: "Nuevo Paciente" }).click();
  await expect(page).toHaveURL(/\/patients\/new/);
  await page.getByTestId("patient-last-name").fill("ArchivosPrueba");
  await page.getByTestId("patient-first-name").fill("Playwright");
  await page.getByTestId("patient-dni").fill(TEST_DNI);
  await page.getByTestId("patient-birth-date").fill("1990-01-01");
  await page.getByTestId("patient-nationality").fill("Argentina");
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await page.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(page.getByText("Paciente registrado correctamente")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
}

const uploadedFileIds: string[] = [];

test.afterAll(async () => {
  // Limpieza directa contra Postgres (no vía el cliente autenticado de la
  // app): el soft-delete por la UI está roto hoy (ver el test .skip de
  // abajo) — intentar limpiar con el mismo camino roto fallaría también.
  // SUPABASE_DB_URL lo exporta ci.yml después de "Levantar Supabase local"
  // (mismo nombre que usa scripts/ci/seed-local-test-users.mjs); si no está
  // seteada (ej. alguien corriendo este spec suelto sin ese paso), se
  // salta la limpieza en vez de romper la corrida por un side-effect.
  if (uploadedFileIds.length === 0) return;
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.warn("SUPABASE_DB_URL no está seteada — no se pudo limpiar clinical_files de prueba:", uploadedFileIds);
    return;
  }
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  await client.query("UPDATE clinical_files SET is_deleted = true WHERE id = ANY($1::uuid[])", [uploadedFileIds]);
  await client.end();
});

test("agregar archivo: rechaza un tipo de archivo no permitido y sube uno válido", async ({ page }) => {
  await login(page);
  await goToTestPatient(page);

  await page.getByRole("tab", { name: "Archivos" }).click();
  await expect(page.getByText("Archivos clínicos")).toBeVisible();

  // ── Tipo de archivo rechazado: no debe dejar enviar ──
  await page.getByRole("button", { name: "Agregar archivo" }).click();
  await page.getByText("Seleccionar categoría").click();
  await page.getByRole("option", { name: "Documento" }).click();

  const fileInput = page.locator('input[type="file"]');
  // text/plain no está en ALLOWED_CLINICAL_FILE_TYPES (FileDialogs.tsx) —
  // setInputFiles acepta pasar el contenido inline con el mimeType que
  // declaramos, sin depender de un archivo .txt en el repo.
  await fileInput.setInputFiles({
    name: "no-permitido.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("esto no es un archivo clínico válido"),
  });
  await expect(page.getByText("Formato no permitido. Usá JPG, PNG, WebP, GIF, PDF, MP4 o MOV.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir" })).toBeDisabled();

  // ── Subida válida ──
  await fileInput.setInputFiles(TEST_IMAGE);
  await expect(page.getByRole("button", { name: "Subir" })).toBeEnabled();
  await page.getByRole("button", { name: "Subir" }).click();

  await expect(page.getByText("Archivo guardado correctamente")).toBeVisible({ timeout: 10_000 });
  // .last(): el soft-delete está roto hoy (ver el test .skip de abajo), así
  // que una corrida local anterior puede haber dejado otro "test-image.png"
  // sin borrar — alcanza con confirmar que el recién subido está visible,
  // no que sea el único.
  await expect(page.getByText("test-image.png").last()).toBeVisible();

  // Verificación contra la base real: que quedó bien escrito (categoría,
  // paciente, no borrado), no solo que apareció un toast.
  const client = makeTestClient();
  const { error: signInErr } = await client.auth.signInWithPassword(USER_A);
  expect(signInErr).toBeNull();
  const { data: patient } = await client.from("patients").select("id").eq("dni", TEST_DNI).maybeSingle();
  expect(patient).not.toBeNull();
  const { data: fileRow } = await client
    .from("clinical_files")
    .select("id, category, is_deleted, patient_id")
    .eq("patient_id", patient!.id as string)
    .eq("file_name", "test-image.png")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(fileRow).not.toBeNull();
  expect(fileRow!.category).toBe("document");
  uploadedFileIds.push(fileRow!.id as string);
});

test.skip(
  "eliminar un archivo clínico (BUG REAL encontrado 2026-10-29, no corregido en este PR): " +
    "el soft-delete está roto para cualquier usuario real — ver docs/DECISIONS.md",
  async ({ page }) => {
    // Reproducido primero vía UI (Playwright) y confirmado después con el
    // mismo @supabase/supabase-js que usa la app, logueado como
    // rls-test-a: `supabase.from("clinical_files").update({is_deleted:true}).eq("id", ...)`
    // devuelve `{ code: '42501', message: 'permission denied for function insert_audit_log' }`.
    //
    // Causa raíz (confirmada en supabase/migrations/20261011210000_baseline_schema.sql):
    // el trigger `trg_clinical_files_soft_delete` (línea ~4146) ejecuta
    // `handle_file_soft_delete()` (línea ~1364) ANTES de cada UPDATE de
    // `is_deleted` en `clinical_files`. Esa función llama a
    // `insert_audit_log(...)` pero NO está declarada `SECURITY DEFINER` —
    // corre con los permisos del usuario autenticado, no de `postgres`.
    // `insert_audit_log` tiene `REVOKE ALL FROM PUBLIC` + `GRANT ALL TO
    // service_role` únicamente (línea ~5495) — ningún usuario autenticado
    // real tiene permiso para ejecutarla. Resultado: CUALQUIER intento de
    // borrar (o restaurar) un archivo clínico desde la app falla con
    // "Error al eliminar el archivo", para cualquier usuario, siempre.
    //
    // Fix sugerido (no aplicado acá — decisión de Jose, toca una función
    // de confianza/seguridad, no es parte de este plan de testing): agregar
    // `SECURITY DEFINER` a `handle_file_soft_delete()`, mismo patrón que
    // usan el resto de las funciones de este archivo que sí llaman a
    // `insert_audit_log()` con éxito (ej. `admin_deactivate_therapist`,
    // línea ~324, si se confirma que esa sí es SECURITY DEFINER).
    await login(page);
    await goToTestPatient(page);
    await page.getByRole("tab", { name: "Archivos" }).click();

    const fileCard = page.locator("div.flex.items-center.gap-3").filter({ hasText: "test-image.png" });
    await fileCard.getByRole("button").last().click();
    await expect(page.getByText("¿Eliminar archivo?")).toBeVisible();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Archivo eliminado")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("test-image.png")).not.toBeVisible();
  },
);
