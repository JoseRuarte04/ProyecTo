import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CURRENT_PRIVACY_POLICY_VERSION } from "@/lib/privacyPolicy";

// Mismo patrón que useIsAdmin.ts: null = "todavía no se sabe" (sesión sin resolver
// o query en curso), boolean = resultado real.
export function usePrivacyConsent() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null);

  const refetch = useCallback(() => {
    if (!userId) {
      setHasAccepted(null);
      return;
    }
    setHasAccepted(null);
    supabase
      .from("privacy_consents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("policy_version", CURRENT_PRIVACY_POLICY_VERSION)
      .then(({ count }) => setHasAccepted((count ?? 0) > 0));
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { hasAccepted, refetch };
}
