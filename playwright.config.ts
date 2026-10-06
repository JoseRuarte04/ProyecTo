import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// E2E piloto (docs/AUDIT_2026-10-02.md, "endurecer CI + sumar tests").
// Reemplaza el config de Lovable que quedó como resto (createLovableConfig
// de un paquete que ni siquiera está instalado, ver docs/TASKS.md).
//
// Corre contra el dev server local (puerto fijo en vite.config.ts) con el
// usuario de prueba de RLS (rls-test-a, misma cuenta que ya usa
// src/test/rls.test.ts). La password es un secreto real (ver
// DECISIONS.md 2026-10-06) — este loadEnv expone RLS_TEST_USER_A_PASSWORD
// desde .env vía process.env para e2e/supabaseTestClient.ts, que no pasa
// por Vite (Playwright no procesa import.meta.env). En CI viene directo
// de GitHub Secrets, inyectada en ci.yml.
Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
