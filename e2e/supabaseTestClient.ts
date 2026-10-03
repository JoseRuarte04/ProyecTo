import { createClient } from "@supabase/supabase-js";

// Mismos valores públicos por diseño que ya están en .github/workflows/ci.yml
// y en el bundle del cliente (anon key, no es secreto). Node no procesa
// import.meta.env acá (Playwright no pasa por Vite), así que van directo.
const SUPABASE_URL = "https://pvuaqatdendcgumwktid.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2dWFxYXRkZW5kY2d1bXdrdGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODI1NDksImV4cCI6MjA5MDc1ODU0OX0.lXARzBHFr25LgypLiGivFC49FO4Yy6FdZiH4JMSl9lI";

export const USER_A = { email: "rls-test-a@example.com", password: "rls-test-Aa-2026!x" };

// Cliente programático para setup/cleanup de datos de los specs (no para
// manejar UI) — mismo patrón que src/test/rls.test.ts.
export function makeTestClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
