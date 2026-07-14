import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Depender del id (primitivo) y no de `session` completo: supabase-js
    // entrega un objeto `session` nuevo en cada refresh de token (p.ej. al
    // volver de otra pestaña), y eso no debe disparar una nueva query ni
    // resetear isAdmin si el usuario es el mismo.
    if (!userId) {
      setIsAdmin(null); // sin sesión: AdminLayout maneja el redirect a login
      return;
    }
    setIsAdmin(null); // query en curso — AdminLayout muestra spinner
    supabase
      .from("admin_users")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => setIsAdmin((count ?? 0) > 0));
  }, [userId]);

  return isAdmin;
}
