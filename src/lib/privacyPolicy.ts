import { supabase } from "@/integrations/supabase/client";

export { CURRENT_PRIVACY_POLICY_VERSION } from "./privacyPolicyVersion";
import { CURRENT_PRIVACY_POLICY_VERSION } from "./privacyPolicyVersion";

// Inserta el registro de aceptación. Falla en silencio si no hay sesión real todavía
// (ej. InvitationRegister.tsx, donde el signUp requiere confirmar el email antes de
// tener sesión) — el gate de AppLayout.tsx es el que termina de cubrir ese caso en el
// primer login real.
export async function acceptPrivacyPolicy(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("privacy_consents").insert({
    user_id: userId,
    policy_version: CURRENT_PRIVACY_POLICY_VERSION,
  });
  return { error: error?.message ?? null };
}
