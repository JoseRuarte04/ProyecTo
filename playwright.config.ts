import { defineConfig, devices } from "@playwright/test";

// E2E piloto (docs/AUDIT_2026-10-02.md, "endurecer CI + sumar tests").
// Reemplaza el config de Lovable que quedó como resto (createLovableConfig
// de un paquete que ni siquiera está instalado, ver docs/TASKS.md).
//
// Corre contra el dev server local (puerto fijo en vite.config.ts) con el
// usuario de prueba de RLS (rls-test-a / rls-test-b, mismas credenciales
// que ya usa src/test/rls.test.ts — no son datos nuevos ni secretos reales).
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
