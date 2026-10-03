import { test, expect } from "@playwright/test";
import { USER_A } from "./supabaseTestClient";

test("login real → elegir workspace → Dashboard carga", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Correo electrónico").fill(USER_A.email);
  await page.locator("#password").fill(USER_A.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // rls-test-a no tiene equipo, así que el login va directo a /dashboard,
  // sin pasar por el selector de workspace (ese selector solo aparece si
  // hay más de un workspace disponible).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  await expect(page.getByText("Buenos días,")).toBeVisible();
});
