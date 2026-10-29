import { createClient } from "@supabase/supabase-js";

// Antes hardcodeaba la URL/anon key de PRODUCCIÓN acá — cualquiera que
// corriera `npm run test:e2e` (local o CI) escribía en la base real. Ahora
// vienen de env (misma variable que usa la app, `VITE_SUPABASE_URL`/
// `VITE_SUPABASE_PUBLISHABLE_KEY` — Node no procesa import.meta.env acá,
// por eso van por process.env y no por Vite). En CI apuntan al Supabase
// LOCAL que levanta `supabase start` en el propio job (ver ci.yml); en
// local dev, lo que tengas en .env (ver .env.example).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Localmente: agregalas a .env " +
      "(ver .env.example). En CI: las exporta el step de `supabase status` en ci.yml.",
  );
}

// La password es un secreto real, no va hardcodeada (ver DECISIONS.md
// 2026-10-06) — local: agregarla a .env (ver .env.example); CI: GitHub
// Secrets, inyectada en ci.yml. Reusa la misma var que src/test/rls.test.ts
// (es la misma cuenta rls-test-a).
const RLS_TEST_USER_A_PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD;
if (!RLS_TEST_USER_A_PASSWORD) {
  throw new Error(
    "Falta RLS_TEST_USER_A_PASSWORD. Localmente: agregala a .env (ver .env.example). En CI: GitHub Secrets.",
  );
}

export const USER_A = { email: "rls-test-a@example.com", password: RLS_TEST_USER_A_PASSWORD };

// Cliente programático para setup/cleanup de datos de los specs (no para
// manejar UI) — mismo patrón que src/test/rls.test.ts.
export function makeTestClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
