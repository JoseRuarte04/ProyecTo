import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tests de las RPCs admin_* e is_super_admin() — contra un Supabase LOCAL.
 *
 * Mismo criterio de seguridad que rls.test.ts: aborta si no apunta a un
 * Supabase local (ver ese archivo para el razonamiento completo). Va en su
 * propio archivo porque usa un tercer usuario (super-admin, creado por
 * scripts/ci/seed-local-test-users.mjs) que no participa de los escenarios
 * de aislamiento profesional-a-profesional de rls.test.ts.
 *
 * Cobertura: confirma que CADA RPC admin_* rechaza a un profesional normal
 * y a anon con 'unauthorized' (el peor escenario: alguien sin privilegios
 * ejecutando una acción de super-admin). El camino feliz (que un admin real
 * pueda consultar) se prueba para las RPCs de solo lectura. Las que mutan
 * datos (crear equipo, mover paciente, activar/desactivar terapeuta, subir
 * feedback, upsert de terapeuta) quedan sin camino feliz todavía — ver
 * docs/TASKS.md, requieren fixtures propios (terapeutas/equipos de prueba)
 * que no existen hoy en esta suite.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Mismo patrón que rls.test.ts: allowlist de Supabase local, sin variable de
// escape. Ver ese archivo / docs/DECISIONS.md [2026-10-29] para el porqué.
const LOCAL_SUPABASE_URL_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/;
if (!SUPABASE_URL || !LOCAL_SUPABASE_URL_PATTERN.test(SUPABASE_URL)) {
  throw new Error(
    `adminRpc.test.ts solo puede correr contra un Supabase LOCAL (URL tipo "http://127.0.0.1:<puerto>"). ` +
      `VITE_SUPABASE_URL actual: "${SUPABASE_URL ?? "(vacío)"}". Mismo criterio que rls.test.ts — sin excepciones.`,
  );
}

const RLS_TEST_USER_A_PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD;
const RLS_TEST_USER_ADMIN_PASSWORD = process.env.RLS_TEST_USER_ADMIN_PASSWORD;
if (!RLS_TEST_USER_A_PASSWORD || !RLS_TEST_USER_ADMIN_PASSWORD) {
  throw new Error(
    "Faltan RLS_TEST_USER_A_PASSWORD / RLS_TEST_USER_ADMIN_PASSWORD. " +
      "Localmente: agregalas a .env (ver .env.example, corré scripts/ci/seed-local-test-users.mjs). En CI: GitHub Secrets.",
  );
}

const USER_A = { email: "rls-test-a@example.com", password: RLS_TEST_USER_A_PASSWORD };
const USER_ADMIN = { email: "rls-test-admin@example.com", password: RLS_TEST_USER_ADMIN_PASSWORD };

function makeClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client: SupabaseClient, user: { email: string; password: string }): Promise<void> {
  const { error } = await client.auth.signInWithPassword(user);
  if (error) {
    throw new Error(
      `No se pudo loguear ${user.email}: ${error.message}. ¿Corriste scripts/ci/seed-local-test-users.mjs ` +
        `con RLS_TEST_USER_ADMIN_PASSWORD seteada?`,
    );
  }
}

const clientA = makeClient();
const clientAdmin = makeClient();
const clientAnon = makeClient();

beforeAll(async () => {
  await signIn(clientA, USER_A);
  await signIn(clientAdmin, USER_ADMIN);
});

// Dummy args sintácticamente válidos: el chequeo `IF NOT is_super_admin()`
// corre antes de validar cualquier parámetro en las 17 RPCs (confirmado
// leyendo supabase/migrations/20261011210000_baseline_schema.sql), así que
// no hace falta que representen datos reales para probar el rechazo.
const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

// clientA.rpc() solo admite los nombres de RPC definidos en el Database
// generado — acá se llama dinámicamente desde una tabla de casos, así que
// se tipa el helper una sola vez en vez de repetir el `as` en cada call.
type RpcCaller = (name: string, args: Record<string, unknown>) => ReturnType<SupabaseClient["rpc"]>;
const callRpc = (client: SupabaseClient): RpcCaller =>
  (name, args) => (client.rpc as unknown as RpcCaller)(name, args);

const ADMIN_RPCS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: "admin_create_team", args: { p_name: "x", p_admin_user_id: DUMMY_UUID } },
  { name: "admin_deactivate_therapist", args: { p_user_id: DUMMY_UUID } },
  { name: "admin_get_active_teams", args: {} },
  { name: "admin_get_activity", args: {} },
  { name: "admin_get_inactive_therapists", args: {} },
  { name: "admin_get_monthly_sessions", args: {} },
  { name: "admin_get_stale_invitations", args: {} },
  { name: "admin_get_stats", args: {} },
  { name: "admin_get_trends", args: {} },
  { name: "admin_list_patients", args: {} },
  { name: "admin_list_pending_invitations", args: {} },
  { name: "admin_list_therapists", args: {} },
  { name: "admin_move_patient_to_team", args: { p_patient_id: DUMMY_UUID } },
  { name: "admin_reactivate_therapist", args: { p_user_id: DUMMY_UUID } },
  { name: "admin_set_team_limit", args: { p_team_id: DUMMY_UUID, p_limit: 5 } },
  { name: "admin_update_feedback_status", args: { p_feedback_id: DUMMY_UUID, p_status: "visto" } },
  { name: "admin_upsert_therapist", args: { p_user_id: DUMMY_UUID, p_full_name: "x", p_email: "x@example.com" } },
];

describe("admin_* RPCs: rechazadas por is_super_admin()", () => {
  for (const { name, args } of ADMIN_RPCS) {
    it(`${name} rechaza a un profesional no-admin`, async () => {
      const { data, error } = await callRpc(clientA)(name, args);
      expect(error).not.toBeNull();
      expect(String(error?.message)).toMatch(/unauthorized/i);
      expect(data).toBeNull();
    });

    it(`${name} rechaza a anon (sin sesión)`, async () => {
      const { data, error } = await callRpc(clientAnon)(name, args);
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  }
});

describe("admin_* RPCs de solo lectura: camino feliz para un super-admin real", () => {
  const READ_ONLY_RPCS = [
    "admin_get_stats",
    "admin_list_therapists",
    "admin_list_patients",
    "admin_get_active_teams",
    "admin_get_activity",
    "admin_list_pending_invitations",
    "admin_get_monthly_sessions",
    "admin_get_trends",
    "admin_get_inactive_therapists",
    "admin_get_stale_invitations",
  ];

  for (const name of READ_ONLY_RPCS) {
    it(`${name} responde sin error para rls-test-admin`, async () => {
      const { data, error } = await callRpc(clientAdmin)(name, {});
      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });
  }
});
