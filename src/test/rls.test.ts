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
 *
 * Las passwords NO van hardcodeadas (estuvieron en texto plano en este
 * archivo desde 2026-07-16, en un repo público — rotadas y movidas a env en
 * 2026-10-06, ver DECISIONS.md). Local: agregarlas a .env (ver
 * .env.example). CI: vienen de GitHub Secrets, inyectadas en ci.yml.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const RLS_TEST_USER_A_PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD;
const RLS_TEST_USER_B_PASSWORD = process.env.RLS_TEST_USER_B_PASSWORD;
if (!RLS_TEST_USER_A_PASSWORD || !RLS_TEST_USER_B_PASSWORD) {
  throw new Error(
    "Faltan RLS_TEST_USER_A_PASSWORD / RLS_TEST_USER_B_PASSWORD. " +
      "Localmente: agregalas a .env (ver .env.example). En CI: GitHub Secrets.",
  );
}

// El email no es secreto (identifica la cuenta, no da acceso); la password sí.
const USER_A = { email: "rls-test-a@example.com", password: RLS_TEST_USER_A_PASSWORD, name: "RLS Test A" };
const USER_B = { email: "rls-test-b@example.com", password: RLS_TEST_USER_B_PASSWORD, name: "RLS Test B" };
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
let userBId: string;
let patientId: string;
let sessionId: string;
let episodeId: string;

beforeAll(async () => {
  userAId = await signInOrSignUp(clientA, USER_A);
  userBId = await signInOrSignUp(clientB, USER_B);

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

  it("B no puede crear un token de QuickDASH para el paciente de A (regresión 2026-10-02)", async () => {
    // Hasta la migración 20261002100000, la policy de INSERT de
    // quickdash_tokens solo chequeaba `created_by = auth.uid()`, sin validar
    // que el paciente fuera realmente de B — ver docs/AUDIT_2026-10-02.md.
    const { data, error } = await clientB
      .from("quickdash_tokens")
      .insert({
        patient_id: patientId,
        session_id: sessionId,
        created_by: userBId,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  describe("turnos: reasignación por UPDATE (regresión 2026-10-08)", () => {
    // Hasta la migración 20261008120000, el WITH CHECK de "appointments: editar"
    // aceptaba `professional_id = auth.uid()` aunque el paciente no fuera suyo:
    // A podía dejar su turno apuntando al paciente (o al profesional) de B.
    // Los turnos no se pueden borrar (no hay policy de DELETE), así que se
    // reutiliza uno fijo para no acumular filas entre corridas.
    const APPT_DATE = "2030-01-01T12:00:00Z";
    const TEST_DNI_B = "RLS-TEST-00000002";
    let apptId: string;
    let patientBId: string;

    beforeAll(async () => {
      const { data: found, error: findErr } = await clientA
        .from("appointments")
        .select("id")
        .eq("patient_id", patientId)
        .eq("appointment_date", APPT_DATE)
        .limit(1);
      if (findErr) throw findErr;
      if (found.length > 0) {
        apptId = found[0].id;
      } else {
        const { data, error } = await clientA
          .from("appointments")
          .insert({ patient_id: patientId, professional_id: userAId, appointment_date: APPT_DATE })
          .select("id")
          .single();
        if (error) throw error;
        apptId = data.id;
      }

      const { data: pb, error: pbErr } = await clientB.from("patients").select("id").eq("dni", TEST_DNI_B).limit(1);
      if (pbErr) throw pbErr;
      if (pb.length > 0) {
        patientBId = pb[0].id;
      } else {
        const { data, error } = await clientB
          .from("patients")
          .insert({ professional_id: userBId, first_name: "Paciente", last_name: "De Prueba RLS B", dni: TEST_DNI_B })
          .select("id")
          .single();
        if (error) throw error;
        patientBId = data.id;
      }
    });

    const apptOwnership = async () => {
      const { data, error } = await clientA
        .from("appointments")
        .select("patient_id, professional_id")
        .eq("id", apptId)
        .single();
      if (error) throw error;
      return data;
    };

    it("A no puede reasignar su turno al paciente de B", async () => {
      const { error } = await clientA.from("appointments").update({ patient_id: patientBId }).eq("id", apptId);
      expect(error).not.toBeNull();
      expect(await apptOwnership()).toEqual({ patient_id: patientId, professional_id: userAId });
      const { data: seenByB } = await clientB.from("appointments").select("id").eq("id", apptId);
      expect(seenByB).toHaveLength(0);
    });

    it("A no puede pasarle su turno a B cambiando professional_id", async () => {
      const { error } = await clientA.from("appointments").update({ professional_id: userBId }).eq("id", apptId);
      expect(error).not.toBeNull();
      expect(await apptOwnership()).toEqual({ patient_id: patientId, professional_id: userAId });
    });

    it("A sigue pudiendo reprogramar su propio turno", async () => {
      const { error } = await clientA.from("appointments").update({ notes: "reprogramado" }).eq("id", apptId);
      expect(error).toBeNull();
    });
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
  // PromiseLike, no Promise: los query builders de supabase-js son
  // "thenables" (tienen .then, se pueden awaitear) pero no implementan la
  // interfaz completa de Promise (.catch/.finally/Symbol.toStringTag).
  async function expectDenied(query: PromiseLike<{ data: unknown[] | null; error: unknown }>) {
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
