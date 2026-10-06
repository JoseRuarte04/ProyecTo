# E2E (Playwright) — piloto

Corre contra el dev server local (`npm run dev`, puerto 8080, lo levanta
solo `webServer` en `playwright.config.ts`) y contra Supabase real, con el
mismo usuario de prueba que ya usa `src/test/rls.test.ts`
(`rls-test-a@example.com`) — no son credenciales nuevas, están documentadas
ahí y el signup de la app está cerrado solo por invitación, así que si se
borra ese usuario hay que reinvitarlo desde el dashboard de Supabase.

Piloto de 2 specs (`docs/AUDIT_2026-10-02.md`, "endurecer CI + sumar
tests"):

- `login.spec.ts`: login real → selección de workspace → Dashboard carga.
  No crea datos.
- `patient-and-session.spec.ts`: alta de un paciente de prueba (DNI fijo,
  `90000001`, mismo patrón de "crear solo si no existe" que usa
  `rls.test.ts` — no acumula pacientes duplicados entre corridas) → entra a
  "Registrar admisión" → guarda la sesión con los valores por defecto
  (fecha de hoy) → confirma el toast de éxito. Ejercita el mismo camino de
  guardado que se arregló en el PR #32 (crítico #2 de la auditoría). La
  sesión creada se borra (soft-delete, vía `soft_delete_session`, mismo RPC
  que usa la app) en `afterAll` para no acumular sesiones de prueba en cada
  corrida — el paciente queda, igual que el patrón ya establecido.

Correr local: `npx playwright test` (con el dev server apagado — Playwright
lo levanta solo) o `npx playwright test --headed` para verlo.

Corre en `ci.yml` (job `e2e`, agregado 2026-10-06) contra Supabase real de
producción — sin ambiente de preview aislado porque el plan de Supabase es
free y no tiene branching (ver `docs/DECISIONS.md`). El job es NO
bloqueante todavía (no está en `required_status_checks` de `main`): es
nuevo y depende de un servicio real, así que puede ser más flaky que el
resto de CI. El job tiene su propio `concurrency` group para evitar que dos
PRs activos a la vez se pisen sobre el DNI de prueba fijo.
