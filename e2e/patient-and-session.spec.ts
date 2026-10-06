import { test, expect, type Page } from "@playwright/test";
import { USER_A, makeTestClient } from "./supabaseTestClient";

// El DNI del alta exige 7-8 dígitos sin letras, y nombre/apellido solo
// letras — no se puede usar un identificador tipo "E2E-TEST..." como en
// rls.test.ts. 90000001 es un rango claramente de prueba, no colisiona con
// DNIs reales de 7-8 dígitos (ver fixName).
const TEST_DNI = "90000001";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(USER_A.email);
  await page.locator("#password").fill(USER_A.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // rls-test-a no tiene equipo hoy, así que el login va directo a
  // /dashboard sin pasar por el selector de workspace — pero si en el
  // futuro se le suma un equipo (ver src/test/rls.test.ts), el selector
  // aparecería acá, así que lo manejamos por las dudas.
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

let createdSessionId: string | null = null;

test.afterAll(async () => {
  // Borra (soft-delete) la sesión creada por este run — mismo RPC que usa
  // la app — para no acumular sesiones de prueba cada vez que corre. El
  // paciente queda (se reusa entre corridas, mismo patrón de rls.test.ts).
  if (!createdSessionId) return;
  const client = makeTestClient();
  const { error: signInErr } = await client.auth.signInWithPassword(USER_A);
  if (signInErr) return;
  // soft_delete_session rechaza sesiones de tipo "admission" (son la base
  // del episodio, no se pueden borrar — regla de negocio real, no un bug
  // del test). La primera corrida contra un paciente nuevo siempre crea
  // una admisión, que queda permanente a propósito, igual que el paciente
  // mismo. Solo limpiamos si terminó siendo una sesión de seguimiento.
  await client.rpc("soft_delete_session", { p_session_id: createdSessionId }).then(
    () => {},
    () => {}, // ignorar "no se puede eliminar una sesión de admisión"
  );
});

test("alta de paciente → registrar admisión → guardar sesión", async ({ page }) => {
  await login(page);

  await page.goto("/patients");
  await page.getByPlaceholder("Buscar por nombre o DNI...").fill(TEST_DNI);

  // La búsqueda tiene debounce — esperar a que el resultado (si existe)
  // aparezca, en vez de chequear isVisible() en el instante. "DNI 90000001"
  // (con el prefijo) para no matchear también el caption de resultados
  // ("1 paciente · búsqueda "90000001""). `:visible` porque Patients.tsx
  // renderiza una variante mobile y una desktop en paralelo (oculta por
  // CSS, no por render condicional — PR #23) y las dos quedan en el DOM.
  const existingRow = page.locator("p:visible").filter({ hasText: `DNI ${TEST_DNI}` });
  const patientExists = await existingRow
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (patientExists) {
    await existingRow.click();
  } else {
    await page.getByRole("button", { name: "Nuevo Paciente" }).click();
    await expect(page).toHaveURL(/\/patients\/new/);

    await page.getByTestId("patient-last-name").fill("Prueba");
    await page.getByTestId("patient-first-name").fill("Playwright");
    await page.getByTestId("patient-dni").fill(TEST_DNI);
    await page.getByTestId("patient-birth-date").fill("1990-01-01");
    await page.getByTestId("patient-nationality").fill("Argentina");

    await page.getByRole("button", { name: "Siguiente →" }).click(); // step 1 → 2
    await page.getByRole("button", { name: "Siguiente →" }).click(); // step 2 → 3
    await page.getByRole("button", { name: "Confirmar y guardar" }).click();

    await expect(page.getByText("Paciente registrado correctamente")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  }

  // "Registrar admisión" si el paciente no tiene sesiones todavía, si no
  // "Nueva sesión" — el componente decide solo, acá clickeamos lo que haya.
  await page.getByRole("button", { name: /Registrar admisión|Nueva sesión/ }).first().click();
  await expect(page).toHaveURL(/\/sessions\/new/);

  // session_date ya viene con la fecha de hoy por defecto — guardar directo
  // ejercita el mismo camino de guardado del crítico #2 de la auditoría
  // (docs/AUDIT_2026-10-02.md, PR #32: episode_diagnoses + treatment_episodes).
  await page.getByRole("button", { name: /Guardar sesión/ }).click();

  await expect(page.getByText("Sesión registrada correctamente")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);

  // Capturar el id de la sesión recién creada para limpiarla en afterAll.
  const client = makeTestClient();
  const { error: signInErr } = await client.auth.signInWithPassword(USER_A);
  if (!signInErr) {
    const { data: patient } = await client.from("patients").select("id").eq("dni", TEST_DNI).maybeSingle();
    if (patient) {
      const { data: session } = await client
        .from("therapy_sessions")
        .select("id")
        .eq("patient_id", patient.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (session) createdSessionId = session.id as string;
    }
  }
});
