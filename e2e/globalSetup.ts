import { makeTestClient, USER_A } from "./supabaseTestClient";
import { CURRENT_PRIVACY_POLICY_VERSION } from "../src/lib/privacyPolicyVersion";

// Corre una vez antes de todos los specs. Sin esto, rls-test-a no tiene fila en
// privacy_consents y el gate bloqueante de AppLayout.tsx (ver DECISIONS.md
// 2026-10-06) tapa el <Outlet /> — login.spec.ts y patient-and-session.spec.ts
// fallarían los dos. Patrón "crear si no existe", igual que el resto del setup
// de e2e (ver patient-and-session.spec.ts).
export default async function globalSetup() {
  const client = makeTestClient();
  const { error: signInErr } = await client.auth.signInWithPassword(USER_A);
  if (signInErr) return;

  const { data: user } = await client.auth.getUser();
  if (!user.user) return;

  const { count } = await client
    .from("privacy_consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.user.id)
    .eq("policy_version", CURRENT_PRIVACY_POLICY_VERSION);

  if (!count) {
    await client.from("privacy_consents").insert({
      user_id: user.user.id,
      policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    });
  }
}
