import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tests de RLS contra el proyecto Supabase real.
 *
 * Verifican el contrato de seguridad central del producto: un profesional
 * NO puede leer ni tocar pacientes/sesiones/fichas de otro profesional.
 *
 * Usa dos usuarios de prueba fijos (rls-test-a/b@example.com) que ya existen
 * en el proyecto. OJO: desde la migración 20260716 el registro es solo por
 * invitación, así que si alguien los borra la suite NO puede recrearlos —
 * habría que invitarlos de nuevo desde el dashboard. Los datos de prueba
 * son fijos y se reutilizan entre corridas — la suite no acumula filas.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Credenciales de los usuarios de prueba. Solo contienen data ficticia;
// la anon key con la que se crean es pública por diseño.
const USER_A = { email: "rls-test-a@example.com", password: "rls-test-Aa-2026!x", name: "RLS Test A" };
const USER_B = { email: "rls-test-b@example.com", password: "rls-test-Bb-2026!x", name: "RLS Test B" };
const TEST_DNI = "RLS-TEST-00000001";

function makeClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInOrSignUp(client: SupabaseClient, user: typeof USER_A): Promise<string> {
  const signIn = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (!signIn.error) return signIn.data.user.id;

  const signUp = await client.auth.signUp({
    email: user.email,
    password: user.password,
    options: { data: { full_name: user.name } },
  });
  if (signUp.error)
    throw new Error(
      `No se pudo crear ${user.email}: ${signUp.error.message}. ` +
        `El signup está cerrado (solo por invitación) — si el usuario de prueba fue borrado, invitalo desde el dashboard de Supabase.`,
    );
  if (!signUp.data.session) throw new Error("signUp no devolvió sesión — ¿autoconfirm desactivado?");
  return signUp.data.user!.id;
}

const clientA = makeClient();
const clientB = makeClient();
const clientAnon = makeClient();

let userAId: string;
let patientId: string;
let sessionId: string;
let episodeId: string;

beforeAll(async () => {
  userAId = await signInOrSignUp(clientA, USER_A);
  await signInOrSignUp(clientB, USER_B);

  // Datos fijos del profesional A (crear solo si no existen)
  const { data: existing, error: findErr } = await clientA
    .from("patients")
    .select("id")
    .eq("dni", TEST_DNI)
    .limit(1);
  if (findErr) throw findErr;

  if (existing.length > 0) {
    patientId = existing[0].id;
  } else {
    const { data, error } = await clientA
      .from("patients")
      .insert({ professional_id: userAId, first_name: "Paciente", last_name: "De Prueba RLS", dni: TEST_DNI })
      .select("id")
      .single();
    if (error) throw error;
    patientId = data.id;
  }

  const { data: sessions, error: sessFindErr } = await clientA
    .from("therapy_sessions")
    .select("id")
    .eq("patient_id", patientId)
    .limit(1);
  if (sessFindErr) throw sessFindErr;

  if (sessions.length > 0) {
    sessionId = sessions[0].id;
  } else {
    const { data, error } = await clientA
      .from("therapy_sessions")
      .insert({ patient_id: patientId, professional_id: userAId })
      .select("id")
      .single();
    if (error) throw error;
    sessionId = data.id;
  }

  const { data: records, error: recFindErr } = await clientA
    .from("patient_clinical_records")
    .select("id")
    .eq("patient_id", patientId)
    .limit(1);
  if (recFindErr) throw recFindErr;

  if (records.length === 0) {
    const { error } = await clientA.from("patient_clinical_records").insert({ patient_id: patientId });
    if (error) throw error;
  }

  const { data: episodes, error: epFindErr } = await clientA
    .from("treatment_episodes")
    .select("id")
    .eq("patient_id", patientId)
    .limit(1);
  if (epFindErr) throw epFindErr;

  if (episodes.length > 0) {
    episodeId = episodes[0].id;
  } else {
    const { data, error } = await clientA
      .from("treatment_episodes")
      .insert({ patient_id: patientId, professional_id: userAId })
      .select("id")
      .single();
    if (error) throw error;
    episodeId = data.id;
  }

  const { data: diagnoses, error: dxFindErr } = await clientA
    .from("episode_diagnoses")
    .select("id")
    .eq("episode_id", episodeId)
    .limit(1);
  if (dxFindErr) throw dxFindErr;

  if (diagnoses.length === 0) {
    const { error } = await clientA
      .from("episode_diagnoses")
      .insert({ episode_id: episodeId, patient_id: patientId, label: "RLS — diagnóstico de prueba" });
    if (error) throw error;
  }
}, 60_000);

describe("RLS: aislamiento entre profesionales", () => {
  it("sanity: A ve su propio paciente", async () => {
    const { data, error } = await clientA.from("patients").select("id").eq("id", patientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("B no puede ver el paciente de A", async () => {
    const { data, error } = await clientB.from("patients").select("id").eq("id", patientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("B no puede editar el paciente de A", async () => {
    const { data, error } = await clientB
      .from("patients")
      .update({ first_name: "Hackeado" })
      .eq("id", patientId)
      .select("id");
    expect(error).toBeNull(); // RLS filtra silenciosamente: 0 filas afectadas
    expect(data).toHaveLength(0);
  });

  it("B no puede crear un paciente a nombre de A", async () => {
    const { error } = await clientB
      .from("patients")
      .insert({ professional_id: userAId, first_name: "X", last_name: "X", dni: "RLS-TEST-FORGED" });
    expect(error).not.toBeNull();
  });

  it("B no puede ver la sesión clínica de A", async () => {
    const { data, error } = await clientB.from("therapy_sessions").select("id").eq("id", sessionId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("B no puede crear una sesión sobre el paciente de A", async () => {
    const { error } = await clientB
      .from("therapy_sessions")
      .insert({ patient_id: patientId, professional_id: userAId });
    expect(error).not.toBeNull();
  });

  it("B no puede borrar (soft delete) la sesión de A vía RPC", async () => {
    const { error } = await clientB.rpc("soft_delete_session", { p_session_id: sessionId });
    expect(error).not.toBeNull();
  });

  it("B no puede ver la ficha clínica del paciente de A", async () => {
    const { data, error } = await clientB
      .from("patient_clinical_records")
      .select("id")
      .eq("patient_id", patientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("B no puede ver los diagnósticos del episodio de A", async () => {
    const { data, error } = await clientB
      .from("episode_diagnoses")
      .select("id")
      .eq("patient_id", patientId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("B no puede agregar un diagnóstico al episodio de A", async () => {
    const { data, error } = await clientB
      .from("episode_diagnoses")
      .insert({ episode_id: episodeId, patient_id: patientId, label: "Forjado" })
      .select("id");
    // RLS puede rechazar con error o filtrar silenciosamente; lo prohibido
    // es que la fila se inserte.
    if (!error) expect(data).toHaveLength(0);
    const { data: check } = await clientA
      .from("episode_diagnoses")
      .select("id")
      .eq("episode_id", episodeId)
      .eq("label", "Forjado");
    expect(check).toHaveLength(0);
  });

  it("B no puede editar el perfil de A", async () => {
    const { data, error } = await clientB
      .from("profiles")
      .update({ full_name: "Hackeado" })
      .eq("id", userAId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("RLS: sin sesión (anon)", () => {
  // Denegado puede ser "permission denied" (42501) o lista vacía — ambos
  // significan que anon no accede a nada; lo prohibido es recibir filas.
  async function expectDenied(query: Promise<{ data: unknown[] | null; error: unknown }>) {
    const { data, error } = await query;
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data).toHaveLength(0);
    }
  }

  it("anon no ve ningún paciente", async () => {
    await expectDenied(clientAnon.from("patients").select("id").limit(5));
  });

  it("anon no ve sesiones clínicas", async () => {
    await expectDenied(clientAnon.from("therapy_sessions").select("id").limit(5));
  });

  it("anon no ve perfiles de profesionales", async () => {
    await expectDenied(clientAnon.from("profiles").select("id").limit(5));
  });

  it("anon no ve diagnósticos de episodios", async () => {
    await expectDenied(clientAnon.from("episode_diagnoses").select("id").limit(5));
  });

  it("no se puede crear una cuenta sin invitación (signup cerrado)", async () => {
    // handle_new_user rechaza el alta salvo invitación pendiente o invite
    // nativo; si esto alguna vez pasa, se creó un usuario basura real.
    const { data, error } = await clientAnon.auth.signUp({
      email: "rls-test-intruso@example.com",
      password: "Password-Fuerte-99!",
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});
