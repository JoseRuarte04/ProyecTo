import { createClient } from "@supabase/supabase-js";

// Mismos valores públicos por diseño que ya están en .github/workflows/ci.yml
// y en el bundle del cliente (anon key, no es secreto). Node no procesa
// import.meta.env acá (Playwright no pasa por Vite), así que van directo.
const SUPABASE_URL = "https://pvuaqatdendcgumwktid.supabase.co";
// gitleaks:allow — anon key pública (ver comentario arriba), no un secreto real.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2dWFxYXRkZW5kY2d1bXdrdGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODI1NDksImV4cCI6MjA5MDc1ODU0OX0.lXARzBHFr25LgypLiGivFC49FO4Yy6FdZiH4JMSl9lI"; // gitleaks:allow

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
