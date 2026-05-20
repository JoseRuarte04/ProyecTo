import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setIsAdmin(null); // sin sesión: AdminLayout maneja el redirect a login
      return;
    }
    setIsAdmin(null); // query en curso — AdminLayout muestra spinner
    supabase
      .from("admin_users")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .then(({ count }) => setIsAdmin((count ?? 0) > 0));
  }, [session]);

  return isAdmin;
}
